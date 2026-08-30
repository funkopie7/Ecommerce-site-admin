import { NextRequest, NextResponse } from "next/server";
import { error, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";

/**
 * With `?q=`: a typeahead search over registered customers, for picking one to
 * attach a manual order to. Without it: the full roster for the Customers
 * page — same never-returns-passwordHash guarantee, just more fields and no
 * cap, since the admin table paginates client-side like every other list here.
 */
export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  if (!request.nextUrl.searchParams.has("q")) {
    const customers = await prisma.customer.findMany({
      select: { id: true, name: true, email: true, phone: true, createdAt: true, _count: { select: { orders: true } } },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(customers);
  }
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
