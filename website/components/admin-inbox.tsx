'use client';

import {useEffect,useState} from 'react';
import {ArrowUpRight,FileText,Inbox,MessageSquare,Search,ShoppingBag,X} from 'lucide-react';
import {local,type Lang} from '../lib/config';
import type {AdminData} from '../lib/admin-data';
import type {AdminPermission} from '../lib/admin-permissions';
import {statusLabel} from './forms';
import {Pagination} from './admin-controls';

type RequestKind='orders'|'quotes'|'contacts';
const channels=[{key:'quotes',ar:'عروض الأسعار',en:'Quotes',Icon:FileText},{key:'contacts',ar:'رسائل التواصل',en:'Messages',Icon:MessageSquare},{key:'orders',ar:'طلبات الشراء',en:'Orders',Icon:ShoppingBag}] as const;
function isOpen(type:RequestKind,status:string){return !(type==='orders'?['completed','cancelled']:type==='quotes'?['closed','declined']:['closed']).includes(status);}

export function AdminInbox({data,lang,permissions,edit,compact=false,initialQuery='',onOpenAll}:{data:AdminData;lang:Lang;permissions:readonly AdminPermission[];edit:(type:string,row:any)=>void;compact?:boolean;initialQuery?:string;onOpenAll?:()=>void}){
 const [query,setQuery]=useState(initialQuery),[channel,setChannel]=useState(''),[state,setState]=useState('open'),[page,setPage]=useState(1),[size,setSize]=useState(10);
 useEffect(()=>{setQuery(initialQuery);setPage(1);},[initialQuery]);
 useEffect(()=>{setPage(1);},[query,channel,state,size]);
 const available=channels.filter(item=>permissions.includes(item.key as AdminPermission));
 const all=available.flatMap(item=>(data[item.key] as any[]).map(row=>({type:item.key,row,Icon:item.Icon,label:local(lang,item.ar,item.en)}))).sort((a,b)=>String(b.row.createdAt).localeCompare(String(a.row.createdAt)));
 const matches=all.filter(item=>(!channel||item.type===channel)&&(state==='all'||state==='new'?state==='all'||item.row.status==='new':isOpen(item.type,item.row.status))&&(!query.trim()||[item.row.number,item.row.name,item.row.email,item.row.phone,item.row.company,item.row.message,item.row.description].some(value=>String(value||'').toLowerCase().includes(query.trim().toLowerCase()))));
 const currentPage=Math.min(page,Math.max(1,Math.ceil(matches.length/size))),shown=compact?matches.slice(0,6):matches.slice((currentPage-1)*size,currentPage*size);
 const date=(value:string)=>new Date(value).toLocaleDateString(lang==='ar'?'ar-SA':'en-GB',{timeZone:'Asia/Riyadh',month:'short',day:'numeric'});
 return <section className={'console-inbox '+(compact?'console-panel compact-inbox':'console-records-panel')}>
  <div className="console-panel-heading"><div><h3><Inbox size={18}/>{local(lang,'صندوق المتابعة','Follow-up inbox')}</h3><p>{local(lang,'طلبات العملاء ورسائلهم حسب الأقسام المصرّح لك بها.','Customer requests and messages from the sections you can access.')}</p></div>{compact&&onOpenAll&&<button className="text-link subtle-button" onClick={onOpenAll}>{local(lang,'عرض الكل','View all')}<ArrowUpRight size={15}/></button>}</div>
  <div className="console-record-tabs" aria-label={local(lang,'تصفية المتابعة','Filter follow-up')}>{[['open','مفتوحة للمتابعة','Open'],['new','جديدة','New'],['all','الكل','All']].map(([key,ar,en])=><button key={key} className={state===key?'active':''} aria-pressed={state===key} onClick={()=>setState(key)}>{local(lang,ar,en)}<span>{all.filter(item=>key==='all'||(key==='new'?item.row.status==='new':isOpen(item.type,item.row.status))).length}</span></button>)}</div>
  {!compact&&<div className="console-filterbar"><label className="console-table-search"><Search size={17}/><span className="sr-only">{local(lang,'البحث في طلبات العملاء ورسائلهم','Search customer requests and messages')}</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={local(lang,'بحث بالمرجع، الاسم أو البريد…','Search reference, name or email…')}/>{query&&<button type="button" className="icon-button" aria-label={local(lang,'مسح البحث','Clear search')} onClick={()=>setQuery('')}><X size={15}/></button>}</label><label className="inbox-channel"><span className="sr-only">{local(lang,'نوع الطلب','Request type')}</span><select value={channel} onChange={event=>setChannel(event.target.value)}><option value="">{local(lang,'كل الأنواع','All types')}</option>{available.map(item=><option key={item.key} value={item.key}>{local(lang,item.ar,item.en)}</option>)}</select></label></div>}
  {shown.length?<div className="inbox-list">{shown.map(({row,type,Icon,label})=><button key={type+'-'+row.id} className={'inbox-record '+(row.status==='new'?'is-new':'')} onClick={()=>edit(type,row)}><span className={'inbox-record-icon inbox-'+type}><Icon size={19}/></span><span className="inbox-record-content"><span className="inbox-record-heading"><strong>{row.name}</strong><span className={'console-status status-'+row.status}>{statusLabel(row.status,lang)}</span></span><span className="inbox-record-reference">{label}{row.number&&<> · <bdi>{row.number}</bdi></>}</span><span className="inbox-record-preview">{row.description||row.message||row.company||row.email}</span></span><span className="inbox-record-end"><time dateTime={row.createdAt}>{date(row.createdAt)}</time><ArrowUpRight size={16}/></span></button>)}</div>:<div className="console-empty"><Inbox size={32}/><strong>{query||channel?local(lang,'لا توجد نتائج مطابقة','No matching requests'):state==='all'?local(lang,'لم تصل طلبات أو رسائل بعد','No requests or messages yet'):local(lang,'لا توجد طلبات ضمن هذه التصفية','No requests in this view')}</strong><p>{query||channel?local(lang,'جرّب اسمًا أو مرجعًا آخر، أو أعد ضبط التصفية.','Try another name or reference, or reset the filters.'):local(lang,'ستظهر هنا الطلبات والرسائل الفعلية عند استقبالها.','Actual requests and messages will appear here when received.')}</p></div>}
  {!compact&&<Pagination count={matches.length} page={currentPage} size={size} onPage={setPage} onSize={setSize} lang={lang}/>}
 </section>;
}
