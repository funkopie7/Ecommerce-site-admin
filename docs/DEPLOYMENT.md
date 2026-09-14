# Deployment

Both apps deploy to Vercel, auto-building on every push to `main` via the normal GitHub integration. No special CI config.

## Region

Vercel Functions run in `bom1` (Mumbai) for both projects — this is Vercel's default region selection and needs no explicit config.

## Vercel Deployment Protection

New Vercel projects default to **SSO/Deployment Protection enabled** on every URL that isn't a custom domain — including the auto-generated `<project>.vercel.app` alias. While that's on:

- Anyone hitting the raw `.vercel.app` URL gets bounced to a Vercel login wall instead of the app.
- The storefront's own build/runtime fetches to the admin API (for `generateStaticParams`, catalog data, etc.) get blocked too — they're server-to-server requests, not authenticated browser sessions, so they hit the same wall. This surfaces as a **build failure** (`SyntaxError: Unexpected token '<'... is not valid JSON` — the build tried to parse the SSO login page's HTML as an API response) or, at runtime, as pages silently falling back to hardcoded placeholder data.

Turn it off (Project Settings → Deployment Protection → Vercel Authentication) on **both** projects before relying on custom domains being the only thing gating access. If you want the admin dashboard itself gated later, do it with the app's own admin login, not this.

## Custom domains

`funkopie.in` (storefront) and `admin.funkopie.in` (admin) point at the Vercel projects via DNS. `funkopie.in` (bare, no `www`) redirects to `https://www.funkopie.in` — see [`ENVIRONMENT.md`](./ENVIRONMENT.md#cross-origin-config) for why the exact redirected origin matters for `NEXT_PUBLIC_STORE_URL`.

## Triggering a real production deploy without a code change

Vercel's own dashboard "Redeploy" button, and some automation tooling, can create a **Preview** deployment even against the `main` branch — it only counts as Production if it's a genuine push to the Production Branch. If you need to force a fresh production build (e.g. after only changing env vars, which don't take effect until a rebuild), the reliable way is an empty commit:

```bash
git commit --allow-empty -m "Trigger production deploy"
git push origin main
```

## Database migrations

`prisma migrate deploy` runs as part of `npm run build` (`package.json`'s `build` script: `prisma migrate deploy && next build`), so migrations apply automatically on every deploy — there's no separate manual migration step. This is also why `MUMBAI_POSTGRES_URL_NON_POOLING` (the direct/session connection, not the pooled one) has to be set correctly at build time, not just at runtime.

## Google OAuth redirect URI

Whatever domain the admin app is actually reachable at, that exact URL — `https://<domain>/api/auth/google/callback` — must be added to the Google Cloud OAuth client's **Authorized redirect URIs** list (console.cloud.google.com → APIs & Services → Credentials), or customer Google sign-in fails at the Google step with a redirect URI mismatch.
