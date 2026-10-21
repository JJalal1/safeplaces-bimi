# Google runtime readback — 21 October 2026

## Result

**`READBACK_PARTIAL` at 2026-10-21 15:23:45.552 UTC.** [Run 39625234333](https://github.com/JJalal1/safeplaces-bimi/actions/runs/39625234333), [job 119308598640](https://github.com/JJalal1/safeplaces-bimi/actions/runs/39625234333/job/119308598640), read Worker configuration and the anonymous public session endpoint. The aggregate D1 query returned **403**, so account and session statistics are **unavailable**.

**No Google sign-in test was performed, and Google sign-in is not verified.** This diagnostic did not change production code, settings, or secrets.

## Observed configuration

| Observation | Production | Staging |
| --- | --- | --- |
| Active version | `0f58136e-71fb-43b0-b890-86ba533813cd` — 100% | `6e5bb927-02c3-4dd3-838f-96cf82609cd3` |
| Deployment created | 2026-10-21 14:37:11.826 UTC | 2026-10-20 23:20:27.723 UTC |
| Google client ID matches production constant | Yes | No |
| Better Auth base URL matches production constant | Yes | No |
| Standalone authentication flag | Enabled | Enabled |
| Email/password flag | Enabled | Enabled |
| Google secret binding | Present; `secret_text` | Present; `secret_text` |
| Owner ID and email bindings | Both present | Both present |
| Production database binding matches expected database | Yes | Not evaluated |

The staging comparison uses production's constants. Its two false results do not establish a staging configuration failure; this check did not compare staging with its own expected values. Binding presence does not validate a secret value or owner authorization.

The production version differs from the earlier [14:31 UTC readback](GOOGLE_STATUS_READBACK.md). The newer deployment timestamp and secret binding presence do not establish which secret value was activated or whether that value works.

## Database and public-session limits

The reader made four Cloudflare GET requests and one read-only aggregate-query POST. The query received 403 using the existing Cloudflare API token. It made no retries, used no alternative credential, and stopped further Cloudflare requests after the denial.

Consequently, user/account counts, active-session counts, verified-Google-user counts, and the latest Google account/session creation times were not obtained. They must not be interpreted as zero.

A separate anonymous GET to `https://safeplaces.sa/api/session?scope=customer` returned HTTP 200 with `authConfigured: true`, `emailPasswordEnabled: true`, `socialProviders: ["google"]`, and `userPresent: false`. It sent no authorization header or cookies. The absent user is the result of this anonymous request, not a test of a customer's signed-in browser.

## GitHub delay context

GitHub's official [incident nms1dpzmh9d9](https://www.githubstatus.com/incidents/nms1dpzmh9d9) began at 14:52:49.969 UTC with pull-request and webhook delays. An update at 15:15:04.970 UTC also reported degraded Actions performance; the incident was being investigated when observed. The source was GitHub's [unresolved-incidents API](https://www.githubstatus.com/api/v2/incidents/unresolved.json).

This is contemporaneous service context. It does not establish that the incident caused this specific workflow's delay.

## Evidence and acceptance

The structured record is [google-runtime-readback-evidence.json](google-runtime-readback-evidence.json). The earlier corrected report remains separate and unchanged.

A new Google callback and a customer session that survives page reload still need verification before accepting the reported login problem as repaired. This readback alone supplies configuration evidence, not that acceptance.
