# Latest Google authentication readback

The user reported another Google sign-in failure on 2026-10-21, with a screenshot showing the application's generic invalid-code message. The screenshot alone does not establish the provider's underlying error.

[Diagnostic run 39520801955](https://github.com/JJalal1/safeplaces-bimi/actions/runs/39520801955) verified the script syntax and its private-data projection with an offline canary. The actual readback then made three bounded API requests using the existing GitHub Actions Cloudflare credential.

## Observed configuration

- Active production Worker: safeplaces-production.
- Active version: e52b6904-cf5e-457a-bb27-504cd46f7264, 100% traffic, deployed 2026-10-20 at 23:20:11.322 UTC.
- Public GOOGLE_CLIENT_ID matches 1065235547111-41hr2mvfp3191sdvbd8c1ma306jkcb78.apps.googleusercontent.com.
- BETTER_AUTH_URL matches https://safeplaces.sa.
- GOOGLE_CLIENT_SECRET exists as a secret_text binding. Its value was neither read nor changed; presence does not establish correctness.

## Remaining evidence gap

The dry historical-logs query for 2026-10-21 00:05:00 through 00:21:23.889 UTC returned HTTP 403. No alternate credential or broader permission was attempted. The current connection to the direct Cloudflare connector also returned an internal error.

The prior confirmed provider failure was oauth_token/invalid_client. Do not assert that the newest attempt returned the same provider code: this readback could not retrieve its logs. A real Google sign-in was not performed or verified.

No application code, secret, database record, account, notification or deployment was changed. The one-off workflow was removed after preserving this report; the bounded reader remains for audit. Secure access to the Google OAuth client settings and the production Cloudflare settings is needed to compare the active client credentials and complete a real sign-in.

The exact sanitized response is in google-latest-readback-evidence.json. The run is marked failed because the log query was forbidden, not because the offline projection check failed.
