import assert from 'node:assert/strict';
import { runOwnerReadback } from './read-owner-binding-formats.mjs';

const CANARY = 'PRIVATE_RESPONSE_OR_SECRET_MUST_NOT_APPEAR';
const TOKEN = 'offline_dummy_token_never_sent_to_network';
const ID = '12a45678-1234-4123-8123-123456789abc';
const EMAIL = 'fixture-owner-unique@example.invalid';
const SUBJECT = '998877665544332211009';
const ACCOUNT = 'b67109c9489a46ae25fb36370c4ba880';
const EXPECTED = 'd48a65ff-dffa-4529-a383-b6b31568bbb7';
const START = Date.parse('2026-10-21T20:26:00Z');
const NOW = Date.parse('2026-10-21T20:30:00Z');
const END = Date.parse('2026-10-21T20:45:00Z');
const urls = ['deployments', 'settings'].map(kind => 'https://api.cloudflare.com/client/v4/accounts/' + ACCOUNT + '/workers/scripts/safeplaces-production/' + kind);
const environment = {
  GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'JJalal1/safeplaces-bimi',
  GITHUB_REF: 'refs/heads/fix/google-login-latest', GITHUB_EVENT_NAME: 'push', GITHUB_RUN_ATTEMPT: '1',
  SAFEPLACES_OWNER_POLICY_BLOB: 'e8c4267191f4fd5c25da666928212f9af4a16cbc',
  CLOUDFLARE_API_TOKEN: TOKEN,
  // Neither an alternative credential nor an alternative destination may be used.
  CLOUDFLARE_D1_READ_TOKEN: CANARY, CLOUDFLARE_API_BASE_URL: 'https://invalid.example/' + CANARY,
};
const deployment = {
  deployments: [{ versions: [{ version_id: EXPECTED, percentage: 100 }], author: CANARY }, { versions: CANARY }],
  private: CANARY,
};
const settings = {
  bindings: [
    { name: 'STANDALONE_ADMIN_USER_ID', type: 'plain_text', text: ID },
    { name: 'STANDALONE_ADMIN_EMAIL', type: 'plain_text', text: EMAIL },
    { name: 'GOOGLE_CLIENT_SECRET', type: 'secret_text', text: CANARY },
    { name: 'BETTER_AUTH_SECRET', type: 'secret_text', text: CANARY },
    { name: 'DB', type: 'd1', id: CANARY },
    { name: CANARY, type: CANARY, text: CANARY },
  ],
  private: CANARY,
};
const originalFetch = globalThis.fetch, originalTimeout = AbortSignal.timeout;
let realNetworkAttempts = 0;
const timeoutValues = [], checks = [];
globalThis.fetch = async () => { realNetworkAttempts++; throw new Error('Network disabled during offline tests'); };
AbortSignal.timeout = value => { timeoutValues.push(value); return originalTimeout(value); };

function mock({ modifiedSettings = settings, modifiedDeployment = deployment, errorAt = -1, statusAt = -1,
  status = 500, rawAt = -1, raw = '', nullBodyAt = -1 } = {}) {
  const calls = [];
  return {
    calls,
    fetchImpl: async (url, options) => {
      const i = urls.indexOf(url);
      assert.notEqual(i, -1, 'Only exact deployments/settings URLs may be called');
      assert.equal(calls.length, i, 'Calls must follow the fixed order without retries');
      assert.deepEqual(Object.keys(options).sort(), ['headers', 'method', 'redirect', 'signal']);
      assert.equal(options.method, 'GET');
      assert.equal(options.redirect, 'error');
      assert.ok(options.signal instanceof AbortSignal);
      assert.deepEqual(options.headers, { Authorization: 'Bearer ' + TOKEN, Accept: 'application/json' });
      calls.push(url);
      if (i === errorAt) throw new Error(CANARY + TOKEN);
      if (i === statusAt) return new Response(status === 204 ? null : CANARY, { status });
      if (i === nullBodyAt) return new Response(null, { status: 200 });
      if (i === rawAt) return new Response(raw, { status: 200 });
      return new Response(JSON.stringify({ success: true, result: i === 0 ? modifiedDeployment : modifiedSettings }), { status: 200 });
    },
  };
}
function assertPrivateOutputAbsent(report) {
  const output = JSON.stringify(report);
  for (const value of [CANARY, TOKEN, ID, ID.toUpperCase(), EMAIL, SUBJECT, ACCOUNT, EXPECTED, 'example.invalid']) {
    assert.equal(output.includes(value), false, 'Only format flags, never private values or account/version identifiers, belong in the report');
  }
  assert.equal(report.signInTestPerformed, false);
  assert.equal(report.ownerIdentityMatchVerified, false);
  assert.equal(report.adminAccessVerified, false);
  assert.equal(report.users, undefined);
  assert.equal(report.sessions, undefined);
}
async function run(mocked, overrides = {}) {
  const report = await runOwnerReadback({ environment, clock: () => NOW, fetchImpl: mocked.fetchImpl, ...overrides });
  assertPrivateOutputAbsent(report);
  assert.ok(mocked.calls.length <= 2);
  assert.equal(report.cloudflareRequestCount, mocked.calls.length);
  return report;
}
async function check(name, action) { await action(); checks.push(name); }
function changeBinding(name, changes) {
  const value = structuredClone(settings);
  Object.assign(value.bindings.find(binding => binding.name === name), changes);
  return value;
}
function ownerProjection(report, kind) { return kind === 'id' ? report.settings.ownerUserId : report.settings.ownerEmail; }

try {
  await check('two exact read-only requests, matching runtime and valid formats', async () => {
    const mocked = mock(), report = await run(mocked);
    assert.equal(report.status, 'READBACK_COMPLETED');
    assert.deepEqual(mocked.calls, urls);
    assert.deepEqual(report.deployments, { ok: true, matchesExpectedRuntime: true });
    assert.deepEqual(Object.keys(report.settings).sort(), ['ok', 'ownerEmail', 'ownerUserId']);
    assert.deepEqual(report.settings.ownerUserId, {
      count: 1, type: 'plain_text', valueReadable: true, exactPolicyValid: true, surroundingWhitespace: false,
      customerPrefixAfterTrim: false, prefixedValidUuid: false, numericProviderSubject: false, validAfterTrim: true,
    });
    assert.deepEqual(report.settings.ownerEmail, {
      count: 1, type: 'plain_text', valueReadable: true, exactPolicyValid: true, surroundingWhitespace: false, validAfterTrim: true,
    });
  });
  const idCases = [
    ['surrounding whitespace', ' \t' + ID + '\n', false, true, false, false, false, true],
    ['customer prefix', 'customer:' + ID, false, false, true, true, false, false],
    ['whitespace and customer prefix', ' customer:' + ID + ' ', false, true, true, true, false, false],
    ['invalid customer suffix', 'customer:' + CANARY, false, false, true, false, false, false],
    ['numeric provider subject', SUBJECT, false, false, false, false, true, false],
    ['uppercase UUID', ID.toUpperCase(), true, false, false, false, false, true],
    ['version zero invalid', ID.replace('-4123-', '-0123-'), false, false, false, false, false, false],
    ['version nine invalid', ID.replace('-4123-', '-9123-'), false, false, false, false, false, false],
    ['variant invalid', ID.replace('-8123-', '-c123-'), false, false, false, false, false, false],
  ];
  for (const [name, text, valid, whitespace, prefix, prefixedValid, numeric, afterTrim] of idCases) {
    await check('UUID exact policy: ' + name, async () => {
      const report = await run(mock({ modifiedSettings: changeBinding('STANDALONE_ADMIN_USER_ID', { text }) }));
      const p = report.settings.ownerUserId;
      assert.deepEqual([p.exactPolicyValid, p.surroundingWhitespace, p.customerPrefixAfterTrim, p.prefixedValidUuid, p.numericProviderSubject, p.validAfterTrim],
        [valid, whitespace, prefix, prefixedValid, numeric, afterTrim]);
      assert.equal(JSON.stringify(report).includes(text), false);
    });
  }
  for (const [name, text, valid, whitespace, afterTrim] of [
    ['surrounding whitespace', ' ' + EMAIL + '\t', false, true, true],
    ['internal whitespace', 'fixture owner@example.invalid', false, false, false],
    ['missing domain dot', 'fixture@localhost', false, false, false],
    ['exact maximum length', 'x'.repeat(195) + '@a.io', true, false, true],
    ['excess length', 'x'.repeat(196) + '@a.io', false, false, false],
  ]) await check('email exact policy: ' + name, async () => {
    const report = await run(mock({ modifiedSettings: changeBinding('STANDALONE_ADMIN_EMAIL', { text }) }));
    const p = report.settings.ownerEmail;
    assert.deepEqual([p.exactPolicyValid, p.surroundingWhitespace, p.validAfterTrim], [valid, whitespace, afterTrim]);
    assert.equal(JSON.stringify(report).includes(text), false);
  });
  for (const [kind, name] of [['id', 'STANDALONE_ADMIN_USER_ID'], ['email', 'STANDALONE_ADMIN_EMAIL']]) {
    for (const [description, changes, type] of [
      ['secret_text ignores even present text', { type: 'secret_text', text: CANARY }, 'secret_text'],
      ['unknown binding type', { type: CANARY, text: CANARY }, 'unexpected'],
      ['non-string text', { text: { value: CANARY } }, 'plain_text'],
    ]) await check(kind + ': ' + description, async () => {
      const p = ownerProjection(await run(mock({ modifiedSettings: changeBinding(name, changes) })), kind);
      assert.equal(p.type, type);
      assert.equal(p.valueReadable, false);
      assert.equal(p.exactPolicyValid, null);
      assert.equal(p.surroundingWhitespace, null);
      assert.equal(p.validAfterTrim, null);
    });
    await check(kind + ': missing binding remains unknown', async () => {
      const value = structuredClone(settings); value.bindings = value.bindings.filter(binding => binding.name !== name);
      const p = ownerProjection(await run(mock({ modifiedSettings: value })), kind);
      assert.equal(p.count, 0); assert.equal(p.type, 'missing'); assert.equal(p.exactPolicyValid, null);
    });
    await check(kind + ': duplicate values are not inspected', async () => {
      const value = structuredClone(settings); value.bindings.push({ name, type: 'plain_text', text: CANARY });
      const p = ownerProjection(await run(mock({ modifiedSettings: value })), kind);
      assert.equal(p.count, 2); assert.equal(p.type, 'duplicate'); assert.equal(p.valueReadable, false);
      assert.equal(p.exactPolicyValid, null);
    });
  }
  for (const versions of [
    [{ version_id: ID, percentage: 100 }],
    [{ version_id: EXPECTED, percentage: 50 }, { version_id: ID, percentage: 50 }],
  ]) await check('changed runtime stops before settings', async () => {
    const mocked = mock({ modifiedDeployment: { deployments: [{ versions }] } }), report = await run(mocked);
    assert.equal(report.status, 'BLOCKED'); assert.equal(report.category, 'runtime_version_changed');
    assert.equal(mocked.calls.length, 1); assert.equal(report.settings, null);
  });
  for (const status of [201, 204, 301, 401, 403, 500]) for (const index of [0, 1]) {
    await check('non-200 response at request ' + (index + 1) + ' stops without retry: ' + status, async () => {
      const mocked = mock({ statusAt: index, status }), report = await run(mocked);
      assert.equal(mocked.calls.length, index + 1);
      assert.equal(report.cloudflareAccessDenied, [401, 403].includes(status));
      assert.equal((index === 0 ? report.deployments : report.settings).httpStatus, status);
    });
  }
  for (const [name, raw, category] of [
    ['invalid JSON', CANARY, 'response_json_invalid'],
    ['unsuccessful envelope', JSON.stringify({ success: false, errors: [{ message: CANARY }] }), 'cloudflare_response_unsuccessful'],
    ['one MiB limit', CANARY + 'x'.repeat(1024 * 1024), 'response_size_limit'],
  ]) await check(name + ' has safe failure', async () => {
    const mocked = mock({ rawAt: 1, raw }), report = await run(mocked);
    assert.equal(report.settings.category, category); assert.equal(report.status, 'READBACK_PARTIAL');
  });
  for (const index of [0, 1]) await check('private transport error sanitized at request ' + (index + 1), async () => {
    const report = await run(mock({ errorAt: index }));
    assert.equal((index === 0 ? report.deployments : report.settings).category, 'request_or_projection_failed');
  });
  await check('missing response body', async () => {
    const report = await run(mock({ nullBodyAt: 1 })); assert.equal(report.settings.category, 'response_body_missing');
  });
  for (const value of [{ bindings: CANARY }, { bindings: Array.from({ length: 1025 }, () => ({ name: CANARY })) }]) {
    await check('malformed settings shape is rejected', async () => {
      const report = await run(mock({ modifiedSettings: value })); assert.equal(report.settings.category, 'settings_shape_invalid');
    });
  }
  for (const value of [null, { deployments: [] }, { deployments: [{ versions: [{ version_id: CANARY, percentage: 100 }] }] },
    { deployments: [{ versions: [{ version_id: EXPECTED, percentage: 50 }] }] }]) {
    await check('malformed runtime blocks settings', async () => {
      const mocked = mock({ modifiedDeployment: value }), report = await run(mocked);
      assert.equal(report.deployments.category, 'deployment_shape_invalid'); assert.equal(mocked.calls.length, 1);
    });
  }
  for (const override of [
    { GITHUB_ACTIONS: 'false' }, { GITHUB_REPOSITORY: CANARY }, { GITHUB_REF: 'refs/heads/main' },
    { GITHUB_EVENT_NAME: 'workflow_dispatch' }, { GITHUB_RUN_ATTEMPT: '2' }, { SAFEPLACES_OWNER_POLICY_BLOB: CANARY },
    { CLOUDFLARE_API_TOKEN: '', CLOUDFLARE_D1_READ_TOKEN: TOKEN },
  ]) await check('wrong execution context/source or absent designated credential blocks all requests', async () => {
    const mocked = mock(), report = await run(mocked, { environment: { ...environment, ...override } });
    assert.equal(report.status, 'BLOCKED'); assert.equal(mocked.calls.length, 0);
  });
  for (const now of [START - 1, END + 1, NaN, NOW + 0.5]) await check('invalid or expired window blocks all requests', async () => {
    const mocked = mock(), report = await run(mocked, { clock: () => now });
    assert.equal(report.status, 'BLOCKED'); assert.equal(mocked.calls.length, 0);
  });
  for (const now of [START, END]) await check('exact window boundaries accepted', async () => {
    const report = await run(mock(), { clock: () => now }); assert.equal(report.status, 'READBACK_COMPLETED');
  });
  await check('expiry between requests stops settings read', async () => {
    let ticks = 0;
    const mocked = mock(), report = await run(mocked, { clock: () => ++ticks < 3 ? NOW : END + 1 });
    assert.equal(mocked.calls.length, 1); assert.equal(report.settings.category, 'request_window_expired');
  });
  assert.equal(realNetworkAttempts, 0);
  assert.ok(timeoutValues.length > 0);
  assert.equal(timeoutValues.every(value => value === 15000), true);
  console.log(JSON.stringify({ status: 'OWNER_FORMAT_OFFLINE_CHECKS_PASSED', checkCount: checks.length,
    realNetworkRequests: 0, maximumRequests: 2, requestTimeoutMs: 15000, maximumResponseBytes: 1024 * 1024,
    adminAccessVerified: false, checks }, null, 2));
} finally {
  globalThis.fetch = originalFetch;
  AbortSignal.timeout = originalTimeout;
}
