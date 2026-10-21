# Current Safe Places auth observation — reviewed execution package

The bounded observer and cleanup safeguards have been locally reviewed and are ready for the reviewed GitHub Actions run. At this preparation checkpoint, the only execution performed was the offline test suite: **43 checks passed on Node 24.19.0**. No live observation has been performed by this preparation task, and this document supplies no live authentication result. The workflow does not deploy application code or edit production configuration.

## Files

- `observe-current-auth.mjs`: bounded observer, using Node 24's built-in `WebSocket` with `trace-v1` and `{ "debug": false }` initialization.
- `observe-current-auth.test.mjs`: offline transport mocks, sensitive canaries, scope guards, and cleanup failure cases. Both the global real network function and real WebSocket constructor are disabled in the test process.
- `offline-verification.json`: results from the local offline execution.
- `current-auth-observation.yml`: active GitHub Actions source ready for publication after review. A push on the exact diagnostic branch and paths listed below can start the run; a manual trigger is also available. It has `contents: read`, the existing `staging` environment, and uses the existing `CLOUDFLARE_API_TOKEN` secret only in the observation step.

## Exact operating scope

The script accepts only Node 24 in GitHub Actions for `JJalal1/safeplaces-bimi`, ref `refs/heads/fix/google-login-latest`. It uses the fixed account and `safeplaces-production` Worker already present in the previous observer. No account, Worker, URL, duration, window, or tail ID can be supplied through command-line arguments or changed through environment variables.

The creation window is **2026-10-21 15:15:00–16:15:00 UTC**. Collection ends at the earlier of 240 seconds after the script starts or 16:15 UTC. Time spent creating the tail counts toward that 240-second limit. A frame ceiling of 1,000 also ends collection. REST requests have a 15-second deadline each; final cleanup may finish after collection ends.

There are at most **two Cloudflare REST requests**:

1. `POST` to the fixed Worker's `/tails`, filtered to `GET`/`POST` invocations containing the fixed auth diagnostic prefix.
2. `DELETE` for the valid tail ID returned by that single successful creation.

There are no retries, history queries, settings/binding reads, deployment reads, D1 requests, old-tail cleanup, or login/email requests. The one WebSocket connection accepts only the fixed Cloudflare tail host with TLS. The signed URL, API token, tail ID, and API response contents stay in memory.

## What can leave memory

The event projector reads only the optional Worker-name guard, an event timestamp inside the current collection interval, and exact allowlisted diagnostic messages. It does not inspect request URLs, query strings, headers, cookies, account fields, IP addresses, request bodies, exception fields, or stack traces.

The saved evidence contains only a schema number and rows of:

```json
{
  "stage": "oauth_token",
  "code": "invalid_client",
  "firstTimestamp": "2026-10-21T15:20:00.000Z",
  "lastTimestamp": "2026-10-21T15:20:00.000Z",
  "count": 1
}
```

That example demonstrates the output shape; it is not a current production observation. Lifecycle and cleanup outcomes use the same fixed stage/code format. A `tail_ready` line is also emitted when protocol initialization has succeeded, so an operator can coordinate a fresh user attempt. The final JSON aggregate is authoritative; do not add its counts to the earlier readiness line.

Counts represent received events containing a category, deduplicated within each event. No request/user identifier is retained. Exact complete-message matching prevents a prefixed arbitrary message or object field from being copied to the evidence.

## Interpreting the result

| Current fixed category | What it can establish |
| --- | --- |
| `oauth_token/invalid_client` | A current observed token exchange was rejected with that provider code. It does not prove which person made the attempt or when settings changed. |
| `oauth_token/invalid_grant` | A current exchange returned that category. It does not identify the submitted code or by itself prove that a real Google account completed login. |
| `oauth_state/*` | The observed attempt failed at state verification; distinguish missing cookie/record, expiry, and rejection using the fixed code. |
| `oauth_account/account_not_linked` | The observed account flow reached the configured linking-policy rejection. No account identity is collected. |
| `oauth_account/session_creation_failed` | A session-creation failure was logged; further session/database investigation is needed. |
| `authentication/*` | The safe boundary reported an application failure; no raw exception is exposed. |
| `observation/no_fixed_diagnostic_observed` | No recognized category was captured during this limited interval. This is inconclusive. |

A zero exit code establishes that collection reached its deadline and cleanup was confirmed. It **does not establish Google login, email delivery, a valid browser session, persistence after reload, or success for the user's specific account**. The production auth logger chiefly records warnings/errors, so a successful login can be silent. This observer does not check the deployed version; it observes the selected Worker's current traffic and intentionally does not pin an older version ID. Concurrent traffic cannot be attributed to the user from this evidence.

This workflow is independent of deployment and configuration readback workflows. It neither waits for nor triggers a deployment, and it does not repeat deployment/settings reads or a denied D1 query. A separately confirmed deployment or correct binding types do not establish the outcome of a fresh token exchange or browser session; this observation collects only the fixed current diagnostic categories.

## Cleanup guarantees and limits

Once a successful create response provides a valid new tail ID, it is assigned before URL validation or WebSocket setup. A `finally` block closes the socket and attempts deletion for exactly that ID after transport validation failure, constructor/protocol/send failure, socket errors/close, cancellation, timeout, frame ceiling, output failure, or unexpected exceptions. Tests also verify that a socket-close exception cannot prevent deletion, and that artifact writing happens after the delete attempt.

The process handles `SIGINT` and `SIGTERM` by ending collection and proceeding to cleanup. The workflow timeout leaves room beyond the four-minute observation and bounded API cleanup. It never cancels another run automatically.

Two limits cannot be eliminated by local code:

- If creation reaches Cloudflare but its response is lost, malformed, or lacks a valid ID, the script cannot safely identify the new tail for deletion. It reports `tail_creation_not_confirmed`, does not retry, and does not list/delete unrelated tails.
- A forced process/runner termination or a denied/failed DELETE can prevent confirmed cleanup. `cleanup/forbidden` or `cleanup/not_confirmed` must not be reported as cleanup success. Collection still stops locally; an unconfirmed server-side tail remains subject to Cloudflare's expiration.

## Publication and execution

Run only the offline suite locally:

```sh
node observe-current-auth.test.mjs
```

Publish the reviewed observer and test files in `.github/diagnostics/current-auth/` and the workflow in `.github/workflows/current-auth-observation.yml`. The active workflow has only two trigger types: a matching push or `workflow_dispatch`. The automatic push trigger requires branch `fix/google-login-latest` and a change to one of these exact paths:

- `.github/diagnostics/current-auth/observe-current-auth.mjs`
- `.github/diagnostics/current-auth/observe-current-auth.test.mjs`
- `.github/workflows/current-auth-observation.yml`

A push changing only this README or unrelated repository files does not match the path filter. No schedule, `workflow_run`, pull-request, or deployment trigger is present. The job additionally checks the exact repository and branch at runtime. Publishing a matching commit can enqueue an observation without a separate manual dispatch. Use one intended run; avoid another matching push or a duplicate dispatch while that run is queued or active.

Keep the token in the existing environment secret; do not download or print its value. Queue delay does not move the collection window. Wait until the observation step is running and has emitted `tail_ready`, then coordinate a single fresh human login attempt. A queued or setup-only workflow is not yet observing the Worker. If GitHub starts the observer at or after **16:15 UTC on 2026-10-21**, its unchanged time guard refuses to create a tail. If it starts shortly before that deadline, collection is shortened to the remaining window.

If the window has ended or GitHub does not start the workflow, this package provides no new runtime evidence. Do not silently expand scope, query historical traces, replace credential routing, or describe old `invalid_client` evidence as a new result.

## Source references reviewed

- Previous observer at exact commit [`79a4bbfd706bf2427f216e0ea6bca5799d6255ba`](https://github.com/JJalal1/safeplaces-bimi/blob/79a4bbfd706bf2427f216e0ea6bca5799d6255ba/.github/diagnostics/check-mail-runtime.mjs), blob `8497222e66674238f638f22e8d41246d79fe0b66`.
- Production fixed logger at [`b50b0775a7f0f084e808d601b34984dc6bffa193`](https://github.com/JJalal1/safeplaces-bimi/blob/b50b0775a7f0f084e808d601b34984dc6bffa193/website/lib/auth-log-policy.ts).
- Wrangler 4.92.0 [`createTail.ts`](https://github.com/cloudflare/workers-sdk/blob/wrangler%404.92.0/packages/wrangler/src/tail/createTail.ts) and [`filters.ts`](https://github.com/cloudflare/workers-sdk/blob/wrangler%404.92.0/packages/wrangler/src/tail/filters.ts).

All source reads used GitHub APIs/approved GitHub readers. No historical Cloudflare log query was made.
