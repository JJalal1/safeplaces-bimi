import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// A bounded, read-only observation. No secret values or user records are output.
const ACCOUNT = 'b67109c9489a46ae25fb36370c4ba880';
const DATABASE = 'da06d822-b7ee-4a14-b3a5-7bcbc5839821';
const WORKERS = ['safeplaces-production', 'safeplaces-staging'];
const CLIENT_ID = '1065235547111-41hr2mvfp3191sdvbd8c1ma306jkcb78.apps.googleusercontent.com';
const PREVIOUS_PRODUCTION_VERSION = 'e52b6904-cf5e-457a-bb27-504cd46f7264';
const START = Date.parse('2026-10-21T15:00:00Z');
const END = Date.parse('2026-10-21T16:00:00Z');
const PUBLIC_URL = 'https://safeplaces.sa/api/session?scope=customer';
const API_PREFIX = 'https://api.cloudflare.com/client/v4/accounts/' + ACCOUNT;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COUNTERS = [
  'users', 'googleAccounts', 'credentialAccounts', 'googleSessionsTotal',
  'activeGoogleSessions', 'activePasswordSessions', 'activeUnknownSessions', 'verifiedGoogleUsers',
];
const TIMESTAMPS = ['lastGoogleSessionCreatedAtMs', 'lastGoogleAccountCreatedAtMs'];
const COUNTER_SQL = `SELECT
 (SELECT COUNT(*) FROM auth_user) AS users,
 (SELECT COUNT(*) FROM auth_account WHERE provider_id = 'google') AS googleAccounts,
 (SELECT COUNT(*) FROM auth_account WHERE provider_id = 'credential') AS credentialAccounts,
 (SELECT COUNT(*) FROM auth_session WHERE auth_method = 'google') AS googleSessionsTotal,
 (SELECT COUNT(*) FROM auth_session WHERE auth_method = 'google' AND expires_at > ?1) AS activeGoogleSessions,
 (SELECT COUNT(*) FROM auth_session WHERE auth_method = 'password' AND expires_at > ?1) AS activePasswordSessions,
 (SELECT COUNT(*) FROM auth_session WHERE auth_method NOT IN ('google', 'password') AND expires_at > ?1) AS activeUnknownSessions,
 (SELECT COUNT(DISTINCT u.id) FROM auth_user u JOIN auth_account a ON a.user_id = u.id WHERE a.provider_id = 'google' AND u.email_verified = 1) AS verifiedGoogleUsers,
 (SELECT MAX(created_at) FROM auth_session WHERE auth_method = 'google') AS lastGoogleSessionCreatedAtMs,
 (SELECT MAX(created_at) FROM auth_account WHERE provider_id = 'google') AS lastGoogleAccountCreatedAtMs`;

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
async function boundedJson(response) {
  if (!response.body) throw new ReadbackFailure('response_body_missing', response.status);
  const reader = response.body.getReader();
  const chunks = [];
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
function projectDeployments(result, worker) {
  const latest = result?.deployments?.[0];
  if (!latest || !Array.isArray(latest.versions) || !latest.versions.length) {
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
  if (versions.length > 2 || Math.abs(versions.reduce((sum, v) => sum + v.percentage, 0) - 100) > 0.000001) {
    throw new ReadbackFailure('deployment_traffic_invalid');
  }
  return {
    ok: true,
    createdAt: new Date(created).toISOString(),
    versions,
    previousProductionVersionActive: worker === 'safeplaces-production'
      ? versions.some(v => v.id === PREVIOUS_PRODUCTION_VERSION && v.percentage > 0) : null,
  };
}
function projectSettings(result, worker) {
  if (!Array.isArray(result?.bindings)) throw new ReadbackFailure('settings_shape_invalid');
  const named = name => result.bindings.filter(entry => entry?.name === name);
  const plainEquals = (name, value) => {
    const entries = named(name);
    return entries.length === 1 && entries[0].type === 'plain_text' && entries[0].text === value;
  };
  const secret = named('GOOGLE_CLIENT_SECRET');
  const database = named('DB');
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
    productionDbBindingMatchesExpected: worker === 'safeplaces-production'
      ? database.length === 1 && database[0].type === 'd1' && database[0].id === DATABASE : null,
  };
}
function projectCounters(result) {
  if (!Array.isArray(result) || result.length !== 1 || result[0]?.success === false
    || !Array.isArray(result[0]?.results) || result[0].results.length !== 1) {
    throw new ReadbackFailure('counter_response_shape_invalid');
  }
  const row = result[0].results[0];
  const counts = {};
  for (const key of COUNTERS) {
    if (!Number.isSafeInteger(row?.[key]) || row[key] < 0) throw new ReadbackFailure('counter_value_invalid');
    counts[key] = row[key];
  }
  for (const key of TIMESTAMPS) {
    if (row?.[key] !== null && (!Number.isSafeInteger(row?.[key]) || row[key] < 0 || row[key] > 32_503_680_000_000)) {
      throw new ReadbackFailure('counter_timestamp_invalid');
    }
    counts[key] = row[key];
  }
  return { ok: true, counts };
}
function projectPublicSession(result) {
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new ReadbackFailure('public_session_shape_invalid');
  const flags = {};
  for (const key of ['authConfigured', 'emailPasswordEnabled']) {
    if (typeof result[key] === 'boolean') flags[key] = result[key];
  }
  const socialProviders = Array.isArray(result.socialProviders) && result.socialProviders.includes('google') ? ['google'] : [];
  return {
    ok: true, flags, socialProviders,
    socialProvidersFieldPresent: Array.isArray(result.socialProviders),
    userPresent: result.user !== null && typeof result.user === 'object',
  };
}

export async function runReadback({ fetchImpl = globalThis.fetch, environment = process.env, now = Date.now() } = {}) {
  const validStart = Number.isSafeInteger(now) && now >= START && now <= END;
  const report = {
    status: 'NOT_RUN',
    observedAt: validStart ? new Date(now).toISOString() : null,
    allowedStartWindow: { from: new Date(START).toISOString(), to: new Date(END).toISOString() },
    signInTestPerformed: false, googleSignInVerified: false,
    cloudflareRequestCount: 0, publicRequestCount: 0,
    workers: {},
  };
  if (environment.GITHUB_ACTIONS !== 'true' || environment.GITHUB_REF !== 'refs/heads/fix/google-login-latest') {
    return { ...report, status: 'BLOCKED', category: 'execution_context_invalid' };
  }
  if (!validStart) return { ...report, status: 'BLOCKED', category: 'start_window_invalid_or_expired' };
  const token = (environment.CLOUDFLARE_API_TOKEN || '').replace(/\s+/g, '');
  if (!/^[A-Za-z0-9._-]{20,512}$/.test(token)) return { ...report, status: 'BLOCKED', category: 'token_missing_or_invalid' };
  let cloudflareAccessDenied = false;
  const permittedPaths = new Map([
    ...WORKERS.flatMap(worker => ['deployments', 'settings'].map(suffix => ['/workers/scripts/' + worker + '/' + suffix, 'GET'])),
    ['/d1/database/' + DATABASE + '/query', 'POST'],
  ]);
  async function cloudflareRequest(path, body) {
    if (cloudflareAccessDenied) throw new ReadbackFailure('cloudflare_requests_stopped_after_access_denied');
    const method = permittedPaths.get(path);
    if (!method || report.cloudflareRequestCount >= 5 || (method === 'GET' && body !== undefined)
      || (method === 'POST' && (body?.sql !== COUNTER_SQL || body?.params?.length !== 1 || body.params[0] !== now))) {
      throw new ReadbackFailure('request_boundary_invalid');
    }
    report.cloudflareRequestCount++;
    const response = await fetchImpl(API_PREFIX + path, {
      method, redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json', ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}) },
      ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) {
      if ([401, 403].includes(response.status)) cloudflareAccessDenied = true;
      await response.body?.cancel().catch(() => {});
      throw new ReadbackFailure(cloudflareAccessDenied ? 'cloudflare_api_access_denied' : 'cloudflare_http_failed', response.status);
    }
    const envelope = await boundedJson(response);
    if (envelope?.success !== true || envelope.result === undefined) throw new ReadbackFailure('cloudflare_response_unsuccessful', response.status);
    return envelope.result;
  }
  async function read(path, projection, body) {
    try { return projection(await cloudflareRequest(path, body)); }
    catch (error) { return safeFailure(error); }
  }
  for (const worker of WORKERS) {
    const prefix = '/workers/scripts/' + worker;
    report.workers[worker] = {
      deployments: await read(prefix + '/deployments', value => projectDeployments(value, worker)),
      settings: await read(prefix + '/settings', value => projectSettings(value, worker)),
    };
  }
  report.databaseCounters = report.workers['safeplaces-production'].settings.productionDbBindingMatchesExpected === true
    ? await read('/d1/database/' + DATABASE + '/query', projectCounters, { sql: COUNTER_SQL, params: [now] })
    : { ok: false, category: 'production_database_binding_not_verified', httpStatus: null };
  // This independent, anonymous request has no Cloudflare token, cookie or identity header.
  try {
    report.publicRequestCount++;
    const response = await fetchImpl(PUBLIC_URL, {
      method: 'GET', redirect: 'error', credentials: 'omit', signal: AbortSignal.timeout(15000),
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      throw new ReadbackFailure('public_session_http_failed', response.status);
    }
    report.publicSession = { ...projectPublicSession(await boundedJson(response)), httpStatus: response.status };
  } catch (error) {
    report.publicSession = safeFailure(error);
  }
  report.cloudflareAccessDenied = cloudflareAccessDenied;
  report.status = Object.values(report.workers).every(worker => worker.deployments.ok && worker.settings.ok)
    && report.databaseCounters.ok && report.publicSession.ok ? 'READBACK_COMPLETED' : 'READBACK_PARTIAL';
  return report;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const report = process.versions.node.split('.')[0] === '24'
    ? await runReadback()
    : { status: 'BLOCKED', category: 'node_version_invalid', signInTestPerformed: false, googleSignInVerified: false };
  await writeFile('google-runtime-readback.json', JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  console.log(JSON.stringify(report));
  process.exitCode = report.status === 'READBACK_COMPLETED' ? 0 : 1;
}
