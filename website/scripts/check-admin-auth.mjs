import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';

// All identities, OAuth client values and session secrets in this check are
// temporary local fixtures. No Google callback success or live login is claimed.
const require=createRequire(import.meta.url);
const requireWrangler=createRequire(require.resolve('wrangler/package.json'));
const requireAuth=createRequire(require.resolve('better-auth'));
const {Miniflare}=requireWrangler('miniflare');
const {serializeSignedCookie}=requireAuth('better-call');
const origin='https://safeplaces-preview.pages.dev';
const secret=randomBytes(48).toString('base64url');
const people={
 owner:{id:randomUUID(),email:'owner@safeplaces-auth-test.example',verified:1},
 staff:{id:randomUUID(),email:'staff@safeplaces-auth-test.example',verified:1},
 customer:{id:randomUUID(),email:'customer@safeplaces-auth-test.example',verified:1},
 unverified:{id:randomUUID(),email:'unverified@safeplaces-auth-test.example',verified:0}
};
const serverRoot=resolve('dist/server');
const modulePaths=['index.js',...readdirSync(serverRoot,{recursive:true}).filter(path=>path.endsWith('.js')&&path!=='index.js')];
let outboundCalls=0;
const mf=new Miniflare({
 name:'safeplaces-auth-regression',modulesRoot:serverRoot,
 modules:modulePaths.map(path=>({type:'ESModule',path:resolve(serverRoot,path)})),
 compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],
 d1Databases:{DB:'auth-regression-db'},r2Buckets:['BUCKET'],
 bindings:{
  SITE_PUBLIC:'true',SITE_INDEXABLE:'false',SITE_DEMO_PRICES:'true',
  ADMIN_BOOTSTRAP_PRIVATE:'true',STANDALONE_AUTH_ENABLED:'true',
  BETTER_AUTH_SECRET:secret,BETTER_AUTH_URL:origin,
  GOOGLE_CLIENT_ID:'safeplaces-local-regression.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET:'local-regression-only-never-valid-at-google',
  STANDALONE_ADMIN_USER_ID:people.owner.id,STANDALONE_ADMIN_EMAIL:people.owner.email
 },
 outboundService:()=>{outboundCalls++;return new Response('External calls disabled in local authentication regression checks',{status:503});},
 port:0,host:'127.0.0.1'
});

try{
 const db=await mf.getD1Database('DB');
 for(const migration of readdirSync('drizzle').filter(file=>file.endsWith('.sql')).sort())
  for(const sql of readFileSync('drizzle/'+migration,'utf8').replace(/^\s*--.*$/gm,'').split(';').filter(sql=>sql.trim()))await db.prepare(sql).run();
 const timestamp=Date.now();
 for(const [name,person] of Object.entries(people)){
  await db.prepare('INSERT INTO auth_user (id,name,email,email_verified,created_at,updated_at) VALUES (?,?,?,?,?,?)').bind(person.id,name,person.email,person.verified,timestamp,timestamp).run();
  await db.prepare('INSERT INTO auth_account (id,user_id,account_id,provider_id,created_at,updated_at) VALUES (?,?,?,?,?,?)').bind(randomUUID(),person.id,'local-google-subject-'+person.id,'google',timestamp,timestamp).run();
 }
 async function session(person,expiresAt=Date.now()+3600000){
  const token=randomBytes(32).toString('base64url');
  await db.prepare('INSERT INTO auth_session (id,user_id,token,expires_at,created_at,updated_at) VALUES (?,?,?,?,?,?)')
   .bind(randomUUID(),person.id,token,expiresAt,Date.now(),Date.now()).run();
  const signed=await serializeSignedCookie('__Secure-better-auth.session_token',token,secret,{httpOnly:true,secure:true,sameSite:'lax',path:'/'});
  return signed.split(';',1)[0];
 }
 const cookies={owner:await session(people.owner),staff:await session(people.staff),customer:await session(people.customer),unverified:await session(people.unverified)};
 const send=(path,body,cookie='',headers={})=>mf.dispatchFetch(origin+path,{
  method:body===undefined?'GET':'POST',redirect:'manual',
  headers:{...(cookie?{Cookie:cookie}:{}),...(body===undefined?{}:{Origin:origin,'Content-Type':'application/json'}),...headers},
  ...(body===undefined?{}:{body:JSON.stringify(body)})
 });
 async function json(path,body,cookie='',status=200,headers={}){
  const response=await send(path,body,cookie,headers),raw=await response.text();
  assert.equal(response.status,status,path+': '+raw.slice(0,400));
  assert.match(response.headers.get('cache-control')||'',/no-store/);
  return raw?(response.headers.get('content-type')?.includes('application/json')?JSON.parse(raw):raw):null;
 }
 await json('/api/admin/data',undefined,'',403);
 await json('/api/admin/data',undefined,'',403,{'oai-authenticated-user-id':people.owner.id,'oai-authenticated-user-email':people.owner.email});
 await json('/api/admin/bootstrap',{},'',403,{'oai-authenticated-user-id':people.owner.id,'oai-authenticated-user-email':people.owner.email});
 await json('/api/admin/data',undefined,cookies.customer,403);
 await json('/api/admin/data',undefined,cookies.unverified,403);
 const publicSession=await json('/api/session',undefined,cookies.owner);
 assert.equal(publicSession.admin,true);
 assert.equal(publicSession.user.userId,'customer:'+people.owner.id);
 assert.deepEqual(publicSession.socialProviders,['google']);
 const authSession=await json('/api/auth/get-session',undefined,cookies.owner);
 assert.equal(authSession.user.id,people.owner.id,'The real Better Auth handler accepts a correctly signed local DB session');
 const forged=cookies.owner.slice(0,-8)+'tampered';
 await json('/api/admin/data',undefined,forged,403);
 const expired=await session(people.owner,Date.now()-60000);
 await json('/api/admin/data',undefined,expired,403);
 await db.prepare('UPDATE auth_user SET email=? WHERE id=?').bind('changed-owner@safeplaces-auth-test.example',people.owner.id).run();
 await json('/api/admin/data',undefined,cookies.owner,403);
 await db.prepare('UPDATE auth_user SET email=? WHERE id=?').bind(people.owner.email,people.owner.id).run();
 console.log('PASS: verified DB sessions, owner ID plus email, forged/expired cookies and public-header impersonation');

 const orderId=randomUUID(),quoteId=randomUUID(),contactId=randomUUID(),createdAt=new Date().toISOString();
 await db.prepare('INSERT INTO orders (id,number,name,email,phone,items,subtotal,vat,total,created_at,idempotency_key) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
  .bind(orderId,'AUTH-ORDER','Local order',people.customer.email,'+966500000000','[]',10000,1500,11500,createdAt,randomUUID()).run();
 await db.prepare('INSERT INTO quotes (id,number,name,email,phone,description,created_at,idempotency_key) VALUES (?,?,?,?,?,?,?,?)')
  .bind(quoteId,'AUTH-QUOTE','Local quote',people.customer.email,'+966500000000','Local quote fixture only',createdAt,randomUUID()).run();
 await db.prepare('INSERT INTO contacts (id,name,email,message,created_at) VALUES (?,?,?,?,?)')
  .bind(contactId,'Local contact',people.customer.email,'Local contact fixture only',createdAt).run();
 const ownerData=await json('/api/admin/data',undefined,cookies.owner);
 assert.equal(ownerData.orders.length,1);assert.equal(ownerData.quotes.length,1);assert.equal(ownerData.contacts.length,1);
 const invitation=await json('/api/admin/team',{email:people.staff.email.toUpperCase(),permissions:['orders']},cookies.owner);
 await json('/api/admin/team',{email:people.owner.email,permissions:['orders']},cookies.owner,403);
 await json('/api/admin/team',{email:people.staff.email,permissions:['quotes']},cookies.owner,409);
 let staffData=await json('/api/admin/data',undefined,cookies.staff);
 assert.equal(staffData.orders.length,1);assert.deepEqual(staffData.quotes,[]);assert.deepEqual(staffData.contacts,[]);
 assert.deepEqual(staffData.customers,[]);assert.deepEqual(staffData.activity,[]);assert.deepEqual(staffData.settings,{});
 const bound=await db.prepare('SELECT auth_user_id FROM admin_members WHERE id=?').bind(invitation.id).first();
 assert.equal(bound.auth_user_id,people.staff.id,'First approved login binds the immutable user ID');
 await json('/api/admin/team',undefined,cookies.staff,403);
 await json('/api/admin/team',{email:'rogue@safeplaces-auth-test.example',permissions:['orders']},cookies.staff,403);
 await json('/api/admin/team/revoke',{id:invitation.id},cookies.staff,403);
 await json('/api/admin/team/restore',{id:invitation.id,permissions:['settings']},cookies.staff,403);
 await json('/api/admin/status',{type:'quotes',id:quoteId,status:'review'},cookies.staff,403);
 await json('/api/admin/settings',{orderEnabled:true},cookies.staff,403);
 await json('/api/admin/content',{type:'service',slug:'auth-local-test',titleAr:'اختبار',titleEn:'Local test',active:1,sortOrder:0},cookies.staff,403);
 await json('/api/admin/files/'+quoteId,undefined,cookies.staff,403);
 await json('/api/admin/team/update',{id:invitation.id,permissions:['dashboard']},cookies.owner);
 await json('/api/admin/data',undefined,cookies.staff,403);
 cookies.staff=await session(people.staff);
 staffData=await json('/api/admin/data',undefined,cookies.staff);
 for(const key of ['orders','quotes','contacts','products','customers','activity'])assert.deepEqual(staffData[key],[],'Dashboard alone must not disclose '+key);
 console.log('PASS: owner-only invitations, immutable staff binding, direct API RBAC and filtered dashboard data');

 await json('/api/admin/team/revoke',{id:invitation.id},cookies.owner);
 await json('/api/admin/data',undefined,cookies.staff,403);
 const revoked=await db.prepare('SELECT auth_user_id,active FROM admin_members WHERE id=?').bind(invitation.id).first();
 assert.equal(revoked.active,0);assert.equal(revoked.auth_user_id,people.staff.id);
 assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM auth_session WHERE user_id=?').bind(people.staff.id).first()).n,0);
 const inactiveLogin=await session(people.staff);
 await json('/api/admin/data',undefined,inactiveLogin,403);
 const team=await json('/api/admin/team',undefined,cookies.owner);
 assert.equal(team.members.find(member=>member.id===invitation.id).active,false);
 await json('/api/admin/team/restore',{id:invitation.id,permissions:['quotes']},cookies.owner);
 const restored=await db.prepare('SELECT auth_user_id,active FROM admin_members WHERE id=?').bind(invitation.id).first();
 assert.equal(restored.active,1);assert.equal(restored.auth_user_id,people.staff.id);
 cookies.staff=await session(people.staff);
 staffData=await json('/api/admin/data',undefined,cookies.staff);
 assert.equal(staffData.quotes.length,1);assert.deepEqual(staffData.orders,[]);
 await db.prepare('UPDATE admin_members SET auth_user_id=? WHERE id=?').bind(people.customer.id,invitation.id).run();
 await json('/api/admin/data',undefined,cookies.staff,403);
 await db.prepare('UPDATE admin_members SET auth_user_id=? WHERE id=?').bind(people.staff.id,invitation.id).run();
 console.log('PASS: immediate revoke, session deletion, retained access history and restoration without identity rebinding');

 await json('/api/auth/sign-in/social',{provider:'google',callbackURL:'/ar/admin'},'',403,{Origin:'https://untrusted.example'});
 await json('/api/auth/sign-in/social',{provider:'google',callbackURL:'/ar/admin'},'',403,{Origin:''});
 await json('/api/auth/sign-in/social',{provider:'google',callbackURL:'https://untrusted.example/steal'},'',403);
 for(const path of ['/sign-in/email','/sign-up/email','/request-password-reset','/link-social','/get-access-token'])await json('/api/auth'+path,{},cookies.owner,404);
 const started=await send('/api/auth/sign-in/social',{provider:'google',callbackURL:'/ar/admin',errorCallbackURL:'/ar/account/login',disableRedirect:true});
 assert.equal(started.status,200);
 assert.equal(started.headers.get('referrer-policy'),'no-referrer');
 const authorizationURL=new URL((await started.json()).url);
 assert.equal(authorizationURL.origin,'https://accounts.google.com');
 assert.equal(authorizationURL.searchParams.get('redirect_uri'),origin+'/api/auth/callback/google');
 assert.equal(authorizationURL.searchParams.get('prompt'),'select_account');
 assert.ok(authorizationURL.searchParams.get('state'));
 assert.ok(authorizationURL.searchParams.get('code_challenge'),'Google sign-in uses PKCE');
 const stateCookies=started.headers.get('set-cookie')||'';
 assert.match(stateCookies,/HttpOnly/i);assert.match(stateCookies,/Secure/i);assert.match(stateCookies,/SameSite=Lax/i);
 assert.doesNotMatch(stateCookies,/Domain=/i,'OAuth state cookie stays host-only');
 const sessionsBefore=(await db.prepare('SELECT COUNT(*) AS n FROM auth_session').first()).n;
 const invalidCallback=await send('/api/auth/callback/google?state=unknown-local-state&code=never-an-authorization-code');
 assert.ok([302,303,400,401].includes(invalidCallback.status),'An invalid OAuth state must be rejected');
 assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM auth_session').first()).n,sessionsBefore);
 await json('/api/auth/sign-out',{},cookies.owner,403,{Origin:'https://untrusted.example'});
 assert.equal((await json('/api/session',undefined,cookies.owner)).admin,true,'CSRF did not revoke the owner session');
 await json('/api/auth/sign-out',{},cookies.owner);
 await json('/api/admin/data',undefined,cookies.owner,403);
 assert.equal(outboundCalls,0,'Local auth regression must never call Google, send email or use any external service');
 console.log('PASS: Google-only routes, OAuth origin/PKCE/state controls, secure cookies and actual sign-out revocation');
 console.log('PASS: authentication and administrative security regression completed with local fixtures only');
}finally{await mf.dispose();}
