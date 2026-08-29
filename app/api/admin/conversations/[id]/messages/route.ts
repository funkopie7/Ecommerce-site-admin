// app/api/admin/conversations/[id]/messages/route.ts
import { NextRequest, NextResponse } from "next/server";
import { error, requireAdmin } from "@/lib/api";
import { messageContent, messageInput } from "@/lib/chat";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  const { id } = await params;
  const parsed = messageInput.safeParse(await request.json());
  if (!parsed.success) return error(parsed.error.issues[0].message, 400);
  if (!(await prisma.conversation.findUnique({ where: { id }, select: { id: true } }))) return error("Conversation not found", 404);
  /* An admin reply leaves the status alone: closing is a deliberate act on the
     PATCH route, not a side effect of answering. */
  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({ data: { conversationId: id, sender: "ADMIN", ...messageContent(parsed.data) } });
    await tx.conversation.update({ where: { id }, data: { lastMessageAt: created.createdAt } });
    return created;
  });
  return NextResponse.json(message, { status: 201 });
}
