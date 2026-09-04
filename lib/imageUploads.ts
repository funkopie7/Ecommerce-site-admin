import { randomUUID } from "crypto";
import sharp from "sharp";
import { uploadImage } from "@/lib/uploads";

/* The shared half of every image upload in this app: whatever comes off a
   camera, a phone or a stock download is validated, re-encoded to a real .webp
   and handed to Storage. Three routes need exactly this and differ only in who
   is allowed to call them and which bucket the file lands in, so the pipeline
   lives here and the routes stay a gate plus one call.

   It lives apart from lib/uploads.ts (the raw Storage PUT) so a route test can
   mock the network hop while still exercising this validation for real. */

const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"];
const MAX_BYTES = 8 * 1024 * 1024;

/** A rejection the caller should surface verbatim, with the status to send. */
export class UploadError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function storeImageUpload(form: FormData, bucket: string): Promise<string> {
  const file = form.get("file");
  if (!(file instanceof File)) throw new UploadError("No file provided", 400);
  if (!ACCEPTED.includes(file.type)) throw new UploadError("Image must be PNG, JPEG, WEBP, GIF or AVIF", 400);
  if (file.size > MAX_BYTES) throw new UploadError("Image must be under 8MB", 400);
  /* Capped at 1600px on the long edge before encoding. Nothing on the
     storefront ever displays a product photo larger than that — the figure
     page shows 640px, a grid card 300px, a shelf card 300px — and next/image
     resizes for display anyway, so a 4000px original was pure cost: bucket
     space forever, and a slow first render while the optimizer ground it down.
     `withoutEnlargement` so a small photo is left alone rather than upscaled
     into a blurry one. */
  const webp = await sharp(Buffer.from(await file.arrayBuffer()))
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  return uploadImage(webp, `${randomUUID()}.webp`, "image/webp", bucket);
}
