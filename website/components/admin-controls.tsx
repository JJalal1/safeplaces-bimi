'use client';
import {useEffect,useRef} from 'react';
import {ChevronLeft,ChevronRight,Search,X,Download} from 'lucide-react';
import {local,type Lang} from '../lib/config';
import {csvText} from '../lib/admin-utils';

export function SelectRows({ids,selected,setSelected,label}:{ids:string[];selected:string[];setSelected:(ids:string[])=>void;label:string}){
 const ref=useRef<HTMLInputElement>(null);const count=ids.filter(id=>selected.includes(id)).length;
 useEffect(()=>{if(ref.current)ref.current.indeterminate=count>0&&count<ids.length;},[count,ids.length]);
 return <input ref={ref} type="checkbox" aria-label={label} checked={!!ids.length&&count===ids.length} disabled={!ids.length} onChange={event=>setSelected(event.target.checked?[...new Set([...selected,...ids])].slice(0,100):selected.filter(id=>!ids.includes(id)))}/>;
}
export function FilterSearch({value,onChange,lang}:{value:string;onChange:(value:string)=>void;lang:Lang}){
 return <label className="console-table-search"><Search size={17}/><span className="sr-only">{local(lang,'ابحث في القائمة','Search this list')}</span><input value={value} onChange={event=>onChange(event.target.value)} placeholder={local(lang,'بحث بالاسم، المرجع أو البريد…','Search name, reference or email…')}/>{value&&<button type="button" className="icon-button" aria-label={local(lang,'مسح البحث','Clear search')} onClick={()=>onChange('')}><X size={14}/></button>}</label>;
}
export function Pagination({count,page,size,onPage,onSize,lang}:{count:number;page:number;size:number;onPage:(value:number)=>void;onSize:(value:number)=>void;lang:Lang}){
 const pages=Math.max(1,Math.ceil(count/size));
 return <div className="console-pagination"><span>{count?(page-1)*size+1:0}–{Math.min(page*size,count)} {local(lang,'من','of')} {count}</span><label><span>{local(lang,'صفوف','Rows')}</span><select value={size} onChange={event=>onSize(Number(event.target.value))}>{[10,25,50].map(value=><option key={value}>{value}</option>)}</select></label><div><button className="icon-button" disabled={page<=1} onClick={()=>onPage(page-1)} aria-label={local(lang,'الصفحة السابقة','Previous page')}>{lang==='ar'?<ChevronRight size={18}/>:<ChevronLeft size={18}/>}</button><span>{page} / {pages}</span><button className="icon-button" disabled={page>=pages} onClick={()=>onPage(page+1)} aria-label={local(lang,'الصفحة التالية','Next page')}>{lang==='ar'?<ChevronLeft size={18}/>:<ChevronRight size={18}/>}</button></div></div>;
}
export function ExportCSV({headers,rows,name,lang}:{headers:string[];rows:unknown[][];name:string;lang:Lang}){
 function download(){const blob=new Blob([csvText(headers,rows)],{type:'text/csv;charset=utf-8'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download='safeplaces-'+name+'.csv';anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 return <button className="button light" disabled={!rows.length} onClick={download}><Download size={16}/>{local(lang,'تصدير CSV','Export CSV')}</button>;
}
