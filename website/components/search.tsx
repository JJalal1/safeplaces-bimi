'use client';
import {useId,useState} from 'react';
import {Search,ArrowLeft,ArrowRight} from 'lucide-react';
import {local,money,type Lang} from '../lib/config';
import {productName,type Product} from '../lib/catalog';
import {matchesProduct} from '../lib/shopping';
import {ProductPhoto} from './visuals';

export function SearchBox({lang,products,categories,query=''}:{lang:Lang;products:Product[];categories:{slug:string;ar:string;en:string}[];query?:string}){
 const [value,setValue]=useState(query),[open,setOpen]=useState(false),[selected,setSelected]=useState(-1),[category,setCategory]=useState('');const id=useId();
 const results=products.filter(p=>(!category||p.category===category)&&matchesProduct(p,value)).slice(0,5);
 return <form className="market-search" action={'/'+lang+'/shop'} onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))setOpen(false);}} onSubmit={e=>{if(open&&selected>=0&&results[selected]){e.preventDefault();window.location.assign('/'+lang+'/shop/'+results[selected].slug);}}}>
  <label className="search-category"><span className="sr-only">{local(lang,'فئة البحث','Search category')}</span><select name="category" value={category} onChange={e=>{setCategory(e.target.value);setSelected(-1);}}><option value="">{local(lang,'كل الأقسام','All categories')}</option>{categories.map(c=><option key={c.slug} value={c.slug}>{local(lang,c.ar,c.en)}</option>)}</select></label>
  <input aria-label={local(lang,'البحث في المنتجات','Search products')} name="q" role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={open?id:undefined} aria-activedescendant={open&&selected>=0?id+'-'+selected:undefined} value={value} onChange={e=>{setValue(e.target.value);setSelected(-1);setOpen(true);}} onFocus={()=>setOpen(true)} onKeyDown={e=>{if(e.key==='Escape')setOpen(false);if(e.key==='ArrowDown'){e.preventDefault();setOpen(true);setSelected(n=>Math.min(results.length-1,n+1));}if(e.key==='ArrowUp'){e.preventDefault();setSelected(n=>Math.max(-1,n-1));}}} placeholder={local(lang,'ابحث عن طفايات، خوذ، معدات السلامة…','Search extinguishers, helmets, safety equipment…')} autoComplete="off" maxLength={100}/>
  <button className="search-submit" type="submit" aria-label={local(lang,'بحث','Search')}><Search size={20}/><span>{local(lang,'بحث','Search')}</span></button>
  {open&&<div className="search-suggestions"><div className="search-suggestions-title">{value?local(lang,'نتائج مقترحة','Suggested results'):local(lang,'اقتراحات للبحث','Explore products')}</div><div id={id} role="listbox" aria-label={local(lang,'نتائج البحث','Search results')}>{results.map((p,i)=><a id={id+'-'+i} role="option" aria-selected={selected===i} className={selected===i?'selected':''} key={p.id} href={'/'+lang+'/shop/'+p.slug}><ProductPhoto product={p} lang={lang}/><span><strong>{productName(p,lang)}</strong><small>{p.price===null?local(lang,'للطلبات الخاصة','For project enquiries'):money(p.price,lang)}{p.previewOnly&&' · '+local(lang,'تجريبي','Demo')}</small></span>{lang==='ar'?<ArrowLeft size={16}/>:<ArrowRight size={16}/>}</a>)}</div>{!results.length&&<p>{local(lang,'لا توجد نتائج. جرّب اسمًا أو فئة أخرى.','No matches. Try another name or category.')}</p>}<button className="all-search-results" type="submit">{local(lang,'عرض جميع النتائج','View all results')}</button></div>}
 </form>;
}
