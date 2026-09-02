/**
 * Shapes returned by the existing /api/admin/* routes. These mirror the Prisma
 * models (prisma/schema.prisma) narrowed to the fields the routes actually
 * `include`, so the UI never reads a field the API doesn't send.
 */

export type Coupon = {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED";
  // Whole percent for PERCENT, paise for FIXED — same convention as the
  // route that writes it (see app/api/admin/coupons/route.ts).
  value: number;
  active: boolean;
  maxUses: number | null;
  usedCount: number;
  expiresAt: string | null;
  createdAt: string;
};

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
  hoverImageUrl: string | null;
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

export type Payment = { id: string; amount: number; method: string | null; note: string | null; recordedAt: string };

export type Order = {
  id: string;
  number: string;
  status: OrderStatus;
  paymentStatus: string;
  subtotal: number;
  shipping: number;
  total: number;
  amountPaid: number;
  payments: Payment[];
  carrier: string | null;
  trackingCode: string | null;
  createdAt: string;
  // Null for a manual/offline sale not tied to a registered account — see
  // customerName/customerPhone, which carry the walk-in's details instead.
  customer: { name: string; email: string } | null;
  customerName: string | null;
  customerPhone: string | null;
  /** Captured at checkout time, so it stays correct even if the address is later edited or deleted. Null for a manual sale with no delivery. */
  addressSnapshot: { phone: string; recipient: string; [key: string]: unknown } | null;
  items: { id: string; productId: string; name: string; sku: string; quantity: number; unitPrice: number; collectionId: string | null }[];
};

/* ---------- support chat ---------- */

export const CONVERSATION_STATUSES = ["OPEN", "CLOSED"] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];
export type MessageSender = "CUSTOMER" | "ADMIN";

/** `body` is "" on a message that is only an attachment — never both empty. */
export type ChatMessage = { id: string; sender: MessageSender; body: string; imageUrl: string | null; createdAt: string };
/** What /api/admin/conversations includes for product context — not a full Product. */
export type ChatProduct = { id: string; name: string; slug: string; imageUrl: string | null };
type ChatBase = {
  id: string;
  status: ConversationStatus;
  createdAt: string;
  lastMessageAt: string;
  customer: { id: string; name: string; email: string };
  product: ChatProduct | null;
};

/** Inbox row: the newest message flattened out, plus the unread-from-customer count. */
export type ConversationRow = ChatBase & {
  lastMessage: { body: string; imageUrl: string | null; sender: MessageSender; createdAt: string } | null;
  unread: number;
};
/** Opened thread: the whole history, oldest first. */
export type ConversationThread = ChatBase & { messages: ChatMessage[] };

/** Threshold the previous dashboard used, kept so the numbers stay comparable. */
export const LOW_STOCK_THRESHOLD = 10;
