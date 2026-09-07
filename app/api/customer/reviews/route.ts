import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { customerFromRequest } from "@/lib/auth";
import { error } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { hasPurchased, summarise, toPublicReview } from "@/lib/reviews";

const input = z.object({
  productId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(80).optional(),
  body: z.string().trim().min(4).max(2000),
});

export async function GET(request: NextRequest) {
  const session = await customerFromRequest(request);
  if (!session) return error("Sign in required", 401);
  const productId = request.nextUrl.searchParams.get("productId");
  if (!productId) return error("productId is required", 400);
  const review = await prisma.review.findUnique({
    where: { productId_customerId: { productId, customerId: session.customerId } },
    include: { customer: { select: { name: true } } },
  });
  return NextResponse.json({
    review: review ? { ...toPublicReview(review), status: review.status } : null,
    canReview: await hasPurchased(session.customerId, productId),
  });
}

export async function POST(request: NextRequest) {
  const session = await customerFromRequest(request);
  if (!session) return error("Sign in required", 401);
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) return error(parsed.error.issues[0].message, 400);
  const { productId, rating, title, body } = parsed.data;

  const product = await prisma.product.findFirst({ where: { id: productId, visible: true }, select: { id: true } });
  if (!product) return error("Product not found", 404);

  const verifiedPurchase = await hasPurchased(session.customerId, productId);

  const review = await prisma.review.upsert({
    where: { productId_customerId: { productId, customerId: session.customerId } },
    create: { productId, customerId: session.customerId, rating, title: title || null, body, verifiedPurchase },
    update: { rating, title: title || null, body, verifiedPurchase },
    include: { customer: { select: { name: true } } },
  });

  return NextResponse.json({ review: { ...toPublicReview(review), status: review.status }, summary: await summarise(productId) }, { status: 201 });
}
