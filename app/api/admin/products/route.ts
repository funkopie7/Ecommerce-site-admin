import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { error, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { revalidateStorefront } from "@/lib/revalidateStorefront";

const VARIANT_TYPES = ["Common", "Chase", "Flocked", "Glow", "Metallic"] as const;
const CONDITIONS = ["Mint", "Near Mint", "OOB"] as const;

const productInput = z.object({ name: z.string().min(2), slug: z.string().min(2), description: z.string().min(10), price: z.number().int().nonnegative(), compareAtPrice: z.number().int().nonnegative().optional(), cost: z.number().int().nonnegative(), stockQuantity: z.number().int().nonnegative(), categoryId: z.string(), imageUrl: z.string().url().optional(), hoverImageUrl: z.string().url().optional(), visible: z.boolean().default(true), featured: z.boolean().optional(), images: z.array(z.string().url()).default([]), variantType: z.enum(VARIANT_TYPES).optional(), condition: z.enum(CONDITIONS).optional(), isPreorder: z.boolean().optional(), franchise: z.string().min(1).optional() });

/**
 * SKU is generated, not typed: the product's first word, upper-cased, plus
 * the next free number for that word — "Gojo" then another "Gojo" gives
 * GOJO-1, GOJO-2. Retried on a unique-constraint hit rather than trusting a
 * single COUNT, since two admins creating the same-named product back to
 * back would otherwise race for the same number.
 */
function skuPrefix(name: string): string {
  const word = name.trim().split(/\s+/)[0]?.toUpperCase().replace(/[^A-Z0-9]/g, "") ?? "";
  return word || "SKU";
}

async function nextSku(name: string): Promise<string> {
  const prefix = skuPrefix(name);
  const existing = await prisma.product.count({ where: { sku: { startsWith: `${prefix}-` } } });
  return `${prefix}-${existing + 1}`;
}

export async function GET(request: NextRequest) { if (!(await requireAdmin(request))) return error("Administrator access required", 401); return NextResponse.json(await prisma.product.findMany({ include: { category: true }, orderBy: { updatedAt: "desc" } })); }

export async function POST(request: NextRequest) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  const parsed = productInput.safeParse(await request.json());
  if (!parsed.success) return error(parsed.error.issues[0].message, 400);

  for (let attempt = 0; attempt < 5; attempt++) {
    const sku = await nextSku(parsed.data.name);
    try {
      const created = await prisma.product.create({ data: { ...parsed.data, sku } });
      revalidateStorefront();
      return NextResponse.json(created, { status: 201 });
    } catch (cause) {
      const collided = cause instanceof Prisma.PrismaClientKnownRequestError && cause.code === "P2002";
      if (collided && (cause.meta?.target as string[] | undefined)?.includes("sku")) continue; // another create just took this number — try the next one
      return error(collided ? "Slug must be unique" : "Could not create that product", 409);
    }
  }
  return error("Could not generate a unique SKU — try again", 409);
}
