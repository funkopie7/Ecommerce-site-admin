import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { error, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";
const input = z.object({ name: z.string().min(2), slug: z.string().min(2), description: z.string().optional(), imageUrl: z.string().url().optional(), visible: z.boolean().default(true) });
export async function GET(request: NextRequest) { if (!requireAdmin(request)) return error("Administrator access required", 401); return NextResponse.json(await prisma.category.findMany({ include: { _count: { select: { products: true } } }, orderBy: { name: "asc" } })); }
export async function POST(request: NextRequest) { if (!requireAdmin(request)) return error("Administrator access required", 401); const parsed = input.safeParse(await request.json()); if (!parsed.success) return error(parsed.error.issues[0].message, 400); try { return NextResponse.json(await prisma.category.create({ data: parsed.data }), { status: 201 }); } catch { return error("Category name and slug must be unique", 409); } }
