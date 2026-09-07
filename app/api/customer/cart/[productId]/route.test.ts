import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({
  prisma: {
    cart: { findUnique: vi.fn().mockResolvedValue({ id: "cart1", customerId: "cust1" }) },
    product: { findUnique: vi.fn().mockResolvedValue({ id: "prod1", stockQuantity: 10 }) },
    cartItem: { update: vi.fn().mockResolvedValue({ id: "ci1", quantity: 3 }), delete: vi.fn().mockResolvedValue({ id: "ci1" }) },
  },
}));
vi.mock("@/lib/auth", () => ({ customerFromRequest: vi.fn().mockResolvedValue({ customerId: "cust1", email: "a@b.com" }) }));
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { PATCH, DELETE } from "./route";

const patch = (quantity: number) => PATCH(new NextRequest("http://localhost/api/customer/cart/prod1", { method: "PATCH", body: JSON.stringify({ quantity }) }), { params: Promise.resolve({ productId: "prod1" }) });

beforeEach(() => vi.clearAllMocks());

it("updates a cart line's quantity", async () => {
  const response = await patch(3);
  expect(response.status).toBe(200);
});

it("rejects a quantity above what's actually in stock", async () => {
  vi.mocked(prisma.product.findUnique).mockResolvedValueOnce({ id: "prod1", stockQuantity: 1 } as never);
  const response = await patch(3);
  expect(response.status).toBe(409);
  expect(prisma.cartItem.update).not.toHaveBeenCalled();
});

it("removes a cart line", async () => {
  const request = new NextRequest("http://localhost/api/customer/cart/prod1", { method: "DELETE" });
  const response = await DELETE(request, { params: Promise.resolve({ productId: "prod1" }) });
  expect(response.status).toBe(200);
});
