import { NextRequest, NextResponse } from "next/server";
import { error, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  const status = request.nextUrl.searchParams.get("status");
  return NextResponse.json(
    await prisma.review.findMany({
      where: status === "PUBLISHED" || status === "HIDDEN" ? { status } : {},
      include: { customer: { select: { name: true, email: true } }, product: { select: { name: true, slug: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  );
}
