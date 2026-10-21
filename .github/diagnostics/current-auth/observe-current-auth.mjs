import { writeFileSync, writeSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Local review source only. No request runs when this module is imported.
// Transport: the previously used observer at 79a4bbfd706bf2427f216e0ea6bca5799d6255ba,
// .github/diagnostics/check-mail-runtime.mjs (blob 8497222e66674238f638f22e8d41246d79fe0b66),
// and cloudflare/workers-sdk wrangler@4.92.0 packages/wrangler/src/tail/{createTail,filters}.ts.
// Never send a login/mail request, query history, read bindings, or list/delete other tails.
const ACCOUNT = 'b67109c9489a46ae25fb36370c4ba880';
const WORKER = 'safeplaces-production';
const REPOSITORY = 'JJalal1/safeplaces-bimi';
const REF = 'refs/heads/fix/google-login-latest';
const API_ROOT = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/scripts/${WORKER}`;
const PREFIX = 'Safe Places auth diagnostic ';
const OUTPUT_FILE = 'auth-current-observation.json';
const TAIL_ID = /^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i;
export const LIMITS = Object.freeze({
  startsAt: Date.parse('2026-10-21T15:15:00.000Z'),
  endsAt: Date.parse('2026-10-21T16:15:00.000Z'),
  observationMs: 240_000,
  apiTimeoutMs: 15_000,
  maxFrameBytes: 1_048_576,
  maxFrames: 1_000,
  maxLogsPerFrame: 64,
  maxMessagesPerLog: 16,
});

// Exact complete messages emitted by b50b0775a7f0f084e808d601b34984dc6bffa193.
// Never derive a category by substring, regular expression capture, or raw error text.
const DIAGNOSTICS = new Set([
  'oauth_token/invalid_client', 'oauth_token/invalid_grant', 'oauth_token/invalid_request',
  'oauth_token/unauthorized_client', 'oauth_token/access_denied',
  'oauth_token/temporarily_unavailable', 'oauth_token/server_error',
  'oauth_token/invalid_scope', 'oauth_token/unsupported_grant_type',
  'oauth_token/exchange_failed', 'oauth_token/id_token_invalid',
  'oauth_state/state_record_missing', 'oauth_state/state_cookie_rejected',
  'oauth_state/state_cookie_missing', 'oauth_state/state_value_mismatch',
  'oauth_state/state_expired', 'oauth_state/state_invalid', 'oauth_state/state_rejected',
  'oauth_state/state_missing', 'oauth_state/state_generation_failed',
  'oauth_callback/request_invalid', 'oauth_callback/code_missing',
  'oauth_callback/issuer_mismatch', 'oauth_callback/destination_missing',
  'oauth_profile/profile_unavailable', 'oauth_profile/identity_invalid',
  'oauth_account/user_creation_failed', 'oauth_account/session_creation_failed',
  'oauth_account/account_not_linked',
  'auth_email/not_configured', 'auth_email/recipient_invalid', 'auth_email/link_invalid',
  'auth_email/provider_configuration', 'auth_email/provider_rate_limit',
  'auth_email/provider_unavailable', 'auth_email/delivery_failed', 'auth_email/request_failed',
  'auth_password/hash_unavailable', 'auth_password/credentials_rejected',
  'auth_password/reset_requested', 'email/verification_accepted', 'email/reset_accepted',
  'authentication/handler_unavailable', 'authentication/unexpected_error',
  'authentication/unclassified_failure',
]);
const MESSAGES = new Map([...DIAGNOSTICS].map(key => [PREFIX + key, key]));
const OPERATIONS = new Set([
  'observation/environment_guard_failed', 'observation/time_guard_failed',
  'observation/tail_create_forbidden', 'observation/tail_creation_not_confirmed',
  'observation/tail_transport_guard_failed', 'observation/tail_connection_failed',
  'observation/tail_protocol_mismatch', 'observation/tail_initialization_failed',
  'observation/tail_ready', 'observation/tail_closed', 'observation/completed',
  'observation/frame_limit_reached', 'observation/interrupted',
  'observation/output_failed', 'observation/internal_failure',
  'observation/frames_received', 'observation/frames_with_diagnostics',
  'observation/no_fixed_diagnostic_observed',
  'cleanup/attempted', 'cleanup/deleted', 'cleanup/already_absent',
  'cleanup/forbidden', 'cleanup/not_confirmed',
]);

function iso(time) {
  return Number.isSafeInteger(time) && time >= LIMITS.startsAt && time <= LIMITS.endsAt + 60_000
    ? new Date(time).toISOString() : null;
}

// The tail can carry URLs, codes, state, cookies, headers, IPs and exception bodies.
// None of those properties is inspected or returned here. Only the fixed message
// allowlist, the script-name guard and a bounded event timestamp are inspected.
export function projectFrame(raw, { from, until, receivedAt }) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw, 'utf8') > LIMITS.maxFrameBytes) return [];
  let item;
  try { item = JSON.parse(raw); } catch { return []; }
  if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
  if (item.scriptName !== undefined && item.scriptName !== WORKER) return [];
  const timestamp = item.eventTimestamp;
  if (!Number.isSafeInteger(timestamp) || timestamp < from || timestamp > until ||
      timestamp > receivedAt + 5_000 || !iso(timestamp)) return [];
  const found = new Set();
  for (const log of (Array.isArray(item.logs) ? item.logs : []).slice(0, LIMITS.maxLogsPerFrame)) {
    if (!['warn', 'error', 'info', 'log'].includes(log?.level)) continue;
    for (const value of (Array.isArray(log?.message) ? log.message : []).slice(0, LIMITS.maxMessagesPerLog)) {
      const key = typeof value === 'string' ? MESSAGES.get(value) : undefined;
      if (key) found.add(key);
    }
  }
  // One count per category in one received event, even if it repeats in that event.
  return [...found].map(key => ({ key, timestamp }));
}

async function readBoundedJson(response) {
  if (!response.body) return null;
  const reader = response.body.getReader();
  const chunks = [];
  let length = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > LIMITS.maxFrameBytes) throw new Error();
      chunks.push(Buffer.from(value));
    }
    return JSON.parse(Buffer.concat(chunks, length).toString('utf8'));
  } finally {
    await reader.cancel().catch(() => {});
  }
}

function guardedSocketUrl(tail, until) {
  if (typeof tail?.url !== 'string' || typeof tail?.expires_at !== 'string') return null;
  const expiration = Date.parse(tail.expires_at);
  if (!Number.isFinite(expiration) || expiration < until) return null;
  const url = new URL(tail.url);
  if (url.protocol !== 'wss:' || url.hostname !== 'tail.developers.workers.dev' ||
      (url.port && url.port !== '443') || url.username || url.password || url.hash) return null;
  return url.href;
}

// Dependency injection is only for offline tests. The CLI below always uses the
// built-in fetch/WebSocket, real clock, fixed scope, and existing GitHub job env.
export async function runObservation({
  env = process.env, nodeMajor = process.versions.node.split('.')[0],
  now = Date.now, fetchImpl = globalThis.fetch, WebSocketImpl = globalThis.WebSocket,
  timers = { setTimeout, clearTimeout }, signal = new AbortController().signal,
  emit = value => writeSync(1, JSON.stringify(value) + '\n'),
  save = value => writeFileSync(resolve(OUTPUT_FILE), JSON.stringify(value, null, 2) + '\n', { mode: 0o600 }),
} = {}) {
  const startedAt = now();
  const until = Math.min(startedAt + LIMITS.observationMs, LIMITS.endsAt);
  const records = new Map();
  let token = '';
  let ownedTailId = null;
  let socket;
  let frames = 0;
  let matchingFrames = 0;
  let connected = false;
  let cleanupConfirmed = false;
  let finishCode = 'internal_failure';

  function count(key, timestamp = now(), amount = 1) {
    if ((!DIAGNOSTICS.has(key) && !OPERATIONS.has(key)) || !Number.isSafeInteger(amount) || amount < 0) throw new Error();
    const time = iso(timestamp);
    const previous = records.get(key);
    const [stage, code] = key.split('/');
    records.set(key, {
      stage, code, firstTimestamp: previous?.firstTimestamp ?? time,
      lastTimestamp: time, count: (previous?.count ?? 0) + amount,
    });
  }

  // Only two possible API requests: create our one tail, then delete its returned ID.
  // No retries, no list/read/history routes, no account/worker identifiers from env.
  async function api(method, id) {
    let status = null;
    try {
      if (method !== 'POST' && !(method === 'DELETE' && id === ownedTailId && TAIL_ID.test(id))) throw new Error();
      const response = await fetchImpl(API_ROOT + '/tails' + (method === 'DELETE' ? '/' + id : ''), {
        method, redirect: 'error', signal: AbortSignal.timeout(LIMITS.apiTimeoutMs),
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        ...(method === 'POST' ? { body: JSON.stringify({ filters: [
          { method: ['GET', 'POST'] }, { query: PREFIX },
        ] }) } : {}),
      });
      status = response.status;
      if (!response.ok || status === 204) {
        await response.body?.cancel().catch(() => {});
        return { ok: method === 'DELETE' && status === 204, status, data: null };
      }
      const data = await readBoundedJson(response);
      return { ok: data?.success === true, status, data: data?.success === true ? data.result : null };
    } catch {
      // Never emit error messages/causes, HTTP bodies, URLs, headers, or credentials.
      return { ok: false, status, data: null };
    }
  }

  async function observe(url) {
    return await new Promise(resolveObservation => {
      let done = false;
      let deadline;
      const finish = code => {
        if (done) return;
        done = true;
        if (deadline !== undefined) timers.clearTimeout(deadline);
        signal.removeEventListener('abort', interrupted);
        resolveObservation(code);
      };
      const interrupted = () => finish('interrupted');
      signal.addEventListener('abort', interrupted, { once: true });
      if (signal.aborted) { finish('interrupted'); return; }
      const remaining = until - now();
      if (remaining <= 0) { finish('time_guard_failed'); return; }
      deadline = timers.setTimeout(() => finish('completed'), remaining);
      try {
        socket = new WebSocketImpl(url, 'trace-v1');
        socket.binaryType = 'arraybuffer';
        socket.addEventListener('error', () => finish('tail_connection_failed'));
        socket.addEventListener('close', () => finish('tail_closed'));
        socket.addEventListener('open', () => {
          if (done) return;
          if (socket.protocol !== 'trace-v1') { finish('tail_protocol_mismatch'); return; }
          try { socket.send(JSON.stringify({ debug: false })); }
          catch { finish('tail_initialization_failed'); return; }
          connected = true;
          count('observation/tail_ready');
          try { emit({ stage: 'observation', code: 'tail_ready', timestamp: iso(now()), count: 1 }); }
          catch { finish('output_failed'); }
        });
        socket.addEventListener('message', event => {
          if (done || !connected) return;
          if (now() > until) { finish('completed'); return; }
          frames += 1;
          try {
            const raw = typeof event.data === 'string' ? event.data :
              event.data instanceof ArrayBuffer && event.data.byteLength <= LIMITS.maxFrameBytes
                ? Buffer.from(event.data).toString('utf8') : null;
            const values = projectFrame(raw, { from: startedAt, until, receivedAt: now() });
            if (values.length > 0) matchingFrames += 1;
            for (const value of values) count(value.key, value.timestamp);
          } catch { /* Discard malformed frames; never stringify a caught value. */ }
          if (frames >= LIMITS.maxFrames) finish('frame_limit_reached');
        });
      } catch { finish('tail_connection_failed'); }
    });
  }

  try {
    if (env.GITHUB_ACTIONS !== 'true' || env.GITHUB_REPOSITORY !== REPOSITORY ||
        env.GITHUB_REF !== REF || nodeMajor !== '24' || typeof WebSocketImpl !== 'function' ||
        (env.CLOUDFLARE_ACCOUNT_ID !== undefined && env.CLOUDFLARE_ACCOUNT_ID !== ACCOUNT)) {
      finishCode = 'environment_guard_failed';
      return;
    }
    if (startedAt < LIMITS.startsAt || startedAt >= LIMITS.endsAt) {
      finishCode = 'time_guard_failed';
      return;
    }
    token = typeof env.CLOUDFLARE_API_TOKEN === 'string' ? env.CLOUDFLARE_API_TOKEN.replace(/\s+/g, '') : '';
    if (!/^[A-Za-z0-9._-]{20,512}$/.test(token)) { finishCode = 'environment_guard_failed'; return; }
    if (signal.aborted) { finishCode = 'interrupted'; return; }
    const created = await api('POST');
    if (!created.ok || typeof created.data?.id !== 'string' || !TAIL_ID.test(created.data.id)) {
      finishCode = [401, 403].includes(created.status) ? 'tail_create_forbidden' : 'tail_creation_not_confirmed';
      return;
    }
    // Assign ownership immediately: every subsequent return/throw enters deletion.
    ownedTailId = created.data.id;
    if (signal.aborted) { finishCode = 'interrupted'; return; }
    if (now() >= until) { finishCode = 'time_guard_failed'; return; }
    let websocketUrl;
    try { websocketUrl = guardedSocketUrl(created.data, until); } catch { /* URL error text is private. */ }
    if (!websocketUrl) { finishCode = 'tail_transport_guard_failed'; return; }
    finishCode = await observe(websocketUrl);
  } catch {
    finishCode = 'internal_failure';
  } finally {
    try { socket?.close(); } catch { /* Always continue to API cleanup. */ }
    if (ownedTailId) {
      count('cleanup/attempted');
      const deleted = await api('DELETE', ownedTailId);
      cleanupConfirmed = deleted.ok || [404, 410].includes(deleted.status);
      count('cleanup/' + (deleted.ok ? 'deleted' : [404, 410].includes(deleted.status)
        ? 'already_absent' : [401, 403].includes(deleted.status) ? 'forbidden' : 'not_confirmed'));
    }
    token = '';
    count('observation/' + finishCode);
    count('observation/frames_received', now(), frames);
    count('observation/frames_with_diagnostics', now(), matchingFrames);
    if (connected && matchingFrames === 0) count('observation/no_fixed_diagnostic_observed');
    const evidence = { schemaVersion: 1, records: [...records.values()].sort((a, b) =>
      (a.stage + '/' + a.code).localeCompare(b.stage + '/' + b.code)) };
    let outputOK = true;
    try { save(evidence); } catch { outputOK = false; }
    try { emit(evidence); } catch { outputOK = false; }
    // A zero exit status verifies collection/cleanup only. No output claims login success.
    return { evidence, exitCode: connected && finishCode === 'completed' && cleanupConfirmed && outputOK ? 0 : 1 };
  }
}

async function cli() {
  const controller = new AbortController();
  const interrupt = () => controller.abort();
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  try {
    if (process.argv.length !== 2) {
      writeSync(1, JSON.stringify({ stage: 'observation', code: 'environment_guard_failed', timestamp: null, count: 1 }) + '\n');
      process.exitCode = 1;
      return;
    }
    const result = await runObservation({ signal: controller.signal });
    process.exitCode = result.exitCode;
  } catch {
    writeSync(1, JSON.stringify({ stage: 'observation', code: 'internal_failure', timestamp: null, count: 1 }) + '\n');
    process.exitCode = 1;
  } finally {
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
    // API cleanup has finished. Bound a stalled WebSocket close handshake.
    setTimeout(() => process.exit(process.exitCode || 0), 500).unref();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await cli();
