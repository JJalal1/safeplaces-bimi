import {createHash,createHmac,generateKeyPairSync,randomBytes,randomUUID,sign} from 'node:crypto';
import {existsSync,readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
import {join,resolve} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';

// Local fixtures only. All application Workers use the built production code,
// the same temporary D1/R2 resources and the real internal password Durable
// Object. Every outbound request is intercepted; no real email or Google call
// can leave this test. Private fixture values are never printed or saved.
const require=createRequire(import.meta.url);
const {Miniflare,Log,LogLevel}=createRequire(require.resolve('wrangler/package.json'))('miniflare');
const origin='https://safeplaces-email-test.example';
const googleDispatchPrefix='/__local_google_fixture__';
const authSecret=randomBytes(48).toString('base64url');
const resendKey='local-resend-'+randomUUID();
const alice={email:'alice@safeplaces-auth.example.test',name:'Local customer Alice',password:'Local first passphrase '+randomUUID()};
const bob={email:'bob@safeplaces-auth.example.test',name:'Local customer Bob',password:'Local second passphrase '+randomUUID()};
const fakeOwnerId=randomUUID();
const messages=[],mockFailures=[];
const googleClientId='local-google-link-fixture.apps.googleusercontent.com',googleClientSecret='local-google-link-'+randomUUID();
const googleFixtures=new Map(),{privateKey:googleSigningKey}=generateKeyPairSync('rsa',{modulusLength:2048});
let outboundAttempts=0,signInSequence=0,googleSequence=0,phase='setup',failureCode='',mf,peer,db,bucket;
function check(condition,code){if(!condition){failureCode=code;throw new Error('LOCAL_AUTH_ASSERTION_FAILED');}}
function pass(name){console.log('PASS: '+name);}
function exceptionCategory(error){
 const own=(value,key)=>{try{const field=value&&typeof value==='object'?Object.getOwnPropertyDescriptor(value,key):null;return field&&'value' in field?field.value:undefined;}catch{return undefined;}};
 const codes=new Map([
  ['UND_ERR_REQ_CONTENT_LENGTH_MISMATCH','local_request_length_mismatch'],
  ['UND_ERR_RES_CONTENT_LENGTH_MISMATCH','local_response_length_mismatch'],
  ['UND_ERR_SOCKET','local_socket_failure'],['ECONNRESET','local_connection_reset'],
  ['EPIPE','local_pipe_failure'],['ERR_RUNTIME_FAILURE','local_worker_runtime_failure']
 ]);
 const code=own(error,'code')||own(own(error,'cause'),'code');
 if(codes.has(code))return codes.get(code);
 if(error instanceof TypeError)return 'local_type_error';
 if(error instanceof SyntaxError)return 'local_syntax_error';
 return 'unexpected_local_runtime_failure';
}
class FixtureLog extends Log{
 constructor(){super(LogLevel.ERROR);}
 error(){console.error('Local authentication fixture runtime error');}
 warn(){}
 info(){}
 debug(){}
 verbose(){}
}
async function outbound(request){
 outboundAttempts++;
 const deny=code=>{mockFailures.push(code);return Response.json({error:'LOCAL_MOCK_DENIED'},{status:400});};
 if(request.url==='https://oauth2.googleapis.com/token'&&request.method==='POST'){
  const body=new URLSearchParams(await request.text()),fixture=googleFixtures.get(body.get('code'));
  if(!fixture||fixture.used)return deny('unregistered_or_replayed_google_code');
  if(body.get('grant_type')!=='authorization_code'||body.get('redirect_uri')!==origin+'/api/auth/callback/google')return deny('invalid_google_exchange_target');
  if(body.get('client_id')!==googleClientId||body.get('client_secret')!==googleClientSecret)return deny('invalid_google_fixture_credentials');
  const verifier=body.get('code_verifier')||'';
  if(!verifier||createHash('sha256').update(verifier).digest('base64url')!==fixture.challenge)return deny('google_pkce_verifier_mismatch');
  fixture.used=true;
  const now=Math.floor(Date.now()/1000),identity=fixture.identity;
  const payload={iss:'https://accounts.google.com',aud:googleClientId,sub:identity.subject,email:identity.email,email_verified:identity.verified!==false,name:'Local linking fixture',iat:now,exp:now+3600};
  const encoded=Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT',kid:'local-linking-fixture'})).toString('base64url')+'.'+Buffer.from(JSON.stringify(payload)).toString('base64url');
  const idToken=encoded+'.'+sign('RSA-SHA256',Buffer.from(encoded),googleSigningKey).toString('base64url');
  return Response.json({access_token:'local-google-token-'+randomUUID(),token_type:'Bearer',expires_in:3600,scope:'openid email profile',id_token:idToken});
 }
 if(request.url!=='https://api.resend.com/emails'||request.method!=='POST')return deny('unexpected_external_request');
 if(request.headers.get('authorization')!=='Bearer '+resendKey)return deny('incorrect_fixture_mail_credential');
 let input;try{input=await request.json();}catch{return deny('invalid_mail_body');}
 if(input.from!=='Safe Places <info@safeplaces.sa>'||!Array.isArray(input.to)||input.to.length!==1||![alice.email,bob.email].includes(input.to[0]))return deny('unapproved_fixture_recipient');
 const links=String(input.text||'').match(/https?:\/\/[^\s]+/g)||[];
 if(links.length!==1)return deny('invalid_mail_link_count');
 let link;try{link=new URL(links[0]);}catch{return deny('invalid_mail_link');}
 if(link.origin!==origin||link.username||link.password||link.hash)return deny('nonlocal_mail_link');
 const purpose=link.pathname==='/api/auth/verify-email'?'verify':/^\/api\/auth\/reset-password\/[A-Za-z0-9_-]+$/.test(link.pathname)?'reset':null;
 if(!purpose)return deny('unexpected_mail_purpose');
 messages.push({recipient:input.to[0],purpose,url:link.href});
 return Response.json({id:'local-message-'+randomUUID()});
}
async function send(path,{body,raw,stream=false,cookie='',ip='192.0.2.10',worker=0,headers={}}={}){
 const method=body===undefined&&raw===undefined?'GET':'POST';
 const h=new Headers({'cf-connecting-ip':ip});
 if(cookie)h.set('cookie',cookie);
 if(method==='POST'){h.set('origin',origin);h.set('content-type','application/json');}
 for(const [name,value] of Object.entries(headers))h.set(name,value);
 let payload=raw??(body===undefined?undefined:JSON.stringify(body));
 if(stream){
  check(method==='POST'&&!h.has('content-length'),'stream_fixture_has_no_content_length');
  const bytes=new TextEncoder().encode(payload);
  payload=new ReadableStream({start(controller){controller.enqueue(bytes.subarray(0,8192));controller.enqueue(bytes.subarray(8192));controller.close();}});
 }
 const options={method,redirect:'manual',headers:h,...(method==='POST'?{body:payload,...(stream?{duplex:'half'}:{})}:{})};
 const target=new URL(path,origin);
 if(worker===2){target.pathname=googleDispatchPrefix+target.pathname;return mf.dispatchFetch(target.href,options);}
 return worker?peer.fetch(target.href,options):mf.dispatchFetch(target.href,options);
}
async function reply(path,options={},status=200){
 const response=await send(path,options);
 if(response.status!==status){
  let category='unclassified_response';
  try{
   const data=await response.clone().json(),code=data?.code||data?.error;
   if(['RATE_LIMIT','INVALID_ORIGIN','INVALID_REQUEST','INVALID_EMAIL','INVALID_NAME','AUTH_UNAVAILABLE','AUTH_NOT_CONFIGURED','EMAIL_PASSWORD_DISABLED','EMAIL_NOT_VERIFIED','INVALID_EMAIL_OR_PASSWORD','INVALID_TOKEN'].includes(code))category=code;
  }catch{category='non_json_response';}
  check(false,'expected_http_status_'+status+'_received_'+response.status+'_'+category);
 }
 check(/no-store/.test(response.headers.get('cache-control')||''),'private_response_not_cached');
 return response;
}
async function json(path,options={},status=200){
 const response=await reply(path,options,status);
 let data;try{data=await response.json();}catch{check(false,'expected_json_response');}
 return {response,data};
}
function hasLoginCookie(response){return response.headers.getSetCookie().some(value=>/^__Secure-better-auth\.session_token=/.test(value)&&!/Max-Age=0(?:;|$)/i.test(value));}
function sessionCookie(response){
 const values=response.headers.getSetCookie().filter(value=>/^__Secure-better-auth\.session_token=/.test(value)&&!/Max-Age=0(?:;|$)/i.test(value));
 check(values.length===1,'exactly_one_login_cookie');
 const value=values[0];
 check(/;\s*HttpOnly(?:;|$)/i.test(value)&&/;\s*Secure(?:;|$)/i.test(value)&&/;\s*SameSite=Lax(?:;|$)/i.test(value),'secure_session_cookie_attributes');
 check(!/;\s*Domain=/i.test(value),'host_only_session_cookie');
 return value.split(';',1)[0];
}
async function mail(person,purpose,index=0){
 const deadline=Date.now()+15000;
 while(Date.now()<deadline){
  const matches=messages.filter(item=>item.recipient===person.email&&item.purpose===purpose);
  if(matches[index])return new URL(matches[index].url);
  await delay(30);
 }
 check(false,'expected_local_mail_callback');
}
async function register(person,extra={}){
 const result=await json('/api/auth/sign-up/email',{body:{name:person.name,email:person.email,password:person.password,callbackURL:'/en/account/login?verified=1',...extra},ip:person===alice?'192.0.2.11':'192.0.2.12'});
 check(result.data.token===null&&result.data.user?.emailVerified===false,'registration_requires_verification');
 check(!hasLoginCookie(result.response),'registration_does_not_sign_in');
 person.id=(await db.prepare('SELECT id FROM auth_user WHERE email=?').bind(person.email).first())?.id;
 check(typeof person.id==='string'&&person.id!==fakeOwnerId,'server_generates_customer_identity');
 return result;
}
async function verifyWithRedirect(person){
 const link=await mail(person,'verify'),response=await send(link.href);
 check([302,303].includes(response.status),'verification_redirect');
 const target=new URL(response.headers.get('location'),origin);
 check(target.origin===origin&&target.pathname==='/en/account/login','verification_return_stays_internal');
 check(!hasLoginCookie(response),'verification_does_not_create_session');
 await response.body?.cancel();
 const row=await db.prepare('SELECT email_verified FROM auth_user WHERE id=?').bind(person.id).first();
 check(row?.email_verified===1,'verification_is_persisted_in_database');
 check((await db.prepare('SELECT COUNT(*) AS n FROM auth_session WHERE user_id=?').bind(person.id).first()).n===0,'verification_creates_no_database_session');
}
async function signIn(person,password=person.password,extra={}){
 // Separate valid-login fixtures from the library's additional 3/10s burst
 // limiter. The deliberate shared-IP security checks below keep fixed IPs.
 const result=await json('/api/auth/sign-in/email',{body:{email:person.email,password,rememberMe:true,callbackURL:'/en/account',...extra},ip:'192.0.2.'+(60+(++signInSequence))});
 const cookie=sessionCookie(result.response),session=(await json('/api/auth/get-session',{cookie})).data;
 check(session?.user?.id===person.id&&session?.session?.authMethod==='password','successful_endpoint_sets_password_method');
 const stored=await db.prepare('SELECT user_id,auth_method FROM auth_session WHERE id=?').bind(session.session.id).first();
 check(stored?.user_id===person.id&&stored?.auth_method==='password','password_method_persists_in_mapped_column');
 return {cookie,sessionId:session.session.id};
}
function quoteBody(email,extra={}){return {name:'Local quote customer',email,phone:'+966500000000',description:'Local quotation ownership fixture only.',token:randomUUID(),key:randomUUID(),...extra};}
async function file(owner){
 const id=randomUUID(),key='local-auth-fixture/'+id,content='Local private quotation attachment.';
 await bucket.put(key,content,{httpMetadata:{contentType:'application/pdf'}});
 await db.prepare('INSERT INTO files (id,owner_id,name,mime,size,object_key,is_public,created_at) VALUES (?,?,?,?,?,?,0,?)').bind(id,owner,'local-quote.pdf','application/pdf',content.length,key,new Date().toISOString()).run();
 return {id,content};
}
function rateKey(scope,value,seconds){
 const window=Math.floor(Date.now()/(seconds*1000));
 return 'auth-policy:'+scope+':'+window+':'+createHmac('sha256',authSecret).update(scope+'\0'+window+'\0'+value).digest('hex');
}
async function errorCode(path,options,status,expected){
 const result=await json(path,options,status);
 check((result.data?.code||result.data?.error)===expected,'expected_safe_api_error_code');
 return result;
}

try{
 const serverRoot=resolve('dist/server');
 check(existsSync(join(serverRoot,'index.js')),'built_worker_required');
 const paths=['index.js',...readdirSync(serverRoot,{recursive:true}).filter(path=>path.endsWith('.js')&&path!=='index.js')];
 const modules=paths.map(path=>({type:'ESModule',path:join(serverRoot,path)}));
 const common={modulesRoot:serverRoot,modules,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],
  d1Databases:{DB:'email-auth-shared-fixture'},r2Buckets:{BUCKET:'email-auth-shared-files'},
  durableObjects:{AUTH_PASSWORD_HASHER:{className:'PasswordHasher',scriptName:'email-auth-primary',useSQLite:true}},
  bindings:{SITE_PUBLIC:'true',SITE_INDEXABLE:'false',SITE_DEMO_PRICES:'false',PRODUCTION_LAUNCH_LOCKED:'false',
   STANDALONE_AUTH_ENABLED:'true',CUSTOMER_AUTH_ENABLED:'false',ADMIN_BOOTSTRAP_PRIVATE:'false',
   EMAIL_PASSWORD_ENABLED:'true',EMAIL_NOTIFICATIONS_ENABLED:'false',BETTER_AUTH_URL:origin,BETTER_AUTH_SECRET:authSecret,
   RESEND_API_KEY:resendKey,AUTH_EMAIL_FROM:'info@safeplaces.sa',STANDALONE_ADMIN_USER_ID:fakeOwnerId,STANDALONE_ADMIN_EMAIL:alice.email},outboundService:outbound};
 // getWorker().fetch uses Miniflare's protected /cdn-cgi proxy. Register the
 // exact fixture origin so that proxy accepts its POST Origin before forwarding
 // to the peer; the application's own origin and shared-D1 checks still run.
 // Dispatch Google tests through an ordinary routed fixture and a service
 // binding. getWorker().fetch would reject a hostile Origin at Miniflare's
 // /cdn-cgi proxy before the application could exercise its own HTTP boundary.
 // The bridge changes only the fixture path; request/response headers and body
 // pass through unchanged, so the application's no-store requirement is tested.
 const googleDispatch={name:'email-auth-google-dispatch',modules:true,compatibilityDate:'2026-05-15',
  routes:[origin+googleDispatchPrefix+'/*'],serviceBindings:{GOOGLE:'email-auth-google'},outboundService:outbound,
  script:`export default {fetch(request,env){const url=new URL(request.url);url.pathname=url.pathname.slice(${googleDispatchPrefix.length});return env.GOOGLE.fetch(new Request(url,request));}};`};
 mf=new Miniflare({workers:[{name:'email-auth-primary',...common,routes:[origin+'/*']},{name:'email-auth-peer',...common},{name:'email-auth-google',...common,bindings:{...common.bindings,GOOGLE_CLIENT_ID:googleClientId,GOOGLE_CLIENT_SECRET:googleClientSecret}},googleDispatch],d1Persist:false,r2Persist:false,durableObjectsPersist:false,cf:false,host:'127.0.0.1',port:0,log:new FixtureLog()});
 db=await mf.getD1Database('DB','email-auth-primary');bucket=await mf.getR2Bucket('BUCKET','email-auth-primary');peer=await mf.getWorker('email-auth-peer');
 for(const migration of readdirSync('drizzle').filter(name=>name.endsWith('.sql')).sort())
  for(const sql of readFileSync(join('drizzle',migration),'utf8').replace(/^\s*--.*$/gm,'').split(';').filter(sql=>sql.trim()))await db.prepare(sql).run();
 await db.prepare("INSERT INTO settings (key,value) VALUES ('catalog-ready','true'),('orderEnabled','false')").run();

 phase='email-only readiness and HTTP boundary';
 const readiness=(await json('/api/session')).data;
 check(readiness.authConfigured===true&&readiness.emailPasswordEnabled===true&&readiness.socialProviders?.length===0,'email_auth_works_without_google_configuration');
 await json('/api/auth/ok');
 const guarded={name:'Local guarded customer',email:'guarded@safeplaces-auth.example.test',password:alice.password,callbackURL:'/en/account/login'};
 phase='HTTP origin boundary';
 await reply('/api/auth/sign-up/email',{body:guarded,headers:{origin:'https://untrusted.example'}},403);
 phase='HTTP external callback boundary';
 await reply('/api/auth/sign-up/email',{body:{...guarded,callbackURL:'https://untrusted.example/return'},ip:'192.0.2.13'},403);
 await reply('/api/auth/request-password-reset',{body:{email:guarded.email,redirectTo:'https://untrusted.example/return'},ip:'192.0.2.14'},403);
 phase='HTTP streamed body boundary';
 // A false Content-Length makes Undici reject the fixture before the Worker.
 // Send a real body with unknown length so the Worker must enforce its byte cap.
 await reply('/api/auth/sign-up/email',{raw:JSON.stringify({...guarded,padding:'x'.repeat(25*1024)}),stream:true},413);
 check(outboundAttempts===0&&mockFailures.length===0,'rejected_requests_do_not_send_email');
 check((await db.prepare('SELECT COUNT(*) AS n FROM auth_user').first()).n===0,'invalid_requests_do_not_create_accounts');
 pass('email-only readiness; bad origin, external return targets and actual oversized bodies fail before mail');

 phase='registration identity and verification';
 const original=await register(alice,{id:fakeOwnerId,userId:fakeOwnerId,emailVerified:true,authMethod:'google',role:'owner'});
 await mail(alice,'verify');
 check((await db.prepare('SELECT email_verified FROM auth_user WHERE id=?').bind(alice.id).first()).email_verified===0,'public_body_cannot_verify_an_email');
 await errorCode('/api/auth/sign-in/email',{body:{email:alice.email,password:alice.password},ip:'192.0.2.21'},403,'EMAIL_NOT_VERIFIED');
 check((await json('/api/session?verified=1')).data.user===null,'query_flag_cannot_authenticate_customer');
 await reply('/api/account',{},401);
 const credential=await db.prepare("SELECT password FROM auth_account WHERE user_id=? AND provider_id='credential'").bind(alice.id).first();
 check(typeof credential?.password==='string'&&credential.password!==alice.password,'credential_password_is_hashed');
 const beforeDuplicate=outboundAttempts;
 const duplicate=await json('/api/auth/sign-up/email',{body:{name:'Local duplicate fixture',email:alice.email,password:bob.password,callbackURL:'/en/account/login'},ip:'192.0.2.15'});
 check(duplicate.data.token===null&&duplicate.data.user?.id!==alice.id&&duplicate.data.user?.emailVerified===false,'duplicate_registration_returns_opaque_success');
 check(JSON.stringify(Object.keys(duplicate.data).sort())===JSON.stringify(Object.keys(original.data).sort()),'duplicate_registration_response_shape_matches');
 check(!hasLoginCookie(duplicate.response)&&outboundAttempts===beforeDuplicate,'duplicate_registration_does_not_authenticate_or_send');
 check((await db.prepare("SELECT password FROM auth_account WHERE user_id=? AND provider_id='credential'").bind(alice.id).first()).password===credential.password,'duplicate_registration_cannot_replace_password');
 await verifyWithRedirect(alice);
 const aliceFirst=await signIn(alice,alice.password,{id:fakeOwnerId,userId:fakeOwnerId,authMethod:'google',role:'owner'});
 check((await json('/api/session',{cookie:aliceFirst.cookie})).data.admin===false,'password_session_has_no_admin_authority');
 await reply('/api/admin/data',{cookie:aliceFirst.cookie},403);
 await reply('/api/auth/update-session',{cookie:aliceFirst.cookie,body:{authMethod:'google'}},404);
 check((await json('/api/auth/get-session',{cookie:aliceFirst.cookie})).data.session.authMethod==='password','public_session_update_cannot_change_method');
 pass('opaque duplicate signup; server-owned identity and verification; no automatic verification session; secure password cookies and method');

 phase='customer quotation and private file ownership';
 const guest=quoteBody(bob.email),guestFile=await file('guest:'+guest.token);guest.files=[guestFile.id];
 await json('/api/quotes',{body:{...guest,userId:'customer:'+alice.id},ip:'192.0.2.31'});
 const guestRecord=await db.prepare('SELECT id,user_id FROM quotes WHERE idempotency_key=?').bind(guest.key).first();
 check(guestRecord?.user_id===null,'guest_cannot_supply_customer_identity');
 await register(bob);await verifyWithRedirect(bob);const bobSession=await signIn(bob);
 const aliceFile=await file('customer:'+alice.id),aliceQuote=quoteBody(alice.email,{files:[aliceFile.id]});
 await json('/api/quotes',{body:aliceQuote,cookie:aliceFirst.cookie,ip:'192.0.2.32'});
 const aliceRecord=await db.prepare('SELECT id,user_id FROM quotes WHERE idempotency_key=?').bind(aliceQuote.key).first();
 check(aliceRecord?.user_id==='customer:'+alice.id,'quote_ownership_comes_from_verified_session');
 const bobQuote=quoteBody(alice.email,{userId:'customer:'+alice.id});
 await json('/api/quotes',{body:bobQuote,cookie:bobSession.cookie,ip:'192.0.2.33'});
 const bobRecord=await db.prepare('SELECT id,user_id FROM quotes WHERE idempotency_key=?').bind(bobQuote.key).first();
 check(bobRecord?.user_id==='customer:'+bob.id,'contact_email_and_body_id_do_not_transfer_quote_ownership');
 const aliceAccount=(await json('/api/account',{cookie:aliceFirst.cookie})).data,bobAccount=(await json('/api/account',{cookie:bobSession.cookie})).data;
 check(aliceAccount.quotes.length===1&&aliceAccount.quotes[0].id===aliceRecord.id,'first_customer_sees_only_own_quotes');
 check(bobAccount.quotes.length===1&&bobAccount.quotes[0].id===bobRecord.id,'second_customer_does_not_claim_guest_or_other_email_quotes');
 const aliceDetail=(await json('/api/account/requests/quotes/'+aliceRecord.id,{cookie:aliceFirst.cookie})).data;
 check(aliceDetail.files.some(item=>item.id===aliceFile.id),'owner_can_list_private_quote_attachment');
 await reply('/api/account/requests/quotes/'+aliceRecord.id,{cookie:bobSession.cookie},404);
 await reply('/api/account/requests/quotes/'+guestRecord.id,{cookie:bobSession.cookie},404);
 await reply('/api/media/'+aliceFile.id,{cookie:bobSession.cookie},403);
 await reply('/api/media/'+guestFile.id,{cookie:bobSession.cookie},403);
 const download=await reply('/api/media/'+aliceFile.id,{cookie:aliceFirst.cookie});
 check(await download.text()===aliceFile.content,'owner_can_read_private_file');
 check((await db.prepare('SELECT user_id FROM quotes WHERE id=?').bind(guestRecord.id).first()).user_id===null,'registration_never_claims_guest_quote_by_email');
 pass('two verified customers keep separate quote and file access; matching contact email and guest records do not grant ownership');

 phase='single-use password recovery and session revocation';
 const aliceSecond=await signIn(alice);
 const resetTarget='/en/account/reset?return_to=%2Fen%2Faccount';
 await json('/api/auth/request-password-reset',{body:{email:alice.email,redirectTo:resetTarget},ip:'192.0.2.41'});
 const resetLink=await mail(alice,'reset'),redirect=await send(resetLink.href);
 check([302,303].includes(redirect.status)&&!hasLoginCookie(redirect),'reset_link_does_not_authenticate');
 const resetPage=new URL(redirect.headers.get('location'),origin),token=resetPage.searchParams.get('token');
 check(resetPage.origin===origin&&resetPage.pathname==='/en/account/reset'&&typeof token==='string'&&token.length>=20,'reset_token_returns_only_to_internal_page');
 await redirect.body?.cancel();
 const changedPassword='Local changed passphrase '+randomUUID();
 const reset=await json('/api/auth/reset-password',{body:{token,newPassword:changedPassword},ip:'192.0.2.42'});
 check(!hasLoginCookie(reset.response),'reset_requires_fresh_sign_in');
 check((await db.prepare('SELECT COUNT(*) AS n FROM auth_session WHERE user_id=?').bind(alice.id).first()).n===0,'reset_revokes_every_existing_session');
 for(const prior of [aliceFirst,aliceSecond])check((await json('/api/auth/get-session',{cookie:prior.cookie})).data===null,'revoked_cookie_cannot_restore_session');
 await errorCode('/api/auth/sign-in/email',{body:{email:alice.email,password:alice.password},ip:'192.0.2.21'},401,'INVALID_EMAIL_OR_PASSWORD');
 const afterReset=await signIn(alice,changedPassword);
 const changedHash=(await db.prepare("SELECT password FROM auth_account WHERE user_id=? AND provider_id='credential'").bind(alice.id).first()).password;
 check(changedHash!==credential.password,'recovery_updates_the_credential_hash');
 await errorCode('/api/auth/reset-password',{body:{token,newPassword:alice.password},ip:'192.0.2.42'},400,'INVALID_TOKEN');
 check((await db.prepare("SELECT password FROM auth_account WHERE user_id=? AND provider_id='credential'").bind(alice.id).first()).password===changedHash,'replayed_token_cannot_change_password');
 await json('/api/auth/request-password-reset',{body:{email:alice.email,redirectTo:resetTarget},ip:'192.0.2.43'});
 const expiredLink=await mail(alice,'reset',1),expiredToken=expiredLink.pathname.split('/').at(-1);
 check((await db.prepare('SELECT COUNT(*) AS n FROM auth_verification WHERE value=?').bind(alice.id).first()).n>0,'recovery_has_a_database_verification_record');
 await db.prepare('UPDATE auth_verification SET expires_at=? WHERE value=?').bind(Date.now()-60000,alice.id).run();
 const expired=await send(expiredLink.href),expiredPage=new URL(expired.headers.get('location'),origin);
 check([302,303].includes(expired.status)&&expiredPage.searchParams.get('error')==='INVALID_TOKEN'&&!expiredPage.searchParams.has('token'),'expired_database_token_does_not_reach_reset_form');
 await expired.body?.cancel();
 await errorCode('/api/auth/reset-password',{body:{token:expiredToken,newPassword:alice.password},ip:'192.0.2.44'},400,'INVALID_TOKEN');
 check((await db.prepare("SELECT password FROM auth_account WHERE user_id=? AND provider_id='credential'").bind(alice.id).first()).password===changedHash,'expired_token_cannot_change_password');
 pass('reset token is single-use and expires in D1; password change revokes every old session and requires a fresh login');

 phase='live database authorization';
 await db.prepare('UPDATE auth_user SET email_verified=0 WHERE id=?').bind(alice.id).run();
 check((await json('/api/session?verified=1',{cookie:afterReset.cookie,worker:1})).data.user===null,'verified_query_cannot_override_current_database_status');
 await reply('/api/account',{cookie:afterReset.cookie,worker:1},401);
 await db.prepare('UPDATE auth_user SET email_verified=1 WHERE id=?').bind(alice.id).run();
 check((await json('/api/session',{cookie:afterReset.cookie,worker:1})).data.user?.userId==='customer:'+alice.id,'peer_reads_restored_database_verification');
 await db.prepare('DELETE FROM auth_session WHERE id=?').bind(afterReset.sessionId).run();
 check((await json('/api/auth/get-session',{cookie:afterReset.cookie,worker:1})).data===null,'database_revocation_works_across_workers_without_cookie_cache');
 await db.prepare('UPDATE auth_session SET expires_at=? WHERE id=?').bind(Date.now()-60000,bobSession.sessionId).run();
 check((await json('/api/session',{cookie:bobSession.cookie})).data.user===null,'expired_database_session_has_no_customer_access');
 pass('each Worker rechecks current verification, expiration and revocation in D1');

 phase='explicit Google linking request boundary';
 const linkBody={provider:'google',callbackURL:'/ar/account?tab=security&linked=google',errorCallbackURL:'/ar/account?tab=security',disableRedirect:true};
 const googleOptions=()=>({worker:2,ip:'198.18.0.'+(++googleSequence)});
 const googleIdentity={subject:'local-link-subject-'+randomUUID(),email:alice.email};
 const authCounts=()=>db.prepare('SELECT (SELECT COUNT(*) FROM auth_user) AS users,(SELECT COUNT(*) FROM auth_account) AS accounts,(SELECT COUNT(*) FROM auth_session) AS sessions').first();
 async function beginGoogle(identity,cookie='',link=true){
  const body=link?linkBody:{provider:'google',callbackURL:'/ar/account',newUserCallbackURL:'/ar/account',errorCallbackURL:'/ar/account/login',disableRedirect:true};
  const response=await reply('/api/auth/'+(link?'link-social':'sign-in/social'),{...googleOptions(),body,cookie});
  const url=new URL((await response.json()).url);
  check(url.origin==='https://accounts.google.com'&&url.pathname==='/o/oauth2/v2/auth','google_link_uses_expected_authorization_url');
  check(url.searchParams.get('client_id')===googleClientId&&url.searchParams.get('redirect_uri')===origin+'/api/auth/callback/google','google_link_uses_exact_provider_and_callback');
  const state=url.searchParams.get('state'),challenge=url.searchParams.get('code_challenge');
  check(!!state&&!!challenge&&url.searchParams.get('code_challenge_method')==='S256','google_link_requires_state_and_pkce');
  const cookies=response.headers.getSetCookie().filter(value=>value.startsWith('__Secure-better-auth.state='));
  check(cookies.length===1&&/HttpOnly/i.test(cookies[0])&&/Secure/i.test(cookies[0])&&/SameSite=Lax/i.test(cookies[0])&&!/Domain=/i.test(cookies[0]),'google_link_uses_host_only_secure_state_cookie');
  const code='local-link-code-'+randomUUID();googleFixtures.set(code,{identity,challenge,used:false});
  return {state,code,cookie:cookies[0].split(';',1)[0]};
 }
 async function finishGoogle(flow,cookie=''){
  const response=await send('/api/auth/callback/google?'+new URLSearchParams({state:flow.state,code:flow.code}),{...googleOptions(),cookie:[cookie,flow.cookie].filter(Boolean).join('; ')});
  check([302,303].includes(response.status)&&/no-store/.test(response.headers.get('cache-control')||''),'google_callback_returns_private_redirect');
  const location=new URL(response.headers.get('location'),origin);
  check(location.origin===origin,'google_callback_cannot_redirect_outside_site');
  return {response,location};
 }
 async function denyGoogle(flow,cookie,code){
  const before=await authCounts(),result=await finishGoogle(flow,cookie);
  check(result.location.searchParams.get('error')===code,'google_link_callback_rejection_'+code);
  check(!hasLoginCookie(result.response),'rejected_link_cannot_create_or_upgrade_session');
  check(JSON.stringify(await authCounts())===JSON.stringify(before),'rejected_link_cannot_change_users_accounts_or_sessions');
  await result.response.body?.cancel();
 }
 let linkLogin=await signIn(alice,changedPassword);
 phase='Google link boundary / disabled provider';
 await reply('/api/auth/link-social',{body:linkBody,cookie:linkLogin.cookie},404);
 phase='Google link boundary / anonymous session';
 await errorCode('/api/auth/link-social',{...googleOptions(),body:linkBody},401,'GOOGLE_LINK_REAUTH_REQUIRED');
 phase='Google link boundary / foreign origin';
 await errorCode('/api/auth/link-social',{...googleOptions(),body:linkBody,cookie:linkLogin.cookie,headers:{origin:'https://untrusted.example'}},403,'INVALID_ORIGIN');
 phase='Google link boundary / missing origin';
 await errorCode('/api/auth/link-social',{...googleOptions(),body:linkBody,cookie:linkLogin.cookie,headers:{origin:''}},403,'INVALID_ORIGIN');
 phase='Google link boundary / invalid payload';
 for(const body of [
  {...linkBody,provider:'github'}, {...linkBody,idToken:{token:'not-an-identity-proof'}},
  {...linkBody,callbackURL:'https://untrusted.example/return'}, {...linkBody,errorCallbackURL:'/ar/admin'},
  {...linkBody,additionalData:{serverContext:{googleLink:{userId:alice.id}}}},
  {...linkBody,scopes:['openid','email']}, {...linkBody,userId:fakeOwnerId}, {...linkBody,disableRedirect:false}
 ])await errorCode('/api/auth/link-social',{...googleOptions(),body,cookie:linkLogin.cookie},400,'GOOGLE_LINK_INVALID_REQUEST');
 phase='Google link boundary / unverified session';
 await db.prepare('UPDATE auth_user SET email_verified=0 WHERE id=?').bind(alice.id).run();
 await errorCode('/api/auth/link-social',{...googleOptions(),body:linkBody,cookie:linkLogin.cookie},403,'GOOGLE_LINK_REAUTH_REQUIRED');
 await db.prepare('UPDATE auth_user SET email_verified=1 WHERE id=?').bind(alice.id).run();
 phase='Google link boundary / stale session';
 await db.prepare('UPDATE auth_session SET created_at=? WHERE id=?').bind(Date.now()-11*60000,linkLogin.sessionId).run();
 await errorCode('/api/auth/link-social',{...googleOptions(),body:linkBody,cookie:linkLogin.cookie},403,'GOOGLE_LINK_REAUTH_REQUIRED');
 phase='Google link boundary / implicit linking disabled';
 linkLogin=await signIn(alice,changedPassword);
 const implicit=await beginGoogle(googleIdentity,'',false);
 await denyGoogle(implicit,'','account_not_linked');
 check((await db.prepare("SELECT COUNT(*) AS n FROM auth_account WHERE user_id=? AND provider_id='google'").bind(alice.id).first()).n===0,'same_email_alone_never_links_google');
 pass('Google linking rejects anonymous, unverified, stale, cross-origin, token, alternate-provider and arbitrary-callback requests; implicit linking stays disabled');

 phase='Google link callback session binding';
 const absent=await beginGoogle(googleIdentity,linkLogin.cookie);await denyGoogle(absent,'','GOOGLE_LINK_REAUTH_REQUIRED');
 const revoked=await beginGoogle(googleIdentity,linkLogin.cookie);
 await db.prepare('DELETE FROM auth_session WHERE id=?').bind(linkLogin.sessionId).run();
 await denyGoogle(revoked,linkLogin.cookie,'GOOGLE_LINK_REAUTH_REQUIRED');
 linkLogin=await signIn(alice,changedPassword);
 const switched=await beginGoogle(googleIdentity,linkLogin.cookie),otherAliceLogin=await signIn(alice,changedPassword);
 await denyGoogle(switched,otherAliceLogin.cookie,'GOOGLE_LINK_REAUTH_REQUIRED');
 const switchedUser=await beginGoogle(googleIdentity,linkLogin.cookie),otherBobLogin=await signIn(bob);
 await denyGoogle(switchedUser,otherBobLogin.cookie,'GOOGLE_LINK_REAUTH_REQUIRED');
 const stale=await beginGoogle(googleIdentity,linkLogin.cookie);
 await db.prepare('UPDATE auth_session SET created_at=? WHERE id=?').bind(Date.now()-11*60000,linkLogin.sessionId).run();
 await denyGoogle(stale,linkLogin.cookie,'GOOGLE_LINK_REAUTH_REQUIRED');
 linkLogin=await signIn(alice,changedPassword);
 const localUnverified=await beginGoogle(googleIdentity,linkLogin.cookie);
 await db.prepare('UPDATE auth_user SET email_verified=0 WHERE id=?').bind(alice.id).run();
 await denyGoogle(localUnverified,linkLogin.cookie,'GOOGLE_LINK_REAUTH_REQUIRED');
 await db.prepare('UPDATE auth_user SET email_verified=1 WHERE id=?').bind(alice.id).run();
 await denyGoogle(await beginGoogle({...googleIdentity,email:bob.email},linkLogin.cookie),linkLogin.cookie,'GOOGLE_LINK_EMAIL_MISMATCH');
 await denyGoogle(await beginGoogle({...googleIdentity,verified:false},linkLogin.cookie),linkLogin.cookie,'GOOGLE_LINK_EMAIL_NOT_VERIFIED');
 const collision={...googleIdentity,subject:'local-other-user-subject-'+randomUUID()},collisionAccount=randomUUID(),stamp=Date.now();
 await db.prepare('INSERT INTO auth_account (id,user_id,account_id,provider_id,created_at,updated_at) VALUES (?,?,?,?,?,?)').bind(collisionAccount,bob.id,collision.subject,'google',stamp,stamp).run();
 await denyGoogle(await beginGoogle(collision,linkLogin.cookie),linkLogin.cookie,'account_already_linked_to_different_user');
 check((await db.prepare('SELECT user_id FROM auth_account WHERE id=?').bind(collisionAccount).first()).user_id===bob.id,'provider_identity_never_moves_between_local_users');
 pass('Google callback rechecks the same live fresh session; revoked, switched, stale and unverified sessions, mismatched Google email and other-user provider bindings are rejected');

 phase='Google link success preserves identity and both login methods';
 const beforeLink=await authCounts(),validLink=await beginGoogle(googleIdentity,linkLogin.cookie),linked=await finishGoogle(validLink,linkLogin.cookie);
 check(linked.location.pathname==='/ar/account'&&linked.location.searchParams.get('tab')==='security'&&linked.location.searchParams.get('linked')==='google'&&!linked.location.searchParams.has('error'),'successful_link_returns_to_account_security');
 check(!hasLoginCookie(linked.response),'linking_does_not_mint_or_upgrade_a_login_session');await linked.response.body?.cancel();
 const afterLink=await authCounts();check(afterLink.users===beforeLink.users&&afterLink.sessions===beforeLink.sessions&&afterLink.accounts===beforeLink.accounts+1,'link_adds_one_provider_to_same_user_only');
 const stillPassword=(await json('/api/auth/get-session',{...googleOptions(),cookie:linkLogin.cookie})).data;
 check(stillPassword.user.id===alice.id&&stillPassword.session.id===linkLogin.sessionId&&stillPassword.session.authMethod==='password','linking_keeps_existing_session_and_password_method');
 await reply('/api/admin/data',{...googleOptions(),cookie:linkLogin.cookie},403);
 const googleAccount=await db.prepare("SELECT user_id,account_id FROM auth_account WHERE user_id=? AND provider_id='google'").bind(alice.id).first();
 check(googleAccount.user_id===alice.id&&googleAccount.account_id===googleIdentity.subject,'google_subject_is_linked_to_original_immutable_id');
 check((await db.prepare("SELECT password FROM auth_account WHERE user_id=? AND provider_id='credential'").bind(alice.id).first()).password===changedHash,'linking_preserves_existing_password_hash');
 await denyGoogle(validLink,linkLogin.cookie,'state_mismatch');
 await errorCode('/api/auth/link-social',{...googleOptions(),body:linkBody,cookie:linkLogin.cookie},409,'GOOGLE_LINK_ALREADY_LINKED');
 await reply('/api/auth/unlink-account',{...googleOptions(),body:{accountId:collisionAccount},cookie:linkLogin.cookie},404);
 const googleLogin=await finishGoogle(await beginGoogle(googleIdentity,'',false));
 check(!googleLogin.location.searchParams.has('error'),'linked_google_sign_in_succeeds');
 const googleCookie=sessionCookie(googleLogin.response);await googleLogin.response.body?.cancel();
 const googleSession=(await json('/api/auth/get-session',{...googleOptions(),cookie:googleCookie})).data;
 check(googleSession.user.id===alice.id&&googleSession.session.authMethod==='google','only_a_new_google_sign_in_creates_google_method_for_same_user');
 const passwordAgain=await signIn(alice,changedPassword);
 for(const cookie of [googleCookie,passwordAgain.cookie]){
  const current=(await json('/api/session',{...googleOptions(),cookie})).data;
  check(current.user?.userId==='customer:'+alice.id&&current.admin===false,'both_methods_keep_customer_identity_without_email_only_admin');
  const account=(await json('/api/account',{...googleOptions(),cookie})).data;
  check(account.quotes.length===1&&account.quotes[0].id===aliceRecord.id,'both_methods_keep_original_private_quote_ownership');
  const media=await reply('/api/media/'+aliceFile.id,{...googleOptions(),cookie});check(await media.text()===aliceFile.content,'both_methods_keep_original_private_attachment_access');
  await reply('/api/account/requests/quotes/'+bobRecord.id,{...googleOptions(),cookie},404);
 }
 check((await db.prepare('SELECT user_id FROM quotes WHERE id=?').bind(guestRecord.id).first()).user_id===null,'linking_cannot_claim_guest_records_by_email');
 pass('explicit link keeps UUID, password hash, session method, quotes and files; replay/duplicate/unlink denied; subsequent Google and password logins both access the original customer account');

 phase='distributed opaque rate limits';
 // Avoid a wall-clock boundary splitting the isolated fixed-window fixture.
 if(Date.now()%600000>595000)await delay(5100);
 const mailTarget='limited@safeplaces-auth.example.test',mailBefore=outboundAttempts;
 for(let i=0;i<6;i++){
  phase='distributed mail target limit / attempt '+(i+1)+' / worker '+(i%2);
  await json('/api/auth/request-password-reset',{body:{email:i%2?mailTarget.toUpperCase():mailTarget,redirectTo:resetTarget},ip:'198.51.100.'+(i+1),worker:i%2});
 }
 phase='distributed mail target rejection';
 await errorCode('/api/auth/request-password-reset',{body:{email:mailTarget,redirectTo:resetTarget},ip:'198.51.100.20',worker:1},429,'RATE_LIMIT');
 const targetKey=rateKey('mail-target',mailTarget,3600);
 check((await db.prepare('SELECT count FROM rate_limits WHERE key=?').bind(targetKey).first())?.count===7,'mail_target_limit_is_shared_and_case_normalized');
 check(outboundAttempts===mailBefore,'unknown_or_throttled_targets_never_send_mail');
 // Seed only counters already created by a real request, avoiding repeated
 // password hashing or bulk mail while checking enforcement in the peer.
 phase='distributed mail IP limit';
 const mailIp='203.0.113.40';
 await json('/api/auth/request-password-reset',{body:{email:'ip-fixture@safeplaces-auth.example.test',redirectTo:resetTarget},ip:mailIp});
 const mailIpKey=rateKey('mail-ip',mailIp,600);
 check(!!await db.prepare('SELECT key FROM rate_limits WHERE key=?').bind(mailIpKey).first(),'ip_bucket_uses_secret_hmac');
 await db.prepare('UPDATE rate_limits SET count=10 WHERE key=?').bind(mailIpKey).run();
 await errorCode('/api/auth/request-password-reset',{body:{email:'other-ip-fixture@safeplaces-auth.example.test',redirectTo:resetTarget},ip:mailIp,worker:1},429,'RATE_LIMIT');
 phase='distributed password IP and pair limits';
 const guessIp='203.0.113.50',wrongPassword='Local deliberately incorrect passphrase';
 await errorCode('/api/auth/sign-in/email',{body:{email:bob.email,password:wrongPassword},ip:guessIp},401,'INVALID_EMAIL_OR_PASSWORD');
 const pairKey=rateKey('password-pair',guessIp+'\0'+bob.email,600),ipKey=rateKey('password-ip',guessIp,600);
 check(!!await db.prepare('SELECT key FROM rate_limits WHERE key=?').bind(pairKey).first(),'password_pair_uses_secret_hmac');
 await db.prepare('UPDATE rate_limits SET count=10 WHERE key=?').bind(pairKey).run();
 await errorCode('/api/auth/sign-in/email',{body:{email:bob.email.toUpperCase(),password:wrongPassword},ip:guessIp,worker:1},429,'RATE_LIMIT');
 await db.prepare('UPDATE rate_limits SET count=20 WHERE key=?').bind(ipKey).run();
 await errorCode('/api/auth/sign-in/email',{body:{email:'different@safeplaces-auth.example.test',password:wrongPassword},ip:guessIp,worker:1},429,'RATE_LIMIT');
 const storedKeys=(await db.prepare("SELECT key FROM rate_limits WHERE key LIKE 'auth-policy:%'").all()).results.map(row=>row.key);
 check(storedKeys.length>0&&storedKeys.every(key=>/^auth-policy:[a-z-]+:\d+:[0-9a-f]{64}$/.test(key)),'rate_table_has_only_opaque_policy_keys');
 check(storedKeys.every(key=>![alice.email,bob.email,mailTarget,mailIp,guessIp,authSecret].some(value=>key.includes(value))),'rate_keys_contain_no_raw_private_values');
 check(mockFailures.length===0&&outboundAttempts===messages.length+[...googleFixtures.values()].filter(fixture=>fixture.used).length,'all_worker_egress_was_approved_local_mail_or_google_fixtures');
 pass('D1 throttles survive Worker and IP changes; password and mail limits use secret HMAC keys without raw identity data');
 pass('email/password API integration completed using temporary fixtures only');
}catch(error){
 console.error('FAIL: email/password integration / '+phase+' / '+(failureCode||exceptionCategory(error)));
 process.exitCode=1;
}finally{
 if(mf)await mf.dispose();
 messages.length=0;
}
