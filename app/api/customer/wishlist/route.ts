// app/api/customer/wishlist/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { customerFromRequest } from "@/lib/auth";
import { error } from "@/lib/api";
import { prisma } from "@/lib/prisma";

/* A wishlist is structurally a cart without quantities, so this mirrors
   app/api/customer/cart/route.ts: the same session guard, the same upsert so a
   customer who has never saved anything still reads an empty shelf instead of
   a 404, and the same idempotent add. The one difference is that an item holds
   EITHER a product or a collection — bundles are wishlistable too — which the
   .refine() below enforces as exactly one of the two. */

const itemInclude = { product: { include: { category: true } }, collection: { include: { items: { include: { product: true } } } } } as const;
const input = z.object({ productId: z.string().optional(), collectionId: z.string().optional() }).refine((value) => Boolean(value.productId) !== Boolean(value.collectionId), { message: "Save either a product or a collection" });

async function ownedWishlist(customerId: string) { return prisma.wishlist.upsert({ where: { customerId }, create: { customerId }, update: {} }); }

export async function GET(request: NextRequest) { const session = await customerFromRequest(request); if (!session) return error("Sign in required", 401); const wishlist = await ownedWishlist(session.customerId); return NextResponse.json(await prisma.wishlist.findUnique({ where: { id: wishlist.id }, include: { items: { include: itemInclude, orderBy: { createdAt: "desc" } } } })); }

export async function POST(request: NextRequest) {
  const session = await customerFromRequest(request);
  if (!session) return error("Sign in required", 401);
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) return error(parsed.error.issues[0].message, 400);
  const { productId, collectionId } = parsed.data;
  if (productId && !(await prisma.product.findFirst({ where: { id: productId, visible: true } }))) return error("Product not found", 404);
  if (collectionId && !(await prisma.collection.findFirst({ where: { id: collectionId, visible: true } }))) return error("Collection not found", 404);
  const wishlist = await ownedWishlist(session.customerId);
  /* Saving something already saved is a no-op, not a 409: the heart button is a
     toggle and a double tap should never surface an error. */
  const existing = await prisma.wishlistItem.findFirst({ where: { wishlistId: wishlist.id, ...(productId ? { productId } : { collectionId }) } });
  if (existing) return NextResponse.json({ ok: true, id: existing.id });
  const created = await prisma.wishlistItem.create({ data: { wishlistId: wishlist.id, productId: productId ?? null, collectionId: collectionId ?? null } });
  return NextResponse.json({ ok: true, id: created.id });
}
