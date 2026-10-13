import {getDb} from '../db';
import {settings,products,content} from '../db/schema';
import {eq,and,asc} from 'drizzle-orm';
import {initialSettings} from './config';
import {starterProducts,services,type Product} from './catalog';
export async function getSettings(){const rows=await getDb().select().from(settings);const result={...initialSettings} as Record<string,unknown>;for(const row of rows)if(row.key!=='site-owner'){try{result[row.key]=JSON.parse(row.value);}catch{}}return result as typeof initialSettings;}
export async function getProducts(all=false):Promise<Product[]>{const db=getDb();const rows=await (all?db.select().from(products):db.select().from(products).where(eq(products.active,1))).orderBy(asc(products.createdAt));if(rows.length)return rows;const ready=await db.select().from(settings).where(eq(settings.key,'catalog-ready')).limit(1);return ready.length?[]:starterProducts;}
export async function getContent(type:string,all=false){return getDb().select().from(content).where(all?eq(content.type,type):and(eq(content.type,type),eq(content.active,1))).orderBy(asc(content.sortOrder));}
export async function getServices(){const rows=await getContent('service');return services.map(s=>{const row=rows.find(r=>r.slug===s.slug);if(!row)return s;let extra:Record<string,unknown>={};try{extra=JSON.parse(row.extra);}catch{}return {...s,ar:row.titleAr,en:row.titleEn,descAr:row.descriptionAr,descEn:row.descriptionEn,...extra};});}
