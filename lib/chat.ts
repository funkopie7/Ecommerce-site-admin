// lib/chat.ts
import { z } from "zod";
import { prisma } from "@/lib/prisma";

/* Both inboxes — the storefront panel and the admin dashboard — render the same
   row: product context, the newest message, and how many of the *other* side's
   messages are still unread. Only the definition of "other side" differs, so the
   shared pieces live here and the two route families parameterise them. */

export const productSummary = { select: { id: true, name: true, slug: true, imageUrl: true } } as const;
export const lastMessage = { orderBy: { createdAt: "desc" }, take: 1, select: { body: true, imageUrl: true, sender: true, createdAt: true } } as const;
export const fullThread = { orderBy: { createdAt: "asc" } } as const;

/* A message carries text, an image, or both. Neither is the one combination
   worth rejecting, and it has to be a whole-object rule rather than a per-field
   `min(1)` — which is why the fields are a plain shape both schemas spread,
   rather than one schema the other `.extend()`s: `.refine` returns a
   ZodEffects, and ZodEffects has no `.extend`. */
const messageFields = {
  body: z.string().trim().max(4000, "That message is too long").optional(),
  /* http(s) only — `.url()` alone happily accepts `javascript:` and friends,
     and this value is handed straight to an <img src> in two different UIs. */
  imageUrl: z.string().url("That image link isn't valid").refine((value) => /^https?:\/\//i.test(value), "That image link isn't valid").optional(),
};
const carriesSomething = (value: { body?: string; imageUrl?: string }) => Boolean(value.body || value.imageUrl);
const nothingSent = { message: "Write a message or attach an image" };

export const messageInput = z.object(messageFields).refine(carriesSomething, nothingSent);
/** Opening a thread: the same message, optionally filed under a figure. */
export const conversationStart = z.object({ ...messageFields, productId: z.string().optional() }).refine(carriesSomething, nothingSent);

/** The columns a Message row contributes to any response, from either half. */
export const messageContent = (input: { body?: string; imageUrl?: string }) => ({ body: input.body ?? "", imageUrl: input.imageUrl ?? null });

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
export function toListRows<T extends { id: string; messages: { body: string; imageUrl: string | null; sender: string; createdAt: Date }[] }>(rows: T[], unread: Record<string, number>) {
  return rows.map(({ messages, ...rest }) => ({ ...rest, lastMessage: messages[0] ?? null, unread: unread[rest.id] ?? 0 }));
}
