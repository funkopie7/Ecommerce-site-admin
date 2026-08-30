// app/api/customer/cart/[productId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { customerFromRequest } from "@/lib/auth";
import { error } from "@/lib/api";
import { prisma } from "@/lib/prisma";
const input = z.object({ quantity: z.number().int().min(1).max(99) });

async function ownedCart(customerId: string) { return prisma.cart.findUnique({ where: { customerId } }); }

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  const session = await customerFromRequest(request);
  if (!session) return error("Sign in required", 401);
  const { productId } = await params;
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) return error("Enter a valid quantity", 400);
  const cart = await ownedCart(session.customerId);
  if (!cart) return error("Cart not found", 404);
  // A manual quantity edit breaks any bundle this line was part of — checkout
  // would no longer see a complete set, so the tag is cleared here rather
  // than left stale.
  try { return NextResponse.json(await prisma.cartItem.update({ where: { cartId_productId: { cartId: cart.id, productId } }, data: { quantity: parsed.data.quantity, collectionId: null } })); } catch { return error("Item not in your bag", 404); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ productId: string }> }) {
  const session = await customerFromRequest(request);
  if (!session) return error("Sign in required", 401);
  const { productId } = await params;
  const cart = await ownedCart(session.customerId);
  if (!cart) return error("Cart not found", 404);
  try { await prisma.cartItem.delete({ where: { cartId_productId: { cartId: cart.id, productId } } }); return NextResponse.json({ ok: true }); } catch { return error("Item not in your bag", 404); }
}
