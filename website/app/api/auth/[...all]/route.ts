import {getStandaloneAuth} from '../../../../lib/better-auth-server';
import {authBindings,readyAuthConfig} from '../../../../lib/auth-settings';
import {authRequestError,boundedAuthRequest} from '../../../../lib/auth-request-policy';

export const dynamic='force-dynamic';

function protect(response:Response){
 const headers=new Headers(response.headers);
 headers.set('Cache-Control','private, no-store');
 headers.set('X-Content-Type-Options','nosniff');
 headers.set('Referrer-Policy','no-referrer');
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
}
const failure=(code:string,status:number,headers:Record<string,string>={})=>protect(Response.json({error:code},{status,headers}));

async function handle(request:Request){
 try{
  const bindings=authBindings(),ready=readyAuthConfig(bindings),auth=getStandaloneAuth();
  if(!ready||!auth)return failure('AUTH_NOT_CONFIGURED',503);
  const invalid=authRequestError(request,ready.baseURL);
  if(invalid)return failure(invalid.code,invalid.status);
  const bounded=await boundedAuthRequest(request);
  if(!bounded)return failure('TOO_LARGE',413);
  // D1 shares the limit across Worker instances; an in-memory limiter alone
  // cannot enforce it across Cloudflare locations or cold starts.
  const minute=Math.floor(Date.now()/60000),write=request.method==='POST';
  const source=(request.headers.get('cf-connecting-ip')||'unattributed')+'\0'+(write?'write':'read');
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source));
  const key='auth:'+Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('')+':'+minute;
  const counter=await (bindings.DB as D1Database).prepare('INSERT INTO rate_limits (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count')
   .bind(key,(minute+1)*60000).first<{count:number}>();
  if(!counter||counter.count>(write?30:180))return failure('RATE_LIMIT',429,{'Retry-After':String(60-Math.floor(Date.now()/1000)%60)});
  return protect(await auth.handler(bounded));
 }catch{
  // Auth errors must not expose OAuth credentials, verification records or
  // raw upstream responses in the browser or application logs.
  console.error('Safe Places auth diagnostic authentication/handler_unavailable');
  return failure('AUTH_UNAVAILABLE',503);
 }
}
export const GET=handle;
export const POST=handle;
