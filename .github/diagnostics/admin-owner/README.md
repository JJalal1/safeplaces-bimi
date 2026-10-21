# Temporary owner-binding format readback

This diagnostic addresses the reported administration login loop after customer Google login succeeded. It does **not** authenticate a user, verify the owner's identity, grant access or fix the owner configuration.

The only permitted network operations are two GET requests on the existing Cloudflare account and production Worker: latest deployment metadata, followed by Worker settings. The settings read is skipped unless the currently deployed version is exactly the previously verified `d48a65ff-dffa-4529-a383-b6b31568bbb7` at 100% traffic. Requests stop after any error or changed runtime. There are no retries, redirects, D1 queries, alternate credentials, historical logs, tails, mail, configuration changes or deployments.

Execution requires the known GitHub repository, `fix/google-login-latest` push event, first run attempt, exact reviewed identity-policy blob, and the fixed window **2026-10-21 20:26–20:45 UTC**. The existing `CLOUDFLARE_API_TOKEN` is available only to the final read step in the existing staging environment. No credential is installed or copied. The workflow has only `contents: read` permission.

The output reports presence/count/type and exact policy format flags for the two owner bindings. `secret_text`, unexpected types, duplicates and non-string values remain unreadable/unknown. No identifier, email, domain, hash of a value, secret, raw API response or error text appears in output. A format pass cannot prove that the current authenticated Google user matches the configured owner.

The offline suite disables real network access, exercises malformed/secret/duplicate bindings, exact UUID and email policy limits, scope guards, time limits, changed runtime, HTTP failures, privacy canaries and no-retry behavior. Run it with:

```sh
node .github/diagnostics/admin-owner/read-owner-binding-formats.test.mjs
```

Remove the temporary workflow after the readback is captured. Keep the bounded source, offline results and projected readback as audit evidence. Do not rerun after the time window or substitute another credential if Cloudflare refuses access.
