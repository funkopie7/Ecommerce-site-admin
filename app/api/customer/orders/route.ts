// app/api/customer/orders/route.ts
import { NextRequest, NextResponse } from "next/server";
import { customerFromRequest } from "@/lib/auth";
import { error } from "@/lib/api";
import { prisma } from "@/lib/prisma";
export async function GET(request: NextRequest) { const session = await customerFromRequest(request); if (!session) return error("Sign in required", 401); return NextResponse.json(await prisma.order.findMany({ where: { customerId: session.customerId }, include: { items: true }, orderBy: { createdAt: "desc" } })); }
