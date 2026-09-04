// app/api/admin/reviews/route.ts
import { NextRequest, NextResponse } from "next/server";
import { error, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";

/* Every review, published and hidden alike, newest first — the moderation
   queue. Unlike the public route this shows the customer's real name and
   email: the shop owner deciding whether something is abuse needs to know
   who wrote it. */
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
