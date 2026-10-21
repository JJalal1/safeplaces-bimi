# Safe Places customer launch readiness

This checkpoint covers the customer Google-linking repair, sign-out confirmation, route-shape SEO correction, and the operational checks completed on 21 October 2026 (UTC). It supplements the earlier Word-plan acceptance record; it does not replace missing live acceptance with fixture results.

## Release status

The verified source `fc48472fec8f0367a36acddf46248d746cf8be92` is deployed to production and protected staging. Every required step succeeded in the final review, production, staging and website CI runs. Direct Cloudflare readback at `2026-10-21T21:50:37.700Z` confirmed the new versions serving 100% in both environments.

| Environment | Worker version | Deployment evidence |
| --- | --- | --- |
| Production — https://safeplaces.sa | `b9e8d5c6-e097-432e-8a29-62941d21acb1` | [Run 39681125161](https://github.com/JJalal1/safeplaces-bimi/actions/runs/39681125161) |
| Protected staging | `6112ee9f-5f2b-4d1b-8aec-f9c42fd1de0c` | [Run 39681125158](https://github.com/JJalal1/safeplaces-bimi/actions/runs/39681125158) |

The requested customer fixes are published and their automated and non-mutating live checks passed. Full commercial-launch acceptance remains open for the specific real-account, inbox, storage/recovery and operational gates below. The existing pull request remains a draft.

## Customer changes

### Connect Google to an existing password account

An existing verified password account can add Google from **Account → Sign-in methods**. If Google sign-in reports `account_not_linked`, the customer is guided to sign in to the existing account and then connect Google. A management-target error offers the same fixed customer-account linking route while keeping management sign-in Google-only.

The linking request requires a current, verified and recently authenticated database-backed session. The callback rechecks the same session, user, verified email and fixed return targets before writing the Google provider link. Different-email linking, implicit email matching, client-supplied linking context, expired/revoked/switched sessions, and a Google subject already owned by another account are rejected. Linking retains the original account and data ownership. It does not turn the existing password session into a Google-authenticated management session.

After the one-time connection, the customer can sign in with Google or the existing password. Management still requires a subsequent Google sign-in and the existing owner/staff authorization.

### Confirm sign-out

Account, header/mobile-menu and management controls use the same Arabic/English confirmation. Arabic actions are **موافق** and **إلغاء**. Cancel and Escape preserve the session. Confirm sends a single pending request, prevents repeated submission and allows retry after a failure. Keyboard focus starts on Cancel, stays within the dialog, and returns to the triggering control when dismissed.

### Route shape and search readiness

Unsupported path suffixes now return 404 instead of exposing the same valid page under extra URLs. Valid bilingual pages and supported detail routes retain their behavior. Private/error pages retain the appropriate indexing and cache restrictions.

The build already generates immutable caching for versioned assets under `/_next/static/*`; a duplicate cache rule was not added. Existing self-hosted fonts, compressed images, dimensions, lazy loading, canonicals, language alternates, structured data, robots and sitemap were reviewed. Build asset totals are complete-output totals, not a measured per-page transfer or a field performance score.

## Verification evidence

All required steps succeeded in [review run 39680651741](https://github.com/JJalal1/safeplaces-bimi/actions/runs/39680651741), job `119501948199`, for exact source `fc48472fec8f0367a36acddf46248d746cf8be92`. The root independently read the completed job and logs and verified all 20 changed repository paths against their Git blob hashes.

The corrected fixture tests exercised the application itself for hostile/missing Origin requests and retained the no-store requirement. The successful API suite then completed all link-request, callback-session, identity-preservation and replay cases. The browser suites passed 42 bilingual route visits, 100 public viewport checks, 60 management viewport checks, and the four Arabic/English 390/1440-pixel customer lifecycles. The route suite passed 46 malformed-route cases and 48 valid-page requests.

See [validation-review.json](validation-review.json) for exact gates and focused results, and [client-asset-inventory-fc48472.json](client-asset-inventory-fc48472.json) for the actual build inventory. The earlier fixture failure and its correction are recorded without changing application security rules.

Automated tests use isolated customer accounts and local mail/Google fixtures. They verify account and file ownership, expiry/revocation, provider linking, request validation, and Arabic/English browser behavior. These results do not establish receipt in a real inbox or a real Google callback for the affected account.

## Current operational evidence

The pre-release Cloudflare readback confirmed the public/indexable quote-only site, standalone Google and email/password authentication, the expected production D1/R2 bindings, and presence of runtime-managed owner/auth/provider secret names without reading their values. Business notification sending remained disabled.

The separate operational readback at `2026-10-21T21:18:52.150Z` confirmed:

- Production has no configured Cron schedules.
- The private R2 bucket has neither a managed public domain nor a custom domain.
- Existing Zoho MX records remain configured.
- A Resend DKIM record, the existing DMARC policy and a Google verification record are present. DNS presence alone does not prove provider verification, inbox delivery, Search Console ownership acceptance or indexing.

The configured customer-mail sender is `info@safeplaces.sa`. Business mail also uses this configured From and Reply-To. Authentication mail is independent of the business-notification switch. This review did not send email, enable notifications, change DNS, rotate secrets or change owner assignments.

The post-deployment direct Cloudflare readback matched the production and staging versions reported by their deployment logs at 100% traffic. Both environments retained their expected database, private bucket and password-hasher bindings. Production public settings and secret-name/type metadata matched the pre-release readback, without reading secret values. OAuth query-string redaction remained enabled; invocation logs and traces remained disabled.

Production smoke checks passed for Arabic/English customer forms, private cache policy, Google-only management, email capability, deployed password hashing RPC, public/login/quotation routes and robots/sitemap availability. The probe explicitly created no accounts and sent no email. Staging protection checks confirmed Cloudflare Access on the canonical preview and denial of the historical alternate hostname.

See [post-deploy-runtime.json](post-deploy-runtime.json) for the direct configuration/deployment readback and [deployment-verification.json](deployment-verification.json) for exact job outcomes and focused log evidence. The deployment log's label “bilingual search indexing” is interpreted here only as robots/sitemap availability and indexability, not actual Google indexing.

## Remaining Word-plan acceptance

| Gate | Current evidence and required completion |
| --- | --- |
| A: new live account flow | Earlier customer Google sign-in and management UI were accepted by the user. The new linking/logout flow still needs acceptance with the affected real account; exact live roles, session lifecycle and a second account remain separate from local fixtures. |
| A: real verification and recovery mail | Verify actual message receipt and complete both customer flows through the received links. Secret names and a successful API request do not establish inbox delivery. |
| B: live quotation and business mail | Validate a controlled real quotation and management history, review the outbox and configured recipient, and establish actual mailbox/provider/inbox acceptance before automatic business sending is enabled. |
| C: private storage and recovery | Complete live two-account attachment access checks and an independent database export/restore into a separate database, with R2 recovery coverage. The migration bookmark is not an independent backup. |
| C: scheduled operations | Configure and verify production Cron after the prerequisite outbox and R2 acceptance. The scheduled handler exists, but the production schedule readback is empty. Consolidation of overlapping deployment paths remains a later operational-plan item. |
| D: search and real performance | Complete Search Console acceptance and sitemap submission, measure real performance, and finish physical-device/network acceptance. Robots/sitemap availability establishes indexability, not actual search indexing. Commercial content/image approval and final release acceptance also remain to be recorded. |

The browser environment returned an explicit access-policy refusal for the requested Resend domains dashboard. Existing restrictions also prevented interactive production-admin inspection. No alternate route or credential was used to bypass these restrictions. Prior denied production data operations were not retried through another identity or endpoint. These limits prevent claiming that the full commercial-launch checklist is complete.

## Customer instructions after deployment

1. Open [تأكيد الدخول لربط Google](https://safeplaces.sa/ar/account/login?return_to=%2Far%2Faccount%3Ftab%3Dsecurity&reason=link-google) and sign in with the existing website account email and password. If the website password is forgotten, use the password-recovery option first.
2. Open **طرق تسجيل الدخول / Sign-in methods** and select **ربط Google / Connect Google**.
3. Select the Google account with the same verified email. If fresh sign-in is requested, select **تأكيد تسجيل الدخول**, enter the existing website account password, and then select **ربط Google** again after returning to Sign-in methods. Reauthentication does not automatically restart Google authorization.
4. After the connection succeeds, use either Google or the existing password. For management, return to Administration and sign in with Google.
5. On sign-out, choose **إلغاء** to stay signed in or **موافق** to end the session.

No new Google Client Secret is required by this repair.
