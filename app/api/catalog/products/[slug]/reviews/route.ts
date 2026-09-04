import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { summarise, toPublicReview } from "@/lib/reviews";

/* Public, unauthenticated: anyone reading a figure page sees its reviews.
   Keyed by slug rather than id so the storefront can fetch it with what the
   URL already gives it, without a second round trip for the product. */

const PAGE = 8;

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await prisma.product.findFirst({ where: { slug, visible: true }, select: { id: true } });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

  /* "Show more" passes a skip rather than a cursor: reviews are ordered by a
     timestamp that never changes, so page 2 can't shift under the reader the
     way it would on a live-sorted list. */
  const skip = Math.max(0, Number(request.nextUrl.searchParams.get("skip") ?? 0) || 0);

  const [reviews, summary] = await Promise.all([
    prisma.review.findMany({
      where: { productId: product.id, status: "PUBLISHED" },
      include: { customer: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE,
    }),
    summarise(product.id),
  ]);

  return NextResponse.json({ reviews: reviews.map(toPublicReview), summary, skip, pageSize: PAGE });
}
