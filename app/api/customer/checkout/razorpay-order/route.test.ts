import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({
  prisma: {
    address: { findFirst: vi.fn().mockResolvedValue({ id: "addr1", customerId: "cust1" }) },
    cart: { findUnique: vi.fn().mockResolvedValue({ id: "cart1", items: [{ productId: "p1", collectionId: null, quantity: 2, product: { price: 5000, visible: true, stockQuantity: 10 } }] }) },
    collection: { findMany: vi.fn().mockResolvedValue([]) },
    paymentIntent: { create: vi.fn().mockResolvedValue({ id: "pi1" }) },
  },
}));
vi.mock("@/lib/auth", () => ({ customerFromRequest: vi.fn().mockResolvedValue({ customerId: "cust1", email: "a@b.com" }) }));
const { createRazorpayOrder } = vi.hoisted(() => ({ createRazorpayOrder: vi.fn().mockResolvedValue({ id: "order_razorpay1", amount: 10000, currency: "INR", receipt: "r1" }) }));
vi.mock("@/lib/razorpay", () => ({ createRazorpayOrder }));
import { NextRequest } from "next/server";
import { customerFromRequest } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { POST } from "./route";

const post = (body: unknown) => POST(new NextRequest("http://localhost/api/customer/checkout/razorpay-order", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => vi.clearAllMocks());

it("requires sign-in", async () => {
  vi.mocked(customerFromRequest).mockResolvedValueOnce(null);
  const response = await post({ addressId: "addr1" });
  expect(response.status).toBe(401);
});

it("quotes the server-computed cart total to Razorpay, in paise, not a client-supplied amount", async () => {
  const response = await post({ addressId: "addr1", amount: 1 }); // a forged/wrong amount, if it were ever read, would be 1
  expect(response.status).toBe(200);
  expect(createRazorpayOrder).toHaveBeenCalledWith(10000, "INR", expect.any(String)); // 5000 * 2, not 1
  expect(await response.json()).toMatchObject({ razorpayOrderId: "order_razorpay1", amount: 10000, currency: "INR" });
});

it("rejects an address that doesn't belong to the customer", async () => {
  vi.mocked(prisma.address.findFirst).mockResolvedValueOnce(null);
  const response = await post({ addressId: "someone-elses" });
  expect(response.status).toBe(400);
});

it("rejects an empty cart before calling Razorpay", async () => {
  vi.mocked(prisma.cart.findUnique).mockResolvedValueOnce({ id: "cart1", items: [] } as never);
  const response = await post({ addressId: "addr1" });
  expect(response.status).toBe(400);
  expect(createRazorpayOrder).not.toHaveBeenCalled();
});

it("records a PaymentIntent against the Razorpay order id, so /razorpay-verify and the webhook have something to claim", async () => {
  await post({ addressId: "addr1" });
  expect(prisma.paymentIntent.create).toHaveBeenCalledWith({
    data: { razorpayOrderId: "order_razorpay1", customerId: "cust1", addressId: "addr1", amount: 10000, discountCode: null, discountAmount: 0 },
  });
});
