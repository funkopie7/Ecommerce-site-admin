import { beforeEach, expect, it, vi } from "vitest";
const { createOrderFromCart } = vi.hoisted(() => ({ createOrderFromCart: vi.fn().mockResolvedValue({ id: "order1", number: "MC-1", total: 10000 }) }));
vi.mock("@/lib/createOrder", async (importOriginal) => ({ ...(await importOriginal<object>()), createOrderFromCart }));
import { fulfillPaymentIntent } from "./paymentIntent";

function makeTx(intent: { status: string; orderId: string | null } | null, claimedCount = 1) {
  return {
    paymentIntent: {
      findUnique: vi.fn().mockResolvedValue(intent ? { customerId: "cust1", addressId: "addr1", ...intent } : null),
      updateMany: vi.fn().mockResolvedValue({ count: claimedCount }),
      update: vi.fn().mockResolvedValue({}),
    },
  };
}

beforeEach(() => vi.clearAllMocks());

it("throws when there's no PaymentIntent for this Razorpay order id", async () => {
  await expect(fulfillPaymentIntent(makeTx(null) as never, "order_x", { method: "RAZORPAY" })).rejects.toThrow("INTENT_NOT_FOUND");
});

it("creates the order and marks the intent fulfilled on a normal claim", async () => {
  const tx = makeTx({ status: "CREATED", orderId: null });
  const result = await fulfillPaymentIntent(tx as never, "order_x", { method: "RAZORPAY", note: "n" });
  expect(result).toMatchObject({ alreadyFulfilled: false, order: { id: "order1" } });
  expect(createOrderFromCart).toHaveBeenCalledWith(tx, { customerId: "cust1", addressId: "addr1", paymentStatus: "PAID", recordPayment: { method: "RAZORPAY", note: "n" } });
  expect(tx.paymentIntent.update).toHaveBeenCalledWith({ where: { razorpayOrderId: "order_x" }, data: { orderId: "order1" } });
});

it("short-circuits without creating a second order when already FULFILLED", async () => {
  const tx = makeTx({ status: "FULFILLED", orderId: "order1" });
  const result = await fulfillPaymentIntent(tx as never, "order_x", { method: "RAZORPAY" });
  expect(result).toEqual({ alreadyFulfilled: true, orderId: "order1" });
  expect(createOrderFromCart).not.toHaveBeenCalled();
});

it("treats losing the atomic claim race the same as already-fulfilled, not an error", async () => {
  const tx = makeTx({ status: "CREATED", orderId: null }, 0);
  tx.paymentIntent.findUnique
    .mockResolvedValueOnce({ customerId: "cust1", addressId: "addr1", status: "CREATED", orderId: null })
    .mockResolvedValueOnce({ customerId: "cust1", addressId: "addr1", status: "FULFILLED", orderId: "order-from-winner" });
  const result = await fulfillPaymentIntent(tx as never, "order_x", { method: "RAZORPAY" });
  expect(result).toEqual({ alreadyFulfilled: true, orderId: "order-from-winner" });
  expect(createOrderFromCart).not.toHaveBeenCalled();
});
