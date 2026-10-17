import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const source = readFileSync(new URL('../lib/staging-access.ts', import.meta.url), 'utf8');
const compiled = stripTypeScriptTypes(source, { mode: 'strip' });
const { stagingHostResponse } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const staging = { STAGING_HOSTNAME: 'safeplaces-preview.pages.dev' };
const assertPrivate = (response) => {
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
};

// Legacy Pages gateways preserve their original URL when invoking the Worker.
// Host/JWT-like headers supplied by a caller must not turn that URL canonical.
for (const host of [
  'e92b423e.safeplaces-preview.pages.dev',
  '81941734.safeplaces-preview.pages.dev',
  'feature-auth-speed-seo-before-hosting.safeplaces-preview.pages.dev',
  'safeplaces-staging.safeplaces-sales.workers.dev',
  'safeplaces-preview.pages.dev.example.com',
  'safeplaces-preview.pages.dev.',
]) {
  for (const path of ['/ar/about', '/api/auth/get-session', '/api/admin/products']) {
    const request = new Request(`https://${host}${path}`, {
      headers: {
        host: 'safeplaces-preview.pages.dev',
        'x-forwarded-host': 'safeplaces-preview.pages.dev',
        'cf-access-jwt-assertion': 'not-a-verified-token',
      },
    });
    const response = stagingHostResponse(request, staging);
    assert.ok(response, `${host}${path}`);
    assert.equal(response.status, 403);
    assertPrivate(response);
    await response.body?.cancel();
  }
}

// Access protects the canonical host; the host guard preserves every route.
for (const path of ['/ar', '/en/about', '/api/auth/callback/google?state=preview-test', '/api/admin/products']) {
  assert.equal(stagingHostResponse(new Request(`https://safeplaces-preview.pages.dev${path}`), staging), null);
}

// The setting is opt-in so ordinary Sites builds and local browser QA keep
// their existing routing. A present but invalid setting must fail closed.
for (const url of ['http://localhost:5173/ar', 'https://safe-places-safety.kh-ng-gian-l-3883.chatgpt.site/ar']) {
  assert.equal(stagingHostResponse(new Request(url), {}), null);
}
for (const STAGING_HOSTNAME of ['', 'example.com', null, true]) {
  const response = stagingHostResponse(new Request('https://safeplaces-preview.pages.dev/ar'), { STAGING_HOSTNAME });
  assert.equal(response?.status, 503);
  assertPrivate(response);
  await response.body?.cancel();
}

const config = JSON.parse(readFileSync(new URL('../wrangler.staging.jsonc', import.meta.url), 'utf8'));
assert.equal(config.name, 'safeplaces-staging');
assert.equal(config.vars.STAGING_HOSTNAME, staging.STAGING_HOSTNAME);
assert.equal(config.workers_dev, false);
console.log('Staging access: legacy hash/alias/API hosts denied; spoofed headers ignored; canonical routes preserved; local/Sites opt-out and invalid configuration verified.');
