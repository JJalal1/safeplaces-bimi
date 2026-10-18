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

export function authLogCategory(message:unknown,args:readonly unknown[]=[]){
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
  authLogger.log('error','UNEXPECTED_AUTH_ERROR');
  throw unavailable();
 };
}
