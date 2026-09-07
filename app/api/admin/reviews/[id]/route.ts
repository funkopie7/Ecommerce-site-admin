import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { error, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const update = z.object({ status: z.enum(["PUBLISHED", "HIDDEN"]) });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  const { id } = await params;
  const parsed = update.safeParse(await request.json());
  if (!parsed.success) return error(parsed.error.issues[0].message, 400);
  try { return NextResponse.json(await prisma.review.update({ where: { id }, data: parsed.data })); } catch { return error("Review not found", 404); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  const { id } = await params;
  try { await prisma.review.delete({ where: { id } }); return NextResponse.json({ ok: true }); } catch { return error("Review not found", 404); }
}
