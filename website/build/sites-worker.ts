export {PasswordHasher} from "../lib/auth-password-worker";
import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";
import { stagingHostResponse } from "../lib/staging-access";
import { productionLaunchGate } from "../lib/production-launch-gate";
import { responsePolicy } from "../lib/response-policy";
import { siteIndexable } from "../lib/site-origin";
import { publicHtmlCacheKey,publicHtmlCacheEntry,cachedPublicHtml } from "../lib/public-html-cache";
import { runOperationalMaintenance,processNotificationOutbox } from "../lib/notifications";
import type { OperationsBindings } from "../lib/operations-types";

export default {
  async scheduled(_controller: ScheduledController, env: Cloudflare.Env, ctx: ExecutionContext) {
    if (env.DB) ctx.waitUntil(runOperationalMaintenance(env as unknown as OperationsBindings));
  },
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    const denied = stagingHostResponse(request, env as unknown as Record<string, unknown>);
    if (denied) return responsePolicy(request,denied,env as unknown as Record<string,unknown>);
    const launchGate = productionLaunchGate(request, env as unknown as Record<string, unknown>);
    if (launchGate) return responsePolicy(request,launchGate,env as unknown as Record<string,unknown>);
    const cacheKey=publicHtmlCacheKey(request,siteIndexable(),import.meta.env.SAFEPLACES_RELEASE);
    let publicCache:Cache|undefined;
    if(cacheKey){
      try{
        publicCache=await caches.open('safeplaces-public-html');
        const cached=await publicCache.match(cacheKey);
        if(cached)return responsePolicy(request,cachedPublicHtml(cached),env as unknown as Record<string,unknown>);
      }catch{console.error('Safe Places cache diagnostic read/unavailable');}
    }
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
    if(request.method==='POST'&&new URL(request.url).pathname.startsWith('/api/admin/')&&result.status<300)ctx.waitUntil(processNotificationOutbox(env as unknown as OperationsBindings,fetch,2).catch(()=>{console.error('Safe Places notification diagnostic outbox/unavailable');}));
    const response=responsePolicy(request,result,env as unknown as Record<string,unknown>);
    if(cacheKey&&publicCache){
      const entry=publicHtmlCacheEntry(response);
      if(entry){
        response.headers.set('X-SafePlaces-Cache','MISS');
        ctx.waitUntil(publicCache.put(cacheKey,entry).catch(()=>{console.error('Safe Places cache diagnostic write/unavailable');}));
      }
    }
    return response;
  },
};

