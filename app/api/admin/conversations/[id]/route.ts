// app/api/admin/conversations/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { error, requireAdmin } from "@/lib/api";
import { fullThread, productSummary } from "@/lib/chat";
import { prisma } from "@/lib/prisma";

const statusInput = z.object({ status: z.enum(["OPEN", "CLOSED"]) });

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  const { id } = await params;
  const conversation = await prisma.conversation.findUnique({ where: { id }, include: { customer: { select: { id: true, name: true, email: true } }, product: productSummary, messages: fullThread } });
  if (!conversation) return error("Conversation not found", 404);
  /* Mirror of the customer route: opening the thread is the read receipt, so
     the inbox badge clears the moment someone actually looks at it. */
  await prisma.message.updateMany({ where: { conversationId: id, sender: "CUSTOMER", readByAdmin: false }, data: { readByAdmin: true } });
  return NextResponse.json(conversation);
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  const { id } = await params;
  const parsed = statusInput.safeParse(await request.json());
  if (!parsed.success) return error(parsed.error.issues[0].message, 400);
  try { return NextResponse.json(await prisma.conversation.update({ where: { id }, data: parsed.data })); } catch { return error("Conversation not found", 404); }
}
