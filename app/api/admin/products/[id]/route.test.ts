import { expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: { product: { update: vi.fn().mockResolvedValue({ id: "p1", name: "Renamed" }), delete: vi.fn().mockResolvedValue({ id: "p1" }) } } }));
import { NextRequest } from "next/server";
import { PATCH, DELETE } from "./route";

it("rejects an update without the admin key", async () => {
  const request = new NextRequest("http://localhost/api/admin/products/p1", { method: "PATCH", body: JSON.stringify({ name: "Renamed" }) });
  const response = await PATCH(request, { params: Promise.resolve({ id: "p1" }) });
  expect(response.status).toBe(401);
});

it("updates a product with the admin key", async () => {
  process.env.ADMIN_API_KEY = "test-key";
  const request = new NextRequest("http://localhost/api/admin/products/p1", { method: "PATCH", headers: { "x-admin-key": "test-key" }, body: JSON.stringify({ name: "Renamed" }) });
  const response = await PATCH(request, { params: Promise.resolve({ id: "p1" }) });
  expect(response.status).toBe(200);
});
