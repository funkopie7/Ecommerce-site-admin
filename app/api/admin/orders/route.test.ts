// app/api/admin/orders/route.test.ts
import { expect, it, vi, beforeEach } from "vitest";
const { db } = vi.hoisted(() => {
  const db = {
    order: { findMany: vi.fn().mockResolvedValue([]), findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    orderItem: { findMany: vi.fn().mockResolvedValue([]) },
    customer: { findUnique: vi.fn() },
    product: { findMany: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run(db)),
  };
  return { db };
});
vi.mock("@/lib/prisma", () => ({ prisma: db }));
import { NextRequest } from "next/server";
import { GET, POST } from "./route";

const product = { id: "prod1", name: "Gojo", sku: "GOJO-1", price: 199900, stockQuantity: 5 };

function postWith(body: unknown) {
  return new NextRequest("http://localhost/api/admin/orders", { method: "POST", headers: { "x-admin-key": "test-key" }, body: JSON.stringify(body) });
}

beforeEach(() => {
  process.env.ADMIN_API_KEY = "test-key";
  db.order.create.mockReset();
  db.product.findMany.mockReset().mockResolvedValue([product]);
  db.product.update.mockReset();
  db.customer.findUnique.mockReset();
});

it("creates a walk-in order and marks it paid when paid in full", async () => {
  db.order.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "o1", ...data }));
  const response = await POST(postWith({ customerName: "Ansh", customerPhone: "9999999999", items: [{ productId: "prod1", quantity: 2 }], amountPaid: 399800 }));
  expect(response.status).toBe(201);
  const body = await response.json();
  expect(body.total).toBe(399800);
  expect(body.paymentStatus).toBe("PAID");
  expect(db.product.update).toHaveBeenCalledWith({ where: { id: "prod1" }, data: { stockQuantity: { decrement: 2 } } });
});

it("marks a partial payment as PARTIALLY_PAID", async () => {
  db.order.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "o2", ...data }));
  const response = await POST(postWith({ customerName: "Ansh", customerPhone: "9999999999", items: [{ productId: "prod1", quantity: 1 }], amountPaid: 50000 }));
  const body = await response.json();
  expect(body.paymentStatus).toBe("PARTIALLY_PAID");
  expect(body.amountPaid).toBe(50000);
});

it("attaches an existing customer instead of walk-in details", async () => {
  db.customer.findUnique.mockResolvedValue({ id: "cust1" });
  db.order.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: "o3", ...data }));
  const response = await POST(postWith({ customerId: "cust1", items: [{ productId: "prod1", quantity: 1 }] }));
  expect(response.status).toBe(201);
  expect(db.order.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ customerId: "cust1" }) }));
});

it("rejects when neither an existing customer nor walk-in details are given", async () => {
  const response = await POST(postWith({ items: [{ productId: "prod1", quantity: 1 }] }));
  expect(response.status).toBe(400);
});

it("refuses to oversell stock", async () => {
  const response = await POST(postWith({ customerName: "Ansh", customerPhone: "9999999999", items: [{ productId: "prod1", quantity: 99 }] }));
  expect(response.status).toBe(409);
});

it("rejects an amount paid greater than the order total", async () => {
  const response = await POST(postWith({ customerName: "Ansh", customerPhone: "9999999999", items: [{ productId: "prod1", quantity: 1 }], amountPaid: 999999999 }));
  expect(response.status).toBe(400);
});

it("refuses an unauthenticated create", async () => {
  const request = new NextRequest("http://localhost/api/admin/orders", { method: "POST", body: JSON.stringify({}) });
  expect((await POST(request)).status).toBe(401);
});

it("refuses an unauthenticated list", async () => {
  const request = new NextRequest("http://localhost/api/admin/orders");
  expect((await GET(request)).status).toBe(401);
});
