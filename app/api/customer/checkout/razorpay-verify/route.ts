import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { customerFromRequest } from "@/lib/auth";
import { error } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { fulfillPaymentIntent } from "@/lib/paymentIntent";
import { sendOrderConfirmation } from "@/lib/email";
import { verifyRazorpaySignature } from "@/lib/razorpay";

const input = z.object({
  razorpayOrderId: z.string(),
  razorpayPaymentId: z.string(),
  razorpaySignature: z.string(),
});

export async function POST(request: NextRequest) {
  const session = await customerFromRequest(request);
  if (!session) return error("Sign in required", 401);
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) return error("Missing payment details", 400);
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = parsed.data;

  let verified: boolean;
  try {
    verified = verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
  } catch {
    return error("Online payment isn't set up yet", 401);
  }
  if (!verified) return error("Payment verification failed", 400);

  try {
    const result = await prisma.$transaction((tx) =>
      fulfillPaymentIntent(tx, razorpayOrderId, { method: "RAZORPAY", note: `${razorpayOrderId}/${razorpayPaymentId}` }),
    );
    if (!result.alreadyFulfilled) {
      if (result.order?.id) await sendOrderConfirmation(result.order.id);
      return NextResponse.json(result.order, { status: 201 });
    }
    const order = result.orderId ? await prisma.order.findUnique({ where: { id: result.orderId } }) : null;
    return order ? NextResponse.json(order, { status: 200 }) : NextResponse.json({ ok: true }, { status: 202 });
  } catch (caught) {
    const code = caught instanceof Error ? caught.message : "";
    if (code === "INTENT_NOT_FOUND") return error("This payment wasn't started from here", 400);
    if (code === "STOCK") return error("One or more items are no longer in stock", 409);
    if (code === "CART" || code === "ADDRESS") return error("Payment succeeded but the order couldn't be completed — contact support with your payment ID", 500);
    return error("Could not confirm your order", 500);
  }
}
