import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyRazorpayWebhookSignature } from "@/lib/razorpay";
import { fulfillPaymentIntent } from "@/lib/paymentIntent";
import { sendOrderConfirmation } from "@/lib/email";

/** Durable backup to the client-side /razorpay-verify flow: if a customer's
 * payment succeeds but their browser closes/crashes before the checkout
 * page's own verify call completes, this is what still turns it into a
 * real order. Subscribe to whatever events you like in the Razorpay
 * dashboard (payment.failed, disputes, etc.) — only payment.captured is
 * acted on here; everything else is acknowledged and ignored, so
 * over-subscribing never breaks anything. */
export async function POST(request: NextRequest) {
  // Signing is over the *raw* body — reading it as text first (not
  // request.json()) is required for the HMAC to match what Razorpay sent.
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let verified: boolean;
  try {
    verified = verifyRazorpayWebhookSignature(rawBody, signature);
  } catch {
    // Not configured — 500 rather than 400, so Razorpay's dashboard shows
    // this as a delivery failure worth investigating, not "bad request".
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }
  if (!verified) return NextResponse.json({ error: "Invalid signature" }, { status: 400 });

  const event = JSON.parse(rawBody);
  if (event.event !== "payment.captured") return NextResponse.json({ ok: true, ignored: event.event });

  const payment = event.payload?.payment?.entity;
  const razorpayOrderId: string | undefined = payment?.order_id;
  const razorpayPaymentId: string | undefined = payment?.id;
  if (!razorpayOrderId || !razorpayPaymentId) return NextResponse.json({ error: "Malformed payload" }, { status: 400 });

  try {
    const result = await prisma.$transaction((tx) =>
      fulfillPaymentIntent(tx, razorpayOrderId, { method: "RAZORPAY_WEBHOOK", note: `${razorpayOrderId}/${razorpayPaymentId}` }),
    );
    if (result.alreadyFulfilled) return NextResponse.json({ ok: true, alreadyFulfilled: true });
    /* The whole point of this route: if the customer's browser died before
       /razorpay-verify ran, this is the only path that will ever email them.
       Outside the transaction, and safe to call even when verify is racing
       us — the claim inside decides which one actually sends. */
    await sendOrderConfirmation(result.order.id);
    return NextResponse.json({ ok: true, orderId: result.order.id });
  } catch (caught) {
    const code = caught instanceof Error ? caught.message : "";
    // A stale/unknown order id, or the cart/address it referenced no longer
    // being valid, isn't something retrying will fix — 200 so Razorpay
    // stops redelivering, but the error is still visible in server logs.
    console.error("razorpay webhook: could not fulfil payment intent", razorpayOrderId, code);
    return NextResponse.json({ ok: true, error: code || "unhandled" });
  }
}
