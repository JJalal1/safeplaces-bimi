# Google login repair — acceptance checkpoint

**Checkpoint: 21 October 2026, 15:44 UTC. The exact repair commit passed CI, production and staging deployments succeeded, and the direct production readback passed. Human Google and email-inbox acceptance remain pending. This is not a completion report for the Word plan.**

## Deployed repair and evidence

Deployed repair: [`0127fa866a95f45300c15f1c8decaa2d5115f71a`](https://github.com/JJalal1/safeplaces-bimi/commit/0127fa866a95f45300c15f1c8decaa2d5115f71a).

The deployed repair propagates renewed session cookies to the browser, keeps internal server-rendering and administration session reads read-only, and reserves navigation while a Google request is in flight. Deployment changes preserve existing owner variables with `--keep-vars` for production and staging and add a production OAuth public-configuration preflight.

| Evidence | Recorded result |
| --- | --- |
| Earlier repair CI, [run 39625882006](https://github.com/JJalal1/safeplaces-bimi/actions/runs/39625882006) | Succeeded at 15:31:28 UTC, including the actual Worker renewal regression and all four Arabic/English mobile/desktop Google-navigation browser cases. |
| Final candidate CI, [run 39625768144](https://github.com/JJalal1/safeplaces-bimi/actions/runs/39625768144), attempt 2, [job 119313764948](https://github.com/JJalal1/safeplaces-bimi/actions/runs/39625768144/job/119313764948) | **PASSED for exact candidate 0127fa8**, independently verified; updated at 15:36:17 UTC with all required gates successful. |
| Production, [run 39627288721](https://github.com/JJalal1/safeplaces-bimi/actions/runs/39627288721), [validation job 119315710000](https://github.com/JJalal1/safeplaces-bimi/actions/runs/39627288721/job/119315710000), [deployment job 119317406867](https://github.com/JJalal1/safeplaces-bimi/actions/runs/39627288721/job/119317406867) | **ALL STEPS PASSED for exact head 0127fa8.** Deployment log reported version `6e83c238-894f-4f07-ade5-90e0ed6a2cb0` at 15:40:45.905 UTC; final public checks passed at 15:41:00.634 UTC. |
| Staging, [run 39627289104](https://github.com/JJalal1/safeplaces-bimi/actions/runs/39627289104) | **SUCCEEDED.** Deployment log reported version `9d543d08-fe5a-48d2-ac05-a6ceeaa8d7ad` at 15:40:35 UTC. |
| Archived configuration evidence, [commit 5cc9178](https://github.com/JJalal1/safeplaces-bimi/commit/5cc9178d72e9939954aedf139fb2daa74a71f07c) | Corrects the late 14:31 readback and preserves the 15:23 `READBACK_PARTIAL` result. D1 returned 403; counters are unavailable, not zero. |
| Bounded observer, [run 39626677429](https://github.com/JJalal1/safeplaces-bimi/actions/runs/39626677429) | **Transport failed.** Ready at 15:33:00.767 UTC; connection failed at 15:35:03.013 UTC. Zero frames and zero diagnostics were received; deletion/cleanup was confirmed at 15:35:03.013 UTC. No OAuth outcome was observed. Results were archived in [commit 13534f9](https://github.com/JJalal1/safeplaces-bimi/commit/13534f9e1c2192a63951dbf4fa343813346ce139), and the temporary observer workflow was removed. |
| Bounded post-deployment readback, [run 39628361702](https://github.com/JJalal1/safeplaces-bimi/actions/runs/39628361702), [job 119319587865](https://github.com/JJalal1/safeplaces-bimi/actions/runs/39628361702/job/119319587865) | **PASSED — READBACK_COMPLETED at 15:44:10.188 UTC**, with all workflow steps successful. Exactly two production GETs confirmed the deployed version at 100% and the required configuration/binding projections, without an access denial. Diagnostic source head: `10a6144ce9b1e002fbc7b170a8ee29e27fa3a120`. |

See [the completed post-deployment readback](GOOGLE_POST_DEPLOY_READBACK.md) and its [exact safe JSON evidence](google-post-deploy-readback-evidence.json). The navigation regression concerns an existing customer session interrupting the start of Google sign-in; it does not establish the cause of the user's reported Google error.

Production preflight passed public OAuth configuration, schema, migration and secret-name checks at 15:40:37 UTC. Log redaction, disabled invocation logs and disabled traces passed at 15:40:46.855 UTC. Live bilingual forms, private-cache rules, Google-only administration, email capability and password RPC checks passed at 15:40:55.933 UTC; public site, login, quote and bilingual SEO checks passed at 15:41:00.634 UTC. These checks created no customer account and sent no email.

## Acceptance matrix

| Acceptance item | Status at this checkpoint | Evidence still needed |
| --- | --- | --- |
| Renewal, server session reads and login-navigation code | **PASSED — exact final candidate CI and all required checks** | Human Google/session acceptance remains pending. |
| Production deployment | **PASSED — pipeline, live checks and direct readback succeeded** | Runtime version matches the successful deployment log at 100% traffic. Human authentication acceptance is tracked below. |
| Production Google/owner configuration | **PASSED — direct settings projection** | Google public ID/base URL match; secret is present as `secret_text`; both owner bindings are present. Secret validity and actual owner authorization require the human sign-in checks below. |
| Real Google customer/owner sign-in | **PENDING** | A fresh callback, persistent customer session after reload, correct owner authorization, and sign-out behavior. The user was invited to one fresh attempt around 15:34 UTC; no result has been received. |
| Email/password registration and sign-in | Implemented; automated browser lifecycle covered | Actual customer inbox delivery and human completion of verification, sign-in, recovery and session persistence. Local mocked email delivery does not establish inbox delivery. |
| Non-owner isolation, expiry, logout and devices | Automated coverage exists; human acceptance incomplete | Confirm the required live roles, session behavior and device/network cases after deployment. |
| Whole Word work plan | **INCOMPLETE — phase A acceptance remains the current gate** | Complete the remaining stages in the order below, recording evidence at each gate. |

The production source branch `feature/auth-speed-seo-before-hosting` was fast-forwarded from `b50b0775a7f0f084e808d601b34984dc6bffa193` to the repair commit around 15:37 UTC. This was not a main-branch merge. The direct readback confirms version `6e83c238-894f-4f07-ade5-90e0ed6a2cb0` at 100%, with Cloudflare deployment creation time 15:40:44.324 UTC; this matches the successful deployment log. The earlier version `0f58136e-71fb-43b0-b890-86ba533813cd` is inactive. Standalone/email-password flags are enabled, the Google secret and both owner bindings remain present, invocation logs are disabled, and traces are disabled. The secret value itself was not read or validated.

## Remaining Word-plan order

These are summaries of the already-read plan, not quoted Word headings. The user's later request adds email/password registration and sign-in to acceptance and supersedes the earlier email-disabled assumption.

| Phase | Recorded work and remaining order |
| --- | --- |
| **A — baseline and authentication** | A1 snapshot, A2 readiness and A3 503 repair were previously recorded complete. A4 production configuration was reconfirmed in this checkpoint. Remaining gate: A5 real Google/owner identity; A6 non-owner isolation, private access, expiry and logout; A7 devices. Include the new email/password requirement. |
| **B — quotes and notifications** | After A: live quote test without creating an order; events/notes, idempotency and isolation; real owner Zoho inbound/outbound; Resend From/Reply-To/DKIM with Zoho preserved; outbox inspection; planned business-notification test with actual inbox confirmation; controlled enablement. |
| **C — data and operations** | Independent D1 export outside the account and restore test; private R2 access with two accounts. Migration 0005 evidence was previously recorded complete. Run Cron after outbox/R2 acceptance, then consolidate deployment paths with unsafe historical paths disabled. |
| **D — launch and final acceptance** | Search Console ownership and sitemap; SEO, Core Web Vitals and structured data; real networks/devices; approved commercial claims and images; final acceptance PR ready for merge. |

No main-branch merge, pricing/payment activation, business-notification send, or DNS MX/SPF/Zoho change is recorded in this repair checkpoint.

## Recorded acceptance status

- **Final candidate CI:** PASSED — run 39625768144, attempt 2, exact head 0127fa8.
- **Production promotion and deployment:** DONE — source branch fast-forwarded around 15:37 UTC; run 39627288721 and every required step succeeded.
- **Production runtime/settings:** PASSED — run 39628361702 confirmed version `6e83c238-894f-4f07-ade5-90e0ed6a2cb0` at 100%, matching the deployment log, with required bindings present.
- **Staging deployment and checks:** PASSED — run 39627289104; version `9d543d08-fe5a-48d2-ac05-a6ceeaa8d7ad`.
- **Observer:** TRANSPORT FAILED — zero frames/diagnostics; cleanup confirmed; no Google outcome. Archived in commit 13534f9; temporary workflow removed.
- **User's fresh Google attempt and session persistence:** PENDING.
- **Real email inbox and verification/recovery acceptance:** PENDING.

Complete the pending human checks with actual results before accepting the full authentication stage. Passing automated tests and deployment readbacks does not complete human acceptance or the remaining Word plan.
