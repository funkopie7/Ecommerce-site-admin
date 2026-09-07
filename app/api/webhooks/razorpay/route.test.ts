import crypto from "crypto";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const { fulfillPaymentIntent } = vi.hoisted(() => ({
  fulfillPaymentIntent: vi.fn().mockResolvedValue({ alreadyFulfilled: false, order: { id: "order1" } }),
}));
vi.mock("@/lib/paymentIntent", () => ({ fulfillPaymentIntent }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn({})) } }));
import { NextRequest } from "next/server";
import { POST } from "./route";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.RAZORPAY_WEBHOOK_SECRET = "whsec_test";
});
afterEach(() => delete process.env.RAZORPAY_WEBHOOK_SECRET);

const sign = (body: string) => crypto.createHmac("sha256", "whsec_test").update(body).digest("hex");

function post(bodyObj: unknown, { badSignature = false, noSignature = false } = {}) {
  const body = JSON.stringify(bodyObj);
  const headers: Record<string, string> = {};
  if (!noSignature) headers["x-razorpay-signature"] = badSignature ? "0".repeat(64) : sign(body);
  return POST(new NextRequest("http://localhost/api/webhooks/razorpay", { method: "POST", body, headers }));
}

const capturedEvent = { event: "payment.captured", payload: { payment: { entity: { id: "pay_r1", order_id: "order_r1" } } } };

it("rejects a request with no signature header", async () => {
  const response = await post(capturedEvent, { noSignature: true });
  expect(response.status).toBe(400);
  expect(fulfillPaymentIntent).not.toHaveBeenCalled();
});

it("rejects a forged signature without touching the database", async () => {
  const response = await post(capturedEvent, { badSignature: true });
  expect(response.status).toBe(400);
  expect(fulfillPaymentIntent).not.toHaveBeenCalled();
});

it("acknowledges and ignores event types it doesn't act on, e.g. from subscribing to 'all events'", async () => {
  const response = await post({ event: "payment.dispute.created", payload: {} });
  expect(response.status).toBe(200);
  expect(fulfillPaymentIntent).not.toHaveBeenCalled();
});

it("fulfils the payment intent for a genuine payment.captured event", async () => {
  const response = await post(capturedEvent);
  expect(response.status).toBe(200);
  expect(fulfillPaymentIntent).toHaveBeenCalledWith(expect.anything(), "order_r1", { method: "RAZORPAY_WEBHOOK", note: "order_r1/pay_r1" });
  expect(await response.json()).toMatchObject({ ok: true, orderId: "order1" });
});

it("is a no-op, not an error, when the client's own verify call already fulfilled it", async () => {
  fulfillPaymentIntent.mockResolvedValueOnce({ alreadyFulfilled: true, orderId: "order1" });
  const response = await post(capturedEvent);
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ ok: true, alreadyFulfilled: true });
});

it("rejects a malformed payload missing the payment ids", async () => {
  const response = await post({ event: "payment.captured", payload: {} });
  expect(response.status).toBe(400);
});

it("acknowledges (200) rather than causing Razorpay to keep retrying when the intent is unknown", async () => {
  fulfillPaymentIntent.mockRejectedValueOnce(new Error("INTENT_NOT_FOUND"));
  const response = await post(capturedEvent);
  expect(response.status).toBe(200);
});
