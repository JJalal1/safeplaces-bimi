# Production authentication mail evidence

The deployed application remains commit `b50b0775a7f0f084e808d601b34984dc6bffa193`, production Worker version `e52b6904-cf5e-457a-bb27-504cd46f7264` at 100% traffic. The diagnostic branch does not deploy application changes.

## Verified

The production verification-mail endpoint was called once on 2026-10-21 at 00:01:36 UTC for the already existing nonhuman Resend simulator fixture. The request returned HTTP 200 without a session cookie. A real-time event matched the unique request marker, route, Worker and version; it recorded `Safe Places auth diagnostic email/verification_accepted`, outcome `ok`, and zero exceptions. This confirms provider acceptance. It does not establish receipt in a human inbox.

The temporary real-time log channel was deleted successfully with HTTP 200. The earlier unused channel was also already removed.

## Cleanup remains blocked

The exact fixture passed all identity, unused-account and foreign-key cascade guards immediately before cleanup. Its UUID is `02f762db-ea6c-4384-929a-fc94a22a8801`; its only email is `delivered+safeplaces-auth-b50b0775a7f0@resend.dev`. It was unverified and had no sessions, verification records, business records or staff references. The guarded DELETE received HTTP 403, Cloudflare error 7403, using the existing GitHub Actions deployment credential. No row was deleted. No alternative credential was attempted after denial.

The GitHub Actions run is therefore marked failed even though the mail observation step passed. Read the individual reports in `auth-mail-evidence.json`; do not report the entire run as successful or the fixture as removed.

The one-off workflow was removed after preserving this evidence so a later push cannot resend test mail automatically. The guarded cleanup plan and runner remain available for a future execution through explicitly authorized D1 write access. Do not replace the fixture identity, remove reference checks, weaken authentication, add an HTTP deletion endpoint or broaden a token merely to obtain a green result.

## Application acceptance

- [Full customer email/password and browser validation](https://github.com/JJalal1/safeplaces-bimi/actions/runs/39513198774): success.
- [Production validation and deployment](https://github.com/JJalal1/safeplaces-bimi/actions/runs/39513925186): success.
- [Staging validation and deployment](https://github.com/JJalal1/safeplaces-bimi/actions/runs/39513925192): success.
- [Live mail observation and guarded cleanup](https://github.com/JJalal1/safeplaces-bimi/actions/runs/39518730778): mail accepted; cleanup blocked by D1 write permission.

Browser verification used in-memory email delivery, and the separate production observation above confirmed the real provider path. A customer's receipt and use of a real verification link remains an acceptance check.

Google sign-in has not been accepted: the last observed Google token exchange failed with `oauth_token/invalid_client`. A matching active Google Client Secret must be securely configured for the existing OAuth client, followed by a real Google sign-in. Customer password sign-in cannot confer administrator access. Other handover stages remain subject to their original acceptance gates.
