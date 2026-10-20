import {waitUntil} from 'cloudflare:workers';
import {emailSettings,type AuthBindings} from './auth-settings';
import {authLogger} from './auth-log-policy';

export type AuthEmailPurpose='verify'|'reset';
type AuthEmailErrorCode='EMAIL_NOT_CONFIGURED'|'INVALID_AUTH_EMAIL'|'INVALID_AUTH_LINK'|
 'EMAIL_PROVIDER_CONFIGURATION'|'EMAIL_PROVIDER_RATE_LIMIT'|'EMAIL_PROVIDER_UNAVAILABLE'|
 'EMAIL_DELIVERY_FAILED'|'EMAIL_UNAVAILABLE';

class AuthEmailError extends Error{
 constructor(public readonly code:AuthEmailErrorCode){super(code);}
}

/** Every background promise is retained by Workers and every failure is scrubbed. */
export async function scheduleAuthEmail(bindings:AuthBindings,recipient:string,purpose:AuthEmailPurpose,url:string):Promise<void>{
 waitUntil(sendAuthEmail(bindings,recipient,purpose,url).catch(error=>{
  authLogger.log('error','AUTH_EMAIL_ERROR',error);
 }));
}

export async function sendAuthEmail(
 bindings:AuthBindings,
 recipient:string,
 subject:AuthEmailPurpose,
 url:string
):Promise<void>{
 const mail=emailSettings(bindings);
 if(!mail)throw new AuthEmailError('EMAIL_NOT_CONFIGURED');
 if(recipient.length>200||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(recipient))throw new AuthEmailError('INVALID_AUTH_EMAIL');
 try{
  const parsed=new URL(url),base=new URL(String(bindings.BETTER_AUTH_URL));
  const local=bindings.AUTH_ALLOW_LOCAL_HTTP==='true'&&parsed.protocol==='http:'&&['localhost','127.0.0.1'].includes(parsed.hostname);
  const expectedPath=subject==='verify'?parsed.pathname==='/api/auth/verify-email':/^\/api\/auth\/reset-password\/[A-Za-z0-9_-]+$/.test(parsed.pathname);
  // Only Better Auth links on this application's configured origin are mailed.
  if(url.length>8192||(parsed.protocol!=='https:'&&!local)||parsed.origin!==base.origin||parsed.username||parsed.password||parsed.hash||!expectedPath)throw new Error();
 }catch{throw new AuthEmailError('INVALID_AUTH_LINK');}
 const label=subject==='verify'?'تأكيد البريد الإلكتروني':'استعادة كلمة المرور';
 const english=subject==='verify'?'Verify your Safe Places email':'Reset your Safe Places password';
 const plain=label+' / '+english+'\n\n'+url+'\n\nIf you did not request this, ignore this message.';
 const escape=(v:string)=>v.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
 const html='<div dir="rtl" style="font-family:Arial,sans-serif;line-height:2;max-width:520px"><h2>Safe Places — المناطق الآمنة</h2><p>'+escape(label)+'</p><p><a href="'+escape(url)+'">'+escape(english)+'</a></p><p style="font-size:12px;color:#526070">إذا لم تطلب ذلك، يمكنك تجاهل هذه الرسالة.</p></div>';
 let response:Response;
 try{
  response=await fetch('https://api.resend.com/emails',{
   method:'POST',redirect:'manual',
   headers:{Authorization:'Bearer '+mail.key,'Content-Type':'application/json'},
   body:JSON.stringify({from:'Safe Places <'+mail.from+'>',to:[recipient],subject:english,text:plain,html}),
   signal:AbortSignal.timeout(10000)
  });
 }catch{throw new AuthEmailError('EMAIL_UNAVAILABLE');}
 // Provider bodies may contain recipient information. Status alone selects a
 // fixed category, and we never follow a redirect carrying the API credential.
 const status=response.status;
 await response.body?.cancel();
 if(status>=200&&status<300){
  // Acceptance is a provider response, not proof of delivery to an inbox.
  if(subject==='verify')console.info('Safe Places auth diagnostic email/verification_accepted');
  else console.info('Safe Places auth diagnostic email/reset_accepted');
  return;
 }
 if(status===401||status===403)throw new AuthEmailError('EMAIL_PROVIDER_CONFIGURATION');
 if(status===429)throw new AuthEmailError('EMAIL_PROVIDER_RATE_LIMIT');
 if(status>=500)throw new AuthEmailError('EMAIL_PROVIDER_UNAVAILABLE');
 throw new AuthEmailError('EMAIL_DELIVERY_FAILED');
}
