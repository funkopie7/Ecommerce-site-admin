import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { customerFromRequest } from "@/lib/auth";
import { error } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { pricedCart, checkoutErrorResponse } from "@/lib/createOrder";

const input = z.object({ couponCode: z.string().min(1) });

/** Live preview for the checkout page's "Apply" button — prices the cart
 * with the code and reports the discount, without touching PaymentIntent or
 * Order at all. The real charge/order still reprices from scratch (see
 * razorpay-order and the COD route), so this is purely a UI convenience,
 * never the source of truth for what gets charged. */
export async function POST(request: NextRequest) {
  const session = await customerFromRequest(request);
  if (!session) return error("Sign in required", 401);
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) return error("Enter a coupon code", 400);

  try {
    const { subtotal, discount, total, couponCode } = await pricedCart(prisma, session.customerId, parsed.data.couponCode);
    return NextResponse.json({ couponCode, subtotal, discount, total });
  } catch (caught) {
    const { message, status } = checkoutErrorResponse(caught);
    return error(message, status);
  }
}
