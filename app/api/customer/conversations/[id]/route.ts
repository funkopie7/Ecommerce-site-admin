import { NextRequest, NextResponse } from "next/server";
import { customerFromRequest } from "@/lib/auth";
import { error } from "@/lib/api";
import { fullThread, productSummary } from "@/lib/chat";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await customerFromRequest(request);
  if (!session) return error("Sign in required", 401);
  const { id } = await params;
  const conversation = await prisma.conversation.findFirst({ where: { id, customerId: session.customerId }, include: { product: productSummary, messages: fullThread } });
  if (!conversation) return error("Conversation not found", 404);
  await prisma.message.updateMany({ where: { conversationId: id, sender: "ADMIN", readByCustomer: false }, data: { readByCustomer: true } });
  return NextResponse.json(conversation);
}
