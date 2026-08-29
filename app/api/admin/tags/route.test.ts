// app/api/admin/tags/route.test.ts
import { expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: { tag: { create: vi.fn().mockResolvedValue({ id: "t1", code: "STAFF_PICK", label: "staff pick", tone: "blue" }) } } }));
import { NextRequest } from "next/server";
import { POST } from "./route";

const post = (body: unknown) => new NextRequest("http://localhost/api/admin/tags", { method: "POST", headers: { "x-admin-key": "test-key" }, body: JSON.stringify(body) });

it("creates a tag with the admin key", async () => {
  process.env.ADMIN_API_KEY = "test-key";
  const response = await POST(post({ code: "STAFF_PICK", label: "staff pick", tone: "blue" }));
  expect(response.status).toBe(201);
});

it("rejects a tone the storefront cannot draw", async () => {
  process.env.ADMIN_API_KEY = "test-key";
  const response = await POST(post({ code: "STAFF_PICK", label: "staff pick", tone: "chartreuse" }));
  expect(response.status).toBe(400);
});

it("refuses an unauthenticated create", async () => {
  process.env.ADMIN_API_KEY = "test-key";
  const request = new NextRequest("http://localhost/api/admin/tags", { method: "POST", body: JSON.stringify({ code: "X_Y", label: "nope" }) });
  expect((await POST(request)).status).toBe(401);
});
