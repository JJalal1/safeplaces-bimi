import {authEmail,authUserId} from './standalone-auth-policy';

/** A recent login proves control of the existing account before adding Google. */
export const GOOGLE_LINK_FRESH_MS=10*60*1000;
type ObjectValue=Record<string,unknown>;
const object=(value:unknown):ObjectValue|null=>value&&typeof value==='object'&&!Array.isArray(value)?value as ObjectValue:null;
const time=(value:unknown)=>value instanceof Date?value.getTime():typeof value==='string'||typeof value==='number'?new Date(value).getTime():NaN;

export function googleLinkCallbacks(lang:string){
 const root='/'+(lang==='en'?'en':'ar')+'/account?tab=security';
 return {callbackURL:root+'&linked=google',errorCallbackURL:root};
}

/** No tokens, provider options, client identity or arbitrary return URLs. */
export function googleLinkRequestError(value:unknown):string|null{
 const body=object(value);
 if(!body||Object.keys(body).some(key=>!['provider','callbackURL','errorCallbackURL','disableRedirect'].includes(key))||body.provider!=='google'||body.disableRedirect!==true)return 'GOOGLE_LINK_INVALID_REQUEST';
 const valid=['ar','en'].some(lang=>{const urls=googleLinkCallbacks(lang);return body.callbackURL===urls.callbackURL&&body.errorCallbackURL===urls.errorCallbackURL;});
 return valid?null:'GOOGLE_LINK_INVALID_REQUEST';
}

/** Call only with Better Auth's authoritative, cookie-validated DB session. */
export function googleLinkSessionIdentity(value:unknown,now=Date.now()){
 const data=object(value),user=object(data?.user),session=object(data?.session);
 if(!user||!session||user.emailVerified!==true||!authUserId(user.id)||!authEmail(user.email)||!authUserId(session.id)||session.userId!==user.id)return null;
 if(session.authMethod!=='password'&&session.authMethod!=='google')return null;
 const createdAt=time(session.createdAt),expiresAt=time(session.expiresAt);
 if(!Number.isFinite(createdAt)||createdAt>now||now-createdAt>=GOOGLE_LINK_FRESH_MS||!Number.isFinite(expiresAt)||expiresAt<=now)return null;
 return {userId:user.id,email:user.email.toLowerCase(),sessionId:session.id};
}

/**
 * Better Auth 1.7.7 invokes user.validateUserInfo before linkOAuthAccount writes.
 * Only its parsed OAuth state/serverContext can supply the intent; request body
 * additionalData is untrusted. Neither this gate nor linking creates a session.
 */
export function googleLinkCallbackError({user,source,state,session}:{user:unknown;source:unknown;state:unknown;session:unknown},now=Date.now()):string|null{
 const identity=googleLinkSessionIdentity(session,now),incoming=object(user),provisioning=object(source),oauth=object(provisioning?.oauth),oauthState=object(state),link=object(oauthState?.link),server=object(oauthState?.serverContext),intent=object(server?.googleLink);
 if(!identity||!intent||intent.version!==1||intent.sessionId!==identity.sessionId||intent.userId!==identity.userId||intent.email!==identity.email)return 'GOOGLE_LINK_REAUTH_REQUIRED';
 if(typeof intent.issuedAt!=='number'||!Number.isFinite(intent.issuedAt)||intent.issuedAt>now||now-intent.issuedAt>=GOOGLE_LINK_FRESH_MS)return 'GOOGLE_LINK_REAUTH_REQUIRED';
 if(provisioning?.action!=='link-account'||provisioning.method!=='oauth'||oauth?.providerId!=='google'||!link||link.userId!==identity.userId||!authEmail(link.email)||link.email.toLowerCase()!==identity.email||incoming?.id!==identity.userId)return 'GOOGLE_LINK_INVALID_REQUEST';
 if(!incoming||incoming.emailVerified!==true||!authEmail(incoming.email))return 'GOOGLE_LINK_EMAIL_NOT_VERIFIED';
 if(incoming.email.toLowerCase()!==identity.email)return 'GOOGLE_LINK_EMAIL_MISMATCH';
 if(googleLinkRequestError({provider:'google',callbackURL:oauthState?.callbackURL,errorCallbackURL:oauthState?.errorURL,disableRedirect:true}))return 'GOOGLE_LINK_INVALID_REQUEST';
 return null;
}
