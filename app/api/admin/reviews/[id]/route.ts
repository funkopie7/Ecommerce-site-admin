// app/api/admin/reviews/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { error, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const update = z.object({ status: z.enum(["PUBLISHED", "HIDDEN"]) });

/* Hiding is the everyday tool — it takes a review off the product page and
   out of the average, while leaving it here to reconsider. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  const { id } = await params;
  const parsed = update.safeParse(await request.json());
  if (!parsed.success) return error(parsed.error.issues[0].message, 400);
  try { return NextResponse.json(await prisma.review.update({ where: { id }, data: parsed.data })); } catch { return error("Review not found", 404); }
}

/* Deleting is for spam and nothing else. It also frees the one-per-customer
   slot, so a genuine customer whose review was removed can write another —
   which hiding deliberately does not. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  const { id } = await params;
  try { await prisma.review.delete({ where: { id } }); return NextResponse.json({ ok: true }); } catch { return error("Review not found", 404); }
}
