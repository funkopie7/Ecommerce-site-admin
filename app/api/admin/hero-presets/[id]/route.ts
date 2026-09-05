// app/api/admin/hero-presets/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { error, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";

/* Deleting a preset never touches the live hero. A preset is a snapshot, not
   a reference — if it were a reference, removing one would blank the shop. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  const { id } = await params;
  try {
    await prisma.heroPreset.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return error("Preset not found", 404);
  }
}
