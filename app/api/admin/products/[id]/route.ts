import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { error, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { revalidateStorefront } from "@/lib/revalidateStorefront";

const VARIANT_TYPES = ["Common", "Chase", "Flocked", "Glow", "Metallic"] as const;
const CONDITIONS = ["Mint", "Near Mint", "OOB"] as const;

const productUpdate = z.object({ name: z.string().min(2).optional(), sku: z.string().min(2).optional(), slug: z.string().min(2).optional(), description: z.string().min(10).optional(), price: z.number().int().nonnegative().optional(), compareAtPrice: z.number().int().nonnegative().nullable().optional(), cost: z.number().int().nonnegative().optional(), stockQuantity: z.number().int().nonnegative().optional(), categoryId: z.string().optional(), imageUrl: z.string().url().nullable().optional(), hoverImageUrl: z.string().url().nullable().optional(), images: z.array(z.string().url()).optional(), visible: z.boolean().optional(), featured: z.boolean().optional(), variantType: z.enum(VARIANT_TYPES).optional(), condition: z.enum(CONDITIONS).optional(), isPreorder: z.boolean().optional(), franchise: z.string().min(1).nullable().optional() });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  const { id } = await params;
  const parsed = productUpdate.safeParse(await request.json());
  if (!parsed.success) return error(parsed.error.issues[0].message, 400);
  try {
    const updated = await prisma.product.update({ where: { id }, data: parsed.data });
    revalidateStorefront();
    return NextResponse.json(updated);
  } catch { return error("Product not found or SKU/slug already in use", 409); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  const { id } = await params;
  try {
    await prisma.product.delete({ where: { id } });
    revalidateStorefront();
    return NextResponse.json({ ok: true });
  } catch { return error("Product not found or still referenced by an order", 409); }
}
