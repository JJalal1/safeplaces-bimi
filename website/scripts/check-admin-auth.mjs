import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,randomBytes,randomUUID,sign} from 'node:crypto';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import ts from 'typescript';
import {APIError,isAPIError} from 'better-auth/api';
import gateway from '../pages-preview/_worker.js';

// All identities, OAuth client values and session secrets in this check are
// temporary local fixtures. The provider exchange below is intercepted in
// Miniflare; it neither contacts Google nor proves a real Google login.
const loggerCode=ts.transpileModule(readFileSync('lib/auth-log-policy.ts','utf8'),{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}
}).outputText;
const {authLogger,createAuthErrorHandler}=await import('data:text/javascript;base64,'+Buffer.from(loggerCode).toString('base64'));
const sensitive='DO_NOT_LOG_OAUTH_FIXTURE_CODE_STATE_SECRET_EMAIL_OR_URL';
const diagnosticMessages=[],originalWarn=console.warn,originalError=console.error;
try{
 console.warn=console.error=(...args)=>diagnosticMessages.push(args);
 authLogger.log('error','Failed to parse state',Object.assign(new Error('State mismatch: State not persisted correctly'),{details:{state:sensitive},cause:new Error(sensitive)}));
 authLogger.log('error','',{error:'invalid_client',error_description:sensitive,request:{url:sensitive,body:sensitive}});
 authLogger.log('warn',sensitive,{access_token:sensitive,user:{email:sensitive}});
 authLogger.log('error','',{error:sensitive});
 authLogger.log('error','Failed to parse state',Object.defineProperty({},'message',{get(){throw new Error(sensitive);}}));
 authLogger.log('error','AUTH_EMAIL_ERROR',{code:'EMAIL_PROVIDER_CONFIGURATION',recipient:sensitive,url:sensitive});
 authLogger.log('error','AUTH_EMAIL_ERROR',{code:'EMAIL_PROVIDER_RATE_LIMIT',response:{body:sensitive}});
 authLogger.log('error','AUTH_EMAIL_ERROR',{code:sensitive,message:sensitive});
 authLogger.log('error','AUTH_EMAIL_ERROR',Object.defineProperty({},'code',{get(){throw new Error(sensitive);}}));
 authLogger.log('error','AUTH_PASSWORD_ERROR',{password:sensitive,hash:sensitive});
 authLogger.log('info',sensitive,{code:sensitive});
}finally{console.warn=originalWarn;console.error=originalError;}
assert.deepEqual(diagnosticMessages,[
 ['Safe Places auth diagnostic oauth_state/state_cookie_rejected'],
 ['Safe Places auth diagnostic oauth_token/invalid_client'],
 ['Safe Places auth diagnostic authentication/unclassified_failure'],
 ['Safe Places auth diagnostic oauth_token/exchange_failed'],
 ['Safe Places auth diagnostic oauth_state/state_rejected'],
 ['Safe Places auth diagnostic auth_email/provider_configuration'],
 ['Safe Places auth diagnostic auth_email/provider_rate_limit'],
 ['Safe Places auth diagnostic auth_email/delivery_failed'],
 ['Safe Places auth diagnostic auth_email/delivery_failed'],
 ['Safe Places auth diagnostic auth_password/hash_unavailable']
]);
assert.ok(!JSON.stringify(diagnosticMessages).includes(sensitive));
console.log('PASS: auth logger emits fixed categories only; state, secrets, provider bodies, arbitrary messages and getters are not logged');

const require=createRequire(import.meta.url);
const requireWrangler=createRequire(require.resolve('wrangler/package.json'));
const requireAuth=createRequire(require.resolve('better-auth'));
const {Miniflare}=requireWrangler('miniflare');
const {createEndpoint,createRouter,serializeSignedCookie}=requireAuth('better-call');
const safeAuthError=createAuthErrorHandler(isAPIError,()=>new APIError('INTERNAL_SERVER_ERROR'));
const unexpectedError=Object.assign(new Error(sensitive),{query:sensitive,parameters:[sensitive],cause:{client_secret:sensitive}});
const expectedError=new APIError('FORBIDDEN',{code:'LOCAL_FIXTURE_DENIED',message:'Forbidden fixture'});
const expectedBody={code:'LOCAL_FIXTURE_DENIED',message:'Forbidden fixture'};
const errorRouter=createRouter({
 unexpected:createEndpoint('/unexpected',{method:'GET'},async()=>{throw unexpectedError;}),
 expected:createEndpoint('/expected',{method:'GET'},async()=>{throw expectedError;})
},{openapi:{disabled:true},onError:safeAuthError});
const boundaryLogs=[];
try{
 console.warn=console.error=(...args)=>boundaryLogs.push(args);
 assert.equal(safeAuthError(expectedError),undefined,'Expected APIError values must pass back to the library unchanged');
 const expectedResponse=await errorRouter.handler(new Request('https://auth-error-fixture.example/expected'));
 assert.equal(expectedResponse.status,403);assert.deepEqual(await expectedResponse.json(),expectedBody);
 const unexpectedResponse=await errorRouter.handler(new Request('https://auth-error-fixture.example/unexpected'));
 assert.equal(unexpectedResponse.status,500);assert.equal(await unexpectedResponse.text(),'');
}finally{console.warn=originalWarn;console.error=originalError;}
assert.deepEqual(boundaryLogs,[['Safe Places auth diagnostic authentication/unexpected_error']],'Better Call must not log its raw unexpected-error fallback');
assert.ok(!JSON.stringify(boundaryLogs).includes(sensitive));
console.log('PASS: expected auth API statuses preserved; unexpected exceptions return a sanitized 500 without either library logging the raw exception');
const origin='https://safeplaces-preview.pages.dev';
const secret=randomBytes(48).toString('base64url');
const googleClientId='safeplaces-local-regression.apps.googleusercontent.com';
const googleClientSecret='local-regression-only-never-valid-at-google';
const people={
 owner:{id:randomUUID(),email:'owner@safeplaces-auth-test.example',verified:1},
 staff:{id:randomUUID(),email:'staff@safeplaces-auth-test.example',verified:1},
 customer:{id:randomUUID(),email:'customer@safeplaces-auth-test.example',verified:1},
 unverified:{id:randomUUID(),email:'unverified@safeplaces-auth-test.example',verified:0}
};
const serverRoot=resolve('dist/server');
const modulePaths=['index.js',...readdirSync(serverRoot,{recursive:true}).filter(path=>path.endsWith('.js')&&path!=='index.js')];
let outboundCalls=0;
const tokenFixtures=new Map(),mockFailures=[];
const {privateKey:fixtureSigningKey}=generateKeyPairSync('rsa',{modulusLength:2048});
function fixtureIdToken(identity){
 const now=Math.floor(Date.now()/1000);
 const payload={iss:'https://accounts.google.com',aud:googleClientId,sub:identity.subject,email:identity.email,email_verified:true,name:'Local callback customer',iat:now,exp:now+3600};
 const encoded=Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT',kid:'local-auth-regression'})).toString('base64url')+'.'+Buffer.from(JSON.stringify(payload)).toString('base64url');
 return encoded+'.'+sign('RSA-SHA256',Buffer.from(encoded),fixtureSigningKey).toString('base64url');
}
const mf=new Miniflare({
 name:'safeplaces-auth-regression',modulesRoot:serverRoot,
 modules:modulePaths.map(path=>({type:'ESModule',path:resolve(serverRoot,path)})),
 compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],
 d1Databases:{DB:'auth-regression-db'},r2Buckets:['BUCKET'],
 bindings:{
  SITE_PUBLIC:'true',SITE_INDEXABLE:'false',SITE_DEMO_PRICES:'true',
  ADMIN_BOOTSTRAP_PRIVATE:'true',STANDALONE_AUTH_ENABLED:'true',
  BETTER_AUTH_SECRET:secret,BETTER_AUTH_URL:origin,
  GOOGLE_CLIENT_ID:googleClientId,GOOGLE_CLIENT_SECRET:googleClientSecret,
  STANDALONE_ADMIN_USER_ID:people.owner.id,STANDALONE_ADMIN_EMAIL:people.owner.email
 },
 outboundService:async request=>{
  outboundCalls++;
  const deny=code=>{mockFailures.push(code);return Response.json({error:'invalid_request'},{status:400});};
  if(request.url!=='https://oauth2.googleapis.com/token'||request.method!=='POST')return deny('unexpected_external_request');
  const body=new URLSearchParams(await request.text()),fixture=tokenFixtures.get(body.get('code'));
  if(!fixture||fixture.used)return deny('unregistered_or_replayed_code');
  if(body.get('grant_type')!=='authorization_code'||body.get('redirect_uri')!==origin+'/api/auth/callback/google')return deny('invalid_exchange_target');
  if(body.get('client_id')!==googleClientId||body.get('client_secret')!==googleClientSecret)return deny('incorrect_fixture_credentials');
  const verifier=body.get('code_verifier')||'';
  if(!verifier||createHash('sha256').update(verifier).digest('base64url')!==fixture.challenge)return deny('pkce_verifier_mismatch');
  fixture.used=true;
  if(fixture.error)return Response.json({error:fixture.error,error_description:sensitive},{status:401});
  return Response.json({access_token:'local-access-token-'+randomUUID(),token_type:'Bearer',expires_in:3600,scope:'openid email profile',id_token:fixtureIdToken(fixture.identity)});
 },
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
 async function session(person,expiresAt=Date.now()+3600000,method='google'){
  const token=randomBytes(32).toString('base64url');
  await db.prepare('INSERT INTO auth_session (id,user_id,token,expires_at,created_at,updated_at,auth_method) VALUES (?,?,?,?,?,?,?)')
   .bind(randomUUID(),person.id,token,expiresAt,Date.now(),Date.now(),method).run();
  const signed=await serializeSignedCookie('__Secure-better-auth.session_token',token,secret,{httpOnly:true,secure:true,sameSite:'lax',path:'/'});
  return signed.split(';',1)[0];
 }
 const cookies={owner:await session(people.owner),staff:await session(people.staff),customer:await session(people.customer),unverified:await session(people.unverified)};
 const send=(path,body,cookie='',headers={})=>gateway.fetch(new Request(origin+path,{
  method:body===undefined?'GET':'POST',redirect:'manual',
  headers:{...(cookie?{Cookie:cookie}:{}),...(body===undefined?{}:{Origin:origin,'Content-Type':'application/json'}),...headers},
  ...(body===undefined?{}:{body:JSON.stringify(body)})
 }),{STAGING:{fetch:async request=>mf.dispatchFetch(request.url,{
  method:request.method,headers:Object.fromEntries(request.headers),redirect:request.redirect,
  ...(!['GET','HEAD'].includes(request.method)?{body:await request.arrayBuffer()}:{})
 })}});
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
 assert.equal(authSession.session.authMethod,'google');
 const passwordOwnerCookie=await session(people.owner,Date.now()+3600000,'password');
 const unknownOwnerCookie=await session(people.owner,Date.now()+3600000,'unknown');
 await json('/api/admin/data',undefined,passwordOwnerCookie,403);
 await json('/api/admin/data',undefined,unknownOwnerCookie,403);
 const passwordOwnerSession=await json('/api/session',undefined,passwordOwnerCookie);
 assert.equal(passwordOwnerSession.user.userId,'customer:'+people.owner.id,'A verified password session retains ordinary customer access');
 assert.equal(passwordOwnerSession.admin,false,'A matching owner UUID and email never elevate a password session');
 await json('/api/auth/update-session',{authMethod:'google'},passwordOwnerCookie,404);
 assert.equal((await json('/api/auth/get-session',undefined,passwordOwnerCookie)).session.authMethod,'password','Public session input cannot upgrade the authentication method');

 // A valid customer session denied management is not an anonymous sign-in.
 // Exercise the actual page guard and SSR output without weakening API access.
 for(const lang of ['ar','en']){
  const adminPath='/'+lang+'/admin';
  for(const cookie of ['',cookies.unverified]){
   const response=await send(adminPath,undefined,cookie),html=await response.text();
   assert.equal(response.status,200);
   assert.ok(html.includes('class="admin-entry"'));
   assert.ok(!html.includes('class="admin-entry-account"'),'Anonymous or unverified sessions must not be presented as verified customers');
   assert.ok(!html.includes('class="management-console"'));
  }
  for(const [cookie,person] of [[cookies.customer,people.customer],[passwordOwnerCookie,people.owner],[unknownOwnerCookie,people.owner]]){
   const response=await send(adminPath,undefined,cookie),html=await response.text();
   assert.equal(response.status,200);
   assert.match(response.headers.get('cache-control')||'',/no-store/,'A page showing the current account must not be cached');
   assert.ok(html.includes('data-admin-entry-state="access-denied"'),'A signed-in session lacking management access must receive an explicit denied state');
   assert.ok(html.includes('class="admin-entry-account"')&&html.includes(person.email),'Show only the current verified customer account');
   assert.ok(html.includes('class="admin-entry-account-reference"')&&html.includes('customer:'+person.id),'The collapsed support reference must identify exactly the current verified customer');
   assert.ok(!/<details[^>]*class="admin-entry-account-reference"[^>]*\bopen(?:[=>\s])/.test(html),'The account reference should be collapsed initially');
   if(person===people.customer){
    assert.ok(!html.includes(people.owner.email),'Never disclose the configured owner email to another customer');
    assert.ok(!html.includes(people.owner.id),'Never disclose the configured owner UUID to another customer');
   }
   assert.ok(html.includes(lang==='ar'?'تسجيل دخولك ناجح، لكن الجلسة الحالية':'You are signed in, but this session cannot access management.'));
   assert.ok(html.includes('return_to='+encodeURIComponent(adminPath)+'&amp;reason=admin'),'Choosing the approved Google account must retain the management return target');
   assert.ok(html.includes('href="/'+lang+'/account"'),'The customer can return to their working account');
   assert.ok(!html.includes('class="management-console"'),'A customer or password/unknown owner session must never render management data');
   await json('/api/admin/data',undefined,cookie,403);
  }
  const ownerPage=await send(adminPath,undefined,cookies.owner),ownerHtml=await ownerPage.text();
  assert.equal(ownerPage.status,200);
  assert.ok(ownerHtml.includes('class="management-console"'),'The configured owner with a Google session must still open management');
  assert.ok(!ownerHtml.includes('data-admin-entry-state="access-denied"'));
 }
 console.log('PASS: bilingual management entry distinguishes signed-in denied sessions and preserves Google-only administration');

 const forged=cookies.owner.slice(0,-8)+'tampered';
 await json('/api/admin/data',undefined,forged,403);
 const expired=await session(people.owner,Date.now()-60000);
 await json('/api/admin/data',undefined,expired,403);
 await db.prepare('UPDATE auth_user SET email=? WHERE id=?').bind('changed-owner@safeplaces-auth-test.example',people.owner.id).run();
 await json('/api/admin/data',undefined,cookies.owner,403);
 await db.prepare('UPDATE auth_user SET email=? WHERE id=?').bind(people.owner.email,people.owner.id).run();
 console.log('PASS: verified DB sessions, owner ID plus email, forged/expired cookies and public-header impersonation');

 // Simulate an existing remembered session that is due for renewal. Exercise
 // the real built Worker and D1 through the Pages gateway, not policy stubs.
 const day=24*60*60*1000,agedAt=Date.now()-6*day,agedExpiry=agedAt+7*day;
 const agedCookie=await session(people.owner,agedExpiry);
 const agedRow=await db.prepare('SELECT id FROM auth_session WHERE user_id=? AND expires_at=?').bind(people.owner.id,agedExpiry).first();
 assert.ok(agedRow,'The isolated renewal fixture must exist');
 await db.prepare('UPDATE auth_session SET created_at=?,updated_at=? WHERE id=?').bind(agedAt,agedAt,agedRow.id).run();
 const renewalState=()=>db.prepare('SELECT expires_at,updated_at,auth_method FROM auth_session WHERE id=?').bind(agedRow.id).first();
 const beforeRenewal=await renewalState();
 const accountPage=await send('/ar/account',undefined,agedCookie);
 assert.equal(accountPage.status,200);
 assert.ok((await accountPage.text()).includes('customer-route-section'),'The SSR account page must authenticate the aged session');
 assert.ok(!accountPage.headers.getSetCookie().some(value=>value.startsWith('__Secure-better-auth.session_token=')),'An internal SSR read must not consume cookie renewal');
 assert.deepEqual(await renewalState(),beforeRenewal,'SSR must not extend database expiry without delivering the renewed browser cookie');
 await json('/api/admin/data',undefined,agedCookie);
 assert.deepEqual(await renewalState(),beforeRenewal,'Internal authorization must not consume cookie renewal');
 const renewal=await send('/api/session?scope=customer',undefined,agedCookie);
 assert.equal(renewal.status,200);
 assert.match(renewal.headers.get('cache-control')||'',/no-store/);
 const renewalBody=await renewal.json();
 assert.ok(renewalBody.user?.userId==='customer:'+people.owner.id,'Renewal must retain the verified customer identity');
 const renewedCookies=renewal.headers.getSetCookie().filter(value=>value.startsWith('__Secure-better-auth.session_token='));
 assert.equal(renewedCookies.length,1,'The HTTP session endpoint must deliver exactly one renewed session cookie');
 assert.ok(/HttpOnly/i.test(renewedCookies[0])&&/Secure/i.test(renewedCookies[0])&&/SameSite=Lax/i.test(renewedCookies[0]),'Renewal preserves secure cookie attributes');
 assert.ok(!/Domain=/i.test(renewedCookies[0])&&/Max-Age=[1-9]\d*/i.test(renewedCookies[0]),'Renewal stays host-only and extends browser expiry');
 assert.ok(renewedCookies[0].split(';',1)[0]===agedCookie,'Renewal retains the existing signed session token');
 const afterRenewal=await renewalState();
 assert.ok(afterRenewal.expires_at>beforeRenewal.expires_at&&afterRenewal.updated_at>beforeRenewal.updated_at,'Database and browser session expiry must advance together');
 assert.equal(afterRenewal.auth_method,'google');
 await db.prepare('DELETE FROM auth_session WHERE id=?').bind(agedRow.id).run();
 const revokedRenewal=await json('/api/session',undefined,agedCookie);
 assert.equal(revokedRenewal.user,null);assert.equal(revokedRenewal.admin,false);
 assert.equal(await renewalState(),null,'A revoked renewed session must not be recreated');
 console.log('PASS: aged SSR/admin reads preserve expiry; HTTP session renewal delivers secure cookies; revoked sessions remain denied');

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
 const passwordStaffCookie=await session(people.staff,Date.now()+3600000,'password');
 await json('/api/admin/data',undefined,passwordStaffCookie,403);
 assert.equal((await db.prepare('SELECT auth_user_id FROM admin_members WHERE id=?').bind(invitation.id).first()).auth_user_id,null,'A password session must not claim a pending Google staff invitation');
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
 assert.equal(outboundCalls,0,'Session and administrative checks must not request any provider exchange');
 console.log('PASS: Google-only routes, OAuth origin/PKCE/state controls, secure cookies and actual sign-out revocation');

 // Exercise the complete application/gateway callback path. Only synthetic
 // authorization codes explicitly registered here can reach the local mock.
 const callbackIdentity={subject:'local-callback-'+randomUUID(),email:'callback-customer@safeplaces-auth-test.example'};
 const counts=()=>db.prepare('SELECT (SELECT COUNT(*) FROM auth_user) AS users,(SELECT COUNT(*) FROM auth_session) AS sessions,(SELECT COUNT(*) FROM auth_account) AS accounts').first();
 const initialCounts=await counts();
 async function beginFlow(error){
  const response=await send('/api/auth/sign-in/social',{
   provider:'google',callbackURL:'/ar/account',newUserCallbackURL:'/ar/account',
   errorCallbackURL:'/ar/account/login?return_to=%2Far%2Faccount&reason=account',disableRedirect:true
  });
  assert.equal(response.status,200,'The application must initiate the synthetic OAuth flow');
  const url=new URL((await response.json()).url);
  assert.equal(url.origin,'https://accounts.google.com');
  assert.equal(url.searchParams.get('redirect_uri'),origin+'/api/auth/callback/google');
  assert.equal(url.searchParams.get('client_id'),googleClientId);
  assert.equal(url.searchParams.get('code_challenge_method'),'S256');
  const state=url.searchParams.get('state'),challenge=url.searchParams.get('code_challenge');
  assert.ok(state&&challenge,'Fresh OAuth state and PKCE challenge are required');
  const stateCookieHeaders=response.headers.getSetCookie().filter(value=>value.startsWith('__Secure-better-auth.state='));
  assert.equal(stateCookieHeaders.length,1,'The Pages gateway must preserve the OAuth state cookie');
  const stateCookie=stateCookieHeaders[0];
  assert.match(stateCookie,/HttpOnly/i);assert.match(stateCookie,/Secure/i);assert.match(stateCookie,/SameSite=Lax/i);
  assert.doesNotMatch(stateCookie,/Domain=/i);
  const code='local-callback-code-'+randomUUID();
  tokenFixtures.set(code,{challenge,identity:callbackIdentity,error,used:false});
  return {state,code,cookie:stateCookie.split(';',1)[0]};
 }
 const callbackPath=flow=>'/api/auth/callback/google?'+new URLSearchParams({state:flow.state,code:flow.code});
 const flowRecord=flow=>db.prepare('SELECT id,value,expires_at FROM auth_verification WHERE identifier=?').bind('auth-state:'+flow.state).first();
 function callbackLocation(response){
  assert.ok([302,303].includes(response.status),'OAuth completion must produce a redirect');
  assert.match(response.headers.get('cache-control')||'',/no-store/);
  assert.equal(response.headers.get('referrer-policy'),'no-referrer');
  assert.ok(response.headers.get('location'),'An OAuth redirect destination is required');
  const url=new URL(response.headers.get('location'),origin);
  assert.equal(url.origin,origin,'Every callback result remains on the protected canonical host');
  return url;
 }
 async function denyCallback(flow,cookie,expectedError,expectedCounts,expectedCalls){
  const response=await send(callbackPath(flow),undefined,cookie);
  const url=callbackLocation(response);
  assert.equal(url.searchParams.get('error'),expectedError);
  assert.ok(!response.headers.getSetCookie().some(value=>value.startsWith('__Secure-better-auth.session_token=')&&!/Max-Age=0/i.test(value)),'A denied callback must not issue a login cookie');
  assert.deepEqual(await counts(),expectedCounts,'A denied callback must not create a user, account or session');
  assert.equal(outboundCalls,expectedCalls,'A failed state check must not exchange an authorization code');
  await response.body?.cancel();
  return url;
 }

 const validFlow=await beginFlow();
 await denyCallback(validFlow,'','state_mismatch',initialCounts,0);
 assert.ok(await flowRecord(validFlow),'A missing browser cookie must not consume a valid pending flow');
 const differentBrowserFlow=await beginFlow();
 await denyCallback(validFlow,differentBrowserFlow.cookie,'state_mismatch',initialCounts,0);
 assert.ok(await flowRecord(validFlow),'A mismatched browser cookie must not consume a valid pending flow');
 const success=await send(callbackPath(validFlow),undefined,validFlow.cookie);
 assert.equal(callbackLocation(success).pathname,'/ar/account');
 const sessionHeaders=success.headers.getSetCookie().filter(value=>value.startsWith('__Secure-better-auth.session_token='));
 assert.equal(sessionHeaders.length,1,'The successful callback preserves its session cookie through the Pages gateway');
 assert.match(sessionHeaders[0],/HttpOnly/i);assert.match(sessionHeaders[0],/Secure/i);assert.match(sessionHeaders[0],/SameSite=Lax/i);
 assert.doesNotMatch(sessionHeaders[0],/Domain=/i);
 const callbackCookie=sessionHeaders[0].split(';',1)[0];
 await success.body?.cancel();
 assert.equal(outboundCalls,1,'Exactly one local token exchange completed');
 assert.equal(await flowRecord(validFlow),null,'A completed flow is consumed');
 const createdUser=await db.prepare('SELECT id,email,email_verified FROM auth_user WHERE email=?').bind(callbackIdentity.email).first();
 assert.ok(createdUser);assert.equal(createdUser.email_verified,1);
 const createdAccount=await db.prepare('SELECT provider_id,account_id,user_id FROM auth_account WHERE user_id=?').bind(createdUser.id).first();
 assert.deepEqual(createdAccount,{provider_id:'google',account_id:callbackIdentity.subject,user_id:createdUser.id});
 const loggedIn=await json('/api/session',undefined,callbackCookie);
 assert.equal(loggedIn.user.provider,'standalone');assert.equal(loggedIn.user.userId,'customer:'+createdUser.id);
 assert.equal(loggedIn.user.email,callbackIdentity.email);assert.equal(loggedIn.admin,false,'Google signup alone must never grant administration access');
 await json('/api/admin/data',undefined,callbackCookie,403);
 const callbackSession=await json('/api/auth/get-session',undefined,callbackCookie);
 assert.equal(callbackSession.user.id,createdUser.id,'The callback must create a real signed Better Auth DB session');
 assert.equal(callbackSession.session.authMethod,'google','The real pinned callback context must produce a Google session method');
 const persistedMethod=await db.prepare('SELECT auth_method FROM auth_session WHERE id=?').bind(callbackSession.session.id).first();
 assert.equal(persistedMethod.auth_method,'google','The server-only method is persisted in the mapped D1 column');
 const afterSuccess=await counts();
 assert.deepEqual(afterSuccess,{users:initialCounts.users+1,sessions:initialCounts.sessions+1,accounts:initialCounts.accounts+1});
 console.log('PASS: synthetic Google callback through Pages gateway, PKCE exchange, persisted verified identity, secure session and ordinary-user permissions');

 await denyCallback(validFlow,validFlow.cookie,'state_mismatch',afterSuccess,1);
 const expiredFlow=await beginFlow(),expiredRecord=await flowRecord(expiredFlow);
 assert.ok(expiredRecord);
 const expiredValue=JSON.parse(expiredRecord.value);expiredValue.expiresAt=Date.now()-60000;
 await db.prepare('UPDATE auth_verification SET value=?,expires_at=? WHERE id=?').bind(JSON.stringify(expiredValue),expiredValue.expiresAt,expiredRecord.id).run();
 await denyCallback(expiredFlow,expiredFlow.cookie,'state_mismatch',afterSuccess,1);
 const invalidClientFlow=await beginFlow('invalid_client');
 const invalidClientResult=await denyCallback(invalidClientFlow,invalidClientFlow.cookie,'invalid_code',afterSuccess,2);
 assert.equal(invalidClientResult.pathname,'/ar/account/login');
 assert.equal(invalidClientResult.searchParams.get('return_to'),'/ar/account');
 assert.equal(invalidClientResult.searchParams.get('error_description'),null,'Raw Google diagnostics must not be exposed by the callback redirect');
 assert.equal(await flowRecord(invalidClientFlow),null,'Client authentication failed after successful state verification');
 assert.deepEqual(mockFailures,[],'Every intercepted exchange must use the exact fixture target, credentials and PKCE verifier');
 assert.equal([...tokenFixtures.values()].filter(fixture=>fixture.used).length,2);
 console.log('PASS: missing/mismatched cookies, expired state and replay denied; invalid_client remains a token-exchange error; all provider requests intercepted locally');
 console.log('PASS: authentication and administrative security regression completed with local fixtures only');
}finally{await mf.dispose();}

