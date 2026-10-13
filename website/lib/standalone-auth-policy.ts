/**
 * Provider-independent identity policy for a future Better Auth / D1 deployment.
 *
 * This file does not authenticate credentials, trust incoming headers or create sessions.
 * A caller MUST pass a user returned by a successfully verified server-side auth session.
 */
import type {CustomerUser} from './customer-routes';

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
const emailPattern=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type VerifiedIdentity={
  id:string;
  email:string;
  emailVerified:boolean;
  name:string|null;
};

export type StandaloneAdminIdentity=CustomerUser & {adminId:string};

/**
 * Reuse the existing D1 order/quote/wishlist ownership convention: customer:<UUID>.
 * Do not read a user ID from a request body, URL or client-provided header.
 */
export function standaloneCustomer(identity:VerifiedIdentity|null|undefined):CustomerUser|null{
  if(!identity||!identity.emailVerified||!uuid.test(identity.id)||
    !emailPattern.test(identity.email)||identity.email.length>200)return null;
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
  if(!customer||!adminUserId||!adminEmail||!uuid.test(adminUserId)||!emailPattern.test(adminEmail))return null;
  if(customer.userId!=='customer:'+adminUserId.toLowerCase())return null;
  if(customer.email!==adminEmail.trim().toLowerCase())return null;
  return {...customer,adminId:identity!.id.toLowerCase()};
}

/** Fail closed: incomplete configuration never enables public account creation. */
export function standaloneAuthConfig(config:Record<string,unknown>,allowLoopback=false){
  if(config.STANDALONE_AUTH_ENABLED!=='true')return null;
  const secret=config.BETTER_AUTH_SECRET,baseURL=config.BETTER_AUTH_URL;
  if(typeof secret!=='string'||secret.length<32||
     typeof baseURL!=='string')return null;
  try{
    const url=new URL(baseURL);
    const isLocal=allowLoopback&&url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname);
    if(!(url.protocol==='https:'||isLocal)||url.username||url.password||url.search||url.hash||
       !['','/'].includes(url.pathname)||url.hostname.length>253)return null;
    return {secret,baseURL:url.origin};
  }catch{return null;}
}
