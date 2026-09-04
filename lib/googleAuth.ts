import { createHash, randomBytes } from "crypto";

/* Google sign-in, hand-rolled against Google's OIDC endpoints rather than
   pulled in through NextAuth. The session this shop already uses is a signed
   JWT in a cookie, set by four small routes; adopting an auth framework to
   add one provider would mean replacing that working system and its
   cross-origin cookie handling, which is the fiddliest part of this setup and
   the part most likely to break silently.

   The flow is the standard authorization-code exchange with PKCE:

     /api/auth/google           → redirect to Google, remembering where to
                                  return and a one-time state + verifier
     /api/auth/google/callback  → Google sends the code back here; we swap it
                                  for tokens, read the verified id_token, and
                                  set the same session cookie a password
                                  login would

   PKCE is not strictly required for a confidential client that keeps a
   secret, but it costs one hash and removes the whole class of attack where
   an intercepted code is redeemed by someone else. */

export const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
export const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
export const GOOGLE_JWKS = "https://www.googleapis.com/oauth2/v3/certs";
export const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export const googleConfigured = () =>
  Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

/* The callback Google redirects to. It must match a URI registered on the
   OAuth client exactly — protocol, host and path — so it is derived from one
   env var rather than from the incoming request, which an attacker can
   influence via forwarded headers. */
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

/* Where to send the customer once they are signed in. Only paths on the
   storefront are allowed: taking a full URL from the query string and
   redirecting to it after authentication is an open redirect, and a
   convincing one, because it happens immediately after a real Google login. */
export function safeReturnTo(raw: string | null): string {
  const store = process.env.NEXT_PUBLIC_STORE_URL || "https://www.funkopie.in";
  if (!raw) return `${store}/account`;
  if (!raw.startsWith("/") || raw.startsWith("//")) return `${store}/account`;
  return `${store}${raw}`;
}
