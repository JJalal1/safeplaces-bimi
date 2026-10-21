'use client';
import {useEffect,useState} from 'react';
import {UserRound,Mail,Phone,CheckCircle2,ChevronDown} from 'lucide-react';
import {useStore,api} from './store';
import {local} from '../lib/config';

type Details={name:string;email:string;phone:string;company:string;city:string};
const empty:Details={name:'',email:'',phone:'',company:'',city:''};

/** Account-scoped defaults never replace fields the customer has edited. */
export function CustomerContactFields({company=false,city=false,requirePhone=false}:{company?:boolean;city?:boolean;requirePhone?:boolean}){
 const {lang,user,authReady}=useStore();
 const identity=user?.userId||'guest';
 const [saved,setSaved]=useState<{identity:string;details:Partial<Details>}|null>(null);
 const [draft,setDraft]=useState<{identity:string;details:Partial<Details>}|null>(null);
 const [editing,setEditing]=useState(false);
 useEffect(()=>{
  let active=true;
  setEditing(false);
  if(user)api<Partial<Details>>('profile').then(details=>{if(active)setSaved({identity,details});}).catch(()=>{});
  return()=>{active=false;};
 },[identity]);
 const details:Details={...empty,...(user?{name:user.fullName||user.displayName||'',email:user.email}:{}),...(saved?.identity===identity?saved.details:{}),...(draft?.identity===identity?draft.details:{})};
 // The verified account email remains the default even if an old contact row differs.
 if(user)details.email=user.email;
 const collapsed=!!user&&!editing&&details.name.trim().length>=2&&!!details.email;
 const change=(name:keyof Details,value:string)=>setDraft(previous=>({identity,details:{...(previous?.identity===identity?previous.details:{}),[name]:value}}));
 const field=(name:keyof Details,label:string,type='text',required=false)=><label className="field" key={name}><span>{label}{required&&<b aria-hidden="true"> *</b>}{name==='phone'&&user&&<small className="field-optional">{local(lang,'اختياري','Optional')}</small>}</span><input name={name} type={type} value={details[name]||''} onChange={event=>change(name,event.target.value)} required={required} readOnly={name==='email'&&!!user} maxLength={name==='email'?200:name==='phone'?24:120} autoComplete={name==='name'?'name':name==='email'?'email':name==='phone'?'tel':name==='company'?'organization':'address-level2'} dir={name==='email'||name==='phone'?'ltr':undefined}/></label>;
 return <section className="customer-contact" aria-label={local(lang,'بيانات التواصل','Contact details')}>
  {!authReady&&<p className="contact-loading" role="status">{local(lang,'جارٍ تجهيز بيانات التواصل…','Preparing your contact details…')}</p>}
  {authReady&&user&&<div className="saved-contact-summary"><div className="saved-contact-heading"><span><CheckCircle2 size={18}/>{local(lang,'بياناتك جاهزة','Your details are ready')}</span><button type="button" className="text-link" aria-expanded={!collapsed} onClick={()=>setEditing(value=>!value)}>{collapsed?local(lang,'تعديل البيانات','Edit details'):local(lang,'إخفاء البيانات','Hide details')}<ChevronDown size={15}/></button></div><div className="saved-contact-details"><span><UserRound size={16}/>{details.name}</span><span><Mail size={16}/><bdi dir="ltr">{details.email}</bdi></span>{details.phone&&<span><Phone size={16}/><bdi dir="ltr">{details.phone}</bdi></span>}{details.company&&<span>{details.company}</span>}</div><p>{local(lang,'سنستخدم هذه البيانات لمتابعة طلبك. لا حاجة إلى كتابتها مجددًا.','We will use these details to follow up. You do not need to enter them again.')}</p></div>}
  <fieldset disabled={!authReady} hidden={collapsed} className="contact-fields"><div className="form-grid">{field('name',local(lang,'الاسم','Full name'),'text',true)}{field('email',local(lang,'البريد الإلكتروني','Email'),'email',true)}{field('phone',local(lang,'رقم الهاتف','Phone'),'tel',requirePhone&&!user)}{company&&field('company',local(lang,'اسم الشركة','Company'))}{city&&field('city',local(lang,'المدينة','City'))}</div></fieldset>
 </section>;
}
