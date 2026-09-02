import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { customerFromRequest } from "@/lib/auth";
import { error } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createOrderFromCart, checkoutErrorResponse } from "@/lib/createOrder";

// Card payment now goes through /api/customer/checkout/razorpay-order and
// /api/customer/checkout/razorpay-verify instead of the "DUMMY_CARD" demo
// path this used to accept — COD is the only method that confirms an order
// straight from this route.
const input = z.object({ addressId: z.string(), paymentMethod: z.enum(["COD"]), couponCode: z.string().optional() });

export async function POST(request: NextRequest) {
  const session = await customerFromRequest(request);
  if (!session) return error("Sign in required", 401);
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) return error("Choose a delivery address and payment method", 400);

  try {
    const order = await prisma.$transaction((tx) =>
      createOrderFromCart(tx, { customerId: session.customerId, addressId: parsed.data.addressId, paymentStatus: "SIMULATED_PAID", couponCode: parsed.data.couponCode }),
    );
    return NextResponse.json(order, { status: 201 });
  } catch (caught) {
    const { message, status } = checkoutErrorResponse(caught);
    return error(message, status);
  }
}
