import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { error, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const productInput = z.object({ name: z.string().min(2), sku: z.string().min(2), slug: z.string().min(2), description: z.string().min(10), price: z.number().int().nonnegative(), cost: z.number().int().nonnegative(), stockQuantity: z.number().int().nonnegative(), categoryId: z.string(), imageUrl: z.string().url().optional(), visible: z.boolean().default(true), badges: z.array(z.string()).optional() });

export async function GET(request: NextRequest) { if (!(await requireAdmin(request))) return error("Administrator access required", 401); return NextResponse.json(await prisma.product.findMany({ include: { category: true }, orderBy: { updatedAt: "desc" } })); }
export async function POST(request: NextRequest) { if (!(await requireAdmin(request))) return error("Administrator access required", 401); const parsed = productInput.safeParse(await request.json()); if (!parsed.success) return error(parsed.error.issues[0].message, 400); try { return NextResponse.json(await prisma.product.create({ data: parsed.data }), { status: 201 }); } catch { return error("SKU and slug must be unique", 409); } }
