export type CheckoutLine = { unitPrice: number; quantity: number };
export const totalForItems = (items: CheckoutLine[]) => items.reduce((total, item) => total + item.unitPrice * item.quantity, 0);

/* ---------- bundle pricing ----------
   A cart line is tagged with a collectionId when it was added via "add
   bundle to bag" (see BundleAddToBag on the storefront). Checkout only
   honours the bundle price when every one of the collection's items is
   still present with exactly the collection's quantities — a customer who
   nudges one item's quantity or removes it has broken the set, so the whole
   group falls back to full individual pricing rather than silently keeping
   a stale discount. */

export type BundleCartLine = {
  productId: string;
  collectionId: string | null;
  unitPrice: number;
  quantity: number;
};

export type CollectionDef = {
  id: string;
  price: number;
  items: { productId: string; quantity: number }[];
};

function groupMatchesCollection(lines: BundleCartLine[], definition: CollectionDef): boolean {
  if (lines.length !== definition.items.length) return false;
  const expected = new Map(definition.items.map((item) => [item.productId, item.quantity]));
  return lines.every((line) => expected.get(line.productId) === line.quantity);
}

/**
 * Reprices cart lines tagged with a collectionId: a group that still matches
 * its collection's exact items/quantities gets the collection's price,
 * prorated across its lines by each line's share of the undiscounted total
 * (so unitPrice × quantity keeps summing to a real total — profit/revenue
 * math elsewhere needs nothing else). A group that no longer matches is
 * ungrouped (collectionId cleared) and charged at full price.
 */
export function priceBundles(
  lines: BundleCartLine[],
  collections: Map<string, CollectionDef>,
): BundleCartLine[] {
  const groups = new Map<string, BundleCartLine[]>();
  const standalone: BundleCartLine[] = [];
  for (const line of lines) {
    if (!line.collectionId) {
      standalone.push(line);
      continue;
    }
    const group = groups.get(line.collectionId) ?? [];
    group.push(line);
    groups.set(line.collectionId, group);
  }

  const priced: BundleCartLine[] = [...standalone];

  for (const [collectionId, group] of groups) {
    const definition = collections.get(collectionId);
    const itemsTotal = totalForItems(group);
    if (!definition || itemsTotal <= 0 || !groupMatchesCollection(group, definition)) {
      priced.push(...group.map((line) => ({ ...line, collectionId: null })));
      continue;
    }

    let allocated = 0;
    group.forEach((line, index) => {
      const lineTotal = line.unitPrice * line.quantity;
      // Every line but the last gets its proportional share, rounded; the
      // last absorbs whatever rounding leaves so the group sums to exactly
      // definition.price rather than drifting a paisa off it.
      const share =
        index === group.length - 1
          ? definition.price - allocated
          : Math.round((definition.price * lineTotal) / itemsTotal);
      allocated += share;
      priced.push({ ...line, unitPrice: Math.round(share / line.quantity) });
    });
  }

  return priced;
}
