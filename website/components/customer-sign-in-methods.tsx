'use client';
import {useEffect,useRef,useState} from 'react';
import {CheckCircle2,Link2,LoaderCircle,Mail,ShieldCheck} from 'lucide-react';
import {local,type Lang} from '../lib/config';
import {authClient} from '../lib/auth-client';
import {googleLinkCallbacks} from '../lib/google-link-policy';
import {api} from './store';

function linkError(code:string,lang:Lang){
 if(code==='access_denied')return local(lang,'ألغيت الربط مع Google. حسابك وطريقة الدخول الحالية لم يتغيّرا. يمكنك المحاولة مرة أخرى متى أردت.','Google linking was cancelled. Your account and current sign-in method are unchanged. You can try again whenever you are ready.');
 if(['GOOGLE_LINK_REAUTH_REQUIRED','UNAUTHORIZED','SESSION_NOT_FRESH','session_expired'].includes(code))return local(lang,'لحماية حسابك، أكّد تسجيل الدخول بكلمة مرور حسابك ثم اربط Google خلال عشر دقائق.','To protect your account, confirm your account password, then connect Google within ten minutes.');
 if(['GOOGLE_LINK_EMAIL_MISMATCH','email_does_not_match'].includes(code))return local(lang,'اختر حساب Google الذي يستخدم بريد حسابك الموضّح هنا. لم يتم ربط الحساب الآخر.','Choose the Google account with the email shown here. The other account was not connected.');
 if(['GOOGLE_LINK_EMAIL_NOT_VERIFIED','email_not_verified','email_not_found'].includes(code))return local(lang,'يلزم بريد مؤكّد في حساب Google. أكّد بريدك لدى Google ثم حاول مجددًا.','Google must confirm that the email is verified. Verify it with Google, then try again.');
 if(['GOOGLE_LINK_ALREADY_LINKED','account_already_linked_to_different_user','social_account_already_linked'].includes(code))return local(lang,'تعذّر إضافة حساب Google هذا. حدّث طرق الدخول، أو تواصل مع فريقنا إذا احتجت المساعدة.','This Google account could not be added. Refresh your sign-in methods, or contact our team for help.');
 if(['state_mismatch','state_not_found','state_invalid','invalid_state','state_error','code_verifier_not_found'].includes(code))return local(lang,'انتهت محاولة الربط أو تعذّر التحقق منها. ابدأ محاولة جديدة من هنا.','This linking attempt expired or could not be verified. Start a new attempt here.');
 if(['RATE_LIMIT','TOO_MANY_REQUESTS','RATE_LIMITED'].includes(code))return local(lang,'طلبات كثيرة. انتظر قليلًا ثم حاول مرة أخرى.','Too many requests. Wait a moment, then try again.');
 return local(lang,'تعذّر إكمال الربط. حاول مرة أخرى أو تواصل مع فريقنا للمساعدة.','We could not complete the connection. Try again or contact our team for help.');
}

export function CustomerSignInMethods({lang,email,userId}:{lang:Lang;email:string;userId:string}){
 const [providers,setProviders]=useState<string[]>([]),[available,setAvailable]=useState(false),[status,setStatus]=useState<'loading'|'ready'|'error'>('loading');
 const [error,setError]=useState(''),[callbackError,setCallbackError]=useState(''),[returned,setReturned]=useState(false),[busy,setBusy]=useState(false),[reload,setReload]=useState(0);
 const submitting=useRef(false),root='/'+lang;
 const reauthenticate=root+'/account/login?return_to='+encodeURIComponent(root+'/account?tab=security')+'&reason=link-google';
 const google=providers.includes('google'),password=providers.includes('credential');
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search);setCallbackError(params.get('error')||'');setReturned(params.get('linked')==='google');
  const restore=()=>{submitting.current=false;setBusy(false);};
  window.addEventListener('pageshow',restore);return()=>window.removeEventListener('pageshow',restore);
 },[]);
 useEffect(()=>{
  let cancelled=false;setStatus('loading');setError('');
  Promise.all([authClient.listAccounts(),api<{user:{userId:string}|null;socialProviders:string[];emailPasswordEnabled:boolean}>('session?scope=customer')]).then(([accounts,session])=>{
   if(cancelled)return;
   if(accounts.error)throw new Error(accounts.error.status===429?'RATE_LIMIT':accounts.error.code||'AUTH_UNAVAILABLE');
   if(session.user?.userId!==userId)throw new Error('GOOGLE_LINK_REAUTH_REQUIRED');
   setProviders((accounts.data||[]).map(account=>account.providerId));
   setAvailable(session.socialProviders.includes('google')&&session.emailPasswordEnabled===true);setStatus('ready');
  }).catch(failure=>{if(!cancelled){setError(failure instanceof Error?failure.message:'AUTH_UNAVAILABLE');setStatus('error');}});
  return()=>{cancelled=true;};
 },[reload,userId]);
 async function connect(){
  if(submitting.current||busy||status!=='ready'||!available||google||!password)return;
  submitting.current=true;setBusy(true);setError('');setCallbackError('');
  try{
   const result=await authClient.linkSocial({provider:'google',...googleLinkCallbacks(lang),disableRedirect:true});
   if(result.error)throw new Error(result.error.status===429?'RATE_LIMIT':result.error.code||'AUTH_UNAVAILABLE');
   const destination=new URL(result.data?.url||'');
   if(destination.origin!=='https://accounts.google.com'||destination.pathname!=='/o/oauth2/v2/auth')throw new Error('AUTH_UNAVAILABLE');
   window.location.assign(destination.href);
  }catch(failure){submitting.current=false;setBusy(false);setError(failure instanceof Error?failure.message:'AUTH_UNAVAILABLE');}
 }
 const displayedError=error||callbackError,needsSignIn=['GOOGLE_LINK_REAUTH_REQUIRED','UNAUTHORIZED','SESSION_NOT_FRESH','session_expired'].includes(displayedError);
 return <div className="form-card customer-sign-in-methods" aria-labelledby="customer-sign-in-methods-heading" aria-busy={busy||status==='loading'}>
  <h2 id="customer-sign-in-methods-heading"><ShieldCheck size={23} aria-hidden="true"/>{local(lang,'طرق تسجيل الدخول','Sign-in methods')}</h2>
  <p>{local(lang,'استخدم طرق الدخول المتصلة للوصول إلى حسابك وطلباتك نفسها.','Use your connected sign-in methods to access the same account and requests.')}</p>
  <p className="customer-sign-in-email"><Mail size={17} aria-hidden="true"/><bdi>{email}</bdi></p>
  {displayedError&&<p className={displayedError==='access_denied'?'notice':'form-error'} role={displayedError==='access_denied'?'status':'alert'}>{linkError(displayedError,lang)}</p>}
  {needsSignIn&&<a className="button primary" href={reauthenticate}>{local(lang,'تأكيد تسجيل الدخول','Confirm sign-in')}</a>}
  {status==='loading'?<p role="status"><LoaderCircle size={18} className="spin" aria-hidden="true"/>{local(lang,'جارٍ تحميل طرق الدخول…','Loading sign-in methods…')}</p>:status==='error'?<button type="button" className="button light" onClick={()=>setReload(value=>value+1)}>{local(lang,'إعادة المحاولة','Try again')}</button>:<>
   {returned&&google&&password&&!displayedError&&<p className="customer-auth-verified" role="status"><CheckCircle2 size={20} aria-hidden="true"/>{local(lang,'تم ربط Google بنجاح. يمكنك الآن الدخول باستخدام Google أو بريدك وكلمة المرور.','Google is connected. You can now sign in with Google or your email and password.')}</p>}
   <div className="customer-sign-in-method"><div><strong>Google</strong><p>{google?local(lang,'متصل بحسابك','Connected to your account'):local(lang,'أضف تسجيل الدخول باستخدام Google','Add sign-in with Google')}</p></div>{google?<span className="customer-sign-in-connected"><CheckCircle2 size={18} aria-hidden="true"/>{local(lang,'متصل','Connected')}</span>:available&&password?<button type="button" className="button primary" disabled={busy||needsSignIn} onClick={connect}>{busy?<LoaderCircle size={17} className="spin" aria-hidden="true"/>:<Link2 size={17} aria-hidden="true"/>}{busy?local(lang,'جارٍ الانتقال إلى Google…','Opening Google…'):local(lang,'ربط Google','Connect Google')}</button>:<span>{local(lang,'غير متاح حاليًا','Currently unavailable')}</span>}</div>
   {password&&<div className="customer-sign-in-method"><div><strong>{local(lang,'البريد وكلمة المرور','Email and password')}</strong><p>{local(lang,'بريدك مؤكّد. يمكنك استخدام كلمة مرور حسابك.','Your email is verified. You can use your account password.')}</p></div><span className="customer-sign-in-connected"><CheckCircle2 size={18} aria-hidden="true"/>{local(lang,'مفعّل','Enabled')}</span></div>}
   {!google&&available&&password&&<p className="customer-sign-in-help">{local(lang,'خطوة واحدة فقط: أكّد الدخول بكلمة مرور حسابك إذا طُلب منك، ثم اختر حساب Google بالبريد نفسه. ستبقى طلباتك ومفضلتك في حسابك الحالي.','One-time setup: confirm your account password if prompted, then choose Google with the same email. Your requests and favourites stay in your current account.')}</p>}
  </>}
  <a className="text-link" href={root+'/contact'}>{local(lang,'تحتاج مساعدة في حسابك؟','Need help with your account?')}</a>
 </div>;
}
