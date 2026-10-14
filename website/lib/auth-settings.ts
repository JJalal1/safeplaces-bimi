import {env} from 'cloudflare:workers';
import {standaloneAuthConfig} from './standalone-auth-policy';

/** Enable Google only for the first tested rollout. Other providers remain deferred. */
export const SOCIAL_PROVIDERS=['google'] as const;
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

/** Google sign-in must not depend on a separate outbound email service. */
export function readyAuthConfig(bindings:AuthBindings=authBindings()){
 const base=standaloneAuthConfig(bindings,bindings.AUTH_ALLOW_LOCAL_HTTP==='true');
 if(!base||!bindings.DB||!enabledProviders(bindings).includes('google'))return null;
 return base;
}
