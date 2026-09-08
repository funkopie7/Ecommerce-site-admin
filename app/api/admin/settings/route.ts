import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { error, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { getStoreSettings, isHexColor, SETTINGS_ID } from "@/lib/storeSettings";
import { revalidateStorefront } from "@/lib/revalidateStorefront";

export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  return NextResponse.json(await getStoreSettings());
}

const input = z.object({
  accentColor: z.string().refine(isHexColor, "Enter a colour as a hex value, like #E8622A").optional(),
  secondaryColor: z.string().refine(isHexColor, "Enter a colour as a hex value, like #6E8CA0").nullable().optional(),
  secondaryTextColor: z.string().refine(isHexColor, "Enter a colour as a hex value, like #FFFFFF").nullable().optional(),
  heroModelUrl: z.string().url().nullable().optional(),
  heroModelName: z.string().max(120).nullable().optional(),
  heroModelRotationX: z.number().min(-360).max(360).optional(),
  heroModelRotationY: z.number().min(-360).max(360).optional(),
  heroModelRotationZ: z.number().min(-360).max(360).optional(),
  heroTintPhotoUrl: z.string().url().nullable().optional(),
  heroBoxLine: z.string().max(40).optional(),
  heroBoxNumber: z.string().max(40).optional(),
  heroBoxBanner: z.string().max(40).optional(),
  heroBoxName: z.string().max(40).optional(),
  heroBoxSubtitle: z.string().max(40).optional(),
  heroBoxCheckLight: z.string().refine(isHexColor, "Enter a colour as a hex value").optional(),
  heroBoxCheckDark: z.string().refine(isHexColor, "Enter a colour as a hex value").optional(),
  heroBoxNumberColor: z.string().refine(isHexColor, "Enter a colour as a hex value").optional(),

});

export async function PATCH(request: NextRequest) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) return error(parsed.error.issues[0].message, 400);

  const saved = await prisma.storeSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...parsed.data },
    update: parsed.data,
    select: { accentColor: true, secondaryColor: true, secondaryTextColor: true, heroModelUrl: true, heroModelName: true, heroModelRotationX: true, heroModelRotationY: true, heroModelRotationZ: true, heroTintPhotoUrl: true, heroBoxLine: true, heroBoxNumber: true, heroBoxBanner: true, heroBoxName: true, heroBoxSubtitle: true, heroBoxCheckLight: true, heroBoxCheckDark: true, heroBoxNumberColor: true },
  });
  revalidateStorefront();
  return NextResponse.json(saved);
}
