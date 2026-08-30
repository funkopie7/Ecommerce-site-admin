// app/api/auth/me/route.test.ts
import { expect, it, vi, beforeEach } from "vitest";
const { findUnique, update } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ prisma: { customer: { findUnique, update } } }));
const customerFromRequest = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({ customerFromRequest }));
import { NextRequest } from "next/server";
import { GET, PATCH } from "./route";

beforeEach(() => {
  findUnique.mockReset();
  update.mockReset();
  customerFromRequest.mockReset();
});

it("returns the signed-in customer's profile", async () => {
  customerFromRequest.mockResolvedValue({ customerId: "cust1", email: "a@b.com" });
  findUnique.mockResolvedValue({ id: "cust1", name: "Ansh", email: "a@b.com", phone: null, imageUrl: null });
  const response = await GET(new NextRequest("http://localhost/api/auth/me"));
  expect(response.status).toBe(200);
});

it("refuses an unauthenticated read", async () => {
  customerFromRequest.mockResolvedValue(null);
  const response = await GET(new NextRequest("http://localhost/api/auth/me"));
  expect(response.status).toBe(401);
});

it("updates name, phone and avatar", async () => {
  customerFromRequest.mockResolvedValue({ customerId: "cust1", email: "a@b.com" });
  update.mockResolvedValue({ id: "cust1", name: "New Name", email: "a@b.com", phone: "9999999999", imageUrl: "https://example.com/a.webp" });
  const request = new NextRequest("http://localhost/api/auth/me", { method: "PATCH", body: JSON.stringify({ name: "New Name", phone: "9999999999", imageUrl: "https://example.com/a.webp" }) });
  const response = await PATCH(request);
  expect(response.status).toBe(200);
  const body = await response.json();
  expect(body.name).toBe("New Name");
  expect(update).toHaveBeenCalledWith({ where: { id: "cust1" }, data: { name: "New Name", phone: "9999999999", imageUrl: "https://example.com/a.webp" }, select: expect.any(Object) });
});

it("refuses an unauthenticated update", async () => {
  customerFromRequest.mockResolvedValue(null);
  const request = new NextRequest("http://localhost/api/auth/me", { method: "PATCH", body: JSON.stringify({ name: "New Name" }) });
  expect((await PATCH(request)).status).toBe(401);
});

it("rejects an invalid phone number", async () => {
  customerFromRequest.mockResolvedValue({ customerId: "cust1", email: "a@b.com" });
  const request = new NextRequest("http://localhost/api/auth/me", { method: "PATCH", body: JSON.stringify({ phone: "12" }) });
  expect((await PATCH(request)).status).toBe(400);
});
