/**
 * Explicit production ingress guard. A route accidentally attached to a pending
 * zone must not expose the quotation/admin app before a reviewed release.
 * Staging and local preview do not set PRODUCTION_LAUNCH_LOCKED.
 */
export function productionLaunchGate(request: Request, bindings: Record<string, unknown>): Response | null {
  if (!Object.prototype.hasOwnProperty.call(bindings, 'PRODUCTION_LAUNCH_LOCKED')) return null;
  const privateHeaders = {
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex, nofollow',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Retry-After': '3600',
  };
  if (bindings.PRODUCTION_LAUNCH_LOCKED !== 'false' || bindings.SITE_PUBLIC !== 'true') {
    return new Response('Safe Places production is not publicly available yet.', { status: 503, headers: privateHeaders });
  }
  const url = new URL(request.url);
  if (url.hostname === 'www.safeplaces.sa') {
    url.hostname = 'safeplaces.sa';
    url.protocol = 'https:';
    url.port = '';
    return new Response(null, {
      status: 308,
      headers: {
        Location: url.toString(),
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  }
  return null;
}
