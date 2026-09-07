export type Coupon = {
  id: string;
  code: string;
  type: "PERCENT" | "FIXED";
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

export type Product = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  compareAtPrice: number | null;
  cost: number;
  stockQuantity: number;
  imageUrl: string | null;
  hoverImageUrl: string | null;
  visible: boolean;
  franchise: string | null;
  character: string | null;
  edition: string | null;
  variantType: string;
  condition: string;
  isPreorder: boolean;
  releaseDate: string | null;
  featured: boolean;
  images: string[];
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
  customer: { name: string; email: string } | null;
  customerName: string | null;
  customerPhone: string | null;
  addressSnapshot: { phone: string; recipient: string; [key: string]: unknown } | null;
  items: { id: string; productId: string; name: string; sku: string; quantity: number; unitPrice: number; collectionId: string | null }[];
};

export const CONVERSATION_STATUSES = ["OPEN", "CLOSED"] as const;
export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];
export type MessageSender = "CUSTOMER" | "ADMIN";

export type ChatMessage = { id: string; sender: MessageSender; body: string; imageUrl: string | null; createdAt: string };
export type ChatProduct = { id: string; name: string; slug: string; imageUrl: string | null };
type ChatBase = {
  id: string;
  status: ConversationStatus;
  createdAt: string;
  lastMessageAt: string;
  customer: { id: string; name: string; email: string };
  product: ChatProduct | null;
};

export type ConversationRow = ChatBase & {
  lastMessage: { body: string; imageUrl: string | null; sender: MessageSender; createdAt: string } | null;
  unread: number;
};
export type ConversationThread = ChatBase & { messages: ChatMessage[] };

export const LOW_STOCK_THRESHOLD = 10;
