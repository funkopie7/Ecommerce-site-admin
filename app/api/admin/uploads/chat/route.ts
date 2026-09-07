import { NextRequest, NextResponse } from "next/server";
import { error, requireAdmin } from "@/lib/api";
import { UploadError, storeImageUpload } from "@/lib/imageUploads";
import { CHAT_BUCKET } from "@/lib/uploads";

export async function POST(request: NextRequest) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  try {
    return NextResponse.json({ url: await storeImageUpload(await request.formData(), CHAT_BUCKET) }, { status: 201 });
  } catch (caught) {
    if (caught instanceof UploadError) return error(caught.message, caught.status);
    return error(caught instanceof Error ? caught.message : "Upload failed", 500);
  }
}
