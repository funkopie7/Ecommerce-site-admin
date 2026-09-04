import { beforeEach, expect, it, vi } from "vitest";
const { groupBy, findFirst } = vi.hoisted(() => ({ groupBy: vi.fn(), findFirst: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { review: { groupBy }, orderItem: { findFirst } } }));
import { displayName, hasPurchased, summarise } from "./reviews";

beforeEach(() => vi.clearAllMocks());

it("shortens a full name to a first name and last initial", () => {
  expect(displayName("Aarav Sharma")).toBe("Aarav S.");
  expect(displayName("  priya  raj  kapoor ")).toBe("priya K.");
  expect(displayName("Madonna")).toBe("Madonna");
  expect(displayName("   ")).toBe("A collector");
});

it("averages every published rating, not just the page being shown", async () => {
  groupBy.mockResolvedValue([
    { rating: 5, _count: { rating: 7 } },
    { rating: 4, _count: { rating: 2 } },
    { rating: 1, _count: { rating: 1 } },
  ]);
  const summary = await summarise("p1");
  // (5*7 + 4*2 + 1) / 10 = 4.4
  expect(summary).toEqual({ average: 4.4, count: 10, distribution: { 1: 1, 2: 0, 3: 0, 4: 2, 5: 7 } });
});

it("reports a zero average rather than NaN when nothing is published", async () => {
  groupBy.mockResolvedValue([]);
  expect(await summarise("p1")).toEqual({ average: 0, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } });
});

it("rounds the average to one decimal so the page and the JSON-LD agree", async () => {
  groupBy.mockResolvedValue([{ rating: 5, _count: { rating: 2 } }, { rating: 4, _count: { rating: 1 } }]);
  expect((await summarise("p1")).average).toBe(4.7); // 14/3 = 4.666…
});

it("counts a past order as a verified purchase, ignoring cancelled ones", async () => {
  findFirst.mockResolvedValue({ id: "item1" });
  expect(await hasPurchased("c1", "p1")).toBe(true);
  expect(findFirst).toHaveBeenCalledWith({
    where: { productId: "p1", order: { customerId: "c1", status: { not: "CANCELLED" } } },
    select: { id: true },
  });

  findFirst.mockResolvedValue(null);
  expect(await hasPurchased("c1", "p1")).toBe(false);
});
