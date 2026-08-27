# Ecommerce Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a deployable ecommerce admin/API and public storefront with products, stock, orders, accounts, addresses, cart, and dummy checkout.

**Architecture:** The admin Next.js app owns Prisma/PostgreSQL data and REST-like route handlers. The public Next.js app consumes its API through a configurable base URL. Order placement runs inside a Prisma transaction to snapshot products/address, decrement stock, create an order, and empty the cart.

**Tech Stack:** Next.js App Router, TypeScript, Prisma/PostgreSQL, Zod, JWT cookie sessions, Tailwind CSS, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-27-ecommerce-platform-design.md`

## Global Constraints

- Store money in integer paise/cents and expose formatted prices only in UI code.
- Use one stock quantity and one price per product; do not add variants.
- Use a dummy payment selection only; never add a payment SDK.
- Checkout must reject unavailable/insufficient stock and complete order/cart/inventory changes atomically.
- Existing portfolio repositories are out of scope.

---

### Task 1: Establish the admin application and ecommerce schema

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `prisma/schema.prisma`, `.env.example`
- Create: `lib/prisma.ts`, `lib/money.ts`, `lib/money.test.ts`

**Interfaces:**
- Produces `formatMoney(amount: number): string`, Prisma `Category`, `Product`, `Customer`, `Address`, `Cart`, `CartItem`, `Order`, `OrderItem`, and `InventoryAdjustment` models.

- [ ] Write `lib/money.test.ts` assertions for `199900 -> ₹1,999.00` and a zero amount.
- [ ] Run `npx vitest run lib/money.test.ts` and confirm the missing-module failure.
- [ ] Create the schema with single-price product and immutable order-item/address snapshots.
- [ ] Implement `formatMoney` using `Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" })` and run the test until green.
- [ ] Commit `feat: scaffold ecommerce admin domain`.

### Task 2: Implement authenticated catalog, account, cart, checkout, and fulfillment APIs

**Files:**
- Create: `lib/auth.ts`, `lib/checkout.ts`, `app/api/auth/register/route.ts`, `app/api/auth/login/route.ts`, `app/api/catalog/products/route.ts`, `app/api/catalog/products/[slug]/route.ts`
- Create: `app/api/customer/addresses/route.ts`, `app/api/customer/cart/route.ts`, `app/api/customer/checkout/route.ts`, `app/api/customer/orders/route.ts`
- Create: `app/api/admin/categories/route.ts`, `app/api/admin/products/route.ts`, `app/api/admin/inventory/route.ts`, `app/api/admin/orders/route.ts`

**Interfaces:**
- Consumes Prisma models and a signed cookie session.
- Produces public catalog reads, customer-owned resources, and admin-only management handlers.

- [ ] Write checkout service tests for insufficient stock and successful cart clearing.
- [ ] Run the targeted tests and confirm they fail before `lib/checkout.ts` exists.
- [ ] Add Zod request validation and explicit 400, 401, 403, 404, and 409 responses.
- [ ] Use `prisma.$transaction` for checkout and inventory mutations.
- [ ] Run tests/lint and commit `feat: add ecommerce api workflows`.

### Task 3: Build the administrator workspace

**Files:**
- Create: `app/admin/page.tsx`, `app/admin/products/page.tsx`, `app/admin/categories/page.tsx`, `app/admin/inventory/page.tsx`, `app/admin/orders/page.tsx`
- Create: `components/AdminNav.tsx`, `components/ProductForm.tsx`, `components/InventoryForm.tsx`, `components/OrderFulfillmentForm.tsx`

**Interfaces:**
- Consumes `/api/admin/*` endpoints.
- Produces management UIs for catalog, stock adjustments, and delivery progression.

- [ ] Create product forms that validate name, SKU, category, price, cost, stock, description, and image URL.
- [ ] Create inventory adjustment controls with reason and signed quantity input.
- [ ] Create order status controls that require a tracking code for shipped orders.
- [ ] Run `npm run lint && npm run build` and commit `feat: build ecommerce admin workspace`.

### Task 4: Build the public ecommerce storefront

**Files:**
- Create: storefront `package.json`, `app/layout.tsx`, `app/page.tsx`, `app/products/page.tsx`, `app/products/[slug]/page.tsx`, `app/cart/page.tsx`, `app/checkout/page.tsx`, `app/account/page.tsx`
- Create: `components/Header.tsx`, `components/ProductCard.tsx`, `components/CartClient.tsx`, `components/CheckoutClient.tsx`, `lib/api.ts`, `lib/money.ts`

**Interfaces:**
- Consumes catalog and customer endpoints at `NEXT_PUBLIC_ECOMMERCE_API_URL`.
- Produces responsive catalog browsing, cart, account, address selection, dummy payment, and order confirmation.

- [ ] Build catalog/product UIs with category filter, price display, and add-to-cart action.
- [ ] Build cart with quantity actions and a running subtotal.
- [ ] Build account login/register and saved-address capture.
- [ ] Build checkout with address selector, dummy payment choice, stock-error display, and confirmation.
- [ ] Run `npm run lint && npm run build` and commit `feat: launch ecommerce storefront`.

### Task 5: Verify and publish

**Files:**
- Create: admin `README.md`, storefront `README.md`, `prisma/seed.ts`

- [ ] Document local setup, `DATABASE_URL`, `AUTH_SECRET`, admin bootstrap, API URL, dummy payment, and migration/seed steps.
- [ ] Run `npm run lint`, tests, and production build in both repositories.
- [ ] Run `git diff --check` and inspect both repository statuses.
- [ ] Commit documentation and push each repository to its configured origin.
