'use client';
import {useState} from 'react';
import {History, LoaderCircle, RefreshCw} from 'lucide-react';
import {api,errorText} from './store';
import {local,type Lang} from '../lib/config';

type HistoryData={events:{id:string;kind:string;body:string|null;toStatus:string|null;createdAt:string}[];files:{id:string;name:string;url:string}[]};
const statuses:Record<string,[string,string]>={new:['تم الاستلام','Received'],review:['قيد المراجعة','Under review'],information:['بانتظار معلومات','More information needed'],quoted:['صدر عرض السعر','Quotation issued'],accepted:['مقبول','Accepted'],declined:['غير مقبول','Declined'],closed:['مغلق','Closed'],confirmed:['مؤكد','Confirmed'],processing:['قيد التجهيز','Processing'],ready:['جاهز','Ready'],completed:['مكتمل','Completed'],cancelled:['ملغى','Cancelled']};

export function CustomerRequestHistory({type,id,lang}:{type:'orders'|'quotes';id:string;lang:Lang}){
 const [data,setData]=useState<HistoryData|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[opened,setOpened]=useState(false);
 async function load(){if(busy)return;setBusy(true);setError('');try{setData(await api<HistoryData>(`account/requests/${type}/${encodeURIComponent(id)}`));}catch(reason){setError(errorText(reason,lang));}finally{setBusy(false);}}
 return <section className="customer-request-history">
  <button type="button" className="text-link" aria-expanded={opened} onClick={()=>{setOpened(!opened);if(!opened&&!data)void load();}}><History size={17}/>{local(lang,'متابعة الطلب والردود','Request updates and replies')}</button>
  {opened&&<div aria-live="polite">{busy&&<p role="status"><LoaderCircle size={17} className="spin"/>{local(lang,'جارٍ تحميل المتابعة…','Loading updates…')}</p>}{error&&<p className="form-error" role="alert">{error}</p>}
   {data&&<><ol>{data.events.length?data.events.map(event=><li key={event.id}><strong>{event.kind==='reply'?local(lang,'رد فريق المناطق الآمنة','Reply from Safe Places'):event.toStatus&&statuses[event.toStatus]?local(lang,...statuses[event.toStatus]):local(lang,'تحديث الطلب','Request update')}</strong><time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString(lang==='ar'?'ar-SA':'en-GB',{timeZone:'Asia/Riyadh'})}</time>{event.body&&<p>{event.body}</p>}</li>):<li>{local(lang,'لا توجد تحديثات إضافية حتى الآن.','There are no additional updates yet.')}</li>}</ol>{data.files.length>0&&<div className="customer-request-files"><h4>{local(lang,'مرفقات الطلب','Request attachments')}</h4>{data.files.map(file=><a key={file.id} href={file.url} target="_blank" rel="noreferrer">{file.name}</a>)}</div>}</>}
   <button type="button" className="text-link" disabled={busy} onClick={()=>void load()}><RefreshCw size={15}/>{local(lang,'تحديث المتابعة','Refresh updates')}</button>
  </div>}
 </section>;
}
