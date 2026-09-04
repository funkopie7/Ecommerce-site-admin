import type { Prisma } from "@prisma/client";

/* What the public catalogue is allowed to say about a product.

   This exists because `include: { category: true }` on a Product returns every
   column, and one of them is `cost` — the wholesale price the shop pays. That
   was being served to anyone who fetched /api/catalog/products, which hands a
   competitor the exact margin on every item in the catalogue. The storefront
   never read the field; it was pure leakage.

   An allow-list rather than an omit-list, so a column added to the model later
   is private until someone deliberately publishes it. */
export const publicProductSelect = {
  id: true,
  sku: true,
  slug: true,
  name: true,
  description: true,
  price: true,
  compareAtPrice: true,
  stockQuantity: true,
  imageUrl: true,
  hoverImageUrl: true,
  images: true,
  franchise: true,
  character: true,
  edition: true,
  releaseDate: true,
  featured: true,
  characterStory: true,
  funFacts: true,
  // The storefront's sitemap uses this for <lastmod>, and search engines lean
  // on it to decide what is worth recrawling.
  updatedAt: true,
  category: { select: { name: true, slug: true, imageUrl: true, description: true } },
} satisfies Prisma.ProductSelect;

export const publicCollectionSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  imageUrl: true,
  price: true,
  compareAtPrice: true,
  updatedAt: true,
  items: { select: { id: true, quantity: true, product: { select: publicProductSelect } } },
} satisfies Prisma.CollectionSelect;
