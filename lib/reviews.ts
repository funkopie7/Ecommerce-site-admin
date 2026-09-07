import { prisma } from "@/lib/prisma";

export type ReviewSummary = {
  average: number;   // 0 when there are none — callers show "no reviews yet"
  count: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
};

export type PublicReview = {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  verifiedPurchase: boolean;
  author: string;
  createdAt: Date;
};

export function displayName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "A collector";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

export const toPublicReview = (review: { id: string; rating: number; title: string | null; body: string; verifiedPurchase: boolean; createdAt: Date; customer: { name: string } }): PublicReview => ({
  id: review.id,
  rating: review.rating,
  title: review.title,
  body: review.body,
  verifiedPurchase: review.verifiedPurchase,
  author: displayName(review.customer.name),
  createdAt: review.createdAt,
});

export async function summarise(productId: string): Promise<ReviewSummary> {
  const groups = await prisma.review.groupBy({
    by: ["rating"],
    where: { productId, status: "PUBLISHED" },
    _count: { rating: true },
  });
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>;
  let count = 0;
  let total = 0;
  for (const group of groups) {
    const rating = group.rating as 1 | 2 | 3 | 4 | 5;
    if (rating >= 1 && rating <= 5) distribution[rating] = group._count.rating;
    count += group._count.rating;
    total += group.rating * group._count.rating;
  }
  return { average: count === 0 ? 0 : Math.round((total / count) * 10) / 10, count, distribution };
}

export async function hasPurchased(customerId: string, productId: string): Promise<boolean> {
  const item = await prisma.orderItem.findFirst({
    where: { productId, order: { customerId, status: { not: "CANCELLED" } } },
    select: { id: true },
  });
  return item !== null;
}
