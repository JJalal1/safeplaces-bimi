// The pages.dev hostname is protected by a Cloudflare Access allow policy for
// safeplaces.sales@gmail.com. Do not expose this gateway without that policy.
const PREVIEW_HOST = 'safeplaces-preview.pages.dev';
const PRIVATE_HEADERS = { 'cache-control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' };

export default {
  async fetch(request, env) {
    // Deployment hashes and branch aliases do not inherit the canonical host's
    // Access policy. Refuse them before calling the private staging service.
    if (new URL(request.url).hostname !== PREVIEW_HOST) {
      return new Response('Preview host unavailable', { status: 403, headers: PRIVATE_HEADERS });
    }
    if (!env.STAGING) {
      return new Response('Staging backend unavailable', { status: 503, headers: PRIVATE_HEADERS });
    }
    const response = await env.STAGING.fetch(new Request(request.url, request));
    const headers = new Headers(response.headers);
    headers.set('X-Robots-Tag', 'noindex, nofollow');
    headers.set('cache-control', 'no-store');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};
