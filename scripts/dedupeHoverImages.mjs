// Some legacy-import products carry a genuinely different hoverImageUrl from
// imageUrl (so the earlier "hoverSrc === src" check on the storefront never
// caught them), but the two files are the SAME photo re-hosted under two
// different filenames — a crossfade between two pixel-identical images is
// pure visual noise. This compares actual pixel content (resized to a small
// fixed thumbnail so re-encoding noise doesn't cause false negatives) rather
// than URLs, and clears hoverImageUrl (and the matching entry in `images`)
// wherever they match.
//
// Same reasoning as the other scripts here for running inside a real
// Vercel build (real DATABASE_URL only exists there).
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

const prisma = new PrismaClient();

async function fingerprint(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`download ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  // Small + flattened onto white (in case one copy kept transparency and the
  // other didn't) so the comparison is about the picture, not the format.
  return sharp(buffer).resize(24, 24, { fit: "fill" }).flatten({ background: "#ffffff" }).raw().toBuffer();
}

function buffersMatch(a, b, tolerancePerPixel = 6) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff += Math.abs(a[i] - b[i]);
  return diff / a.length <= tolerancePerPixel;
}

async function main() {
  const candidates = await prisma.product.findMany({
    where: { hoverImageUrl: { not: null } },
    select: { id: true, name: true, imageUrl: true, hoverImageUrl: true, images: true },
  });
  console.log(`[dedupe-hover] ${candidates.length} products with a hover image to check`);

  let cleared = 0, failures = 0;
  for (const product of candidates) {
    if (!product.imageUrl || !product.hoverImageUrl) continue;
    try {
      const [mainFp, hoverFp] = await Promise.all([fingerprint(product.imageUrl), fingerprint(product.hoverImageUrl)]);
      if (!buffersMatch(mainFp, hoverFp)) continue;

      const images = product.images.filter((url) => url !== product.hoverImageUrl);
      await prisma.product.update({ where: { id: product.id }, data: { hoverImageUrl: null, images } });
      cleared++;
      if (cleared % 25 === 0) console.log(`[dedupe-hover] ${cleared} cleared…`);
    } catch (cause) {
      failures++;
      console.warn(`[dedupe-hover] failed for "${product.name}": ${cause instanceof Error ? cause.message : cause}`);
    }
  }

  console.log(`[dedupe-hover] done — ${cleared} products had a duplicate hover image cleared, ${failures} failures.`);
}

main()
  .catch((error) => { console.error("[dedupe-hover] failed:", error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
