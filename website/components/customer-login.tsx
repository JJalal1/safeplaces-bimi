'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {LockKeyhole,Mail,Eye,EyeOff,UserRound,CheckCircle2,LoaderCircle,ShieldCheck,ChevronLeft,ShoppingBag,Heart} from 'lucide-react';
import {local,type Lang} from '../lib/config';
import {customerReturnPath} from '../lib/customer-routes';
import {api,errorText} from './store';
import {authClient} from '../lib/auth-client';
import {Brand} from './brand';

export type LoginMode='login'|'register'|'forgot'|'confirm'|'reset'|'verify';
function GoogleMark(){return <svg className="customer-social-mark" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.02v2.51h3.23c1.89-1.74 2.99-4.31 2.99-7.36Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.89 6.61-2.41l-3.23-2.51c-.89.6-2.03.95-3.38.95-2.61 0-4.83-1.76-5.63-4.12H3.03v2.59A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.37 13.91a6 6 0 0 1 0-3.82V7.5H3.03a10 10 0 0 0 0 9l3.34-2.59Z"/><path fill="#EA4335" d="M12 5.97c1.47 0 2.79.51 3.83 1.51l2.87-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.97 5.5l3.34 2.59C7.17 7.73 9.39 5.97 12 5.97Z"/></svg>;}
function googleError(code:string,lang:Lang,passwordsAvailable=false){
 if(code==='access_denied')return local(lang,'تم إلغاء تسجيل الدخول. اختر المتابعة باستخدام Google للمحاولة مرة أخرى.','Sign-in was cancelled. Choose Continue with Google to try again.');
 if(code==='invalid_code')return local(lang,'تعذّر تأكيد تسجيل الدخول عبر Google. حاول مرة أخرى، وإذا استمرت المشكلة فتواصل مع فريقنا.','We could not complete sign-in with Google. Try again, and contact our team if the problem continues.');
 if(['state_mismatch','state_not_found','state_invalid','invalid_state','state_error','code_verifier_not_found'].includes(code))return local(lang,'انتهت صلاحية محاولة الدخول أو تعذر التحقق منها. ابدأ تسجيل الدخول مجددًا من هذه الصفحة.','The sign-in attempt expired or could not be verified. Start again from this page.');
 if(['account_not_linked','unable_to_link_account','social_account_already_linked'].includes(code))return passwordsAvailable?local(lang,'تعذّر إكمال الدخول بهذه الطريقة. استخدم طريقة الدخول التي اخترتها عند إنشاء حسابك، أو استعد كلمة المرور عبر بريدك.','This sign-in method could not be completed. Use the method you chose when creating your account, or reset your password by email.'):local(lang,'تعذر ربط حساب Google بهذا الحساب. تواصل مع مالك المؤسسة للتحقق من الحساب المعتمد.','This Google account could not be linked. Ask the owner to verify the approved account.');
 if(['email_not_verified','email_not_found'].includes(code))return local(lang,'يلزم حساب Google ببريد إلكتروني مؤكّد لإتمام الدخول.','A Google account with a verified email is required to sign in.');
 return local(lang,'تعذر إتمام تسجيل الدخول باستخدام Google. حاول مجددًا أو تواصل مع فريق المؤسسة إذا استمرت المشكلة.','Google sign-in could not be completed. Try again or contact our team if the issue continues.');
}
function emailError(code:string,lang:Lang){
 const normalized=code.toUpperCase();
 if(['INVALID_EMAIL_OR_PASSWORD','INVALID_PASSWORD','USER_NOT_FOUND'].includes(normalized))return local(lang,'البريد الإلكتروني أو كلمة المرور غير صحيحة. راجع البيانات وحاول مجددًا.','The email or password is incorrect. Check your details and try again.');
 if(normalized==='EMAIL_NOT_VERIFIED')return local(lang,'أكّد بريدك من رسالة التفعيل قبل تسجيل الدخول. يمكنك طلب رسالة تأكيد جديدة.','Verify your email before signing in. You can request a new verification email.');
 if(['INVALID_TOKEN','TOKEN_EXPIRED','INVALID_VERIFICATION_TOKEN','EMAIL_VERIFICATION_TOKEN_EXPIRED'].includes(normalized))return local(lang,'الرابط غير صالح أو انتهت صلاحيته. اطلب رابطًا جديدًا ثم افتح أحدث رسالة.','This link is invalid or has expired. Request a new link and open the latest email.');
 if(['PASSWORD_TOO_SHORT','PASSWORD_TOO_LONG'].includes(normalized))return local(lang,'استخدم كلمة مرور من 12 إلى 128 حرفًا.','Use a password between 12 and 128 characters.');
 if(normalized==='INVALID_EMAIL')return local(lang,'أدخل عنوان بريد إلكتروني صحيحًا.','Enter a valid email address.');
 if(['RATE_LIMIT','TOO_MANY_REQUESTS','RATE_LIMITED'].includes(normalized))return errorText(new Error('RATE_LIMIT'),lang);
 if(normalized==='PASSWORD_MISMATCH')return errorText(new Error(normalized),lang);
 return local(lang,'تعذّر إتمام الطلب. حاول مرة أخرى، أو تواصل مع فريقنا إذا استمرت المشكلة.','We could not complete the request. Try again, or contact our team if the problem continues.');
}
export function CustomerLogin({lang,mode='login',configured,previewHref,returnTo,reason='account',tokenHash='',socialProviders=[],standalone=false,emailPasswordEnabled=false,resetToken=''}:{lang:Lang;mode?:LoginMode;configured:boolean;previewHref?:string;returnTo?:string;reason?:string;tokenHash?:string;socialProviders?:string[];standalone?:boolean;emailPasswordEnabled?:boolean;resetToken?:string}){
 const [visible,setVisible]=useState(false),[busyAction,setBusyAction]=useState<'google'|'email'|null>(null),[error,setError]=useState(''),[done,setDone]=useState(''),[recoveryReady,setRecoveryReady]=useState(false);
 const [verified,setVerified]=useState(false),[needsVerification,setNeedsVerification]=useState(false),[resetLinkInvalid,setResetLinkInvalid]=useState(false);
 const busy=busyAction!==null,root='/'+lang,target=customerReturnPath(returnTo,lang);
 const adminTarget=reason==='admin'||/^\/(ar|en)\/admin(?:[/?#]|$)/.test(target);
 const emailFormAvailable=!adminTarget&&(!standalone||emailPasswordEnabled);
 const displayMode:LoginMode=adminTarget||(standalone&&!emailPasswordEnabled)?'login':standalone&&mode==='confirm'?'verify':!standalone&&mode==='verify'?'confirm':mode;
 const showGoogle=configured&&standalone&&socialProviders.includes('google')&&(displayMode==='login'||displayMode==='register');
 const resetUnavailable=standalone&&displayMode==='reset'&&(!resetToken||resetLinkInvalid);
 const path=(next:string)=>root+'/account/'+next+'?return_to='+encodeURIComponent(target)+'&reason='+(adminTarget?'admin':reason==='checkout'||reason==='wishlist'?reason:'account');
 const registrationMessage=local(lang,'إذا أمكن إنشاء الحساب، ستصلك رسالة لتأكيد بريدك. افتح الرابط ثم سجّل الدخول. راجع البريد غير المرغوب فيه أيضًا.','If an account can be created, you will receive a verification email. Open the link, then sign in. Check your spam folder too.');
 const title=adminTarget?local(lang,'تسجيل دخول الإدارة','Administration sign-in'):displayMode==='register'?local(lang,'أنشئ حسابك','Create your account'):displayMode==='forgot'?local(lang,'استعادة كلمة المرور','Reset your password'):displayMode==='verify'?local(lang,'تأكيد البريد الإلكتروني','Verify your email'):displayMode==='confirm'?local(lang,'تأكيد البريد الإلكتروني','Confirm your email'):displayMode==='reset'?local(lang,'كلمة مرور جديدة','Choose a new password'):local(lang,'مرحبًا بعودتك','Welcome back');
 const description=adminTarget?local(lang,'استخدم حساب Google المعتمد لك لدى المؤسسة. تظهر لك أقسام الإدارة حسب الصلاحيات الممنوحة لحسابك.','Use the Google account approved by the owner. Your assigned permissions determine which administration sections you can access.'):displayMode==='register'?local(lang,'احتفظ بمفضلتك وتابع طلبات عروض الأسعار في مكان واحد.','Keep your favourites and quote requests in one place.'):displayMode==='forgot'?local(lang,'أدخل بريد حسابك لإرسال رابط الاستعادة.','Enter your account email to request a recovery link.'):displayMode==='verify'?local(lang,'افتح رابط التأكيد في بريدك. إذا لم تصلك الرسالة، أدخل بريدك لطلب رابط جديد.','Open the verification link in your email. If the message has not arrived, enter your email to request a new link.'):displayMode==='confirm'?local(lang,'أكّد بريدك لتفعيل حسابك في المتجر.','Confirm your email to activate your shop account.'):displayMode==='reset'?local(lang,'اختر كلمة مرور طويلة تستخدمها لهذا الحساب فقط.','Choose a long password used only for this account.'):reason==='checkout'?local(lang,'سجّل الدخول لمتابعة طلبك. اختياراتك محفوظة.','Sign in to continue your request. Your selections are saved.'):reason==='wishlist'?local(lang,'سجّل الدخول لحفظ مفضلتك في حسابك والرجوع إليها من أي جهاز.','Sign in to keep your favourites in your account across devices.'):local(lang,'سجّل الدخول لمتابعة طلباتك وإدارة بياناتك.','Sign in to track your requests and manage your details.');
 useEffect(()=>{
  const params=new URLSearchParams(window.location.search),callbackError=params.get('error');
  if(standalone&&emailPasswordEnabled&&displayMode==='login'&&params.get('verified')==='1')setVerified(true);
  if(standalone&&callbackError){
   const emailLinkError=['INVALID_TOKEN','TOKEN_EXPIRED','INVALID_VERIFICATION_TOKEN','EMAIL_VERIFICATION_TOKEN_EXPIRED'].includes(callbackError.toUpperCase());
   setError(emailPasswordEnabled&&(emailLinkError||displayMode==='reset'||displayMode==='verify')?emailError(callbackError,lang):googleError(callbackError,lang,emailFormAvailable&&emailPasswordEnabled));
   if(displayMode==='reset')setResetLinkInvalid(true);
   if(emailLinkError&&displayMode==='login')setNeedsVerification(true);
   return;
  }
  if(displayMode==='login'&&configured&&!adminTarget){let cancelled=false;api('session').then(result=>{if(!cancelled&&result.user&&(result.user.provider==='supabase'||result.user.provider==='standalone'))window.location.assign(target);}).catch(()=>{});return()=>{cancelled=true;};}
 },[adminTarget,configured,displayMode,emailFormAvailable,emailPasswordEnabled,lang,standalone,target]);
 async function social(provider:string){
  if(!configured||busy||provider!=='google')return;setBusyAction('google');setError('');
  try{
   const errorCallbackURL=root+'/account/login?return_to='+encodeURIComponent(target)+'&reason='+(adminTarget?'admin':'account');
   const result=await authClient.signIn.social({provider:'google',callbackURL:target,newUserCallbackURL:target,errorCallbackURL});
   if(result.error){setError(result.error.status===429?errorText(new Error('RATE_LIMIT'),lang):googleError(result.error.code||'',lang,emailFormAvailable&&emailPasswordEnabled));setBusyAction(null);}
  }catch(error){setError(errorText(error,lang));setBusyAction(null);}
 }
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!configured||!emailFormAvailable||busy||resetUnavailable)return;setBusyAction('email');setError('');setNeedsVerification(false);
  const form=new FormData(event.currentTarget),password=String(form.get('password')||''),email=String(form.get('email')||'').trim();
  try{
   if((displayMode==='register'||displayMode==='reset')&&password!==form.get('confirmPassword'))throw new Error('PASSWORD_MISMATCH');
   if(standalone){
    const callbackURL=path('login')+'&verified=1';
    const result=displayMode==='login'?await authClient.signIn.email({email,password,callbackURL:target,rememberMe:true}):
     displayMode==='register'?await authClient.signUp.email({name:String(form.get('name')||'').trim(),email,password,callbackURL}):
     displayMode==='forgot'?await authClient.requestPasswordReset({email,redirectTo:path('reset')}):
     displayMode==='reset'?await authClient.resetPassword({newPassword:password,token:resetToken}):
     await authClient.sendVerificationEmail({email,callbackURL});
    if(result.error){
     const code=result.error.status===429?'RATE_LIMIT':result.error.code||'AUTH_UNAVAILABLE';
     if(displayMode==='register'&&['USER_ALREADY_EXISTS','USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL'].includes(code)){setDone(registrationMessage);return;}
     if(code==='EMAIL_NOT_VERIFIED')setNeedsVerification(true);
     if(displayMode==='reset'&&['INVALID_TOKEN','TOKEN_EXPIRED'].includes(code))setResetLinkInvalid(true);
     throw new Error(code);
    }
   }else{
    if(displayMode==='reset'&&!recoveryReady){await api('auth/recovery-verify',{token_hash:tokenHash});setRecoveryReady(true);}
    await api('auth/'+(displayMode==='forgot'?'recover':displayMode==='reset'?'reset':displayMode==='confirm'?'confirm':displayMode),displayMode==='confirm'?{token_hash:tokenHash}:displayMode==='reset'?{password}:{email,password,name:form.get('name')});
   }
   if(displayMode==='login'||displayMode==='confirm'){window.location.assign(target);return;}
   setDone(displayMode==='register'?registrationMessage:displayMode==='forgot'?local(lang,'إذا كان البريد مرتبطًا بحساب، ستصلك رسالة بخطوات الاستعادة. راجع البريد غير المرغوب فيه أيضًا.','If this email has an account, you will receive recovery instructions. Check your spam folder too.'):displayMode==='verify'?local(lang,'إذا كان هذا البريد يحتاج إلى تأكيد، فستصلك رسالة برابط جديد. افتح أحدث رسالة ثم سجّل الدخول.','If this email needs verification, you will receive a new link. Open the latest message, then sign in.'):local(lang,'تم تحديث كلمة المرور. سجّل الدخول بكلمة المرور الجديدة.','Your password was updated. Sign in with your new password.'));
  }catch(error){setError(standalone?emailError(error instanceof Error?error.message:'',lang):errorText(error,lang));}finally{setBusyAction(null);}
 }
 const otherLang=lang==='ar'?'en':'ar',otherTarget=target.replace(/^\/(ar|en)(?=\/|$)/,'/'+otherLang);
 const languageHref='/'+otherLang+'/account/'+(['confirm','reset'].includes(displayMode)?'login':displayMode)+'?return_to='+encodeURIComponent(otherTarget)+'&reason='+(adminTarget?'admin':reason==='checkout'||reason==='wishlist'?reason:'account');
 return <div className="customer-login-layout">
 <nav className="customer-login-navigation" aria-label={local(lang,'روابط تسجيل الدخول','Sign-in navigation')}>
  <a className="customer-login-back" href={root} aria-label={local(lang,'العودة إلى الموقع','Back to the website')}><ChevronLeft size={26}/></a>
  <a className="customer-login-language" href={languageHref} lang={otherLang} hrefLang={otherLang}>{local(lang,'English','العربية')}</a>
 </nav>
 <div className="customer-login-brand"><Brand lang={lang}/><p className="customer-login-security"><LockKeyhole size={14}/>{local(lang,'تسجيل دخول آمن','Secure sign-in')}</p></div>
 <div className="customer-login-benefits" role="list" aria-label={local(lang,'مع حساب المناطق الآمنة','With your Safe Places account')}>
  <div role="listitem">{adminTarget?<ShieldCheck size={21}/>:<ShoppingBag size={21}/>}<strong>{adminTarget?local(lang,'وصول حسب صلاحياتك','Access for your role'):local(lang,'متابعة طلباتك','Track your requests')}</strong><span>{adminTarget?local(lang,'الأقسام المخصصة لدورك','Your assigned sections'):local(lang,'كل التفاصيل في مكان واحد','All the details in one place')}</span></div>
  <div role="listitem">{adminTarget?<UserRound size={21}/>:<Heart size={21}/>}<strong>{adminTarget?local(lang,'حسابك المعتمد','Your approved account'):local(lang,'مفضلتك معك','Your saved favourites')}</strong><span>{adminTarget?local(lang,'دخول باستخدام Google','Sign in with Google'):local(lang,'ارجع إليها من أي جهاز','Available across your devices')}</span></div>
 </div>
 <section className="customer-login-card" aria-labelledby="customer-login-heading"><h1 id="customer-login-heading">{title}</h1><p>{description}</p>{!configured&&<div className="notice">{local(lang,'تسجيل الدخول بالحسابات لم يُفعّل بعد. يمكنك مواصلة تصفح المتجر والتواصل مع فريقنا.','Account sign-in is not open yet. You can continue browsing and contact our team.')}{previewHref&&<a className="text-link" target="_top" href={previewHref}>{local(lang,'معاينة حساب العميل في النسخة الخاصة','Preview the customer account in this private version')}</a>}</div>}
 {error&&<p className="form-error" role="alert">{error}</p>}
 {needsVerification&&emailFormAvailable&&<a className="customer-auth-verify-link" href={path('verify')}>{local(lang,'إرسال رسالة تأكيد جديدة','Send a new verification email')}</a>}
 {verified&&emailFormAvailable&&displayMode==='login'&&!error&&<p className="customer-auth-verified" role="status"><CheckCircle2 size={19} aria-hidden="true"/>{local(lang,'تم تأكيد بريدك. سجّل الدخول بكلمة مرور حسابك.','Your email is verified. Sign in with your account password.')}</p>}
 {showGoogle&&!done&&<div className="customer-social-login" aria-label={local(lang,'تسجيل الدخول باستخدام Google','Google sign-in')}><button type="button" className="customer-social-button customer-social-google" disabled={busy} aria-busy={busyAction==='google'} onClick={()=>social('google')}><span className="customer-social-icon">{busyAction==='google'?<LoaderCircle size={20} className="spin" aria-hidden="true"/>:<GoogleMark/>}</span><span>{busyAction==='google'?local(lang,'جارٍ الانتقال إلى Google…','Opening Google…'):local(lang,'المتابعة باستخدام Google','Continue with Google')}</span></button></div>}
 {!configured?<div className="customer-auth-closed"><a className="button primary" href={root+"/shop"}>{local(lang,"مواصلة التسوق دون حساب","Continue shopping without an account")}</a><a className="text-link" href={root+"/contact"}>{local(lang,"تواصل مع فريق المبيعات","Contact our sales team")}</a></div>:done?<div className="customer-auth-success" role="status"><CheckCircle2 size={30} aria-hidden="true"/><p>{done}</p><a className="button primary" href={path('login')}>{local(lang,'تسجيل الدخول','Sign in')}</a>{standalone&&displayMode==='register'&&<a className="customer-auth-verify-link" href={path('verify')}>{local(lang,'لم تصلك الرسالة؟ اطلب رابط تأكيد جديدًا','No email yet? Request a new verification link')}</a>}</div>:!emailFormAvailable?<p className="customer-auth-google-note">{local(lang,'سجّل الدخول باستخدام Google. لن نطلب منك كلمة مرور Google داخل الموقع.','Continue securely with Google. We never ask for your Google password.')}</p>:resetUnavailable?<div className="customer-auth-recovery"><p role={error?undefined:'alert'}>{local(lang,'افتح أحدث رابط استعادة من بريدك، أو اطلب رابطًا جديدًا لتغيير كلمة المرور.','Open the latest recovery link from your email, or request a new link to change your password.')}</p><a className="button primary" href={path('forgot')}>{local(lang,'طلب رابط استعادة جديد','Request a new recovery link')}</a></div>:<>
 {showGoogle&&<div className="customer-auth-divider"><span>{local(lang,'أو باستخدام البريد الإلكتروني','or use your email')}</span></div>}
 <form onSubmit={submit} aria-labelledby="customer-login-heading" aria-busy={busyAction==='email'}><fieldset disabled={!configured||busy}>
 {displayMode==='register'&&<label className="field"><span>{local(lang,'الاسم الكامل','Full name')}</span><div className="customer-auth-input"><UserRound size={17} aria-hidden="true"/><input name="name" autoComplete="name" required minLength={2} maxLength={120}/></div></label>}
 {(['login','register','forgot','verify'] as LoginMode[]).includes(displayMode)&&<label className="field"><span>{local(lang,'البريد الإلكتروني','Email address')}</span><div className="customer-auth-input"><Mail size={17} aria-hidden="true"/><input name="email" type="email" dir="ltr" autoComplete="email" autoCapitalize="none" spellCheck={false} required maxLength={200}/></div></label>}
 {(displayMode==='login'||displayMode==='register'||displayMode==='reset')&&<><label className="field"><span>{local(lang,'كلمة المرور','Password')}</span><div className="customer-auth-input"><LockKeyhole size={17} aria-hidden="true"/><input name="password" type={visible?'text':'password'} dir="ltr" autoComplete={displayMode==='login'?'current-password':'new-password'} required minLength={displayMode==='login'&&!standalone?1:12} maxLength={128} aria-describedby={displayMode!=='login'?'customer-password-help':undefined}/><button type="button" onClick={()=>setVisible(value=>!value)} aria-pressed={visible} aria-label={local(lang,visible?'إخفاء كلمة المرور':'إظهار كلمة المرور',visible?'Hide password':'Show password')}>{visible?<EyeOff size={18} aria-hidden="true"/>:<Eye size={18} aria-hidden="true"/>}</button></div></label>{displayMode!=='login'&&<><small id="customer-password-help">{local(lang,'من 12 إلى 128 حرفًا. يمكنك استخدام عبارة طويلة يسهل عليك تذكّرها.','Use 12–128 characters. A long, memorable passphrase is welcome.')}</small><label className="field"><span>{local(lang,'تأكيد كلمة المرور','Confirm password')}</span><div className="customer-auth-input"><LockKeyhole size={17} aria-hidden="true"/><input name="confirmPassword" type={visible?'text':'password'} dir="ltr" autoComplete="new-password" required minLength={12} maxLength={128}/></div></label></>}</>}
 {displayMode==='login'&&<a className="customer-forgot-link" href={path('forgot')}>{local(lang,'نسيت كلمة المرور؟','Forgot password?')}</a>}
 {displayMode==='register'&&<label className="consent"><input name="consent" type="checkbox" required/>{local(lang,'أوافق على','I agree to the')} <a href={root+'/terms'}>{local(lang,'الشروط','terms')}</a> {local(lang,'و','and')} <a href={root+'/privacy'}>{local(lang,'سياسة الخصوصية','privacy policy')}</a>.</label>}
 <button className="button primary customer-auth-submit" type="submit">{busyAction==='email'&&<LoaderCircle size={17} className="spin" aria-hidden="true"/>}{busyAction==='email'?local(lang,'جارٍ المعالجة…','Working…'):displayMode==='register'?local(lang,'إنشاء حساب','Create account'):displayMode==='forgot'?local(lang,'إرسال رابط الاستعادة','Send recovery link'):displayMode==='verify'?local(lang,'إرسال رسالة التأكيد','Send verification email'):displayMode==='confirm'?local(lang,'تأكيد بريدي','Confirm my email'):displayMode==='reset'?local(lang,'حفظ كلمة المرور','Save password'):local(lang,'تسجيل الدخول','Sign in')}</button></fieldset></form></>}
 {configured&&emailFormAvailable&&!done&&<div className="customer-auth-switch">{displayMode==='login'?<>{local(lang,'ليس لديك حساب؟','New to Safe Places?')} <a href={path('register')}>{local(lang,'إنشاء حساب','Create an account')}</a></>:<a href={path('login')}>{local(lang,'العودة لتسجيل الدخول','Back to sign in')}</a>}</div>}
 <a className="customer-login-help" href={root+'/contact'}>{local(lang,'تحتاج مساعدة في الوصول إلى حسابك؟','Need help accessing your account?')}</a>
 </section>
 <p className="customer-login-policy">{local(lang,'بالمتابعة، أنت توافق على','By continuing, you agree to our')} <a href={root+'/terms'}>{local(lang,'الشروط والأحكام','Terms & conditions')}</a> {local(lang,'وتقرّ بالاطلاع على','and acknowledge our')} <a href={root+'/privacy'}>{local(lang,'سياسة الخصوصية','Privacy policy')}</a>.</p>
 </div>;
}
