// Fail closed until Cloudflare Access has been configured for pages.dev.
export default {
  async fetch() {
    return new Response('Safe Places preview is not enabled yet.', {
      status: 503,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow', 'cache-control': 'no-store' },
    });
  },
};
