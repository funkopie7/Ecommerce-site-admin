import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { error, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const input = z.object({ productId: z.string(), delta: z.number().int().refine((value) => value !== 0), reason: z.string().min(3) });
export async function POST(request: NextRequest) { if (!(await requireAdmin(request))) return error("Administrator access required", 401); const parsed = input.safeParse(await request.json()); if (!parsed.success) return error(parsed.error.issues[0].message, 400); const result = await prisma.$transaction(async (tx) => { const product = await tx.product.findUnique({ where: { id: parsed.data.productId } }); if (!product) throw new Error("NOT_FOUND"); const stockQuantity = product.stockQuantity + parsed.data.delta; if (stockQuantity < 0) throw new Error("NEGATIVE"); const updated = await tx.product.update({ where: { id: product.id }, data: { stockQuantity } }); await tx.inventoryAdjustment.create({ data: { productId: product.id, delta: parsed.data.delta, resultingQuantity: stockQuantity, reason: parsed.data.reason, adminEmail: "admin" } }); return updated; }); return NextResponse.json(result); }
