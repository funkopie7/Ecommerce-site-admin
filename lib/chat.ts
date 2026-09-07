import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const productSummary = { select: { id: true, name: true, slug: true, imageUrl: true } } as const;
export const lastMessage = { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, imageUrl: true, sender: true, createdAt: true } } as const;
export const fullThread = { orderBy: { createdAt: "asc" } } as const;

const messageFields = {
  body: z.string().trim().max(4000, "That message is too long").optional(),
  imageUrl: z.string().url("That image link isn't valid").refine((value) => /^https?:\/\//i.test(value), "That image link isn't valid").optional(),
};
const carriesSomething = (value: { body?: string; imageUrl?: string }) => Boolean(value.body || value.imageUrl);
const nothingSent = { message: "Write a message or attach an image" };

export const messageInput = z.object(messageFields).refine(carriesSomething, nothingSent);
export const conversationStart = z.object({ ...messageFields, productId: z.string().optional() }).refine(carriesSomething, nothingSent);

export const messageContent = (input: { body?: string; imageUrl?: string }) => ({ body: input.body ?? "", imageUrl: input.imageUrl ?? null });

export async function unreadBySender(conversationIds: string[], sender: "CUSTOMER" | "ADMIN"): Promise<Record<string, number>> {
  if (conversationIds.length === 0) return {};
  const unreadFlag = sender === "ADMIN" ? { readByCustomer: false } : { readByAdmin: false };
  const rows = await prisma.message.groupBy({ by: ["conversationId"], where: { conversationId: { in: conversationIds }, sender, ...unreadFlag }, _count: { _all: true } });
  return Object.fromEntries(rows.map((row) => [row.conversationId, row._count._all]));
}

export function toListRows<T extends { id: string; messages: { body: string; imageUrl: string | null; sender: string; createdAt: Date }[] }>(rows: T[], unread: Record<string, number>) {
  return rows.map(({ messages, ...rest }) => ({ ...rest, lastMessage: messages[0] ?? null, unread: unread[rest.id] ?? 0 }));
}
