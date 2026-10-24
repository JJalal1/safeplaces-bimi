/**
 * Better Auth's default logger can include OAuth state, provider response
 * bodies and tokens in error arguments. Only fixed diagnostic categories
 * cross this boundary; unknown messages and fields are never printed.
 */
function ownString(value:unknown,key:string):string|undefined{
 if(!value||typeof value!=='object')return;
 try{
  const field=Object.getOwnPropertyDescriptor(value,key);
  return field&&'value' in field&&typeof field.value==='string'?field.value:undefined;
 }catch{return;}
}

const tokenErrors=new Set([
 'invalid_client','invalid_grant','invalid_request','unauthorized_client',
 'access_denied','temporarily_unavailable','server_error','invalid_scope',
 'unsupported_grant_type'
]);

const emailFailureCodes:Record<string,string>={
 EMAIL_NOT_CONFIGURED:'not_configured',
 INVALID_AUTH_EMAIL:'recipient_invalid',
 INVALID_AUTH_LINK:'link_invalid',
 EMAIL_PROVIDER_CONFIGURATION:'provider_configuration',
 EMAIL_PROVIDER_RATE_LIMIT:'provider_rate_limit',
 EMAIL_PROVIDER_UNAVAILABLE:'provider_unavailable',
 EMAIL_DELIVERY_FAILED:'delivery_failed',
 EMAIL_UNAVAILABLE:'request_failed'
};
const passwordFailureCodes=new Set(['PASSWORD_HASH_UNAVAILABLE','PASSWORD_HASH_INVALID_RESPONSE']);

export function authLogCategory(message:unknown,args:readonly unknown[]=[]){
 if(message==='AUTH_EMAIL_ERROR'){
  const code=ownString(args[0],'code')||ownString(args[0],'message');
  return {stage:'auth_email',code:code&&Object.prototype.hasOwnProperty.call(emailFailureCodes,code)?emailFailureCodes[code]:'delivery_failed'};
 }
 if(message==='AUTH_PASSWORD_ERROR')return {stage:'auth_password',code:'hash_unavailable'};
 if(message==='EMAIL_PASSWORD_NOT_CONFIGURED')return {stage:'auth_email',code:'not_configured'};
 // Ordinary rejected credentials and reset requests use the same fixed category;
 // the logs never reveal whether a submitted address belongs to an account.
 if(typeof message==='string'&&['User not found','Password not found','Invalid password'].includes(message))return {stage:'auth_password',code:'credentials_rejected'};
 if(message==='Reset Password: User not found')return {stage:'auth_password',code:'reset_requested'};
 if(message==='Verification email isn\'t enabled.')return {stage:'auth_email',code:'not_configured'};
 if(message==='Reset password isn\'t enabled.Please pass an emailAndPassword.sendResetPassword function in your auth config!')return {stage:'auth_email',code:'not_configured'};
 if(message==='UNEXPECTED_AUTH_ERROR')return {stage:'authentication',code:'unexpected_error'};
 if(message==='Failed to parse state'){
  const detail=ownString(args[0],'message');
  const code=detail==='State mismatch: verification not found'?'state_record_missing':
   detail==='State mismatch: State not persisted correctly'?'state_cookie_rejected':
   detail==='State mismatch: auth state cookie not found'?'state_cookie_missing':
   detail==='State mismatch: OAuth state parameter does not match stored state'?'state_value_mismatch':
   detail==='Invalid state: request expired'?'state_expired':
   detail==='State invalid: Failed to decrypt or parse auth state'?'state_invalid':'state_rejected';
  return {stage:'oauth_state',code};
 }
 if(message==='State not found')return {stage:'oauth_state',code:'state_missing'};
 if(message==='Failed to create verification')return {stage:'oauth_state',code:'state_generation_failed'};
 // In the pinned callback handler, the empty message wraps a token-exchange
 // exception. A provider's error_description/body is deliberately ignored.
 if(message===''){
  const providerCode=ownString(args[0],'error');
  return {stage:'oauth_token',code:providerCode&&tokenErrors.has(providerCode)?providerCode:'exchange_failed'};
 }
 if(message==='INVALID_CALLBACK_REQUEST')return {stage:'oauth_callback',code:'request_invalid'};
 if(message==='Code not found')return {stage:'oauth_callback',code:'code_missing'};
 if(message==='OAuth issuer mismatch')return {stage:'oauth_callback',code:'issuer_mismatch'};
 if(message==='No callback URL found')return {stage:'oauth_callback',code:'destination_missing'};
 if(message==='Unable to get user info'||message==='Failed to get user info')return {stage:'oauth_profile',code:'profile_unavailable'};
 if(message==='Unable to derive provider account identity')return {stage:'oauth_profile',code:'identity_invalid'};
 if(message==='Invalid id token')return {stage:'oauth_token',code:'id_token_invalid'};
 if(message==='unable_to_create_user')return {stage:'oauth_account',code:'user_creation_failed'};
 if(message==='unable_to_create_session')return {stage:'oauth_account',code:'session_creation_failed'};
 if(message==='account_not_linked')return {stage:'oauth_account',code:'account_not_linked'};
 return {stage:'authentication',code:'unclassified_failure'};
}

export const authLogger={
 level:'warn' as const,
 log(level:'debug'|'info'|'warn'|'error',message:string,...args:unknown[]){
  if(level!=='warn'&&level!=='error')return;
  const {stage,code}=authLogCategory(message,args);
  const safeMessage='Safe Places auth diagnostic '+stage+'/'+code;
  if(level==='error')console.error(safeMessage);else console.warn(safeMessage);
 }
};

/**
 * Returning from Better Auth's error hook suppresses its default logger, but
 * Better Call still logs unexpected errors unless the hook throws an APIError.
 * Keep expected API responses intact and replace only unexpected exceptions.
 * The public APIError helpers are supplied by the server entry point.
 */
export function createAuthErrorHandler(isAPIError:(error:unknown)=>boolean,unavailable:()=>Error){
 return (error:unknown):void=>{
  if(isAPIError(error))return;
  const code=ownString(error,'code')||ownString(error,'message');
  if(code&&Object.prototype.hasOwnProperty.call(emailFailureCodes,code))authLogger.log('error','AUTH_EMAIL_ERROR',error);
  else if(code&&passwordFailureCodes.has(code))authLogger.log('error','AUTH_PASSWORD_ERROR');
  else authLogger.log('error','UNEXPECTED_AUTH_ERROR');
  throw unavailable();
 };
}
