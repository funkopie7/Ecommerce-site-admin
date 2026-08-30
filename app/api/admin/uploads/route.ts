import { NextRequest, NextResponse } from "next/server";
import { error, requireAdmin } from "@/lib/api";
import { UploadError, storeImageUpload } from "@/lib/imageUploads";
import { PRODUCT_BUCKET, listImages } from "@/lib/uploads";

/* Every product photo lands here as PNG/JPEG straight off someone's camera
   or a stock download; the catalogue only ever needed the one seeded set
   converted once (prisma/seed.ts). This is that same conversion made
   self-serve: whatever comes in, a real .webp goes to Storage and out. */
export async function POST(request: NextRequest) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  try {
    return NextResponse.json({ url: await storeImageUpload(await request.formData(), PRODUCT_BUCKET) }, { status: 201 });
  } catch (caught) {
    if (caught instanceof UploadError) return error(caught.message, caught.status);
    return error(caught instanceof Error ? caught.message : "Upload failed", 500);
  }
}

/* Backs the "choose existing" picker in ImageField — every product,
   category and collection image lives in the same bucket, so whatever was
   uploaded from any one of them is pickable from all three. */
export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  try {
    return NextResponse.json(await listImages(PRODUCT_BUCKET));
  } catch (caught) {
    return error(caught instanceof Error ? caught.message : "Could not list images", 500);
  }
}
