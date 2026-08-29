// app/api/customer/wishlist/[itemId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { customerFromRequest } from "@/lib/auth";
import { error } from "@/lib/api";
import { prisma } from "@/lib/prisma";

/* Ownership is resolved server-side from the session, exactly as the cart's
   [productId] route does: the client names an item id and nothing else, so
   passing someone else's item id deletes nothing rather than deleting theirs. */

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ itemId: string }> }) {
  const session = await customerFromRequest(request);
  if (!session) return error("Sign in required", 401);
  const { itemId } = await params;
  const wishlist = await prisma.wishlist.findUnique({ where: { customerId: session.customerId } });
  if (!wishlist) return error("Item not on your shelf", 404);
  const { count } = await prisma.wishlistItem.deleteMany({ where: { id: itemId, wishlistId: wishlist.id } });
  if (count === 0) return error("Item not on your shelf", 404);
  return NextResponse.json({ ok: true });
}
