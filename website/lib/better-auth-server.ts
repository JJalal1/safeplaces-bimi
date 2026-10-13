import {betterAuth} from 'better-auth';
import {drizzleAdapter} from '@better-auth/drizzle-adapter';
import {getDb} from '../db';
import {authUser,authSession,authAccount,authVerification} from '../db/auth-schema';
import {authBindings,enabledProviders,emailSettings,readyAuthConfig} from './auth-settings';
import {sendAuthEmail} from './auth-email';

export function getStandaloneAuth(){
 const bindings=authBindings(),ready=readyAuthConfig(bindings);
 if(!ready)return null;
 const email=emailSettings(bindings)!;
 const providers=enabledProviders(bindings);
 const socialProviders:Record<string,any>={};
 for(const name of providers){
  const prefix=name.toUpperCase();
  socialProviders[name]={
   clientId:String(bindings[prefix+'_CLIENT_ID']),
   clientSecret:String(bindings[prefix+'_CLIENT_SECRET']),
   ...(name==='microsoft'?{tenantId:'common'}:{}),
   ...(name==='google'?{prompt:'select_account'}:{})
  };
 }
 return betterAuth({
  baseURL:ready.baseURL,
  basePath:'/api/auth',
  secret:ready.secret,
  database:drizzleAdapter(getDb(),{
   provider:'sqlite',
   schema:{user:authUser,session:authSession,account:authAccount,verification:authVerification}
  }),
  advanced:{
   database:{generateId:()=>crypto.randomUUID()}
  },
  trustedOrigins:[ready.baseURL,...(providers.includes('apple')?['https://appleid.apple.com']:[])],
  socialProviders,
  account:{accountLinking:{enabled:true,trustedProviders:[]}},
  emailAndPassword:{
   enabled:true,
   minPasswordLength:12,
   revokeSessionsOnPasswordReset:true,
   requireEmailVerification:true,
   sendResetPassword:async({user,url})=>sendAuthEmail(bindings,user.email,'reset',url)
  },
  emailVerification:{
   sendOnSignUp:true,
   autoSignInAfterVerification:false,
   sendVerificationEmail:async({user,url})=>sendAuthEmail(bindings,user.email,'verify',url)
  }
 });
}
