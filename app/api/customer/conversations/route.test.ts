import { beforeEach, expect, it, vi } from "vitest";
const { db } = vi.hoisted(() => {
  const db = {
    conversation: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ id: "c1" }), update: vi.fn().mockResolvedValue({ id: "c1", messages: [] }), findFirst: vi.fn() },
    message: { groupBy: vi.fn().mockResolvedValue([]), create: vi.fn().mockResolvedValue({ id: "m1", createdAt: new Date() }), updateMany: vi.fn() },
    product: { findFirst: vi.fn().mockResolvedValue({ id: "prod1", visible: true }) },
    $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run(db)),
  };
  return { db };
});
vi.mock("@/lib/prisma", () => ({ prisma: db }));
const { customerFromRequest } = vi.hoisted(() => ({ customerFromRequest: vi.fn().mockResolvedValue({ customerId: "cust1", email: "a@b.com" }) }));
vi.mock("@/lib/auth", () => ({ customerFromRequest }));
import { NextRequest } from "next/server";
import { GET, POST } from "./route";

const post = (body: unknown) => POST(new NextRequest("http://localhost/api/customer/conversations", { method: "POST", body: JSON.stringify(body) }));
beforeEach(() => { customerFromRequest.mockResolvedValue({ customerId: "cust1", email: "a@b.com" }); db.conversation.create.mockClear(); });

it("lists only the signed-in customer's own threads", async () => {
  db.conversation.findMany.mockResolvedValueOnce([{ id: "c1", status: "OPEN", messages: [{ body: "hi", imageUrl: null, sender: "CUSTOMER", createdAt: new Date() }] }]);
  db.message.groupBy.mockResolvedValueOnce([{ conversationId: "c1", _count: { _all: 2 } }]);
  const response = await GET(new NextRequest("http://localhost/api/customer/conversations"));
  expect(response.status).toBe(200);
  expect(db.conversation.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { customerId: "cust1" } }));
  expect(await response.json()).toMatchObject([{ id: "c1", unread: 2, lastMessage: { body: "hi", imageUrl: null } }]);
});

it("starts a thread with its opening message", async () => {
  expect((await post({ body: "Is this figure restocking?" })).status).toBe(201);
  expect(db.conversation.create).toHaveBeenCalledWith({ data: { customerId: "cust1", productId: null } });
  expect(db.message.create).toHaveBeenCalledWith({ data: { conversationId: "c1", sender: "CUSTOMER", body: "Is this figure restocking?", imageUrl: null } });
});

it("starts a thread from a photo alone", async () => {
  const photo = "https://example.supabase.co/storage/v1/object/public/chat-images/a.webp";
  expect((await post({ imageUrl: photo })).status).toBe(201);
  expect(db.message.create).toHaveBeenCalledWith({ data: { conversationId: "c1", sender: "CUSTOMER", body: "", imageUrl: photo } });
});

it("rejects a thread that opens with neither text nor image", async () => {
  db.message.create.mockClear();
  expect((await post({ productId: "prod1" })).status).toBe(400);
  expect(db.message.create).not.toHaveBeenCalled();
});

it("attaches product context when a figure is named", async () => {
  expect((await post({ productId: "prod1", body: "What scale is this?" })).status).toBe(201);
  expect(db.conversation.create).toHaveBeenCalledWith({ data: { customerId: "cust1", productId: "prod1" } });
});

it("refuses product context the catalogue cannot show", async () => {
  db.product.findFirst.mockResolvedValueOnce(null);
  expect((await post({ productId: "ghost", body: "hello" })).status).toBe(404);
});

it("rejects an empty message", async () => {
  expect((await post({ body: "   " })).status).toBe(400);
  expect(db.conversation.create).not.toHaveBeenCalled();
});

it("refuses a signed-out visitor", async () => {
  customerFromRequest.mockResolvedValue(null);
  expect((await GET(new NextRequest("http://localhost/api/customer/conversations"))).status).toBe(401);
  expect((await post({ body: "hello" })).status).toBe(401);
});
