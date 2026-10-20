import {env} from 'cloudflare:workers';
import {getDb} from '../../../db';
import * as schema from '../../../db/schema';
import {eq,desc,and,inArray} from 'drizzle-orm';
import {getChatGPTUser} from '../../chatgpt-auth';
import {adminUser,canBootstrap,type AdminIdentity} from '../../../lib/access';
import {adminMembers} from '../../../db/admin-schema';
import {authSession} from '../../../db/auth-schema';
import {handleAdminOperations,customerRequestDetail,requestRecord} from '../../../lib/admin-operations';
import {requestCreatedStatements,eventStatement} from '../../../lib/notifications';
import {OperationError,MAX_UPLOAD_BYTES,type OperationsBindings} from '../../../lib/operations-types';
import {limitedBody,verifiedFileMime} from '../../../lib/upload-policy';
import {canAdmin,canAdminContent,ADMIN_PERMISSIONS,HOMEPAGE_SETTINGS_KEYS,parseAdminPermissions} from '../../../lib/admin-permissions';
import {getProducts,getSettings} from '../../../lib/data';
import {starterProducts,services} from '../../../lib/catalog';
import {SITE_URL} from '../../../lib/config';
import {initialContent} from '../../../lib/content';
import {totals,discountFor,type PricedLine} from '../../../lib/commerce';
import {getAdminData} from '../../../lib/admin-data';
import {productReady} from '../../../lib/admin-utils';
import {z} from 'zod';
import {customerUser,customerAuthConfig} from '../../../lib/customer-session';
import {getStandaloneAuth} from '../../../lib/better-auth-server';
import {enabledProviders,authBindings,emailPasswordEnabled} from '../../../lib/auth-settings';
import {CustomerAuth,CustomerAuthError,cookieValue,authCookie,clearAuthCookies,accessCookie,refreshCookie,recoveryCookie} from '../../../lib/customer-auth';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200,cookies:string[]=[])=>{const response=Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});for(const cookie of cookies)response.headers.append('Set-Cookie',cookie);return response;};
const now=()=>new Date().toISOString();
const id=()=>crypto.randomUUID();
const person=z.object({name:z.string().trim().min(2).max(120),email:z.string().trim().email().max(200),phone:z.string().trim().regex(/^[+()\d\s-]{8,24}$/),company:z.string().trim().max(200).optional().default('')});
const line=z.object({id:z.string().max(100),quantity:z.number().int().min(1).max(999)});
class HttpError extends OperationError{}
async function body(req:Request){return JSON.parse(new TextDecoder().decode(await limitedBody(req,120000)));}
function safeOrigin(req:Request){if(req.headers.get('origin')!==new URL(req.url).origin)throw new HttpError('INVALID_ORIGIN',403);}
async function rate(req:Request,kind:string,limit=12){const source=(req.headers.get('cf-connecting-ip')||'private')+kind;const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(source));const hash=Array.from(new Uint8Array(digest)).map(v=>v.toString(16).padStart(2,'0')).join('');const bucket=Math.floor(Date.now()/3600000);const row=await env.DB!.prepare('INSERT INTO rate_limits (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1 RETURNING count').bind(hash+':'+bucket,(bucket+1)*3600000).first<{count:number}>();if((row?.count||0)>limit)throw new HttpError('RATE_LIMIT',429);}
async function audit(userId:string,action:string,entityId?:string){await getDb().insert(schema.activity).values({id:id(),userId,action,entityId:entityId||null,createdAt:now()});}

async function canReadAdminFile(admin:AdminIdentity|null,file:{ownerId:string;parentId:string|null}):Promise<boolean>{
 if(!admin)return false;
 if(admin.role==='owner'||file.ownerId===admin.userId)return true;
 if(!file.parentId)return false;
 const db=getDb();
 if(canAdmin(admin,'orders')&&(await db.select({id:schema.orders.id}).from(schema.orders).where(eq(schema.orders.id,file.parentId)).limit(1)).length)return true;
 if(canAdmin(admin,'quotes')&&(await db.select({id:schema.quotes.id}).from(schema.quotes).where(eq(schema.quotes.id,file.parentId)).limit(1)).length)return true;
 return false;
}
async function priceOrder(lines:{id:string;quantity:number}[],code:string){const all=await getProducts();const items:PricedLine[]=lines.map(l=>{const p=all.find(p=>p.id===l.id&&p.active);if(!p||p.kind==='quote'||p.price===null||p.price<1)throw new HttpError('PRODUCT_UNAVAILABLE');return {id:p.id,nameAr:p.nameAr,nameEn:p.nameEn,slug:p.slug,category:p.category,price:p.price,quantity:l.quantity};});const config=await getSettings();let coupon:null|typeof schema.coupons.$inferSelect=null;let discount=0;if(code){coupon=(await getDb().select().from(schema.coupons).where(eq(schema.coupons.code,code.toUpperCase())).limit(1))[0]||null;const date=now();if(!coupon||!coupon.active||(coupon.startsAt&&coupon.startsAt>date)||(coupon.endsAt&&coupon.endsAt<date)||(coupon.usageLimit!==null&&coupon.used>=coupon.usageLimit))throw new HttpError('INVALID_COUPON');discount=discountFor(coupon,items);}return {items,...totals(items,Number(config.vatRate),!!config.pricesIncludeVat,discount),coupon};}
async function handle(req:Request){
 const path=new URL(req.url).pathname.replace(/^\/api\//,'');const db=getDb();const bindings=env as unknown as OperationsBindings;
 if(req.method!=='GET')safeOrigin(req);
 const standalone=getStandaloneAuth();
 const auth=standalone?null:customerAuthConfig(),provider=auth?new CustomerAuth(auth):null;
 if(req.method==='GET'&&path==='session'){
  let user=await customerUser();const cookies:string[]=[];
  const refresh=standalone?'':cookieValue(req.headers.get('cookie'),refreshCookie);
  if(provider&&!user&&refresh){try{const session=await provider.refresh(refresh);user=await provider.user(session.access_token);cookies.push(authCookie(accessCookie,session.access_token),authCookie(refreshCookie,session.refresh_token));}catch(error){if(error instanceof CustomerAuthError&&error.code==='AUTH_INVALID')cookies.push(...clearAuthCookies());else throw error;}}
  const customerOnly=new URL(req.url).searchParams.get('scope')==='customer';
  if(customerOnly)return json({user,authConfigured:!!provider||!!standalone,emailPasswordEnabled:!!standalone&&emailPasswordEnabled(authBindings()),socialProviders:standalone?enabledProviders(authBindings()):[]},200,cookies);
  const admin=await adminUser();return json({user,admin:!!admin,bootstrap:await canBootstrap(),authConfigured:!!provider||!!standalone,emailPasswordEnabled:!!standalone&&emailPasswordEnabled(authBindings()),socialProviders:standalone?enabledProviders(authBindings()):[]},200,cookies);
 }
 if(path.startsWith('auth/')){
  if(req.method!=='POST')throw new HttpError('NOT_FOUND',404);
  if(!provider)throw new HttpError('AUTH_NOT_CONFIGURED',503);
  await rate(req,'customer-auth',40);
  const action=path.slice(5),input=await body(req);
  const email=z.string().trim().email().max(200),password=z.string().min(12).max(128);
  const sessionCookies=(session:{access_token:string;refresh_token:string})=>[authCookie(accessCookie,session.access_token),authCookie(refreshCookie,session.refresh_token),authCookie(recoveryCookie,'',0)];
  if(action==='login'){const b=z.object({email,password:z.string().min(1).max(128)}).parse(input);const session=await provider.login(b.email,b.password);return json({ok:true},200,sessionCookies(session));}
  if(action==='register'){const b=z.object({email,password,name:z.string().trim().min(2).max(120)}).parse(input);await provider.register(b.email,b.password,b.name);return json({ok:true});}
  if(action==='recover'){const b=z.object({email}).parse(input);await provider.recover(b.email);return json({ok:true});}
  if(action==='confirm'||action==='recovery-verify'){const b=z.object({token_hash:z.string().regex(/^[a-f0-9]{32,128}$/i)}).parse(input);const session=await provider.verify(b.token_hash,action==='confirm'?'email':'recovery');return json({ok:true},200,action==='confirm'?sessionCookies(session):[authCookie(recoveryCookie,session.access_token,600)]);}
  if(action==='reset'){const b=z.object({password}).parse(input);const token=cookieValue(req.headers.get('cookie'),recoveryCookie);if(!token)throw new HttpError('AUTH_INVALID',401);await provider.reset(token,b.password);return json({ok:true},200,clearAuthCookies());}
  if(action==='logout'){await provider.logout(cookieValue(req.headers.get('cookie'),accessCookie));return json({ok:true},200,clearAuthCookies());}
  throw new HttpError('NOT_FOUND',404);
 }
 const user=path.startsWith('admin')||path.startsWith('media/')||['uploads','contact','checkout/review'].includes(path)?null:await customerUser();
 if(path==='wishlist'){
  if(!user)throw new HttpError('UNAUTHORIZED',401);
  const list=async()=>{const rows=await db.select().from(schema.customerWishlists).where(eq(schema.customerWishlists.userId,user.userId)).orderBy(desc(schema.customerWishlists.createdAt));const active=new Set((await getProducts()).map(product=>product.id));return {ids:rows.map(row=>row.productId).filter(id=>active.has(id))};};
  if(req.method==='GET')return json(await list());
  await rate(req,'wishlist:'+user.userId,300);const b=z.object({id:z.string().min(1).max(100),action:z.enum(['add','remove'])}).parse(await body(req));
  if(b.action==='remove')await db.delete(schema.customerWishlists).where(and(eq(schema.customerWishlists.userId,user.userId),eq(schema.customerWishlists.productId,b.id)));
  else{if(!(await getProducts()).some(product=>product.id===b.id))throw new HttpError('PRODUCT_UNAVAILABLE');await env.DB!.prepare('INSERT INTO customer_wishlists (user_id,product_id,created_at) SELECT ?,?,? WHERE (SELECT COUNT(*) FROM customer_wishlists WHERE user_id=?)<300 ON CONFLICT(user_id,product_id) DO NOTHING').bind(user.userId,b.id,now(),user.userId).run();}
  return json(await list());
 }
 if(req.method==='GET'&&path.startsWith('media/')){const fileId=path.split('/')[1];const file=(await db.select().from(schema.files).where(eq(schema.files.id,fileId)).limit(1))[0];if(!file)throw new HttpError('NOT_FOUND',404);if(!file.isPublic&&!(await canReadAdminFile(await adminUser(),file))&&file.ownerId!==(await customerUser())?.userId)throw new HttpError('FORBIDDEN',403);if(!env.BUCKET)throw new HttpError('UPLOAD_UNAVAILABLE',503);const object=await env.BUCKET.get(file.objectKey);if(!object)throw new HttpError('NOT_FOUND',404);return new Response(object.body,{headers:{'Content-Type':file.mime,'Content-Disposition':`${file.isPublic&&file.mime.startsWith('image/')?'inline':'attachment'}; filename*=UTF-8''${encodeURIComponent(file.name)}`,'X-Content-Type-Options':'nosniff','Cache-Control':file.isPublic?'public,max-age=86400':'private,no-store','Content-Security-Policy':"default-src 'none'; sandbox"}});}
 if(req.method==='POST'&&path==='uploads'){
  const admin=await adminUser();await rate(req,admin?'admin-uploads:'+admin.userId:'uploads',admin?250:20);
  if(!env.BUCKET)throw new HttpError('UPLOAD_UNAVAILABLE',503);
  const bytes=await limitedBody(req,MAX_UPLOAD_BYTES+20000);
  const form=await new Request(req.url,{method:'POST',headers:req.headers,body:bytes}).formData();
  const file=form.get('file'),token=z.string().uuid().parse(form.get('token'));
  if(!(file instanceof File)||!file.size||file.size>MAX_UPLOAD_BYTES)throw new HttpError('FILE_TOO_LARGE',413);
  const content=new Uint8Array(await file.arrayBuffer()),mime=verifiedFileMime(content,file.name);
  if(!mime)throw new HttpError('FILE_TYPE');
  const isPublic=form.get('public')==='true';
  const allowedPublic=['products','category','brand','homepage','service','project','client','certificate'].some(p=>canAdmin(admin,p as Parameters<typeof canAdmin>[1]));
  const allowedPrivate=['orders','quotes','products','homepage','service','project','client','certificate'].some(p=>canAdmin(admin,p as Parameters<typeof canAdmin>[1]));
  if(isPublic&&!allowedPublic)throw new HttpError('FORBIDDEN',403);
  if(form.get('purpose')==='admin'&&!allowedPrivate&&!allowedPublic)throw new HttpError('FORBIDDEN',403);
  const uploadUser=admin&&(isPublic||form.get('purpose')==='admin')?admin:await customerUser();
  const fileId=id(),objectKey='assets/'+fileId,name=file.name.replace(/[\u0000-\u001f/\\]/g,'').slice(0,150)||'document';
  await env.BUCKET.put(objectKey,content,{httpMetadata:{contentType:mime}});
  try{await db.insert(schema.files).values({id:fileId,ownerId:uploadUser?.userId||'guest:'+token,name,mime,size:file.size,objectKey,isPublic:isPublic?1:0,createdAt:now()});}
  catch(error){await env.BUCKET.delete(objectKey).catch(()=>{});throw error;}
  return json({id:fileId,name,url:'/api/media/'+fileId});
 }
 if(req.method==='POST'&&path==='uploads/discard'){
  const b=z.object({id:z.string().uuid(),token:z.string().uuid()}).parse(await body(req));
  const identity=await adminUser()||await customerUser(),owner=identity?.userId||'guest:'+b.token;
  const file=await env.DB!.prepare('SELECT object_key FROM files WHERE id=? AND owner_id=? AND parent_id IS NULL AND is_public=0').bind(b.id,owner).first<{object_key:string}>();
  if(!file)throw new HttpError('NOT_FOUND',404);if(!env.BUCKET)throw new HttpError('UPLOAD_UNAVAILABLE',503);
  // Mark expired before removal so a concurrent quote cannot claim the file.
  const retired=await env.DB!.prepare("UPDATE files SET created_at='1970-01-01T00:00:00.000Z' WHERE id=? AND owner_id=? AND parent_id IS NULL AND is_public=0 RETURNING id").bind(b.id,owner).first();
  if(!retired)throw new HttpError('INVALID_ATTACHMENTS',409);
  await env.BUCKET.delete(file.object_key);await env.DB!.prepare('DELETE FROM files WHERE id=? AND parent_id IS NULL').bind(b.id).run();return json({ok:true});
 }
 if(req.method==='POST'&&path==='contact'){
  await rate(req,'contact',8);
  const b=z.object({name:z.string().trim().min(2).max(120),email:z.string().trim().email().max(200),phone:z.string().max(24).optional(),message:z.string().trim().min(10).max(5000),key:z.string().uuid().optional(),website:z.string().max(0).optional()}).parse(await body(req));
  const key=b.key||id(),existing=await env.DB!.prepare('SELECT id,name,email,message FROM contacts WHERE idempotency_key=?').bind(key).first<{id:string;name:string;email:string;message:string}>();
  if(existing){if(existing.email!==b.email||existing.name!==b.name||existing.message!==b.message)throw new HttpError('IDEMPOTENCY_CONFLICT',409);return json({ok:true,reference:'SPC-'+existing.id.slice(0,8).toUpperCase()});}
  const record={id:id(),name:b.name,email:b.email},time=now();
  try{await env.DB!.batch([
   env.DB!.prepare('INSERT INTO contacts (id,name,email,phone,message,created_at,idempotency_key) VALUES (?,?,?,?,?,?,?)').bind(record.id,b.name,b.email,b.phone||null,b.message,time,key),
   ...requestCreatedStatements(bindings,'contacts',record)
  ]);}catch(error){const repeat=await env.DB!.prepare('SELECT id,name,email,message FROM contacts WHERE idempotency_key=?').bind(key).first<{id:string;name:string;email:string;message:string}>();if(!repeat)throw error;if(repeat.name!==b.name||repeat.email!==b.email||repeat.message!==b.message)throw new HttpError('IDEMPOTENCY_CONFLICT',409);return json({ok:true,reference:'SPC-'+repeat.id.slice(0,8).toUpperCase()});}
  return json({ok:true,reference:'SPC-'+record.id.slice(0,8).toUpperCase()});
 }
 if(req.method==='POST'&&path==='quotes'){
  await rate(req,'quotes',8);
  const b=person.extend({city:z.string().max(120).default(''),service:z.string().max(100).default(''),description:z.string().trim().min(10).max(12000),items:z.array(line).max(40).default([]),files:z.array(z.string().uuid()).max(4).default([]),token:z.string().uuid(),key:z.string().uuid(),website:z.string().max(0).optional()}).parse(await body(req));
  const repeat=async()=>{const row=(await db.select().from(schema.quotes).where(eq(schema.quotes.idempotencyKey,b.key)).limit(1))[0];if(!row)return null;if(row.userId!==(user?.userId||null)||row.email!==b.email||row.description!==b.description)throw new HttpError('IDEMPOTENCY_CONFLICT',409);return row;};
  const existing=await repeat();if(existing)return json({number:existing.number});
  const quoteId=id(),number='SPQ-'+Date.now().toString(36).toUpperCase()+'-'+quoteId.slice(0,4).toUpperCase(),catalog=await getProducts();
  const items=b.items.map(l=>{const p=catalog.find(p=>p.id===l.id);if(!p)throw new HttpError('PRODUCT_UNAVAILABLE');return {id:p.id,nameAr:p.nameAr,nameEn:p.nameEn,quantity:l.quantity};});
  const owner=user?.userId||'guest:'+b.token,cutoff=new Date(Date.now()-48*3600000).toISOString();
  if(new Set(b.files).size!==b.files.length)throw new HttpError('INVALID_ATTACHMENTS');
  if(b.files.length){const uploaded=await db.select().from(schema.files).where(inArray(schema.files.id,b.files));if(uploaded.length!==b.files.length||uploaded.some(f=>f.ownerId!==owner||f.parentId||f.isPublic||f.createdAt<=cutoff))throw new HttpError('INVALID_ATTACHMENTS');}
  const statements=[env.DB!.prepare('INSERT INTO quotes (id,number,user_id,name,email,phone,company,city,service,description,items,created_at,idempotency_key) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(quoteId,number,user?.userId||null,b.name,b.email,b.phone,b.company,b.city,b.service,b.description,JSON.stringify(items),now(),b.key)];
  for(const fileId of b.files){
   // A failed claim deliberately violates NOT NULL, rolling back the WHOLE batch.
   statements.push(env.DB!.prepare('UPDATE files SET parent_id=?,owner_id=CASE WHEN owner_id=? AND parent_id IS NULL AND is_public=0 AND created_at>? THEN owner_id ELSE NULL END WHERE id=?').bind(quoteId,owner,cutoff,fileId));
   statements.push(env.DB!.prepare("INSERT INTO request_events (id,request_type,request_id,actor_label,kind,visibility,idempotency_key,created_at) SELECT ?,'quotes',CASE WHEN EXISTS(SELECT 1 FROM files WHERE id=? AND parent_id=? AND owner_id=?) THEN ? ELSE NULL END,'Safe Places','attachment','internal',?,?").bind(id(),fileId,quoteId,owner,quoteId,'attachment:'+quoteId+':'+fileId,now()));
  }
  statements.push(...requestCreatedStatements(bindings,'quotes',{id:quoteId,number,name:b.name,email:b.email}));
  try{await env.DB!.batch(statements);}catch(error){const repeated=await repeat();if(repeated)return json({number:repeated.number});if(error instanceof Error&&/files.owner_id|request_events.request_id/.test(error.message))throw new HttpError('INVALID_ATTACHMENTS',409);throw error;}
  return json({number});
 }
 if(req.method==='POST'&&(path==='checkout/review'||path==='orders'))throw new HttpError('QUOTE_ONLY',409);
  if(req.method==='POST'&&path==='checkout/review'){await rate(req,'review',60);const b=z.object({items:z.array(line).min(1).max(40),coupon:z.string().max(40).default('')}).parse(await body(req));const result=await priceOrder(b.items,b.coupon);return json({...result,coupon:result.coupon?.code||null});}
 if(req.method==='POST'&&path==='orders'){await rate(req,'orders',10);const config=await getSettings();if(!config.orderEnabled)throw new HttpError('ORDER_CONFIRMATION_REQUIRED',409);const b=person.extend({items:z.array(line).min(1).max(40),coupon:z.string().max(40).default(''),billing:z.string().max(1000).default(''),key:z.string().uuid()}).parse(await body(req));const existing=(await db.select().from(schema.orders).where(eq(schema.orders.idempotencyKey,b.key)).limit(1))[0];if(existing){if(existing.userId!==(user?.userId||null))throw new HttpError('FORBIDDEN',403);return json({id:existing.id,number:existing.number});}const result=await priceOrder(b.items,b.coupon);const orderId=id();const number='SPO-'+Date.now().toString(36).toUpperCase()+'-'+orderId.slice(0,4).toUpperCase();const record={id:orderId,number,userId:user?.userId||null,name:b.name,email:b.email,phone:b.phone,company:b.company,billing:b.billing,items:JSON.stringify(result.items),subtotal:result.subtotal,discount:result.discount,vat:result.vat,total:result.total,createdAt:now(),idempotencyKey:b.key,coupon:result.coupon?.code||null};if(result.coupon){const orderSql=env.DB!.prepare('INSERT INTO orders (id,number,user_id,name,email,phone,company,billing,items,subtotal,discount,vat,total,created_at,idempotency_key,coupon) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(...Object.values(record));const checkedAt=now();const redemption=env.DB!.prepare('INSERT INTO coupon_redemptions (id,coupon_id,order_id) VALUES (?,(SELECT id FROM coupons WHERE id=? AND active=1 AND (usage_limit IS NULL OR used<usage_limit) AND (starts_at IS NULL OR starts_at<=?) AND (ends_at IS NULL OR ends_at>=?)),?)').bind(id(),result.coupon.id,checkedAt,checkedAt,orderId);const increment=env.DB!.prepare('UPDATE coupons SET used=used+1 WHERE id=?').bind(result.coupon.id);await env.DB!.batch([orderSql,redemption,increment,...requestCreatedStatements(bindings,'orders',{id:orderId,number,name:b.name,email:b.email})]);}else await env.DB!.batch([env.DB!.prepare('INSERT INTO orders (id,number,user_id,name,email,phone,company,billing,items,subtotal,discount,vat,total,created_at,idempotency_key,coupon) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(...Object.values(record)),...requestCreatedStatements(bindings,'orders',{id:orderId,number,name:b.name,email:b.email})]);return json({id:orderId,number});}
 const accountDetail=path.match(/^account\/requests\/(orders|quotes)\/([^/]+)$/);
 if(req.method==='GET'&&accountDetail){if(!user)throw new HttpError('UNAUTHORIZED',401);return json(await customerRequestDetail(bindings,accountDetail[1] as 'orders'|'quotes',accountDetail[2],user.userId));}
 if(path==='profile'){if(!user)throw new HttpError('UNAUTHORIZED',401);if(req.method==='GET'){return json((await db.select().from(schema.customers).where(eq(schema.customers.id,user.userId)).limit(1))[0]||{name:user.fullName||'',email:user.email});}const b=person.parse(await body(req));if((user.provider==='supabase'||user.provider==='standalone')&&b.email.toLowerCase()!==user.email.toLowerCase())throw new HttpError('EMAIL_CHANGE_REQUIRES_VERIFICATION');await db.insert(schema.customers).values({id:user.userId,...b,updatedAt:now()}).onConflictDoUpdate({target:schema.customers.id,set:{...b,updatedAt:now()}});return json({ok:true});}
 if(req.method==='GET'&&path==='account'){if(!user)throw new HttpError('UNAUTHORIZED',401);const [orders,quotes]=await Promise.all([db.select().from(schema.orders).where(eq(schema.orders.userId,user.userId)).orderBy(desc(schema.orders.createdAt)),db.select().from(schema.quotes).where(eq(schema.quotes.userId,user.userId)).orderBy(desc(schema.quotes.createdAt))]);return json({orders:orders.map(({notes,idempotencyKey,...o})=>o),quotes:quotes.map(({notes,idempotencyKey,...q})=>q)});}
 if(path.startsWith('admin')){
  if(req.method==='POST'&&path==='admin/bootstrap'){const native=await getChatGPTUser();if(!native)throw new HttpError('UNAUTHORIZED',401);if(!await canBootstrap())throw new HttpError('FORBIDDEN',403);await db.insert(schema.settings).values({key:'site-owner',value:native!.userId}).onConflictDoNothing();if(!await adminUser())throw new HttpError('FORBIDDEN',403);for(const p of starterProducts)await db.insert(schema.products).values(p).onConflictDoNothing();for(const c of initialContent)await db.insert(schema.content).values(c).onConflictDoNothing();await db.insert(schema.settings).values({key:'catalog-ready',value:'true'}).onConflictDoNothing();await audit(native!.userId,'admin:activate');return json({ok:true});}
  const admin=await adminUser();if(!admin)throw new HttpError('FORBIDDEN',403);
  const requirePermission=(permission:Parameters<typeof canAdmin>[1])=>{if(!canAdmin(admin,permission))throw new HttpError('FORBIDDEN',403);};
  if(req.method==='POST')await rate(req,'admin-write:'+admin.userId,300);
  const operation=await handleAdminOperations(req,path,admin,bindings);if(operation)return operation;
  if(path==='admin/team'||path==='admin/team/update'||path==='admin/team/revoke'||path==='admin/team/restore'){
   // The original immutable owner is the *only* person allowed to manage staff.
   if(admin.role!=='owner')throw new HttpError('FORBIDDEN',403);
   await rate(req,'admin-team:'+admin.userId,100);
   if(req.method==='GET'&&path==='admin/team'){
    const team=await db.select().from(adminMembers).orderBy(desc(adminMembers.createdAt));
    return json({members:team.map(member=>{
     let permissions:ReturnType<typeof parseAdminPermissions>=[];
     try{permissions=parseAdminPermissions(JSON.parse(member.permissions));}catch{}
     return {id:member.id,email:member.email,permissions,active:member.active===1,linked:!!member.authUserId,createdAt:member.createdAt};
    })});
   }
   if(req.method==='POST'&&path==='admin/team'){
    const b=z.object({email:z.string().trim().email().max(200),
     permissions:z.array(z.enum(ADMIN_PERMISSIONS)).min(1).max(ADMIN_PERMISSIONS.length)}).parse(await body(req));
    const email=b.email.toLowerCase(),permissions=parseAdminPermissions(b.permissions);
    const ownerEmail=(env as unknown as Record<string,string>).STANDALONE_ADMIN_EMAIL?.trim().toLowerCase();
    if(email===ownerEmail)throw new HttpError('FORBIDDEN',403);
    if((await db.select({id:adminMembers.id}).from(adminMembers).where(eq(adminMembers.active,1))).length>=50)throw new HttpError('TEAM_LIMIT',409);
    if((await db.select({id:adminMembers.id}).from(adminMembers).where(eq(adminMembers.email,email)).limit(1)).length)throw new HttpError('TEAM_EXISTS',409);
    const memberId=id(),timestamp=now();
    await db.insert(adminMembers).values({id:memberId,email,permissions:JSON.stringify(permissions),active:1,invitedBy:admin.userId,createdAt:timestamp,updatedAt:timestamp});
    await audit(admin.userId,'admin:staff:invite',memberId);
    return json({ok:true,id:memberId});
   }
   if(req.method==='POST'&&['admin/team/update','admin/team/restore','admin/team/revoke'].includes(path)){
    const b=z.object({id:z.string().uuid(),permissions:z.array(z.enum(ADMIN_PERMISSIONS)).min(1).max(ADMIN_PERMISSIONS.length).optional()}).parse(await body(req));
    const member=(await db.select().from(adminMembers).where(eq(adminMembers.id,b.id)).limit(1))[0];if(!member)throw new HttpError('NOT_FOUND',404);
    const revoke=path.endsWith('/revoke'),restore=path.endsWith('/restore');
    if(!revoke&&!b.permissions)throw new HttpError('VALIDATION');
    if(!revoke&&!restore&&!member.active)throw new HttpError('TEAM_REVOKED',409);
    if(restore&&!member.active&&(await db.select({id:adminMembers.id}).from(adminMembers).where(eq(adminMembers.active,1))).length>=50)throw new HttpError('TEAM_LIMIT',409);
    const action=revoke?'revoke':restore?'restore':'permissions';
    const change=db.update(adminMembers).set({active:revoke?0:1,...(!revoke?{permissions:JSON.stringify(parseAdminPermissions(b.permissions))}:{}),updatedAt:now()}).where(eq(adminMembers.id,b.id));
    const entry=db.insert(schema.activity).values({id:id(),userId:admin.userId,action:'admin:staff:'+action,entityId:b.id,createdAt:now()});
    if(member.authUserId)await db.batch([change,entry,db.delete(authSession).where(eq(authSession.userId,member.authUserId))]);
    else await db.batch([change,entry]);
    return json({ok:true});
   }
   throw new HttpError('NOT_FOUND',404);
  }
  if(req.method==='GET'&&path==='admin/data')return json(await getAdminData(admin));
  if(req.method==='POST'&&path==='admin/bulk'){
   const b=z.object({type:z.enum(['products','content','coupons']),ids:z.array(z.string().min(1).max(100)).min(1).max(100),action:z.enum(['publish','hide','feature','unfeature'])}).parse(await body(req));
   if(b.type==='products')requirePermission('products');
   if(b.type==='coupons')requirePermission('coupons');
   const ids=[...new Set(b.ids)];
   if(b.type!=='products'&&['feature','unfeature'].includes(b.action))throw new HttpError('INVALID_BULK_ACTION');
   const selected=b.type==='products'?await db.select().from(schema.products).where(inArray(schema.products.id,ids)):b.type==='content'?await db.select().from(schema.content).where(inArray(schema.content.id,ids)):await db.select().from(schema.coupons).where(inArray(schema.coupons.id,ids));
   if(selected.length!==ids.length)throw new HttpError('NOT_FOUND',404);
   if(b.type==='content'&&selected.some(row=>!canAdminContent(admin,'type' in row?String(row.type):'')))throw new HttpError('FORBIDDEN',403);
   if(b.type==='products'&&b.action==='publish'&&selected.some(row=>!productReady(row as typeof schema.products.$inferSelect)))throw new HttpError('PRICE_REQUIRED');
   const record=db.insert(schema.activity).values({id:id(),userId:admin.userId,action:b.type+':bulk:'+b.action,entityId:JSON.stringify(ids),createdAt:now()});
   if(b.type==='products')await db.batch([db.update(schema.products).set(['feature','unfeature'].includes(b.action)?{featured:b.action==='feature'?1:0}:{active:b.action==='publish'?1:0}).where(inArray(schema.products.id,ids)),record]);
   else if(b.type==='content')await db.batch([db.update(schema.content).set({active:b.action==='publish'?1:0}).where(inArray(schema.content.id,ids)),record]);
   else await db.batch([db.update(schema.coupons).set({active:b.action==='publish'?1:0}).where(inArray(schema.coupons.id,ids)),record]);
   return json({ok:true,changed:ids.length});
  }
  if(req.method==='POST'&&path==='admin/products'){requirePermission('products');const b=z.object({id:z.string().max(100).optional(),slug:z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100),nameAr:z.string().trim().min(2).max(200),nameEn:z.string().trim().min(2).max(200),descriptionAr:z.string().max(10000),descriptionEn:z.string().max(10000),category:z.string().max(100),kind:z.enum(['quote','direct','both']),price:z.number().int().positive().nullable(),oldPrice:z.number().int().positive().nullable().optional(),sku:z.string().max(80).nullable().optional(),brand:z.string().max(100).nullable().optional(),image:z.string().max(1000).nullable().optional(),specs:z.string().max(20000).default('[]'),related:z.string().max(10000).default('[]'),gallery:z.string().max(10000).default('[]'),datasheet:z.string().max(1000).nullable().optional(),keywords:z.string().max(1000).default(''),active:z.number().int().min(0).max(1),featured:z.number().int().min(0).max(1)}).parse(await body(req));if(b.active&&!productReady(b))throw new HttpError('PRICE_REQUIRED');for(const url of [b.image,b.datasheet,...JSON.parse(b.gallery)])if(url&&!/^\/api\/media\/[a-f0-9-]+$/.test(url)&&!/^https:\/\//.test(url))throw new HttpError('INVALID_IMAGE');z.array(z.object({ar:z.string().max(120),en:z.string().max(120),value:z.string().max(1000)})).max(50).parse(JSON.parse(b.specs));z.array(z.string().max(100)).max(20).parse(JSON.parse(b.related));const productId=b.id||id();await db.insert(schema.products).values({...b,id:productId,createdAt:now()}).onConflictDoUpdate({target:schema.products.id,set:b});await db.insert(schema.settings).values({key:'catalog-ready',value:'true'}).onConflictDoNothing();await audit(admin.userId,'product:save',productId);return json({ok:true,id:productId});}
  if(req.method==='POST'&&path==='admin/settings'){
   const supplied=z.record(z.unknown()).parse(await body(req));
   if(!canAdmin(admin,'settings')&&(!canAdmin(admin,'homepage')||Object.keys(supplied).some(key=>!(HOMEPAGE_SETTINGS_KEYS as readonly string[]).includes(key))))throw new HttpError('FORBIDDEN',403);const {initialSettings}=await import('../../../lib/config');const patch:Record<string,unknown>={};for(const [key,value]of Object.entries(supplied)){if(!(key in initialSettings))continue;const original=initialSettings[key as keyof typeof initialSettings];if(typeof original==='string'){patch[key]=z.string().max(12000).parse(value);}else if(typeof original==='boolean')patch[key]=z.boolean().parse(value);else patch[key]=z.number().min(0).max(100).parse(value);}if(typeof patch.heroImage==='string'&&!/^\/images\/[a-zA-Z0-9/_.-]+$/.test(patch.heroImage)&&!/^\/api\/media\/[a-f0-9-]+$/.test(patch.heroImage)&&!/^https:\/\//.test(patch.heroImage))throw new HttpError('INVALID_IMAGE');for(const [key,value]of Object.entries(patch))await db.insert(schema.settings).values({key,value:JSON.stringify(value)}).onConflictDoUpdate({target:schema.settings.key,set:{value:JSON.stringify(value)}});await audit(admin.userId,'settings:save');return json({ok:true});}
  if(req.method==='POST'&&path==='admin/content'){const b=z.object({id:z.string().optional(),type:z.enum(['service','project','client','certificate','category','banner','brand']),slug:z.string().regex(/^[a-z0-9-]+$/).max(100),titleAr:z.string().min(1).max(200),titleEn:z.string().min(1).max(200),descriptionAr:z.string().max(12000).default(''),descriptionEn:z.string().max(12000).default(''),image:z.string().max(1000).nullable().optional(),file:z.string().max(1000).nullable().optional(),extra:z.string().max(12000).default('{}'),active:z.number().int().min(0).max(1),sortOrder:z.number().int().min(0).max(9999)}).parse(await body(req));
   if(!canAdminContent(admin,b.type))throw new HttpError('FORBIDDEN',403);
   if(b.id){
    const [existing]=await db.select({type:schema.content.type}).from(schema.content).where(eq(schema.content.id,b.id)).limit(1);
    if(existing&&!canAdminContent(admin,existing.type))throw new HttpError('FORBIDDEN',403);
   }
   JSON.parse(b.extra);for(const url of [b.image,b.file])if(url&&!/^\/api\/media\/[a-f0-9-]+$/.test(url)&&!/^https:\/\//.test(url))throw new HttpError('INVALID_IMAGE');const contentId=b.id||id();await db.insert(schema.content).values({...b,id:contentId}).onConflictDoUpdate({target:schema.content.id,set:b});await audit(admin.userId,'content:save',contentId);return json({ok:true});}
  if(req.method==='POST'&&path==='admin/coupons'){requirePermission('coupons');const b=z.object({id:z.string().optional(),code:z.string().trim().regex(/^[A-Za-z0-9_-]{3,40}$/).transform(v=>v.toUpperCase()),type:z.enum(['percentage','fixed']),value:z.number().int().positive(),minimum:z.number().int().min(0),maximum:z.number().int().positive().nullable(),usageLimit:z.number().int().positive().nullable(),startsAt:z.string().nullable(),endsAt:z.string().nullable(),categories:z.string().default('[]'),active:z.number().int().min(0).max(1)}).parse(await body(req));if(b.type==='percentage'&&b.value>100)throw new HttpError('INVALID_DISCOUNT');z.array(z.string()).parse(JSON.parse(b.categories));const couponId=b.id||id();await db.insert(schema.coupons).values({...b,id:couponId}).onConflictDoUpdate({target:schema.coupons.id,set:b});await audit(admin.userId,'coupon:save',couponId);return json({ok:true});}
  if(req.method==='POST'&&path==='admin/status'){
   const b=z.object({type:z.enum(['orders','quotes','contacts']),id:z.string().min(1).max(100),status:z.string().max(50),expectedStatus:z.string().max(50).optional(),expectedPaymentStatus:z.string().max(50).optional(),expectedFile:z.string().max(1000).nullable().optional(),paymentStatus:z.string().max(50).optional(),notes:z.string().max(8000).optional(),file:z.string().max(1000).optional()}).parse(await body(req));
   requirePermission(b.type);
   const options={orders:['new','confirmed','processing','ready','completed','cancelled'],quotes:['new','review','information','quoted','accepted','declined','closed'],contacts:['new','reviewed','closed']};
   if(!options[b.type].includes(b.status))throw new HttpError('INVALID_STATUS');
   if(b.paymentStatus&&(b.type!=='orders'||!['pending','paid','failed','refunded','partially_refunded'].includes(b.paymentStatus)))throw new HttpError('INVALID_STATUS');
   if(b.type==='contacts'&&(b.file||b.notes!==undefined))throw new HttpError('VALIDATION');
   const record=await requestRecord(bindings,b.type,b.id);
   if(b.expectedStatus!==undefined&&record.status!==b.expectedStatus)throw new HttpError('RECORD_CHANGED',409);
   if(b.expectedPaymentStatus!==undefined&&record.payment_status!==b.expectedPaymentStatus)throw new HttpError('RECORD_CHANGED',409);
   const document=b.type==='orders'?record.invoice_file:record.proposal_file;
   if(b.expectedFile!==undefined&&(document||null)!==b.expectedFile)throw new HttpError('RECORD_CHANGED',409);
   const comparison=b.type==='contacts'?'':b.type==='orders'?' AND payment_status IS ? AND notes IS ? AND invoice_file IS ?':' AND notes IS ? AND proposal_file IS ?';
   const previous=b.type==='contacts'?[]:b.type==='orders'?[record.payment_status??null,record.notes??null,record.invoice_file??null]:[record.notes??null,record.proposal_file??null];
   const statements=[env.DB!.prepare(`INSERT INTO request_events (id,request_type,request_id,actor_id,actor_label,kind,visibility,from_status,to_status,idempotency_key,created_at) VALUES (?,?,(SELECT id FROM ${b.type} WHERE id=? AND status=?${comparison}),?,?,'status','customer',?,?,?,?)`).bind(id(),b.type,b.id,record.status,...previous,admin.userId,admin.displayName,record.status,b.status,id(),now())];
   const fields=['status=?'],values:unknown[]=[b.status];
   if(b.paymentStatus){fields.push('payment_status=?');values.push(b.paymentStatus);}
   if(b.notes!==undefined){fields.push('notes=?');values.push(b.notes);if(b.notes!==record.notes)statements.push(eventStatement(bindings,{type:b.type,requestId:b.id,kind:'note',body:b.notes,actorId:admin.userId,actorLabel:admin.displayName}));}
   if(b.file){
    if(!env.BUCKET)throw new HttpError('UPLOAD_UNAVAILABLE',503);
    const match=b.file.match(/^\/api\/media\/([a-f0-9-]+)$/);if(!match)throw new HttpError('INVALID_ATTACHMENTS');
    const file=(await db.select().from(schema.files).where(eq(schema.files.id,match[1])).limit(1))[0],cutoff=new Date(Date.now()-48*3600000).toISOString();
    if(!file||file.isPublic||(file.parentId!==b.id&&(file.ownerId!==admin.userId||file.parentId||file.createdAt<=cutoff)))throw new HttpError('INVALID_ATTACHMENTS');
    if(!file.parentId)statements.push(env.DB!.prepare('UPDATE files SET parent_id=?,owner_id=CASE WHEN owner_id=? AND parent_id IS NULL AND is_public=0 AND created_at>? THEN ? ELSE NULL END WHERE id=?').bind(b.id,admin.userId,cutoff,record.user_id||admin.userId,file.id));
    statements.push(env.DB!.prepare("INSERT INTO request_events (id,request_type,request_id,actor_id,actor_label,kind,visibility,idempotency_key,created_at) VALUES (?,?,(SELECT parent_id FROM files WHERE id=? AND parent_id=? AND is_public=0),?,?,'attachment','internal',?,?)").bind(id(),b.type,file.id,b.id,admin.userId,admin.displayName,id(),now()));
    fields.push(b.type==='orders'?'invoice_file=?':'proposal_file=?');values.push(b.file);
   }
   statements.push(env.DB!.prepare(`UPDATE ${b.type} SET ${fields.join(',')} WHERE id=?`).bind(...values,b.id));
   statements.push(env.DB!.prepare('INSERT INTO activity (id,user_id,action,entity_id,created_at) VALUES (?,?,?,?,?)').bind(id(),admin.userId,b.type+':update',b.id,now()));
   try{await env.DB!.batch(statements);}catch(error){if(error instanceof Error&&/files.owner_id/.test(error.message))throw new HttpError('INVALID_ATTACHMENTS',409);if(error instanceof Error&&/request_events.request_id/.test(error.message))throw new HttpError('RECORD_CHANGED',409);throw error;}
   return json({ok:true});
  }
  if(req.method==='GET'&&path.startsWith('admin/files/')){
   const parentId=path.split('/')[2];
   const allowed=admin.role==='owner'||
    (canAdmin(admin,'orders')&&(await db.select({id:schema.orders.id}).from(schema.orders).where(eq(schema.orders.id,parentId)).limit(1)).length>0)||
    (canAdmin(admin,'quotes')&&(await db.select({id:schema.quotes.id}).from(schema.quotes).where(eq(schema.quotes.id,parentId)).limit(1)).length>0);
   if(!allowed)throw new HttpError('FORBIDDEN',403);
   return json(await db.select().from(schema.files).where(eq(schema.files.parentId,parentId)));
  }
 }
 throw new HttpError('NOT_FOUND',404);
}
async function route(req:Request){try{return await handle(req);}catch(e){if(e instanceof CustomerAuthError)return json({error:e.code},e.status);if(e instanceof OperationError)return json({error:e.code},e.status);if(e instanceof z.ZodError)return json({error:'VALIDATION',fields:e.issues.map(i=>i.path.join('.'))},400);if(e instanceof SyntaxError)return json({error:'VALIDATION'},400);if(e instanceof Error&&(e.message.includes('COUPON_EXHAUSTED')||e.message.includes('coupon_redemptions.coupon_id')))return json({error:'INVALID_COUPON'},400);console.error('Safe Places operation failed',e instanceof Error?e.name:'Unknown error');return json({error:e instanceof Error&&e.message.startsWith('COUPON_')?e.message:'SERVER_ERROR'},e instanceof Error&&e.message.startsWith('COUPON_')?400:500);}}
export const GET=route;export const POST=route;
