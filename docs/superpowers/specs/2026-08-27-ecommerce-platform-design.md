# Ecommerce Platform Design

## Goal

Build two dedicated ecommerce applications: an administrator-facing inventory and fulfillment workspace, and a customer storefront.

## Architecture

`Ecommerce-site-admin` is a Next.js application backed by Prisma and PostgreSQL. It provides its dashboard and a versioned JSON API. `Ecommerce-site-` is a Next.js storefront which uses the API URL in `NEXT_PUBLIC_ECOMMERCE_API_URL` for catalog, customer, cart, and checkout operations.

The domain uses single-SKU products: each product has one price, cost, stock quantity, category, image, description, and visibility state. Checkout requires a signed-in customer, validates stock atomically, snapshots the delivery address/items, reduces stock, creates an order, and clears the cart. Payment is explicitly simulated.

## Capabilities

- Admins create and edit categories and products, including image URLs, SKU, price, cost, description, status, and stock.
- Admins adjust inventory with an audit record, view orders, and set delivery status, carrier, tracking code, and notes.
- Customers register/sign in, manage profile addresses, keep a cart, select a delivery address, choose a dummy payment method, and view orders.
- The storefront provides catalog browsing, category filters, product pages, cart, checkout, account, address book, and order history.

## Constraints

- Money is stored as integer paise/cents; display formatting happens at the UI boundary.
- No product variants and no live payment provider.
- Customer data is private to its owner; dashboard mutations need an admin session.
- Inventory must not become negative; cancelled orders restore quantities.
