import {betterAuth} from 'better-auth';
import {drizzleAdapter} from '@better-auth/drizzle-adapter';
import {getDb} from '../db';
import {authUser,authSession,authAccount,authVerification} from '../db/auth-schema';
import {authBindings,enabledProviders,readyAuthConfig} from './auth-settings';

/**
 * Google-only launch. Password signup, reset and other social providers can
 * be enabled later when their email and OAuth integrations are fully tested.
 */
export function getStandaloneAuth(){
 const bindings=authBindings(),ready=readyAuthConfig(bindings);
 if(!ready)return null;
 const google=enabledProviders(bindings).includes('google');
 if(!google)return null;
 return betterAuth({
  baseURL:ready.baseURL,
  basePath:'/api/auth',
  secret:ready.secret,
  database:drizzleAdapter(getDb(),{
   provider:'sqlite',
   schema:{user:authUser,session:authSession,account:authAccount,verification:authVerification}
  }),
  advanced:{database:{generateId:()=>crypto.randomUUID()}},
  trustedOrigins:[ready.baseURL],
  socialProviders:{
   google:{
    clientId:String(bindings.GOOGLE_CLIENT_ID),
    clientSecret:String(bindings.GOOGLE_CLIENT_SECRET),
    prompt:'select_account'
   }
  },
  emailAndPassword:{enabled:false}
 });
}
