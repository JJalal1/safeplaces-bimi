import assert from 'node:assert/strict';
import { runReadback } from './check-google-runtime-readback.mjs';

const CANARY = 'PRIVATE_DATA_MUST_NEVER_APPEAR';
const TOKEN = 'dummy_credential_only_for_offline_test';
const NOW = Date.parse('2026-10-21T15:30:00Z');
const CF = 'https://api.cloudflare.com/client/v4/accounts/b67109c9489a46ae25fb36370c4ba880';
const PUBLIC = 'https://safeplaces.sa/api/session?scope=customer';
const DATABASE = 'da06d822-b7ee-4a14-b3a5-7bcbc5839821';
const urls = [
  CF + '/workers/scripts/safeplaces-production/deployments',
  CF + '/workers/scripts/safeplaces-production/settings',
  CF + '/workers/scripts/safeplaces-staging/deployments',
  CF + '/workers/scripts/safeplaces-staging/settings',
  CF + '/d1/database/' + DATABASE + '/query',
  PUBLIC,
];
const environment = { GITHUB_ACTIONS: 'true', GITHUB_REF: 'refs/heads/fix/google-login-latest', CLOUDFLARE_API_TOKEN: TOKEN };
const deployment = {
  deployments: [{ created_on: '2026-10-21T15:10:00Z',
    versions: [{ version_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', percentage: 100 }],
    metadata: CANARY, author: CANARY }],
};
const settings = {
  bindings: [
    { name: 'GOOGLE_CLIENT_ID', type: 'plain_text', text: '1065235547111-41hr2mvfp3191sdvbd8c1ma306jkcb78.apps.googleusercontent.com' },
    { name: 'BETTER_AUTH_URL', type: 'plain_text', text: 'https://safeplaces.sa' },
    { name: 'STANDALONE_AUTH_ENABLED', type: 'plain_text', text: 'true' },
    { name: 'EMAIL_PASSWORD_ENABLED', type: 'plain_text', text: 'true' },
    { name: 'GOOGLE_CLIENT_SECRET', type: 'secret_text', text: CANARY },
    { name: 'BETTER_AUTH_SECRET', type: 'secret_text', text: CANARY },
    { name: 'STANDALONE_ADMIN_USER_ID', type: 'plain_text', text: CANARY },
    { name: 'STANDALONE_ADMIN_EMAIL', type: 'plain_text', text: CANARY },
    { name: 'DB', type: 'd1', id: DATABASE },
  ],
};
const counts = {
  users: 3, googleAccounts: 2, credentialAccounts: 1, googleSessionsTotal: 4,
  activeGoogleSessions: 2, activePasswordSessions: 0, activeUnknownSessions: 0, verifiedGoogleUsers: 2,
  lastGoogleSessionCreatedAtMs: NOW - 30_000, lastGoogleAccountCreatedAtMs: NOW - 60_000,
};
const publicState = {
  authConfigured: true, emailPasswordEnabled: true, socialProviders: ['google', CANARY],
  user: { id: CANARY, email: CANARY, token: CANARY }, error: CANARY,
};
const responses = [deployment, settings, deployment, settings, [{ success: true, results: [{ ...counts, privateField: CANARY }] }], publicState];
function mock({ replace = new Map(), denied = -1, deniedStatus = 403, oversized = -1 } = {}) {
  const requests = [];
  return {
    requests,
    fetchImpl: async (url, options) => {
      const index = urls.indexOf(url);
      assert.notEqual(index, -1, 'Only exact known URLs may be requested.');
      assert.equal(options.redirect, 'error');
      if (index === 5) {
        assert.equal(options.method, 'GET');
        assert.equal(options.credentials, 'omit');
        assert.deepEqual(Object.keys(options.headers), ['Accept']);
        assert.equal(options.headers.Authorization, undefined);
        assert.equal(options.headers.Cookie, undefined);
        assert.equal(options.body, undefined);
      } else {
        assert.equal(options.headers.Authorization, 'Bearer ' + TOKEN);
        assert.equal(options.method, index === 4 ? 'POST' : 'GET');
        if (index !== 4) assert.equal(options.body, undefined);
      }
      requests.push({ url, options });
      if (index === denied) return new Response(CANARY, { status: deniedStatus });
      if (index === oversized) return new Response('x'.repeat(1024 * 1024 + 1));
      const value = replace.has(index) ? replace.get(index) : responses[index];
      return new Response(JSON.stringify(index === 5 ? value : { success: true, result: value }), { status: 200 });
    },
  };
}
function privateOutputAbsent(report) {
  const output = JSON.stringify(report);
  assert.equal(output.includes(CANARY), false);
  assert.equal(output.includes(TOKEN), false);
  assert.equal(report.googleSignInVerified, false);
  assert.equal(report.signInTestPerformed, false);
}

const baseline = mock();
const result = await runReadback({ now: NOW, environment, fetchImpl: baseline.fetchImpl });
assert.equal(result.status, 'READBACK_COMPLETED');
assert.equal(result.cloudflareRequestCount, 5);
assert.equal(result.publicRequestCount, 1);
assert.deepEqual(baseline.requests.map(r => r.url), urls);
assert.deepEqual(baseline.requests.map(r => r.options.method), ['GET', 'GET', 'GET', 'GET', 'POST', 'GET']);
assert.deepEqual(result.databaseCounters.counts, counts);
assert.equal(result.workers['safeplaces-production'].settings.productionDbBindingMatchesExpected, true);
assert.equal(result.workers['safeplaces-production'].settings.ownerIdBindingPresent, true);
assert.equal(result.workers['safeplaces-production'].settings.ownerEmailBindingPresent, true);
assert.deepEqual(result.publicSession.socialProviders, ['google']);
assert.deepEqual(result.publicSession.flags, { authConfigured: true, emailPasswordEnabled: true });
assert.equal(result.publicSession.userPresent, true);
assert.equal(result.publicSession.user, undefined);
const query = JSON.parse(baseline.requests[4].options.body);
assert.ok(query.sql.startsWith('SELECT\n'));
assert.equal(/\b(?:INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|REPLACE|PRAGMA|UNION)\b/i.test(query.sql), false);
assert.equal(query.sql.includes(';'), false);
assert.deepEqual(query.params, [NOW]);
assert.ok(query.sql.includes('COUNT(DISTINCT u.id)'));
assert.ok(query.sql.includes('MAX(created_at)'));
privateOutputAbsent(result);

for (const status of [401, 403]) {
  const denied = mock({ denied: 0, deniedStatus: status });
  const value = await runReadback({ now: NOW, environment, fetchImpl: denied.fetchImpl });
  assert.equal(value.status, 'READBACK_PARTIAL');
  assert.equal(value.cloudflareRequestCount, 1);
  assert.equal(value.publicRequestCount, 1);
  assert.equal(value.cloudflareAccessDenied, true);
  assert.deepEqual(denied.requests.map(r => r.url), [urls[0], PUBLIC]);
  privateOutputAbsent(value);
}
const deniedLater = mock({ denied: 3 });
const later = await runReadback({ now: NOW, environment, fetchImpl: deniedLater.fetchImpl });
assert.equal(later.cloudflareRequestCount, 4);
assert.equal(later.databaseCounters.category, 'cloudflare_requests_stopped_after_access_denied');
assert.equal(deniedLater.requests.some(r => r.url === urls[4]), false);
privateOutputAbsent(later);

const differentDatabase = structuredClone(settings);
differentDatabase.bindings.find(binding => binding.name === 'DB').id = CANARY;
const mismatch = mock({ replace: new Map([[1, differentDatabase]]) });
const mismatchResult = await runReadback({ now: NOW, environment, fetchImpl: mismatch.fetchImpl });
assert.equal(mismatchResult.databaseCounters.category, 'production_database_binding_not_verified');
assert.equal(mismatch.requests.some(r => r.url === urls[4]), false);
privateOutputAbsent(mismatchResult);

for (const badRow of [{ ...counts, users: CANARY }, { ...counts, activeGoogleSessions: -1 }, { ...counts, lastGoogleSessionCreatedAtMs: CANARY }]) {
  const invalid = mock({ replace: new Map([[4, [{ success: true, results: [badRow] }]]]) });
  const invalidResult = await runReadback({ now: NOW, environment, fetchImpl: invalid.fetchImpl });
  assert.equal(invalidResult.status, 'READBACK_PARTIAL');
  assert.equal(invalidResult.databaseCounters.ok, false);
  privateOutputAbsent(invalidResult);
}
const none = { ...counts, lastGoogleSessionCreatedAtMs: null, lastGoogleAccountCreatedAtMs: null };
const nullTimes = mock({ replace: new Map([[4, [{ success: true, results: [none] }]]]) });
const nullResult = await runReadback({ now: NOW, environment, fetchImpl: nullTimes.fetchImpl });
assert.equal(nullResult.databaseCounters.ok, true);
assert.equal(nullResult.databaseCounters.counts.lastGoogleSessionCreatedAtMs, null);

for (const overrides of [
  { now: Date.parse('2026-10-21T14:59:59Z') },
  { now: Date.parse('2026-10-21T16:00:01Z') },
  { environment: { ...environment, GITHUB_REF: 'refs/heads/main' } },
]) {
  let calls = 0;
  const blocked = await runReadback({ now: NOW, environment, ...overrides, fetchImpl: () => { calls++; throw new Error(CANARY); } });
  assert.equal(blocked.status, 'BLOCKED');
  assert.equal(calls, 0);
  privateOutputAbsent(blocked);
}
const big = mock({ oversized: 0 });
const tooBig = await runReadback({ now: NOW, environment, fetchImpl: big.fetchImpl });
assert.equal(tooBig.workers['safeplaces-production'].deployments.category, 'response_size_limit');
privateOutputAbsent(tooBig);

console.log('Runtime readback checks passed: exact request boundaries, read-only aggregate SQL, access-denial stop, private-data projection, anonymous public request, size limits, and expiry.');
