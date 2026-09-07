import { NextRequest, NextResponse } from "next/server";
import { error, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";

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
