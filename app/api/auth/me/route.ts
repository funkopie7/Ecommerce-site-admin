import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { customerFromRequest } from "@/lib/auth";
import { error } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const SELECT = { id: true, name: true, email: true, phone: true, imageUrl: true, createdAt: true };

export async function GET(request: NextRequest) {
  const session = await customerFromRequest(request);
  if (!session) return error("Sign in required", 401);
  const customer = await prisma.customer.findUnique({ where: { id: session.customerId }, select: SELECT });
  if (!customer) return error("Sign in required", 401);
  return NextResponse.json(customer);
}

const update = z.object({
  name: z.string().min(2).optional(),
  phone: z.string().min(6).max(20).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
});

export async function PATCH(request: NextRequest) {
  const session = await customerFromRequest(request);
  if (!session) return error("Sign in required", 401);
  const parsed = update.safeParse(await request.json());
  if (!parsed.success) return error(parsed.error.issues[0].message, 400);
  const customer = await prisma.customer.update({ where: { id: session.customerId }, data: parsed.data, select: SELECT });
  return NextResponse.json(customer);
}
