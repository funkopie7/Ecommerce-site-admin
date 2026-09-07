import { createHash, randomBytes } from "crypto";

export const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
export const GOOGLE_JWKS = "https://www.googleapis.com/oauth2/v3/certs";
export const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export const googleConfigured = () =>
  Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const redirectUri = () =>
  process.env.GOOGLE_REDIRECT_URI ||
  `${process.env.ADMIN_API_URL || "https://admin.funkopie.in"}/api/auth/google/callback`;

export const base64url = (input: Buffer) =>
  input.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

export function newVerifier() {
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  return { verifier, challenge };
}

export const newState = () => base64url(randomBytes(16));

export function safeReturnTo(raw: string | null): string {
  const store = process.env.NEXT_PUBLIC_STORE_URL || "https://www.funkopie.in";
  if (!raw) return `${store}/account`;
  if (!raw.startsWith("/") || raw.startsWith("//")) return `${store}/account`;
  return `${store}${raw}`;
}
