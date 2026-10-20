# Verified customer email accounts

This release adds customer registration, sign-in, verification mail, password recovery and sign-out to the existing Better Auth / D1 application. Arabic and English pages share the same server policy. Google remains an independent sign-in provider.

## Environment

- `STANDALONE_AUTH_ENABLED=true` and the existing valid `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`, and `DB` binding are required.
- `EMAIL_PASSWORD_ENABLED=true`, a valid `AUTH_EMAIL_FROM`, `RESEND_API_KEY`, and the internal `AUTH_PASSWORD_HASHER` binding are all required before password forms and endpoints open.
- `AUTH_EMAIL_FROM=info@safeplaces.sa` uses the already configured domain. No DNS, Zoho routing, MX or SPF changes are part of this release.
- Operational `EMAIL_NOTIFICATIONS_ENABLED` stays false. Customer-requested verification and recovery messages are separate from quotation notifications.
- The staging Worker currently has no Resend credential. Its password option stays closed until that environment is deliberately configured; the full lifecycle is verified with a local Resend transport in CI.

## Session and password policy

New passwords contain 12–128 characters. Better Auth's pinned native scrypt implementation runs inside a SQLite Durable Object with its own CPU budget. Sixteen bounded object names are used, without user identifiers, stored passwords, logging, or a public fetch endpoint. There is no weaker fallback inside the HTTP Worker and no paid-plan upgrade.

Verification is required before password sign-in. Verification links expire after one hour and do not create a session. Recovery tokens expire after 30 minutes, are consumed once, and revoke existing sessions when the password changes. Verification links can be revisited idempotently; they are not described as single-use recovery tokens.

Session cookies remain host-only, HttpOnly and SameSite=Lax, and Secure on HTTPS. Session validity is checked against D1 without cookie caching. Public forms cannot set user IDs, verified-email state, session method, ownership or administration permissions.

Administration additionally requires a server-recorded successful Google callback session. Password sessions remain customer sessions even when their verified identity matches an owner's UUID. Existing sessions receive `auth_method='unknown'` during migration and require a fresh Google sign-in for administration. Automatic account linking remains disabled: an email-first account does not silently acquire a Google identity with the same address. Google credential errors must be fixed separately; adding password access does not prove an owner can enter the administration console.

## Release order

1. Run the full validation workflow on `fix/customer-email-auth`. It includes native password RPC, server authorization, two customer identities and private ownership, recovery replay/expiry, and four Arabic/English mobile/desktop browser lifecycles. Test mail terminates in an in-memory transport.
2. Inspect the exact target database, retain a current D1 recovery bookmark and validate the new additive migration. Apply only `0005_auth_session_method.sql`, then record its SHA-256, application time and bookmark in `safeplaces_migrations`. Do not rerun bootstrap or migrations 0000–0004.
3. Verify the target and recorded migration through `check-email-auth-release.mjs`. A recovery bookmark is not an independent exported backup and does not satisfy that later handover requirement.
4. Release through `safeplaces-auth-buttons-deploy.yml`. Historical production workflows are disabled because they could close the public site or restore conflicting indexing flags. Public pages, bilingual indexing, quotation-only commerce and existing credentials are preserved.
5. Keep invocation logs and traces disabled. Query redaction alone cannot remove recovery tokens embedded in URL paths. Only fixed authentication diagnostic categories and fixed mail-acceptance messages are emitted.
6. Run `check-live-email-auth.mjs`. Its nonexistent-account sign-in exercises the deployed password RPC, must return 401, and creates no account or email. Provider acceptance and a recipient's actual inbox receipt are separate evidence.

## Remaining handover gates

This release does not claim to complete real owner Google sign-in, recipient inbox receipt, live two-customer attachment acceptance, independent backup/restore, Search Console ownership, commercial-content approval or the final PR merge. These remain subject to the original sequential acceptance plan and current live evidence.
