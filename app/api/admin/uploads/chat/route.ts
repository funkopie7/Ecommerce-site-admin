import { NextRequest, NextResponse } from "next/server";
import { error, requireAdmin } from "@/lib/api";
import { UploadError, storeImageUpload } from "@/lib/imageUploads";
import { CHAT_BUCKET } from "@/lib/uploads";

/* An admin's side of a chat attachment — a photo of a packing slip, a shot of
   the shelf a figure is actually on. Same pipeline as the product route, its
   own bucket: this is one thread's evidence, not a catalogue asset, and a
   route per bucket keeps that boundary something you can read off the URL. */
export async function POST(request: NextRequest) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  try {
    return NextResponse.json({ url: await storeImageUpload(await request.formData(), CHAT_BUCKET) }, { status: 201 });
  } catch (caught) {
    if (caught instanceof UploadError) return error(caught.message, caught.status);
    return error(caught instanceof Error ? caught.message : "Upload failed", 500);
  }
}
