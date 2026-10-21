import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ACCOUNT = 'b67109c9489a46ae25fb36370c4ba880';
const WORKER = 'safeplaces-production';
const CLIENT_ID = '1065235547111-41hr2mvfp3191sdvbd8c1ma306jkcb78.apps.googleusercontent.com';
const KNOWN_VERSION = 'e52b6904-cf5e-457a-bb27-504cd46f7264';
const FROM = Date.parse('2026-10-21T14:20:00Z');
const MAX_WINDOW = 30 * 60 * 1000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
class DiagnosticFailure extends Error {
  constructor(category, status = null) {
    super(category);
    this.category = category;
    this.status = status;
  }
}
function safeFailure(error) {
  return error instanceof DiagnosticFailure
    ? { ok: false, category: error.category, httpStatus: error.status }
    : { ok: false, category: 'request_or_projection_failed', httpStatus: null };
}
async function boundedJson(response) {
  if (!response.body) throw new DiagnosticFailure('response_body_missing', response.status);
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 1024 * 1024) {
      void reader.cancel().catch(() => {});
      throw new DiagnosticFailure('response_size_limit', response.status);
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new DiagnosticFailure('response_json_invalid', response.status);
  }
}
function projectDeployments(result) {
  const latest = result?.deployments?.[0];
  if (!latest || !Array.isArray(latest.versions)) throw new DiagnosticFailure('deployment_shape_invalid');
  const created = typeof latest.created_on === 'string' ? Date.parse(latest.created_on) : NaN;
  const versions = latest.versions.flatMap((version) => {
    const id = version?.version_id;
    const traffic = version?.percentage;
    return typeof id === 'string' && UUID.test(id) && typeof traffic === 'number'
      && Number.isFinite(traffic) && traffic >= 0 && traffic <= 100
      ? [{ id: id.toLowerCase(), percentage: traffic }] : [];
  });
  return {
    ok: true,
    createdAt: Number.isFinite(created) ? new Date(created).toISOString() : null,
    versions,
    shapeValid: Number.isFinite(created) && versions.length === latest.versions.length && versions.length > 0,
    matchesKnownVersion: versions.some(({ id, percentage }) => id === KNOWN_VERSION && percentage > 0),
  };
}
function projectSettings(result) {
  if (!Array.isArray(result?.bindings)) throw new DiagnosticFailure('settings_shape_invalid');
  const named = (name) => result.bindings.filter((entry) => entry?.name === name);
  const client = named('GOOGLE_CLIENT_ID');
  const url = named('BETTER_AUTH_URL');
  const secret = named('GOOGLE_CLIENT_SECRET');
  const clientMatches = client.length === 1 && client[0].type === 'plain_text' && client[0].text === CLIENT_ID;
  return {
    ok: true,
    googleClientId: clientMatches ? CLIENT_ID : 'mismatch',
    betterAuthUrlMatchesExpected: url.length === 1 && url[0].type === 'plain_text' && url[0].text === 'https://safeplaces.sa',
    googleClientSecret: {
      present: secret.length > 0,
      type: secret.length === 0 ? 'missing' : secret.length > 1 ? 'duplicate'
        : ['secret_text', 'plain_text'].includes(secret[0].type) ? secret[0].type : 'unexpected',
    },
  };
}
export async function runReadback({ fetchImpl = globalThis.fetch, environment = process.env, now = Date.now() } = {}) {
  const validNow = Number.isSafeInteger(now) && now > FROM && now <= FROM + MAX_WINDOW;
  const report = {
    status: 'NOT_RUN', worker: WORKER,
    window: { from: new Date(FROM).toISOString(), to: validNow ? new Date(now).toISOString() : null, maximumMinutes: 30 },
    signInTestPerformed: false, googleSignInVerified: false, requestCount: 0,
  };
  if (environment.GITHUB_ACTIONS !== 'true' || environment.GITHUB_REF !== 'refs/heads/fix/google-login-latest') {
    return { ...report, status: 'BLOCKED', category: 'execution_context_invalid' };
  }
  if (!validNow) return { ...report, status: 'BLOCKED', category: 'time_window_invalid_or_expired' };
  const token = (environment.CLOUDFLARE_API_TOKEN || '').replace(/\s+/g, '');
  if (!/^[A-Za-z0-9._-]{20,512}$/.test(token)) return { ...report, status: 'BLOCKED', category: 'token_missing_or_invalid' };
  async function request(path) {
    report.requestCount++;
    const response = await fetchImpl('https://api.cloudflare.com/client/v4' + path, {
      method: 'GET', redirect: 'error', signal: AbortSignal.timeout(15000),
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
    });
    if (!response.ok) {
      void response.body?.cancel().catch(() => {});
      throw new DiagnosticFailure([401, 403].includes(response.status) ? 'cloudflare_api_blocked' : 'cloudflare_http_failed', response.status);
    }
    const envelope = await boundedJson(response);
    if (envelope?.success !== true || !envelope.result) throw new DiagnosticFailure('cloudflare_response_unsuccessful', response.status);
    return envelope.result;
  }
  async function read(path, project) {
    try { return project(await request(path)); }
    catch (error) { return safeFailure(error); }
  }
  const script = '/accounts/' + ACCOUNT + '/workers/scripts/' + WORKER;
  report.deployments = await read(script + '/deployments', projectDeployments);
  report.settings = await read(script + '/settings', projectSettings);
  report.status = report.deployments.ok && report.deployments.shapeValid && report.settings.ok
    ? 'READBACK_COMPLETED' : 'READBACK_FAILED';
  return report;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const report = process.versions.node.split('.')[0] === '24'
    ? await runReadback()
    : { status: 'BLOCKED', category: 'node_version_invalid', requestCount: 0 };
  await writeFile('google-status-readback.json', JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  console.log(JSON.stringify(report));
  process.exitCode = report.status === 'READBACK_COMPLETED' ? 0 : 1;
}
