/** HTTP boundary for Google and verified email/password authentication. */
export const AUTH_BODY_LIMIT=24*1024;
export const EMAIL_AUTH_PATHS=[
 '/sign-in/email','/sign-up/email','/request-password-reset','/reset-password',
 '/send-verification-email','/verify-email'
];

export function authEndpointPath(request:Request):string{
 try{
  const path=decodeURIComponent(new URL(request.url).pathname).replace(/\/{2,}/g,'/').replace(/\/$/,'');
  return path.startsWith('/api/auth/')?path.slice('/api/auth'.length):'';
 }catch{return '';}
}

export function isEmailAuthPath(path:string):boolean{
 return EMAIL_AUTH_PATHS.includes(path)||path.startsWith('/reset-password/');
}

export type AuthRateLimit={key:string;max:number;expires:number;retryAfter:number};

/**
 * Bound mail delivery and password guesses across Worker instances. Target
 * buckets apply equally to existing and unknown addresses. HMAC keys keep
 * addresses and IPs out of the shared rate-limit table and diagnostic output.
 * Only call this after boundedAuthRequest has enforced the byte limit.
 */
export async function emailAuthRequestPolicy(request:Request,secret:string,now=Date.now()):Promise<{
 error?:'INVALID_REQUEST'|'INVALID_EMAIL'|'INVALID_NAME';limits:AuthRateLimit[]
}>{
 const path=authEndpointPath(request);
 if(request.method!=='POST'||!isEmailAuthPath(path))return {limits:[]};
 let input:Record<string,unknown>;
 try{
  const parsed:unknown=await request.clone().json();
  if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return {error:'INVALID_REQUEST',limits:[]};
  input=parsed as Record<string,unknown>;
 }catch{return {error:'INVALID_REQUEST',limits:[]};}
 const withEmail=['/sign-in/email','/sign-up/email','/request-password-reset','/send-verification-email'].includes(path);
 if(withEmail&&(typeof input.email!=='string'||input.email.length>200||input.email!==input.email.trim()||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)))return {error:'INVALID_EMAIL',limits:[]};
 if(path==='/sign-up/email'&&(typeof input.name!=='string'||input.name.trim().length<2||input.name.length>120))return {error:'INVALID_NAME',limits:[]};
 const ip=request.headers.get('cf-connecting-ip')||'unattributed';
 const email=typeof input.email==='string'?input.email.toLowerCase():'';
 const rules=path==='/sign-in/email'?[
  {scope:'password-ip',value:ip,max:20,seconds:600},
  {scope:'password-pair',value:ip+'\0'+email,max:10,seconds:600}
 ]:path==='/reset-password'?[
  {scope:'password-reset',value:ip,max:10,seconds:600}
 ]:[
  {scope:'mail-ip',value:ip,max:10,seconds:600},
  {scope:'mail-target',value:email,max:6,seconds:3600}
 ];
 const encoder=new TextEncoder();
 const hmac=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const limits:AuthRateLimit[]=[];
 for(const rule of rules){
  const window=Math.floor(now/(rule.seconds*1000)),expires=(window+1)*rule.seconds*1000;
  const digest=await crypto.subtle.sign('HMAC',hmac,encoder.encode(rule.scope+'\0'+window+'\0'+rule.value));
  const encoded=Array.from(new Uint8Array(digest),value=>value.toString(16).padStart(2,'0')).join('');
  limits.push({key:'auth-policy:'+rule.scope+':'+window+':'+encoded,max:rule.max,expires,retryAfter:Math.max(1,Math.ceil((expires-now)/1000))});
 }
 return {limits};
}

export function authRequestError(request:Request,baseURL:string):{code:string;status:number}|null{
 const url=new URL(request.url);
 if(url.origin!==baseURL)return {code:'INVALID_ORIGIN',status:403};
 if(request.method==='POST'){
  // Google redirects its authorization-code callback with GET. Browser POSTs
  // are our own client actions and always need the configured exact origin.
  if(request.headers.get('origin')!==baseURL||request.headers.get('sec-fetch-site')==='cross-site')
   return {code:'INVALID_ORIGIN',status:403};
  const contentType=request.headers.get('content-type')?.split(';',1)[0].trim().toLowerCase();
  if(contentType&&contentType!=='application/json')return {code:'UNSUPPORTED_MEDIA_TYPE',status:415};
  const length=Number(request.headers.get('content-length')||0);
  if(!Number.isFinite(length)||length<0||length>AUTH_BODY_LIMIT)return {code:'TOO_LARGE',status:413};
 }
 return null;
}

/** Bound the actual body too; Content-Length alone is not trustworthy. */
export async function boundedAuthRequest(request:Request):Promise<Request|null>{
 if(request.method!=='POST'||!request.body)return request;
 const reader=request.body.getReader();
 const chunks:Uint8Array[]=[];
 let length=0;
 try{
  while(true){
   const part=await reader.read();if(part.done)break;
   length+=part.value.byteLength;
   if(length>AUTH_BODY_LIMIT){await reader.cancel();return null;}
   chunks.push(part.value);
  }
 }finally{reader.releaseLock();}
 const bytes=new Uint8Array(length);let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 // Workerd rejects a consumed Request as constructor input even when a new
 // body is supplied. Rebuild from the URL and preserve the verified bytes.
 return new Request(request.url,{
  method:request.method,
  headers:new Headers(request.headers),
  redirect:request.redirect,
  body:bytes
 });
}
