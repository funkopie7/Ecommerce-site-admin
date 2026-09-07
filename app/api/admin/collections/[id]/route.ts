import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { error, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { revalidateStorefront } from "@/lib/revalidateStorefront";

const collectionUpdate = z.object({ name: z.string().min(2).optional(), slug: z.string().min(2).optional(), description: z.string().optional(), imageUrl: z.string().url().optional(), price: z.number().int().nonnegative().optional(), compareAtPrice: z.number().int().nonnegative().nullable().optional(), visible: z.boolean().optional(), items: z.array(z.object({ productId: z.string(), quantity: z.number().int().positive().default(1) })).min(1).optional() });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  const { id } = await params;
  const parsed = collectionUpdate.safeParse(await request.json());
  if (!parsed.success) return error(parsed.error.issues[0].message, 400);
  const { items, ...data } = parsed.data;
  try {
    const collection = await prisma.$transaction(async (tx) => {
      await tx.collection.update({ where: { id }, data });
      if (items) { await tx.collectionItem.deleteMany({ where: { collectionId: id } }); await tx.collectionItem.createMany({ data: items.map((item) => ({ collectionId: id, productId: item.productId, quantity: item.quantity })) }); }
      return tx.collection.findUniqueOrThrow({ where: { id }, include: { items: { include: { product: true } } } });
    });
    revalidateStorefront();
    return NextResponse.json(collection);
  } catch { return error("Collection not found or name/slug already in use", 409); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  const { id } = await params;
  try { await prisma.collection.delete({ where: { id } }); revalidateStorefront(); return NextResponse.json({ ok: true }); } catch { return error("Collection not found", 409); }
}
