import crypto from "crypto";

const RAZORPAY_API = "https://api.razorpay.com/v1";

function credentials() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) throw new Error("RAZORPAY_NOT_CONFIGURED");
  return { keyId, keySecret };
}

export type RazorpayOrder = { id: string; amount: number; currency: string; receipt: string };

/** amount is in paise (Razorpay's smallest-unit convention), matching how
 * every price in this codebase is already stored — no conversion needed. */
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
  if (!response.ok) throw new Error("RAZORPAY_API_ERROR");
  return response.json();
}

/** Razorpay's own signature scheme: HMAC-SHA256 of "order_id|payment_id",
 * keyed with the account secret — never the key id. */
export function verifyRazorpaySignature(orderId: string, paymentId: string, signature: string): boolean {
  const { keySecret } = credentials();
  const expected = crypto.createHmac("sha256", keySecret).update(`${orderId}|${paymentId}`).digest("hex");
  // timingSafeEqual throws on a length mismatch rather than returning false —
  // a malformed/short signature from the client shouldn't ever reach that.
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/** A different signature scheme from the one above, and a different
 * secret — this one's keyed with RAZORPAY_WEBHOOK_SECRET (set in the
 * Razorpay dashboard's own webhook screen, not the account's API secret),
 * and signs the *raw* request body rather than "order_id|payment_id". The
 * caller must pass the untouched body text, not a re-serialized/parsed
 * version — HMAC over a re-stringified JSON object won't byte-match what
 * Razorpay actually signed. */
export function verifyRazorpayWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) throw new Error("RAZORPAY_WEBHOOK_NOT_CONFIGURED");
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  if (expected.length !== signature.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
