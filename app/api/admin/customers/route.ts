import { NextRequest, NextResponse } from "next/server";
import { error, requireAdmin } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  if (!(await requireAdmin(request))) return error("Administrator access required", 401);
  if (!request.nextUrl.searchParams.has("q")) {
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

    const walkins = new Map<string, { id: string; name: string; email: string | null; phone: string | null; createdAt: Date; orders: number }>();
    for (const order of walkinOrders) {
      const key = (order.customerPhone || order.customerName || "").trim().toLowerCase();
      if (!key) continue;
      const existing = walkins.get(key);
      if (existing) {
        existing.orders += 1;
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
  if (q.length < 1) return NextResponse.json([]);

  const like = `%${q}%`;
  const digits = q.replace(/\D/g, "");
  const digitLike = digits.length > 0 ? `%${digits}%` : null;

  const accounts = await prisma.$queryRaw<{ id: string; name: string; email: string; phone: string | null }[]>`
    select c.id, c.name, c.email,
           coalesce(c.phone, (select a.phone from "Address" a where a."customerId" = c.id order by a."isDefault" desc limit 1)) as phone
    from "Customer" c
    where c.name ilike ${like}
       or c.email ilike ${like}
       or (${digitLike}::text is not null and regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') like ${digitLike})
       or (${digitLike}::text is not null and exists (
             select 1 from "Address" a
             where a."customerId" = c.id
               and regexp_replace(coalesce(a.phone, ''), '\D', '', 'g') like ${digitLike}))
    order by c.name asc
    limit 10`;

  const walkinRows = await prisma.$queryRaw<{ name: string; phone: string | null; email: string | null }[]>`
    select distinct on (coalesce("customerPhone", "customerName"))
           "customerName" as name, "customerPhone" as phone, "customerEmail" as email
    from "Order"
    where "customerId" is null and "customerName" is not null
      and ("customerName" ilike ${like}
        or coalesce("customerEmail", '') ilike ${like}
        or (${digitLike}::text is not null and regexp_replace(coalesce("customerPhone", ''), '\D', '', 'g') like ${digitLike}))
    order by coalesce("customerPhone", "customerName"), "createdAt" desc
    limit 10`;

  return NextResponse.json([
    ...accounts.map((account) => ({ ...account, kind: "account" as const })),
    ...walkinRows.map((walkin) => ({ id: `walkin:${walkin.phone ?? walkin.name}`, ...walkin, kind: "walkin" as const })),
  ]);
}
