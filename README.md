# Funkopie Admin

The ecommerce authority: products, categories, stock, customers, carts, checkout, and order fulfilment.

## Run locally

1. Copy `.env.example` to `.env` and set a PostgreSQL `DATABASE_URL`, long `AUTH_SECRET`, and `ADMIN_API_KEY`.
2. Run `npm install`, `npx prisma migrate dev --name ecommerce`, and `npm run db:seed`.
3. Start with `npm run dev` on port 3000.

Public catalog is available at `/api/catalog/products`. Admin mutations require the `x-admin-key` header. Customer sessions are HTTP-only cookies. Customer auth assumes the storefront and admin apps sit on different origins/domains in production (set via `NEXT_PUBLIC_STORE_URL`), which is why the customer session cookie is `SameSite=None; Secure` there. Checkout is intentionally a simulated payment; it reduces stock and writes immutable item/address snapshots in one database transaction.
