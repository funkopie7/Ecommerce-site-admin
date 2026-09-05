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
  /* One character is enough. The old floor of two returned nothing for "a",
     which in a shop with three customers whose names all begin with "a" made
     the picker look broken rather than strict. */
  if (q.length < 1) return NextResponse.json([]);

  const like = `%${q}%`;
  /* Phones are matched on digits alone, on both sides. A number typed as
     "6301" has to find one stored as "+91 63019 24850": the stored value
     carries a country code, a plus and spaces, so a literal substring match
     never sees it. Stripping both to digits makes the typed fragment a
     genuine substring again.
     
     Skipped entirely when the query has no digits, because an empty digit
     string would turn the clause into '%%' and match every row. */
  const digits = q.replace(/\D/g, "");
  const digitLike = digits.length > 0 ? `%${digits}%` : null;

  /* Raw SQL because the phone match needs regexp_replace on the column, and
     because a registered customer's number usually is not on the Customer row
     at all — it is on their addresses. Searching only Customer.phone is why
     typing a real customer's number found nothing. */
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

  /* Walk-ins are searchable here too. They cannot be attached to an order the
     way an account can — they have no Customer row — so the dialog uses one to
     prefill the walk-in fields instead. Offering them is still right: the
     alternative is retyping a repeat customer's details from memory. */
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
