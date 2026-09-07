import crypto from "crypto";

const RAZORPAY_API = "https://api.razorpay.com/v1";

function credentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error("RAZORPAY_NOT_CONFIGURED");
  return { keyId, keySecret };
}

export type RazorpayOrder = { id: string; amount: number; currency: string; receipt: string };

export class RazorpayApiError extends Error {
  description: string;
  constructor(description: string) {
    super(description);
    this.description = description;
  }
}

export async function createRazorpayOrder(amount: number, currency: string, receipt: string): Promise<RazorpayOrder> {
  const { keyId, keySecret } = credentials();
  const response = await fetch(`${RAZORPAY_API}/orders`, {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ amount, currency, receipt }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    const description: string = body?.error?.description || `HTTP ${response.status}`;
    console.error("Razorpay order creation failed", response.status, body?.error ?? body);
    throw new RazorpayApiError(description);
  }
  return response.json();
}

export function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string): boolean {
  const { keySecret } = credentials();
  const expected = crypto.createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export function verifyRazorpayWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new Error("RAZORPAY_WEBHOOK_NOT_CONFIGURED");
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
