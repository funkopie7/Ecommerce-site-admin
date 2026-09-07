import { NextRequest, NextResponse } from "next/server";
import { customerFromRequest } from "@/lib/auth";
import { error } from "@/lib/api";
import { conversationStart, fullThread, lastMessage, messageContent, productSummary, toListRows, unreadBySender } from "@/lib/chat";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await customerFromRequest(request);
  if (!session) return error("Sign in required", 401);
  const rows = await prisma.conversation.findMany({ where: { customerId: session.customerId }, orderBy: { lastMessageAt: "desc" }, include: { product: productSummary, messages: lastMessage } });
  return NextResponse.json(toListRows(rows, await unreadBySender(rows.map((row) => row.id), "ADMIN")));
}

export async function POST(request: NextRequest) {
  const session = await customerFromRequest(request);
  if (!session) return error("Sign in required", 401);
  const parsed = conversationStart.safeParse(await request.json());
  if (!parsed.success) return error(parsed.error.issues[0].message, 400);
  const { productId, ...content } = parsed.data;
  if (productId && !(await prisma.product.findFirst({ where: { id: productId, visible: true } }))) return error("Product not found", 404);
  const conversation = await prisma.$transaction(async (tx) => {
    const created = await tx.conversation.create({ data: { customerId: session.customerId, productId: productId ?? null } });
    const message = await tx.message.create({ data: { conversationId: created.id, sender: "CUSTOMER", ...messageContent(content) } });
    return tx.conversation.update({ where: { id: created.id }, data: { lastMessageAt: message.createdAt }, include: { product: productSummary, messages: fullThread } });
  });
  return NextResponse.json(conversation, { status: 201 });
}
