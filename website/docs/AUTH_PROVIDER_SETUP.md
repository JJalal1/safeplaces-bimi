# Safe Places: customer identity providers and launch checklist

These credentials must be configured **privately**, never in GitHub. The frontend displays only providers whose client ID and secret are configured. No personal authentication accounts or provider credentials are present in this repository.

## User-visible methods

- Email + password: 12-character minimum; confirmed email required; reset link and session revocation.
- Google: OAuth with `prompt: select_account` to display Google's own account picker.
- Apple: official Apple Sign In. Requires Apple Developer Services ID, App ID, Team ID, Key ID and a signed **JWT client secret**. Apple's secret expires and must be renewed; do not use the raw .p8 file in a public repository.
- Microsoft: Microsoft Entra app registration; consumer and organizational accounts depend on app registration. For `tenantId: common`, configure supported account types accordingly.
- Facebook: Meta Developer application and Facebook Login product.
- Never collect a user's Google/Apple/Microsoft/Facebook password on Safe Places forms.

## OAuth callback destinations

For the verified production host, configure:
- `https://safeplaces.sa/api/auth/callback/google`
- `https://safeplaces.sa/api/auth/callback/apple`
- `https://safeplaces.sa/api/auth/callback/microsoft`
- `https://safeplaces.sa/api/auth/callback/facebook`

Configure the exact approved URL in each provider console. All account selection and consent is done on the provider's own pages. Preview hostnames need separately registered callback URLs; Apple requires public HTTPS rather than localhost.

## Private runtime configuration

Required:
- `STANDALONE_AUTH_ENABLED=true` only after applying `drizzle/0002_standalone_auth.sql` to the correct environment
- `BETTER_AUTH_URL=https://safeplaces.sa`
- `BETTER_AUTH_SECRET` random 32+ character secret (ideally 32 bytes of high-entropy material)
- `RESEND_API_KEY` and `AUTH_EMAIL_FROM` for a verified company sending domain
- D1 binding named `DB` and R2 binding `BUCKET`
- `STANDALONE_ADMIN_USER_ID` (verified immutable UUID) and `STANDALONE_ADMIN_EMAIL` for the *owner only*
- OAuth client ID and client secret for each enabled provider: `GOOGLE_*`, `APPLE_*`, `MICROSOFT_*`, `FACEBOOK_*`

Apple: supply a *generated* signed JWT as `APPLE_CLIENT_SECRET` and monitor its expiration. A long-term integration should regenerate the signed JWT using a secure private-key secret and a vetted JOSE library rather than leaving a token to expire unnoticed.

## Database and application restrictions

- Tables `auth_user`, `auth_session`, `auth_account`, `auth_verification` are distinct from storefront `customers`, `orders`, `quotes`, `customer_wishlists`.
- Only a verified email with immutable UUID gets a `customer:<uuid>` order/account owner ID.
- Admin access requires independent, private server-side configured ID + verified email. Customer registration never creates admins.
- When standalone auth is active, site-owner or spoofed `oai-authenticated-user-*` headers must never grant administrative access.
- No shared caching of session, auth, account, wishlist or admin responses.
- Do not enable public signups in production until provider callback, email confirmation, CSRF, signup, password reset and logout have been integration tested.

## Validation

1. Install the pinned dependencies and regenerate/commit `pnpm-lock.yaml` with `pnpm install`; verify Drizzle adapter + Better Auth versions match.
2. Run `pnpm exec tsc --noEmit --incremental false`, `node scripts/check-standalone-auth-policy.mjs`, `node scripts/check-customer-auth.mjs`, `pnpm run build`, and `node scripts/check-site.mjs`.
3. Validate schema using the installed Better Auth version's schema generator (review output against `db/auth-schema.ts` and migration).
4. Apply D1 migration to a **fresh staging database**, not the production database.
5. On staging, test every identity provider, email verification and password reset *with actual email delivery*, multiple accounts and revocation. Confirm cookie flags and HTTPS.
6. Verify owner login, admin endpoint guards, and that no customer can read other customers' orders or quotes.
7. Only then plan Cloudflare hosting and domain cutover; no hosting purchase is necessary during development.

**Current status:** Prepared source only. Real provider credentials, package installation, lockfile synchronization, live end-to-end tests and deployment are still required. Do not merge/deploy without passing all checks.
