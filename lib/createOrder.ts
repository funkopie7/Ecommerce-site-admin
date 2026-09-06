import type { Prisma, PaymentStatus } from "@prisma/client";
import { priceBundles, totalForItems, type BundleCartLine, type CollectionDef } from "@/lib/checkout";
import { findActiveCoupon, discountFor, couponErrorMessage } from "@/lib/coupon";

export type OrderPayment = { method: string; note?: string };

/** Reads the customer's own cart from the DB (never trusts a client-supplied
 * total) and prices any bundles, then any coupon. Shared by the Razorpay
 * quote step (read-only — pass the base `prisma` client) and
 * createOrderFromCart below (inside a transaction — pass `tx`), so the
 * amount quoted to Razorpay and the amount the order is actually created for
 * come from the exact same computation.
 *
 * Only reads the coupon here — it does not increment usedCount, since a
 * quote that's never turned into an order (an abandoned Razorpay modal)
 * must not burn a redemption. createOrderFromCart increments it itself,
 * inside the same transaction that actually creates the order.
 *
 * Throws "CART" | "STOCK" | "COUPON_INVALID" | "COUPON_EXPIRED" | "COUPON_EXHAUSTED". */
export async function pricedCart(client: Prisma.TransactionClient, customerId: string, couponCode?: string) {
  const cart = await client.cart.findUnique({ where: { customerId }, include: { items: { include: { product: true } } } });
  if (!cart?.items.length) throw new Error("CART");
  for (const item of cart.items) if (!item.product.visible || (!item.product.isPreorder && item.product.stockQuantity < item.quantity)) throw new Error("STOCK");

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
  const subtotal = totalForItems(priced);

  let discount = 0;
  let appliedCouponCode: string | null = null;
  if (couponCode?.trim()) {
    const coupon = await findActiveCoupon(client, couponCode);
    discount = discountFor(coupon, subtotal);
    appliedCouponCode = coupon.code;
  }

  return { cart, priced, subtotal, discount, total: subtotal - discount, couponCode: appliedCouponCode };
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
  args: { customerId: string; addressId: string; paymentStatus: PaymentStatus; recordPayment?: OrderPayment; couponCode?: string },
) {
  const address = await tx.address.findFirst({ where: { id: args.addressId, customerId: args.customerId } });
  if (!address) throw new Error("ADDRESS");

  const { cart, priced, subtotal, discount, total, couponCode } = await pricedCart(tx, args.customerId, args.couponCode);
  const pricedByProductId = new Map(priced.map((line) => [line.productId, line]));

  const order = await tx.order.create({
    data: {
      number: `MC-${Date.now().toString().slice(-8)}`,
      customerId: args.customerId,
      subtotal,
      discountCode: couponCode,
      discountAmount: discount,
      total,
      paymentStatus: args.paymentStatus,
      ...(args.recordPayment ? { amountPaid: total } : {}),
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

  if (args.recordPayment) await tx.payment.create({ data: { orderId: order.id, amount: total, method: args.recordPayment.method, note: args.recordPayment.note } });
  if (couponCode) await tx.coupon.update({ where: { code: couponCode }, data: { usedCount: { increment: 1 } } });

  // A preorder line isn't drawn from physical stock on hand — decrementing
  // it would just push stockQuantity negative for every order taken, rather
  // than reflecting anything real about inventory.
  for (const item of cart.items) if (!item.product.isPreorder) await tx.product.update({ where: { id: item.productId }, data: { stockQuantity: { decrement: item.quantity } } });
  await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
  return order;
}

export function checkoutErrorResponse(caught: unknown): { message: string; status: number } {
  const code = caught instanceof Error ? caught.message : "";
  if (code === "STOCK") return { message: "One or more items are no longer in stock", status: 409 };
  if (code === "CART") return { message: "Your bag is empty", status: 400 };
  if (code === "ADDRESS") return { message: "Delivery address not found", status: 400 };
  const couponMessage = couponErrorMessage(code);
  if (couponMessage) return { message: couponMessage, status: 400 };
  return { message: "Could not place your order", status: 500 };
}
