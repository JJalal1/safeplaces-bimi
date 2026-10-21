import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,readdirSync,statSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {dirname,extname,join,resolve,sep} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';

// Exercises the built application and its real Better Auth, D1 and password
// Durable Object using four disposable local browser/database instances.
// Resend requests terminate in the in-memory transport below. A Google cancel
// redirect is intercepted locally; token exchange and other external requests
// are blocked. Passwords, cookies and email links must
// never be written into reports, screenshots, filenames or console output.
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
const require=createRequire(import.meta.url);
const output=resolve('test-results');
const screenshots=join(output,'screenshots');
mkdirSync(screenshots,{recursive:true});
const started=Date.now();
const privateValues=new Set();
const report={suite:'email-password-browser',status:'running',startedAt:new Date().toISOString(),checks:[],cases:[],screenshots:[],pageErrors:[],assetErrors:[],serverErrors:[],blockedExternalRequests:[],transport:'in-memory Resend mock; all other worker/browser egress blocked'};
const instances=new Set();
const allowedOrigins=new Set();
let browser,activeContext,phase='setup';
const words={
 ar:{name:'الاسم الكامل',email:'البريد الإلكتروني',password:'كلمة المرور',confirmation:'تأكيد كلمة المرور',create:'إنشاء حساب',login:'تسجيل الدخول',logout:'تسجيل الخروج',logoutQuestion:'تسجيل الخروج؟',logoutCancel:'إلغاء',forgot:'نسيت كلمة المرور؟',recover:'إرسال رابط الاستعادة',verify:'إرسال رسالة التأكيد',resend:'إرسال رسالة تأكيد جديدة',save:'حفظ كلمة المرور',google:'المتابعة باستخدام Google',verified:'تم تأكيد بريدك',unverified:'أكّد بريدك',mismatch:'كلمتا المرور غير متطابقتين',invalid:'البريد الإلكتروني أو كلمة المرور غير صحيحة'},
 en:{name:'Full name',email:'Email address',password:'Password',confirmation:'Confirm password',create:'Create account',login:'Sign in',logout:'Sign out',logoutQuestion:'Sign out?',logoutCancel:'Cancel',forgot:'Forgot password?',recover:'Send recovery link',verify:'Send verification email',resend:'Send a new verification email',save:'Save password',google:'Continue with Google',verified:'Your email is verified',unverified:'Verify your email',mismatch:'The passwords do not match',invalid:'The email or password is incorrect'}
};
const mime={'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.txt':'text/plain','.xml':'application/xml'};

function playwright(){
 const location=process.env.SAFEPLACES_PLAYWRIGHT_MODULE;
 if(location){const path=resolve(location);return createRequire(statSync(path).isDirectory()?join(path,'package.json'):path)('playwright');}
 try{return require('playwright');}catch{
  const modules=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
  if(modules)return createRequire(join(modules,'playwright','package.json'))('playwright');
  throw new Error('Install Playwright Chromium or configure SAFEPLACES_PLAYWRIGHT_MODULE.');
 }
}
function secret(value){privateValues.add(value);return value;}
function rememberLink(value){
 secret(value);
 const url=new URL(value);
 const token=url.searchParams.get('token')||url.pathname.match(/^\/api\/auth\/reset-password\/([^/]+)$/)?.[1];
 if(token){secret(token);secret(encodeURIComponent(token));}
 return value;
}
function safeMessage(value){
 let text=String(value);
 for(const value of [...privateValues].sort((a,b)=>b.length-a.length))if(value)text=text.split(value).join('[private fixture]');
 return text.replace(/https?:\/\/[^\s"'<>]+/g,'[local URL]').slice(0,2500);
}
function pass(name){report.checks.push({name,status:'passed'});console.log('PASS: '+name);}
async function until(check,message,timeout=20000){const end=Date.now()+timeout;while(Date.now()<end){if(await check())return;await delay(40);}throw new Error(message);}
async function stable(page){await page.evaluate(async()=>{await document.fonts.ready;await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));});}
function hydratedSession(page){
 const pending=page.waitForResponse(response=>{
  const url=new URL(response.url());
  return url.pathname==='/api/session'&&url.searchParams.get('scope')==='customer'&&response.status()===200;
 },{timeout:20000});
 void pending.catch(()=>{});return pending;
}
async function visit(page,instance,path){
 const hydrated=hydratedSession(page);
 const response=await page.goto(instance.origin+path,{waitUntil:'domcontentloaded',timeout:30000});
 assert.equal(response?.status(),200,'The selected local page must render');
 await hydrated;await page.locator('main h1').waitFor();await stable(page);
}
async function capture(page,lang,width,name){
 await stable(page);
 const view=await page.evaluate(()=>{
  const help=document.getElementById('customer-password-help'),field=help?.previousElementSibling?.querySelector('.customer-auth-input');
  return {language:document.documentElement.lang,direction:document.documentElement.dir,width:innerWidth,scrollWidth:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth),headings:document.querySelectorAll('main h1').length,passwordHelpGap:help&&field?help.getBoundingClientRect().top-field.getBoundingClientRect().bottom:null};
 });
 assert.equal(view.language,lang,name+' language');
 assert.equal(view.direction,lang==='ar'?'rtl':'ltr',name+' text direction');
 assert.equal(view.headings,1,name+' main heading');
 assert.ok(view.scrollWidth<=width+2,name+' must fit the viewport');
 if(view.passwordHelpGap!==null)assert.ok(view.passwordHelpGap>=4,name+' password guidance must be separated from the input border');
 await page.evaluate(()=>window.scrollTo({top:0,left:0,behavior:'instant'}));
 const filename='email-password-'+lang+'-'+width+'-'+name+'.png';
 await page.screenshot({path:join(screenshots,filename),fullPage:true,animations:'disabled',mask:[page.locator('input[name="password"],input[name="confirmPassword"]')],timeout:20000});
 report.screenshots.push('screenshots/'+filename);
}
async function submit(page,path,button,status=200){
 // Start validation while the click is still running. Successful sign-in
 // navigates immediately, so Chromium may discard its response body. Success
 // is checked by HTTP status, the visible UI, the application session and D1
 // below; only expected errors need their JSON code, and those do not navigate.
 const pending=page.waitForResponse(response=>new URL(response.url()).pathname===path&&response.request().method()==='POST',{timeout:45000}).then(async response=>{
  assert.equal(response.status(),status,'The '+path+' response has the expected status');
  if(status<400)return {code:null};
  // Never read a successful auth body, which can contain session tokens.
  const body=await response.json();
  return {code:typeof body?.code==='string'?body.code:typeof body?.error==='string'?body.error:null};
 });
 void pending.catch(()=>{});
 await page.getByRole('button',{name:button,exact:true}).click();
 return pending;
}
async function sessionState(page){
 return page.evaluate(async()=>{
  const response=await fetch('/api/session?scope=customer',{credentials:'same-origin'});
  const value=await response.json();
  return {status:response.status,authenticated:!!value.user,userId:value.user?.userId??null};
 });
}
async function initializeDatabase(db){
 for(const migration of readdirSync('drizzle').filter(file=>file.endsWith('.sql')).sort()){
  for(const sql of readFileSync(join('drizzle',migration),'utf8').replace(/^\s*--.*$/gm,'').split(';').filter(sql=>sql.trim()))await db.prepare(sql).run();
 }
 await db.prepare("INSERT INTO settings (key,value) VALUES ('catalog-ready','true'),('orderEnabled','false')").run();
}
async function startInstance(Miniflare,Log,LogLevel,modules,label,email){
 const instance={mf:null,server:null,origin:'',db:null,mails:[],mockFailures:[],email};
 instances.add(instance);
 const roots=[resolve('dist/client'),resolve('public')];
 instance.server=createServer(async(request,response)=>{
  try{
   const url=new URL(request.url,instance.origin),pathname=decodeURIComponent(url.pathname);
   // This mailbox exists only in the disposable test gateway. The emailed
   // capability stays in memory and its link is clicked by the browser; this
   // page is never captured, traced or included in the report.
   const mailbox=pathname.match(/^\/__test\/mailbox\/(verify|reset)\/([1-9][0-9]*)$/);
   if(request.method==='GET'&&mailbox){
    const message=instance.mails.filter(message=>message.purpose===mailbox[1])[Number(mailbox[2])-1];
    if(!message){response.writeHead(404,{'Content-Type':'text/plain'});response.end('Local message not found.');return;}
    const href=message.url.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
    response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Robots-Tag':'noindex, nofollow'});
    response.end('<!doctype html><html lang="en"><head><meta name="referrer" content="no-referrer"><title>Local email fixture</title></head><body><main><h1>Local email fixture</h1><a href="'+href+'">Open the local email link</a></main></body></html>');return;
   }
   if(request.method==='GET'||request.method==='HEAD')for(const root of roots){
    const file=resolve(root,'.'+pathname);
    if(file.startsWith(root+sep)&&existsSync(file)&&statSync(file).isFile()){
     const bytes=readFileSync(file);
     response.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Content-Length':bytes.length,'Cache-Control':'no-store'});
     response.end(request.method==='HEAD'?undefined:bytes);return;
    }
   }
   const parts=[];for await(const part of request)parts.push(part);
   const result=await instance.mf.dispatchFetch(url.href,{method:request.method,headers:request.headers,redirect:'manual',...(!['GET','HEAD'].includes(request.method)?{body:Buffer.concat(parts)}:{})});
   const headers=Object.fromEntries(result.headers);delete headers['content-length'];delete headers['transfer-encoding'];
   const cookies=result.headers.getSetCookie?.();if(cookies?.length)headers['set-cookie']=cookies;
   response.writeHead(result.status,headers);response.end(request.method==='HEAD'?undefined:Buffer.from(await result.arrayBuffer()));
  }catch{report.serverErrors.push({phase,code:'local_gateway_failure'});response.writeHead(500,{'Content-Type':'text/plain'});response.end('Local test gateway failed.');}
 });
 await new Promise((done,reject)=>{instance.server.once('error',reject);instance.server.listen(0,'127.0.0.1',done);});
 instance.origin='http://127.0.0.1:'+instance.server.address().port;allowedOrigins.add(instance.origin);
 const resendKey=secret('local-resend-fixture-'+randomUUID());
 instance.mf=new Miniflare({
  name:'safeplaces-email-browser-'+label,modulesRoot:resolve('dist/server'),modules,
  // Match the pinned Wrangler/Miniflare runtime used by the other CI suites.
  // Production's compatibility date is configured separately and unchanged.
  compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],
  d1Databases:{DB:'email-browser-'+randomUUID()},d1Persist:false,
  durableObjects:{AUTH_PASSWORD_HASHER:{className:'PasswordHasher',useSQLite:true}},
  durableObjectsPersist:false,
  bindings:{
   SITE_PUBLIC:'true',SITE_INDEXABLE:'false',SITE_DEMO_PRICES:'false',PRODUCTION_LAUNCH_LOCKED:'false',
   STANDALONE_AUTH_ENABLED:'true',CUSTOMER_AUTH_ENABLED:'false',ADMIN_BOOTSTRAP_PRIVATE:'false',
   EMAIL_NOTIFICATIONS_ENABLED:'false',EMAIL_PASSWORD_ENABLED:'true',AUTH_ALLOW_LOCAL_HTTP:'true',
   BETTER_AUTH_URL:instance.origin,BETTER_AUTH_SECRET:secret(randomBytes(48).toString('base64url')),
   GOOGLE_CLIENT_ID:'local-browser-google-client.apps.googleusercontent.com',GOOGLE_CLIENT_SECRET:secret('local-google-fixture-'+randomUUID()),
   AUTH_EMAIL_FROM:'info@safeplaces.sa',RESEND_API_KEY:resendKey
  },
  outboundService:async request=>{
   const deny=code=>{instance.mockFailures.push(code);return Response.json({error:'local_mock_denied'},{status:400});};
   if(request.url!=='https://api.resend.com/emails'||request.method!=='POST')return deny('unexpected_worker_egress');
   if(request.headers.get('authorization')!=='Bearer '+resendKey)return deny('incorrect_mock_credential');
   let payload;try{payload=await request.json();}catch{return deny('invalid_mock_body');}
   if(payload.from!=='Safe Places <info@safeplaces.sa>'||!Array.isArray(payload.to)||payload.to.length!==1||payload.to[0]!==email)return deny('unexpected_mock_recipient');
   const links=String(payload.text||'').match(/https?:\/\/[^\s]+/g)||[];
   if(links.length!==1)return deny('invalid_mock_link_count');
   let link;try{link=new URL(links[0]);}catch{return deny('invalid_mock_link');}
   if(link.origin!==instance.origin)return deny('nonlocal_mock_link');
   const purpose=link.pathname==='/api/auth/verify-email'?'verify':/^\/api\/auth\/reset-password\/[^/]+$/.test(link.pathname)?'reset':null;
   if(!purpose)return deny('unexpected_mock_purpose');
   instance.mails.push({purpose,url:rememberLink(link.href)});
   return Response.json({id:'local-message-'+randomUUID()});
  },
  log:new Log(LogLevel.ERROR),port:0,host:'127.0.0.1'
 });
 instance.db=await instance.mf.getD1Database('DB');await initializeDatabase(instance.db);
 return instance;
}
async function disposeInstance(instance){
 if(instance.server){instance.server.closeIdleConnections?.();await new Promise(done=>instance.server.close(done));}
 if(instance.mf)await instance.mf.dispose();
 allowedOrigins.delete(instance.origin);instance.mails.length=0;instances.delete(instance);
}
async function makeContext(width){
 const context=await browser.newContext({viewport:{width,height:width<800?844:1000},reducedMotion:'reduce',serviceWorkers:'block'});
 context.setDefaultTimeout(15000);
 await context.route('**/*',route=>{
  const url=new URL(route.request().url());
  if(allowedOrigins.has(url.origin)||['data:','blob:'].includes(url.protocol))return route.continue();
  report.blockedExternalRequests.push({phase,host:url.hostname});return route.abort('blockedbyclient');
 });
 context.on('page',page=>{
  page.on('pageerror',error=>report.pageErrors.push({phase,message:safeMessage(error.message)}));
  page.on('response',response=>{
   if(response.status()>=400&&['script','stylesheet'].includes(response.request().resourceType()))report.assetErrors.push({phase,status:response.status()});
   if(response.status()>=500)report.serverErrors.push({phase,status:response.status()});
  });
 });
 return context;
}
async function mail(instance,purpose,count){
 await until(()=>instance.mails.filter(message=>message.purpose===purpose).length>=count,'The in-memory '+purpose+' email must arrive');
 return instance.mails.filter(message=>message.purpose===purpose)[count-1].url;
}
async function clickEmailLink(page,instance,purpose,count){
 await mail(instance,purpose,count);
 const response=await page.goto(instance.origin+'/__test/mailbox/'+purpose+'/'+count,{waitUntil:'domcontentloaded'});
 assert.equal(response?.status(),200,'The disposable local email fixture is available');
 const hydrated=hydratedSession(page);
 await page.getByRole('link',{name:'Open the local email link',exact:true}).click();
 await hydrated;
}
async function signIn(page,instance,lang,email,password){
 await visit(page,instance,'/'+lang+'/account/login');
 await page.getByLabel(words[lang].email,{exact:true}).fill(email);
 await page.getByLabel(words[lang].password,{exact:true}).fill(password);
 const target='/'+lang+'/account';let accountNavigations=0;
 const navigation=request=>{if(request.isNavigationRequest()&&request.frame()===page.mainFrame()&&new URL(request.url()).pathname===target)accountNavigations++;};
 page.on('request',navigation);
 try{
  await submit(page,'/api/auth/sign-in/email',words[lang].login);
  await page.waitForURL(url=>url.pathname===target,{timeout:30000});
  await page.locator('.account-nav').waitFor({state:'visible'});
  assert.equal((await sessionState(page)).authenticated,true,'Email sign-in must establish an application session');
  await page.waitForLoadState('networkidle');
  assert.equal(accountNavigations,1,'Successful email sign-in must initiate exactly one main-frame navigation to the account');
 }finally{page.off('request',navigation);}
}
async function customerGoogleNavigation(page,instance,lang,userId){
 const target='/'+lang+'/account',loginPath=target+'/login';
 let releaseSession,releaseGoogle,sessionReady=false,existingSession=false,accountNavigations=0;
 const sessionGate=new Promise(done=>{releaseSession=done;}),googleGate=new Promise(done=>{releaseGoogle=done;});
 const socialRequests=[];
 const sessionMatch=url=>url.origin===instance.origin&&url.pathname==='/api/session'&&!url.search;
 const socialMatch=url=>url.origin===instance.origin&&url.pathname==='/api/auth/sign-in/social';
 const navigation=request=>{if(request.isNavigationRequest()&&request.frame()===page.mainFrame()&&new URL(request.url()).pathname===target)accountNavigations++;};
 // Delay the real authenticated session response, not a replacement user.
 // StoreProvider's scoped hydration read remains available to render the UI.
 await page.route(sessionMatch,async route=>{
  const response=await route.fetch({maxRedirects:0}),value=await response.json();
  existingSession=response.status()===200&&value.user?.provider==='standalone';sessionReady=true;
  await sessionGate;await route.fulfill({response});
 });
 await page.route(socialMatch,async route=>{
  const payload=route.request().postDataJSON();socialRequests.push({provider:payload.provider,callbackURL:payload.callbackURL});
  if(socialRequests.length===1)await googleGate;
  await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({code:'invalid_code',message:'Local Google response fixture'})});
 });
 page.on('request',navigation);
 try{
  await visit(page,instance,loginPath);
  await until(()=>sessionReady,'The delayed customer session must reach the local browser');
  assert.equal(existingSession,true,'The race requires an actual existing customer session');
  await page.getByRole('button',{name:words[lang].google,exact:true}).click();
  await until(()=>socialRequests.length===1,'The customer Google request must start');
  const delayedResponse=page.waitForResponse(response=>sessionMatch(new URL(response.url())));void delayedResponse.catch(()=>{});
  releaseSession();await (await delayedResponse).finished();await stable(page);
  assert.equal(accountNavigations,0,'A late customer-session response must not navigate over an in-flight Google request');
  assert.equal(new URL(page.url()).pathname,loginPath,'The Google request must retain its login page');
  assert.equal(await page.locator('.customer-social-google').getAttribute('aria-busy'),'true','The Google request remains in flight');
  releaseGoogle();await page.getByRole('alert').waitFor();
  assert.ok(await page.getByRole('button',{name:words[lang].google,exact:true}).isEnabled(),'Google can be retried after the response error');
  const retry=await submit(page,'/api/auth/sign-in/social',words[lang].google,400);
  assert.equal(retry.code,'invalid_code');
  assert.deepEqual(socialRequests,[{provider:'google',callbackURL:target},{provider:'google',callbackURL:target}],'Retry starts a second Google request with the same customer return path');
  assert.equal((await sessionState(page)).userId,userId,'The local Google errors leave the existing customer session intact');
 }finally{
  releaseSession();releaseGoogle();page.off('request',navigation);
  await page.unroute(sessionMatch);await page.unroute(socialMatch);
 }
}
async function customerGoogleLinking(page,instance,lang,width,email,password,userId){
 const target='/'+lang+'/account';
 await visit(page,instance,target+'?tab=security');
 await page.locator('.account-nav').waitFor();
 assert.equal(await page.locator('.customer-sign-in-methods').count(),0,'No account-linking settings are required or advertised');
 assert.equal(await page.locator('.account-nav').getByRole('button',{name:lang==='ar'?'طرق تسجيل الدخول':'Sign-in methods',exact:true}).count(),0);
 await visit(page,instance,target+'/login?reason=link-google&error=access_denied');
 const google=page.getByRole('button',{name:words[lang].google,exact:true});
 await google.waitFor();
 assert.ok(await google.isEnabled(),'Even an old linking URL offers direct Google sign-in');
 assert.equal(await page.locator('.customer-google-link-prompt').count(),0,'No password-first linking instruction remains');
 let cancellations=0;
 const googleMatch=url=>url.origin==='https://accounts.google.com'&&url.pathname==='/o/oauth2/v2/auth';
 await page.route(googleMatch,async route=>{
  const url=new URL(route.request().url()),state=url.searchParams.get('state');
  assert.equal(url.searchParams.get('redirect_uri'),instance.origin+'/api/auth/callback/google');
  assert.ok(state&&url.searchParams.get('code_challenge'),'Direct Google sign-in retains state and PKCE');
  secret(state);secret(url.href);cancellations++;
  await route.fulfill({status:302,headers:{location:instance.origin+'/api/auth/callback/google?'+new URLSearchParams({state,error:'access_denied'}),'cache-control':'no-store'},body:''});
 });
 try{
  await google.click();
  await page.waitForURL(url=>url.pathname===target+'/login'&&url.searchParams.get('error')==='access_denied');
  await page.getByRole('alert').waitFor();
  assert.equal(cancellations,1,'Google starts without entering an email or password');
  assert.equal((await sessionState(page)).userId,'customer:'+userId,'Provider cancellation preserves the existing session');
  await capture(page,lang,width,'direct-google-cancelled');
 }finally{await page.unroute(googleMatch);}
 await visit(page,instance,target);
 const saved={name:'Local saved customer',email,phone:'0500000123',company:'Local fixture company'};
 const result=await page.evaluate(async data=>(await fetch('/api/profile',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)})).status,saved);
 assert.equal(result,200);
 for(const path of ['quote','contact']){
  await visit(page,instance,'/'+lang+'/'+path);
  const summary=page.locator('.saved-contact-summary');await summary.waitFor();
  await page.waitForFunction(()=>document.querySelector('input[name="name"]')?.value==='Local saved customer');
  assert.equal(await page.locator('input[name="name"]').inputValue(),saved.name);
  assert.equal(await page.locator('input[name="email"]').inputValue(),email);
  assert.equal(await page.locator('input[name="phone"]').inputValue(),saved.phone);
  assert.equal(await page.locator('input[name="name"]').isVisible(),false,'Saved contact fields start collapsed');
  await summary.getByRole('button',{name:lang==='ar'?'تعديل البيانات':'Edit details',exact:true}).click();
  assert.ok(await page.locator('input[name="name"]').isVisible(),'Contact details remain editable');
  await page.locator('input[name="name"]').fill('Local edited customer');
  assert.equal(await page.locator('input[name="name"]').inputValue(),'Local edited customer');
  await capture(page,lang,width,path+'-prefilled');
 }
 await visit(page,instance,'/'+lang+'/about');
 const colors=await page.locator('.company-section-number').evaluateAll(nodes=>[...new Set(nodes.map(node=>getComputedStyle(node).backgroundColor))]);
 assert.ok(colors.length<=1,'Repeated section numbers use one brand color');
 assert.ok(await page.locator('footer h3').filter({hasText:lang==='ar'?'للتواصل':'Contact us'}).isVisible());
 assert.ok(await page.locator('footer a[href^="mailto:"]').isVisible());
 assert.equal(await page.locator('footer').evaluate(node=>node.scrollWidth<=node.clientWidth+1),true,'The footer fits its mobile and desktop container');
 await capture(page,lang,width,'footer-brand');
 await visit(page,instance,target);
}
async function signOut(page,lang,db,userId,{source='account'}={}){
 const lex=words[lang],width=page.viewportSize().width;
 phase=lang+'-'+width+' '+source+' logout confirmation';
 const match=url=>url.pathname==='/api/auth/sign-out';
 let attempts=0,release;
 const observe=request=>{if(['/api/auth/sign-out','/api/auth/logout'].includes(new URL(request.url()).pathname)&&request.method()==='POST')attempts++;};
 const sessionCount=async()=>(await db.prepare('SELECT COUNT(*) AS count FROM auth_session WHERE user_id=?').bind(userId).first()).count;
 const sessionCookies=async()=>JSON.stringify((await page.context().cookies()).filter(cookie=>cookie.name.includes('session_token')).map(cookie=>[cookie.name,cookie.value]).sort());
 const originalCount=await sessionCount(),originalCookies=await sessionCookies();
 assert.ok(originalCount>0,'The logout scenario starts with a real server session');
 const mobile=source==='header'&&width<651;
 if(mobile)await page.locator('.mobile-menu-toggle').click();
 const trigger=source==='account'?page.locator('.account-nav').getByRole('button',{name:lex.logout,exact:true}):page.locator(mobile?'.mobile-account-actions .site-auth-signout':'.site-auth-topbar');
 const dialog=page.getByRole('alertdialog',{name:lex.logoutQuestion,exact:true});
 const cancel=dialog.getByRole('button',{name:lex.logoutCancel,exact:true});
 const confirm=dialog.locator('.sign-out-dialog-confirm');
 async function intact(label){
  assert.equal((await sessionState(page)).userId,'customer:'+userId,label+' keeps the same signed-in customer');
  assert.equal(await sessionCount(),originalCount,label+' must not revoke or create a server session');
  assert.ok((await sessionCookies())===originalCookies,label+' preserves the session cookie');
 }
 page.on('request',observe);
 try{
  for(const action of ['cancel','escape']){
   await trigger.click();await dialog.waitFor({state:'visible'});
   assert.ok(await cancel.evaluate(element=>element===document.activeElement),'Cancel receives initial focus');
   assert.equal(await dialog.getAttribute('dir'),lang==='ar'?'rtl':'ltr');
   const bounds=await dialog.boundingBox();
   assert.ok(bounds&&bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width+1&&bounds.y+bounds.height<=page.viewportSize().height+1,'The confirmation fits the viewport');
   await page.keyboard.press('Shift+Tab');
   assert.ok(await confirm.evaluate(element=>element===document.activeElement),'Backward Tab stays in the confirmation');
   await page.keyboard.press('Tab');
   assert.ok(await cancel.evaluate(element=>element===document.activeElement),'Forward Tab wraps to Cancel');
   if(action==='cancel'){
    await capture(page,lang,width,source+'-logout-confirmation');
    await cancel.click();
   }else await page.keyboard.press('Escape');
   await dialog.waitFor({state:'detached'});
   assert.ok(await trigger.evaluate(element=>element===document.activeElement),'Dismissal restores focus to the logout control');
   if(mobile)assert.ok(await page.locator('.mobile-more-sheet').isVisible(),'Escape closes only the confirmation, leaving the mobile menu available');
   await intact(action);
   assert.equal(attempts,0,'Cancel and Escape must never send a logout request');
  }

  // Exercise a recoverable transport response without touching the real session.
  await page.route(match,route=>route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({code:'LOCAL_LOGOUT_RETRY',message:'Local sign-out retry fixture'})}));
  await trigger.click();await dialog.waitFor({state:'visible'});
  const failed=page.waitForResponse(response=>match(new URL(response.url()))&&response.request().method()==='POST');
  void failed.catch(()=>{});
  await confirm.click();assert.equal((await failed).status(),400);
  await dialog.getByRole('alert').waitFor({state:'visible'});
  assert.ok(await cancel.isEnabled()&&await confirm.isEnabled(),'A failed sign-out can be cancelled or retried');
  await intact('The failed confirmation');
  await capture(page,lang,width,source+'-logout-retry');
  assert.equal(attempts,1,'One failed confirmation sends one request');
  await page.unroute(match);

  // Hold the real request so rapid clicks and Escape can be checked before revocation.
  let sent=0;
  const gate=new Promise(done=>{release=done;});
  await page.route(match,async route=>{sent++;await gate;await route.continue();});
  const pending=page.waitForResponse(response=>match(new URL(response.url()))&&response.request().method()==='POST');
  void pending.catch(()=>{});
  await confirm.click({clickCount:2});
  await until(()=>sent>=1,'The confirmed server logout starts');
  assert.ok(await cancel.isDisabled()&&await confirm.isDisabled(),'Both actions are locked while logout is pending');
  await page.keyboard.press('Escape');
  assert.ok(await dialog.isVisible(),'Escape cannot dismiss an in-flight logout');
  assert.equal(sent,1,'Rapid confirmation clicks do not duplicate the server request');
  release();
  assert.equal((await pending).status(),200,'The visible sign-out action must succeed');
  const destination='/'+lang+(source==='account'?'/account/login':'');
  await page.waitForURL(url=>url.pathname===destination);
  assert.equal((await sessionState(page)).authenticated,false,'Sign-out must revoke the application session');
  assert.equal(await sessionCount(),0,'Sign-out must remove the server session');
  assert.equal((await page.context().cookies()).some(cookie=>cookie.name.includes('session_token')),false,'Sign-out must remove the session cookie');
  assert.equal(attempts,2,'Only the failed attempt and one successful confirmation submit logout');
  pass(lang+'-'+width+' '+source+': cancel/Escape preserve the session, focus is restored, failure is retryable and confirmation revokes once');
 }finally{
  release?.();page.off('request',observe);await page.unroute(match);
 }
}

try{
 const {Miniflare,Log,LogLevel}=createRequire(require.resolve('wrangler/package.json'))('miniflare');
 const serverRoot=resolve('dist/server');assert.ok(existsSync(join(serverRoot,'index.js')),'Build the application before running email browser checks');
 const paths=['index.js',...readdirSync(serverRoot,{recursive:true}).filter(path=>path.endsWith('.js')&&path!=='index.js')];
 const modules=paths.map(path=>({type:'ESModule',path:join(serverRoot,path)}));
 browser=await playwright().chromium.launch({headless:true});
 for(const lang of ['ar','en'])for(const width of [390,1440]){
  const label=lang+'-'+width,lex=words[lang],email=label+'@safeplaces-ui.example.test';
  const oldPassword=secret('First browser passphrase '+randomUUID()),newPassword=secret('Changed browser passphrase '+randomUUID());
  phase=label+' setup';
  const instance=await startInstance(Miniflare,Log,LogLevel,modules,label,email);
  activeContext=await makeContext(width);const page=await activeContext.newPage();

  phase=label+' sign-in layout';
  await visit(page,instance,'/'+lang+'/account/login?return_to='+encodeURIComponent('/'+lang+'/wishlist'));
  assert.ok(await page.getByRole('button',{name:lex.google,exact:true}).isEnabled(),'Google remains available beside email sign-in');
  assert.equal(await page.locator('.customer-social-login button').count(),1,'Only the configured Google social provider is offered');
  assert.equal(await page.locator('.site-header, .mobile-shopping-nav').count(),0,'The sign-in layout remains focused');
  assert.equal(await page.getByLabel(lex.email,{exact:true}).getAttribute('dir'),'ltr');
  const switchHref=new URL(await page.locator('.customer-login-language').getAttribute('href'),instance.origin);
  const otherLang=lang==='ar'?'en':'ar';
  assert.equal(switchHref.pathname,'/'+otherLang+'/account/login');
  assert.equal(switchHref.searchParams.get('return_to'),'/'+otherLang+'/wishlist');
  await capture(page,lang,width,'login');
  await visit(page,instance,'/'+lang+'/account/login?return_to='+encodeURIComponent('/'+lang+'/admin')+'&reason=admin');
  assert.equal(await page.locator('main input, .customer-auth-switch').count(),0,'Administration must remain Google-only when customer passwords are enabled');
  assert.ok(await page.getByRole('button',{name:lex.google,exact:true}).isEnabled());

  phase=label+' registration';
  await visit(page,instance,'/'+lang+'/account/register?return_to='+encodeURIComponent('/'+lang+'/account'));
  await page.getByLabel(lex.name,{exact:true}).fill(lang==='ar'?'عميل اختبار محلي':'Local browser customer');
  await page.getByLabel(lex.email,{exact:true}).fill(email);
  await page.getByLabel(lex.password,{exact:true}).fill(oldPassword);
  await page.getByLabel(lex.confirmation,{exact:true}).fill(oldPassword);
  await page.locator('input[name="consent"]').check();
  assert.equal(await page.getByLabel(lex.password,{exact:true}).getAttribute('minlength'),'12');
  assert.equal(await page.getByLabel(lex.password,{exact:true}).getAttribute('maxlength'),'128');
  await capture(page,lang,width,'register');
  await page.getByLabel(lex.confirmation,{exact:true}).fill(newPassword);
  await page.getByRole('button',{name:lex.create,exact:true}).click();
  await page.getByRole('alert').filter({hasText:lex.mismatch}).waitFor();
  assert.equal((await instance.db.prepare('SELECT COUNT(*) AS count FROM auth_user').first()).count,0,'Mismatched passwords must not submit registration');
  await page.getByLabel(lex.confirmation,{exact:true}).fill(oldPassword);
  await submit(page,'/api/auth/sign-up/email',lex.create);
  await page.locator('.customer-auth-success').waitFor();
  await mail(instance,'verify',1);
  const user=await instance.db.prepare('SELECT id,email_verified FROM auth_user WHERE email=?').bind(email).first();
  assert.ok(user,'Registration must create the local user');assert.equal(user.email_verified,0,'Registration requires email verification');
  assert.equal((await sessionState(page)).authenticated,false,'Registration must not auto-sign-in an unverified user');
  await capture(page,lang,width,'verification-requested');

  phase=label+' unverified rejection';
  await visit(page,instance,'/'+lang+'/account/login');
  await page.getByLabel(lex.email,{exact:true}).fill(email);
  await page.getByLabel(lex.password,{exact:true}).fill(oldPassword);
  const unverified=await submit(page,'/api/auth/sign-in/email',lex.login,403);
  assert.equal(unverified.code,'EMAIL_NOT_VERIFIED');
  await page.getByRole('alert').filter({hasText:lex.unverified}).waitFor();
  assert.equal((await sessionState(page)).authenticated,false);
  assert.equal(instance.mails.filter(message=>message.purpose==='verify').length,1,'Rejected sign-in must not trigger an automatic email');
  await capture(page,lang,width,'unverified');
  await page.getByRole('link',{name:lex.resend,exact:true}).click();
  await page.waitForURL(url=>url.pathname==='/'+lang+'/account/verify');
  await page.getByLabel(lex.email,{exact:true}).fill(email);
  await submit(page,'/api/auth/send-verification-email',lex.verify);
  await page.locator('.customer-auth-success').waitFor();
  await mail(instance,'verify',2);

  phase=label+' email confirmation';
  await clickEmailLink(page,instance,'verify',2);
  await page.waitForURL(url=>url.pathname==='/'+lang+'/account/login'&&url.searchParams.get('verified')==='1');
  await page.getByRole('status').filter({hasText:lex.verified}).waitFor();
  assert.equal((await instance.db.prepare('SELECT email_verified FROM auth_user WHERE id=?').bind(user.id).first()).email_verified,1,'The emailed link must verify the actual D1 user');
  assert.equal((await sessionState(page)).authenticated,false,'Email verification must not silently create a session');
  await capture(page,lang,width,'verified');
  await signIn(page,instance,lang,email,oldPassword);
  const firstSession=await sessionState(page);assert.equal(firstSession.userId,'customer:'+user.id);
  assert.equal((await instance.db.prepare('SELECT auth_method FROM auth_session WHERE user_id=?').bind(user.id).first()).auth_method,'password','Email sessions must be marked as password-authenticated');
  const forbidden=await page.evaluate(async()=>({status:(await fetch('/api/admin/team',{credentials:'same-origin'})).status}));
  assert.equal(forbidden.status,403,'A verified password customer must not acquire administration access');
  await page.reload({waitUntil:'domcontentloaded'});await page.locator('.account-nav').waitFor();
  assert.equal((await sessionState(page)).userId,firstSession.userId,'The authenticated session survives a browser refresh');
  await capture(page,lang,width,'account');

  phase=label+' direct Google and prefilled customer requests';
  await customerGoogleLinking(page,instance,lang,width,email,oldPassword,user.id);
  pass(label+': direct Google without password entry, safe cancellation, editable prefilled quote/contact data, uniform brand numbers and responsive footer');

  phase=label+' Google request and delayed customer session';
  await customerGoogleNavigation(page,instance,lang,firstSession.userId);
  pass(label+': a delayed customer session preserves the Google request and its retry');

  phase=label+' password session administration sign-in';
  await visit(page,instance,'/'+lang+'/account/login?return_to='+encodeURIComponent('/'+lang+'/admin')+'&reason=admin');
  await page.waitForLoadState('networkidle');
  assert.equal(new URL(page.url()).pathname,'/'+lang+'/account/login','A password session must not auto-redirect away from Google administration sign-in');
  assert.equal(await page.locator('main input, .customer-auth-switch').count(),0,'An existing password session must not reveal email forms on administration sign-in');
  assert.ok(await page.getByRole('button',{name:lex.google,exact:true}).isEnabled(),'Google must remain usable with an existing password customer session');
  let administrationGoogleRequest=null;
  await page.route('**/api/auth/sign-in/social',async route=>{
   administrationGoogleRequest=route.request().postDataJSON();
   await route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({code:'invalid_code',message:'Local Google response fixture'})});
  });
  await page.getByRole('button',{name:lex.google,exact:true}).click();
  await page.getByRole('alert').waitFor();
  assert.equal(administrationGoogleRequest?.provider,'google','The administration button must still start Google sign-in');
  assert.equal(administrationGoogleRequest?.callbackURL,'/'+lang+'/admin','Google retains the intended administration return path');
  assert.equal((await sessionState(page)).userId,firstSession.userId,'A mocked Google error must not mutate the password session');
  assert.ok(await page.getByRole('button',{name:lex.google,exact:true}).isEnabled(),'A Google attempt can be retried after an error');
  await capture(page,lang,width,'admin-google-with-password-session');
  await page.unroute('**/api/auth/sign-in/social');
  await visit(page,instance,'/'+lang+'/account');
  await page.locator('.account-nav').waitFor();
  await signOut(page,lang,instance.db,user.id);

  phase=label+' password recovery';
  await page.getByRole('link',{name:lex.forgot,exact:true}).click();
  await page.waitForURL(url=>url.pathname==='/'+lang+'/account/forgot');
  await page.getByLabel(lex.email,{exact:true}).fill(email);
  await capture(page,lang,width,'forgot');
  await submit(page,'/api/auth/request-password-reset',lex.recover);
  await page.locator('.customer-auth-success').waitFor();
  await clickEmailLink(page,instance,'reset',1);
  await page.waitForURL(url=>url.pathname==='/'+lang+'/account/reset'&&!!url.searchParams.get('token'));
  rememberLink(page.url());
  await page.getByLabel(lex.password,{exact:true}).fill(newPassword);
  await page.getByLabel(lex.confirmation,{exact:true}).fill(newPassword);
  await capture(page,lang,width,'reset');
  await submit(page,'/api/auth/reset-password',lex.save);
  await page.locator('.customer-auth-success').waitFor();
  assert.equal((await sessionState(page)).authenticated,false,'Password reset must require a fresh sign-in');
  await visit(page,instance,'/'+lang+'/account/login');
  await page.getByLabel(lex.email,{exact:true}).fill(email);
  await page.getByLabel(lex.password,{exact:true}).fill(oldPassword);
  const invalid=await submit(page,'/api/auth/sign-in/email',lex.login,401);
  assert.equal(invalid.code,'INVALID_EMAIL_OR_PASSWORD');
  await page.getByRole('alert').filter({hasText:lex.invalid}).waitFor();
  assert.equal((await sessionState(page)).authenticated,false,'The old password must stop working');
  await signIn(page,instance,lang,email,newPassword);
  await signOut(page,lang,instance.db,user.id,{source:'header'});
  await visit(page,instance,'/'+lang+'/account/reset');
  assert.equal(await page.locator('input[name="password"]').count(),0,'A reset page without its email token must not offer a working password form');
  assert.ok(await page.locator('.customer-auth-recovery a').isVisible());
  await capture(page,lang,width,'reset-link-required');

  const counts=await instance.db.prepare('SELECT (SELECT COUNT(*) FROM auth_user) AS users,(SELECT COUNT(*) FROM auth_account WHERE provider_id=\'credential\') AS credentials,(SELECT COUNT(*) FROM auth_session) AS sessions,(SELECT COUNT(*) FROM orders) AS orders,(SELECT COUNT(*) FROM quotes) AS quotes,(SELECT COUNT(*) FROM notification_outbox) AS businessNotifications').first();
  assert.deepEqual(counts,{users:1,credentials:1,sessions:0,orders:0,quotes:0,businessNotifications:0},'Only the expected disposable account may be created');
  assert.deepEqual(instance.mockFailures,[],'The mail mock must receive only expected local requests');
  assert.deepEqual(instance.mails.map(message=>message.purpose),['verify','verify','reset'],'The browser lifecycle produces exactly the expected three mocked messages');
  report.cases.push({language:lang,width,status:'passed',...counts,mockedVerificationEmails:2,mockedRecoveryEmails:1});
  pass(label+': registration, verification, password sign-in, refresh, logout, recovery and password replacement');
  await activeContext.close();activeContext=null;await disposeInstance(instance);
 }
 assert.deepEqual(report.pageErrors,[],'No browser JavaScript errors');
 assert.deepEqual(report.assetErrors,[],'No required asset errors');
 assert.deepEqual(report.serverErrors,[],'No unexpected local server failures');
 assert.deepEqual(report.blockedExternalRequests,[],'The browser must not attempt external requests');
 report.status='passed';console.log('PASS: all four bilingual email/password browser lifecycles; zero live email sends.');
}catch(error){
 report.status='failed';report.error={phase,message:safeMessage(error?.message||error)};process.exitCode=1;
 console.error('FAIL: email/password browser '+phase+': '+report.error.message);
}finally{
 if(activeContext)await activeContext.close().catch(()=>{});
 if(browser)await browser.close().catch(()=>{});
 for(const instance of [...instances])await disposeInstance(instance).catch(()=>{});
 report.durationMs=Date.now()-started;
 const serialized=JSON.stringify(report,null,2);
 for(const value of privateValues)if(value&&serialized.includes(value))throw new Error('Private fixture data was blocked from the browser report.');
 writeFileSync(join(output,'email-password-browser.json'),serialized+'\n');
}

