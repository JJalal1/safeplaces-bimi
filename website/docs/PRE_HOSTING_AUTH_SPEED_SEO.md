# Safe Places: authentication, performance, and SEO before hosting

## Scope and deployment policy
This branch keeps the existing pages, design, D1/R2 schema, public URL, and Sites deployment untouched. No public production login is enabled from this branch.

## Authentication (next implementation stage, independent of Supabase)
1. Add a supported self-hosted authentication library (proposed: Better Auth) with its Drizzle SQLite adapter. Verify the exact compatible package versions with Vinext, Cloudflare Workers, D1, and the current pnpm lockfile.
2. Add the library-managed user/account/session/verification schema through additive Drizzle migrations in a separate development D1 database. Keep `customers`, `orders`, `quotes`, and `customer_wishlists` intact. Map the verified auth user ID to the existing `customer:<uuid>` convention (or migrate those references atomically).
3. Preserve the `CustomerLogin` visual UI, Arabic/English copy, and safe return paths. Wire email/password signup, verification, sign-in, secure cookie session, sign-out, recovery, and session expiry. Use a transactional email provider with verified sender/domain; never commit credentials.
4. Keep admin access distinct from customer signup. Replace Sites-only `oai-authenticated-user-*` header trust and native sign-in routes with verified server-side authorization. Never accept client-supplied identity headers on public Workers.
5. Gate release with integration tests (sign-up, verify, login, revoke, reset, redirects, cookie flags, request rate limits, CSRF, and multi-user isolation). Do not activate `SITE_PUBLIC=true` until production admin auth is verified.

## Performance work already staged
- `/api/session?scope=customer` skips unnecessary `adminUser()` and `canBootstrap()` reads while retaining verified customer lookup.
- Store/wishlist UI uses this lighter endpoint; the existing unscoped session endpoint remains compatible for management checks.
- Metadata rendering only queries CMS content where needed (service/category/project detail pages).
- **Before production:** benchmark Cloudflare Pagespeed / Core Web Vitals (LCP, INP, CLS), optimize CSS/JS splitting, and cache only anonymous, non-sensitive pages after confirming cache invalidation on content changes.

## Saudi SEO work already staged
- Organization structured data mentions the verified Al Khobar / Eastern Province location and service region.
- Preserve `/ar` and `/en` hreflang and canonical pairs.
- **On domain cutover:** update `SITE_URL` and origin policy together; configure production domain, robots indexability, sitemap, Search Console, and an accurate Google Business Profile. Do not claim guaranteed rankings.

## Hosting intentionally last
- When authorized, independently configure Cloudflare Worker, D1 `DB`, R2 `BUCKET`, runtime secrets, transactional email, custom domain and TLS.
- Export existing hosted D1/R2 data with authorization; the GitHub snapshot contains content but not private customers, orders, messages or uploaded objects.
- Deploy to a staging Worker and verify all tests before making a DNS or production switch.

## Verification limitation
This branch was edited via the GitHub connector. Full `pnpm install`, `pnpm run build`, and integration tests were not executed because this execution environment cannot reach GitHub/package registries and has no installed pnpm dependencies. All changes need CI checks or local verification before merge.
