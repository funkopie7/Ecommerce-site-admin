import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { error, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { isHexColor } from "@/lib/storeSettings";

const preset = z.object({
  name: z.string().trim().min(1, "Give the preset a name").max(60),
  heroModelUrl: z.string().url().nullable().optional(),
  heroModelName: z.string().max(120).nullable().optional(),
  heroModelRotationX: z.number().min(-360).max(360).optional(),
  heroModelRotationY: z.number().min(-360).max(360).optional(),
  heroModelRotationZ: z.number().min(-360).max(360).optional(),
  heroTintPhotoUrl: z.string().url().nullable().optional(),
  heroBoxLine: z.string().max(40),
  heroBoxNumber: z.string().max(40),
  heroBoxBanner: z.string().max(40),
  heroBoxName: z.string().max(40),
  heroBoxSubtitle: z.string().max(40),
  heroBoxCheckLight: z.string().refine(isHexColor, "Check colour must be a hex value"),
  heroBoxCheckDark: z.string().refine(isHexColor, "Check shadow must be a hex value"),
  heroBoxNumberColor: z.string().refine(isHexColor, "Figure number must be a hex value"),
});

export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  return NextResponse.json(await prisma.heroPreset.findMany({ orderBy: { name: "asc" } }));
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  const parsed = preset.safeParse(await request.json());
  if (!parsed.success) return error(parsed.error.issues[0].message, 400);
  const { name, ...values } = parsed.data;

  const saved = await prisma.heroPreset.upsert({
    where: { name },
    create: { name, ...values },
    update: values,
  });
  return NextResponse.json(saved, { status: 201 });
}
