// app/api/customer/checkout/razorpay-verify/route.test.ts
import { expect, it, vi } from "vitest";
const { tx } = vi.hoisted(() => ({
  tx: {
    address: { findFirst: vi.fn().mockResolvedValue({ id: "addr1", customerId: "cust1" }) },
    cart: { findUnique: vi.fn().mockResolvedValue({ id: "cart1", items: [{ productId: "p1", collectionId: null, quantity: 2, product: { id: "p1", price: 5000, visible: true, stockQuantity: 10, sku: "SKU1", name: "Thing" } }] }) },
    collection: { findMany: vi.fn().mockResolvedValue([]) },
    order: { create: vi.fn().mockResolvedValue({ id: "order1", number: "MC-1", total: 10000 }) },
    payment: { create: vi.fn().mockResolvedValue({ id: "pay1" }) },
    product: { update: vi.fn().mockResolvedValue({}) },
    cartItem: { deleteMany: vi.fn().mockResolvedValue({}) },
  },
}));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(tx)) } }));
vi.mock("@/lib/auth", () => ({ customerFromRequest: vi.fn().mockResolvedValue({ customerId: "cust1", email: "a@b.com" }) }));
const { verifyRazorpaySignature } = vi.hoisted(() => ({ verifyRazorpaySignature: vi.fn().mockReturnValue(true) }));
vi.mock("@/lib/razorpay", () => ({ verifyRazorpaySignature }));
import { NextRequest } from "next/server";
import { customerFromRequest } from "@/lib/auth";
import { POST } from "./route";

const validBody = { addressId: "addr1", razorpayOrderId: "order_r1", razorpayPaymentId: "pay_r1", razorpaySignature: "sig1" };
const post = (body: unknown) => POST(new NextRequest("http://localhost/api/customer/checkout/razorpay-verify", { method: "POST", body: JSON.stringify(body) }));

it("requires sign-in", async () => {
  vi.mocked(customerFromRequest).mockResolvedValueOnce(null);
  expect((await post(validBody)).status).toBe(401);
});

it("rejects a bad signature and never creates an order", async () => {
  verifyRazorpaySignature.mockReturnValueOnce(false);
  const response = await post(validBody);
  expect(response.status).toBe(400);
  expect(tx.order.create).not.toHaveBeenCalled();
});

it("checks the signature against the exact order/payment ids in the request, not the address", async () => {
  await post(validBody);
  expect(verifyRazorpaySignature).toHaveBeenCalledWith("order_r1", "pay_r1", "sig1");
});

it("creates a fully-paid order and a Payment record once the signature checks out", async () => {
  const response = await post(validBody);
  expect(response.status).toBe(201);
  expect(tx.order.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ paymentStatus: "PAID", amountPaid: 10000 }) }));
  expect(tx.payment.create).toHaveBeenCalledWith({ data: { orderId: "order1", amount: 10000, method: "RAZORPAY", note: "order_r1/pay_r1" } });
});

it("rejects a missing field", async () => {
  const response = await post({ addressId: "addr1" });
  expect(response.status).toBe(400);
});
