import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { customerFromRequest } from "@/lib/auth";
import { error } from "@/lib/api";
import { prisma } from "@/lib/prisma";
const input = z.object({ recipient: z.string().min(2), phone: z.string().min(8), line1: z.string().min(4), line2: z.string().optional(), city: z.string().min(2), state: z.string().min(2), postalCode: z.string().min(4), country: z.string().default("India"), isDefault: z.boolean().default(false) });
export async function GET(request: NextRequest) { const session = await customerFromRequest(request); if (!session) return error("Sign in required", 401); return NextResponse.json(await prisma.address.findMany({ where: { customerId: session.customerId }, orderBy: { isDefault: "desc" } })); }
export async function POST(request: NextRequest) { const session = await customerFromRequest(request); if (!session) return error("Sign in required", 401); const parsed = input.safeParse(await request.json()); if (!parsed.success) return error(parsed.error.issues[0].message, 400); if (parsed.data.isDefault) await prisma.address.updateMany({ where: { customerId: session.customerId }, data: { isDefault: false } }); return NextResponse.json(await prisma.address.create({ data: { ...parsed.data, customerId: session.customerId } }), { status: 201 }); }
