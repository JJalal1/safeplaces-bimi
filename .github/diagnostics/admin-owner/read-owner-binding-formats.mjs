import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Read-only, temporary inspection. This never reads users, sessions or secrets.
const ROOT = 'https://api.cloudflare.com/client/v4/accounts/b67109c9489a46ae25fb36370c4ba880/workers/scripts/safeplaces-production';
const URLS = Object.freeze({ deployments: ROOT + '/deployments', settings: ROOT + '/settings' });
const EXPECTED_VERSION = '6e83c238-894f-4f07-ade5-90e0ed6a2cb0';
const POLICY_BLOB = 'e8c4267191f4fd5c25da666928212f9af4a16cbc';
const START = Date.parse('2026-10-21T20:17:00Z');
const END = Date.parse('2026-10-21T21:05:00Z');
const OUTPUT = 'admin-owner-binding-readback.json';

// These are the exact validators in the POLICY_BLOB guarded by the workflow.
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const validEmail = value => typeof value === 'string' && value.length <= 200
  && value === value.trim() && EMAIL.test(value);
const inWindow = value => Number.isSafeInteger(value) && value >= START && value <= END;

class SafeFailure extends Error {
  constructor(category, httpStatus = null) {
    super(category);
    this.category = category;
    this.httpStatus = httpStatus;
  }
}
function failure(error) {
  return error instanceof SafeFailure
    ? { ok: false, category: error.category, httpStatus: error.httpStatus }
    : { ok: false, category: 'request_or_projection_failed', httpStatus: null };
}
async function boundedJson(response) {
  if (!response.body) throw new SafeFailure('response_body_missing');
  const reader = response.body.getReader(), chunks = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 1024 * 1024) throw new SafeFailure('response_size_limit');
      chunks.push(value);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw new SafeFailure('response_json_invalid'); }
  } finally {
    await reader.cancel().catch(() => {});
  }
}
function projectDeployments(result) {
  const latest = result?.deployments?.[0];
  if (!latest || !Array.isArray(latest.versions) || latest.versions.length < 1 || latest.versions.length > 2) {
    throw new SafeFailure('deployment_shape_invalid');
  }
  if (latest.versions.some(version => typeof version?.version_id !== 'string'
    || !UUID.test(version.version_id) || !Number.isFinite(version.percentage)
    || version.percentage < 0 || version.percentage > 100)
    || new Set(latest.versions.map(version => version.version_id.toLowerCase())).size !== latest.versions.length
    || Math.abs(latest.versions.reduce((sum, version) => sum + version.percentage, 0) - 100) > 0.000001) {
    throw new SafeFailure('deployment_shape_invalid');
  }
  const active = latest.versions.filter(version => version.percentage > 0);
  return {
    ok: true,
    matchesExpectedRuntime: active.length === 1
      && active[0].version_id.toLowerCase() === EXPECTED_VERSION && active[0].percentage === 100,
  };
}
function projectBinding(bindings, name, kind) {
  const entries = bindings.filter(entry => entry?.name === name);
  const entry = entries.length === 1 ? entries[0] : null;
  const type = !entries.length ? 'missing' : entries.length > 1 ? 'duplicate'
    : ['plain_text', 'secret_text'].includes(entry.type) ? entry.type : 'unexpected';
  // A secret_text binding is never inspected, even if a response happens to contain text.
  const readable = type === 'plain_text' && typeof entry.text === 'string';
  const value = readable ? entry.text : null;
  const projection = {
    count: entries.length,
    type,
    valueReadable: readable,
    exactPolicyValid: readable ? (kind === 'uuid' ? UUID.test(value) : validEmail(value)) : null,
    surroundingWhitespace: readable ? value !== value.trim() : null,
  };
  if (kind === 'uuid') {
    projection.customerPrefixAfterTrim = readable ? value.trim().startsWith('customer:') : null;
    projection.prefixedValidUuid = readable ? value.trim().startsWith('customer:') && UUID.test(value.trim().slice(9)) : null;
    projection.numericProviderSubject = readable ? /^[0-9]+$/.test(value.trim()) : null;
    projection.validAfterTrim = readable ? UUID.test(value.trim()) : null;
  } else projection.validAfterTrim = readable ? validEmail(value.trim()) : null;
  return projection;
}
function projectSettings(result) {
  if (!Array.isArray(result?.bindings) || result.bindings.length > 1024) throw new SafeFailure('settings_shape_invalid');
  return {
    ok: true,
    ownerUserId: projectBinding(result.bindings, 'STANDALONE_ADMIN_USER_ID', 'uuid'),
    ownerEmail: projectBinding(result.bindings, 'STANDALONE_ADMIN_EMAIL', 'email'),
  };
}

export async function runOwnerReadback({ fetchImpl = globalThis.fetch, environment = process.env, clock = Date.now } = {}) {
  const now = clock();
  const report = {
    status: 'NOT_RUN',
    observedAt: inWindow(now) ? new Date(now).toISOString() : null,
    allowedRequestWindow: { from: new Date(START).toISOString(), to: new Date(END).toISOString() },
    sourcePolicyVerified: false,
    signInTestPerformed: false,
    ownerIdentityMatchVerified: false,
    adminAccessVerified: false,
    cloudflareRequestCount: 0,
    cloudflareAccessDenied: false,
    deployments: null,
    settings: null,
  };
  if (environment.GITHUB_ACTIONS !== 'true' || environment.GITHUB_REPOSITORY !== 'JJalal1/safeplaces-bimi'
    || environment.GITHUB_REF !== 'refs/heads/fix/google-login-latest' || environment.GITHUB_EVENT_NAME !== 'push'
    || environment.GITHUB_RUN_ATTEMPT !== '1'
    || environment.SAFEPLACES_OWNER_POLICY_BLOB !== POLICY_BLOB) {
    return { ...report, status: 'BLOCKED', category: 'execution_context_or_source_invalid' };
  }
  report.sourcePolicyVerified = true;
  if (!inWindow(now)) return { ...report, status: 'BLOCKED', category: 'request_window_invalid_or_expired' };
  const token = typeof environment.CLOUDFLARE_API_TOKEN === 'string' ? environment.CLOUDFLARE_API_TOKEN.replace(/\s+/g, '') : '';
  if (!/^[A-Za-z0-9._-]{20,512}$/.test(token)) return { ...report, status: 'BLOCKED', category: 'designated_token_missing_or_invalid' };
  const requested = new Set();
  async function read(kind, project) {
    try {
      if (!inWindow(clock())) throw new SafeFailure('request_window_expired');
      if (!Object.hasOwn(URLS, kind) || requested.has(kind) || requested.size >= 2) throw new SafeFailure('request_boundary_invalid');
      requested.add(kind);
      report.cloudflareRequestCount++;
      const response = await fetchImpl(URLS[kind], {
        method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15000),
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      });
      if (response.status !== 200) {
        report.cloudflareAccessDenied = [401, 403].includes(response.status);
        await response.body?.cancel().catch(() => {});
        throw new SafeFailure(report.cloudflareAccessDenied ? 'cloudflare_api_access_denied' : 'cloudflare_http_failed', response.status);
      }
      const envelope = await boundedJson(response);
      if (envelope?.success !== true || envelope.result === undefined) throw new SafeFailure('cloudflare_response_unsuccessful');
      return project(envelope.result);
    } catch (error) { return failure(error); }
  }
  report.deployments = await read('deployments', projectDeployments);
  // Do not use a second request after any failure or a changed deployment.
  if (!report.deployments.ok || !report.deployments.matchesExpectedRuntime) {
    return { ...report, status: 'BLOCKED', category: report.deployments.ok ? 'runtime_version_changed' : 'runtime_check_failed' };
  }
  report.settings = await read('settings', projectSettings);
  report.status = report.settings.ok ? 'READBACK_COMPLETED' : 'READBACK_PARTIAL';
  return report;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  let report;
  try {
    report = process.versions.node.split('.')[0] === '24'
      ? await runOwnerReadback()
      : { status: 'BLOCKED', category: 'node_version_invalid', adminAccessVerified: false };
  } catch { report = { status: 'BLOCKED', category: 'unexpected_execution_failure', adminAccessVerified: false }; }
  await writeFile(OUTPUT, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  console.log(JSON.stringify(report));
  process.exitCode = report.status === 'READBACK_COMPLETED' ? 0 : 1;
}
