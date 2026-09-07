import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { customerFromRequest } from "@/lib/auth";
import { error } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { pricedCart, checkoutErrorResponse } from "@/lib/createOrder";
import { createRazorpayOrder, RazorpayApiError } from "@/lib/razorpay";

const input = z.object({ addressId: z.string(), couponCode: z.string().optional() });

export async function POST(request: NextRequest) {
  const session = await customerFromRequest(request);
  if (!session) return error("Sign in required", 401);
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) return error("Choose a delivery address", 400);

  const address = await prisma.address.findFirst({ where: { id: parsed.data.addressId, customerId: session.customerId } });
  if (!address) return error("Delivery address not found", 400);

  let total: number, discount: number, couponCode: string | null;
  try {
    ({ total, discount, couponCode } = await pricedCart(prisma, session.customerId, parsed.data.couponCode));
  } catch (caught) {
    const { message, status } = checkoutErrorResponse(caught);
    return error(message, status);
  }
  if (total < 100) return error("Your bag total is too small to check out", 400);

  try {
    const razorpayOrder = await createRazorpayOrder(total, "INR", `cart_${session.customerId}_${Date.now()}`);
    await prisma.paymentIntent.create({
      data: { razorpayOrderId: razorpayOrder.id, customerId: session.customerId, addressId: parsed.data.addressId, amount: total, discountCode: couponCode, discountAmount: discount },
    });
    return NextResponse.json({ razorpayOrderId: razorpayOrder.id, amount: razorpayOrder.amount, currency: razorpayOrder.currency });
  } catch (caught) {
    if (caught instanceof RazorpayApiError) return error(`Could not start the payment: ${caught.description}`, 502);
    const message = caught instanceof Error ? caught.message : "";
    if (message === "RAZORPAY_NOT_CONFIGURED") return error("Online payment isn't set up yet", 401);
    return error("Could not start the payment — try again", 500);
  }
}
