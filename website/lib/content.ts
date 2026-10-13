import {categories,services,clients} from './catalog';
import type {content} from '../db/schema';
export type ContentRow=typeof content.$inferSelect;
export function resolveCategories(rows:ContentRow[]){
 const records=rows.filter(r=>r.type==='category');
 if(!records.length)return categories.map(c=>({...c,image:null as string|null}));
 return records.filter(r=>r.active).map(r=>{const base=categories.find(c=>c.slug===r.slug);return {slug:r.slug,ar:r.titleAr,en:r.titleEn,icon:base?.icon||'shield',noteAr:r.descriptionAr,noteEn:r.descriptionEn,image:r.image};});
}
export function resolveServices(rows:ContentRow[]){
 const records=rows.filter(r=>r.type==='service');
 if(!records.length)return services;
 return records.filter(r=>r.active).map(r=>{
  const base=services.find(s=>s.slug===r.slug);let extra:Record<string,unknown>={};try{extra=JSON.parse(r.extra);}catch{}
  const list=(value:unknown,fallback:string[])=>Array.isArray(value)?value.filter((v):v is string=>typeof v==='string'):fallback;
  return {slug:r.slug,ar:r.titleAr,en:r.titleEn,descAr:r.descriptionAr,descEn:r.descriptionEn,icon:base?.icon||'shield',category:typeof extra.category==='string'?extra.category:base?.category||'firefighting',scopeAr:list(extra.scopeAr,base?.scopeAr||[]),scopeEn:list(extra.scopeEn,base?.scopeEn||[]),image:r.image};
 });
}
export function resolveClients(rows:ContentRow[]){
 const records=rows.filter(r=>r.type==='client');
 return records.length?records.filter(r=>r.active):clients.map((name,i)=>({id:String(i),titleAr:name,titleEn:name,image:null}));
}
export const initialContent=[
 ...categories.map((c,i)=>({id:'category-'+c.slug,type:'category',slug:c.slug,titleAr:c.ar,titleEn:c.en,descriptionAr:c.noteAr,descriptionEn:c.noteEn,extra:'{}',active:1,sortOrder:i})),
 ...services.map((s,i)=>({id:'service-'+s.slug,type:'service',slug:s.slug,titleAr:s.ar,titleEn:s.en,descriptionAr:s.descAr,descriptionEn:s.descEn,extra:JSON.stringify({scopeAr:s.scopeAr,scopeEn:s.scopeEn,category:s.category}),active:1,sortOrder:i})),
 ...clients.map((name,i)=>({id:'client-'+i,type:'client',slug:['panda','snb','sab','medad'][i],titleAr:name,titleEn:name,descriptionAr:'',descriptionEn:'',extra:'{}',active:1,sortOrder:i}))
];
