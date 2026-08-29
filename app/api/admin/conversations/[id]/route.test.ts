// app/api/admin/conversations/[id]/route.test.ts
import { beforeEach, expect, it, vi } from "vitest";
const { db } = vi.hoisted(() => ({ db: { conversation: { findUnique: vi.fn(), update: vi.fn().mockResolvedValue({ id: "c1", status: "CLOSED" }) }, message: { updateMany: vi.fn() } } }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
import { NextRequest } from "next/server";
import { GET, PATCH } from "./route";

const params = { params: Promise.resolve({ id: "c1" }) };
const key = { "x-admin-key": "test-key" };
const patch = (body: unknown, headers: Record<string, string> = key) => PATCH(new NextRequest("http://localhost/api/admin/conversations/c1", { method: "PATCH", headers, body: JSON.stringify(body) }), params);
beforeEach(() => { process.env.ADMIN_API_KEY = "test-key"; db.conversation.findUnique.mockResolvedValue({ id: "c1", messages: [] }); });

it("marks the customer's messages read when the thread is opened", async () => {
  const response = await GET(new NextRequest("http://localhost/api/admin/conversations/c1", { headers: key }), params);
  expect(response.status).toBe(200);
  expect(db.message.updateMany).toHaveBeenCalledWith({ where: { conversationId: "c1", sender: "CUSTOMER", readByAdmin: false }, data: { readByAdmin: true } });
});

it("404s an id that is not a conversation", async () => {
  db.conversation.findUnique.mockResolvedValueOnce(null);
  expect((await GET(new NextRequest("http://localhost/api/admin/conversations/c1", { headers: key }), params)).status).toBe(404);
});

it("closes a thread", async () => {
  expect((await patch({ status: "CLOSED" })).status).toBe(200);
  expect(db.conversation.update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { status: "CLOSED" } });
});

it("rejects a status outside the enum", async () => {
  expect((await patch({ status: "SNOOZED" })).status).toBe(400);
});

it("refuses an unauthenticated status change", async () => {
  expect((await patch({ status: "CLOSED" }, {})).status).toBe(401);
});
