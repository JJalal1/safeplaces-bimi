/**
 * Identity and session-method policy for the Better Auth / D1 deployment.
 *
 * This file does not authenticate credentials, trust incoming headers or create sessions.
 * A caller MUST pass a user returned by a successfully verified server-side auth session.
 */
import type {CustomerUser} from './customer-routes';

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function authUserId(value:unknown):value is string{return typeof value==='string'&&uuid.test(value);}
export function authEmail(value:unknown):value is string{
  return typeof value==='string'&&value.length<=200&&value===value.trim()&&emailPattern.test(value);
}

export type VerifiedIdentity={
  id:string;
  email:string;
  emailVerified:boolean;
  name:string|null;
};

export type StandaloneAdminIdentity=CustomerUser & {adminId:string};

export type AuthSessionMethod='google'|'password'|'unknown';

/**
 * Called only by Better Auth's session.create database hook, after the endpoint
 * has authenticated the user. In 1.7.7 dispatch sets context.path to the route
 * template and callbackOAuth resolves its provider from context.params.id.
 * A submitted body, header, existing linked account or email proves no method.
 */
export function authSessionMethod(context:{path?:unknown;params?:{id?:unknown}|null}|null|undefined):AuthSessionMethod{
  if(context?.path==='/callback/:id'&&context.params?.id==='google')return 'google';
  if(context?.path==='/sign-in/email')return 'password';
  return 'unknown';
}

/** Missing/legacy method values require a fresh Google login for administration. */
export function isGoogleAuthSession(session:{authMethod?:unknown}|null|undefined):boolean{
  return session?.authMethod==='google';
}

/**
 * Reuse the existing D1 order/quote/wishlist ownership convention: customer:<UUID>.
 * Do not read a user ID from a request body, URL or client-provided header.
 */
export function standaloneCustomer(identity:VerifiedIdentity|null|undefined):CustomerUser|null{
  if(!identity||identity.emailVerified!==true||!authUserId(identity.id)||!authEmail(identity.email))return null;
  const email=identity.email.trim().toLowerCase();
  const fullName=typeof identity.name==='string'?identity.name.trim().slice(0,120):'';
  return {
    userId:'customer:'+identity.id.toLowerCase(),
    email,
    fullName:fullName||null,
    displayName:fullName||email,
    provider:'standalone'
  };
}

/**
 * Admin access is an out-of-band server configuration, not a signup option.
 * Both immutable auth ID and verified email must match; email alone grants nothing.
 * The configured ID must never be user-editable or taken from identity metadata.
 */
export function standaloneAdmin(
  identity:VerifiedIdentity|null|undefined,
  adminUserId:string|undefined,
  adminEmail:string|undefined
):StandaloneAdminIdentity|null{
  const customer=standaloneCustomer(identity);
  if(!customer||!authUserId(adminUserId)||!authEmail(adminEmail))return null;
  if(customer.userId!=='customer:'+adminUserId.toLowerCase())return null;
  if(customer.email!==adminEmail.trim().toLowerCase())return null;
  return {...customer,adminId:identity!.id.toLowerCase()};
}

/** Fail closed: incomplete configuration never enables public account creation. */
export function standaloneAuthConfig(config:Record<string,unknown>,allowLoopback=false){
  if(config.STANDALONE_AUTH_ENABLED!=='true')return null;
  const secret=config.BETTER_AUTH_SECRET,baseURL=config.BETTER_AUTH_URL;
  if(typeof secret!=='string'||secret.length<32||secret!==secret.trim()||
     typeof baseURL!=='string'||/[\u0000-\u0020\u007f]/.test(baseURL))return null;
  try{
    const url=new URL(baseURL);
    const isLocal=allowLoopback&&url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname);
    if(!(url.protocol==='https:'||isLocal)||url.username||url.password||url.search||url.hash||
       !['','/'].includes(url.pathname)||url.hostname.includes('*')||url.hostname.length>253)return null;
    return {secret,baseURL:url.origin};
  }catch{return null;}
}
