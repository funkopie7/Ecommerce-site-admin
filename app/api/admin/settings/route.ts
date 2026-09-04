// app/api/admin/settings/route.ts
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
  // Rejected here as well as in the form: the colour is interpolated into a
  // stylesheet on the storefront, so anything but a hex value is a way to
  // write CSS rather than pick a colour.
  accentColor: z.string().refine(isHexColor, "Enter a colour as a hex value, like #E8622A").optional(),
  heroModelUrl: z.string().url().nullable().optional(),
  heroModelName: z.string().max(120).nullable().optional(),
});

export async function PATCH(request: NextRequest) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) return error(parsed.error.issues[0].message, 400);

  const saved = await prisma.storeSettings.upsert({
    where: { id: SETTINGS_ID },
    create: { id: SETTINGS_ID, ...parsed.data },
    update: parsed.data,
    select: { accentColor: true, heroModelUrl: true, heroModelName: true },
  });
  // The storefront caches these alongside the catalogue, so a theme change
  // has to drop that cache or it would take an hour to appear.
  revalidateStorefront();
  return NextResponse.json(saved);
}
