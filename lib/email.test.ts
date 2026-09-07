import { afterEach, beforeEach, expect, it, vi } from "vitest";
const { updateMany, findUnique } = vi.hoisted(() => ({ updateMany: vi.fn(), findUnique: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { order: { updateMany, findUnique } } }));
import { sendOrderConfirmation } from "./email";

const order = {
  id: "order1",
  number: "MC-1042",
  subtotal: 249900,
  shipping: 0,
  discountCode: null,
  discountAmount: 0,
  total: 249900,
  customer: { email: "buyer@example.com" },
  addressSnapshot: { recipient: "A Buyer", line1: "12 Marine Drive", city: "Mumbai", state: "MH", postalCode: "400020" },
  items: [{ quantity: 1, unitPrice: 249900, product: { name: "Joker" }, collection: null }],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("RESEND_API_KEY", "test-key");
  updateMany.mockResolvedValue({ count: 1 });
  findUnique.mockResolvedValue(order);
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => "" }));
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => vi.unstubAllEnvs());

it("sends once and stamps the order as claimed", async () => {
  expect(await sendOrderConfirmation("order1")).toBe(true);
  expect(updateMany).toHaveBeenCalledTimes(1);
  expect(updateMany).toHaveBeenCalledWith({
    where: { id: "order1", confirmationSentAt: null },
    data: { confirmationSentAt: expect.any(Date) },
  });
  const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
  expect(body).toMatchObject({ to: ["buyer@example.com"], reply_to: "funkopie7@gmail.com", subject: "Order MC-1042 confirmed" });
  expect(body.from).toContain("orders@funkopie.in");
  expect(body.text).toContain("₹2,499.00");
  expect(body.text).toContain("12 Marine Drive");
});

it("does not send when another path already claimed the order", async () => {
  updateMany.mockResolvedValue({ count: 0 });
  expect(await sendOrderConfirmation("order1")).toBe(false);
  expect(fetch).not.toHaveBeenCalled();
});

it("releases the claim when the send fails, so it can be retried", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 422, text: async () => "domain not verified" }));
  expect(await sendOrderConfirmation("order1")).toBe(false);
  expect(updateMany).toHaveBeenLastCalledWith({ where: { id: "order1" }, data: { confirmationSentAt: null } });
});

it("never throws into the order flow when the database itself is unreachable", async () => {
  updateMany.mockRejectedValue(new Error("connection refused"));
  expect(await sendOrderConfirmation("order1")).toBe(false);
  expect(updateMany).toHaveBeenCalledTimes(1);
});

it("skips quietly when no API key is configured, rather than failing the order", async () => {
  vi.stubEnv("RESEND_API_KEY", "");
  expect(await sendOrderConfirmation("order1")).toBe(false);
  expect(fetch).not.toHaveBeenCalled();
  expect(updateMany).toHaveBeenLastCalledWith({ where: { id: "order1" }, data: { confirmationSentAt: null } });
});

it("escapes customer-controlled text instead of interpolating it raw", async () => {
  findUnique.mockResolvedValue({ ...order, items: [{ ...order.items[0], product: { name: `<script>alert("x")</script>` } }] });
  await sendOrderConfirmation("order1");
  const body = JSON.parse((fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body);
  expect(body.html).not.toContain("<script>");
  expect(body.html).toContain("&lt;script&gt;");
});
