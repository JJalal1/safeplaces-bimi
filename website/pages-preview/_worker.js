// The pages.dev hostname is protected by a Cloudflare Access allow policy for
// safeplaces.sales@gmail.com. Do not expose this gateway without that policy.
export default {
  async fetch(request, env) {
    if (!env.STAGING) {
      return new Response('Staging backend unavailable', { status: 503, headers: { 'cache-control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' } });
    }
    const response = await env.STAGING.fetch(new Request(request.url, request));
    const headers = new Headers(response.headers);
    headers.set('X-Robots-Tag', 'noindex, nofollow');
    headers.set('cache-control', 'no-store');
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  },
};
