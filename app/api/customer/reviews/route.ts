import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { customerFromRequest } from "@/lib/auth";
import { error } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { hasPurchased, summarise, toPublicReview } from "@/lib/reviews";

/* Writing a review, and reading back the one you already wrote.

   Sign-in is required — not to gate the feature, but because an anonymous
   review box on a shop this size fills with spam within a week, and because
   one-review-per-person is unenforceable without an identity. */

const input = z.object({
  productId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().max(80).optional(),
  // Long enough to say something, capped so one person can't wallpaper the
  // page. The floor is deliberately low: "Perfect, exactly as pictured" is a
  // genuinely useful review.
  body: z.string().trim().min(4).max(2000),
});

/** The signed-in customer's own review of one product — including a HIDDEN
 *  one, so the form shows them what they wrote rather than an empty box. */
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

  /* Upsert, because the unique constraint means a second submission is an
     edit. Editing deliberately does NOT reset status: someone whose abusive
     review was hidden must not be able to un-hide it by resubmitting. */
  const review = await prisma.review.upsert({
    where: { productId_customerId: { productId, customerId: session.customerId } },
    create: { productId, customerId: session.customerId, rating, title: title || null, body, verifiedPurchase },
    update: { rating, title: title || null, body, verifiedPurchase },
    include: { customer: { select: { name: true } } },
  });

  // The summary comes back with it so the page's average and star bars update
  // from the same response that saved the review, with no follow-up fetch.
  return NextResponse.json({ review: { ...toPublicReview(review), status: review.status }, summary: await summarise(productId) }, { status: 201 });
}
