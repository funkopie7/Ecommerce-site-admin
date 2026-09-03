// Strips the background off every product photo in Supabase storage, in
// place — same filename, so no Product row ever changes. Matches the
// arch-cut card treatment the storefront draws around figure photos (see
// .figureCut in home.css): a photo that still carries its own solid-colour
// square reads as a rectangle behind the mask, not a real cutout.
//
// Same reasoning as the other scripts here for running inside a real
// Vercel build (real SUPABASE_SERVICE_ROLE_KEY only exists there).
//
// v1 stripped only near-pure-white, and skipped any photo that merely HAD an
// alpha channel — which is not the same as having a transparent background,
// since most of these exports are fully-opaque RGBA.
//
// v2 fixed that by sampling the photo's own four CORNER pixels as the
// background reference colour and testing real border alpha instead. That
// worked on untouched photos and broke on half-done ones: once v1 had
// cleared a photo's left and right margins, its corners were transparent, so
// v2 averaged the RGB of transparent pixels — garbage, usually black — and
// nothing matched it. The fill quit immediately and a white band across the
// top and bottom survived. ~13% of the library is in that state: corners
// clear, a third of the border still opaque pure white.
//
// v3 fixes both halves of that:
//   * the reference colour is the MEDIAN of the border pixels that are still
//     OPAQUE (transparent ones carry no colour worth averaging), so a
//     part-cleared photo still reports the white it actually has;
//   * the fill travels THROUGH already-transparent pixels, so background
//     walled off from the edge by an earlier pass's margins is still
//     reachable. v2 could only ever start from a solid edge.
// Enclosed regions with no path to the border are still left alone — that's
// what keeps a white shirt or a highlight from being punched out — and a
// fill that would clear almost everything is treated as a misfire and
// skipped rather than trusted.
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

const prisma = new PrismaClient();

const TRANSPARENT = 20; // alpha at or below this is already background
const OPAQUE = 200; // alpha at or above this is real, drawn pixel
// Manhattan distance across RGB. Roomy enough for JPEG mush and the light
// greys some exports use, tight enough not to swallow pale product art.
const SAMPLED_TOLERANCE = 100;
// Used only when the border gives us nothing to sample and we fall back to
// assuming white — much stricter, since it's a guess rather than a reading.
const ASSUMED_TOLERANCE = 60;

function medianChannel(values) {
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)];
}

/* Walks every border pixel, keeps the ones still drawn, and reports the
   median colour among them. Median rather than mean so a product that bleeds
   off one edge can't drag the reference away from the real background. */
function sampleBorderColour(data, width, height, channels) {
  const reds = [], greens = [], blues = [];
  const at = (x, y) => (y * width + x) * channels;
  const consider = (x, y) => {
    const i = at(x, y);
    if (data[i + 3] < OPAQUE) return;
    reds.push(data[i]); greens.push(data[i + 1]); blues.push(data[i + 2]);
  };
  for (let x = 0; x < width; x++) { consider(x, 0); consider(x, height - 1); }
  for (let y = 0; y < height; y++) { consider(0, y); consider(width - 1, y); }
  if (reds.length < 24) return null; // not enough border left to read
  return [medianChannel(reds), medianChannel(greens), medianChannel(blues)];
}

export async function removeBackground(buffer) {
  const { data, info } = await sharp(buffer).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const pixels = width * height;

  const sampled = sampleBorderColour(data, width, height, channels);
  const reference = sampled ?? [255, 255, 255];
  const tolerance = sampled ? SAMPLED_TOLERANCE : ASSUMED_TOLERANCE;

  const near = (i) =>
    Math.abs(data[i] - reference[0]) + Math.abs(data[i + 1] - reference[1]) + Math.abs(data[i + 2] - reference[2]) <= tolerance;

  const visited = new Uint8Array(pixels);
  const clear = new Uint8Array(pixels);
  /* Pixel indices, not [x, y] pairs — at 2048² that's four million entries
     and a stack of little arrays is enough to exhaust the heap. */
  const stack = new Int32Array(pixels);
  let top = 0;
  const push = (p) => { if (!visited[p]) { visited[p] = 1; stack[top++] = p; } };

  for (let x = 0; x < width; x++) { push(x); push((height - 1) * width + x); }
  for (let y = 0; y < height; y++) { push(y * width); push(y * width + width - 1); }

  let cleared = 0;
  while (top > 0) {
    const p = stack[--top];
    const i = p * channels;
    const alpha = data[i + 3];
    // Passable either because it's already background, or because it's drawn
    // in the background's own colour — only the latter needs clearing.
    if (alpha > TRANSPARENT) {
      if (!near(i)) continue;
      clear[p] = 1;
      cleared++;
    }
    const x = p % width, y = (p / width) | 0;
    if (x > 0) push(p - 1);
    if (x < width - 1) push(p + 1);
    if (y > 0) push(p - width);
    if (y < height - 1) push(p + width);
  }

  if (cleared === 0) return null; // nothing to do — don't churn the file

  /* A fill this large means the reference colour matched the product itself,
     not its backdrop. Leave the photo alone rather than upload a hole. */
  let drawn = 0;
  for (let p = 0; p < pixels; p++) if (data[p * channels + 3] > TRANSPARENT) drawn++;
  if (cleared > drawn * 0.92) return null;

  for (let p = 0; p < pixels; p++) if (clear[p]) data[p * channels + 3] = 0;
  return { buffer: await sharp(data, { raw: { width, height, channels } }).png().toBuffer(), cleared, reference };
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
  console.log(`[bg-removal-v3] ${targets.length} image URLs to check`);

  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  let processed = 0, alreadyClean = 0, failures = 0;

  async function handle({ url, filename }) {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`download ${response.status}`);
      const buffer = Buffer.from(await response.arrayBuffer());

      const result = await removeBackground(buffer);
      if (!result) { alreadyClean++; return; }

      const upload = await fetch(`${base}/storage/v1/object/product-images/${filename}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "image/png", "x-upsert": "true" },
        body: result.buffer,
      });
      if (!upload.ok) throw new Error(`upload ${upload.status}: ${(await upload.text()).slice(0, 150)}`);
      processed++;
      if (processed % 25 === 0) console.log(`[bg-removal-v3] ${processed} cleaned…`);
    } catch (cause) {
      failures++;
      console.warn(`[bg-removal-v3] failed for ${filename}: ${cause instanceof Error ? cause.message : cause}`);
    }
  }

  /* A thousand photos one at a time is a download and a full-resolution
     decode each — comfortably longer than a build is allowed to take. Six at
     once keeps the network busy without handing sharp more large bitmaps
     than the builder's memory wants to hold at once. */
  const CONCURRENCY = 6;
  let cursor = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (cursor < targets.length) await handle(targets[cursor++]);
    }),
  );

  console.log(`[bg-removal-v3] done — ${processed} cleaned, ${alreadyClean} already clean, ${failures} failures.`);
}

/* Only sweep the bucket when this file is the thing being run. Importing it
   (to exercise removeBackground against a handful of real photos before
   letting it loose on a thousand of them, say) shouldn't start rewriting
   production storage as a side effect. */
const runDirectly = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href;
if (runDirectly) {
  main()
    .catch((error) => { console.error("[bg-removal-v3] failed:", error); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
