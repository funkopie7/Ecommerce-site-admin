import { NextRequest, NextResponse } from "next/server";
import { error, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";

/** Search over registered customers, for picking one to attach a manual order to — never returns passwordHash. */
export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json([]);
  const customers = await prisma.customer.findMany({
    where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] },
    select: { id: true, name: true, email: true, phone: true },
    take: 10,
    orderBy: { name: "asc" },
  });
  return NextResponse.json(customers);
}
