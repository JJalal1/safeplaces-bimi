import assert from 'node:assert/strict';
import { runReadback } from './check-google-post-deploy-readback.mjs';

const CANARY = 'PRIVATE_FIXTURE_DATA_MUST_NOT_APPEAR';
const TOKEN = 'offline_dummy_credential_never_used_on_network';
const ACCOUNT = 'b67109c9489a46ae25fb36370c4ba880';
const START = Date.parse('2026-10-21T15:35:00Z');
const END = Date.parse('2026-10-21T16:15:00Z');
const NOW = Date.parse('2026-10-21T15:50:00Z');
const OLD = '0f58136e-71fb-43b0-b890-86ba533813cd';
const NEW = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';
const urls = [
  'https://api.cloudflare.com/client/v4/accounts/' + ACCOUNT + '/workers/scripts/safeplaces-production/deployments',
  'https://api.cloudflare.com/client/v4/accounts/' + ACCOUNT + '/workers/scripts/safeplaces-production/settings',
];
const environment = {
  GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'JJalal1/safeplaces-bimi',
  GITHUB_REF: 'refs/heads/fix/google-login-latest', GITHUB_EVENT_NAME: 'push',
  CLOUDFLARE_API_TOKEN: TOKEN, CLOUDFLARE_D1_READ_TOKEN: CANARY,
};
const deployment = {
  deployments: [
    { created_on: '2026-10-21T15:45:00Z', versions: [{ version_id: NEW, percentage: 100 }], author: CANARY, annotations: { private: CANARY } },
    { created_on: CANARY, versions: [{ version_id: CANARY, percentage: CANARY }], author: CANARY },
  ],
  privateField: CANARY,
};
const settings = {
  bindings: [
    { name: 'GOOGLE_CLIENT_ID', type: 'plain_text', text: '1065235547111-41hr2mvfp3191sdvbd8c1ma306jkcb78.apps.googleusercontent.com' },
    { name: 'BETTER_AUTH_URL', type: 'plain_text', text: 'https://safeplaces.sa' },
    { name: 'STANDALONE_AUTH_ENABLED', type: 'plain_text', text: 'true' },
    { name: 'EMAIL_PASSWORD_ENABLED', type: 'plain_text', text: 'true' },
    { name: 'GOOGLE_CLIENT_SECRET', type: 'secret_text', text: CANARY },
    { name: 'STANDALONE_ADMIN_USER_ID', type: 'plain_text', text: CANARY },
    { name: 'STANDALONE_ADMIN_EMAIL', type: 'plain_text', text: CANARY },
    { name: 'BETTER_AUTH_SECRET', type: 'secret_text', text: CANARY },
    { name: 'DB', type: 'd1', id: CANARY },
    { name: CANARY, type: CANARY, text: CANARY },
  ],
  observability: {
    enabled: true, head_sampling_rate: 0.25, private: CANARY,
    logs: { enabled: true, invocation_logs: false, head_sampling_rate: 0.5, destinations: [CANARY] },
    traces: { enabled: false, head_sampling_rate: 0, destinations: [CANARY] },
  },
  privateField: CANARY,
};
const fixtures = [deployment, settings];
const checks = [];
const originalFetch = globalThis.fetch;
const originalTimeout = AbortSignal.timeout;
let unexpectedNetworkAttempts = 0;
const timeoutValues = [];
globalThis.fetch = async () => { unexpectedNetworkAttempts++; throw new Error('Network is disabled in this offline suite.'); };
AbortSignal.timeout = milliseconds => { timeoutValues.push(milliseconds); return originalTimeout(milliseconds); };

function privateOutputAbsent(report) {
  const output = JSON.stringify(report);
  for (const privateValue of [CANARY, TOKEN, ACCOUNT]) assert.equal(output.includes(privateValue), false);
  assert.equal(report.signInTestPerformed, false);
  assert.equal(report.googleSignInVerified, false);
  assert.equal(report.databaseCounters, undefined);
  assert.equal(report.publicSession, undefined);
}
function mock({ replacements = new Map(), statuses = new Map(), raw = new Map(), throwAt = -1 } = {}) {
  const requests = [];
  return {
    requests,
    fetchImpl: async (url, options) => {
      const index = urls.indexOf(url);
      assert.notEqual(index, -1, 'Only the two exact production endpoints are permitted');
      assert.equal(options.method, 'GET');
      assert.equal(options.redirect, 'error');
      assert.ok(options.signal instanceof AbortSignal);
      assert.deepEqual(Object.keys(options.headers).sort(), ['Accept', 'Authorization']);
      assert.equal(options.headers.Authorization, 'Bearer ' + TOKEN);
      assert.equal(options.headers.Accept, 'application/json');
      assert.equal(options.headers.Cookie, undefined);
      assert.equal(options.body, undefined);
      requests.push({ url, method: options.method });
      if (index === throwAt) throw new Error(CANARY);
      if (statuses.has(index)) return new Response(CANARY, { status: statuses.get(index) });
      if (raw.has(index)) return new Response(raw.get(index), { status: 200 });
      const value = replacements.has(index) ? replacements.get(index) : fixtures[index];
      return new Response(JSON.stringify({ success: true, result: value }), { status: 200 });
    },
  };
}
async function run(mocked, overrides = {}) {
  const report = await runReadback({ environment, clock: () => NOW, fetchImpl: mocked.fetchImpl, ...overrides });
  privateOutputAbsent(report);
  assert.ok(mocked.requests.length <= 2);
  assert.equal(report.cloudflareRequestCount, mocked.requests.length);
  return report;
}
async function check(name, action) { await action(); checks.push(name); }

try {
  await check('exact two GETs, safe projection, latest deployment only and new version', async () => {
    const mocked = mock(), report = await run(mocked);
    assert.equal(report.status, 'READBACK_COMPLETED');
    assert.deepEqual(mocked.requests, urls.map(url => ({ url, method: 'GET' })));
    assert.deepEqual(report.deployments.versions, [{ id: NEW, percentage: 100 }]);
    assert.equal(report.deployments.runtimeVersionStateSincePriorReadback, 'NEW');
    assert.equal(report.deployments.previousRuntimeVersionActive, false);
    assert.equal(report.deployments.newRuntimeVersionActive, true);
    assert.equal(report.settings.googleClientIdMatchesProduction, true);
    assert.equal(report.settings.betterAuthUrlMatchesProduction, true);
    assert.equal(report.settings.standaloneAuthFlagEnabled, true);
    assert.equal(report.settings.emailPasswordFlagEnabled, true);
    assert.deepEqual(report.settings.googleClientSecret, { present: true, type: 'secret_text' });
    assert.equal(report.settings.ownerIdBindingPresent, true);
    assert.equal(report.settings.ownerEmailBindingPresent, true);
    assert.deepEqual(report.settings.observability, {
      present: true, enabled: true, headSamplingRate: 0.25,
      logs: { enabled: true, invocationLogsEnabled: false, headSamplingRate: 0.5 },
      traces: { enabled: false, headSamplingRate: 0 },
    });
  });
  for (const [name, versions, state, oldActive, newActive] of [
    ['unchanged', [{ version_id: OLD, percentage: 100 }], 'UNCHANGED', true, false],
    ['mixed', [{ version_id: OLD, percentage: 40 }, { version_id: NEW, percentage: 60 }], 'MIXED', true, true],
    ['zero-traffic old version', [{ version_id: OLD, percentage: 0 }, { version_id: NEW, percentage: 100 }], 'NEW', false, true],
  ]) await check(name + ' version comparison', async () => {
    const value = structuredClone(deployment); value.deployments[0].versions = versions;
    const report = await run(mock({ replacements: new Map([[0, value]]) }));
    assert.equal(report.status, 'READBACK_COMPLETED');
    assert.equal(report.deployments.runtimeVersionStateSincePriorReadback, state);
    assert.equal(report.deployments.previousRuntimeVersionActive, oldActive);
    assert.equal(report.deployments.newRuntimeVersionActive, newActive);
  });
  await check('optional observability absent stays unknown without another endpoint', async () => {
    const value = structuredClone(settings); delete value.observability;
    const mocked = mock({ replacements: new Map([[1, value]]) }), report = await run(mocked);
    assert.equal(report.status, 'READBACK_COMPLETED');
    assert.equal(report.settings.observability.present, false);
    assert.equal(report.settings.observability.enabled, null);
    assert.equal(report.settings.observability.logs.invocationLogsEnabled, null);
    assert.equal(report.settings.observability.traces.enabled, null);
    assert.equal(mocked.requests.length, 2);
  });
  await check('malformed observability is not copied or treated as disabled', async () => {
    const value = structuredClone(settings);
    value.observability = { enabled: CANARY, head_sampling_rate: 2, logs: { enabled: CANARY, invocation_logs: CANARY, head_sampling_rate: -1 }, traces: { enabled: CANARY, head_sampling_rate: CANARY } };
    const report = await run(mock({ replacements: new Map([[1, value]]) }));
    assert.equal(report.status, 'READBACK_COMPLETED');
    assert.equal(report.settings.observability.enabled, null);
    assert.equal(report.settings.observability.headSamplingRate, null);
    assert.equal(report.settings.observability.logs.enabled, null);
    assert.equal(report.settings.observability.logs.invocationLogsEnabled, null);
    assert.equal(report.settings.observability.traces.enabled, null);
  });
  await check('missing owner and secret bindings report absence without values', async () => {
    const value = structuredClone(settings);
    value.bindings = value.bindings.filter(binding => !['GOOGLE_CLIENT_SECRET', 'STANDALONE_ADMIN_USER_ID', 'STANDALONE_ADMIN_EMAIL'].includes(binding.name));
    const report = await run(mock({ replacements: new Map([[1, value]]) }));
    assert.deepEqual(report.settings.googleClientSecret, { present: false, type: 'missing' });
    assert.equal(report.settings.ownerIdBindingPresent, false);
    assert.equal(report.settings.ownerEmailBindingPresent, false);
  });
  for (const type of ['plain_text', CANARY]) await check('secret type projection ' + (type === CANARY ? 'unexpected' : type), async () => {
    const value = structuredClone(settings); value.bindings.find(binding => binding.name === 'GOOGLE_CLIENT_SECRET').type = type;
    const report = await run(mock({ replacements: new Map([[1, value]]) }));
    assert.equal(report.settings.googleClientSecret.type, type === CANARY ? 'unexpected' : type);
  });
  await check('duplicate secret bindings report duplicate only', async () => {
    const value = structuredClone(settings); value.bindings.push({ name: 'GOOGLE_CLIENT_SECRET', type: CANARY, text: CANARY });
    const report = await run(mock({ replacements: new Map([[1, value]]) }));
    assert.deepEqual(report.settings.googleClientSecret, { present: true, type: 'duplicate' });
  });
  await check('configuration mismatches remain boolean', async () => {
    const value = structuredClone(settings);
    for (const binding of value.bindings) if (['GOOGLE_CLIENT_ID', 'BETTER_AUTH_URL', 'STANDALONE_AUTH_ENABLED', 'EMAIL_PASSWORD_ENABLED'].includes(binding.name)) binding.text = CANARY;
    const report = await run(mock({ replacements: new Map([[1, value]]) }));
    for (const key of ['googleClientIdMatchesProduction', 'betterAuthUrlMatchesProduction', 'standaloneAuthFlagEnabled', 'emailPasswordFlagEnabled']) assert.equal(report.settings[key], false);
  });
  for (const index of [0, 1]) for (const status of [401, 403]) await check('stop after HTTP ' + status + ' at request ' + (index + 1), async () => {
    const mocked = mock({ statuses: new Map([[index, status]]) }), report = await run(mocked);
    assert.equal(report.status, 'READBACK_PARTIAL');
    assert.equal(report.cloudflareAccessDenied, true);
    assert.equal(mocked.requests.length, index + 1);
    if (index === 0) assert.equal(report.settings.category, 'cloudflare_requests_stopped_after_access_denied');
  });
  await check('other HTTP errors do not retry or expose response bodies', async () => {
    const mocked = mock({ statuses: new Map([[0, 500]]) }), report = await run(mocked);
    assert.equal(report.status, 'READBACK_PARTIAL');
    assert.equal(report.deployments.category, 'cloudflare_http_failed');
    assert.equal(mocked.requests.length, 2);
  });
  for (const [name, raw, category] of [
    ['one MiB cap', CANARY + 'x'.repeat(1024 * 1024), 'response_size_limit'],
    ['invalid JSON', CANARY, 'response_json_invalid'],
    ['unsuccessful API envelope', JSON.stringify({ success: false, errors: [{ message: CANARY }] }), 'cloudflare_response_unsuccessful'],
  ]) await check(name, async () => {
    const report = await run(mock({ raw: new Map([[0, raw]]) }));
    assert.equal(report.status, 'READBACK_PARTIAL');
    assert.equal(report.deployments.category, category);
  });
  await check('thrown transport errors are sanitized', async () => {
    const report = await run(mock({ throwAt: 0 }));
    assert.equal(report.deployments.category, 'request_or_projection_failed');
  });
  for (const [name, change] of [
    ['private version identifier', value => { value.deployments[0].versions[0].version_id = CANARY; }],
    ['invalid percentage', value => { value.deployments[0].versions[0].percentage = 101; }],
    ['invalid total traffic', value => { value.deployments[0].versions[0].percentage = 50; }],
    ['private creation timestamp', value => { value.deployments[0].created_on = CANARY; }],
  ]) await check(name + ' is rejected', async () => {
    const value = structuredClone(deployment); change(value);
    const report = await run(mock({ replacements: new Map([[0, value]]) }));
    assert.equal(report.status, 'READBACK_PARTIAL');
    assert.equal(report.deployments.ok, false);
  });
  await check('malformed settings are rejected without copying bindings', async () => {
    const report = await run(mock({ replacements: new Map([[1, { bindings: CANARY, private: CANARY }]]) }));
    assert.equal(report.settings.category, 'settings_shape_invalid');
  });
  for (const time of [START - 1, END + 1, NaN, NOW + 0.5]) await check('invalid or expired start blocks all requests', async () => {
    const mocked = mock(), report = await run(mocked, { clock: () => time });
    assert.equal(report.status, 'BLOCKED');
    assert.equal(mocked.requests.length, 0);
  });
  for (const time of [START, END]) await check('inclusive request-window boundary', async () => {
    const report = await run(mock(), { clock: () => time });
    assert.equal(report.status, 'READBACK_COMPLETED');
  });
  await check('expiry between requests prevents the second request', async () => {
    let calls = 0;
    const mocked = mock(), report = await run(mocked, { clock: () => ++calls <= 2 ? NOW : END + 1 });
    assert.equal(report.status, 'READBACK_PARTIAL');
    assert.equal(mocked.requests.length, 1);
    assert.equal(report.settings.category, 'request_window_expired');
  });
  for (const override of [
    { GITHUB_ACTIONS: 'false' }, { GITHUB_REPOSITORY: CANARY },
    { GITHUB_REF: 'refs/heads/main' }, { GITHUB_EVENT_NAME: 'workflow_dispatch' },
    { CLOUDFLARE_API_TOKEN: '', CLOUDFLARE_D1_READ_TOKEN: TOKEN },
  ]) await check('wrong context or missing designated token blocks all requests', async () => {
    const mocked = mock(), report = await run(mocked, { environment: { ...environment, ...override } });
    assert.equal(report.status, 'BLOCKED');
    assert.equal(mocked.requests.length, 0);
  });
  assert.ok(timeoutValues.length > 0);
  assert.equal(timeoutValues.every(value => value === 15000), true);
  assert.equal(unexpectedNetworkAttempts, 0);
  console.log(JSON.stringify({
    status: 'OFFLINE_CHECKS_PASSED',
    checkCount: checks.length,
    checks,
    realNetworkRequests: 0,
    requestTimeoutMs: 15000,
    maximumResponseBytes: 1024 * 1024,
    maximumCloudflareRequestsPerRun: 2,
    signInTestPerformed: false,
    googleSignInVerified: false,
  }, null, 2));
} finally {
  globalThis.fetch = originalFetch;
  AbortSignal.timeout = originalTimeout;
}
