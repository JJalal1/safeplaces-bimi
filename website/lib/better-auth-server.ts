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
  appName:'Safe Places',
  baseURL:ready.baseURL,
  basePath:'/api/auth',
  secret:ready.secret,
  database:drizzleAdapter(getDb(),{
   provider:'sqlite',
   schema:{user:authUser,session:authSession,account:authAccount,verification:authVerification}
  }),
  advanced:{
   database:{generateId:()=>crypto.randomUUID()},
   useSecureCookies:ready.baseURL.startsWith('https:'),
   defaultCookieAttributes:{httpOnly:true,sameSite:'lax',path:'/'},
   crossSubDomainCookies:{enabled:false},
   disableCSRFCheck:false,
   disableOriginCheck:false,
   ipAddress:{ipAddressHeaders:['cf-connecting-ip']}
  },
  trustedOrigins:[ready.baseURL],
  session:{cookieCache:{enabled:false}},
  account:{
   // A different Google subject must never inherit an owner's/staff member's
   // immutable local ID just because it now owns the same email address.
   accountLinking:{enabled:false,disableImplicitLinking:true},
   storeStateStrategy:'database',
   skipStateCookieCheck:false,
   encryptOAuthTokens:true
  },
  socialProviders:{
   google:{
    clientId:String(bindings.GOOGLE_CLIENT_ID).trim(),
    clientSecret:String(bindings.GOOGLE_CLIENT_SECRET).trim(),
    prompt:'select_account'
   }
  },
  emailAndPassword:{enabled:false},
  user:{changeEmail:{enabled:false},deleteUser:{enabled:false}},
  // These features are not part of Google-only sign-in. In particular, the
  // shop never needs to return Google API access/refresh tokens to a browser.
  disabledPaths:[
   '/sign-in/email','/sign-up/email','/request-password-reset','/reset-password',
   '/change-password','/set-password','/change-email','/delete-user',
   '/link-social','/unlink-account','/get-access-token','/refresh-token','/account-info'
  ]
 });
}
