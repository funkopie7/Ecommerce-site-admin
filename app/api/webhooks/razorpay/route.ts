import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyRazorpayWebhookSignature } from "@/lib/razorpay";
import { fulfillPaymentIntent } from "@/lib/paymentIntent";
import { sendOrderConfirmation } from "@/lib/email";

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-razorpay-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let verified: boolean;
  try {
    verified = verifyRazorpayWebhookSignature(rawBody, signature);
  } catch {
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
    await sendOrderConfirmation(result.order.id);
    return NextResponse.json({ ok: true, orderId: result.order.id });
  } catch (caught) {
    const code = caught instanceof Error ? caught.message : "";
    console.error("razorpay webhook: could not fulfil payment intent", razorpayOrderId, code);
    return NextResponse.json({ ok: true, error: code || "unhandled" });
  }
}
