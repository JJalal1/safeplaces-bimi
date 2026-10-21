# Google sign-in status readback — 21 October 2026

## Corrected outcome

The bounded production reader completed successfully at **2026-10-21 14:31:49 UTC**, after the earlier check had stopped observing the queue. [Run 39617569452](https://github.com/JJalal1/safeplaces-bimi/actions/runs/39617569452), [job 119282446044](https://github.com/JJalal1/safeplaces-bimi/actions/runs/39617569452/job/119282446044), returned `READBACK_COMPLETED` with exactly two Cloudflare GET requests.

This supersedes the earlier statement that the reader produced no live evidence. The check at 14:26:19 UTC had not yet observed a run; the successful run was created later, at 14:31:41 UTC.

**Google sign-in was not tested and is not verified by this report.** This configuration reading may predate the user's latest `GOOGLE_CLIENT_SECRET` update. A present secret binding does not verify the value, establish which update is active, or demonstrate a working Google callback and persistent customer session.

## Evidence from the completed readback

| Observation | Result at 14:31:49 UTC |
| --- | --- |
| Worker | `safeplaces-production` |
| Requests | Two GET requests: Worker deployments and settings |
| Active version | `e52b6904-cf5e-457a-bb27-504cd46f7264` |
| Traffic percentage | 100% |
| Deployment creation time returned by Cloudflare | `2026-10-20T23:20:11.322Z` |
| Deployment response shape | Valid; matched the previously known version |
| Google client ID | Matched the known public production client ID |
| Better Auth base URL | Matched the expected `https://safeplaces.sa` |
| `GOOGLE_CLIENT_SECRET` | Present, with type `secret_text` |
| Google sign-in test | Not performed |
| Google sign-in verified | False |

The diagnostic used two read-only endpoints and did not change production code or secrets. No Google client secret value was read, copied into the repository, or included in the diagnostic output. The report records binding presence and type only.

The corresponding machine-readable evidence is in [google-status-readback-evidence.json](google-status-readback-evidence.json). It preserves the earlier observation under `supersededObservation`, including its original timestamp and access failures.

## Timeline and preserved history

| UTC time on 21 October 2026 | Observation |
| --- | --- |
| 00:21:23.889 | The earlier readback confirmed version `e52b6904-cf5e-457a-bb27-504cd46f7264`. |
| 14:26:19 | The status check had observed no diagnostic run. It recorded `LIVE_READBACK_NOT_EXECUTED` and zero runner requests. This was an observation of the queue at that time. |
| 14:31:41 | GitHub created run `39617569452` for diagnostic commit `297166ae48c8c3598bd3a8968b57c8d8a836817d`. |
| 14:31:49.290 | The reader returned `READBACK_COMPLETED`, reconfirming the deployment and settings shown above. |

During the earlier check, the Cloudflare connector returned internal error `-32603`, and the Cloud Browser reported `Forbidden. Calls to this URL are not allowed.` Those access failures remain historical facts, but they did not prevent the later GitHub runner from obtaining the two successful responses.

The local syntax, request-boundary, private-data projection, and expiry checks had passed, and the reader source received independent review. The workflow for this observation was subsequently removed during archival. Its reader accepted starts only through 2026-10-21 14:50 UTC. This document records the completed historical run; it makes no claim about whether a separate, newer diagnostic workflow is present.

At the earlier source check, the production branch was at `b50b0775a7f0f084e808d601b34984dc6bffa193`, and the last observed successful production deployment workflow was [39513925186](https://github.com/JJalal1/safeplaces-bimi/actions/runs/39513925186). Those are historical source observations, not a fresh assessment of the runtime after the user's latest secret update. A secret update made directly in Cloudflare does not necessarily change the GitHub branch.

## Next verification

Obtain a fresh runtime reading after the user's latest secret update, then complete a new Google sign-in. Accept the repair only after the resulting customer session is created, the Google account's email is verified, and the session remains valid after reloading the account page. Owner administration requires its own authorization check.

The 14:31 UTC result confirms the configuration facts listed above at that observation time. It does not establish that the latest secret is valid or that the reported sign-out problem has been repaired.

