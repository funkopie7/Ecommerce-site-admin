import { prisma } from "@/lib/prisma";

/* Shared shape for everything the storefront renders about reviews, so the
   public product route and the customer's own write route can't drift into
   returning subtly different objects. */

export type ReviewSummary = {
  average: number;   // 0 when there are none — callers show "no reviews yet"
  count: number;
  /* Ratings 1..5 to how many gave that score, always all five keys present
     so the bar chart doesn't have to fill gaps. */
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

/* First name plus a last initial. A review is public and permanent, and a
   customer who bought a gift shouldn't have their full name indexed next to
   it — but "A." alone reads as fake, so keep enough to look like a person. */
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

/* Counts the whole published set in one grouped query rather than pulling
   every row and reducing in JS — the page only ever shows the most recent
   handful, but the average has to reflect all of them. */
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
  // One decimal place, the convention every shop uses — and the rounding has
  // to happen here rather than in the UI so the number in the JSON-LD that
  // search engines read matches the number on the page.
  return { average: count === 0 ? 0 : Math.round((total / count) * 10) / 10, count, distribution };
}

/* Has this customer actually received one of these? Any order containing the
   product counts, cancelled ones excluded — someone who ordered and cancelled
   never held the figure. */
export async function hasPurchased(customerId: string, productId: string): Promise<boolean> {
  const item = await prisma.orderItem.findFirst({
    where: { productId, order: { customerId, status: { not: "CANCELLED" } } },
    select: { id: true },
  });
  return item !== null;
}
