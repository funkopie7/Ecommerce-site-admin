import type { Coupon, Prisma } from "@prisma/client";

export type AppliedCoupon = { code: string; amount: number };

export async function findActiveCoupon(client: Prisma.TransactionClient, code: string): Promise<Coupon> {
  const coupon = await client.coupon.findFirst({ where: { code: { equals: code.trim(), mode: "insensitive" } } });
  if (!coupon || !coupon.active) throw new Error("COUPON_INVALID");
  if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) throw new Error("COUPON_EXPIRED");
  if (coupon.maxUses !== null && coupon.usedCount >= coupon.maxUses) throw new Error("COUPON_EXHAUSTED");
  return coupon;
}

export function discountFor(coupon: Coupon, subtotal: number): number {
  const raw = coupon.type === "PERCENT" ? Math.round((subtotal * coupon.value) / 100) : coupon.value;
  return Math.max(0, Math.min(raw, subtotal));
}

export function couponErrorMessage(code: string): string | null {
  if (code === "COUPON_INVALID") return "That coupon code isn't valid";
  if (code === "COUPON_EXPIRED") return "That coupon has expired";
  if (code === "COUPON_EXHAUSTED") return "That coupon has already been fully redeemed";
  return null;
}
