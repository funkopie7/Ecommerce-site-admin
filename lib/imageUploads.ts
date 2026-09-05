import { randomUUID } from "crypto";
import sharp from "sharp";
import { PRODUCT_BUCKET, uploadImage } from "@/lib/uploads";

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

/* The widths the storefront's image loader asks for. This list, the loader's
   copy, and next.config's deviceSizes are the same three numbers in three
   places — a width with no file behind it makes the loader fall back to the
   full-size original, which still displays but silently undoes the saving. */
const VARIANT_WIDTHS = [320, 640, 1280];

/* Generated at upload rather than per request, which is the whole reason the
   storefront needs no image-optimizer quota. Best-effort: a variant that fails
   to build or upload is logged and skipped, because the loader falls back to
   the original and a missing thumbnail must never fail the upload itself. */
async function storeVariants(source: Buffer, filename: string, bucket: string) {
  const width = (await sharp(source).metadata()).width ?? 0;
  await Promise.all(
    VARIANT_WIDTHS.map(async (target) => {
      try {
        // Never upscale: a source narrower than the target is stored as-is at
        // that slot, so the browser is never handed a blurred enlargement.
        const body = width > 0 && width <= target
          ? source
          : await sharp(source).resize({ width: target, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
        await uploadImage(body, `w${target}/${filename}`, "image/webp", bucket);
      } catch (cause) {
        console.warn(`[uploads] variant w${target} failed for ${filename}:`, cause instanceof Error ? cause.message : cause);
      }
    }),
  );
}

export async function storeImageUpload(form: FormData, bucket: string): Promise<string> {
  const file = form.get("file");
  if (!(file instanceof File)) throw new UploadError("No file provided", 400);
  if (!ACCEPTED.includes(file.type)) throw new UploadError("Image must be PNG, JPEG, WEBP, GIF or AVIF", 400);
  if (file.size > MAX_BYTES) throw new UploadError("Image must be under 8MB", 400);
  /* Capped at 1600px on the long edge before encoding. Nothing on the
     storefront ever displays a product photo larger than that — the figure
     page shows 640px, a grid card 300px, a shelf card 300px — so a 4000px
     original was pure cost: bucket space forever, and bytes over the wire that
     no layout could use. `withoutEnlargement` so a small photo is left alone
     rather than upscaled into a blurry one. */
  const webp = await sharp(Buffer.from(await file.arrayBuffer()))
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  const filename = `${randomUUID()}.webp`;
  const url = await uploadImage(webp, filename, "image/webp", bucket);
  // Only the catalogue bucket: chat attachments are never rendered through the
  // storefront's loader, so sizes for them would be storage nobody reads.
  if (bucket === PRODUCT_BUCKET) await storeVariants(webp, filename, bucket);
  return url;
}

