import type { Prisma } from "@prisma/client";

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
  variantType: true,
  condition: true,
  isPreorder: true,
  releaseDate: true,
  featured: true,
  characterStory: true,
  funFacts: true,
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
