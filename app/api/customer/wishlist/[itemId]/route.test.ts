import { expect, it, vi } from "vitest";
const { wishlistItem } = vi.hoisted(() => ({ wishlistItem: { deleteMany: vi.fn().mockResolvedValue({ count: 1 }) } }));
vi.mock("@/lib/prisma", () => ({ prisma: { wishlist: { findUnique: vi.fn().mockResolvedValue({ id: "wl1", customerId: "cust1" }) }, wishlistItem } }));
vi.mock("@/lib/auth", () => ({ customerFromRequest: vi.fn().mockResolvedValue({ customerId: "cust1", email: "a@b.com" }) }));
import { NextRequest } from "next/server";
import { DELETE } from "./route";

const remove = (itemId: string) => DELETE(new NextRequest(`http://localhost/api/customer/wishlist/${itemId}`, { method: "DELETE" }), { params: Promise.resolve({ itemId }) });

it("removes an item from the caller's own shelf", async () => {
  expect((await remove("wi1")).status).toBe(200);
  expect(wishlistItem.deleteMany).toHaveBeenCalledWith({ where: { id: "wi1", wishlistId: "wl1" } });
});

it("404s on an item belonging to someone else's shelf", async () => {
  wishlistItem.deleteMany.mockResolvedValueOnce({ count: 0 });
  expect((await remove("someone-elses")).status).toBe(404);
});
