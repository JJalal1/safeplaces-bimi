'use client';
import {useState,type FormEvent} from 'react';
import {Plus,X,ImagePlus,FileText,Save,ExternalLink,CheckCircle2,Package,Image,Link,SlidersHorizontal} from 'lucide-react';
import {errorText} from './store';
import {Field} from './forms';
import {local,type Lang} from '../lib/config';
import {productReady} from '../lib/admin-utils';

async function upload(file:File){
 const form=new FormData();form.append('file',file);form.append('token',crypto.randomUUID());form.append('purpose','admin');form.append('public','true');
 const response=await fetch('/api/uploads',{method:'POST',body:form});const result=await response.json() as {url:string;error?:string};
 if(!response.ok)throw new Error(result.error);return result.url;
}
export function ProductEditor({row,all,categories,brands,lang,busy,save}:{row:any;all:any[];categories:{slug:string;ar:string;en:string}[];brands:string[];lang:Lang;busy:boolean;save:(r:any)=>void}){
 const [kind,setKind]=useState(row?.kind||'direct');
 const [active,setActive]=useState(row?!!row.active:false);
 const [price,setPrice]=useState(row?.price==null?'':String(row.price/100));
 const [image,setImage]=useState(row?.image||'');
 const [gallery,setGallery]=useState<string[]>(JSON.parse(row?.gallery||'[]'));
 const [datasheet,setDatasheet]=useState(row?.datasheet||'');
 const [specs,setSpecs]=useState<{ar:string;en:string;value:string}[]>(JSON.parse(row?.specs||'[]'));
 const [related,setRelated]=useState<string[]>(JSON.parse(row?.related||'[]'));
 const [relatedSearch,setRelatedSearch]=useState('');
 const [uploading,setUploading]=useState(false);const [error,setError]=useState('');
 const ready=productReady({kind,price:price?Math.round(Number(price)*100):null});
 async function media(list:FileList|null,target:'image'|'gallery'|'datasheet'){
  if(!list||busy||uploading)return;setUploading(true);setError('');
  try{if(target==='gallery'&&gallery.length+list.length>20)throw new Error('GALLERY_LIMIT');
   for(const file of Array.from(list)){const url=await upload(file);if(target==='image')setImage(url);else if(target==='datasheet')setDatasheet(url);else setGallery(images=>[...images,url]);}
  }catch(e){setError(errorText(e,lang));}finally{setUploading(false);}
 }
 function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();if(busy||uploading)return;setError('');
  const form=new FormData(event.currentTarget);
  const submitter=(event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement|null;
  const published=submitter?.value==='draft'?false:active;
  if(published&&!ready){setError(errorText(new Error('PRICE_REQUIRED'),lang));return;}
  save({id:row?.id,slug:form.get('slug'),nameAr:form.get('nameAr'),nameEn:form.get('nameEn'),descriptionAr:form.get('descriptionAr'),descriptionEn:form.get('descriptionEn'),category:form.get('category'),kind,
   price:kind==='quote'||!price?null:Math.round(Number(price)*100),oldPrice:form.get('oldPrice')?Math.round(Number(form.get('oldPrice'))*100):null,
   sku:String(form.get('sku')||'')||null,brand:String(form.get('brand')||'')||null,image:image||null,datasheet:datasheet||null,
   gallery:JSON.stringify(gallery),specs:JSON.stringify(specs.filter(spec=>spec.ar||spec.en||spec.value)),related:JSON.stringify(related),keywords:String(form.get('keywords')||''),active:published?1:0,featured:form.has('featured')?1:0});
 }
 const headings=[['information','بيانات المنتج','Product information'],['media','الصور والملفات','Images & documents'],['specifications','المواصفات','Specifications'],['related','المنتجات المقترحة','Related products']];
 return <form onSubmit={submit} className="product-management-form">
  <div className="product-editor-jump">{headings.map(([id,ar,en])=><a key={id} href={'#editor-'+id}>{local(lang,ar,en)}</a>)}</div>
  <div className="product-editor-layout"><div className="product-editor-content">
   <section className="management-card" id="editor-information"><h3><Package size={18}/>{local(lang,'بيانات المنتج','Product information')}</h3><p>{local(lang,'أضف وصفًا واضحًا في اللغتين ليظهر للعميل وفي محركات البحث.','Use clear bilingual names and descriptions for customers and search engines.')}</p>
    <div className="form-grid"><Field name="nameAr" label="اسم المنتج بالعربية" value={row?.nameAr||''} required/><Field name="nameEn" label="Product name in English" value={row?.nameEn||''} required/>
    <Field name="descriptionAr" label="الوصف بالعربية" type="textarea" value={row?.descriptionAr||''} wide/><Field name="descriptionEn" label="Description in English" type="textarea" value={row?.descriptionEn||''} wide/></div>
   </section>
   <section className="management-card" id="editor-media"><h3><Image size={18}/>{local(lang,'صور المنتج والملفات','Product images & documents')}</h3><p>{local(lang,'ارفع صور المنتج المعتمد. JPEG، PNG، WebP أو PDF، حتى 10 MB لكل ملف.','Upload approved product images. JPEG, PNG, WebP or PDF, up to 10 MB per file.')}</p>
    <div className="product-editor-media"><label className="main-image-upload">{image?<img src={image} alt={local(lang,'الصورة الرئيسية','Main image')} width={210} height={180}/>:<ImagePlus size={35}/>}<strong>{image?local(lang,'تغيير الصورة الرئيسية','Replace main image'):local(lang,'رفع الصورة الرئيسية','Upload main image')}</strong><input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy||uploading} onChange={e=>media(e.target.files,'image')}/></label>
    <div><label className="upload-zone"><ImagePlus size={20}/>{local(lang,'إضافة صور للمعرض','Add gallery images')}<input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy||uploading} onChange={e=>media(e.target.files,'gallery')}/></label>
     <div className="gallery-thumbnails">{gallery.map(url=><div key={url}><img src={url} alt={local(lang,'صورة إضافية','Gallery image')} width={80} height={80}/><button type="button" aria-label={local(lang,'إزالة الصورة','Remove image')} onClick={()=>setGallery(images=>images.filter(value=>value!==url))}><X size={14}/></button></div>)}</div>
     {image&&<button className="text-link subtle-button" type="button" onClick={()=>setImage('')}>{local(lang,'إزالة الصورة الرئيسية','Remove main image')}</button>}
    </div></div>
    <label className="upload-zone"><FileText size={20}/>{local(lang,'ورقة البيانات PDF','PDF datasheet')}<input type="file" accept=".pdf" disabled={busy||uploading} onChange={e=>media(e.target.files,'datasheet')}/></label>
    {datasheet&&<div className="document-link"><a href={datasheet} target="_blank" rel="noreferrer"><FileText size={16}/>{local(lang,'عرض ورقة البيانات','View datasheet')}</a><button className="icon-button" type="button" onClick={()=>setDatasheet('')} aria-label={local(lang,'إزالة الملف','Remove file')}><X size={15}/></button></div>}
   </section>
   <section className="management-card" id="editor-specifications"><h3><SlidersHorizontal size={18}/>{local(lang,'المواصفات الفنية','Technical specifications')}</h3><p>{local(lang,'مثل المقاس، الوزن، المادة أو نوع الاستخدام. اكتب البيانات المعتمدة فقط.','Add approved size, weight, material or application details.')}</p>
    {specs.map((spec,i)=><div className="spec-editor-row" key={i}>{[['ar','الخاصية بالعربية'],['en','Property in English'],['value',local(lang,'القيمة','Value')]].map(([key,label])=><input key={key} aria-label={label} placeholder={label} maxLength={key==='value'?1000:120} value={spec[key as keyof typeof spec]} onChange={e=>setSpecs(rows=>rows.map((value,j)=>j===i?{...value,[key]:e.target.value}:value))}/>)}<button type="button" className="icon-button" aria-label={local(lang,'حذف المواصفة','Remove specification')} onClick={()=>setSpecs(rows=>rows.filter((_,j)=>j!==i))}><X size={16}/></button></div>)}
    <button type="button" className="button light small-button" disabled={specs.length>=50} onClick={()=>setSpecs(rows=>[...rows,{ar:'',en:'',value:''}])}><Plus size={15}/>{local(lang,'إضافة مواصفة','Add specification')}</button>
   </section>
   <section className="management-card" id="editor-related"><h3><Link size={18}/>{local(lang,'اقتراحات المنتجات','Product recommendations')}</h3><p>{local(lang,'المنتجات التي تختارها هنا تظهر أولًا ضمن المنتجات المشابهة. حتى 20 منتجًا.','Your selections appear first in related products. Select up to 20 products.')}</p>
    <label className="field"><span>{local(lang,'ابحث عن منتج لربطه','Find a related product')}</span><input value={relatedSearch} onChange={e=>setRelatedSearch(e.target.value)} placeholder={local(lang,'اسم المنتج أو SKU','Product name or SKU')}/></label>
    <div className="related-checks">{all.filter(product=>product.id!==row?.id&&[product.nameAr,product.nameEn,product.sku].join(' ').toLowerCase().includes(relatedSearch.toLowerCase())).map(product=><label key={product.id}><input type="checkbox" checked={related.includes(product.id)} disabled={!related.includes(product.id)&&related.length>=20} onChange={e=>setRelated(ids=>e.target.checked?[...ids,product.id]:ids.filter(id=>id!==product.id))}/>{local(lang,product.nameAr,product.nameEn)}</label>)}</div>
   </section>
  </div><aside className="product-editor-sidebar">
   <section className="management-card publication-card"><h3>{local(lang,'حالة النشر','Publishing')}</h3><label className="field"><span>{local(lang,'ظهور المنتج','Product visibility')}</span><select value={active?'published':'draft'} onChange={e=>setActive(e.target.value==='published')}><option value="draft">{local(lang,'مسودة / مخفي','Draft / hidden')}</option><option value="published">{local(lang,'منشور في المتجر','Published in shop')}</option></select></label>
    <label className="consent"><input type="checkbox" name="featured" defaultChecked={!!row?.featured}/>{local(lang,'إبرازه في الصفحة الرئيسية','Feature on homepage')}</label>
    <div className={'publication-hint '+(ready?'ready':'')}><CheckCircle2 size={16}/>{ready?local(lang,'طريقة البيع والسعر جاهزان للحفظ.','Sale mode and price are ready to save.'):local(lang,'أضف سعرًا معتمدًا قبل النشر للبيع المباشر. يمكنك حفظ مسودة الآن.','Add an approved price before publishing for direct purchase. You can save a draft now.')}</div>
    {row?.active&&<a className="text-link" target="_blank" rel="noreferrer" href={'/'+lang+'/shop/'+row.slug}>{local(lang,'عرض المنتج في الموقع','View product on site')}<ExternalLink size={15}/></a>}
   </section>
   <section className="management-card"><h3>{local(lang,'التصنيف والتسعير','Organisation & pricing')}</h3><label className="field"><span>{local(lang,'القسم','Category')}</span><select name="category" defaultValue={row?.category||categories[0]?.slug} required>{categories.map(category=><option key={category.slug} value={category.slug}>{local(lang,category.ar,category.en)}</option>)}</select></label>
    <Field name="sku" label="SKU" value={row?.sku||''}/><label className="field"><span>{local(lang,'العلامة التجارية','Brand')}</span><input name="brand" defaultValue={row?.brand||''} list="admin-brand-list" maxLength={100}/><datalist id="admin-brand-list">{brands.map(brand=><option key={brand} value={brand}/>)}</datalist></label>
    <label className="field"><span>{local(lang,'طريقة البيع','Sale mode')}</span><select value={kind} onChange={e=>setKind(e.target.value)}><option value="direct">{local(lang,'شراء مباشر','Direct purchase')}</option><option value="both">{local(lang,'شراء وتسعير للكميات','Purchase & bulk quote')}</option><option value="quote">{local(lang,'عرض سعر للمشاريع','Project quote only')}</option></select></label>
    {kind!=='quote'&&<><label className="field"><span>{local(lang,'السعر المعتمد بالريال','Approved price in SAR')}</span><input name="price" dir="ltr" type="number" min="0.01" step="0.01" value={price} onChange={e=>setPrice(e.target.value)} placeholder="0.00"/></label><Field name="oldPrice" label={local(lang,'السعر السابق إن وجد','Previous price, if applicable')} type="number" value={row?.oldPrice==null?'':String(row.oldPrice/100)}/></>}
   </section>
   <section className="management-card"><h3>{local(lang,'الرابط والبحث','URL & search')}</h3><Field name="slug" label={local(lang,'رابط المنتج بالإنجليزية','Product URL slug')} value={row?.slug||''} required placeholder="product-name"/><small>{local(lang,'أحرف إنجليزية صغيرة وأرقام وشرطة - فقط.','Use lowercase English letters, numbers and hyphens.')}</small><Field name="keywords" label={local(lang,'كلمات البحث الإضافية','Additional search keywords')} value={row?.keywords||''}/></section>
  </aside></div>
  <div className="editor-savebar">{error&&<p className="form-error" role="alert">{error}</p>}<span>{uploading?local(lang,'جارٍ رفع الملفات…','Uploading files…'):local(lang,'تُحفظ التغييرات عند الضغط على الحفظ.','Changes are applied when you save.')}</span><button type="submit" name="intent" value="draft" className="button light" disabled={busy||uploading}>{local(lang,'حفظ كمسودة','Save as draft')}</button><button type="submit" className="button primary" disabled={busy||uploading}><Save size={17}/>{busy?local(lang,'جارٍ الحفظ…','Saving…'):active?local(lang,'حفظ ونشر','Save & publish'):local(lang,'حفظ المنتج','Save product')}</button></div>
 </form>;
}
