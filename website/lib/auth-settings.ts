import {env} from 'cloudflare:workers';
import {standaloneAuthConfig} from './standalone-auth-policy';
import {passwordHashingReady} from './auth-password';

/** Google is the supported social provider; password accounts are a separate gate. */
export const SOCIAL_PROVIDERS=['google'] as const;
export type SocialProvider=typeof SOCIAL_PROVIDERS[number];
export type AuthBindings=Record<string,unknown>;

export function authBindings():AuthBindings{return env as unknown as AuthBindings;}
function nonempty(v:unknown):v is string{return typeof v==='string'&&v.trim().length>0;}

export function emailSettings(bindings:AuthBindings){
 const key=bindings.RESEND_API_KEY,from=bindings.AUTH_EMAIL_FROM;
 if(!nonempty(key)||key!==key.trim()||/[\u0000-\u0020\u007f]/.test(key)||
    !nonempty(from)||from.length>200||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(from))return null;
 return {key,from};
}

/** Registration cannot open without verification mail and the private hash service. */
export function emailPasswordEnabled(bindings:AuthBindings=authBindings()):boolean{
 return bindings.EMAIL_PASSWORD_ENABLED==='true'&&!!emailSettings(bindings)&&
  passwordHashingReady({AUTH_PASSWORD_HASHER:bindings.AUTH_PASSWORD_HASHER});
}

export function enabledProviders(bindings:AuthBindings):SocialProvider[]{
 return SOCIAL_PROVIDERS.filter(name=>{
  const p=name.toUpperCase();
  return nonempty(bindings[p+'_CLIENT_ID'])&&nonempty(bindings[p+'_CLIENT_SECRET']);
 });
}

/** Each sign-in method can run without depending on the other provider. */
export function readyAuthConfig(bindings:AuthBindings=authBindings()){
 const base=standaloneAuthConfig(bindings,bindings.AUTH_ALLOW_LOCAL_HTTP==='true');
 if(!base||!bindings.DB||(!enabledProviders(bindings).includes('google')&&!emailPasswordEnabled(bindings)))return null;
 return base;
}
