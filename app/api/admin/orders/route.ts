import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { error, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { sendOrderConfirmation } from "@/lib/email";

const update = z.object({ orderId: z.string(), status: z.enum(["PENDING", "CONFIRMED", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED"]), carrier: z.string().optional(), trackingCode: z.string().optional(), deliveryNotes: z.string().optional() }).refine((value) => value.status !== "SHIPPED" || Boolean(value.trackingCode), "Tracking code is required when shipping an order");

const manualOrderInput = z
  .object({
    customerId: z.string().optional(),
    customerName: z.string().min(2).optional(),
    customerPhone: z.string().min(6).optional(),
    /* Optional, and emptiable: the dialog sends "" when the field is left
       blank, which .or(z.literal("")) accepts and the handler turns into null
       rather than storing an empty string that later reads as an address. */
    customerEmail: z.string().email("Enter a valid email address, or leave it blank").optional().or(z.literal("")),
    items: z.array(z.object({ productId: z.string(), quantity: z.number().int().positive(), unitPrice: z.number().int().nonnegative().optional() })).min(1),
    amountPaid: z.number().int().nonnegative().default(0),
    status: z.enum(["PENDING", "CONFIRMED", "PACKED", "SHIPPED", "DELIVERED", "CANCELLED"]).default("CONFIRMED"),
    deliveryNotes: z.string().optional(),
  })
  .refine((value) => Boolean(value.customerId) || (Boolean(value.customerName) && Boolean(value.customerPhone)), "Pick an existing customer or enter a name and phone for a walk-in sale");

const paymentStatusFor = (amountPaid: number, total: number) => (amountPaid <= 0 ? "PENDING" : amountPaid >= total ? "PAID" : "PARTIALLY_PAID");

export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  return NextResponse.json(
    await prisma.order.findMany({ include: { customer: { select: { name: true, email: true } }, items: true, payments: { orderBy: { recordedAt: "desc" } } }, orderBy: { createdAt: "desc" } }),
  );
}

export async function PATCH(request: NextRequest) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  const parsed = update.safeParse(await request.json());
  if (!parsed.success) return error(parsed.error.issues[0].message, 400);
  const { orderId, ...data } = parsed.data;
  const current = await prisma.order.findUnique({ where: { id: orderId } });
  if (!current) return error("Order not found", 404);
  const order = await prisma.$transaction(async (tx) => {
    if (data.status === "CANCELLED" && current.status !== "CANCELLED")
      for (const item of await tx.orderItem.findMany({ where: { orderId } })) await tx.product.update({ where: { id: item.productId }, data: { stockQuantity: { increment: item.quantity } } });
    return tx.order.update({ where: { id: orderId }, data });
  });
  return NextResponse.json(order);
}

/**
 * Manual/offline sale entry: the admin conducts some sales in person and
 * needs a real order on record for them, tied to an existing account or a
 * walk-in's name and phone. Mirrors the storefront checkout's stock check
 * and decrement, but skips the cart entirely — line items come straight
 * from the request.
 */
export async function POST(request: NextRequest) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  const parsed = manualOrderInput.safeParse(await request.json());
  if (!parsed.success) return error(parsed.error.issues[0].message, 400);
  const { customerId, customerName, customerPhone, customerEmail, items, amountPaid, status, deliveryNotes } = parsed.data;

  try {
    const order = await prisma.$transaction(async (tx) => {
      if (customerId) {
        const customer = await tx.customer.findUnique({ where: { id: customerId } });
        if (!customer) throw new Error("CUSTOMER_NOT_FOUND");
      }

      const products = await tx.product.findMany({ where: { id: { in: items.map((item) => item.productId) } } });
      const productById = new Map(products.map((product) => [product.id, product]));
      for (const item of items) {
        const product = productById.get(item.productId);
        if (!product) throw new Error("PRODUCT_NOT_FOUND");
        if (product.stockQuantity < item.quantity) throw new Error(`STOCK:${product.name}`);
      }

      const orderItems = items.map((item) => {
        const product = productById.get(item.productId)!;
        const unitPrice = item.unitPrice ?? product.price;
        return { productId: product.id, name: product.name, sku: product.sku, unitPrice, quantity: item.quantity };
      });
      const subtotal = orderItems.reduce((total, item) => total + item.unitPrice * item.quantity, 0);
      if (amountPaid > subtotal) throw new Error("OVERPAID");

      const created = await tx.order.create({
        data: {
          number: `MO-${Date.now().toString().slice(-8)}`,
          ...(customerId ? { customerId } : { customerName, customerPhone, customerEmail: customerEmail || null }),
          status,
          paymentStatus: paymentStatusFor(amountPaid, subtotal),
          subtotal,
          total: subtotal,
          amountPaid,
          deliveryNotes,
          items: { create: orderItems },
          ...(amountPaid > 0 ? { payments: { create: { amount: amountPaid, method: "Recorded at sale" } } } : {}),
        },
        include: { customer: { select: { name: true, email: true } }, items: true, payments: true },
      });

      for (const item of items) await tx.product.update({ where: { id: item.productId }, data: { stockQuantity: { decrement: item.quantity } } });
      return created;
    });

    /* Outside the transaction, and best-effort: a counter sale is already
       done and paid by the time this runs, so a mail failure must not turn
       into a failed order. sendOrderConfirmation is a no-op when the order
       carries no email at all, which is the normal case for a walk-in who
       didn't give one. */
    await sendOrderConfirmation(order.id);
    return NextResponse.json(order, { status: 201 });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "";
    if (message === "CUSTOMER_NOT_FOUND") return error("That customer no longer exists", 404);
    if (message === "PRODUCT_NOT_FOUND") return error("One of those products no longer exists", 404);
    if (message.startsWith("STOCK:")) return error(`Not enough stock for ${message.slice(6)}`, 409);
    if (message === "OVERPAID") return error("Amount paid can't be more than the order total", 400);
    return error("Could not create that order", 500);
  }
}
