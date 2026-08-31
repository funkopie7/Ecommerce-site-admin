import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { customerFromRequest } from "@/lib/auth";
import { error } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { pricedCart, checkoutErrorResponse } from "@/lib/createOrder";
import { createRazorpayOrder } from "@/lib/razorpay";

const input = z.object({ addressId: z.string() });

/** Step 1 of the Razorpay flow: quotes the customer's own cart (never a
 * client-supplied amount) and opens a Razorpay order against it. Doesn't
 * touch our Order table yet — that only happens once the payment is made,
 * via whichever of /razorpay-verify or the payment.captured webhook claims
 * the PaymentIntent created here first (see lib/paymentIntent.ts). */
export async function POST(request: NextRequest) {
  const session = await customerFromRequest(request);
  if (!session) return error("Sign in required", 401);
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) return error("Choose a delivery address", 400);

  const address = await prisma.address.findFirst({ where: { id: parsed.data.addressId, customerId: session.customerId } });
  if (!address) return error("Delivery address not found", 400);

  let subtotal: number;
  try {
    ({ subtotal } = await pricedCart(prisma, session.customerId));
  } catch (caught) {
    const { message, status } = checkoutErrorResponse(caught);
    return error(message, status);
  }
  // Razorpay rejects orders under 100 paise (₹1).
  if (subtotal < 100) return error("Your bag total is too small to check out", 400);

  try {
    const razorpayOrder = await createRazorpayOrder(subtotal, "INR", `cart_${session.customerId}_${Date.now()}`);
    await prisma.paymentIntent.create({
      data: { razorpayOrderId: razorpayOrder.id, customerId: session.customerId, addressId: parsed.data.addressId, amount: subtotal },
    });
    return NextResponse.json({ razorpayOrderId: razorpayOrder.id, amount: razorpayOrder.amount, currency: razorpayOrder.currency });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "";
    if (message === "RAZORPAY_NOT_CONFIGURED") return error("Online payment isn't set up yet", 401);
    return error("Could not start the payment — try again", 500);
  }
}
