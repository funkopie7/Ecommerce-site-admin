import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { customerFromRequest } from "@/lib/auth";
import { error } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { createOrderFromCart, pricedCart, checkoutErrorResponse } from "@/lib/createOrder";
import { sendOrderConfirmation } from "@/lib/email";

/* Checkout for a cart that costs nothing.

   A 100%-off coupon leaves a total of zero, and there is no payment to take.
   Razorpay refuses anything under 100 paise, so /razorpay-order rejected it as
   "your bag total is too small to check out" — a customer holding a valid
   coupon was told their order was too small to place, with no way through.

   This route used to be the Cash-on-Delivery path, and it kept working after
   COD was taken out of the storefront: it accepted `paymentMethod: "COD"` and
   created a confirmed order marked SIMULATED_PAID without any payment at all.
   Nothing in the UI called it any more, but it was still deployed and still
   reachable, so any signed-in customer who sent it an address id got free
   merchandise. Repricing the cart here and refusing a payable total closes
   that, and the zero-total case is the one legitimate use it had left.

   The total is computed here from the customer's own cart — never accepted
   from the request — so a client cannot claim a cart is free. pricedCart is
   the same function the Razorpay route quotes with, including the same
   stock and bundle-repricing rules, so the two paths cannot disagree about
   what a cart costs. */

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
      /* The guard, and the whole reason this route still exists. Anything with
         a price has to go through Razorpay; this path can only ever complete a
         cart that genuinely costs nothing. Priced inside the transaction so
         the total that is checked is the total the order is built from. */
      if (total !== 0) return error("This order has to be paid for — use the payment step", 400);

      return createOrderFromCart(tx, {
        customerId: session.customerId,
        addressId: parsed.data.addressId,
        // Nothing was charged and nothing is owed. PAID rather than
        // SIMULATED_PAID: the balance really is settled, and an admin
        // scanning orders should not see a fully-discounted one flagged as
        // if it were a demo payment.
        paymentStatus: "PAID",
        couponCode: parsed.data.couponCode,
      });
    });
    // `error()` returns a NextResponse, so a rejected total arrives here as
    // the response itself rather than an order.
    if (order instanceof NextResponse) return order;

    /* After the transaction, never inside it: a slow mail API would hold a
       database transaction open, and a failed send must not roll back a real
       order. sendOrderConfirmation swallows its own errors and claims the
       order first, so this can't double-send or throw. */
    await sendOrderConfirmation(order.id);
    return NextResponse.json(order, { status: 201 });
  } catch (caught) {
    const { message, status } = checkoutErrorResponse(caught);
    return error(message, status);
  }
}
