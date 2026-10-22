const publicPage=/^\/(?:ar|en)(?:\/(?:about|eastern-province|privacy|terms|returns|collection|certificates)|\/(?:services|projects)(?:\/[a-z0-9-]+)?|\/shop(?:\/[a-z0-9-]+|\/category\/[a-z0-9-]+)?)?$/;
const allowedVary=new Set(['accept-encoding','rsc','next-router-state-tree','next-router-prefetch','next-url']);

/** Only anonymous, ordinary HTML navigation on the public production origin. */
export function publicHtmlCacheKey(request:Request,enabled:boolean,release:string):Request|null{
 if(!enabled||!/^[a-f0-9]{40}$/.test(release)||request.method!=='GET')return null;
 const url=new URL(request.url);
 if(url.origin!=='https://safeplaces.sa'||url.search||!publicPage.test(url.pathname))return null;
 const headers=request.headers;
 if(!/\btext\/html\b/i.test(headers.get('accept')||''))return null;
 if(['cookie','authorization','range','if-none-match','if-modified-since'].some(name=>headers.has(name)))return null;
 if(/no-cache|no-store|max-age\s*=\s*0/i.test(headers.get('cache-control')||'')||/no-cache/i.test(headers.get('pragma')||''))return null;
 for(const name of headers.keys())if(name==='rsc'||name.startsWith('next-')||name.startsWith('x-nextjs-')||name.startsWith('x-middleware-'))return null;
 // Each tested release has a separate namespace. A deployment never reuses
 // the preceding application's HTML or its obsolete asset references.
 url.searchParams.set('__safeplaces_html',release);
 return new Request(url,{headers:{Accept:'text/html'}});
}

/** Keep personalized, unsuccessful and non-HTML responses out of shared storage. */
export function publicHtmlCacheEntry(response:Response):Response|null{
 if(response.status!==200||!/^text\/html(?:;|$)/i.test(response.headers.get('content-type')||''))return null;
 if(response.headers.has('set-cookie')||response.headers.has('location'))return null;
 if(/\bprivate\b/i.test(response.headers.get('cache-control')||'')||/noindex/i.test(response.headers.get('x-robots-tag')||''))return null;
 const vary=(response.headers.get('vary')||'').split(',').map(value=>value.trim().toLowerCase()).filter(Boolean);
 if(vary.some(name=>!allowedVary.has(name)))return null;
 const entry=new Response(response.clone().body,response);
 // At most one minute of CMS staleness; no stale-while-revalidate or error
 // fallback. Browser HTML caching remains disabled on the returned response.
 entry.headers.set('Cache-Control','public, max-age=60');
 entry.headers.delete('Expires');
 return entry;
}

export function cachedPublicHtml(response:Response):Response{
 const result=new Response(response.body,response);
 result.headers.set('Cache-Control','no-store, must-revalidate');
 result.headers.set('X-SafePlaces-Cache','HIT');
 return result;
}
