import {headers} from 'next/headers';
import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../app/chatgpt-auth';
import {CustomerAuth,authConfig,cookieValue,accessCookie} from './customer-auth';
import {getStandaloneAuth} from './better-auth-server';
import {standaloneCustomer} from './standalone-auth-policy';
import type {CustomerUser} from './customer-routes';
export function customerAuthConfig(){return authConfig(env as unknown as Record<string,unknown>);}
export async function customerUser():Promise<CustomerUser|null>{
 // Never fall back to legacy preview identity when standalone auth is requested but misconfigured.
 if((env as unknown as Record<string,string>).STANDALONE_AUTH_ENABLED==='true'){
  const standalone=getStandaloneAuth();if(!standalone)return null;
  // Internal reads cannot forward Set-Cookie. Leave renewal to /api/session,
  // which can update the browser cookie and the database together.
  const session=await standalone.api.getSession({headers:await headers(),query:{disableCookieCache:true,disableRefresh:true}});
  return standaloneCustomer(session?.user??null);
 }
 const config=customerAuthConfig();
 if(config)return new CustomerAuth(config).user(cookieValue((await headers()).get('cookie'),accessCookie));
 // Native Sites identity remains available for the private owner review only.
 if((env as unknown as Record<string,string>).SITE_PUBLIC!=='true'){const user=await getChatGPTUser();return user?{...user,provider:'preview'}:null;}
 return null;
}
