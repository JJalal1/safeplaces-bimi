const PROTECTED_STAGING_HOST = 'safeplaces-preview.pages.dev';
const PRIVATE_HEADERS = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Content-Type-Options': 'nosniff',
};

/**
 * Restrict the standalone staging Worker to the hostname protected by Access.
 * Older Pages deployments can retain their service binding, so this check must
 * run in the backend as well as in the latest Pages gateway.
 *
 * Access authenticates requests on the canonical hostname. A forwarded host or
 * an unverified JWT header is deliberately not treated as proof of access here.
 * Other deployments remain unaffected when STAGING_HOSTNAME is absent.
 */
export function stagingHostResponse(request: Request, env: Record<string, unknown>): Response | null {
  const expected = env.STAGING_HOSTNAME;
  if (expected === undefined) return null;
  if (expected !== PROTECTED_STAGING_HOST) {
    return new Response('Staging host configuration unavailable', { status: 503, headers: PRIVATE_HEADERS });
  }
  if (new URL(request.url).hostname !== expected) {
    return new Response('Preview host unavailable', { status: 403, headers: PRIVATE_HEADERS });
  }
  return null;
}
