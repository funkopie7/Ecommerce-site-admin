// app/api/admin/customers/route.test.ts
import { expect, it, vi, beforeEach } from "vitest";
const findMany = vi.hoisted(() => vi.fn());
vi.mock("@/lib/prisma", () => ({ prisma: { customer: { findMany } } }));
import { NextRequest } from "next/server";
import { GET } from "./route";

beforeEach(() => {
  process.env.ADMIN_API_KEY = "test-key";
  findMany.mockReset().mockResolvedValue([{ id: "cust1", name: "Ansh", email: "a@b.com", phone: "9999999999" }]);
});

it("searches customers by name, email or phone", async () => {
  const request = new NextRequest("http://localhost/api/admin/customers?q=ansh", { headers: { "x-admin-key": "test-key" } });
  const response = await GET(request);
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body).toHaveLength(1);
});

it("returns no results for a query under two characters, without hitting the database", async () => {
  const request = new NextRequest("http://localhost/api/admin/customers?q=a", { headers: { "x-admin-key": "test-key" } });
  const response = await GET(request);
  expect(await response.json()).toEqual([]);
  expect(findMany).not.toHaveBeenCalled();
});

it("refuses an unauthenticated search", async () => {
  const request = new NextRequest("http://localhost/api/admin/customers?q=ansh");
  expect((await GET(request)).status).toBe(401);
});
