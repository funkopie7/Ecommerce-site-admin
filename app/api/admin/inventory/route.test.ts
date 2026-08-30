// app/api/admin/inventory/route.test.ts
import { expect, it, vi } from "vitest";
const findMany = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: { inventoryAdjustment: { findMany } } }));
import { NextRequest } from "next/server";
import { GET } from "./route";

it("lists the adjustment audit trail, newest first", async () => {
  process.env.ADMIN_API_KEY = "test-key";
  findMany.mockResolvedValue([{ id: "adj1", delta: -1, resultingQuantity: 4, reason: "Damaged", adminEmail: "admin", createdAt: new Date().toISOString(), product: { id: "p1", name: "Figure", sku: "SKU1" } }]);
  const request = new NextRequest("http://localhost/api/admin/inventory", { headers: { "x-admin-key": "test-key" } });
  const response = await GET(request);
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body).toHaveLength(1);
  expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { createdAt: "desc" } }));
});

it("refuses an unauthenticated read", async () => {
  process.env.ADMIN_API_KEY = "test-key";
  const request = new NextRequest("http://localhost/api/admin/inventory");
  expect((await GET(request)).status).toBe(401);
});
