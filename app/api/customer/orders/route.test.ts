import { expect, it, vi } from "vitest";
vi.mock("@/lib/prisma", () => ({ prisma: { order: { findMany: vi.fn().mockResolvedValue([{ id: "o1", number: "MC-1" }]) } } }));
vi.mock("@/lib/auth", () => ({ customerFromRequest: vi.fn().mockResolvedValue({ customerId: "cust1", email: "a@b.com" }) }));
import { NextRequest } from "next/server";
import { GET } from "./route";

it("returns the signed-in customer's orders", async () => {
  const response = await GET(new NextRequest("http://localhost/api/customer/orders"));
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual([{ id: "o1", number: "MC-1" }]);
});
