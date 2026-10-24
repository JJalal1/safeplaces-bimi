import {env} from 'cloudflare:workers';
import {desc,asc} from 'drizzle-orm';
import {getDb} from '../db';
import * as schema from '../db/schema';
import {getProducts,getSettings} from './data';
import {canAdmin,contentPermission,HOMEPAGE_SETTINGS_KEYS} from './admin-permissions';
import type {AdminIdentity} from './access';

/** Only fetch data the verified admin can actually view; never return full data to staff. */
export async function getAdminData(admin:AdminIdentity){
 const db=getDb(),can=(permission:Parameters<typeof canAdmin>[1])=>canAdmin(admin,permission);
 const permittedContentTypes=new Set(['category','brand','service','project','client','certificate','banner'].filter(type=>{
  const permission=contentPermission(type);
  return (!!permission&&can(permission))||(type==='category'&&can('products'));
 }));
 const productQuery=can('products')?getProducts(true):Promise.resolve([] as Awaited<ReturnType<typeof getProducts>>);
 const ordersQuery=can('orders')?db.select().from(schema.orders).orderBy(desc(schema.orders.createdAt)):Promise.resolve([] as (typeof schema.orders.$inferSelect)[]);
 const quotesQuery=can('quotes')?db.select().from(schema.quotes).orderBy(desc(schema.quotes.createdAt)):Promise.resolve([] as (typeof schema.quotes.$inferSelect)[]);
 const contactsQuery=can('contacts')?db.select().from(schema.contacts).orderBy(desc(schema.contacts.createdAt)):Promise.resolve([] as (typeof schema.contacts.$inferSelect)[]);
 const couponsQuery=can('coupons')?db.select().from(schema.coupons):Promise.resolve([] as (typeof schema.coupons.$inferSelect)[]);
 const contentQuery=permittedContentTypes.size?db.select().from(schema.content).orderBy(asc(schema.content.sortOrder)):Promise.resolve([] as (typeof schema.content.$inferSelect)[]);
 const customersQuery=can('customers')?db.select().from(schema.customers):Promise.resolve([] as (typeof schema.customers.$inferSelect)[]);
 const activityQuery=can('activity')?db.select().from(schema.activity).orderBy(desc(schema.activity.createdAt)).limit(100):Promise.resolve([] as (typeof schema.activity.$inferSelect)[]);
 const [products,orders,quotes,contacts,coupons,allContent,customers,activity]=await Promise.all([
  productQuery,ordersQuery,quotesQuery,contactsQuery,couponsQuery,contentQuery,customersQuery,activityQuery
 ]);
 const content=allContent.filter(row=>permittedContentTypes.has(row.type));
 const fullSettings=can('settings');
 const settings=fullSettings?await getSettings():can('homepage')
  ?Object.fromEntries(Object.entries(await getSettings()).filter(([key])=>(HOMEPAGE_SETTINGS_KEYS as readonly string[]).includes(key))) as Awaited<ReturnType<typeof getSettings>>
  :{} as Awaited<ReturnType<typeof getSettings>>;
 return {products,orders,quotes,contacts,coupons,content,customers,activity,settings,capabilities:{attachmentsAvailable:!!env.BUCKET},loadedAt:new Date().toISOString()};
}
export type AdminData=Awaited<ReturnType<typeof getAdminData>>;
