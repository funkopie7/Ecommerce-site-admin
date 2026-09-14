# Architecture

FunkoPie is two separate Next.js apps talking over HTTP, not one monolith:

- **Admin** (this repo) — Prisma/Postgres, all business logic, the customer-facing API, and the operator dashboard. Deployed at `admin.funkopie.in`.
- **Storefront** ([`Ecommerce-site-main`](https://github.com/funkopie7/Ecommerce-site-main)) — a Next.js frontend with no database of its own. Every product, order, and setting it shows comes from this app's API. Deployed at `funkopie.in`.

They're on different origins in production, which matters a lot — see [CORS and cross-origin auth](#cors-and-cross-origin-auth) below.

## Data layer

- **Postgres** — one Supabase Postgres project, accessed through Prisma. Two connection strings are used: a pooled one (`MUMBAI_POSTGRES_PRISMA_URL`, PgBouncer transaction mode, port 6543) for normal queries, and a direct one (`MUMBAI_POSTGRES_URL_NON_POOLING`, port 5432) for `prisma migrate deploy`, since migrations need a session-level connection.
- **Supabase Storage** — product images (with pre-generated `w320`/`w640`/`w1280` resized variants) and `.glb` 3D models live in the `product-images` bucket, accessed via `MUMBAI_SUPABASE_URL` / `MUMBAI_SUPABASE_SERVICE_ROLE_KEY`.
- Why the `MUMBAI_` prefix: this project's Supabase integration was originally set up with that label. It's just a naming convention baked into the env var names and the Prisma schema — it doesn't mean anything is actually tied to a specific region beyond wherever the underlying Postgres project's IP actually is. Don't read significance into the name.
- There is a second, legacy Supabase project referenced by `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` (no prefix), used only by `lib/uploads.ts` as a fallback path for chat-image uploads if `MUMBAI_SUPABASE_URL` isn't set. In practice all current data lives in the one `MUMBAI_` project; this fallback is dead weight that was never cleaned up. Safe to ignore unless you're specifically working on chat attachments.

## Prisma models

`Category`, `Product`, `Collection`, `CollectionItem`, `Review`, `Customer`, `Address`, `Cart`, `CartItem`, `Order`, `OrderItem`, `Payment`, `PaymentIntent`, `Coupon`, `InventoryAdjustment`, `Wishlist`, `WishlistItem`, `Conversation`, `Message`, `HeroPreset`, `StoreSettings`.

`StoreSettings` is a singleton (`id = "store"`) holding theme colors, the homepage hero figure's model/rotation/paint/box art, and the Chase Room's curated product picks. `HeroPreset` is the same shape as a saveable, switchable set — see [`HERO_3D.md`](./HERO_3D.md).

## Route groups

- `app/api/admin/**` — operator-only mutations (products, orders, customers, settings, uploads). Gated by the `admin_session` cookie or the `x-admin-key` header (see [`AUTH.md`](./AUTH.md)).
- `app/api/catalog/**` — the public read API the storefront actually calls: products, collections, settings. No auth.
- `app/api/customer/**` — cart, checkout, wishlist, addresses, reviews, conversations. Gated by the `customer_session` cookie.
- `app/api/auth/**` — admin login/logout, customer email/password login/register, and the Google OAuth flow.
- `app/(dashboard)/**` — the actual admin UI (categories, products, orders, customers, settings, the hero paint studio launcher, etc.).

## Checkout

Checkout is real — Razorpay Standard Checkout, verified server-side via `app/api/webhooks/razorpay` and `app/api/customer/checkout/razorpay-verify`. A successful order writes immutable item/address snapshots and decrements stock in one database transaction (`lib/createOrder.ts`), except for preorder line items, which skip the stock decrement.

## CORS and cross-origin auth

Because the storefront and admin apps are different origins, two things have to line up or nothing works:

1. **`middleware.ts`** only sets `Access-Control-Allow-Origin` when the request's `Origin` header exactly string-matches `NEXT_PUBLIC_STORE_URL` (an env var on *this*, the admin, project). "Exactly" means scheme, host, and no trailing slash — `https://funkopie.in` and `https://www.funkopie.in` are different origins to a browser even though a human reads them as the same site. If your domain redirects bare → `www` (or vice versa), `NEXT_PUBLIC_STORE_URL` must be set to wherever the browser actually ends up after that redirect, not the vanity URL.
2. **Customer session cookies** are set `SameSite=None; Secure` in production specifically so they survive being sent cross-origin from the storefront to the admin API. This only works over HTTPS with real domains — it silently breaks on plain HTTP or on Vercel's protected preview URLs if [Vercel Deployment Protection](./DEPLOYMENT.md#vercel-deployment-protection) is left on, since that inserts its own SSO redirect before any app code runs.

## The hero 3D system

The homepage's rotating figure, its photo-based auto-paint, the hand-paint studio, and the Chase Room curation picker are a fairly unusual custom subsystem — see [`HERO_3D.md`](./HERO_3D.md) for how it actually works.
