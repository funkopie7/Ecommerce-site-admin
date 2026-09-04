// app/api/admin/customers/route.test.ts
import { expect, it, vi, beforeEach } from "vitest";
const { findMany, orderFindMany } = vi.hoisted(() => ({ findMany: vi.fn(), orderFindMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { customer: { findMany }, order: { findMany: orderFindMany } } }));
import { NextRequest } from "next/server";
import { GET } from "./route";

const roster = () => new NextRequest("http://localhost/api/admin/customers", { headers: { "x-admin-key": "test-key" } });

beforeEach(() => {
  process.env.ADMIN_API_KEY = "test-key";
  findMany.mockReset().mockResolvedValue([{ id: "cust1", name: "Ansh", email: "a@b.com", phone: "9999999999" }]);
  orderFindMany.mockReset().mockResolvedValue([]);
});

it("searches customers by name, email or phone", async () => {
  const request = new NextRequest("http://localhost/api/admin/customers?q=ansh", { headers: { "x-admin-key": "test-key" } });
  const response = await GET(request);
  expect(response.status).toBe(200);
  expect(await response.json()).toHaveLength(1);
});

it("returns no results for a query under two characters, without hitting the database", async () => {
  const request = new NextRequest("http://localhost/api/admin/customers?q=a", { headers: { "x-admin-key": "test-key" } });
  const response = await GET(request);
  expect(await response.json()).toEqual([]);
  expect(findMany).not.toHaveBeenCalled();
});

it("refuses an unauthenticated search", async () => {
  const request = new NextRequest("http://localhost/api/admin/customers?q=ansh");
  expect((await GET(request)).status).toBe(401);
});

it("returns the full roster when no q is given, for the Customers page", async () => {
  findMany.mockResolvedValue([{ id: "cust1", name: "Ansh", email: "a@b.com", phone: "9999999999", createdAt: new Date().toISOString(), _count: { orders: 3 } }]);
  const body = await (await GET(roster())).json();
  expect(body).toHaveLength(1);
  expect(body[0]).toMatchObject({ kind: "account", orders: 3 });
});

/* Walk-in sales create no Customer row at all, so before these they were
   simply absent from the roster and unfindable by search. */
it("includes walk-ins, collapsing repeat visits by phone into one customer", async () => {
  findMany.mockResolvedValue([]);
  orderFindMany.mockResolvedValue([
    { customerName: "Ansh Yadav", customerPhone: "9820012345", customerEmail: null, createdAt: new Date("2026-01-02") },
    { customerName: "ansh yadav", customerPhone: "9820012345", customerEmail: "ansh@example.com", createdAt: new Date("2026-03-04") },
    { customerName: "Priya", customerPhone: "9000000000", customerEmail: null, createdAt: new Date("2026-02-02") },
  ]);
  const body = await (await GET(roster())).json();
  expect(body).toHaveLength(2);
  const ansh = body.find((row: { phone: string }) => row.phone === "9820012345");
  expect(ansh).toMatchObject({ kind: "walkin", orders: 2, name: "Ansh Yadav" });
  // The later sale is where they gave an email; the earlier one had none.
  expect(ansh.email).toBe("ansh@example.com");
});

it("treats two people with the same name but different phones as two customers", async () => {
  findMany.mockResolvedValue([]);
  orderFindMany.mockResolvedValue([
    { customerName: "Ansh", customerPhone: "1111111111", customerEmail: null, createdAt: new Date("2026-01-01") },
    { customerName: "Ansh", customerPhone: "2222222222", customerEmail: null, createdAt: new Date("2026-01-02") },
  ]);
  const body = await (await GET(roster())).json();
  expect(body).toHaveLength(2);
  expect(body.every((row: { orders: number }) => row.orders === 1)).toBe(true);
});

it("lists accounts and walk-ins together, each labelled", async () => {
  findMany.mockResolvedValue([{ id: "cust1", name: "Registered Person", email: "r@b.com", phone: null, createdAt: new Date().toISOString(), _count: { orders: 1 } }]);
  orderFindMany.mockResolvedValue([{ customerName: "Counter Buyer", customerPhone: "9820099999", customerEmail: null, createdAt: new Date() }]);
  const body = await (await GET(roster())).json();
  expect(body.map((row: { kind: string }) => row.kind)).toEqual(["account", "walkin"]);
});
