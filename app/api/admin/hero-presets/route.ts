// app/api/admin/hero-presets/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { error, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { isHexColor } from "@/lib/storeSettings";

/* Saved hero configurations.

   Changing the figure in the hero means changing eight things at once — the
   model, five lines of packaging copy, three colours — and getting one wrong
   leaves a Jujutsu Kaisen figure in a Demon Slayer box. A preset makes that
   one click, and makes it reversible: keep the Tanjiro setup as a preset and
   you can always go back to it. */

const preset = z.object({
  name: z.string().trim().min(1, "Give the preset a name").max(60),
  heroModelUrl: z.string().url().nullable().optional(),
  heroModelName: z.string().max(120).nullable().optional(),
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

  /* Saving under an existing name overwrites it rather than failing. The
     alternative — a unique-constraint error — would mean the only way to
     update a preset is to delete it first, which loses the thing you were
     trying to amend if the save then fails. */
  const saved = await prisma.heroPreset.upsert({
    where: { name },
    create: { name, ...values },
    update: values,
  });
  return NextResponse.json(saved, { status: 201 });
}
