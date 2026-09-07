import { expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: { category: { update: vi.fn().mockResolvedValue({ id: "c1", name: "Renamed" }), delete: vi.fn().mockRejectedValue(new Error("FK")) } } }));
import { NextRequest } from "next/server";
import { PATCH, DELETE } from "./route";

it("reports a conflict when deleting a category that still has products", async () => {
  process.env.ADMIN_API_KEY = "test-key";
  const request = new NextRequest("http://localhost/api/admin/categories/c1", { method: "DELETE", headers: { "x-admin-key": "test-key" } });
  const response = await DELETE(request, { params: Promise.resolve({ id: "c1" }) });
  expect(response.status).toBe(409);
});

it("updates a category with the admin key", async () => {
  process.env.ADMIN_API_KEY = "test-key";
  const request = new NextRequest("http://localhost/api/admin/categories/c1", { method: "PATCH", headers: { "x-admin-key": "test-key" }, body: JSON.stringify({ name: "Renamed" }) });
  const response = await PATCH(request, { params: Promise.resolve({ id: "c1" }) });
  expect(response.status).toBe(200);
});
