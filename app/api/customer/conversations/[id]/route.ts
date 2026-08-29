// app/api/customer/conversations/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { customerFromRequest } from "@/lib/auth";
import { error } from "@/lib/api";
import { fullThread, productSummary } from "@/lib/chat";
import { prisma } from "@/lib/prisma";

/* Someone else's conversation id reads as 404, not 403: a "you may not see
   this" answer still confirms the thread exists. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await customerFromRequest(request);
  if (!session) return error("Sign in required", 401);
  const { id } = await params;
  const conversation = await prisma.conversation.findFirst({ where: { id, customerId: session.customerId }, include: { product: productSummary, messages: fullThread } });
  if (!conversation) return error("Conversation not found", 404);
  /* Opening the thread is what marks it read — the reply arrives in the same
     payload the customer is about to look at, so there is no separate ack. */
  await prisma.message.updateMany({ where: { conversationId: id, sender: "ADMIN", readByCustomer: false }, data: { readByCustomer: true } });
  return NextResponse.json(conversation);
}
