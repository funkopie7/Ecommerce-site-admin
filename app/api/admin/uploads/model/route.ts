// app/api/admin/uploads/model/route.ts
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { error, requireAdmin } from "@/lib/api";
import { PRODUCT_BUCKET, createSignedUploadUrl } from "@/lib/uploads";

const MAX_BYTES = 12 * 1024 * 1024;
const input = z.object({ filename: z.string().min(1), size: z.number().int().nonnegative() });

export async function POST(request: NextRequest) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) return error("Invalid request", 400);
  if (!parsed.data.filename.toLowerCase().endsWith(".glb")) return error("The hero model must be a .glb file", 400);
  if (parsed.data.size > MAX_BYTES) return error("Model must be under 12MB — it loads before the homepage settles", 400);

  try {
    const { uploadUrl, publicUrl } = await createSignedUploadUrl(`models/${randomUUID()}.glb`, PRODUCT_BUCKET);
    return NextResponse.json({ uploadUrl, publicUrl }, { status: 201 });
  } catch (caught) {
    return error(caught instanceof Error ? caught.message : "Could not prepare upload", 500);
  }
}
