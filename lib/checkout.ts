export type CheckoutLine = { unitPrice: number; quantity: number };
export const totalForItems = (items: CheckoutLine[]) => items.reduce((total, item) => total + item.unitPrice * item.quantity, 0);

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
