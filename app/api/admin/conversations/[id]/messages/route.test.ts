import { beforeEach, expect, it, vi } from "vitest";
const { db } = vi.hoisted(() => {
  const db = {
    conversation: { findUnique: vi.fn().mockResolvedValue({ id: "c1" }), update: vi.fn() },
    message: { create: vi.fn().mockResolvedValue({ id: "m9", createdAt: new Date("2026-08-29T10:00:00Z") }) },
    $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run(db)),
  };
  return { db };
});
vi.mock("@/lib/prisma", () => ({ prisma: db }));
import { NextRequest } from "next/server";
import { POST } from "./route";

const key = { "x-admin-key": "test-key" };
const post = (body: unknown, headers: Record<string, string> = key) =>
  POST(new NextRequest("http://localhost/api/admin/conversations/c1/messages", { method: "POST", headers, body: JSON.stringify(body) }), { params: Promise.resolve({ id: "c1" }) });
const photo = "https://example.supabase.co/storage/v1/object/public/chat-images/a.webp";

beforeEach(() => { process.env.ADMIN_API_KEY = "test-key"; db.conversation.findUnique.mockResolvedValue({ id: "c1" }); db.message.create.mockClear(); });

it("appends an admin reply without touching the status", async () => {
  expect((await post({ body: "on its way" })).status).toBe(201);
  expect(db.message.create).toHaveBeenCalledWith({ data: { conversationId: "c1", sender: "ADMIN", body: "on its way", imageUrl: null } });
  expect(db.conversation.update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { lastMessageAt: new Date("2026-08-29T10:00:00Z") } });
});

it("accepts an attachment, with or without a caption", async () => {
  expect((await post({ imageUrl: photo })).status).toBe(201);
  expect(db.message.create).toHaveBeenCalledWith({ data: { conversationId: "c1", sender: "ADMIN", body: "", imageUrl: photo } });
  expect((await post({ body: "here it is", imageUrl: photo })).status).toBe(201);
  expect(db.message.create).toHaveBeenLastCalledWith({ data: { conversationId: "c1", sender: "ADMIN", body: "here it is", imageUrl: photo } });
});

it("rejects a reply that is neither text nor image", async () => {
  expect((await post({})).status).toBe(400);
  expect(db.message.create).not.toHaveBeenCalled();
});

it("404s a conversation that does not exist", async () => {
  db.conversation.findUnique.mockResolvedValueOnce(null);
  expect((await post({ body: "hello" })).status).toBe(404);
});

it("refuses an unauthenticated reply", async () => {
  expect((await post({ body: "hello" }, {})).status).toBe(401);
});
