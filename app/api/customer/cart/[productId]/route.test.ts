// app/api/customer/cart/[productId]/route.test.ts
import { expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: { cart: { findUnique: vi.fn().mockResolvedValue({ id: "cart1", customerId: "cust1" }) }, cartItem: { update: vi.fn().mockResolvedValue({ id: "ci1", quantity: 3 }), delete: vi.fn().mockResolvedValue({ id: "ci1" }) } } }));
vi.mock("@/lib/auth", () => ({ customerFromRequest: vi.fn().mockResolvedValue({ customerId: "cust1", email: "a@b.com" }) }));
import { NextRequest } from "next/server";
import { PATCH, DELETE } from "./route";

it("updates a cart line's quantity", async () => {
  const request = new NextRequest("http://localhost/api/customer/cart/prod1", { method: "PATCH", body: JSON.stringify({ quantity: 3 }) });
  const response = await PATCH(request, { params: Promise.resolve({ productId: "prod1" }) });
  expect(response.status).toBe(200);
});

it("removes a cart line", async () => {
  const request = new NextRequest("http://localhost/api/customer/cart/prod1", { method: "DELETE" });
  const response = await DELETE(request, { params: Promise.resolve({ productId: "prod1" }) });
  expect(response.status).toBe(200);
});
