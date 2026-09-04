// app/api/admin/uploads/model/route.ts
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { error, requireAdmin } from "@/lib/api";
import { PRODUCT_BUCKET, uploadImage } from "@/lib/uploads";

/* A .glb for the homepage hero.

   Deliberately not routed through storeImageUpload: that pipeline re-encodes
   whatever it receives to WebP, which for a 3D model would produce a file that
   uploads cleanly and then fails to load. A model is stored byte-for-byte.

   Same bucket as the images. A second bucket would need its own public-read
   policy and its own place in the Mumbai storage migration, for one file that
   changes about as often as the shop's logo.

   The size cap is well above the current model (176 KB) and well below what
   would make the homepage unusable on a phone: a hero model is downloaded by
   every first-time visitor before the page settles, so this is a budget, not
   just a guard against abuse. */

const MAX_BYTES = 12 * 1024 * 1024;
const ACCEPTED = ["model/gltf-binary", "application/octet-stream", ""];

export async function POST(request: NextRequest) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);

  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return error("No file provided", 400);

  /* Checked on the filename, not only the MIME type: browsers report .glb
     inconsistently — Chrome sends model/gltf-binary, others send
     application/octet-stream or nothing at all — so the type alone would
     reject valid uploads. */
  if (!file.name.toLowerCase().endsWith(".glb")) return error("The hero model must be a .glb file", 400);
  if (!ACCEPTED.includes(file.type)) return error("That doesn't look like a .glb file", 400);
  if (file.size > MAX_BYTES) return error("Model must be under 12MB — it loads before the homepage settles", 400);

  try {
    const url = await uploadImage(
      Buffer.from(await file.arrayBuffer()),
      `models/${randomUUID()}.glb`,
      "model/gltf-binary",
      PRODUCT_BUCKET,
    );
    return NextResponse.json({ url, name: file.name }, { status: 201 });
  } catch (caught) {
    return error(caught instanceof Error ? caught.message : "Upload failed", 500);
  }
}
