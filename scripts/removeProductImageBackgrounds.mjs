// One-time pass: strips the white background off every product photo
// already in Supabase storage, in place — same filename, so no Product
// row ever needs to change. Matches the arch-cut card treatment the
// storefront already draws around figure photos (see .figureCut in
// home.css): a photo that still carries its own white square reads as a
// rectangle behind the mask, not a real cutout.
//
// Same reasoning as the other scripts here for running inside a real
// Vercel build (real SUPABASE_SERVICE_ROLE_KEY only exists there).
// Idempotent by content, not a marker: a photo that already has an alpha
// channel is skipped, so a second run of this step is a fast no-op.
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

const prisma = new PrismaClient();

/* Flood-fill from the image border: only pixels reachable from the edge
   while staying near-white become transparent, so an enclosed near-white
   region (a white sleeve, a highlight) survives untouched — the same
   technique used on the storefront's own mascot art. */
async function removeWhiteBackground(buffer, threshold = 26) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const isBackground = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);
  const idx = (x, y) => (y * width + x) * channels;
  const isNearWhite = (i) => (255 - data[i]) + (255 - data[i + 1]) + (255 - data[i + 2]) <= threshold * 3;

  const stack = [];
  for (let x = 0; x < width; x++) stack.push([x, 0], [x, height - 1]);
  for (let y = 0; y < height; y++) stack.push([0, y], [width - 1, y]);

  while (stack.length) {
    const [x, y] = stack.pop();
    const p = y * width + x;
    if (visited[p]) continue;
    visited[p] = 1;
    const i = idx(x, y);
    if (!isNearWhite(i)) continue;
    isBackground[p] = 1;
    if (x > 0) stack.push([x - 1, y]);
    if (x < width - 1) stack.push([x + 1, y]);
    if (y > 0) stack.push([x, y - 1]);
    if (y < height - 1) stack.push([x, y + 1]);
  }

  for (let p = 0; p < width * height; p++) if (isBackground[p]) data[p * channels + 3] = 0;
  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

function bucketFilename(url) {
  const match = url.match(/\/object\/public\/product-images\/([^?]+)/);
  return match ? match[1] : null;
}

async function main() {
  const products = await prisma.product.findMany({ select: { imageUrl: true, hoverImageUrl: true, images: true } });
  const urls = new Set();
  for (const p of products) {
    if (p.imageUrl) urls.add(p.imageUrl);
    if (p.hoverImageUrl) urls.add(p.hoverImageUrl);
    for (const url of p.images) urls.add(url);
  }
  const targets = [...urls].map((url) => ({ url, filename: bucketFilename(url) })).filter((t) => t.filename);
  console.log(`[bg-removal] ${targets.length} image URLs to check`);

  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let processed = 0, skippedAlready = 0, failures = 0;

  for (const { url, filename } of targets) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`download ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      const meta = await sharp(buffer).metadata();
      if (meta.hasAlpha) { skippedAlready++; continue; }

      const cleaned = await removeWhiteBackground(buffer);
      const upload = await fetch(`${base}/storage/v1/object/product-images/${filename}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "image/png", "x-upsert": "true" },
        body: cleaned,
      });
      if (!upload.ok) throw new Error(`upload ${upload.status}: ${(await upload.text()).slice(0, 150)}`);
      processed++;
      if (processed % 50 === 0) console.log(`[bg-removal] ${processed} processed…`);
    } catch (cause) {
      failures++;
      console.warn(`[bg-removal] failed for ${filename}: ${cause instanceof Error ? cause.message : cause}`);
    }
  }

  console.log(`[bg-removal] done — ${processed} backgrounds removed, ${skippedAlready} already had alpha, ${failures} failures.`);
}

main()
  .catch((error) => { console.error("[bg-removal] failed:", error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
