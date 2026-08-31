// app/api/customer/checkout/razorpay-verify/route.test.ts
import { beforeEach, expect, it, vi } from "vitest";
const { fulfillPaymentIntent } = vi.hoisted(() => ({
  fulfillPaymentIntent: vi.fn().mockResolvedValue({ alreadyFulfilled: false, order: { id: "order1", number: "MC-1", total: 10000 } }),
}));
vi.mock("@/lib/paymentIntent", () => ({ fulfillPaymentIntent }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({})), order: { findUnique: vi.fn().mockResolvedValue({ id: "order1", number: "MC-1", total: 10000 }) } } }));
vi.mock("@/lib/auth", () => ({ customerFromRequest: vi.fn().mockResolvedValue({ customerId: "cust1", email: "a@b.com" }) }));
const { verifyRazorpaySignature } = vi.hoisted(() => ({ verifyRazorpaySignature: vi.fn().mockReturnValue(true) }));
vi.mock("@/lib/razorpay", () => ({ verifyRazorpaySignature }));
import { NextRequest } from "next/server";
import { customerFromRequest } from "@/lib/auth";
import { POST } from "./route";

const validBody = { razorpayOrderId: "order_r1", razorpayPaymentId: "pay_r1", razorpaySignature: "sig1" };
const post = (body: unknown) => POST(new NextRequest("http://localhost/api/customer/checkout/razorpay-verify", { method: "POST", body: JSON.stringify(body) }));

beforeEach(() => vi.clearAllMocks());

it("requires sign-in", async () => {
  vi.mocked(customerFromRequest).mockResolvedValueOnce(null);
  expect((await post(validBody)).status).toBe(401);
});

it("rejects a bad signature and never fulfils the intent", async () => {
  verifyRazorpaySignature.mockReturnValueOnce(false);
  const response = await post(validBody);
  expect(response.status).toBe(400);
  expect(fulfillPaymentIntent).not.toHaveBeenCalled();
});

it("checks the signature against the exact order/payment ids in the request", async () => {
  await post(validBody);
  expect(verifyRazorpaySignature).toHaveBeenCalledWith("order_r1", "pay_r1", "sig1");
});

it("fulfils the intent and returns the new order once the signature checks out", async () => {
  const response = await post(validBody);
  expect(response.status).toBe(201);
  expect(fulfillPaymentIntent).toHaveBeenCalledWith(expect.anything(), "order_r1", { method: "RAZORPAY", note: "order_r1/pay_r1" });
  expect(await response.json()).toMatchObject({ id: "order1", number: "MC-1" });
});

it("treats a webhook having already fulfilled the intent as success, not an error", async () => {
  fulfillPaymentIntent.mockResolvedValueOnce({ alreadyFulfilled: true, orderId: "order1" });
  const response = await post(validBody);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ id: "order1" });
});

it("rejects a payment for an intent that was never created here", async () => {
  fulfillPaymentIntent.mockRejectedValueOnce(new Error("INTENT_NOT_FOUND"));
  const response = await post(validBody);
  expect(response.status).toBe(400);
});

it("rejects a missing field", async () => {
  const response = await post({ razorpayOrderId: "order_r1" });
  expect(response.status).toBe(400);
});
