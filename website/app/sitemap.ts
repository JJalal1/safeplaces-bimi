import type {MetadataRoute} from 'next';
import {getDb} from '../db';
import {content} from '../db/schema';
import {getProducts} from '../lib/data';
import {resolveCategories,resolveServices} from '../lib/content';
import {siteOrigin,siteIndexable} from '../lib/site-origin';
export const dynamic='force-dynamic';
export default async function sitemap():Promise<MetadataRoute.Sitemap>{
 if(!siteIndexable())return [];
 const SITE_URL=siteOrigin();
 const [products,rows]=await Promise.all([getProducts(),getDb().select().from(content)]);
 const paths=['','/about','/services','/shop','/projects','/contact','/quote','/certificates',...resolveCategories(rows).map(c=>'/shop/category/'+c.slug),...resolveServices(rows).map(s=>'/services/'+s.slug),...products.map(p=>'/shop/'+p.slug),...rows.filter(r=>r.type==='project'&&r.active).map(p=>'/projects/'+p.slug)];
 return [...new Set(paths)].flatMap(path=>['ar','en'].map(lang=>({url:SITE_URL+'/'+lang+path,alternates:{languages:{ar:SITE_URL+'/ar'+path,en:SITE_URL+'/en'+path}},changeFrequency:'weekly' as const,priority:path?0.7:1})));
}
