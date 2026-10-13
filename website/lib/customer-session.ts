import {headers} from 'next/headers';
import {env} from 'cloudflare:workers';
import {getChatGPTUser} from '../app/chatgpt-auth';
import {CustomerAuth,authConfig,cookieValue,accessCookie} from './customer-auth';
import type {CustomerUser} from './customer-routes';
export function customerAuthConfig(){return authConfig(env as unknown as Record<string,unknown>);}
export async function customerUser():Promise<CustomerUser|null>{
 const config=customerAuthConfig();
 if(config)return new CustomerAuth(config).user(cookieValue((await headers()).get('cookie'),accessCookie));
 // Native Sites identity remains available for the private owner review only.
 if((env as unknown as Record<string,string>).SITE_PUBLIC!=='true'){const user=await getChatGPTUser();return user?{...user,provider:'preview'}:null;}
 return null;
}
