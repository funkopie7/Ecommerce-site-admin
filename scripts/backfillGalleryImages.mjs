// One-time backfill: populates Product.images (added after the original
// legacy-catalog import) with every distinct photo the old store's export
// had for that item — main, hover, and any genuine extras — so the
// storefront's detail-page gallery has more than one frame to show.
// Same reasoning as importLegacyCatalog.mjs for running inside a real
// Vercel build: real DATABASE_URL/SUPABASE_SERVICE_ROLE_KEY only exist
// there. Idempotent — only touches products whose `images` is still empty.
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

async function uploadToSupabase(url, filename) {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not download ${url}: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") || "image/png";
  const upload = await fetch(`${base}/storage/v1/object/product-images/${filename}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": contentType, "x-upsert": "true" },
    body: buffer,
  });
  if (!upload.ok) throw new Error(`Upload failed for ${filename}: ${(await upload.text()).slice(0, 200)}`);
  return `${base}/storage/v1/object/public/product-images/${filename}`;
}

async function main() {
  const items = JSON.parse(fs.readFileSync(path.join(__dirname, "legacy-catalog.json"), "utf-8"));
  const byShopifyId = new Map(items.map((item) => [String(item.shopify_id), item]));

  // The legacy import's uploaded filenames carry the shopify_id
  // (legacy-<id>-main.png), which is the only link back to this JSON now
  // that products are just rows — extract it straight from imageUrl.
  const candidates = await prisma.product.findMany({
    where: { images: { isEmpty: true }, imageUrl: { startsWith: "http" } },
    select: { id: true, imageUrl: true, hoverImageUrl: true },
  });
  console.log(`[gallery-backfill] ${candidates.length} products to check`);

  let updated = 0, skippedNoExtras = 0, failures = 0;
  for (const product of candidates) {
    const match = product.imageUrl?.match(/legacy-(\d+)-main\.png/);
    if (!match) continue;
    const item = byShopifyId.get(match[1]);
    if (!item) continue;

    const rawExtras = Array.isArray(item.images) ? item.images : [];
    const seen = new Set([item.main_image, item.hover_image].filter(Boolean));
    const extraUrls = rawExtras.filter((url) => url && !seen.has(url) && !url.includes("blueballoontoys.com/cdn/shop"));

    const gallery = [product.imageUrl];
    if (product.hoverImageUrl) gallery.push(product.hoverImageUrl);

    if (extraUrls.length === 0) {
      // Still worth recording main+hover as the gallery so the storefront
      // has a consistent field to read, even with nothing extra to add.
      await prisma.product.update({ where: { id: product.id }, data: { images: gallery } });
      skippedNoExtras++;
      continue;
    }

    for (let i = 0; i < extraUrls.length; i++) {
      try {
        gallery.push(await uploadToSupabase(extraUrls[i], `legacy-${match[1]}-extra-${i}.png`));
      } catch (cause) {
        failures++;
        console.warn(`[gallery-backfill] extra image failed for product ${product.id}: ${cause instanceof Error ? cause.message : cause}`);
      }
    }
    await prisma.product.update({ where: { id: product.id }, data: { images: gallery } });
    updated++;
    if (updated % 20 === 0) console.log(`[gallery-backfill] ${updated} updated…`);
  }

  console.log(`[gallery-backfill] done — ${updated} products got extra images, ${skippedNoExtras} recorded main+hover only, ${failures} extra-image failures.`);
}

main()
  .catch((error) => { console.error("[gallery-backfill] failed:", error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
