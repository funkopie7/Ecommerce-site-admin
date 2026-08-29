// app/api/customer/wishlist/route.test.ts
import { expect, it, vi } from "vitest";
/* vi.mock factories are hoisted above module-scope consts, so the shared spy
   has to be created inside vi.hoisted to exist by the time the factory runs. */
const { wishlistItem } = vi.hoisted(() => ({ wishlistItem: { findFirst: vi.fn(), create: vi.fn().mockResolvedValue({ id: "wi1" }) } }));
vi.mock("@/lib/prisma", () => ({ prisma: {
  wishlist: { upsert: vi.fn().mockResolvedValue({ id: "wl1", customerId: "cust1" }), findUnique: vi.fn().mockResolvedValue({ id: "wl1", items: [] }) },
  wishlistItem,
  product: { findFirst: vi.fn().mockResolvedValue({ id: "prod1", visible: true }) },
  collection: { findFirst: vi.fn().mockResolvedValue({ id: "col1", visible: true }) },
} }));
vi.mock("@/lib/auth", () => ({ customerFromRequest: vi.fn().mockResolvedValue({ customerId: "cust1", email: "a@b.com" }) }));
import { NextRequest } from "next/server";
import { GET, POST } from "./route";

const post = (body: unknown) => POST(new NextRequest("http://localhost/api/customer/wishlist", { method: "POST", body: JSON.stringify(body) }));

it("returns a wishlist, creating an empty one on first access", async () => {
  const response = await GET(new NextRequest("http://localhost/api/customer/wishlist"));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ id: "wl1", items: [] });
});

it("saves a product", async () => {
  wishlistItem.findFirst.mockResolvedValueOnce(null);
  expect((await post({ productId: "prod1" })).status).toBe(200);
  expect(wishlistItem.create).toHaveBeenCalledWith({ data: { wishlistId: "wl1", productId: "prod1", collectionId: null } });
});

it("saves a collection", async () => {
  wishlistItem.findFirst.mockResolvedValueOnce(null);
  expect((await post({ collectionId: "col1" })).status).toBe(200);
  expect(wishlistItem.create).toHaveBeenCalledWith({ data: { wishlistId: "wl1", productId: null, collectionId: "col1" } });
});

it("treats saving something already saved as a no-op, not an error", async () => {
  wishlistItem.create.mockClear();
  wishlistItem.findFirst.mockResolvedValueOnce({ id: "wi-existing" });
  expect((await post({ productId: "prod1" })).status).toBe(200);
  expect(wishlistItem.create).not.toHaveBeenCalled();
});

it("rejects a body naming both a product and a collection", async () => {
  expect((await post({ productId: "prod1", collectionId: "col1" })).status).toBe(400);
});

it("rejects a body naming neither", async () => {
  expect((await post({})).status).toBe(400);
});
