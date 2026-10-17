import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";
import { stagingHostResponse } from "../lib/staging-access";

export default {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    const denied = stagingHostResponse(request, env as unknown as Record<string, unknown>);
    if (denied) return denied;
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    const result = await runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
    const response = new Response(result.body, result);
    response.headers.set('X-Content-Type-Options', 'nosniff');
    // Staging and private previews must never be indexed, even for 404s or API responses.
    if ((env as unknown as Record<string, unknown>).SITE_INDEXABLE !== 'true') response.headers.set('X-Robots-Tag', 'noindex, nofollow');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    const pathname = new URL(request.url).pathname;
    if (/^\/(ar|en)\/admin(?:\/|$)/.test(pathname) || pathname.startsWith('/api/admin/') || /^\/(ar|en)\/(account|checkout|wishlist)(\/|$)/.test(pathname) || pathname.startsWith('/api/auth/') || ['/api/session','/api/account','/api/profile','/api/wishlist'].includes(pathname)) {
      response.headers.set('Cache-Control', 'private, no-store');
      response.headers.set('X-Robots-Tag', 'noindex, nofollow');
      response.headers.set('Referrer-Policy', 'no-referrer');
    }
    if (!response.headers.has('Content-Security-Policy')) response.headers.set('Content-Security-Policy', "object-src 'none'; base-uri 'self'; form-action 'self'");
    return response;
  },
};
