import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Only the latest production deployment and an allowlisted settings projection.
const WORKER = 'safeplaces-production';
const API_PREFIX = 'https://api.cloudflare.com/client/v4/accounts/b67109c9489a46ae25fb36370c4ba880';
const URLS = Object.freeze({
  deployments: API_PREFIX + '/workers/scripts/' + WORKER + '/deployments',
  settings: API_PREFIX + '/workers/scripts/' + WORKER + '/settings',
});
const PREVIOUS_VERSION = '0f58136e-71fb-43b0-b890-86ba533813cd';
const CLIENT_ID = '1065235547111-41hr2mvfp3191sdvbd8c1ma306jkcb78.apps.googleusercontent.com';
const START = Date.parse('2026-10-21T15:35:00Z');
const END = Date.parse('2026-10-21T16:15:00Z');
const OUTPUT = 'google-post-deploy-readback.json';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class ReadbackFailure extends Error {
  constructor(category, httpStatus = null) {
    super(category);
    this.category = category;
    this.httpStatus = httpStatus;
  }
}
function safeFailure(error) {
  return error instanceof ReadbackFailure
    ? { ok: false, category: error.category, httpStatus: error.httpStatus }
    : { ok: false, category: 'request_or_projection_failed', httpStatus: null };
}
function inWindow(value) {
  return Number.isSafeInteger(value) && value >= START && value <= END;
}
async function boundedJson(response) {
  if (!response.body) throw new ReadbackFailure('response_body_missing', response.status);
  const reader = response.body.getReader(), chunks = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 1024 * 1024) throw new ReadbackFailure('response_size_limit', response.status);
      chunks.push(value);
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw new ReadbackFailure('response_json_invalid', response.status); }
  } finally {
    await reader.cancel().catch(() => {});
  }
}
function projectDeployments(result) {
  const latest = result?.deployments?.[0];
  if (!latest || !Array.isArray(latest.versions) || !latest.versions.length || latest.versions.length > 2) {
    throw new ReadbackFailure('deployment_shape_invalid');
  }
  const created = typeof latest.created_on === 'string' ? Date.parse(latest.created_on) : NaN;
  if (!Number.isFinite(created) || created < 0 || created > END) throw new ReadbackFailure('deployment_time_invalid');
  const versions = latest.versions.map(version => {
    if (typeof version?.version_id !== 'string' || !UUID.test(version.version_id)
      || !Number.isFinite(version.percentage) || version.percentage < 0 || version.percentage > 100) {
      throw new ReadbackFailure('deployment_version_invalid');
    }
    return { id: version.version_id.toLowerCase(), percentage: version.percentage };
  });
  if (new Set(versions.map(version => version.id)).size !== versions.length
    || Math.abs(versions.reduce((sum, version) => sum + version.percentage, 0) - 100) > 0.000001) {
    throw new ReadbackFailure('deployment_traffic_invalid');
  }
  const active = versions.filter(version => version.percentage > 0);
  const previousActive = active.some(version => version.id === PREVIOUS_VERSION);
  const newActive = active.some(version => version.id !== PREVIOUS_VERSION);
  return {
    ok: true,
    createdAt: new Date(created).toISOString(),
    versions,
    previousRuntimeVersionActive: previousActive,
    newRuntimeVersionActive: newActive,
    runtimeVersionStateSincePriorReadback: previousActive ? (newActive ? 'MIXED' : 'UNCHANGED') : 'NEW',
  };
}
function projectObservability(value) {
  const object = value && typeof value === 'object' && !Array.isArray(value) ? value : null;
  const boolean = entry => typeof entry === 'boolean' ? entry : null;
  const rate = entry => typeof entry === 'number' && Number.isFinite(entry) && entry >= 0 && entry <= 1 ? entry : null;
  return {
    present: object !== null,
    enabled: boolean(object?.enabled),
    headSamplingRate: rate(object?.head_sampling_rate),
    logs: {
      enabled: boolean(object?.logs?.enabled),
      invocationLogsEnabled: boolean(object?.logs?.invocation_logs),
      headSamplingRate: rate(object?.logs?.head_sampling_rate),
    },
    traces: {
      enabled: boolean(object?.traces?.enabled),
      headSamplingRate: rate(object?.traces?.head_sampling_rate),
    },
  };
}
function projectSettings(result) {
  if (!Array.isArray(result?.bindings)) throw new ReadbackFailure('settings_shape_invalid');
  const named = name => result.bindings.filter(entry => entry?.name === name);
  const plainEquals = (name, expected) => {
    const entries = named(name);
    return entries.length === 1 && entries[0].type === 'plain_text' && entries[0].text === expected;
  };
  const secret = named('GOOGLE_CLIENT_SECRET');
  return {
    ok: true,
    googleClientIdMatchesProduction: plainEquals('GOOGLE_CLIENT_ID', CLIENT_ID),
    betterAuthUrlMatchesProduction: plainEquals('BETTER_AUTH_URL', 'https://safeplaces.sa'),
    standaloneAuthFlagEnabled: plainEquals('STANDALONE_AUTH_ENABLED', 'true'),
    emailPasswordFlagEnabled: plainEquals('EMAIL_PASSWORD_ENABLED', 'true'),
    googleClientSecret: {
      present: secret.length > 0,
      type: !secret.length ? 'missing' : secret.length > 1 ? 'duplicate'
        : ['secret_text', 'plain_text'].includes(secret[0].type) ? secret[0].type : 'unexpected',
    },
    ownerIdBindingPresent: named('STANDALONE_ADMIN_USER_ID').length > 0,
    ownerEmailBindingPresent: named('STANDALONE_ADMIN_EMAIL').length > 0,
    // Optional on /settings. Missing fields remain unknown and never trigger another request.
    observability: projectObservability(result.observability),
  };
}

export async function runReadback({ fetchImpl = globalThis.fetch, environment = process.env, clock = Date.now } = {}) {
  const started = clock();
  const report = {
    status: 'NOT_RUN',
    worker: WORKER,
    observedAt: inWindow(started) ? new Date(started).toISOString() : null,
    allowedRequestWindow: { from: new Date(START).toISOString(), to: new Date(END).toISOString() },
    previousRuntimeVersion: PREVIOUS_VERSION,
    signInTestPerformed: false,
    googleSignInVerified: false,
    cloudflareRequestCount: 0,
    cloudflareAccessDenied: false,
    deployments: null,
    settings: null,
  };
  if (environment.GITHUB_ACTIONS !== 'true'
    || environment.GITHUB_REPOSITORY !== 'JJalal1/safeplaces-bimi'
    || environment.GITHUB_REF !== 'refs/heads/fix/google-login-latest'
    || environment.GITHUB_EVENT_NAME !== 'push') {
    return { ...report, status: 'BLOCKED', category: 'execution_context_invalid' };
  }
  if (!inWindow(started)) return { ...report, status: 'BLOCKED', category: 'request_window_invalid_or_expired' };
  const token = typeof environment.CLOUDFLARE_API_TOKEN === 'string'
    ? environment.CLOUDFLARE_API_TOKEN.replace(/\s+/g, '') : '';
  if (!/^[A-Za-z0-9._-]{20,512}$/.test(token)) return { ...report, status: 'BLOCKED', category: 'token_missing_or_invalid' };

  const requested = new Set();
  async function read(kind, project) {
    try {
      if (report.cloudflareAccessDenied) throw new ReadbackFailure('cloudflare_requests_stopped_after_access_denied');
      if (!inWindow(clock())) throw new ReadbackFailure('request_window_expired');
      if (!Object.hasOwn(URLS, kind) || requested.has(kind) || report.cloudflareRequestCount >= 2) {
        throw new ReadbackFailure('request_boundary_invalid');
      }
      requested.add(kind);
      report.cloudflareRequestCount++;
      const response = await fetchImpl(URLS[kind], {
        method: 'GET',
        redirect: 'error',
        signal: AbortSignal.timeout(15000),
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
      });
      if (!response.ok) {
        if ([401, 403].includes(response.status)) report.cloudflareAccessDenied = true;
        await response.body?.cancel().catch(() => {});
        throw new ReadbackFailure(report.cloudflareAccessDenied ? 'cloudflare_api_access_denied' : 'cloudflare_http_failed', response.status);
      }
      const envelope = await boundedJson(response);
      if (envelope?.success !== true || envelope.result === undefined) {
        throw new ReadbackFailure('cloudflare_response_unsuccessful', response.status);
      }
      return project(envelope.result);
    } catch (error) {
      return safeFailure(error);
    }
  }
  report.deployments = await read('deployments', projectDeployments);
  report.settings = await read('settings', projectSettings);
  report.status = report.deployments.ok && report.settings.ok ? 'READBACK_COMPLETED' : 'READBACK_PARTIAL';
  return report;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const report = process.versions.node.split('.')[0] === '24'
    ? await runReadback()
    : { status: 'BLOCKED', category: 'node_version_invalid', signInTestPerformed: false, googleSignInVerified: false };
  await writeFile(OUTPUT, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  console.log(JSON.stringify(report));
  process.exitCode = report.status === 'READBACK_COMPLETED' ? 0 : 1;
}
