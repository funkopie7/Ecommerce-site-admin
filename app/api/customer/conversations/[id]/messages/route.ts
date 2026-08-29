// app/api/customer/conversations/[id]/messages/route.ts
import { NextRequest, NextResponse } from "next/server";
import { customerFromRequest } from "@/lib/auth";
import { error } from "@/lib/api";
import { messageContent, messageInput } from "@/lib/chat";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await customerFromRequest(request);
  if (!session) return error("Sign in required", 401);
  const { id } = await params;
  const parsed = messageInput.safeParse(await request.json());
  if (!parsed.success) return error(parsed.error.issues[0].message, 400);
  if (!(await prisma.conversation.findFirst({ where: { id, customerId: session.customerId }, select: { id: true } }))) return error("Conversation not found", 404);
  /* Replying to a closed thread revives it. The alternative — accepting the
     message into a CLOSED conversation — drops it out of the admin's default
     Open filter, so the customer would be talking into a thread nobody reads. */
  const message = await prisma.$transaction(async (tx) => {
    const created = await tx.message.create({ data: { conversationId: id, sender: "CUSTOMER", ...messageContent(parsed.data) } });
    await tx.conversation.update({ where: { id }, data: { lastMessageAt: created.createdAt, status: "OPEN" } });
    return created;
  });
  return NextResponse.json(message, { status: 201 });
}
