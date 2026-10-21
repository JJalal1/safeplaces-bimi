# Production readback after the Google login repair

## Confirmed result

**`READBACK_COMPLETED` at 2026-10-21 15:44:10.188 UTC.** [Run 39628361702](https://github.com/JJalal1/safeplaces-bimi/actions/runs/39628361702), [job 119319587865](https://github.com/JJalal1/safeplaces-bimi/actions/runs/39628361702/job/119319587865), completed all steps successfully. Exactly two GET requests read the production Worker deployments and settings; no access denial occurred.

| Observation | Confirmed state |
| --- | --- |
| Active production version | `6e83c238-894f-4f07-ade5-90e0ed6a2cb0` at **100%** |
| Deployment creation time returned by Cloudflare | `2026-10-21T15:40:44.324Z` |
| Match with successful deployment log | Yes |
| Previous version `0f58136e-71fb-43b0-b890-86ba533813cd` | Inactive; runtime comparison is `NEW` |
| Google public client ID and Better Auth base URL | Both match the production constants |
| `GOOGLE_CLIENT_SECRET` | Present, type `secret_text` |
| Standalone and email/password flags | Both enabled |
| Owner ID and owner email bindings | Both present; values are not recorded |
| Logging settings | Logs enabled; invocation logs disabled; traces disabled |

## Evidence chain and request scope

The application repair is [commit 0127fa8](https://github.com/JJalal1/safeplaces-bimi/commit/0127fa866a95f45300c15f1c8decaa2d5115f71a). The [production pipeline 39627288721](https://github.com/JJalal1/safeplaces-bimi/actions/runs/39627288721) passed validation, deployment and every live check. Its deployment log reported the same version at 15:40:45.905 UTC. Public OAuth configuration, schema/migration, secret-name, log-protection, bilingual forms, private-cache, administration-form, email-capability, password-RPC and public-site checks passed. Those live checks created no customer account and sent no email.

The diagnostic used [source commit 10a6144](https://github.com/JJalal1/safeplaces-bimi/commit/10a6144ce9b1e002fbc7b170a8ee29e27fa3a120). Its **37 offline checks** passed before the live read step. They cover exact URLs/methods, private-canary projection, version comparison, optional observability, denial stops, response size, timeout, context/credential guards and expiry.

The only live requests were GETs to `safeplaces-production/deployments` and `safeplaces-production/settings` under the Cloudflare Workers API. There was no D1 query, staging request, website request, email, login, retry or alternative credential. Each request was bounded by a 15-second timeout and 1 MiB response limit; redirects were rejected. The fixed request window was 15:35–16:15 UTC.

The immutable safe record is [google-post-deploy-readback-evidence.json](google-post-deploy-readback-evidence.json). It includes the run/job/source identifiers, validation booleans and exact sanitized report.

## Acceptance limits

This result confirms the deployed runtime and the listed configuration projections. Secret-binding presence does not validate the secret value, and owner-binding presence does not prove successful owner authorization.

**`signInTestPerformed` and `googleSignInVerified` remain `false`.** A human Google callback, session persistence after reload, role isolation/logout and actual email-inbox verification/recovery acceptance remain pending. This reader did not obtain account or session counters; the earlier D1 403 must not be interpreted as zero accounts or sessions.

The [repair acceptance checkpoint](GOOGLE_LOGIN_REPAIR_CHECKPOINT.md) records the successful deployment and readback alongside those pending checks. Phase A remains the gate for the remaining Word-plan stages.
