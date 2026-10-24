/** Preserve response bodies and cookies while keeping customer data out of caches. */
export function responsePolicy(request:Request,result:Response,bindings:Record<string,unknown>):Response{
 const response=new Response(result.body,result),path=new URL(request.url).pathname;
 response.headers.set('X-Content-Type-Options','nosniff');
 response.headers.set('Referrer-Policy','strict-origin-when-cross-origin');
 response.headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
 const isApi=path.startsWith('/api/');
 const publicMedia=isApi&&path.startsWith('/api/media/')&&/^public\b/i.test(response.headers.get('cache-control')||'');
 const privatePage=/^\/(ar|en)\/(admin|account|checkout|cart|wishlist)(?:\/|$)/.test(path);
 const privateResponse=result.status>=400||privatePage||(isApi&&!publicMedia)||response.headers.has('set-cookie')||/\bprivate\b/i.test(response.headers.get('cache-control')||'');
 if(bindings.SITE_INDEXABLE!=='true'||privateResponse||result.status>=400)response.headers.set('X-Robots-Tag','noindex, nofollow');
 if(privateResponse){response.headers.set('Cache-Control','private, no-store');response.headers.set('Referrer-Policy','no-referrer');}
 let csp=response.headers.get('Content-Security-Policy')||"object-src 'none'; base-uri 'self'; form-action 'self'";
 // Public standalone pages do not need embedding. Private Sites previews do.
 if(bindings.SITE_PUBLIC==='true'){
  response.headers.set('X-Frame-Options','DENY');
  if(!/(?:^|;)\s*frame-ancestors\s/i.test(csp))csp+="; frame-ancestors 'none'";
 }
 response.headers.set('Content-Security-Policy',csp);
 return response;
}
