// Strips the background off every product photo in Supabase storage, in
// place — same filename, so no Product row ever changes. Matches the
// arch-cut card treatment the storefront draws around figure photos (see
// .figureCut in home.css): a photo that still carries its own solid-colour
// square reads as a rectangle behind the mask, not a real cutout.
//
// Same reasoning as the other scripts here for running inside a real
// Vercel build (real SUPABASE_SERVICE_ROLE_KEY only exists there).
//
// v2: the first pass only stripped backgrounds close to pure white and
// skipped anything that already had an alpha channel — but "has an alpha
// channel" isn't the same as "background is actually transparent" (a lot
// of the source exports are fully-opaque RGBA, alpha=255 everywhere), and
// several photos have a light GREY background instead of white. This pass
// samples the photo's own corner pixels as the background reference colour
// (whatever it actually is) instead of assuming white, and decides whether
// to process a photo by checking if its border is ALREADY transparent
// rather than trusting the presence of an alpha channel.
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

const prisma = new PrismaClient();

/* Flood-fill from the image border: only pixels reachable from the edge
   while staying close to the sampled background colour become transparent,
   so an enclosed similarly-coloured region (a white sleeve, a highlight)
   survives untouched. */
async function removeBackground(buffer, threshold = 34) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const idx = (x, y) => (y * width + x) * channels;

  // Reference colour: average of the four corners, which is almost always
  // clean background on a product-box photo.
  const corners = [idx(0, 0), idx(width - 1, 0), idx(0, height - 1), idx(width - 1, height - 1)];
  const ref = [0, 0, 0];
  for (const c of corners) { ref[0] += data[c]; ref[1] += data[c + 1]; ref[2] += data[c + 2]; }
  ref[0] /= 4; ref[1] /= 4; ref[2] /= 4;

  const isBackground = new Uint8Array(width * height);
  const visited = new Uint8Array(width * height);
  const isNearRef = (i) => Math.abs(data[i] - ref[0]) + Math.abs(data[i + 1] - ref[1]) + Math.abs(data[i + 2] - ref[2]) <= threshold * 3;

  const stack = [];
  for (let x = 0; x < width; x++) stack.push([x, 0], [x, height - 1]);
  for (let y = 0; y < height; y++) stack.push([0, y], [width - 1, y]);

  while (stack.length) {
    const [x, y] = stack.pop();
    const p = y * width + x;
    if (visited[p]) continue;
    visited[p] = 1;
    const i = idx(x, y);
    if (!isNearRef(i)) continue;
    isBackground[p] = 1;
    if (x > 0) stack.push([x - 1, y]);
    if (x < width - 1) stack.push([x + 1, y]);
    if (y > 0) stack.push([x, y - 1]);
    if (y < height - 1) stack.push([x, y + 1]);
  }

  for (let p = 0; p < width * height; p++) if (isBackground[p]) data[p * channels + 3] = 0;
  return sharp(data, { raw: { width, height, channels } }).png().toBuffer();
}

/* A photo already correctly processed has a mostly-transparent border —
   check a sample of border pixels' actual alpha rather than trusting the
   PNG format's mere presence of a channel. */
async function borderAlreadyTransparent(buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const samples = [
    [0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1],
    [Math.floor(width / 2), 0], [Math.floor(width / 2), height - 1],
    [0, Math.floor(height / 2)], [width - 1, Math.floor(height / 2)],
  ];
  let transparentCount = 0;
  for (const [x, y] of samples) {
    const alpha = data[(y * width + x) * channels + 3];
    if (alpha < 15) transparentCount++;
  }
  return transparentCount >= samples.length - 1; // allow one noisy sample
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
  console.log(`[bg-removal-v2] ${targets.length} image URLs to check`);

  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let processed = 0, skippedAlready = 0, failures = 0;

  for (const { url, filename } of targets) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`download ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      if (await borderAlreadyTransparent(buffer)) { skippedAlready++; continue; }

      const cleaned = await removeBackground(buffer);
      const upload = await fetch(`${base}/storage/v1/object/product-images/${filename}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "image/png", "x-upsert": "true" },
        body: cleaned,
      });
      if (!upload.ok) throw new Error(`upload ${upload.status}: ${(await upload.text()).slice(0, 150)}`);
      processed++;
      if (processed % 50 === 0) console.log(`[bg-removal-v2] ${processed} processed…`);
    } catch (cause) {
      failures++;
      console.warn(`[bg-removal-v2] failed for ${filename}: ${cause instanceof Error ? cause.message : cause}`);
    }
  }

  console.log(`[bg-removal-v2] done — ${processed} backgrounds removed, ${skippedAlready} already transparent, ${failures} failures.`);
}

main()
  .catch((error) => { console.error("[bg-removal-v2] failed:", error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
