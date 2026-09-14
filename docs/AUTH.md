# Authentication

Two entirely separate auth systems live in this codebase — admin and customer. They don't share sessions or cookies.

## Admin

There's no admin user table or password hashing — the "password" is a single shared secret, `ADMIN_API_KEY`, checked directly:

```ts
// app/api/auth/admin-login/route.ts
if (parsed.data.key !== process.env.ADMIN_API_KEY) return error("Incorrect admin key", 401);
```

On success, a JWT (`{ role: "admin" }`, signed with `AUTH_SECRET`, 12-hour expiry) is set as the `admin_session` cookie (`httpOnly`, `sameSite: "lax"`, `secure` in production). `lib/api.ts`'s `requireAdmin` checks that cookie (or, for server-to-server calls, an `x-admin-key` header matching `ADMIN_API_KEY` directly) on every `app/api/admin/**` route; `lib/guard.ts`'s `requireAdminPage` does the equivalent redirect-to-login check for the dashboard pages themselves.

Because it's one shared key rather than per-user accounts, there's no way to tell *which* admin made a change, and rotating the key logs everyone out at once — logging out one person isn't possible.

## Customer

Two ways in:

1. **Email/password** — `app/api/auth/register` and `app/api/auth/login`.
2. **Google OAuth (PKCE)** — `app/api/auth/google` (initiator) and `app/api/auth/google/callback`. Flow:
   - `/api/auth/google` generates a `state` + PKCE `code_verifier`/`code_challenge`, stores them in short-lived cookies (`google_state`, `google_verifier`, `google_return`, 10-minute expiry), and redirects to Google.
   - Google redirects back to `/api/auth/google/callback` with a `code`. The callback checks the returned `state` against the cookie, exchanges the code for an ID token, verifies it against Google's JWKS, and finds-or-creates a `Customer` by `googleId` (falling back to matching by email).
   - **This only works if the initiating request and the callback land on the same origin** — if `google_state` was set while the browser was on one host and the callback lands on a different one (e.g. the storefront linked to an old `.vercel.app` admin URL while the redirect URI defaults to the real custom domain), the cookie won't be sent and it fails with "That sign-in link expired." This isn't actually about link expiry — it's a same-origin cookie mismatch. If you see this, check that whatever URL the storefront's `ECOMMERCE_API_URL`/`NEXT_PUBLIC_ECOMMERCE_API_URL` points at matches where Google is actually configured to redirect back to.

Either way, a successful login sets a `customer_session` JWT (`{ customerId, email }`, 30-day expiry) as an HTTP-only cookie. In production it's `SameSite=None; Secure` specifically so it survives being sent from the storefront's origin to the admin API's origin — see [`ARCHITECTURE.md` § CORS](./ARCHITECTURE.md#cors-and-cross-origin-auth).

Every `app/api/customer/**` route calls `customerFromRequest` (`lib/auth.ts`) directly to read and verify this cookie.
