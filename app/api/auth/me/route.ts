// app/api/auth/me/route.ts
import { NextRequest, NextResponse } from "next/server";
import { customerFromRequest } from "@/lib/auth";
import { error } from "@/lib/api";
import { prisma } from "@/lib/prisma";
export async function GET(request: NextRequest) { const session = await customerFromRequest(request); if (!session) return error("Sign in required", 401); const customer = await prisma.customer.findUnique({ where: { id: session.customerId }, select: { id: true, name: true, email: true, phone: true } }); if (!customer) return error("Sign in required", 401); return NextResponse.json(customer); }
