# Environment variables

Set on the **admin** project in Vercel (Settings → Environment Variables). Scope everything to at least **Production**; add **Preview** too if you deploy preview builds that need real data.

## Database (Prisma)

| Variable | Purpose |
|---|---|
| `MUMBAI_POSTGRES_PRISMA_URL` | Pooled connection (PgBouncer transaction mode, port `6543`, `?pgbouncer=true`). Used for all normal queries at runtime. |
| `MUMBAI_POSTGRES_URL_NON_POOLING` | Direct/session connection (port `5432`). Required for `prisma migrate deploy` — the pooler doesn't support the advisory locks migrations need. |

Get both from Supabase's **Connection pooling** tab, not the "Connection string" tab — that one gives a direct host that's IPv6-only and unreachable from a lot of networks/CI environments. The pooler host (`aws-0-<region>.pooler.supabase.com`) is IPv4-compatible.

## Storage

| Variable | Purpose |
|---|---|
| `MUMBAI_SUPABASE_URL` | Base URL for the Supabase project, e.g. `https://<ref>.supabase.co`. |
| `MUMBAI_SUPABASE_SERVICE_ROLE_KEY` | Server-side key for uploading to Storage (product photos, `.glb` models). Full read/write — never expose this to the browser. |

## Auth

| Variable | Purpose |
|---|---|
| `AUTH_SECRET` | Signs both admin and customer session JWTs (`lib/auth.ts`). Long random string. Rotating it invalidates every logged-in session. |
| `ADMIN_API_KEY` | The literal password checked at `/admin/login` (`app/api/auth/admin-login/route.ts`) and the value expected in the `x-admin-key` header for server-to-server admin API calls. |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Customer "Sign in with Google" (`lib/googleAuth.ts`). From a Google Cloud OAuth client — its **Authorized redirect URIs** must include exactly `{ADMIN_API_URL or the https://admin.funkopie.in default}/api/auth/google/callback`, or sign-in fails at the Google step. |
| `GOOGLE_REDIRECT_URI` | Optional override for the callback URL. Leave unset — it defaults to `${ADMIN_API_URL || "https://admin.funkopie.in"}/api/auth/google/callback`, which is almost always right. |
| `ADMIN_API_URL` | Optional. Only used to build the Google redirect URI above if you need it to differ from the `admin.funkopie.in` default. |

## Cross-origin config

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_STORE_URL` | The storefront's real origin, e.g. `https://www.funkopie.in`. Must **exactly** match the `Origin` header the browser actually sends — see [ARCHITECTURE.md § CORS](./ARCHITECTURE.md#cors-and-cross-origin-auth) if requests are failing with a CORS error. Also used to build the `fail`/`safeReturnTo` redirect targets in the Google OAuth flow. |

## Payments

| Variable | Purpose |
|---|---|
| `RAZORPAY_KEY_ID` | Public key ID. Also needed on the storefront as `NEXT_PUBLIC_RAZORPAY_KEY_ID` (same value). |
| `RAZORPAY_KEY_SECRET` | Server-side secret for creating/verifying orders. Never expose to the browser. |
| `RAZORPAY_WEBHOOK_SECRET` | Verifies webhook deliveries at `/api/webhooks/razorpay`. Set separately in the Razorpay dashboard's Webhooks screen — it is **not** the same value as `RAZORPAY_KEY_SECRET`. |

Rotating the Razorpay key pair invalidates the old one everywhere it's used — if another deployment of this app relies on the same live key, update it there too or its payments break.

## Storefront revalidation

| Variable | Purpose |
|---|---|
| `REVALIDATE_SECRET` | Shared secret between this app and the storefront's `/api/revalidate` — not tied to any external service, just needs to match on both projects (`lib/revalidateStorefront.ts`). Safe to regenerate any time; update both projects together. |
| `STOREFRONT_REVALIDATE_URL` | Optional. Defaults to `${NEXT_PUBLIC_STORE_URL}/api/revalidate`, which is almost always correct — leave unset unless the revalidate endpoint lives somewhere else. |

## Email

| Variable | Purpose |
|---|---|
| `RESEND_API_KEY` | Order confirmation emails via Resend. |
| `ORDER_EMAIL_FROM` | Optional, defaults to `FunkoPie <orders@funkopie.in>`. |
| `ORDER_EMAIL_REPLY_TO` | Optional, defaults to `funkopie7@gmail.com`. |

## Deployment protection

Vercel's own **Deployment Protection** (Project Settings → Deployment Protection, separate from anything in this table) must be **off**, or set to allow unauthenticated access to Production, on both the admin and storefront projects. Left on, it inserts a Vercel SSO login wall in front of every request — including server-to-server calls the storefront makes to the admin API at build and request time — which looks like a broken build or a silent data failure, not an auth error. See [`DEPLOYMENT.md`](./DEPLOYMENT.md#vercel-deployment-protection).
