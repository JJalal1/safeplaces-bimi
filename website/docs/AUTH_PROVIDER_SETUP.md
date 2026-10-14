# Safe Places: Google login, one owner and delegated administration

Source on branch `feature/auth-speed-seo-before-hosting` is **not live**. Never merge until dependencies, D1 migrations, security checks and actual end-to-end Google sign-in pass.

## Initial scope

- **Customer and staff authentication:** Better Auth + Google only, not Supabase. Google's own official account picker is used. Never collect Google credentials.
- **Owner:** exactly one owner, configured by the operator out of band using BOTH the stable Better Auth user UUID and the same verified Google email: `STANDALONE_ADMIN_USER_ID` + `STANDALONE_ADMIN_EMAIL`. The owner is never created through public registration or employee invitations.
- **Staff:** the owner adds Google addresses through **Admin > Team & permissions**, granting individual admin sections. The first Google login after approval must verify the email, then the invitation is bound to that immutable user UUID. Later sessions require the same UUID, verified email, active record and current grants. Revoking a member immediately removes admin API access. Every section is guarded server-side, with filtered dashboard data.
- **Customers:** Google accounts that are not an approved owner or staff remain customers. They cannot enter administration. Staff have their own customer identities as well.
- **Deferred:** password login, outbound email/password-reset, Apple, Microsoft, Facebook, staff invitations by email, and actual payment gateway integration. These must be individually implemented/tested before enabling them.

## Google Cloud

Create Google OAuth Web application for `safeplaces.sa` with:
- Authorized JavaScript origin: `https://safeplaces.sa`
- Authorized redirect URI: **`https://safeplaces.sa/api/auth/callback/google`**
- External audience: Testing until the real live site, privacy policy, and login flow are confirmed.
- Add each person signing in during Google Testing to the OAuth app's **Test users** in Google Cloud (including all invited staff).

The `safeplaces.sa` DNS/domain verification in Search Console is independent of hosting and does **not** mean the app has been deployed.

## Production/staging configuration

Store each secret in Cloudflare Worker **secrets**, never GitHub. Required for Google-only auth:
- `STANDALONE_AUTH_ENABLED=true` after migrations on the intended database
- `SITE_PUBLIC=true` on a public Worker
- `BETTER_AUTH_URL=https://safeplaces.sa` for the production domain (use staging URL in staging)
- `BETTER_AUTH_SECRET` high-entropy random secret of at least 32 characters
- `GOOGLE_CLIENT_ID` and **private** `GOOGLE_CLIENT_SECRET` from Google Cloud
- D1 binding `DB` and R2 binding `BUCKET`
- `STANDALONE_ADMIN_USER_ID` from the immutable authenticated Better Auth user record of the designated owner; set only after a verified owner Google login
- `STANDALONE_ADMIN_EMAIL` the **same** owner's verified Google email

**Do not copy a guessed UUID, allow promotion by email alone, or share client secrets.** Owner bootstrap must be done out-of-band through a trusted deployment administration process, never from the public customer signup or staff invite form. With missing owner config, staff can only join once already approved by an owner; public owner access remains disabled. Ensure owner is configured before distributing access.

Password/email delivery is **not enabled** in the first Google-only rollout. `RESEND_API_KEY` and `AUTH_EMAIL_FROM` are not required for Google login.

## Database

Run storefront migrations 0000/0001 first, then:
- `drizzle/0002_standalone_auth.sql`: Better Auth user/session/account/verification tables
- `drizzle/0003_admin_members.sql`: staff invitations, grants and bound identities

Use a **fresh staging D1 database first**, verify migration order and Better Auth schema compatibility. This must not be applied blindly to an existing production database.

Team members have a unique normalized invitation email, optional immutable user UUID, JSON array of allowed admin section names, and active flag. No extra owners exist in the team table. Permission changes take effect on the next API request because membership and grants are read on each request.

## Permission enforcement

Grants correspond to the existing admin menu sections: overview; orders; quotes; contacts; products; categories; brands; customers; coupons; homepage and about; services; projects; previous clients; certificates; activity history; store settings. Staff **cannot** edit team membership.

Both the navigation and API endpoints are permission-restricted. `GET /api/admin/data` only returns data applicable to the allowed sections; the `dashboard` itself does not unlock orders, customers or other department records; overview widgets show only data from other independently approved sections. Media download and upload access are also enforced. These controls **must be rechecked via real integration and security tests**, including forbidden direct API requests.

Current caveat: a section permission permits both viewing and editing that section; more granular read-only roles are **not yet implemented**.

## Verification before deployment

1. Install dependencies and regenerate the lockfile; ensure pinned Better Auth and Drizzle adapter versions actually install together.
2. Run `pnpm exec tsc --noEmit --incremental false`, `node scripts/check-standalone-auth-policy.mjs`, `node scripts/check-admin-permissions.mjs`, `node scripts/check-customer-auth.mjs`, `pnpm run build`, and `node scripts/check-site.mjs`.
3. Compare live Better Auth schema version with `db/auth-schema.ts`.
4. Apply both migrations to staging; test actual Google callback, session cookies, account picker, login/logout and unauthorized customers.
5. Test owner and staff signup, one-time email identity binding, pending invitations, unapproved and revoked accounts, each permitted section, direct API abuse, staff uploads and cross-account private media, and logs.
6. Confirm owner can revoke staff even when an employee remains signed into Google.
7. Only then cut over the domain and enable public traffic. Hosting is **not purchased or connected yet**.

**Status:** Coding in draft PR; no verified live Google sessions, owner UUID, customer or employee sign-in, migrated independent D1 or public deployment. Do not publish yet.
