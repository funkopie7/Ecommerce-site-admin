# Funkopie Admin

The ecommerce authority: products, categories, stock, customers, carts, checkout, and order fulfilment.

## Run locally

1. Copy `.env.example` to `.env` and set a long `AUTH_SECRET` and `ADMIN_API_KEY`. The default `DATABASE_URL` already matches the bundled Postgres container.
2. Run `npm run db:up` to start Postgres in Docker (`docker-compose.yml`, port 5434). `npm run db:down` stops it; `npm run db:logs` tails it.
3. Run `npm install`, `npx prisma migrate dev --name ecommerce`, and `npm run db:seed`.
4. Start with `npm run dev` (port 3900).

Public catalog is available at `/api/catalog/products`. Admin mutations require the `x-admin-key` header. Customer sessions are HTTP-only cookies. Customer auth assumes the storefront and admin apps sit on different origins/domains in production (set via `NEXT_PUBLIC_STORE_URL`), which is why the customer session cookie is `SameSite=None; Secure` there. Checkout is intentionally a simulated payment; it reduces stock and writes immutable item/address snapshots in one database transaction.
