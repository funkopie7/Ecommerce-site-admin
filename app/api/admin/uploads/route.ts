import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import sharp from "sharp";
import { error, requireAdmin } from "@/lib/api";
import { uploadProductImage } from "@/lib/uploads";

const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"];
const MAX_BYTES = 8 * 1024 * 1024;

/* Every product photo lands here as PNG/JPEG straight off someone's camera
   or a stock download; the catalogue only ever needed the one seeded set
   converted once (prisma/seed.ts). This is that same conversion made
   self-serve: whatever comes in, a real .webp goes to Storage and out. */
export async function POST(request: NextRequest) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return error("No file provided", 400);
  if (!ACCEPTED.includes(file.type)) return error("Image must be PNG, JPEG, WEBP, GIF or AVIF", 400);
  if (file.size > MAX_BYTES) return error("Image must be under 8MB", 400);
  const input = Buffer.from(await file.arrayBuffer());
  const webp = await sharp(input).webp({ quality: 82 }).toBuffer();
  const url = await uploadProductImage(webp, `${randomUUID()}.webp`, "image/webp");
  return NextResponse.json({ url }, { status: 201 });
}
