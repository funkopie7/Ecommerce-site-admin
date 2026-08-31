import type { Prisma, PaymentStatus } from "@prisma/client";
import { priceBundles, totalForItems, type BundleCartLine, type CollectionDef } from "@/lib/checkout";

export type OrderPayment = { method: string; note?: string };

/** Reads the customer's own cart from the DB (never trusts a client-supplied
 * total) and prices any bundles. Shared by the Razorpay quote step (read-only
 * — pass the base `prisma` client) and createOrderFromCart below (inside a
 * transaction — pass `tx`), so the amount quoted to Razorpay and the amount
 * the order is actually created for come from the exact same computation.
 * Throws "CART" | "STOCK". */
export async function pricedCart(client: Prisma.TransactionClient, customerId: string) {
  const cart = await client.cart.findUnique({ where: { customerId }, include: { items: { include: { product: true } } } });
  if (!cart?.items.length) throw new Error("CART");
  for (const item of cart.items) if (!item.product.visible || item.product.stockQuantity < item.quantity) throw new Error("STOCK");

  // Reprice any bundle-tagged lines at their collection's price before the
  // subtotal is computed, so a customer who kept a whole bundle together is
  // actually charged the bundle price — see lib/checkout.priceBundles.
  const collectionIds = [...new Set(cart.items.map((item) => item.collectionId).filter((id): id is string => id !== null))];
  const collectionRows = collectionIds.length
    ? await client.collection.findMany({ where: { id: { in: collectionIds } }, include: { items: true } })
    : [];
  const collections = new Map<string, CollectionDef>(
    collectionRows.map((collection) => [
      collection.id,
      { id: collection.id, price: collection.price, items: collection.items.map((item) => ({ productId: item.productId, quantity: item.quantity })) },
    ]),
  );

  const lines: BundleCartLine[] = cart.items.map((item) => ({
    productId: item.productId,
    collectionId: item.collectionId,
    unitPrice: item.product.price,
    quantity: item.quantity,
  }));
  const priced = priceBundles(lines, collections);
  return { cart, priced, subtotal: totalForItems(priced) };
}

/** Shared by the COD/demo checkout flow and the Razorpay-verified flow —
 * creates the Order + OrderItems from the priced cart, decrements stock,
 * and clears the cart, all in one transaction. Throws "ADDRESS", or
 * whatever pricedCart throws ("CART" | "STOCK").
 *
 * `recordPayment` is only passed for a real, verified payment (Razorpay) —
 * it sets amountPaid to the order's full total and writes a Payment audit
 * row. The COD/demo flow omits it, leaving amountPaid at its default so its
 * existing behaviour is unchanged by this extraction. */
export async function createOrderFromCart(
  tx: Prisma.TransactionClient,
  args: { customerId: string; addressId: string; paymentStatus: PaymentStatus; recordPayment?: OrderPayment },
) {
  const address = await tx.address.findFirst({ where: { id: args.addressId, customerId: args.customerId } });
  if (!address) throw new Error("ADDRESS");

  const { cart, priced, subtotal } = await pricedCart(tx, args.customerId);
  const pricedByProductId = new Map(priced.map((line) => [line.productId, line]));

  const order = await tx.order.create({
    data: {
      number: `MC-${Date.now().toString().slice(-8)}`,
      customerId: args.customerId,
      subtotal,
      total: subtotal,
      paymentStatus: args.paymentStatus,
      ...(args.recordPayment ? { amountPaid: subtotal } : {}),
      status: "CONFIRMED",
      addressSnapshot: address,
      items: {
        create: cart.items.map((item) => {
          const line = pricedByProductId.get(item.productId)!;
          return {
            productId: item.productId,
            name: item.product.name,
            sku: item.product.sku,
            unitPrice: line.unitPrice,
            quantity: item.quantity,
            collectionId: line.collectionId,
          };
        }),
      },
    },
  });

  if (args.recordPayment) await tx.payment.create({ data: { orderId: order.id, amount: subtotal, method: args.recordPayment.method, note: args.recordPayment.note } });

  for (const item of cart.items) await tx.product.update({ where: { id: item.productId }, data: { stockQuantity: { decrement: item.quantity } } });
  await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
  return order;
}

export function checkoutErrorResponse(caught: unknown): { message: string; status: number } {
  const code = caught instanceof Error ? caught.message : "";
  if (code === "STOCK") return { message: "One or more items are no longer in stock", status: 409 };
  if (code === "CART") return { message: "Your bag is empty", status: 400 };
  if (code === "ADDRESS") return { message: "Delivery address not found", status: 400 };
  return { message: "Could not place your order", status: 500 };
}
