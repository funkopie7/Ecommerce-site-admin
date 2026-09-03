// Moves product/chat images off the original us-east-1 Supabase project and
// onto the Mumbai one, converting PNG to WebP on the way, then repoints every
// URL in the database at the new home.
//
// Why bother, given Vercel's image optimizer already edge-caches every
// variant and origin location barely touches what a visitor waits for:
//   * it retires the old project. Until the images move, that project can
//     never be deleted, and deleting it from Vercel's Storage tab (an
//     innocuous-looking action) would take all 1,138 images with it.
//   * the sources are ~1 MB PNGs averaged across 1,138 files. At WebP q90
//     they measure ~8% of that, so 1,153 MB becomes roughly 90 MB — which is
//     the difference between not fitting the free tier's 1 GB and fitting it
//     ten times over. It also makes the optimizer's first fetch of any
//     uncached variant much quicker.
// alphaQuality 100 keeps the alpha channel lossless: these photos have had
// their backgrounds cut out, so they carry hard transparency edges that lossy
// alpha would fringe.
//
// Ordering is the safety property. Copy and verify EVERYTHING first, and only
// rewrite database URLs once the destination is known-complete — so a failure
// partway leaves the site still pointing at the intact original bucket.
// Re-runnable: objects already at the destination are skipped.
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

const prisma = new PrismaClient();

const OLD_URL = process.env.SUPABASE_URL;
const OLD_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const NEW_URL = process.env.MUMBAI_SUPABASE_URL;
const NEW_KEY = process.env.MUMBAI_SUPABASE_SERVICE_ROLE_KEY;
const BUCKETS = ["product-images", "chat-images"];
const CONCURRENCY = 8;

const authed = (key, extra = {}) => ({ Authorization: `Bearer ${key}`, apikey: key, ...extra });

async function ensureBucket(bucket) {
  const response = await fetch(`${NEW_URL}/storage/v1/bucket`, {
    method: "POST",
    headers: authed(NEW_KEY, { "Content-Type": "application/json" }),
    body: JSON.stringify({ id: bucket, name: bucket, public: true }),
  });
  // Already there is the normal case on a re-run, not a failure.
  if (response.ok || response.status === 409) return;
  const body = await response.text();
  if (body.includes("already exists")) return;
  throw new Error(`create bucket ${bucket}: ${response.status} ${body.slice(0, 200)}`);
}

/* The storage list endpoint pages at 100 by default and won't hand back more
   than it feels like, so this walks it until a page comes back short. */
async function listAll(base, key, bucket) {
  const names = [];
  for (let offset = 0; ; offset += 100) {
    const response = await fetch(`${base}/storage/v1/object/list/${bucket}`, {
      method: "POST",
      headers: authed(key, { "Content-Type": "application/json" }),
      body: JSON.stringify({ prefix: "", limit: 100, offset }),
    });
    if (!response.ok) throw new Error(`list ${bucket}: ${response.status}`);
    const page = await response.json();
    for (const entry of page) if (entry.name) names.push(entry.name);
    if (page.length < 100) return names;
  }
}

const webpName = (name) => name.replace(/\.png$/i, ".webp");

async function copyOne(bucket, name, destNames) {
  const target = /\.png$/i.test(name) ? webpName(name) : name;
  if (destNames.has(target)) return { skipped: true, target };

  const download = await fetch(`${OLD_URL}/storage/v1/object/public/${bucket}/${encodeURIComponent(name)}`);
  if (!download.ok) throw new Error(`download ${name}: ${download.status}`);
  const original = Buffer.from(await download.arrayBuffer());

  let body = original;
  let contentType = download.headers.get("content-type") || "application/octet-stream";
  if (/\.png$/i.test(name)) {
    body = await sharp(original).webp({ quality: 90, alphaQuality: 100, effort: 5 }).toBuffer();
    contentType = "image/webp";
  }

  const upload = await fetch(`${NEW_URL}/storage/v1/object/${bucket}/${encodeURIComponent(target)}`, {
    method: "POST",
    headers: authed(NEW_KEY, { "Content-Type": contentType, "x-upsert": "true" }),
    body,
  });
  if (!upload.ok) throw new Error(`upload ${target}: ${upload.status} ${(await upload.text()).slice(0, 150)}`);
  return { skipped: false, target, before: original.length, after: body.length };
}

async function runPool(items, worker) {
  let cursor = 0;
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < items.length) await worker(items[cursor++]);
  }));
}

async function main() {
  for (const required of [OLD_URL, OLD_KEY, NEW_URL, NEW_KEY]) {
    if (!required) throw new Error("missing SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY or MUMBAI_ equivalents");
  }
  if (OLD_URL === NEW_URL) throw new Error("source and destination are the same project — refusing to run");

  let copied = 0, skipped = 0, failed = 0, bytesBefore = 0, bytesAfter = 0;
  const expected = {};

  for (const bucket of BUCKETS) {
    await ensureBucket(bucket);
    const source = await listAll(OLD_URL, OLD_KEY, bucket);
    const destNames = new Set(await listAll(NEW_URL, NEW_KEY, bucket));
    expected[bucket] = source.length;
    console.log(`[storage-move] ${bucket}: ${source.length} at source, ${destNames.size} already at destination`);

    await runPool(source, async (name) => {
      try {
        const result = await copyOne(bucket, name, destNames);
        if (result.skipped) { skipped++; return; }
        copied++;
        bytesBefore += result.before; bytesAfter += result.after;
        if (copied % 100 === 0) console.log(`[storage-move] ${copied} copied…`);
      } catch (cause) {
        failed++;
        console.warn(`[storage-move] FAILED ${bucket}/${name}: ${cause instanceof Error ? cause.message : cause}`);
      }
    });
  }

  const mb = (n) => `${(n / 1048576).toFixed(0)} MB`;
  console.log(`[storage-move] copied ${copied}, skipped ${skipped}, failed ${failed}` +
    (copied ? ` — ${mb(bytesBefore)} of PNG became ${mb(bytesAfter)} of WebP (${(100 * bytesAfter / bytesBefore).toFixed(0)}%)` : ""));

  if (failed > 0) throw new Error(`${failed} objects failed to copy — leaving database URLs pointed at the original bucket`);

  // Only now is the destination trustworthy enough to point the site at it.
  for (const bucket of BUCKETS) {
    const landed = (await listAll(NEW_URL, NEW_KEY, bucket)).length;
    if (landed < expected[bucket]) throw new Error(`${bucket}: ${landed} at destination but ${expected[bucket]} expected — not rewriting URLs`);
    console.log(`[storage-move] verified ${bucket}: ${landed} objects at destination`);
  }

  const oldHost = new URL(OLD_URL).host;
  const newHost = new URL(NEW_URL).host;
  console.log(`[storage-move] repointing URLs ${oldHost} -> ${newHost}`);

  /* Anchored to the end of the string: only the extension becomes .webp, so a
     filename that happens to contain ".png" earlier survives intact. Both
     updates run in one transaction — a half-repointed catalogue would show
     some products' images and not others. */
  const swap = (column) => `regexp_replace(replace(${column}, $1, $2), '\\.png$', '.webp')`;
  const [products, hovers, galleries, collections] = await prisma.$transaction([
    prisma.$executeRawUnsafe(`update "Product" set "imageUrl" = ${swap('"imageUrl"')} where "imageUrl" like '%' || $1 || '%'`, oldHost, newHost),
    prisma.$executeRawUnsafe(`update "Product" set "hoverImageUrl" = ${swap('"hoverImageUrl"')} where "hoverImageUrl" like '%' || $1 || '%'`, oldHost, newHost),
    prisma.$executeRawUnsafe(`update "Product" set "images" = array(select ${swap("u")} from unnest("images") u) where array_to_string("images", ',') like '%' || $1 || '%'`, oldHost, newHost),
    prisma.$executeRawUnsafe(`update "Collection" set "imageUrl" = ${swap('"imageUrl"')} where "imageUrl" like '%' || $1 || '%'`, oldHost, newHost),
  ]);

  console.log(`[storage-move] rewrote imageUrl=${products} hoverImageUrl=${hovers} images[]=${galleries} collections=${collections}`);
  const left = await prisma.product.count({ where: { OR: [{ imageUrl: { contains: oldHost } }, { hoverImageUrl: { contains: oldHost } }] } });
  console.log(`[storage-move] done — ${left} product rows still referencing the old host (expect 0).`);
}

const runDirectly = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href;
if (runDirectly) {
  main()
    .catch((error) => { console.error("[storage-move] failed:", error); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
}
