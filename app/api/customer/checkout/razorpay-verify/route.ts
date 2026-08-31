import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { customerFromRequest } from "@/lib/auth";
import { error } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createOrderFromCart, checkoutErrorResponse } from "@/lib/createOrder";
import { verifyRazorpaySignature } from "@/lib/razorpay";

const input = z.object({
  addressId: z.string(),
  razorpayOrderId: z.string(),
  razorpayPaymentId: z.string(),
  razorpaySignature: z.string(),
});

/** Step 2 of the Razorpay flow: verifies the signature Razorpay's checkout
 * modal handed back, and only then creates the real Order — a forged or
 * missing signature never reaches the database as a paid order. */
export async function POST(request: NextRequest) {
  const session = await customerFromRequest(request);
  if (!session) return error("Sign in required", 401);
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) return error("Missing payment details", 400);
  const { addressId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = parsed.data;

  let verified: boolean;
  try {
    verified = verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
  } catch {
    return error("Online payment isn't set up yet", 401);
  }
  if (!verified) return error("Payment verification failed", 400);

  try {
    const order = await prisma.$transaction((tx) =>
      createOrderFromCart(tx, {
        customerId: session.customerId,
        addressId,
        paymentStatus: "PAID",
        recordPayment: { method: "RAZORPAY", note: `${razorpayOrderId}/${razorpayPaymentId}` },
      }),
    );
    return NextResponse.json(order, { status: 201 });
  } catch (caught) {
    const { message, status } = checkoutErrorResponse(caught);
    return error(message, status);
  }
}
