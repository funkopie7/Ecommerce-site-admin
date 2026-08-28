// app/api/admin/categories/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { error, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const categoryUpdate = z.object({ name: z.string().min(2).optional(), slug: z.string().min(2).optional(), description: z.string().optional(), imageUrl: z.string().url().optional(), visible: z.boolean().optional() });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  const { id } = await params;
  const parsed = categoryUpdate.safeParse(await request.json());
  if (!parsed.success) return error(parsed.error.issues[0].message, 400);
  try { return NextResponse.json(await prisma.category.update({ where: { id }, data: parsed.data })); } catch { return error("Category not found or name/slug already in use", 409); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  const { id } = await params;
  try { await prisma.category.delete({ where: { id } }); return NextResponse.json({ ok: true }); } catch { return error("Move or delete this collection's products first", 409); }
}
