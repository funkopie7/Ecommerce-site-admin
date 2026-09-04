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
    /* Two kinds of customer, and only one of them has a row in Customer.
       A walk-in sale records a name and phone on the Order itself and creates
       no account, so the roster showed people who had registered and never
       bought anything while leaving out people who had walked in and paid.
       Searching the Customers page for a walk-in found nothing at all. */
    const [accounts, walkinOrders] = await Promise.all([
      prisma.customer.findMany({
        select: { id: true, name: true, email: true, phone: true, createdAt: true, _count: { select: { orders: true } } },
        orderBy: { name: "asc" },
      }),
      prisma.order.findMany({
        where: { customerId: null, customerName: { not: null } },
        select: { customerName: true, customerPhone: true, customerEmail: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    /* Grouped by phone where there is one, since that is what actually
       identifies a repeat walk-in — two people called "Ansh" are two
       customers, and one person who gave their name twice is one. Falls back
       to the name when no phone was taken. */
    const walkins = new Map<string, { id: string; name: string; email: string | null; phone: string | null; createdAt: Date; orders: number }>();
    for (const order of walkinOrders) {
      const key = (order.customerPhone || order.customerName || "").trim().toLowerCase();
      if (!key) continue;
      const existing = walkins.get(key);
      if (existing) {
        existing.orders += 1;
        // Keep the most complete record: a later sale may be the one where
        // they finally gave an email.
        existing.email ??= order.customerEmail;
      } else {
        walkins.set(key, {
          id: `walkin:${key}`,
          name: order.customerName!,
          email: order.customerEmail,
          phone: order.customerPhone,
          createdAt: order.createdAt,
          orders: 1,
        });
      }
    }

    return NextResponse.json([
      ...accounts.map((account) => ({ ...account, kind: "account" as const, orders: account._count.orders })),
      ...[...walkins.values()].sort((a, b) => a.name.localeCompare(b.name)).map((walkin) => ({ ...walkin, kind: "walkin" as const })),
    ]);
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
