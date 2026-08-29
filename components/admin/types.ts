/**
 * Shapes returned by the existing /api/admin/* routes. These mirror the Prisma
 * models (prisma/schema.prisma) narrowed to the fields the routes actually
 * `include`, so the UI never reads a field the API doesn't send.
 */

export type Category = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  visible: boolean;
  _count?: { products: number };
};

/** The badge vocabulary. `code` is what lands in Product.badges. */
export type Tag = {
  id: string;
  code: string;
  label: string;
  tone: string;
  updatedAt: string;
};

export type Product = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  cost: number;
  stockQuantity: number;
  imageUrl: string | null;
  visible: boolean;
  franchise: string | null;
  character: string | null;
  edition: string | null;
  releaseDate: string | null;
  badges: string[];
  categoryId: string;
  category: { id: string; name: string };
  updatedAt: string;
};

export type CollectionItem = {
  id: string;
  productId: string;
  quantity: number;
  product: Pick<Product, "id" | "name" | "sku" | "price" | "imageUrl">;
};

export type Collection = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  price: number;
  compareAtPrice: number | null;
  visible: boolean;
  items: CollectionItem[];
  updatedAt: string;
};

export const ORDER_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "PACKED",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type Order = {
  id: string;
  number: string;
  status: OrderStatus;
  paymentStatus: string;
  subtotal: number;
  shipping: number;
  total: number;
  carrier: string | null;
  trackingCode: string | null;
  createdAt: string;
  customer: { name: string; email: string };
  items: { id: string; name: string; sku: string; quantity: number; unitPrice: number }[];
};

/** Threshold the previous dashboard used, kept so the numbers stay comparable. */
export const LOW_STOCK_THRESHOLD = 10;
