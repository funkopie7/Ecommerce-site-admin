// app/api/admin/tags/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { error, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { TONES } from "@/lib/tags";

const tagUpdate = z.object({ code: z.string().min(2).regex(/^[A-Z0-9_]+$/, "Code must be upper-case letters, digits and underscores").optional(), label: z.string().min(2).optional(), tone: z.enum(TONES).optional() });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  const { id } = await params;
  const parsed = tagUpdate.safeParse(await request.json());
  if (!parsed.success) return error(parsed.error.issues[0].message, 400);
  try { return NextResponse.json(await prisma.tag.update({ where: { id }, data: parsed.data })); } catch { return error("Tag not found or code already in use", 409); }
}

/* Products keep any badge code pointing at the deleted tag. Stripping it from
   every `badges` array would be a whole-catalog write to fix a display detail
   the storefront already handles: an unresolved code falls back to a generic
   label and tone. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  const { id } = await params;
  try { await prisma.tag.delete({ where: { id } }); return NextResponse.json({ ok: true }); } catch { return error("Tag not found", 409); }
}
