import { writeFileSync } from 'node:fs';
import { LIMITS, projectFrame, runObservation } from './observe-current-auth.mjs';

// No real network, Cloudflare credential, account, request, or WebSocket is used.
globalThis.fetch = () => { throw new Error('OFFLINE_TEST_NETWORK_DISABLED'); };
globalThis.WebSocket = class { constructor() { throw new Error('OFFLINE_TEST_NETWORK_DISABLED'); } };

const CANARIES = [
  'PRIVATE_OAUTH_CODE_CANARY', 'PRIVATE_OAUTH_STATE_CANARY',
  'PRIVATE_COOKIE_CANARY', 'PRIVATE_TOKEN_CANARY_abcdefghijklmnopqrstuvwxyz',
  'private-email-canary@example.invalid', 'PRIVATE_ERROR_CANARY',
  'PRIVATE_ACCOUNT_CANARY', 'PRIVATE_SIGNED_TAIL_CANARY',
];
const TAIL = '0123456789abcdef0123456789abcdef';
const API = 'https://api.cloudflare.com/client/v4/accounts/b67109c9489a46ae25fb36370c4ba880/workers/scripts/safeplaces-production/tails';
const INITIAL_TIME = Date.parse('2026-10-21T15:20:00.000Z');
const ENV = {
  GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'JJalal1/safeplaces-bimi',
  GITHUB_REF: 'refs/heads/fix/google-login-latest', CLOUDFLARE_API_TOKEN: CANARIES[3],
};
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }
function requireCheck(value) { if (!value) throw new Error('OFFLINE_ASSERTION_FAILED'); }
const record = (result, key) => result.evidence.records.find(r => r.stage + '/' + r.code === key);
const privateError = () => new Error(CANARIES.join(' '));

function frame(timestamp = INITIAL_TIME, message = 'Safe Places auth diagnostic oauth_token/invalid_client') {
  return {
    scriptName: 'safeplaces-production', eventTimestamp: timestamp,
    event: { request: {
      url: `https://safeplaces.sa/api/auth/callback/google?code=${CANARIES[0]}&state=${CANARIES[1]}`,
      headers: { cookie: CANARIES[2], authorization: 'Bearer ' + CANARIES[3] },
      cf: { account: CANARIES[6], city: CANARIES[4] },
    } },
    exceptions: [{ message: CANARIES[5], stack: CANARIES[4] }],
    logs: [
      { level: 'error', message: [message, message, { error: 'invalid_client', error_description: CANARIES[5] }] },
      { level: 'warn', message: [message + ' ' + CANARIES[3], CANARIES[4]] },
    ],
  };
}

function assertSafeOutput(result, output) {
  const serialized = JSON.stringify({ result, output });
  for (const canary of CANARIES) requireCheck(!serialized.includes(canary));
  for (const unwanted of [TAIL, 'https://', 'wss://', 'safeplaces-production', 'b67109c9489a46ae25fb36370c4ba880']) {
    requireCheck(!serialized.includes(unwanted));
  }
  requireCheck(Object.keys(result.evidence).sort().join(',') === 'records,schemaVersion');
  for (const row of result.evidence.records) {
    requireCheck(Object.keys(row).sort().join(',') === 'code,count,firstTimestamp,lastTimestamp,stage');
    requireCheck(Number.isSafeInteger(row.count) && row.count >= 0);
  }
}

async function scenario(options = {}) {
  let clock = options.time ?? INITIAL_TIME;
  let pendingTimer;
  let timerDelay;
  const controller = new AbortController();
  const requests = [];
  const output = [];
  const order = [];
  let saveCalled = false;
  const timer = {
    setTimeout(fn, ms) {
      if (options.timerThrows) throw privateError();
      timerDelay = ms;
      pendingTimer = fn;
      return 1;
    },
    clearTimeout() { pendingTimer = undefined; },
  };
  function end() {
    const fn = pendingTimer;
    clock += timerDelay ?? 0;
    fn?.();
  }
  class Socket {
    protocol = options.protocol ?? 'trace-v1';
    listeners = new Map();
    constructor(url, protocol) {
      requireCheck(url === (options.tail?.url ?? 'wss://tail.developers.workers.dev/' + CANARIES[7]));
      requireCheck(protocol === 'trace-v1');
      if (options.constructorThrows) throw privateError();
      queueMicrotask(() => {
        this.fire('open');
        if (options.afterOpen) options.afterOpen({ socket: this, end, controller, now: () => clock });
        else end();
      });
    }
    addEventListener(name, fn) {
      const handlers = this.listeners.get(name) ?? [];
      handlers.push(fn);
      this.listeners.set(name, handlers);
    }
    fire(name, detail = {}) { for (const fn of this.listeners.get(name) ?? []) fn(detail); }
    send(message) {
      requireCheck(message === '{"debug":false}');
      if (options.sendThrows) throw privateError();
    }
    close() {
      order.push('socket_close');
      if (options.closeThrows) throw privateError();
      this.fire('close');
    }
  }
  const result = await runObservation({
    env: { ...ENV, ...options.env }, nodeMajor: options.nodeMajor ?? '24',
    now: () => clock, timers: timer, signal: controller.signal, WebSocketImpl: Socket,
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      order.push(init.method);
      requireCheck(init.redirect === 'error');
      requireCheck(init.headers.Authorization === 'Bearer ' + CANARIES[3]);
      requireCheck(init.signal instanceof AbortSignal);
      if (init.method === 'POST') {
        requireCheck(url === API && requests.length === 1);
        requireCheck(init.body === JSON.stringify({ filters: [
          { method: ['GET', 'POST'] }, { query: 'Safe Places auth diagnostic ' },
        ] }));
        if (options.createThrows) throw privateError();
        if (options.afterCreate) options.afterCreate({ controller, setClock: value => { clock = value; } });
        if (options.createResponse) return options.createResponse();
        return Response.json({ success: true, result: {
          id: TAIL, url: 'wss://tail.developers.workers.dev/' + CANARIES[7],
          expires_at: '2026-10-21T20:00:00.000Z', ...options.tail,
        }, errors: [{ message: CANARIES[5] }] });
      }
      requireCheck(init.method === 'DELETE' && url === API + '/' + TAIL && requests.length === 2);
      requireCheck(init.body === undefined);
      if (options.deleteThrows) throw privateError();
      if (options.deleteStatus) return new Response(null, { status: options.deleteStatus });
      return Response.json({ success: true, result: null, privateField: CANARIES[4] });
    },
    emit: value => {
      if (options.emitThrows && value?.code === 'tail_ready') throw privateError();
      output.push(value);
    },
    save: value => {
      order.push('save');
      saveCalled = true;
      if (options.saveThrows) throw privateError();
      output.push(value);
    },
  });
  assertSafeOutput(result, output);
  requireCheck(saveCalled);
  requireCheck(requests.length <= 2);
  if (record(result, 'cleanup/attempted')) {
    requireCheck(requests.length === 2 && requests[1].init.method === 'DELETE');
    requireCheck(order.indexOf('DELETE') < order.indexOf('save'));
  }
  return { result, requests, output, order, timerDelay };
}

test('exact diagnostic projection discards all private canaries', async () => {
  const { result, requests, timerDelay } = await scenario({
    afterOpen({ socket, end }) {
      socket.fire('message', { data: JSON.stringify(frame()) });
      end();
    },
  });
  requireCheck(result.exitCode === 0 && requests.length === 2 && timerDelay === 240_000);
  requireCheck(record(result, 'oauth_token/invalid_client')?.count === 1);
  requireCheck(record(result, 'observation/frames_with_diagnostics')?.count === 1);
  requireCheck(record(result, 'cleanup/deleted')?.count === 1);
});

test('unrelated stale future oversized malformed and partial matches are rejected', async () => {
  const { result } = await scenario({ afterOpen({ socket, end }) {
    const raws = [
      JSON.stringify(frame(INITIAL_TIME - 1)),
      JSON.stringify(frame(INITIAL_TIME + 300_000)),
      JSON.stringify({ ...frame(), scriptName: 'another-worker-' + CANARIES[6] }),
      JSON.stringify(frame(INITIAL_TIME, 'Safe Places auth diagnostic oauth_token/invalid_client ' + CANARIES[5])),
      JSON.stringify(frame(INITIAL_TIME, 'invalid_client')),
      JSON.stringify([frame()]), '{' + CANARIES[5], 'x'.repeat(LIMITS.maxFrameBytes + 1),
    ];
    for (const raw of raws) socket.fire('message', { data: raw });
    end();
  } });
  requireCheck(record(result, 'observation/frames_with_diagnostics')?.count === 0);
  requireCheck(!record(result, 'oauth_token/invalid_client'));
  requireCheck(record(result, 'observation/no_fixed_diagnostic_observed')?.count === 1);
});

test('binary native WebSocket event is safely projected', async () => {
  const { result } = await scenario({ afterOpen({ socket, end }) {
    const raw = new TextEncoder().encode(JSON.stringify(frame(INITIAL_TIME, 'Safe Places auth diagnostic oauth_state/state_cookie_missing')));
    socket.fire('message', { data: raw.buffer });
    end();
  } });
  requireCheck(record(result, 'oauth_state/state_cookie_missing')?.count === 1);
});

for (const [label, options] of [
  ['outside GitHub Actions', { env: { GITHUB_ACTIONS: 'false' } }],
  ['wrong repository', { env: { GITHUB_REPOSITORY: 'private/' + CANARIES[6] } }],
  ['wrong ref', { env: { GITHUB_REF: 'refs/heads/main' } }],
  ['wrong supplied account', { env: { CLOUDFLARE_ACCOUNT_ID: CANARIES[6] } }],
  ['wrong Node major', { nodeMajor: '22' }],
  ['missing token', { env: { CLOUDFLARE_API_TOKEN: '' } }],
  ['before fixed UTC window', { time: LIMITS.startsAt - 1 }],
  ['after fixed UTC window', { time: LIMITS.endsAt }],
]) test('no network for guard: ' + label, async () => {
  const { result, requests } = await scenario(options);
  requireCheck(result.exitCode === 1 && requests.length === 0);
});

for (const status of [401, 403]) test('create access denial is sanitized: ' + status, async () => {
  const { result, requests } = await scenario({ createResponse: () => new Response(CANARIES[5], { status }) });
  requireCheck(requests.length === 1 && record(result, 'observation/tail_create_forbidden')?.count === 1);
  requireCheck(!record(result, 'cleanup/attempted'));
});

test('ambiguous create is not retried or followed by broad cleanup', async () => {
  const { result, requests } = await scenario({ createThrows: true });
  requireCheck(requests.length === 1 && record(result, 'observation/tail_creation_not_confirmed')?.count === 1);
  requireCheck(!record(result, 'cleanup/attempted'));
});

test('unknown or unsafe returned tail ID is never used as a delete path', async () => {
  const { requests } = await scenario({ tail: { id: '../' + CANARIES[6] } });
  requireCheck(requests.length === 1);
});

for (const [label, tail] of [
  ['untrusted host', { url: 'wss://example.invalid/' + CANARIES[7] }],
  ['plaintext websocket', { url: 'ws://tail.developers.workers.dev/' + CANARIES[7] }],
  ['nondefault port', { url: 'wss://tail.developers.workers.dev:444/' + CANARIES[7] }],
  ['userinfo', { url: 'wss://' + CANARIES[6] + '@tail.developers.workers.dev/' }],
  ['hash', { url: 'wss://tail.developers.workers.dev/#' + CANARIES[7] }],
  ['malformed URL', { url: CANARIES[7] }],
  ['missing URL', { url: null }],
  ['short expiration', { expires_at: '2026-10-21T15:20:01.000Z' }],
]) test('own tail cleanup after transport guard: ' + label, async () => {
  const { result } = await scenario({ tail });
  requireCheck(record(result, 'cleanup/attempted')?.count === 1 && record(result, 'cleanup/deleted')?.count === 1);
  requireCheck(record(result, 'observation/tail_transport_guard_failed')?.count === 1);
});

for (const [label, options, expected] of [
  ['constructor throw', { constructorThrows: true }, 'tail_connection_failed'],
  ['protocol mismatch', { protocol: 'wrong' }, 'tail_protocol_mismatch'],
  ['initialization throw', { sendThrows: true }, 'tail_initialization_failed'],
  ['socket error', { afterOpen({ socket }) { socket.fire('error', { error: privateError() }); } }, 'tail_connection_failed'],
  ['socket close', { afterOpen({ socket }) { socket.fire('close', { reason: CANARIES[5] }); } }, 'tail_closed'],
  ['ready output throw', { emitThrows: true }, 'output_failed'],
  ['timer throw', { timerThrows: true }, 'internal_failure'],
  ['cancel after create', { afterCreate({ controller }) { controller.abort(privateError()); } }, 'interrupted'],
  ['cancel while connected', { afterOpen({ controller }) { controller.abort(privateError()); } }, 'interrupted'],
  ['window elapsed during creation', { afterCreate({ setClock }) { setClock(INITIAL_TIME + 240_000); } }, 'time_guard_failed'],
]) test('own tail cleanup on post-create failure: ' + label, async () => {
  const { result } = await scenario(options);
  requireCheck(record(result, 'observation/' + expected)?.count === 1);
  requireCheck(record(result, 'cleanup/attempted')?.count === 1 && record(result, 'cleanup/deleted')?.count === 1);
  requireCheck(result.exitCode === 1);
});

test('socket close failure cannot bypass deletion', async () => {
  const { result } = await scenario({ closeThrows: true });
  requireCheck(record(result, 'cleanup/deleted')?.count === 1);
});

test('artifact write failure happens after cleanup and fails collection status', async () => {
  const { result } = await scenario({ saveThrows: true });
  requireCheck(record(result, 'cleanup/deleted')?.count === 1 && result.exitCode === 1);
});

for (const [label, options, expected, exitCode] of [
  ['network throw', { deleteThrows: true }, 'not_confirmed', 1],
  ['forbidden', { deleteStatus: 403 }, 'forbidden', 1],
  ['already absent', { deleteStatus: 404 }, 'already_absent', 0],
  ['already expired', { deleteStatus: 410 }, 'already_absent', 0],
  ['no-content confirmation', { deleteStatus: 204 }, 'deleted', 0],
]) test('bounded deletion result: ' + label, async () => {
  const { result, requests } = await scenario(options);
  requireCheck(record(result, 'cleanup/' + expected)?.count === 1 && requests.length === 2);
  requireCheck(result.exitCode === exitCode);
});

test('frame ceiling closes collection and still deletes only own tail', async () => {
  const { result } = await scenario({ afterOpen({ socket }) {
    for (let i = 0; i < LIMITS.maxFrames + 5; i += 1) socket.fire('message', { data: '{}' });
  } });
  requireCheck(record(result, 'observation/frame_limit_reached')?.count === 1);
  requireCheck(record(result, 'observation/frames_received')?.count === LIMITS.maxFrames);
  requireCheck(record(result, 'cleanup/deleted')?.count === 1);
});

test('collection is shortened at fixed UTC window end', async () => {
  const { result, timerDelay } = await scenario({ time: LIMITS.endsAt - 10_000 });
  requireCheck(timerDelay === 10_000 && result.exitCode === 0);
});

test('pure projector has no fallback from object fields or untrusted message text', async () => {
  const raw = JSON.stringify({ ...frame(), logs: [
    { level: 'error', message: [{ stage: 'oauth_token', code: 'invalid_client', token: CANARIES[3] }] },
    { level: 'error', message: ['prefix Safe Places auth diagnostic oauth_token/invalid_client'] },
    { level: 'error', message: ['Safe Places auth diagnostic unknown_stage/' + CANARIES[5]] },
  ] });
  requireCheck(projectFrame(raw, { from: INITIAL_TIME, until: INITIAL_TIME + 240_000, receivedAt: INITIAL_TIME }).length === 0);
});

// Intentionally catch assertions and fake private errors without exposing details.
// Test failure output is also allowlisted; a failed canary assertion cannot print it.
const results = [];
for (const item of tests) {
  try { await item.fn(); results.push({ check: item.name, passed: true }); }
  catch { results.push({ check: item.name, passed: false }); }
}
const report = { offline: true, checks: results.length, passed: results.filter(x => x.passed).length,
  failed: results.filter(x => !x.passed).length, results };
writeFileSync(new URL('./offline-verification.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
process.stdout.write(JSON.stringify(report) + '\n');
process.exitCode = report.failed === 0 ? 0 : 1;
