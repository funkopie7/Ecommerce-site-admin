import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { error, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const couponInput = z.object({
  code: z.string().min(2).regex(/^[A-Z0-9_-]+$/, "Code must be upper-case letters, digits, underscores or hyphens"),
  type: z.enum(["PERCENT", "FIXED"]),
  value: z.number().int().positive(),
  active: z.boolean().default(true),
  maxUses: z.number().int().positive().optional(),
  expiresAt: z.string().datetime().optional(),
});

export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  return NextResponse.json(await prisma.coupon.findMany({ orderBy: { createdAt: "desc" } }));
}

export async function POST(request: NextRequest) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  const parsed = couponInput.safeParse(await request.json());
  if (!parsed.success) return error(parsed.error.issues[0].message, 400);
  if (parsed.data.type === "PERCENT" && parsed.data.value > 100) return error("A percent-off coupon can't exceed 100%", 400);

  const { code, type, active, maxUses, expiresAt } = parsed.data;
  const value = type === "FIXED" ? Math.round(parsed.data.value * 100) : parsed.data.value;

  try {
    return NextResponse.json(
      await prisma.coupon.create({ data: { code: code.toUpperCase(), type, value, active, maxUses, expiresAt: expiresAt ? new Date(expiresAt) : undefined } }),
      { status: 201 },
    );
  } catch {
    return error("Coupon code must be unique", 409);
  }
}
