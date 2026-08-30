import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { error, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const collectionInput = z.object({ name: z.string().min(2), slug: z.string().min(2), description: z.string().optional(), imageUrl: z.string().url().optional(), price: z.number().int().nonnegative(), compareAtPrice: z.number().int().nonnegative().nullable().optional(), visible: z.boolean().default(true), items: z.array(z.object({ productId: z.string(), quantity: z.number().int().positive().default(1) })).min(1) });

export async function GET(request: NextRequest) { if (!(await requireAdmin(request))) return error("Administrator access required", 401); return NextResponse.json(await prisma.collection.findMany({ include: { items: { include: { product: true } } }, orderBy: { updatedAt: "desc" } })); }
export async function POST(request: NextRequest) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  const parsed = collectionInput.safeParse(await request.json());
  if (!parsed.success) return error(parsed.error.issues[0].message, 400);
  const { items, ...data } = parsed.data;
  try {
    return NextResponse.json(await prisma.$transaction(async (tx) => {
      const collection = await tx.collection.create({ data });
      await tx.collectionItem.createMany({ data: items.map((item) => ({ collectionId: collection.id, productId: item.productId, quantity: item.quantity })) });
      return tx.collection.findUniqueOrThrow({ where: { id: collection.id }, include: { items: { include: { product: true } } } });
    }), { status: 201 });
  } catch { return error("Collection name and slug must be unique", 409); }
}
