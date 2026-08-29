import { NextRequest, NextResponse } from "next/server";
import { customerFromRequest } from "@/lib/auth";
import { error } from "@/lib/api";
import { UploadError, storeImageUpload } from "@/lib/imageUploads";
import { CHAT_BUCKET } from "@/lib/uploads";

/* A shopper attaching a photo to a support chat — "this is how it arrived",
   "is this the variant I ordered?". Signed-in only and capped at the same 8MB
   as the admin pipeline, and it re-encodes to .webp like everything else, so
   whatever a phone exports is what the thread can carry.

   The returned URL is what the message routes then accept as `imageUrl`; the
   upload is deliberately a separate step so a slow photo never blocks the
   text of a message that was already typed. */
export async function POST(request: NextRequest) {
  if (!(await customerFromRequest(request))) return error("Sign in required", 401);
  try {
    return NextResponse.json({ url: await storeImageUpload(await request.formData(), CHAT_BUCKET) }, { status: 201 });
  } catch (caught) {
    if (caught instanceof UploadError) return error(caught.message, caught.status);
    return error(caught instanceof Error ? caught.message : "Upload failed", 500);
  }
}
