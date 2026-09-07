import type { Prisma } from "@prisma/client";
import { createOrderFromCart, type OrderPayment } from "@/lib/createOrder";

export type FulfillResult =
  | { alreadyFulfilled: true; orderId: string | null }
  | { alreadyFulfilled: false; order: Awaited<ReturnType<typeof createOrderFromCart>> };

export async function fulfillPaymentIntent(tx: Prisma.TransactionClient, razorpayOrderId: string, payment: OrderPayment): Promise<FulfillResult> {
  const intent = await tx.paymentIntent.findUnique({ where: { razorpayOrderId } });
  if (!intent) throw new Error("INTENT_NOT_FOUND");

  if (intent.status === "FULFILLED") return { alreadyFulfilled: true, orderId: intent.orderId };

  const claim = await tx.paymentIntent.updateMany({ where: { razorpayOrderId, status: "CREATED" }, data: { status: "FULFILLED" } });
  if (claim.count === 0) {
    const fresh = await tx.paymentIntent.findUnique({ where: { razorpayOrderId } });
    return { alreadyFulfilled: true, orderId: fresh?.orderId ?? null };
  }

  const order = await createOrderFromCart(tx, { customerId: intent.customerId, addressId: intent.addressId, paymentStatus: "PAID", recordPayment: payment, couponCode: intent.discountCode ?? undefined });
  await tx.paymentIntent.update({ where: { razorpayOrderId }, data: { orderId: order.id } });
  return { alreadyFulfilled: false, order };
}
