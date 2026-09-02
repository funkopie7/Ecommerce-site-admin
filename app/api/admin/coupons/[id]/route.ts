import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { error, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const couponUpdate = z.object({
  code: z.string().min(2).regex(/^[A-Z0-9_-]+$/, "Code must be upper-case letters, digits, underscores or hyphens").optional(),
  type: z.enum(["PERCENT", "FIXED"]).optional(),
  value: z.number().int().positive().optional(),
  active: z.boolean().optional(),
  maxUses: z.number().int().positive().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  const { id } = await params;
  const parsed = couponUpdate.safeParse(await request.json());
  if (!parsed.success) return error(parsed.error.issues[0].message, 400);

  const { code, type, active, maxUses, expiresAt, value } = parsed.data;
  if (type === "PERCENT" && value !== undefined && value > 100) return error("A percent-off coupon can't exceed 100%", 400);

  const data: Record<string, unknown> = { active, maxUses };
  if (code) data.code = code.toUpperCase();
  if (type) data.type = type;
  if (expiresAt !== undefined) data.expiresAt = expiresAt ? new Date(expiresAt) : null;
  if (value !== undefined) {
    // A bare value update needs to know which type it's being stored under —
    // fetch the current type when the caller isn't also changing it.
    const currentType = type ?? (await prisma.coupon.findUnique({ where: { id }, select: { type: true } }))?.type;
    data.value = currentType === "FIXED" ? Math.round(value * 100) : value;
  }

  try { return NextResponse.json(await prisma.coupon.update({ where: { id }, data })); }
  catch { return error("Coupon not found or code already in use", 409); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  const { id } = await params;
  try { await prisma.coupon.delete({ where: { id } }); return NextResponse.json({ ok: true }); }
  catch { return error("Coupon not found", 409); }
}
