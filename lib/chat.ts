// lib/chat.ts
import { z } from "zod";
import { prisma } from "@/lib/prisma";

/* Both inboxes — the storefront panel and the admin dashboard — render the same
   row: product context, the newest message, and how many of the *other* side's
   messages are still unread. Only the definition of "other side" differs, so the
   shared pieces live here and the two route families parameterise them. */

export const productSummary = { select: { id: true, name: true, slug: true, imageUrl: true } } as const;
export const lastMessage = { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, sender: true, createdAt: true } } as const;
export const fullThread = { orderBy: { createdAt: "asc" } } as const;
export const messageInput = z.object({ body: z.string().trim().min(1, "Write a message first").max(4000, "That message is too long") });

/* A per-conversation filtered count. groupBy rather than a `_count` on the
   include because the unread rule filters on two columns (sender + the read
   flag for the reader), which a relation count can't express portably. */
export async function unreadBySender(conversationIds: string[], sender: "CUSTOMER" | "ADMIN"): Promise<Record<string, number>> {
  if (conversationIds.length === 0) return {};
  const unreadFlag = sender === "ADMIN" ? { readByCustomer: false } : { readByAdmin: false };
  const rows = await prisma.message.groupBy({ by: ["conversationId"], where: { conversationId: { in: conversationIds }, sender, ...unreadFlag }, _count: { _all: true } });
  return Object.fromEntries(rows.map((row) => [row.conversationId, row._count._all]));
}

/* Shapes a findMany result (each row carrying a one-element `messages`) into the
   list row both UIs consume: `lastMessage` flattened out, `unread` attached. */
export function toListRows<T extends { id: string; messages: { body: string; sender: string; createdAt: Date }[] }>(rows: T[], unread: Record<string, number>) {
  return rows.map(({ messages, ...rest }) => ({ ...rest, lastMessage: messages[0] ?? null, unread: unread[rest.id] ?? 0 }));
}
