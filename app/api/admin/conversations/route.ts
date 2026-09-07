import { NextRequest, NextResponse } from "next/server";
import { error, requireAdmin } from "@/lib/api";
import { lastMessage, productSummary, toListRows, unreadBySender } from "@/lib/chat";
import { prisma } from "@/lib/prisma";

const customerSummary = { select: { id: true, name: true, email: true } } as const;

export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  const status = request.nextUrl.searchParams.get("status") || null;
  if (status !== null && status !== "OPEN" && status !== "CLOSED") return error("Status must be OPEN or CLOSED", 400);
  const rows = await prisma.conversation.findMany({ where: status ? { status } : {}, orderBy: { lastMessageAt: "desc" }, include: { customer: customerSummary, product: productSummary, messages: lastMessage } });
  return NextResponse.json(toListRows(rows, await unreadBySender(rows.map((row) => row.id), "CUSTOMER")));
}
