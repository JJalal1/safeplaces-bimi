import {desc,asc} from 'drizzle-orm';
import {getDb} from '../db';
import * as schema from '../db/schema';
import {getProducts,getSettings} from './data';

// Call only after adminUser() authorisation. Used by the page and the refresh API.
export async function getAdminData() {
  const db=getDb();
  const [products,orders,quotes,contacts,coupons,content,customers,activity]=await Promise.all([
    getProducts(true),db.select().from(schema.orders).orderBy(desc(schema.orders.createdAt)),
    db.select().from(schema.quotes).orderBy(desc(schema.quotes.createdAt)),
    db.select().from(schema.contacts).orderBy(desc(schema.contacts.createdAt)),
    db.select().from(schema.coupons),db.select().from(schema.content).orderBy(asc(schema.content.sortOrder)),
    db.select().from(schema.customers),db.select().from(schema.activity).orderBy(desc(schema.activity.createdAt)).limit(100)
  ]);
  return {products,orders,quotes,contacts,coupons,content,customers,activity,settings:await getSettings(),loadedAt:new Date().toISOString()};
}
export type AdminData=Awaited<ReturnType<typeof getAdminData>>;
