import type { Prisma } from "@prisma/client";
import { createOrderFromCart, type OrderPayment } from "@/lib/createOrder";

export type FulfillResult =
  | { alreadyFulfilled: true; orderId: string | null }
  | { alreadyFulfilled: false; order: Awaited<ReturnType<typeof createOrderFromCart>> };

/** Claims a PaymentIntent (CREATED -> FULFILLED, atomically via a
 * where-status guard on updateMany — a concurrent claim on the same row
 * loses the DB's row lock and gets count: 0) and, only if this call won the
 * race, creates the real Order from it. Whichever of /razorpay-verify or
 * the payment.captured webhook gets here first does the real work; the
 * other gets `alreadyFulfilled: true` back and treats that as success
 * rather than creating a second order. Throws "INTENT_NOT_FOUND". */
export async function fulfillPaymentIntent(tx: Prisma.TransactionClient, razorpayOrderId: string, payment: OrderPayment): Promise<FulfillResult> {
  const intent = await tx.paymentIntent.findUnique({ where: { razorpayOrderId } });
  if (!intent) throw new Error("INTENT_NOT_FOUND");

  if (intent.status === "FULFILLED") return { alreadyFulfilled: true, orderId: intent.orderId };

  const claim = await tx.paymentIntent.updateMany({ where: { razorpayOrderId, status: "CREATED" }, data: { status: "FULFILLED" } });
  if (claim.count === 0) {
    // Lost the race — someone else's transaction already flipped it.
    const fresh = await tx.paymentIntent.findUnique({ where: { razorpayOrderId } });
    return { alreadyFulfilled: true, orderId: fresh?.orderId ?? null };
  }

  const order = await createOrderFromCart(tx, { customerId: intent.customerId, addressId: intent.addressId, paymentStatus: "PAID", recordPayment: payment });
  await tx.paymentIntent.update({ where: { razorpayOrderId }, data: { orderId: order.id } });
  return { alreadyFulfilled: false, order };
}
