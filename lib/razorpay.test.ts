import crypto from "crypto";
import { afterEach, beforeEach, expect, it } from "vitest";
import { verifyRazorpaySignature } from "./razorpay";

beforeEach(() => {
  process.env.RAZORPAY_KEY_ID = "rzp_test_key";
  process.env.RAZORPAY_KEY_SECRET = "test_secret";
});
afterEach(() => {
  delete process.env.RAZORPAY_KEY_ID;
  delete process.env.RAZORPAY_KEY_SECRET;
});

const sign = (orderId: string, paymentId: string) => crypto.createHmac("sha256", "test_secret").update(`${orderId}|${paymentId}`).digest("hex");

it("accepts a correctly-signed order/payment pair", () => {
  const signature = sign("order_1", "pay_1");
  expect(verifyRazorpaySignature("order_1", "pay_1", signature)).toBe(true);
});

it("rejects a signature computed for a different order", () => {
  const signature = sign("order_1", "pay_1");
  expect(verifyRazorpaySignature("order_2", "pay_1", signature)).toBe(false);
});

it("rejects a forged/garbage signature without throwing", () => {
  expect(verifyRazorpaySignature("order_1", "pay_1", "not-a-real-signature")).toBe(false);
});

it("rejects an empty signature without throwing", () => {
  expect(verifyRazorpaySignature("order_1", "pay_1", "")).toBe(false);
});

it("throws when Razorpay isn't configured, rather than silently accepting anything", () => {
  delete process.env.RAZORPAY_KEY_SECRET;
  expect(() => verifyRazorpaySignature("order_1", "pay_1", sign("order_1", "pay_1"))).toThrow("RAZORPAY_NOT_CONFIGURED");
});
