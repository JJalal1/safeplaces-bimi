import {betterAuth} from 'better-auth';
import {APIError,isAPIError,createAuthMiddleware,addOAuthServerContext,getOAuthState,getAuthoritativeSessionFromCtx} from 'better-auth/api';
import {drizzleAdapter} from '@better-auth/drizzle-adapter';
import {getDb} from '../db';
import {authUser,authSession,authAccount,authVerification} from '../db/auth-schema';
import {authBindings,emailPasswordEnabled,enabledProviders,readyAuthConfig} from './auth-settings';
import {authLogger,createAuthErrorHandler} from './auth-log-policy';
import {scheduleAuthEmail} from './auth-email';
import {passwordHashing} from './auth-password';
import {authSessionMethod} from './standalone-auth-policy';
import {EMAIL_AUTH_PATHS} from './auth-request-policy';
import {googleLinkRequestError,googleLinkSessionIdentity,googleLinkCallbackError} from './google-link-policy';

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
  hooks:{before:createAuthMiddleware(async context=>{
   if(context.path!=='/link-social')return;
   if(!google||!passwords)throw new APIError('NOT_FOUND',{code:'GOOGLE_LINK_UNAVAILABLE',message:'Google linking is unavailable'});
   // This check also applies to auth.api calls; the HTTP boundary independently
   // enforces Origin/CSRF and limits the raw body before Better Auth parses it.
   if(context.headers?.get('origin')!==ready.baseURL||context.headers?.get('sec-fetch-site')==='cross-site')throw new APIError('FORBIDDEN',{code:'INVALID_ORIGIN',message:'Invalid origin'});
   const requestError=googleLinkRequestError(context.body);
   if(requestError)throw new APIError('BAD_REQUEST',{code:requestError,message:'Invalid Google link request'});
   const current=await getAuthoritativeSessionFromCtx(context),identity=googleLinkSessionIdentity(current);
   if(!identity)throw new APIError(current?'FORBIDDEN':'UNAUTHORIZED',{code:'GOOGLE_LINK_REAUTH_REQUIRED',message:'Sign in again with a verified account before linking Google'});
   const accounts=await context.context.internalAdapter.findAccounts(identity.userId);
   if(accounts.some(account=>account.providerId==='google'))throw new APIError('CONFLICT',{code:'GOOGLE_LINK_ALREADY_LINKED',message:'Google is already connected'});
   if(!accounts.some(account=>account.providerId==='credential'))throw new APIError('FORBIDDEN',{code:'GOOGLE_LINK_REAUTH_REQUIRED',message:'An existing password account is required'});
   await addOAuthServerContext({googleLink:{version:1,...identity,issuedAt:Date.now()}});
  })},
  account:{
   // A different Google subject must never inherit an owner's/staff member's
   // immutable local ID just because it now owns the same email address.
   accountLinking:{enabled:true,disableImplicitLinking:true,allowDifferentEmails:false,requireLocalEmailVerified:true,trustedProviders:[],updateUserInfoOnLink:false},
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
  user:{
   changeEmail:{enabled:false},deleteUser:{enabled:false},
   validateUserInfo:async ({user,source},context)=>{
    if(source.action!=='link-account')return;
    if(!google||!passwords)return {error:'GOOGLE_LINK_UNAVAILABLE'};
    const state=await getOAuthState();
    const current=await getAuthoritativeSessionFromCtx(context);
    const error=googleLinkCallbackError({user,source,state,session:current});
    if(error)return {error};
    // Recheck after the Google round trip. A pending link may not replace an
    // existing Google identity or complete after another browser linked one.
    const accounts=await context.context.internalAdapter.findAccounts(current!.user.id);
    if(accounts.some(account=>account.providerId==='google'))return {error:'GOOGLE_LINK_ALREADY_LINKED'};
    if(!accounts.some(account=>account.providerId==='credential'))return {error:'GOOGLE_LINK_REAUTH_REQUIRED'};
   }
  },
  // Only the guarded Google redirect flow is supported. Recovery remains a
  // single-use email token; unlinking, mutable auth email and token export stay closed.
  disabledPaths:[
   ...(!passwords?EMAIL_AUTH_PATHS:[]),
   '/change-password','/set-password','/change-email','/delete-user',
   '/update-session',
   ...(!google||!passwords?['/link-social']:[]),
   '/unlink-account','/get-access-token','/refresh-token','/account-info'
  ]
 });
}
