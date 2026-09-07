import { expect, it } from "vitest";
import { afterPromote, afterRemove } from "./GalleriesView";
import type { Product } from "./types";

const make = (over: Partial<Product>): Product => ({
  id: "p1", sku: "SKU-1", slug: "p1", name: "Figure", description: "",
  price: 0, compareAtPrice: null, cost: 0, stockQuantity: 0,
  imageUrl: null, hoverImageUrl: null, images: [], visible: true,
  franchise: null, character: null, edition: null, releaseDate: null,
  variantType: "Common", condition: "Mint", isPreorder: false,
  featured: false, categoryId: "c1", category: { id: "c1", name: "Animation" },
  updatedAt: "", ...over,
});

it("promotes a gallery photo and drops the old main back into the gallery", () => {
  const product = make({ imageUrl: "a", hoverImageUrl: "b", images: ["c", "d"] });
  expect(afterPromote(product, "c", "Main")).toEqual({ imageUrl: "c", hoverImageUrl: "b", images: ["d", "a"] });
});

it("never leaves a photo in two roles when the hover is promoted to main", () => {
  const product = make({ imageUrl: "a", hoverImageUrl: "b", images: ["c"] });
  const next = afterPromote(product, "b", "Main");
  expect(next).toEqual({ imageUrl: "b", hoverImageUrl: null, images: ["c", "a"] });
});

it("keeps the displaced photo out of the gallery when it already holds the other role", () => {
  const product = make({ imageUrl: "a", hoverImageUrl: "a", images: ["b"] });
  expect(afterPromote(product, "b", "Main")).toEqual({ imageUrl: "b", hoverImageUrl: "a", images: [] });
});

it("sets a hover photo without disturbing the main", () => {
  const product = make({ imageUrl: "a", hoverImageUrl: null, images: ["b", "c"] });
  expect(afterPromote(product, "b", "Hover")).toEqual({ hoverImageUrl: "b", imageUrl: "a", images: ["c"] });
});

it("loses nothing when promoting the photo that is already main", () => {
  const product = make({ imageUrl: "a", hoverImageUrl: "b", images: ["c"] });
  expect(afterPromote(product, "a", "Main")).toEqual({ imageUrl: "a", hoverImageUrl: "b", images: ["c"] });
});

it("removes a photo from whichever role holds it", () => {
  const product = make({ imageUrl: "a", hoverImageUrl: "b", images: ["c"] });
  expect(afterRemove(product, "a")).toEqual({ imageUrl: null, hoverImageUrl: "b", images: ["c"] });
  expect(afterRemove(product, "b")).toEqual({ imageUrl: "a", hoverImageUrl: null, images: ["c"] });
  expect(afterRemove(product, "c")).toEqual({ imageUrl: "a", hoverImageUrl: "b", images: [] });
});
