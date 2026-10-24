import assert from 'node:assert/strict';
import { scrypt, timingSafeEqual } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { promisify } from 'node:util';

// Run from website/ after the frozen pnpm install. This fixture exists only in
// Miniflare's local runtime; it adds no route to the deployed application.
const website = resolve(process.argv[2] || process.cwd());
const requireWebsite = createRequire(resolve(website, 'package.json'));
const requireWrangler = createRequire(requireWebsite.resolve('wrangler/package.json'));
const { Miniflare, Log, LogLevel } = requireWrangler('miniflare');
const { build } = requireWrangler('esbuild');

const built = await build({
  stdin: {
    contents: `
      import { passwordHashing, passwordHashingReady } from './lib/auth-password';
      export { PasswordHasher } from './lib/auth-password-worker';
      export default {
        async fetch(request, env) {
          const input = await request.json();
          try {
            if (input.op === 'ready') return Response.json(passwordHashingReady(env));
            if (input.op === 'missing') {
              passwordHashing({});
              return Response.json('unexpected success');
            }
            if (input.op === 'rpc-failure') {
              await passwordHashing({ AUTH_PASSWORD_HASHER: {
                getByName() { throw new Error('synthetic upstream context'); }
              }}).hash('synthetic password');
              return Response.json('unexpected success');
            }
            if (input.op === 'pool') {
              const names = new Set();
              const fakeHash = 'a'.repeat(32) + ':' + 'b'.repeat(128);
              const hooks = passwordHashing({ AUTH_PASSWORD_HASHER: {
                getByName(name) { names.add(name); return { hash: async () => fakeHash }; }
              }});
              for (let i = 0; i < 256; i++) await hooks.hash('synthetic password');
              return Response.json({
                count: names.size,
                bounded: [...names].every(name => /^password-hasher-(?:[0-9]|1[0-5])$/.test(name))
              });
            }
            if (input.op === 'direct-hash') {
              return Response.json(await env.AUTH_PASSWORD_HASHER.getByName('password-hasher-0').hash(input.password));
            }
            if (input.op === 'direct-verify') {
              return Response.json(await env.AUTH_PASSWORD_HASHER.getByName('password-hasher-0').verify(input));
            }
            const hooks = passwordHashing(env);
            if (input.op === 'hash') return Response.json(await hooks.hash(input.password));
            if (input.op === 'verify') return Response.json(await hooks.verify(input));
            return new Response(null, { status: 404 });
          } catch (error) {
            return Response.json({ error: error.message }, { status: 503 });
          }
        }
      };
    `,
    sourcefile: 'auth-password-local-fixture.ts',
    resolveDir: website,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2022',
  conditions: ['workerd', 'worker', 'import'],
  external: ['cloudflare:workers', 'node:*'],
  write: false,
  metafile: true,
  logLevel: 'silent',
});

const inputs = Object.keys(built.metafile.inputs);
assert.ok(inputs.some(path => /@better-auth\/utils\/dist\/password\.node\.mjs$/.test(path)),
  'The workerd bundle must resolve Better Auth to native node:crypto scrypt');
assert.ok(!inputs.some(path => /@better-auth\/utils\/dist\/password\.mjs$/.test(path)),
  'The workerd bundle must not resolve the pure JavaScript password fallback');

const mf = new Miniflare({
  name: 'auth-password-local-check',
  script: built.outputFiles[0].text,
  modules: true,
  // Match the installed workerd release. Hosted staging separately verifies
  // the app's compatibility date and actual account CPU limits.
  compatibilityDate: '2026-05-15',
  compatibilityFlags: ['nodejs_compat'],
  durableObjects: {
    AUTH_PASSWORD_HASHER: { className: 'PasswordHasher', useSQLite: true },
  },
  durableObjectsPersist: false,
  host: '127.0.0.1',
  port: 0,
  log: new Log(LogLevel.ERROR),
});

async function call(input) {
  const response = await mf.dispatchFetch('http://localhost/password-test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  return { status: response.status, value: await response.json() };
}

const nativeScrypt = promisify(scrypt);
const nativeOptions = { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 };
const password = 'Synthetic Caf\u00e9 RPC password';

try {
  assert.deepEqual(await call({ op: 'ready' }), { status: 200, value: true });
  for (const op of ['missing', 'rpc-failure']) {
    assert.deepEqual(await call({ op }), { status: 503, value: { error: 'PASSWORD_HASH_UNAVAILABLE' } });
  }
  const pool = await call({ op: 'pool' });
  assert.equal(pool.status, 200);
  assert.equal(pool.value.bounded, true);
  assert.ok(pool.value.count > 0 && pool.value.count <= 16);

  const first = await call({ op: 'hash', password });
  assert.equal(first.status, 200);
  assert.match(first.value, /^[0-9a-f]{32}:[0-9a-f]{128}$/);
  const [salt, digest] = first.value.split(':');
  const expected = await nativeScrypt(password.normalize('NFKC'), salt, 64, nativeOptions);
  assert.ok(timingSafeEqual(expected, Buffer.from(digest, 'hex')),
    'Worker hashes must preserve the pinned Better Auth native scrypt parameters');

  const second = await call({ op: 'hash', password });
  assert.equal(second.status, 200);
  assert.notEqual(second.value, first.value, 'Separate hashes need independent random salts');
  for (const candidate of [password, 'Synthetic Cafe\u0301 RPC password']) {
    assert.deepEqual(await call({ op: 'verify', password: candidate, hash: first.value }),
      { status: 200, value: true });
  }
  for (const candidate of ['Synthetic incorrect RPC password', 'short']) {
    assert.deepEqual(await call({ op: 'verify', password: candidate, hash: first.value }),
      { status: 200, value: false });
  }

  const existingSalt = '0123456789abcdef0123456789abcdef';
  const existingKey = await nativeScrypt(password.normalize('NFKC'), existingSalt, 64, nativeOptions);
  const existingHash = `${existingSalt}:${existingKey.toString('hex')}`;
  assert.deepEqual(await call({ op: 'verify', password, hash: existingHash }),
    { status: 200, value: true }, 'Existing Better Auth hashes remain usable');

  const boundary = await call({ op: 'hash', password: 'x'.repeat(128) });
  assert.equal(boundary.status, 200);
  for (const op of ['hash', 'verify', 'direct-hash', 'direct-verify']) {
    assert.deepEqual(await call({ op, password: 'x'.repeat(129), hash: first.value }),
      { status: 503, value: { error: 'PASSWORD_HASH_UNAVAILABLE' } });
  }
  for (const op of ['verify', 'direct-verify']) {
    assert.deepEqual(await call({ op, password, hash: 'malformed' }),
      { status: 200, value: false });
  }
  console.log('PASS: real SQLite Durable Object RPC, native scrypt bundle and parameters, existing hashes, Unicode normalization, random salts, bounded shards, input limits and fail-closed errors');
} finally {
  await mf.dispose();
}
