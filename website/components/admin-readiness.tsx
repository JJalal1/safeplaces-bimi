'use client';

import {useEffect,useState} from 'react';
import {CheckCircle2,Clock3,Cloud,Database,Info,KeyRound,LoaderCircle,Mail,RefreshCw,ShieldCheck} from 'lucide-react';
import {api,errorText} from './store';
import {local,type Lang} from '../lib/config';

type ReadinessCheck={id:string;labelAr:string;labelEn:string;status:'ready'|'pending'|'blocked';detailAr:string;detailEn:string};
type Readiness={checks:ReadinessCheck[];mailEnabled:boolean;attachmentsAvailable:boolean};

export function AdminReadiness({lang,refreshKey}:{lang:Lang;refreshKey:string}){
 const [data,setData]=useState<Readiness|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[loadedAt,setLoadedAt]=useState('');
 async function refresh(){
  setLoading(true);setError('');
  try{setData(await api<Readiness>('admin/readiness'));setLoadedAt(new Date().toISOString());}
  catch(e){setError(errorText(e,lang));}finally{setLoading(false);}
 }
 useEffect(()=>{void refresh();},[refreshKey]);
 const stateLabel=(status:ReadinessCheck['status'])=>status==='ready'?local(lang,'مهيّأ','Configured'):status==='blocked'?local(lang,'يحتاج تفعيلًا','Activation required'):local(lang,'بانتظار الاستكمال','Pending completion');
 function serviceIcon(id:string){return /auth|google|owner|identity/.test(id)?KeyRound:/mail|email|notification/.test(id)?Mail:/storage|attachment|r2|file/.test(id)?Cloud:/db|database|backup/.test(id)?Database:ShieldCheck;}
 return <div className="console-readiness">
  <section className="readiness-intro"><span className="readiness-icon"><ShieldCheck size={27}/></span><div><span className="admin-kicker">SAFE PLACES · {local(lang,'التشغيل','OPERATIONS')}</span><h2>{local(lang,'حالة الخدمات المتصلة بالموقع','Connected service status')}</h2><p>{local(lang,'تابع ما تم إعداده وما يحتاج تفعيلًا قبل استقبال العملاء. كل بند يوضح نطاق الفحص وحدوده.','Review what is configured and what needs activation before serving customers. Each check explains what it covers.')}</p></div><button type="button" className="button light" disabled={loading} onClick={()=>void refresh()}><RefreshCw size={16} className={loading?'spin':''}/>{local(lang,'فحص الحالة','Check status')}</button></section>
  {error&&<p className="form-error" role="alert">{error}</p>}
  {loading&&!data&&<div className="console-empty" role="status"><LoaderCircle size={28} className="spin"/><p>{local(lang,'جارٍ قراءة حالة الخدمات…','Reading service status…')}</p></div>}
  {data&&<>
   <div className="readiness-summary" aria-label={local(lang,'ملخص الإعداد','Configuration summary')}><span><CheckCircle2 size={18}/><strong>{data.checks.filter(check=>check.status==='ready').length}</strong>{local(lang,'بنود مهيّأة','configured checks')}</span><span><Clock3 size={18}/><strong>{data.checks.filter(check=>check.status!=='ready').length}</strong>{local(lang,'بنود تحتاج استكمالًا','checks to complete')}</span>{loadedAt&&<small>{local(lang,'آخر قراءة: ','Last read: ')}{new Date(loadedAt).toLocaleString(lang==='ar'?'ar-SA':'en-GB',{timeZone:'Asia/Riyadh',month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</small>}</div>
   <div className="readiness-grid">{data.checks.map(check=>{const Icon=serviceIcon(check.id);return <article key={check.id} className={'readiness-card readiness-'+check.status}><div className="readiness-card-heading"><span><Icon size={21}/></span><span className={'console-status readiness-status-'+check.status}>{check.status==='ready'?<CheckCircle2 size={13}/>:<Clock3 size={13}/>} {stateLabel(check.status)}</span></div><h3>{local(lang,check.labelAr,check.labelEn)}</h3><p>{local(lang,check.detailAr,check.detailEn)}</p></article>;})}</div>
   <section className="readiness-stage-note"><Info size={21}/><div><h3>{local(lang,'اعتماد التشغيل التجاري خطوة لاحقة','Commercial approval follows preparation')}</h3><p>{local(lang,'تُضاف المنتجات والأسعار والمخزون المعتمدة لاحقًا، ثم تُستكمل ترتيبات الدفع والتوصيل والسياسات قبل فتح البيع. جاهزية الإعدادات هنا لا تعني اعتماد الإطلاق التجاري.','Approved products, prices and stock will be added later, followed by payment, delivery and policy decisions before opening sales. These configuration checks do not constitute commercial launch approval.')}</p></div></section>
  </>}
 </div>;
}
