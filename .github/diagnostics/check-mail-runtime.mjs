import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// One diagnostic for an existing, nonhuman Resend fixture. The workflow must
// first verify this exact unverified fixture in D1. This script never queries
// D1, creates an account, retries a mail request, or claims inbox delivery.
// Transport/filter contract: Wrangler 4.92.0 src/tail/{createTail,filters}.ts.
const ACCOUNT = 'b67109c9489a46ae25fb36370c4ba880';
const WORKER = 'safeplaces-production';
const VERSION = 'e52b6904-cf5e-457a-bb27-504cd46f7264';
const OLD_TAIL = '15d674b13cd44d669dee844c6b80bad8';
const EMAIL = 'delivered+safeplaces-auth-b50b0775a7f0@resend.dev';
const USER_ID = '02f762db-ea6c-4384-929a-fc94a22a8801';
const ORIGIN = 'https://safeplaces.sa';
const AUTH_PATH = '/api/auth/send-verification-email';
const API_ROOT = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/scripts/${WORKER}`;
const OBSERVATION_MS = 55_000;
const API_TIMEOUT_MS = 15_000;
const MAX_FRAME_BYTES = 1_048_576;
const args = process.argv.slice(2);
const mode = args.length === 0 ? 'observe' :
  args.length === 1 && args[0] === 'cleanup-tail' ? 'cleanup-tail' : 'invalid';
const reportPath = resolve(mode === 'cleanup-tail' ?
  'auth-mail-tail-cleanup.json' : 'auth-mail-observation.json');
const token = (process.env.CLOUDFLARE_API_TOKEN || '').replace(/\s+/g, '');
const nonce = randomUUID();
const fixedMessages = new Set([
  'email/verification_accepted', 'email/reset_accepted',
  'auth_email/not_configured', 'auth_email/recipient_invalid',
  'auth_email/link_invalid', 'auth_email/provider_configuration',
  'auth_email/provider_rate_limit', 'auth_email/provider_unavailable',
  'auth_email/delivery_failed', 'auth_email/request_failed',
  'authentication/handler_unavailable', 'authentication/unexpected_error',
  'authentication/unclassified_failure',
].map(value => `Safe Places auth diagnostic ${value}`));
const outcomes = new Set(['ok', 'exception', 'exceededCpu', 'exceededMemory', 'canceled', 'unknown']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const tailIdPattern = /^(?:[0-9a-f]{32}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;
const report = {
  schemaVersion: 1, mode, startedAt: new Date().toISOString(), finishedAt: null,
  target: { accountId: ACCOUNT, worker: WORKER, expectedVersionId: VERSION },
  fixture: mode === 'observe' ? { email: EMAIL, userId: USER_ID } : null,
  deployment: { status: 'not_checked', httpStatus: null, versionMatched: false, traffic100Percent: false, createdAt: null },
  oldTail: { id: OLD_TAIL, attempted: false, status: 'not_attempted', httpStatus: null },
  tail: { created: false, createHttpStatus: null, id: null, expiresAt: null, connected: false, protocolConfirmed: false,
    initialized: false, cleanupStatus: 'not_needed', cleanupHttpStatus: null },
  request: { sent: false, state: 'NOT_SENT', httpStatus: null, noSessionCookie: null, cfRay: null },
  events: [], providerAcceptanceObserved: false, deliveryConfirmed: false,
  finishReason: 'not_started', result: 'INCONCLUSIVE', reportWritten: false,
};
let socket;

function safeDate(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time >= 0 && time < 32_503_680_000_000 ? new Date(time).toISOString() : null;
}

function checkpoint() {
  try {
    report.reportWritten = true;
    writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
    return true;
  } catch {
    report.reportWritten = false;
    return false;
  }
}

async function readBoundedJson(response) {
  if (!response.body) return null;
  const reader = response.body.getReader();
  let length = 0;
  const chunks = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_FRAME_BYTES) throw new Error();
      chunks.push(Buffer.from(value));
    }
    return JSON.parse(Buffer.concat(chunks, length).toString('utf8'));
  } finally {
    await reader.cancel().catch(() => {});
  }
}

async function cfApi(method, suffix, body) {
  let httpStatus = null;
  try {
    const response = await fetch(API_ROOT + suffix, {
      method, redirect: 'error', signal: AbortSignal.timeout(API_TIMEOUT_MS),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    httpStatus = response.status;
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      return { ok: false, httpStatus, data: null };
    }
    if (response.status === 204) return { ok: method === 'DELETE', httpStatus, data: null };
    const data = await readBoundedJson(response);
    return { ok: data?.success === true, httpStatus, data: data?.success === true ? data.result : null };
  } catch {
    // Never emit API error bodies, Error.message/cause, headers, or credentials.
    return { ok: false, httpStatus, data: null };
  }
}

async function deleteTail(id) {
  const response = await cfApi('DELETE', `/tails/${id}`);
  return {
    status: response.ok ? 'success' : [404, 410].includes(response.httpStatus) ? 'not_found' : 'blocked',
    httpStatus: response.httpStatus,
  };
}

async function deleteOldTail() {
  report.oldTail.attempted = true;
  Object.assign(report.oldTail, await deleteTail(OLD_TAIL));
  return checkpoint() && ['success', 'not_found'].includes(report.oldTail.status);
}

function projectOwnedEvent(item) {
  if (!item || typeof item !== 'object' || !report.request.sent) return null;
  const request = item.event?.request;
  if (!request || request.method !== 'POST' || typeof request.url !== 'string') return null;
  const url = new URL(request.url);
  if (url.origin !== ORIGIN || url.pathname !== AUTH_PATH) return null;
  if (!request.headers || typeof request.headers !== 'object' || Array.isArray(request.headers)) return null;
  const markers = Object.entries(request.headers).filter(([key]) => key.toLowerCase() === 'x-safeplaces-probe');
  if (markers.length !== 1 || markers[0][1] !== nonce) return null;
  if (item.scriptName !== undefined && item.scriptName !== WORKER) return null;
  const version = typeof item.scriptVersion === 'string' ? item.scriptVersion : item.scriptVersion?.id;
  if (version !== undefined && version !== VERSION) return null;
  const logs = [];
  for (const log of Array.isArray(item.logs) ? item.logs : []) {
    for (const value of Array.isArray(log?.message) ? log.message : []) {
      if (typeof value === 'string' && fixedMessages.has(value) && logs.length < 16) {
        logs.push({ message: value, level: ['info', 'log', 'warn', 'error'].includes(log.level) ? log.level : null });
      }
    }
  }
  return {
    nonceMatched: true, workerFieldMatched: item.scriptName === undefined ? null : true,
    versionFieldMatched: version === undefined ? null : true,
    timestamp: safeDate(item.eventTimestamp), logs,
    outcome: outcomes.has(item.outcome) ? item.outcome : 'unknown',
    exceptionCount: Array.isArray(item.exceptions) ? item.exceptions.length : null,
  };
}

async function observe(websocketUrl) {
  await new Promise(resolveObservation => {
    let finished = false;
    let issueTimer;
    let requestPending = false;
    const requestAbort = new AbortController();
    const finish = reason => {
      if (finished) return;
      finished = true;
      clearTimeout(deadline);
      clearTimeout(issueTimer);
      if (requestPending && report.request.httpStatus === null) report.request.state = 'UNCONFIRMED_NO_RETRY';
      requestAbort.abort();
      report.finishReason = reason;
      resolveObservation();
    };
    const deadline = setTimeout(() => finish('observation_timeout'), OBSERVATION_MS);

    async function issueOnce() {
      if (finished || socket.readyState !== WebSocket.OPEN || report.request.sent) return;
      report.request.sent = true; // Set before fetch: ambiguous failures must never trigger a retry.
      report.request.state = 'REQUEST_STARTED';
      if (!checkpoint()) {
        report.request.sent = false;
        report.request.state = 'NOT_SENT';
        finish('report_write_failed_before_request');
        return;
      }
      requestPending = true;
      try {
        const response = await fetch(ORIGIN + AUTH_PATH, {
          method: 'POST', redirect: 'error',
          signal: AbortSignal.any([requestAbort.signal, AbortSignal.timeout(20_000)]),
          headers: { Origin: ORIGIN, 'Content-Type': 'application/json', 'X-SafePlaces-Probe': nonce },
          body: JSON.stringify({ email: EMAIL, callbackURL: '/ar/account/login?verified=1' }),
        });
        if (!finished) {
          const ray = response.headers.get('cf-ray') || '';
          report.request.httpStatus = response.status;
          report.request.noSessionCookie = !response.headers.has('set-cookie');
          report.request.cfRay = /^[a-f0-9]{16,32}-[A-Z]{3}$/i.test(ray) ? ray : null;
          report.request.state = response.status === 200 && report.request.noSessionCookie ? 'REQUESTED' : 'REJECTED_OR_UNEXPECTED';
        }
        await response.body?.cancel().catch(() => {});
      } catch {
        if (!finished) report.request.state = 'UNCONFIRMED_NO_RETRY';
      } finally {
        requestPending = false;
      }
      if (!finished && report.events.length > 0) finish('owned_invocation_observed');
    }

    try { socket = new WebSocket(websocketUrl, 'trace-v1'); }
    catch { finish('tail_connection_failed'); return; }
    socket.binaryType = 'arraybuffer';
    socket.addEventListener('error', () => finish('tail_connection_failed'));
    socket.addEventListener('close', () => finish('tail_closed_before_observation'));
    socket.addEventListener('open', () => {
      if (finished) return;
      report.tail.connected = true;
      report.tail.protocolConfirmed = socket.protocol === 'trace-v1';
      if (!report.tail.protocolConfirmed) { finish('tail_protocol_mismatch'); return; }
      try {
        socket.send(JSON.stringify({ debug: false }));
        report.tail.initialized = true;
      } catch { finish('tail_initialization_failed'); return; }
      issueTimer = setTimeout(() => { void issueOnce(); }, 350);
    });
    socket.addEventListener('message', event => {
      if (finished || report.events.length >= 4) return;
      try {
        const raw = typeof event.data === 'string' ? event.data :
          event.data instanceof ArrayBuffer ? Buffer.from(event.data).toString('utf8') : null;
        if (raw === null || Buffer.byteLength(raw, 'utf8') > MAX_FRAME_BYTES) return;
        const projected = projectOwnedEvent(JSON.parse(raw));
        if (!projected) return;
        report.events.push(projected);
        report.providerAcceptanceObserved ||= projected.logs.some(log =>
          log.message === 'Safe Places auth diagnostic email/verification_accepted');
        if (!requestPending) finish('owned_invocation_observed');
      } catch { /* Ignore malformed/unrelated frames without logging their contents. */ }
    });
  });
}

async function main() {
  let newTailId = null;
  try {
    if (mode === 'invalid' || process.env.GITHUB_ACTIONS !== 'true' || process.versions.node.split('.')[0] !== '24' ||
      !/^[A-Za-z0-9._-]{20,512}$/.test(token) || !uuid.test(VERSION) || !uuid.test(USER_ID)) {
      report.finishReason = 'environment_guard_failed';
      if (mode === 'cleanup-tail') report.oldTail.status = 'blocked';
      return;
    }
    if (!checkpoint()) { report.finishReason = 'report_write_failed'; return; }
    if (mode === 'cleanup-tail') {
      const cleaned = await deleteOldTail();
      report.finishReason = cleaned ? 'old_tail_cleanup_confirmed' : 'old_tail_cleanup_blocked';
      report.result = cleaned ? 'CLEANED' : 'BLOCKED';
      return;
    }

    const deployments = await cfApi('GET', '/deployments');
    report.deployment.httpStatus = deployments.httpStatus;
    const latest = deployments.ok && Array.isArray(deployments.data?.deployments) ? deployments.data.deployments[0] : null;
    report.deployment.createdAt = safeDate(latest?.created_on);
    report.deployment.versionMatched = latest?.versions?.length === 1 && latest.versions[0].version_id === VERSION;
    report.deployment.traffic100Percent = latest?.versions?.length === 1 && latest.versions[0].percentage === 100;
    if (!deployments.ok || !report.deployment.versionMatched || !report.deployment.traffic100Percent) {
      report.deployment.status = 'blocked';
      report.finishReason = 'deployment_guard_failed';
      return;
    }
    report.deployment.status = 'verified';
    if (!await deleteOldTail()) { report.finishReason = 'old_tail_cleanup_blocked'; return; }

    const tail = await cfApi('POST', '/tails', { filters: [
      { method: ['POST'] }, { header: { key: 'x-safeplaces-probe', query: nonce } }, { scriptVersion: VERSION },
    ] });
    report.tail.createHttpStatus = tail.httpStatus;
    if (!tail.ok || typeof tail.data?.id !== 'string' || !tailIdPattern.test(tail.data.id)) {
      report.finishReason = 'tail_creation_not_confirmed';
      return;
    }
    newTailId = tail.data.id;
    report.tail.created = true;
    report.tail.id = newTailId;
    report.tail.expiresAt = safeDate(tail.data.expires_at);
    report.tail.cleanupStatus = 'pending';
    if (!checkpoint()) { report.finishReason = 'report_write_failed'; return; }
    const wsUrl = new URL(tail.data.url);
    if (wsUrl.protocol !== 'wss:' || wsUrl.hostname !== 'tail.developers.workers.dev' || wsUrl.username || wsUrl.password ||
      !report.tail.expiresAt || Date.parse(report.tail.expiresAt) - Date.now() < OBSERVATION_MS) {
      report.finishReason = 'tail_transport_guard_failed';
      return;
    }
    // Signed tail URL stays in memory and is never serialized to evidence.
    await observe(wsUrl.href);
  } catch {
    report.finishReason = 'internal_failure';
  } finally {
    try { socket?.close(); } catch { /* No transport error text may leave memory. */ }
    if (newTailId) {
      const cleanup = await deleteTail(newTailId);
      report.tail.cleanupStatus = cleanup.status;
      report.tail.cleanupHttpStatus = cleanup.httpStatus;
    }
    if (mode === 'observe') {
      const observed = report.finishReason === 'owned_invocation_observed' &&
        ['success', 'not_found'].includes(report.tail.cleanupStatus);
      const accepted = observed && report.request.state === 'REQUESTED' &&
        report.events.some(event => event.outcome === 'ok' && event.exceptionCount === 0 &&
          event.logs.some(log => log.message === 'Safe Places auth diagnostic email/verification_accepted')) &&
        report.events.every(event => event.outcome === 'ok' && event.exceptionCount === 0 &&
          event.logs.every(log => !log.message.startsWith('Safe Places auth diagnostic auth_email/')));
      report.result = accepted ? 'ACCEPTED' : observed ? 'OBSERVED' : 'INCONCLUSIVE';
    }
    report.finishedAt = new Date().toISOString();
    const saved = checkpoint();
    const exitCode = saved && ['ACCEPTED', 'CLEANED'].includes(report.result) ? 0 : 1;
    await new Promise(resolveOutput => process.stdout.write(JSON.stringify(report) + '\n', resolveOutput));
    process.exitCode = exitCode;
    // All API cleanup has finished. Bound a stalled WebSocket close handshake.
    setTimeout(() => process.exit(exitCode), 500).unref();
  }
}

await main();
