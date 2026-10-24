import {getStandaloneAuth} from '../../../../lib/better-auth-server';
import {authBindings,emailPasswordEnabled,enabledProviders,readyAuthConfig} from '../../../../lib/auth-settings';
import {authEndpointPath,authRequestError,boundedAuthRequest,emailAuthRequestPolicy,isEmailAuthPath} from '../../../../lib/auth-request-policy';
import {googleLinkRequestError} from '../../../../lib/google-link-policy';

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
  if(isEmailAuthPath(authEndpointPath(request))&&!emailPasswordEnabled(bindings))return failure('EMAIL_PASSWORD_DISABLED',404);
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
  if(write&&authEndpointPath(bounded)==='/link-social'&&emailPasswordEnabled(bindings)&&enabledProviders(bindings).includes('google')){
   let body:unknown;try{body=await bounded.clone().json();}catch{return failure('GOOGLE_LINK_INVALID_REQUEST',400);}
   const linkError=googleLinkRequestError(body);
   if(linkError)return failure(linkError,400);
  }
  const policy=await emailAuthRequestPolicy(bounded,ready.secret);
  if(policy.error)return failure(policy.error,400);
  for(const limit of policy.limits){
   const result=await (bindings.DB as D1Database).prepare('INSERT INTO rate_limits (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count')
    .bind(limit.key,limit.expires).first<{count:number}>();
   if(!result||result.count>limit.max)return failure('RATE_LIMIT',429,{'Retry-After':String(limit.retryAfter)});
  }
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
