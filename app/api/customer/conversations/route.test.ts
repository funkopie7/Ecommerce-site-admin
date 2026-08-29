// app/api/customer/conversations/route.test.ts
import { beforeEach, expect, it, vi } from "vitest";
/* vi.mock factories are hoisted above module-scope consts, so the shared spies
   have to be created inside vi.hoisted to exist by the time the factory runs.
   $transaction hands the callback the same mock client, which is enough here:
   these tests are about validation and the session gate, not about atomicity. */
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
  db.conversation.findMany.mockResolvedValueOnce([{ id: "c1", status: "OPEN", messages: [{ body: "hi", sender: "CUSTOMER", createdAt: new Date() }] }]);
  db.message.groupBy.mockResolvedValueOnce([{ conversationId: "c1", _count: { _all: 2 } }]);
  const response = await GET(new NextRequest("http://localhost/api/customer/conversations"));
  expect(response.status).toBe(200);
  expect(db.conversation.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { customerId: "cust1" } }));
  expect(await response.json()).toMatchObject([{ id: "c1", unread: 2, lastMessage: { body: "hi" } }]);
});

it("starts a thread with its opening message", async () => {
  expect((await post({ body: "Is this figure restocking?" })).status).toBe(201);
  expect(db.conversation.create).toHaveBeenCalledWith({ data: { customerId: "cust1", productId: null } });
  expect(db.message.create).toHaveBeenCalledWith({ data: { conversationId: "c1", sender: "CUSTOMER", body: "Is this figure restocking?" } });
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
