import { expect, it } from "vitest";
import { priceBundles, totalForItems, type BundleCartLine, type CollectionDef } from "./checkout";

it("calculates a checkout total from item snapshots", () => expect(totalForItems([{ unitPrice: 129900, quantity: 1 }, { unitPrice: 45900, quantity: 2 }])).toBe(221700));

const collections = (defs: CollectionDef[]) => new Map(defs.map((def) => [def.id, def]));

it("prices a complete bundle group at the collection's price, prorated across its lines", () => {
  const lines: BundleCartLine[] = [
    { productId: "a", collectionId: "bundle-1", unitPrice: 10000, quantity: 1 },
    { productId: "b", collectionId: "bundle-1", unitPrice: 5000, quantity: 1 },
  ];
  const defs = collections([{ id: "bundle-1", price: 12000, items: [{ productId: "a", quantity: 1 }, { productId: "b", quantity: 1 }] }]);
  const priced = priceBundles(lines, defs);
  expect(totalForItems(priced)).toBe(12000);
  expect(priced.every((line) => line.collectionId === "bundle-1")).toBe(true);
});

it("falls back to full price when the bundle group no longer matches its collection", () => {
  const lines: BundleCartLine[] = [
    { productId: "a", collectionId: "bundle-1", unitPrice: 10000, quantity: 2 }, // qty edited from 1 to 2
    { productId: "b", collectionId: "bundle-1", unitPrice: 5000, quantity: 1 },
  ];
  const defs = collections([{ id: "bundle-1", price: 12000, items: [{ productId: "a", quantity: 1 }, { productId: "b", quantity: 1 }] }]);
  const priced = priceBundles(lines, defs);
  expect(totalForItems(priced)).toBe(25000); // 10000*2 + 5000, undiscounted
  expect(priced.every((line) => line.collectionId === null)).toBe(true);
});

it("leaves standalone lines untouched", () => {
  const lines: BundleCartLine[] = [{ productId: "c", collectionId: null, unitPrice: 7500, quantity: 3 }];
  const priced = priceBundles(lines, collections([]));
  expect(priced).toEqual(lines);
});
