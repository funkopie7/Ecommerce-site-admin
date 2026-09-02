// One-time import of the old store's product export into the live catalog.
// Runs inside a real Vercel build (real DATABASE_URL/SUPABASE_* secrets are
// only ever injected there — never available to a local script, by design).
// Idempotent: skips entirely once it finds any product whose SKU carries the
// LEGACY_MARKER, so it's safe to leave wired into the build after it runs.
//
// Existing products/collections are hidden (visible: false), never deleted —
// some may be referenced by real OrderItems, and Prisma's default onDelete
// (Restrict) would fail on those anyway. Hiding removes them from the
// storefront just as effectively.
import { PrismaClient } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

const LEGACY_MARKER = "legacy-import-v1";

const CATEGORY_LABEL_MAP = {
  "animation": "Animation", "funko pop! animation": "Animation", "funko pop jumbo! animation": "Animation",
  "funko pop super! animation": "Animation", "funko pop town! animation": "Animation", "funko pop deluxe! animation": "Animation",
  "funko pop rides! animation": "Animation", "pop! animation": "Animation", "rides anime": "Animation",
  "games": "Games", "funko pop jumbo! games": "Games", "funko pop premium! games": "Games",
  "marvel": "Marvel", "plus marvel": "Marvel", "super marvel": "Marvel", "marvel studios": "Marvel",
  "funko pop deluxe! marvel": "Marvel", "funko pop premium! marvel": "Marvel", "funko pop super! marvel": "Marvel",
  "deluxe! marvel": "Marvel", "plus": "Marvel",
  "movies": "Movies", "premium movies": "Movies", "movie moment": "Movies", "funko pop moments! movies": "Movies",
  "funko pop town! movies": "Movies", "funko pop deluxe! movies": "Movies", "funko pop super! movies": "Movies",
  "funko mega sized! movies": "Movies", "rides movies": "Movies", "pop! movies": "Movies", "moment": "Movies", "rides": "Movies",
  "tv": "Television", "television": "Television", "rides television": "Television", "funko bitty boxes! tv": "Television",
  "funko pop tv": "Television", "funko pop town! tv": "Television",
  "heroes": "DC Heroes", "dc heroes": "DC Heroes", "dc comics": "DC Heroes", "dc": "DC Heroes", "town heroes": "DC Heroes",
  "disney": "Disney", "funko pop deluxe! disney": "Disney", "funko pop town! disney": "Disney", "funko pop super! disney": "Disney",
  "funko pop jumbo! disney": "Disney", "funko pop rides! disney": "Disney", "funko pop cover! disney": "Disney", "pop moment! disney": "Disney",
  "star wars": "Star Wars", "star wars ep 9": "Star Wars", "funko pop town! star wars": "Star Wars",
};

const KEYWORD_CATEGORY = [
  { category: "Star Wars", words: ["star wars", "mandalorian", "grogu", "stormtrooper", "sandtrooper", "darth vader", "skywalker"] },
  { category: "Marvel", words: ["spider-man", "spiderman", "avengers", "iron man", "deadpool", "wolverine", "x-men", "captain america", "doctor strange", "black panther", "thor", "hulk", "guardians of the galaxy", "venom"] },
  { category: "DC Heroes", words: ["batman", "superman", "supergirl", "wonder woman", "joker", "harley quinn", "flash", "aquaman", "zur-en-arrh"] },
  { category: "Disney", words: ["disney", "pixar", "stitch", "mickey", "minnie", "winnie the pooh", "frozen", "moana", "lightning mcqueen"] },
  { category: "Animation", words: ["naruto", "one piece", "dragon ball", "demon slayer", "attack on titan", "my hero academia", "death note", "chainsaw man", "jujutsu kaisen", "bleach", "sailor moon", "pokemon", "evangelion", "sword art online", "tokyo ghoul", "hunter x hunter", "one punch man", "mob psycho", "scooby-doo", "tom and jerry", "spongebob"] },
];

const OTHER_LABELS = new Set(["football", "rocks", "boxing", "formula 1", "artist series", "icons", "ad icon", "wwe", "funko wwe", "funko pop moment! wwe", "scream", "minions", "jumbo", "funko action figure", "funko"]);

function categoryFor(originalTitle, categoryLabel) {
  const normalizedLabel = categoryLabel?.toLowerCase().trim();
  if (normalizedLabel && CATEGORY_LABEL_MAP[normalizedLabel]) return CATEGORY_LABEL_MAP[normalizedLabel];
  if (normalizedLabel && OTHER_LABELS.has(normalizedLabel)) return "Other";
  const lower = originalTitle.toLowerCase();
  for (const { category, words } of KEYWORD_CATEGORY) if (words.some((w) => lower.includes(w))) return category;
  return "Movies";
}

/** Strips the vendor/pre-order noise a scraped Funko title always carries,
 * and separates out whatever Funko's own category label was (before the
 * first colon) from the actual product name. */
function parseTitle(title) {
  let name = title.replace(/^Funko\s+(Bitty\s+)?Pop!\s*/i, "").replace(/\s*\*+\s*(NEW\s+)?PRE[- ]?ORDER\s*$/i, "").trim();
  const colonIdx = name.indexOf(":");
  let categoryLabel = "";
  if (colonIdx !== -1 && colonIdx < 40) {
    categoryLabel = name.slice(0, colonIdx).trim();
    name = name.slice(colonIdx + 1).trim();
  }
  const dashIdx = name.lastIndexOf(" - ");
  const franchiseSegment = dashIdx !== -1 ? name.slice(0, dashIdx).trim() : "";
  const characterSegment = dashIdx !== -1 ? name.slice(dashIdx + 3).trim() : name;
  return { name, categoryLabel, franchise: franchiseSegment || categoryLabel || "Funko Pop!", characterSegment };
}

/** Same convention as POST /api/admin/products: first word of the name,
 * upper-cased, alphanumeric only, then the next free number for that word.
 * Skips a leading article so "The Batman of Zur-En-Arrh" doesn't SKU as THE-1. */
const ARTICLES = new Set(["THE", "A", "AN"]);
function skuWord(characterSegment) {
  const words = characterSegment.trim().split(/\s+/).map((w) => w.toUpperCase().replace(/[^A-Z0-9]/g, "")).filter(Boolean);
  const picked = words.find((w) => !ARTICLES.has(w)) ?? words[0] ?? "FIGURE";
  return picked;
}

const slugify = (value) => value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

async function uploadToSupabase(url, filename) {
  const base = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) throw new Error("Supabase storage isn't configured");
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
  const alreadyImported = await prisma.product.findFirst({ where: { sku: { startsWith: "LEGACY-MARK" } } });
  if (alreadyImported) {
    console.log("[legacy-import] marker product found — already ran, skipping.");
    return;
  }

  const items = JSON.parse(fs.readFileSync(path.join(__dirname, "legacy-catalog.json"), "utf-8"))
    .filter((item) => item.product_type !== "Gift Card");
  console.log(`[legacy-import] ${items.length} items to import`);

  // Hide (never delete) every current product/collection — see file header.
  const hiddenProducts = await prisma.product.updateMany({ where: { visible: true }, data: { visible: false } });
  const hiddenCollections = await prisma.collection.updateMany({ where: { visible: true }, data: { visible: false } });
  console.log(`[legacy-import] hid ${hiddenProducts.count} existing products, ${hiddenCollections.count} collections`);

  const categoryCache = new Map();
  async function categoryIdFor(name) {
    if (categoryCache.has(name)) return categoryCache.get(name);
    const slug = slugify(name);
    const category = await prisma.category.upsert({
      where: { slug },
      update: {},
      create: { name, slug, visible: true },
    });
    categoryCache.set(name, category.id);
    return category.id;
  }

  const skuCounters = new Map();
  const usedSlugs = new Set((await prisma.product.findMany({ select: { slug: true } })).map((p) => p.slug));

  let created = 0, imageFailures = 0;
  for (const item of items) {
    const { name, franchise, characterSegment } = parseTitle(item.title);
    const categoryName = categoryFor(item.title, parseTitle(item.title).categoryLabel);
    const categoryId = await categoryIdFor(categoryName);

    const word = skuWord(characterSegment);
    const next = (skuCounters.get(word) ?? 0) + 1;
    skuCounters.set(word, next);
    const sku = `${word}-${next}`;

    let slug = slugify(name) || slugify(item.handle) || `figure-${item.shopify_id}`;
    if (usedSlugs.has(slug)) slug = `${slug}-${item.shopify_id}`;
    usedSlugs.add(slug);

    const price = Math.round(parseFloat(item.price) * 100);
    const compareAtPrice = item.compare_at_price ? Math.round(parseFloat(item.compare_at_price) * 100) : null;
    const available = item.variants?.some((v) => v.available) ?? true;

    let imageUrl, hoverImageUrl;
    try {
      imageUrl = await uploadToSupabase(item.main_image, `legacy-${item.shopify_id}-main.png`);
      if (item.hover_image && item.hover_image !== item.main_image) {
        hoverImageUrl = await uploadToSupabase(item.hover_image, `legacy-${item.shopify_id}-hover.png`);
      }
    } catch (cause) {
      imageFailures++;
      console.warn(`[legacy-import] image failed for "${name}": ${cause instanceof Error ? cause.message : cause}`);
      continue; // skip products whose photo we couldn't secure rather than list one with no image
    }

    await prisma.product.create({
      data: {
        sku, slug, name, description: item.description || name,
        price, compareAtPrice: compareAtPrice && compareAtPrice > price ? compareAtPrice : null,
        cost: Math.round(price * 0.7),
        stockQuantity: available ? 5 : 0,
        imageUrl, hoverImageUrl,
        visible: true,
        franchise,
        categoryId,
      },
    });
    created++;
    if (created % 25 === 0) console.log(`[legacy-import] ${created}/${items.length} created…`);
  }

  // A marker product so a re-run of this same build step (or a later one,
  // since the script stays wired into the build) recognises the import
  // already happened and exits immediately instead of duplicating it.
  const markerCategory = await categoryIdFor("Other");
  await prisma.product.create({
    data: {
      sku: "LEGACY-MARK-1", slug: "legacy-import-marker", name: "Legacy import marker (hidden)",
      description: "Internal marker — do not display. Confirms the legacy catalog import has run.",
      price: 0, cost: 0, stockQuantity: 0, visible: false, categoryId: markerCategory,
    },
  });

  console.log(`[legacy-import] done — created ${created} products, ${imageFailures} skipped on image failure.`);
}

main()
  .catch((error) => { console.error("[legacy-import] failed:", error); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
