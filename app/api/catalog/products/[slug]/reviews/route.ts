import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { summarise, toPublicReview } from "@/lib/reviews";

const PAGE = 8;

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await prisma.product.findFirst({ where: { slug, visible: true }, select: { id: true } });
  if (!product) return NextResponse.json({ error: "Product not found" }, { status: 404 });

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
