'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {LockKeyhole,Mail,Eye,EyeOff,UserRound,CheckCircle2,LoaderCircle,ShieldCheck} from 'lucide-react';
import {local,type Lang} from '../lib/config';
import {customerReturnPath} from '../lib/customer-routes';
import {api,errorText} from './store';
import {authClient} from '../lib/auth-client';

export type LoginMode='login'|'register'|'forgot'|'confirm'|'reset';
export function CustomerLogin({lang,mode='login',configured,previewHref,returnTo,reason='account',tokenHash='',socialProviders=[],standalone=false}:{lang:Lang;mode?:LoginMode;configured:boolean;previewHref?:string;returnTo?:string;reason?:string;tokenHash?:string;socialProviders?:string[];standalone?:boolean}){
 const [visible,setVisible]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(''),[recoveryReady,setRecoveryReady]=useState(false);
 const root='/'+lang,target=customerReturnPath(returnTo,lang);
 const title=mode==='register'?local(lang,'أنشئ حسابك','Create your account'):mode==='forgot'?local(lang,'استعادة كلمة المرور','Reset your password'):mode==='confirm'?local(lang,'تأكيد البريد الإلكتروني','Confirm your email'):mode==='reset'?local(lang,'كلمة مرور جديدة','Choose a new password'):local(lang,'مرحبًا بعودتك','Welcome back');
 const description=mode==='register'?local(lang,'احتفظ بمفضلتك وتابع مشترياتك وطلبات عروض الأسعار في مكان واحد.','Keep your favourites, purchases and project enquiries in one place.'):mode==='forgot'?local(lang,'أدخل بريد حسابك لإرسال رابط الاستعادة.','Enter your account email to request a recovery link.'):mode==='confirm'?local(lang,'أكّد بريدك لتفعيل حسابك في المتجر.','Confirm your email to activate your shop account.'):mode==='reset'?local(lang,'اختر كلمة مرور طويلة تستخدمها لهذا الحساب فقط.','Choose a long password used only for this account.'):reason==='checkout'?local(lang,'سجّل الدخول لإتمام الطلب. منتجات سلتك محفوظة.','Sign in to continue checkout. Your cart is saved.'):reason==='wishlist'?local(lang,'سجّل الدخول لحفظ مفضلتك في حسابك والرجوع إليها من أي جهاز.','Sign in to keep your favourites in your account across devices.'):local(lang,'سجّل الدخول لمتابعة طلباتك وإدارة بياناتك.','Sign in to track your orders and manage your details.');
 useEffect(()=>{if(mode==='login'&&configured){let cancelled=false;api('session').then(result=>{if(!cancelled&&result.user&&(result.user.provider==='supabase'||result.user.provider==='standalone'))window.location.assign(target);}).catch(()=>{});return()=>{cancelled=true;};}},[configured,mode,target]);
 async function social(provider:string){if(!configured||busy)return;setBusy(true);setError('');try{const result=await authClient.signIn.social({provider:provider as 'google',callbackURL:target});if(result.error)throw new Error('AUTH_INVALID');}catch(error){setError(errorText(error,lang));setBusy(false);}}
 async function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(!configured)return;setBusy(true);setError('');
  const form=new FormData(event.currentTarget),password=String(form.get('password')||'');
  try{
   if((mode==='register'||mode==='reset')&&password!==form.get('confirmPassword'))throw new Error('PASSWORD_MISMATCH');
   if(standalone){
    const email=String(form.get('email')||'');
    if(mode==='login'){
     const response=await authClient.signIn.email({email,password,callbackURL:target});
     if(response.error)throw new Error(response.error.code==='EMAIL_NOT_VERIFIED'?'EMAIL_NOT_CONFIRMED':'AUTH_INVALID');
     window.location.assign(target);return;
    }
    if(mode==='register'){
     const response=await authClient.signUp.email({name:String(form.get('name')||''),email,password,callbackURL:target});
     if(response.error)throw new Error('AUTH_INVALID');
    }else if(mode==='forgot'){
     const response=await authClient.requestPasswordReset({email,redirectTo:root+'/account/reset'});
     if(response.error)throw new Error('AUTH_UNAVAILABLE');
    }else if(mode==='reset'){
     const token=new URLSearchParams(window.location.search).get('token')||'';
     if(!token)throw new Error('AUTH_INVALID');
     const response=await authClient.resetPassword({newPassword:password,token});
     if(response.error)throw new Error('AUTH_INVALID');
    }else if(mode==='confirm'){
     throw new Error('AUTH_INVALID');
    }
    setDone(mode==='register'?local(lang,'راجع بريدك الإلكتروني لتأكيد حسابك.','Check your email to verify your account.'):mode==='forgot'?local(lang,'إذا كان البريد مسجلًا ستصلك رسالة استعادة كلمة المرور.','If this email exists, recovery instructions have been sent.'):local(lang,'تم تغيير كلمة المرور، يمكنك تسجيل الدخول.','Password changed. You can sign in.'));
    return;
   }
   if(mode==='reset'&&!recoveryReady){await api('auth/recovery-verify',{token_hash:tokenHash});setRecoveryReady(true);}
   const result=await api('auth/'+(mode==='forgot'?'recover':mode==='reset'?'reset':mode==='confirm'?'confirm':mode),mode==='confirm'?{token_hash:tokenHash}:mode==='reset'?{password}:{email:form.get('email'),password,name:form.get('name')});
   if(mode==='login'||mode==='confirm'){window.location.assign(target);return;}
   setDone(mode==='register'?local(lang,'إذا أمكن إنشاء الحساب، ستصلك رسالة لتأكيد بريدك. افتح الرابط ثم سجل الدخول.','If an account can be created, you will receive an email confirmation. Open it, then sign in.'):mode==='forgot'?local(lang,'إذا كان البريد مرتبطًا بحساب، ستصلك رسالة بخطوات الاستعادة.','If this email has an account, you will receive recovery instructions.'):local(lang,'تم تحديث كلمة المرور. سجل الدخول بكلمة المرور الجديدة.','Your password was updated. Sign in with your new password.'));
   void result;
  }catch(error){setError(errorText(error,lang));}finally{setBusy(false);}
 }
 const path=(next:string)=>root+'/account/'+next+'?return_to='+encodeURIComponent(target);
 return <div className="customer-login-layout"><aside className="customer-login-intro"><span className="eyebrow">SAFE PLACES</span><h2>{local(lang,'حساب واحد.\nتجربة أسهل.','One account.\nAn easier experience.')}</h2><p>{local(lang,'منتجاتك المختارة، طلباتك وبياناتك؛ كل ما تحتاجه لمتابعة احتياجات السلامة.','Your saved products, orders and details, together for your safety needs.')}</p><ul>{[['shield','المفضلة محفوظة مع حسابك','Favourites saved to your account'],['order','متابعة مشترياتك وطلبات المشاريع','Track purchases and project enquiries'],['lock','بيانات حسابك وطلباتك خاصة بك','Your account and orders stay private']].map(([key,ar,en])=><li key={key}><ShieldCheck size={18}/>{local(lang,ar,en)}</li>)}</ul><a href={root+'/shop'}>{local(lang,'العودة للتسوق','Back to shopping')}</a></aside><section className="customer-login-card" aria-labelledby="customer-login-heading"><span className="customer-login-emblem"><LockKeyhole size={23}/></span><h1 id="customer-login-heading">{title}</h1><p>{description}</p>{!configured&&<div className="notice">{local(lang,'التسجيل بالبريد الإلكتروني لم يُفتح بعد. يمكنك مواصلة تصفح المتجر والتواصل مع فريقنا.','Email registration is not open yet. You can continue browsing and contact our team.')}{previewHref&&<a className="text-link" target="_top" href={previewHref}>{local(lang,'معاينة حساب العميل في النسخة الخاصة','Preview the customer account in this private version')}</a>}</div>}
 {configured&&standalone&&(mode==='login'||mode==='register')&&socialProviders.length>0&&<div className="customer-social-login" aria-label={local(lang,'تسجيل الدخول عبر حساب خارجي','Social sign-in')}>{socialProviders.map(provider=><button key={provider} type="button" className={'customer-social-button customer-social-'+provider} disabled={busy} onClick={()=>social(provider)}><span className="customer-social-mark" aria-hidden="true">{provider==='google'?'G':provider==='apple'?'●':provider==='microsoft'?'⊞':'f'}</span>{local(lang,'المتابعة باستخدام ','Continue with ')}{provider==='google'?'Google':provider==='apple'?'Apple':provider==='microsoft'?'Microsoft':'Facebook'}</button>)}<div className="customer-social-separator">{local(lang,'أو عبر البريد الإلكتروني','or with email')}</div></div>}
 {!configured?<div className="customer-auth-closed"><a className="button primary" href={root+"/shop"}>{local(lang,"مواصلة التسوق دون حساب","Continue shopping without an account")}</a><a className="text-link" href={root+"/contact"}>{local(lang,"تواصل مع فريق المبيعات","Contact our sales team")}</a></div>:done?<div className="customer-auth-success" role="status"><CheckCircle2 size={30}/><p>{done}</p><a className="button primary" href={path('login')}>{local(lang,'تسجيل الدخول','Sign in')}</a></div>:standalone?<p className="customer-auth-google-note">{local(lang,'سجّل الدخول باستخدام Google. لن نطلب منك كلمة مرور Google داخل الموقع.','Continue securely with Google. We never ask for your Google password.')}</p>:<form onSubmit={submit}><fieldset disabled={!configured||busy}>
 {mode==='register'&&<label className="field"><span>{local(lang,'الاسم الكامل','Full name')}</span><div className="customer-auth-input"><UserRound size={17}/><input name="name" autoComplete="name" required minLength={2} maxLength={120}/></div></label>}
 {(mode==='login'||mode==='register'||mode==='forgot')&&<label className="field"><span>{local(lang,'البريد الإلكتروني','Email address')}</span><div className="customer-auth-input"><Mail size={17}/><input name="email" type="email" dir="ltr" autoComplete="email" required maxLength={200}/></div></label>}
 {(mode==='login'||mode==='register'||mode==='reset')&&<><label className="field"><span>{local(lang,'كلمة المرور','Password')}</span><div className="customer-auth-input"><LockKeyhole size={17}/><input name="password" type={visible?'text':'password'} dir="ltr" autoComplete={mode==='login'?'current-password':'new-password'} required minLength={mode==='login'?1:12} maxLength={128}/><button type="button" onClick={()=>setVisible(value=>!value)} aria-label={local(lang,visible?'إخفاء كلمة المرور':'إظهار كلمة المرور',visible?'Hide password':'Show password')}>{visible?<EyeOff size={18}/>:<Eye size={18}/>}</button></div></label>{mode!=='login'&&<><small>{local(lang,'12 حرفًا على الأقل، ويُسمح باستخدام عبارة طويلة.','At least 12 characters. Long passphrases are welcome.')}</small><label className="field"><span>{local(lang,'تأكيد كلمة المرور','Confirm password')}</span><input name="confirmPassword" type={visible?'text':'password'} dir="ltr" autoComplete="new-password" required minLength={12} maxLength={128}/></label></>}</>}
 {mode==='login'&&<a className="customer-forgot-link" href={path('forgot')}>{local(lang,'نسيت كلمة المرور؟','Forgot password?')}</a>}
 {mode==='register'&&<label className="consent"><input name="consent" type="checkbox" required/>{local(lang,'أوافق على','I agree to the')} <a href={root+'/terms'}>{local(lang,'الشروط','terms')}</a> {local(lang,'و','and')} <a href={root+'/privacy'}>{local(lang,'سياسة الخصوصية','privacy policy')}</a>.</label>}
 {error&&<p className="form-error" role="alert">{error}</p>}<button className="button primary customer-auth-submit" type="submit">{busy&&<LoaderCircle size={17} className="spin"/>}{mode==='register'?local(lang,'إنشاء حساب','Create account'):mode==='forgot'?local(lang,'إرسال رابط الاستعادة','Send recovery link'):mode==='confirm'?local(lang,'تأكيد بريدي','Confirm my email'):mode==='reset'?local(lang,'حفظ كلمة المرور','Save password'):local(lang,'تسجيل الدخول','Sign in')}</button></fieldset></form>}
 {configured&&!standalone&&<div className="customer-auth-switch">{mode==='login'?<>{local(lang,'ليس لديك حساب؟','New to Safe Places?')} <a href={path('register')}>{local(lang,'إنشاء حساب','Create an account')}</a></>:<a href={path('login')}>{local(lang,'العودة لتسجيل الدخول','Back to sign in')}</a>}</div>}</section></div>;
}
