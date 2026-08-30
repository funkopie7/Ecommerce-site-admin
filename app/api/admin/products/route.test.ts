// app/api/admin/products/route.test.ts
import { expect, it, vi, beforeEach } from "vitest";
const { count, create } = vi.hoisted(() => ({
  count: vi.fn(),
  create: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { product: { count, create, findMany: vi.fn() } } }));
import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { POST } from "./route";

const skuConflict = () => new Prisma.PrismaClientKnownRequestError("Unique constraint failed", { code: "P2002", clientVersion: "test", meta: { target: ["sku"] } });

const validBody = {
  name: "Gojo",
  slug: "gojo",
  description: "A very tall, very smug sorcerer.",
  price: 199900,
  cost: 90000,
  stockQuantity: 5,
  categoryId: "cat1",
};

function postWith(body: unknown) {
  return new NextRequest("http://localhost/api/admin/products", { method: "POST", headers: { "x-admin-key": "test-key" }, body: JSON.stringify(body) });
}

beforeEach(() => {
  process.env.ADMIN_API_KEY = "test-key";
  count.mockReset();
  create.mockReset();
});

it("generates an SKU from the product's first word and the next free number", async () => {
  count.mockResolvedValue(0);
  create.mockImplementation(async ({ data }: { data: { sku: string } }) => ({ id: "p1", ...data }));
  const response = await POST(postWith(validBody));
  expect(response.status).toBe(201);
  const body = await response.json();
  expect(body.sku).toBe("GOJO-1");
  expect(count).toHaveBeenCalledWith({ where: { sku: { startsWith: "GOJO-" } } });
});

it("picks up after however many of that word already exist", async () => {
  count.mockResolvedValue(3);
  create.mockImplementation(async ({ data }: { data: { sku: string } }) => ({ id: "p2", ...data }));
  const response = await POST(postWith(validBody));
  const body = await response.json();
  expect(body.sku).toBe("GOJO-4");
});

it("retries the next number when a concurrent create just took it", async () => {
  count.mockResolvedValueOnce(0).mockResolvedValueOnce(1);
  create
    .mockRejectedValueOnce(skuConflict())
    .mockImplementationOnce(async ({ data }: { data: { sku: string } }) => ({ id: "p3", ...data }));
  const response = await POST(postWith(validBody));
  expect(response.status).toBe(201);
  const body = await response.json();
  expect(body.sku).toBe("GOJO-2");
});

it("refuses an unauthenticated create", async () => {
  const request = new NextRequest("http://localhost/api/admin/products", { method: "POST", body: JSON.stringify(validBody) });
  expect((await POST(request)).status).toBe(401);
});

it("rejects a body missing required fields", async () => {
  const response = await POST(postWith({ name: "Gojo" }));
  expect(response.status).toBe(400);
});
