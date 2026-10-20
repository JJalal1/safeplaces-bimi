import {betterAuth} from 'better-auth';
import {APIError,isAPIError} from 'better-auth/api';
import {drizzleAdapter} from '@better-auth/drizzle-adapter';
import {getDb} from '../db';
import {authUser,authSession,authAccount,authVerification} from '../db/auth-schema';
import {authBindings,emailPasswordEnabled,enabledProviders,readyAuthConfig} from './auth-settings';
import {authLogger,createAuthErrorHandler} from './auth-log-policy';
import {scheduleAuthEmail} from './auth-email';
import {passwordHashing} from './auth-password';
import {authSessionMethod} from './standalone-auth-policy';
import {EMAIL_AUTH_PATHS} from './auth-request-policy';

/**
 * Customer identities use verified Google or verified email/password accounts.
 * Administration independently requires a successful Google callback session.
 */
export function getStandaloneAuth(){
 const bindings=authBindings(),ready=readyAuthConfig(bindings);
 if(!ready)return null;
 const google=enabledProviders(bindings).includes('google');
 const passwords=emailPasswordEnabled(bindings);
 return betterAuth({
  appName:'Safe Places',
  baseURL:ready.baseURL,
  basePath:'/api/auth',
  secret:ready.secret,
  logger:authLogger,
  onAPIError:{onError:createAuthErrorHandler(isAPIError,()=>new APIError('INTERNAL_SERVER_ERROR'))},
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
  session:{
   cookieCache:{enabled:false},
   additionalFields:{
    // Drizzle maps this property to auth_session.auth_method. input:false keeps
    // every public input endpoint from writing it; the database hook sets it.
    authMethod:{type:'string',required:true,defaultValue:'unknown',input:false}
   }
  },
  databaseHooks:{
   session:{create:{before:async (_session,context)=>({
    data:{authMethod:authSessionMethod(context)}
   })}}
  },
  account:{
   // A different Google subject must never inherit an owner's/staff member's
   // immutable local ID just because it now owns the same email address.
   accountLinking:{enabled:false,disableImplicitLinking:true},
   storeStateStrategy:'database',
   skipStateCookieCheck:false,
   encryptOAuthTokens:true
  },
  socialProviders:google?{
   google:{
    clientId:String(bindings.GOOGLE_CLIENT_ID).trim(),
    clientSecret:String(bindings.GOOGLE_CLIENT_SECRET).trim(),
    prompt:'select_account'
   }
  }:{},
  emailAndPassword:passwords?{
   enabled:true,
   requireEmailVerification:true,
   autoSignIn:false,
   minPasswordLength:12,
   maxPasswordLength:128,
   password:passwordHashing({AUTH_PASSWORD_HASHER:bindings.AUTH_PASSWORD_HASHER}),
   resetPasswordTokenExpiresIn:30*60,
   revokeSessionsOnPasswordReset:true,
   sendResetPassword:async ({user,url})=>scheduleAuthEmail(bindings,user.email,'reset',url)
  }:{enabled:false},
  emailVerification:passwords?{
   sendOnSignUp:true,
   sendOnSignIn:false,
   autoSignInAfterVerification:false,
   expiresIn:60*60,
   sendVerificationEmail:async ({user,url})=>scheduleAuthEmail(bindings,user.email,'verify',url)
  }:undefined,
  user:{changeEmail:{enabled:false},deleteUser:{enabled:false}},
  // Recovery uses a single-use email token. Public account linking, mutable
  // auth email and token-export endpoints remain outside the supported flow.
  disabledPaths:[
   ...(!passwords?EMAIL_AUTH_PATHS:[]),
   '/change-password','/set-password','/change-email','/delete-user',
   '/update-session',
   '/link-social','/unlink-account','/get-access-token','/refresh-token','/account-info'
  ]
 });
}
