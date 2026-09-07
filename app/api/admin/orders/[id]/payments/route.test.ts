import { expect, it, vi, beforeEach } from "vitest";
const { db } = vi.hoisted(() => {
  const db = {
    order: { findUnique: vi.fn(), update: vi.fn() },
    payment: { create: vi.fn().mockResolvedValue({ id: "pay1" }) },
    $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run(db)),
  };
  return { db };
});
vi.mock("@/lib/prisma", () => ({ prisma: db }));
import { NextRequest } from "next/server";
import { POST } from "./route";

function postWith(id: string, body: unknown) {
  return new NextRequest(`http://localhost/api/admin/orders/${id}/payments`, { method: "POST", headers: { "x-admin-key": "test-key" }, body: JSON.stringify(body) });
}
const params = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  process.env.ADMIN_API_KEY = "test-key";
  db.order.findUnique.mockReset();
  db.order.update.mockReset();
  db.payment.create.mockClear();
});

it("records a payment and moves a fully-covered order to PAID", async () => {
  db.order.findUnique.mockResolvedValue({ id: "o1", total: 100000, amountPaid: 50000 });
  db.order.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "o1", ...data }));
  const response = await POST(postWith("o1", { amount: 50000 }), params("o1"));
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.amountPaid).toBe(100000);
  expect(body.paymentStatus).toBe("PAID");
  expect(db.payment.create).toHaveBeenCalledWith({ data: { orderId: "o1", amount: 50000, method: undefined, note: undefined } });
});

it("leaves an order PARTIALLY_PAID when the balance remains", async () => {
  db.order.findUnique.mockResolvedValue({ id: "o2", total: 100000, amountPaid: 0 });
  db.order.update.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "o2", ...data }));
  const response = await POST(postWith("o2", { amount: 30000 }), params("o2"));
  const body = await response.json();
  expect(body.paymentStatus).toBe("PARTIALLY_PAID");
});

it("refuses a payment larger than what's still owed", async () => {
  db.order.findUnique.mockResolvedValue({ id: "o3", total: 100000, amountPaid: 90000 });
  const response = await POST(postWith("o3", { amount: 20000 }), params("o3"));
  expect(response.status).toBe(400);
});

it("404s for an order that doesn't exist", async () => {
  db.order.findUnique.mockResolvedValue(null);
  const response = await POST(postWith("missing", { amount: 100 }), params("missing"));
  expect(response.status).toBe(404);
});

it("refuses an unauthenticated request", async () => {
  const request = new NextRequest("http://localhost/api/admin/orders/o1/payments", { method: "POST", body: JSON.stringify({ amount: 100 }) });
  expect((await POST(request, params("o1"))).status).toBe(401);
});
