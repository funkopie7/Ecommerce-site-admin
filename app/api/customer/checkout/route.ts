import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { customerFromRequest } from "@/lib/auth";
import { error } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { priceBundles, totalForItems, type BundleCartLine, type CollectionDef } from "@/lib/checkout";

const input = z.object({ addressId: z.string(), paymentMethod: z.enum(["COD", "DUMMY_CARD"]) });

export async function POST(request: NextRequest) {
  const session = await customerFromRequest(request);
  if (!session) return error("Sign in required", 401);
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) return error("Choose a delivery address and payment method", 400);

  try {
    const order = await prisma.$transaction(async (tx) => {
      const address = await tx.address.findFirst({ where: { id: parsed.data.addressId, customerId: session.customerId } });
      if (!address) throw new Error("ADDRESS");

      const cart = await tx.cart.findUnique({ where: { customerId: session.customerId }, include: { items: { include: { product: true } } } });
      if (!cart?.items.length) throw new Error("CART");
      for (const item of cart.items) if (!item.product.visible || item.product.stockQuantity < item.quantity) throw new Error("STOCK");

      // Reprice any bundle-tagged lines at their collection's price before the
      // subtotal is computed, so a customer who kept a whole bundle together
      // is actually charged the bundle price — see lib/checkout.priceBundles.
      const collectionIds = [...new Set(cart.items.map((item) => item.collectionId).filter((id): id is string => id !== null))];
      const collectionRows = collectionIds.length
        ? await tx.collection.findMany({ where: { id: { in: collectionIds } }, include: { items: true } })
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
      const pricedByProductId = new Map(priced.map((line) => [line.productId, line]));

      const subtotal = totalForItems(priced);
      const order = await tx.order.create({
        data: {
          number: `MC-${Date.now().toString().slice(-8)}`,
          customerId: session.customerId,
          subtotal,
          total: subtotal,
          paymentStatus: "SIMULATED_PAID",
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

      for (const item of cart.items) await tx.product.update({ where: { id: item.productId }, data: { stockQuantity: { decrement: item.quantity } } });
      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });
      return order;
    });
    return NextResponse.json(order, { status: 201 });
  } catch (caught) {
    const code = caught instanceof Error ? caught.message : "";
    return error(
      code === "STOCK" ? "One or more items are no longer in stock" : code === "CART" ? "Your bag is empty" : "Delivery address not found",
      code === "STOCK" ? 409 : 400,
    );
  }
}
