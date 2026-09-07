import { randomUUID } from "crypto";
import sharp from "sharp";
import { PRODUCT_BUCKET, uploadImage } from "@/lib/uploads";

const ACCEPTED = ["image/png", "image/jpeg", "image/webp", "image/gif", "image/avif"];
const MAX_BYTES = 8 * 1024 * 1024;

export class UploadError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const VARIANT_WIDTHS = [320, 640, 1280];

async function storeVariants(source: Buffer, filename: string, bucket: string) {
  const width = (await sharp(source).metadata()).width ?? 0;
  await Promise.all(
    VARIANT_WIDTHS.map(async (target) => {
      try {
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
  const webp = await sharp(Buffer.from(await file.arrayBuffer()))
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();

  const filename = `${randomUUID()}.webp`;
  const url = await uploadImage(webp, filename, "image/webp", bucket);
  if (bucket === PRODUCT_BUCKET) await storeVariants(webp, filename, bucket);
  return url;
}

