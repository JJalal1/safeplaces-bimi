import type {CustomerUser} from './customer-routes';

export type AuthConfig={url:string;key:string};
export type ProviderSession={access_token:string;refresh_token:string;expires_in:number;user:{id:string;email?:string;email_confirmed_at?:string;user_metadata?:{full_name?:string}}};
export class CustomerAuthError extends Error{constructor(public code:string,public status=400){super(code);}}
export const accessCookie='__Host-safeplaces-access',refreshCookie='__Host-safeplaces-refresh',recoveryCookie='__Host-safeplaces-recovery';
export function authConfig(values:Record<string,unknown>):AuthConfig|null{
 const url=values.CUSTOMER_AUTH_URL,key=values.CUSTOMER_AUTH_PUBLIC_KEY;
 if(values.CUSTOMER_AUTH_ENABLED!=='true'||typeof url!=='string'||typeof key!=='string'||!/^https:\/\/[a-z0-9]+\.supabase\.co\/?$/.test(url)||!/^sb_publishable_[a-zA-Z0-9_-]{20,}$/.test(key))return null;
 return {url:url.replace(/\/$/,''),key};
}
export function cookieValue(header:string|null,name:string){const value=(header||'').split(';').find(value=>value.trim().startsWith(name+'='))?.trim().slice(name.length+1);if(!value||value.length>6000)return '';try{return decodeURIComponent(value);}catch{return '';}}
export function authCookie(name:string,value:string,maxAge=2592000){return name+'='+encodeURIComponent(value)+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age='+maxAge;}
export function clearAuthCookies(){return [accessCookie,refreshCookie,recoveryCookie].map(name=>authCookie(name,'',0));}
function verifiedUser(user:ProviderSession['user']):CustomerUser|null{
 if(!user||typeof user.id!=='string'||!/^[a-f0-9-]{36}$/i.test(user.id)||typeof user.email!=='string'||!user.email_confirmed_at)return null;
 const fullName=typeof user.user_metadata?.full_name==='string'?user.user_metadata.full_name.slice(0,120):null;
 // User metadata is display-only. It never supplies roles or authorization.
 return {userId:'customer:'+user.id,email:user.email,displayName:fullName||user.email,fullName,provider:'supabase'};
}
export class CustomerAuth{
 constructor(private config:AuthConfig,private request:typeof fetch=fetch){}
 private async call(path:string,method='GET',body?:unknown,token?:string){
  let response:Response;
  try{response=await this.request(this.config.url+'/auth/v1/'+path,{method,redirect:'error',headers:{apikey:this.config.key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(10000)});}catch{throw new CustomerAuthError('AUTH_UNAVAILABLE',503);}
  const data=await response.json().catch(()=>({})) as Record<string,any>;
  if(!response.ok){const code=data.error_code||data.code;if(response.status===429)throw new CustomerAuthError('RATE_LIMIT',429);if(code==='email_not_confirmed')throw new CustomerAuthError('EMAIL_NOT_CONFIRMED');if(response.status>=500)throw new CustomerAuthError('AUTH_UNAVAILABLE',503);throw new CustomerAuthError('AUTH_INVALID',401);}
  return data;
 }
 async user(token:string){if(!token)return null;try{return verifiedUser(await this.call('user','GET',undefined,token) as ProviderSession['user']);}catch(error){if(error instanceof CustomerAuthError&&error.code==='AUTH_INVALID')return null;throw error;}}
 private session(data:Record<string,any>){if(typeof data.access_token!=='string'||typeof data.refresh_token!=='string'||!verifiedUser(data.user))throw new CustomerAuthError('EMAIL_NOT_CONFIRMED');return data as ProviderSession;}
 async login(email:string,password:string){const data=this.session(await this.call('token?grant_type=password','POST',{email,password}));if(!await this.user(data.access_token))throw new CustomerAuthError('AUTH_INVALID',401);return data;}
 async refresh(token:string){const data=this.session(await this.call('token?grant_type=refresh_token','POST',{refresh_token:token}));if(!await this.user(data.access_token))throw new CustomerAuthError('AUTH_INVALID',401);return data;}
 async register(email:string,password:string,name:string){await this.call('signup','POST',{email,password,data:{full_name:name}});return {ok:true};}
 async recover(email:string){await this.call('recover','POST',{email});return {ok:true};}
 async verify(hash:string,type:'email'|'recovery'){const data=this.session(await this.call('verify','POST',{token_hash:hash,type}));if(!await this.user(data.access_token))throw new CustomerAuthError('AUTH_INVALID',401);return data;}
 async reset(token:string,password:string){if(!await this.user(token))throw new CustomerAuthError('AUTH_INVALID',401);await this.call('user','PUT',{password},token);await this.call('logout?scope=global','POST',undefined,token);}
 async logout(token:string){if(token)try{await this.call('logout?scope=local','POST',undefined,token);}catch(error){if(!(error instanceof CustomerAuthError&&error.code==='AUTH_INVALID'))throw error;}}
}
