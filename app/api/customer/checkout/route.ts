import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { customerFromRequest } from "@/lib/auth";
import { error } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createOrderFromCart, pricedCart, checkoutErrorResponse } from "@/lib/createOrder";
import { sendOrderConfirmation } from "@/lib/email";

const input = z.object({ addressId: z.string(), couponCode: z.string().optional() });

export async function POST(request: NextRequest) {
  const session = await customerFromRequest(request);
  if (!session) return error("Sign in required", 401);
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) return error("Choose a delivery address", 400);

  const address = await prisma.address.findFirst({ where: { id: parsed.data.addressId, customerId: session.customerId } });
  if (!address) return error("Delivery address not found", 400);

  try {
    const order = await prisma.$transaction(async (tx) => {
      const { total } = await pricedCart(tx, session.customerId, parsed.data.couponCode);
      if (total !== 0) return error("This order has to be paid for — use the payment step", 400);

      return createOrderFromCart(tx, {
        customerId: session.customerId,
        addressId: parsed.data.addressId,
        paymentStatus: "PAID",
        couponCode: parsed.data.couponCode,
      });
    });
    if (order instanceof NextResponse) return order;

    await sendOrderConfirmation(order.id);
    return NextResponse.json(order, { status: 201 });
  } catch (caught) {
    const { message, status } = checkoutErrorResponse(caught);
    return error(message, status);
  }
}
