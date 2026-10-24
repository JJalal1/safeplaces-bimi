import assert from 'node:assert/strict';
import gateway from '../pages-preview/_worker.js';

const canonical = 'https://safeplaces-preview.pages.dev';
const assertPrivate = (response) => {
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
};

// Neither an unprotected deployment URL nor a forged forwarded host may reach
// the service binding, including when the binding is absent.
let blockedCalls = 0;
for (const host of [
  'e92b423e.safeplaces-preview.pages.dev',
  'feature-auth-speed-seo-before-hosting.safeplaces-preview.pages.dev',
  'safeplaces-preview.pages.dev.example.com',
  'safeplaces-preview.pages.dev.',
]) {
  const request = new Request(`https://${host}/ar`, {
    headers: { 'x-forwarded-host': 'safeplaces-preview.pages.dev' },
  });
  const response = await gateway.fetch(request, {
    STAGING: { async fetch() { blockedCalls++; throw new Error('Blocked host reached STAGING'); } },
  });
  assert.equal(response.status, 403, host);
  assertPrivate(response);
  await response.body?.cancel();
}
assert.equal(blockedCalls, 0);
const missingOnHash = await gateway.fetch(new Request('https://abc.safeplaces-preview.pages.dev/ar'), {});
assert.equal(missingOnHash.status, 403);
assertPrivate(missingOnHash);
await missingOnHash.body?.cancel();

// Preserve locale paths, query parameters, cookies, and callback redirects on
// the host already protected by Access. The gateway does not rewrite auth URLs.
for (const path of ['/ar', '/en/about', '/api/auth/callback/google?state=test-state']) {
  const request = new Request(`${canonical}${path}`, {
    headers: { cookie: 'test-session=preview', 'cf-access-jwt-assertion': 'test-assertion' },
  });
  let routedCalls = 0;
  const response = await gateway.fetch(request, {
    STAGING: {
      async fetch(forwarded) {
        routedCalls++;
        assert.equal(forwarded.url, request.url);
        assert.equal(forwarded.method, 'GET');
        assert.equal(forwarded.headers.get('cookie'), 'test-session=preview');
        assert.equal(forwarded.headers.get('cf-access-jwt-assertion'), 'test-assertion');
        return new Response(null, {
          status: 302,
          headers: { location: `${canonical}/ar/account`, 'cache-control': 'public, max-age=3600', 'x-robots-tag': 'index' },
        });
      },
    },
  });
  assert.equal(routedCalls, 1);
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), `${canonical}/ar/account`);
  assertPrivate(response);
}

const posted = new Request(`${canonical}/api/auth/sign-in/social`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provider: 'google' }),
});
const postResponse = await gateway.fetch(posted, {
  STAGING: {
    async fetch(forwarded) {
      assert.equal(forwarded.url, posted.url);
      assert.equal(forwarded.method, 'POST');
      assert.equal(forwarded.headers.get('content-type'), 'application/json');
      assert.deepEqual(await forwarded.json(), { provider: 'google' });
      return new Response('preview response', { status: 202, headers: { 'x-test-upstream': 'preserved' } });
    },
  },
});
assert.equal(postResponse.status, 202);
assert.equal(postResponse.headers.get('x-test-upstream'), 'preserved');
assert.equal(await postResponse.text(), 'preview response');
assertPrivate(postResponse);

const unavailable = await gateway.fetch(new Request(`${canonical}/ar`), {});
assert.equal(unavailable.status, 503);
assertPrivate(unavailable);
await unavailable.body?.cancel();

console.log('Preview gateway: noncanonical hosts denied without STAGING calls; canonical GET/POST/auth paths and private response headers verified.');
