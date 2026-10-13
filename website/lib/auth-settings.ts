import {env} from 'cloudflare:workers';
import {standaloneAuthConfig} from './standalone-auth-policy';

export const SOCIAL_PROVIDERS=['google','apple','microsoft','facebook'] as const;
export type SocialProvider=typeof SOCIAL_PROVIDERS[number];
export type AuthBindings=Record<string,unknown>;

export function authBindings():AuthBindings{return env as unknown as AuthBindings;}
function nonempty(v:unknown):v is string{return typeof v==='string'&&v.trim().length>0;}
export function emailSettings(bindings:AuthBindings){
 const key=bindings.RESEND_API_KEY,from=bindings.AUTH_EMAIL_FROM;
 if(!nonempty(key)||!nonempty(from)||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(from))return null;
 return {key,from};
}
export function enabledProviders(bindings:AuthBindings):SocialProvider[]{
 return SOCIAL_PROVIDERS.filter(name=>{
  const p=name.toUpperCase();
  return nonempty(bindings[p+'_CLIENT_ID'])&&nonempty(bindings[p+'_CLIENT_SECRET']);
 });
}
/** A public sign-in page must never enable actions with partial backend settings. */
export function readyAuthConfig(bindings:AuthBindings=authBindings()){
 const base=standaloneAuthConfig(bindings,bindings.AUTH_ALLOW_LOCAL_HTTP==='true');
 if(!base||!emailSettings(bindings)||!bindings.DB)return null;
 return base;
}
