// app/api/admin/conversations/route.test.ts
import { beforeEach, expect, it, vi } from "vitest";
const { db } = vi.hoisted(() => ({ db: { conversation: { findMany: vi.fn().mockResolvedValue([]) }, message: { groupBy: vi.fn().mockResolvedValue([]) } } }));
vi.mock("@/lib/prisma", () => ({ prisma: db }));
import { NextRequest } from "next/server";
import { GET } from "./route";

const get = (query = "") => GET(new NextRequest(`http://localhost/api/admin/conversations${query}`, { headers: { "x-admin-key": "test-key" } }));
beforeEach(() => { process.env.ADMIN_API_KEY = "test-key"; db.conversation.findMany.mockResolvedValue([]); });

it("lists every thread with its unread count", async () => {
  db.conversation.findMany.mockResolvedValueOnce([{ id: "c1", status: "OPEN", customer: { id: "cust1", name: "Ansh", email: "a@b.com" }, messages: [{ body: "hi", imageUrl: null, sender: "CUSTOMER", createdAt: new Date() }] }]);
  db.message.groupBy.mockResolvedValueOnce([{ conversationId: "c1", _count: { _all: 1 } }]);
  const response = await get();
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject([{ id: "c1", unread: 1, lastMessage: { body: "hi", sender: "CUSTOMER" } }]);
});

/* The inbox preview has to say *something* for a message that is only a photo,
   or a row whose newest message is an image reads as an empty conversation. */
it("carries the attachment through to the inbox preview", async () => {
  const photo = "https://example.supabase.co/storage/v1/object/public/chat-images/a.webp";
  db.conversation.findMany.mockResolvedValueOnce([{ id: "c1", status: "OPEN", customer: { id: "cust1", name: "Ansh", email: "a@b.com" }, messages: [{ body: "", imageUrl: photo, sender: "CUSTOMER", createdAt: new Date() }] }]);
  expect(await (await get()).json()).toMatchObject([{ lastMessage: { body: "", imageUrl: photo } }]);
});

it("filters by status when asked", async () => {
  await get("?status=CLOSED");
  expect(db.conversation.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: "CLOSED" } }));
});

it("rejects a status the enum does not have", async () => {
  expect((await get("?status=ARCHIVED")).status).toBe(400);
});

it("refuses an unauthenticated read", async () => {
  expect((await GET(new NextRequest("http://localhost/api/admin/conversations"))).status).toBe(401);
});
