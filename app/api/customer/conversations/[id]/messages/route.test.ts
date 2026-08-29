// app/api/customer/conversations/[id]/messages/route.test.ts
import { beforeEach, expect, it, vi } from "vitest";
const { db } = vi.hoisted(() => {
  const db = {
    conversation: { findFirst: vi.fn().mockResolvedValue({ id: "c1" }), update: vi.fn() },
    message: { create: vi.fn().mockResolvedValue({ id: "m9", createdAt: new Date("2026-08-29T10:00:00Z") }) },
    $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run(db)),
  };
  return { db };
});
vi.mock("@/lib/prisma", () => ({ prisma: db }));
const { customerFromRequest } = vi.hoisted(() => ({ customerFromRequest: vi.fn() }));
vi.mock("@/lib/auth", () => ({ customerFromRequest }));
import { NextRequest } from "next/server";
import { POST } from "./route";

const post = (body: unknown) => POST(new NextRequest("http://localhost/api/customer/conversations/c1/messages", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ id: "c1" }) });
beforeEach(() => { customerFromRequest.mockResolvedValue({ customerId: "cust1", email: "a@b.com" }); db.conversation.findFirst.mockResolvedValue({ id: "c1" }); });

it("appends a customer reply and revives a closed thread", async () => {
  expect((await post({ body: "any update?" })).status).toBe(201);
  expect(db.message.create).toHaveBeenCalledWith({ data: { conversationId: "c1", sender: "CUSTOMER", body: "any update?" } });
  expect(db.conversation.update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { lastMessageAt: new Date("2026-08-29T10:00:00Z"), status: "OPEN" } });
});

it("reads someone else's thread as missing rather than forbidden", async () => {
  db.conversation.findFirst.mockResolvedValueOnce(null);
  expect((await post({ body: "hello" })).status).toBe(404);
});

it("rejects an empty message", async () => {
  expect((await post({ body: "" })).status).toBe(400);
});

it("refuses a signed-out visitor", async () => {
  customerFromRequest.mockResolvedValue(null);
  expect((await post({ body: "hello" })).status).toBe(401);
});
