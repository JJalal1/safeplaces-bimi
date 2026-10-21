import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,readdirSync,statSync,writeFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {dirname,extname,join,resolve,sep} from 'node:path';
import {setTimeout as delay} from 'node:timers/promises';
import {fileURLToPath} from 'node:url';

// CI-only browser exercise of the built administration and sign-in UI. Every record and
// request belongs to disposable local Miniflare instances. Mail is disabled,
// worker egress is denied, and Playwright blocks all non-local requests.
// No checkout, cart test, live identity, or real provider credential is used.
process.chdir(resolve(dirname(fileURLToPath(import.meta.url)),'..'));
const require=createRequire(import.meta.url);
function playwright(){
 const location=process.env.SAFEPLACES_PLAYWRIGHT_MODULE;
 if(location){const path=resolve(location);return createRequire(statSync(path).isDirectory()?join(path,'package.json'):path)('playwright');}
 try{return require('playwright');}catch(error){
  const modules=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
  if(modules)return createRequire(join(modules,'playwright','package.json'))('playwright');
  throw new Error('Install Playwright Chromium or set SAFEPLACES_PLAYWRIGHT_MODULE to its installed package.',{cause:error});
 }
}
const output=resolve('test-results'),screenshots=join(output,'screenshots');
mkdirSync(screenshots,{recursive:true});
const started=Date.now();
const report={suite:'admin-browser',status:'running',startedAt:new Date().toISOString(),checks:[],pages:[],screenshots:[],pageErrors:[],assetErrors:[],apiErrors:[],blockedExternalRequests:[],blockedWorkerRequests:[],basketTests:0,emailTransport:'disabled; browser and worker external network blocked'};
const blocked=new Set(),allowedOrigins=new Set(),instances=[];
const ownerId='admin-browser-owner';
const ownerHeaders={'oai-authenticated-user-id':ownerId,'oai-authenticated-user-email':'owner@example.test','oai-authenticated-user-full-name':'Local administration fixture','oai-authenticated-user-full-name-encoding':'percent-encoded-utf-8'};
const mime={'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.txt':'text/plain','.xml':'application/xml'};
const words={
 ar:{dashboard:'نظرة عامة',inbox:'صندوق المتابعة',readiness:'جاهزية التشغيل',homepage:'الصفحة الرئيسية ومن نحن',followup:'المتابعة والسجل',reply:'الرد والإشعارات',saveStatus:'حفظ الحالة',saveAttachment:'حفظ الحالة والمرفق',saveNote:'حفظ الملاحظة',saveDraft:'حفظ المسودة',cancel:'إلغاء الإرسال',confirm:'تأكيد الإجراء',close:'إغلاق المحرر',pending:'الدخول متاح بعد التفعيل'},
 en:{dashboard:'Overview',inbox:'Follow-up inbox',readiness:'Operational readiness',homepage:'Home & about',followup:'Follow-up & history',reply:'Reply & notifications',saveStatus:'Save status',saveAttachment:'Save status & attachment',saveNote:'Save note',saveDraft:'Save draft',cancel:'Cancel sending',confirm:'Confirm action',close:'Close editor',pending:'Sign-in available after activation'}
};
let browser,page,context,main;
function pass(name){report.checks.push({name,status:'passed'});console.log('PASS: '+name);}
async function until(check,message,timeout=10000){const end=Date.now()+timeout;while(Date.now()<end){if(await check())return;await delay(40);}throw new Error(message);}
async function stable(target){await target.evaluate(async()=>{await document.fonts.ready;await new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));});}
async function visit(target,instance,path,{reload=false}={}){
 const hydrated=target.waitForResponse(response=>new URL(response.url()).pathname==='/api/session'&&response.status()===200,{timeout:15000});void hydrated.catch(()=>{});
 const options={waitUntil:'domcontentloaded',timeout:20000};
 const response=reload?await target.reload(options):await target.goto(instance.origin+path,options);
 assert.equal(response?.status(),200,path+' must render');await hydrated;await stable(target);
}
async function apiAction(target,path,action){
 const pending=target.waitForResponse(response=>new URL(response.url()).pathname===path&&response.request().method()==='POST',{timeout:15000});void pending.catch(()=>{});
 await action();const response=await pending;const value=await response.json();assert.equal(response.status(),200,path+': '+JSON.stringify(value));return value;
}
async function settleRequest(target){
 await until(async()=>await target.locator('.request-loading').count()===0&&!(await target.locator('.console-editor .editor-heading button').isDisabled()),'Request details or save did not finish loading');
 assert.equal(await target.locator('.request-workspace [role="alert"]').count(),0,'Request workspace displays an error');
 await stable(target);
}
async function navigate(target,lang,key){
 const label=words[lang][key];
 if(target.viewportSize().width<850){await target.locator('.console-nav-toggle').click();await target.locator('.console-sidebar.open').waitFor({state:'visible'});}
 const button=target.locator('.console-sidebar nav button').filter({hasText:label});assert.equal(await button.count(),1,'Navigation identifies one '+key+' action');await button.click();
 await until(async()=>new URL(target.url()).hash==='#'+key,'Navigation did not select '+key);
 await until(async()=>(await target.locator('main h1').textContent())?.trim()===label,'Navigation heading did not update to '+label);
 await stable(target);
}
async function layout(target,lang,width,name){
 await target.setViewportSize({width,height:width<800?844:1000});await stable(target);
 const view=await target.evaluate(()=>{
  const dialog=document.querySelector('.console-editor');
  return {width:innerWidth,scrollWidth:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth),headings:document.querySelectorAll('main h1').length,lang:document.documentElement.lang,dir:document.documentElement.dir,dialog:dialog?{width:dialog.getBoundingClientRect().width,scrollWidth:dialog.scrollWidth,clientWidth:dialog.clientWidth}:null};
 });
 assert.equal(view.lang,lang,name+' language');assert.equal(view.dir,lang==='ar'?'rtl':'ltr',name+' direction');assert.equal(view.headings,1,name+' must have one main heading');
 assert.ok(view.scrollWidth<=width+2,name+' overflows at '+width+': '+JSON.stringify(view));
 if(view.dialog){assert.ok(view.dialog.width<=width+2,name+' dialog must fit the viewport');assert.ok(view.dialog.scrollWidth<=view.dialog.clientWidth+2,name+' request dialog has horizontal overflow: '+JSON.stringify(view.dialog));}
 report.pages.push({name,viewport:width,...view});
}
async function captureBoth(target,lang,name,{bottom=false}={}){
 const previous=target.viewportSize();
 for(const width of [390,1440]){
  await layout(target,lang,width,name);
  await target.evaluate(bottom=>{
   const dialog=document.querySelector('.console-editor');
   if(dialog)dialog.scrollTo({top:bottom?dialog.scrollHeight:0,behavior:'instant'});
   else window.scrollTo({top:0,left:0,behavior:'instant'});
  },bottom);
  await stable(target);
  await target.evaluate(async()=>{
   const images=[...document.images].filter(img=>{const rect=img.getBoundingClientRect();return rect.width>0&&rect.height>0&&rect.bottom>0&&rect.top<innerHeight&&getComputedStyle(img).visibility!=='hidden';});
   await Promise.all(images.map(img=>img.complete?undefined:new Promise(done=>{const finish=()=>{clearTimeout(timer);img.removeEventListener('load',finish);img.removeEventListener('error',finish);done();};const timer=setTimeout(finish,5000);img.addEventListener('load',finish,{once:true});img.addEventListener('error',finish,{once:true});if(img.complete)finish();})));
  });
  const filename='admin-'+lang+'-'+name+'-'+width+'.png';
  await target.screenshot({path:join(screenshots,filename),fullPage:await target.locator('.console-editor').count()===0,animations:'disabled',timeout:20000});
  report.screenshots.push('screenshots/'+filename);
 }
 await target.setViewportSize(previous);await stable(target);
}
async function reviewSignOut(target,lang){
 const previous=target.viewportSize(),originalURL=target.url();
 const lex={logout:lang==='ar'?'تسجيل الخروج':'Sign out',question:lang==='ar'?'تسجيل الخروج؟':'Sign out?',cancel:lang==='ar'?'إلغاء':'Cancel'};
 let logoutRequests=0,navigations=0;
 const observe=request=>{
  if(['/api/auth/sign-out','/api/auth/logout'].includes(new URL(request.url()).pathname))logoutRequests++;
  if(request.isNavigationRequest()&&request.frame()===target.mainFrame())navigations++;
 };
 target.on('request',observe);
 try{
  for(const width of [390,1440]){
   await target.setViewportSize({width,height:width<800?844:1000});await stable(target);
   const profile=target.locator('.console-profile');
   await profile.locator('summary').click();
   const trigger=profile.getByRole('button',{name:lex.logout,exact:true});
   const dialog=target.getByRole('alertdialog',{name:lex.question,exact:true});
   const cancel=dialog.getByRole('button',{name:lex.cancel,exact:true});
   for(const action of ['cancel','escape']){
    await trigger.click();await dialog.waitFor({state:'visible'});
    assert.ok(await cancel.evaluate(element=>element===document.activeElement),'Administration logout initially focuses Cancel');
    assert.equal(await dialog.getAttribute('dir'),lang==='ar'?'rtl':'ltr');
    const bounds=await dialog.boundingBox();
    assert.ok(bounds&&bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width+1&&bounds.y+bounds.height<=target.viewportSize().height+1,'Administration confirmation fits the viewport');
    if(action==='cancel'){
     const filename='admin-'+lang+'-logout-confirmation-'+width+'.png';
     await target.screenshot({path:join(screenshots,filename),fullPage:false,animations:'disabled'});
     report.screenshots.push('screenshots/'+filename);
     await cancel.click();
    }else await target.keyboard.press('Escape');
    await dialog.waitFor({state:'detached'});
    assert.ok(await trigger.evaluate(element=>element===document.activeElement),'Administration logout restores focus after dismissal');
    assert.equal(target.url(),originalURL,'Dismissing administration logout stays in administration');
    assert.ok(await profile.evaluate(element=>element.open),'The underlying profile menu remains open');
    assert.equal(logoutRequests,0,'Administration dismissal never calls logout');
    assert.equal(navigations,0,'Administration dismissal never follows the sign-out URL');
   }
   await profile.locator('summary').click();
   pass(lang+'-'+width+': administration logout cancel/Escape retain the page and restore focus');
  }
 }finally{
  target.off('request',observe);await target.setViewportSize(previous);await stable(target);
 }
}

async function initializeDatabase(db){
 for(const migration of readdirSync('drizzle').filter(file=>file.endsWith('.sql')).sort()){
  for(const sql of readFileSync(join('drizzle',migration),'utf8').replace(/^\s*--.*$/gm,'').split(';').filter(sql=>sql.trim()))await db.prepare(sql).run();
 }
 await db.prepare("INSERT INTO settings (key,value) VALUES ('site-owner',?),('catalog-ready','true'),('orderEnabled','false')").bind(ownerId).run();
}
async function startInstance(Miniflare,modules,publicMode,googleConfigured=false){
 assert.ok(!googleConfigured||publicMode,'The configured Google fixture must use public hosting policy');
 const instance={mf:null,server:null,origin:null,db:null};instances.push(instance);
 instance.mf=new Miniflare({name:'safeplaces-admin-browser-'+(googleConfigured?'google-ready':publicMode?'public':'private'),modulesRoot:resolve('dist/server'),modules,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'admin-browser-'+randomUUID()},
  bindings:{SITE_PUBLIC:publicMode?'true':'false',SITE_INDEXABLE:'false',SITE_DEMO_PRICES:'true',STANDALONE_AUTH_ENABLED:googleConfigured?'true':'false',CUSTOMER_AUTH_ENABLED:'false',ADMIN_BOOTSTRAP_PRIVATE:'false',EMAIL_NOTIFICATIONS_ENABLED:'false',
   // Presentation-only fixture: no Google action is clicked and both worker
   // and browser egress remain blocked. These are synthetic, unusable values.
   ...(googleConfigured?{BETTER_AUTH_URL:'https://safeplaces-login-fixture.example.test',BETTER_AUTH_SECRET:'local-browser-fixture-'+randomUUID(),GOOGLE_CLIENT_ID:'local-browser-google-client',GOOGLE_CLIENT_SECRET:'local-browser-google-secret'}:{})},
  // A missing R2 binding is deliberate. Uploads must be visibly unavailable.
  outboundService:async request=>{report.blockedWorkerRequests.push({url:request.url,method:request.method});return new Response('External requests are disabled in the admin browser suite',{status:502});},
  port:0,host:'127.0.0.1'});
 instance.db=await instance.mf.getD1Database('DB');await initializeDatabase(instance.db);
 const roots=[resolve('dist/client'),resolve('public')];
 instance.server=createServer(async(request,response)=>{
  try{
   const url=new URL(request.url,instance.origin),pathname=decodeURIComponent(url.pathname);
   if(request.method==='GET'||request.method==='HEAD')for(const root of roots){
    const file=resolve(root,'.'+pathname);
    if(file.startsWith(root+sep)&&existsSync(file)&&statSync(file).isFile()){
     const bytes=readFileSync(file);response.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Content-Length':bytes.length,'Cache-Control':'no-store'});response.end(request.method==='HEAD'?undefined:bytes);return;
    }
   }
   const parts=[];for await(const part of request)parts.push(part);
   const result=await instance.mf.dispatchFetch(url.href,{method:request.method,headers:request.headers,redirect:'manual',...(!['GET','HEAD'].includes(request.method)?{body:Buffer.concat(parts)}:{})});
   const headers=Object.fromEntries(result.headers);delete headers['content-length'];delete headers['transfer-encoding'];
   const cookies=result.headers.getSetCookie?.();if(cookies?.length)headers['set-cookie']=cookies;
   response.writeHead(result.status,headers);response.end(request.method==='HEAD'?undefined:Buffer.from(await result.arrayBuffer()));
  }catch(error){response.writeHead(500,{'Content-Type':'text/plain'});response.end('Local administration test: '+String(error));}
 });
 await new Promise((done,reject)=>{instance.server.once('error',reject);instance.server.listen(0,'127.0.0.1',done);});
 instance.origin='http://127.0.0.1:'+instance.server.address().port;allowedOrigins.add(instance.origin);return instance;
}
async function makeContext(){
 const result=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',serviceWorkers:'block',extraHTTPHeaders:ownerHeaders});result.setDefaultTimeout(10000);
 await result.route('**/*',route=>{const url=new URL(route.request().url());if(allowedOrigins.has(url.origin)||['data:','blob:'].includes(url.protocol))return route.continue();blocked.add(url.href);return route.abort('blockedbyclient');});
 result.on('page',target=>{
  target.on('pageerror',error=>report.pageErrors.push({url:target.url(),message:error.message}));
  target.on('response',response=>{if(response.status()>=400){if(['script','stylesheet'].includes(response.request().resourceType()))report.assetErrors.push({url:response.url(),status:response.status()});if(new URL(response.url()).pathname.startsWith('/api/'))report.apiErrors.push({url:response.url(),status:response.status()});}});
 });
 return result;
}
async function fixtures(db){
 const result={};
 for(const lang of ['ar','en']){
  const quote={type:'quotes',id:randomUUID(),number:'SPQ-ADMIN-BROWSER-'+lang.toUpperCase(),name:lang==='ar'?'عميل اختبار عربي':'English quote fixture',email:lang+'.quote@example.test'};
  const contact={type:'contacts',id:randomUUID(),name:lang==='ar'?'رسالة اختبار عربية':'English contact fixture',email:lang+'.contact@example.test'};
  const time=new Date(Date.now()-(lang==='ar'?60000:120000)).toISOString();
  await db.prepare('INSERT INTO quotes (id,number,name,email,phone,company,city,service,description,items,created_at,idempotency_key) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
   .bind(quote.id,quote.number,quote.name,quote.email,'0500000000',lang==='ar'?'بيانات اختبار محلية':'Local test data',lang==='ar'?'الخبر':'Al Khobar','fire-alarm',lang==='ar'?'هذه بيانات اختبار محلية لمراجعة متطلبات مشروع السلامة وسجل المتابعة.':'This is a local fixture for reviewing safety project requirements and follow-up history.','[]',time,randomUUID()).run();
  await db.prepare('INSERT INTO contacts (id,name,email,phone,message,created_at,idempotency_key) VALUES (?,?,?,?,?,?,?)')
   .bind(contact.id,contact.name,contact.email,'0500000000',lang==='ar'?'رسالة اختبار محلية للاستفسار عن الخدمات وتنسيق المتابعة مع فريق الإدارة.':'Local fixture message asking about services and follow-up with management.',time,randomUUID()).run();
  for(const row of [quote,contact]){
   await db.prepare('INSERT INTO request_events (id,request_type,request_id,actor_label,kind,visibility,to_status,idempotency_key,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(randomUUID(),row.type,row.id,'Local customer fixture','created','customer','new',randomUUID(),time).run();
   await db.prepare('INSERT INTO notification_outbox (id,request_type,request_id,kind,recipient,subject,body,status,next_attempt_at,last_error,idempotency_key,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(randomUUID(),row.type,row.id,'customer_confirmation',row.email,'Local fixture acknowledgement','No message is sent by this test.','blocked',time,'EMAIL_NOT_CONFIGURED',randomUUID(),time,time).run();
  }
  result[lang]={quote,contact};
 }
 return result;
}
async function openRequest(target,lang,row){
 await navigate(target,lang,'inbox');
 const search=target.locator('.console-inbox .console-table-search input');await search.fill(row.number||row.name);
 const record=target.locator('.inbox-record');await until(async()=>await record.count()===1,'Inbox search must isolate the requested fixture');
 const detail=target.waitForResponse(response=>new URL(response.url()).pathname==='/api/admin/requests/'+row.type+'/'+row.id,{timeout:15000});void detail.catch(()=>{});
 await record.click();const response=await detail;assert.equal(response.status(),200,'Request detail endpoint');const value=await response.json();assert.equal(value.record.id,row.id);assert.equal(value.mailEnabled,false);assert.equal(value.attachments.available,false);
 await target.locator('.console-editor').waitFor({state:'visible'});await settleRequest(target);
 assert.ok(await target.evaluate(()=>document.querySelector('.console-editor').contains(document.activeElement)),'Opening a request should place keyboard focus inside its editor');
 return value;
}
async function exerciseRequest(target,lang,row,db){
 const label=row.type==='quotes'?'quote':'contact';
 await openRequest(target,lang,row);
 if(row.type==='quotes')assert.ok((await target.locator('.request-facts dd').allTextContents()).includes(lang==='ar'?'الإنذار والكشف المبكر':'Fire alarm & detection'),'Quote requirements must show the localized service name');
 await captureBoth(target,lang,label+'-details');
 await target.getByRole('tab',{name:words[lang].followup}).click();
 const status=row.type==='quotes'?'review':'reviewed';
 await target.locator('.request-workspace select[name="status"]').selectOption(status);
 const statusRequest=target.waitForRequest(request=>new URL(request.url()).pathname==='/api/admin/status'&&request.method()==='POST');void statusRequest.catch(()=>{});
 const response=await apiAction(target,'/api/admin/status',()=>target.getByRole('button',{name:row.type==='quotes'?words[lang].saveAttachment:words[lang].saveStatus,exact:true}).click());assert.equal(response.ok,true);
 const submitted=(await statusRequest).postDataJSON();assert.equal(submitted.expectedStatus,'new','The UI must submit its loaded status for concurrency checking');if(row.type==='quotes')assert.equal(submitted.expectedFile,null,'The UI must submit the loaded proposal state for concurrency checking');
 await target.locator('.request-customer-card .status-'+status).waitFor({state:'visible'});await settleRequest(target);
 assert.equal(await target.locator('.console-editor').count(),1,'Saving status must keep the editor open');
 assert.equal(await target.locator('.toast').count(),0,'Saving status inside the request editor must not produce a duplicate global toast');
 assert.ok((await target.locator('.request-feedback').textContent()).includes(lang==='ar'?'حُفظ تحديث الطلب.':'Request update saved.'),'Status save must retain its inline request feedback');
 assert.equal((await db.prepare('SELECT status FROM '+row.type+' WHERE id=?').bind(row.id).first()).status,status,'Status must persist to the disposable database');
 if(row.type==='quotes')assert.ok(await target.locator('.request-workspace input[type="file"]').isDisabled(),'Missing storage must disable administrative PDF upload');
 const note=lang==='ar'?'ملاحظة داخلية للاختبار: راجع المتطلبات واتفق على الخطوة التالية.':'Internal test note: review requirements and agree the next action.';
 await target.locator('#request-panel-followup textarea').fill(note);
 assert.equal(await target.locator('#request-panel-followup .request-form-actions > span').evaluate(element=>getComputedStyle(element).direction),'ltr','The note counter must keep its current/maximum order in both languages');
 await apiAction(target,'/api/admin/request-note',()=>target.getByRole('button',{name:words[lang].saveNote,exact:true}).click());
 await target.locator('.request-event-body').filter({hasText:note}).waitFor({state:'visible'});await settleRequest(target);
 const notes=(await db.prepare("SELECT body,visibility FROM request_events WHERE request_type=? AND request_id=? AND kind='note'").bind(row.type,row.id).all()).results;
 assert.deepEqual(notes,[{body:note,visibility:'internal'}],'The saved internal note must be recorded exactly once');
 await captureBoth(target,lang,label+'-followup',{bottom:true});
 await target.getByRole('tab',{name:words[lang].reply}).click();
 const draft=lang==='ar'?'مسودة اختبار محفوظة: شكرًا لتواصلكم. سنراجع احتياجات المشروع ونتابع معكم التفاصيل.':'Saved test draft: thank you for contacting us. We will review the project requirements and follow up with you.';
 await target.locator('.request-reply-card textarea').fill(draft);
 const saved=await apiAction(target,'/api/admin/request-draft',()=>target.getByRole('button',{name:words[lang].saveDraft,exact:true}).click());assert.equal(saved.draft.body,draft);
 await settleRequest(target);assert.equal((await db.prepare('SELECT body FROM request_drafts WHERE request_type=? AND request_id=?').bind(row.type,row.id).first()).body,draft);
 assert.equal(await target.getByRole('button',{name:lang==='ar'?'مراجعة الرد قبل الإرسال':'Review reply before sending',exact:true}).count(),0,'Unconfigured email must not expose an operational send action');
 assert.equal(await target.locator('.request-notification-list .delivery-blocked').count(),1,'The acknowledgement must be visibly blocked, not sent');
 await captureBoth(target,lang,label+'-draft');
 await captureBoth(target,lang,label+'-notifications',{bottom:true});
 if(row.type==='contacts'){
  await target.getByRole('button',{name:words[lang].cancel,exact:true}).click();await target.locator('.request-notification-confirm').waitFor({state:'visible'});
  assert.equal((await db.prepare('SELECT status FROM notification_outbox WHERE request_id=?').bind(row.id).first()).status,'blocked','Reviewing cancellation must not mutate the job');
  await apiAction(target,'/api/admin/notifications/cancel',()=>target.getByRole('button',{name:words[lang].confirm,exact:true}).click());await target.locator('.delivery-cancelled').waitFor({state:'visible'});await settleRequest(target);
  assert.equal((await db.prepare('SELECT status FROM notification_outbox WHERE request_id=?').bind(row.id).first()).status,'cancelled');
 }
 await target.getByRole('button',{name:words[lang].close,exact:true}).click();await target.locator('.console-editor').waitFor({state:'detached'});
 // Reload, then reopen through the inbox: state must come from storage, not
 // a retained form instance. There is no public/customer draft publication.
 await visit(target,main,'/'+lang+'/admin#inbox',{reload:true});
 const reopened=await openRequest(target,lang,row);assert.equal(reopened.record.status,status);assert.equal(reopened.draft.body,draft);assert.ok(reopened.events.some(event=>event.body===note&&event.visibility==='internal'));
 await target.getByRole('tab',{name:words[lang].reply}).click();assert.equal(await target.locator('.request-reply-card textarea').inputValue(),draft,'Saved draft must survive closing, reloading and reopening');
 await target.getByRole('button',{name:words[lang].close,exact:true}).click();await target.locator('.console-editor').waitFor({state:'detached'});
 pass(lang+' '+label+': status remains open, note/history, draft persistence, unavailable storage/mail'+(row.type==='contacts'?' and reviewed cancellation':''));
}

try{
 const {Miniflare}=createRequire(require.resolve('wrangler/package.json'))('miniflare');
 const serverRoot=resolve('dist/server');assert.ok(existsSync(join(serverRoot,'index.js')),'Build the application before running administration browser checks');
 const paths=['index.js',...readdirSync(serverRoot,{recursive:true}).filter(path=>path.endsWith('.js')&&path!=='index.js')];
 const modules=paths.map(path=>({type:'ESModule',path:join(serverRoot,path)}));
 main=await startInstance(Miniflare,modules,false);const rows=await fixtures(main.db);
 browser=await playwright().chromium.launch({headless:true});context=await makeContext();page=await context.newPage();
 for(const lang of ['ar','en']){
  await page.setViewportSize({width:lang==='ar'?390:1440,height:lang==='ar'?844:1000});
  await visit(page,main,'/'+lang+'/admin');await page.locator('.management-console').waitFor({state:'visible'});
  await captureBoth(page,lang,'overview');
  await reviewSignOut(page,lang);
  await navigate(page,lang,'inbox');assert.equal(await page.locator('.inbox-record').count(),4);await captureBoth(page,lang,'inbox');
  await navigate(page,lang,'readiness');await page.locator('.readiness-card').first().waitFor({state:'visible'});
  assert.ok(await page.locator('.readiness-status-blocked').count()>0,'Missing services must appear as activation required');await captureBoth(page,lang,'readiness');
  await navigate(page,lang,'homepage');assert.ok(await page.locator('.homepage-image-editor input[type="file"]').isDisabled(),'Missing R2 must disable homepage image uploads');assert.ok(await page.locator('.console-settings-form textarea').first().isEnabled(),'Text editing remains available without R2');
  for(const name of ['heroTitle','heroDescription','about'])for(const [suffix,direction] of [['Ar','rtl'],['En','ltr']])assert.equal(await page.locator('textarea[name="'+name+suffix+'"]').evaluate(element=>getComputedStyle(element).direction),direction,name+suffix+' must retain its content language direction in the '+lang+' interface');
  await captureBoth(page,lang,'homepage-storage-pending');
  for(const row of [rows[lang].quote,rows[lang].contact])await exerciseRequest(page,lang,row,main.db);
 }
 pass('Bilingual overview, inbox, readiness and unavailable image uploads at 390/1440 pixels');
 const counts=await main.db.prepare("SELECT (SELECT COUNT(*) FROM orders) AS orders,(SELECT COUNT(*) FROM products) AS products,(SELECT COUNT(*) FROM files) AS files,(SELECT COUNT(*) FROM request_drafts) AS drafts,(SELECT COUNT(*) FROM notification_outbox WHERE status IN ('queued','processing','sent')) AS sentOrQueued").first();
 assert.deepEqual(counts,{orders:0,products:0,files:0,drafts:4,sentOrQueued:0},'Only synthetic follow-up records may be changed; no purchases, catalog writes, uploads or sends');
 await context.close();
 const publicInstance=await startInstance(Miniflare,modules,true);context=await makeContext();page=await context.newPage();
 for(const lang of ['ar','en']){
  await visit(page,publicInstance,'/'+lang+'/admin');await page.locator('.admin-entry-pending').waitFor({state:'visible'});
  assert.equal(await page.locator('.management-console').count(),0,'A public instance must ignore native owner headers');
  assert.ok(await page.getByRole('button',{name:words[lang].pending,exact:true}).isDisabled(),'Unconfigured Google sign-in must be explicitly disabled');
  assert.equal(await page.locator('a[href*="signin-with-chatgpt"]').count(),0,'Public hosting must not link to private Sites sign-in');
  await captureBoth(page,lang,'public-auth-pending');
 }
 pass('Public Arabic/English entry rejects native identity and honestly shows pending Google setup');
 await context.close();
 const loginInstance=await startInstance(Miniflare,modules,true,true);context=await makeContext();page=await context.newPage();
 for(const lang of ['ar','en']){
  const path='/'+lang+'/account/login?return_to='+encodeURIComponent('/'+lang+'/account');
  await visit(page,loginInstance,path);
  const google=page.getByRole('button',{name:lang==='ar'?'المتابعة باستخدام Google':'Continue with Google',exact:true});
  await google.waitFor({state:'visible'});assert.ok(await google.isEnabled(),'Configured Google sign-in must be available');
  assert.equal(await page.locator('.site-header, .mobile-shopping-nav').count(),0,'The focused login page must not show site search or the shopping navigation');
  assert.equal(await page.locator('main input, .customer-auth-switch').count(),0,'Google-only sign-in must not advertise password or other unconfigured sign-in methods');
  assert.equal(await page.locator('.customer-social-login button').count(),1,'Only the configured Google provider is offered');
  assert.equal(await page.locator('.customer-login-back').getAttribute('href'),'/'+lang,'Back link must return to the current-language site');
  const otherLang=lang==='ar'?'en':'ar';
  const languageHref=new URL(await page.locator('.customer-login-language').getAttribute('href'),loginInstance.origin);
  assert.equal(languageHref.pathname,'/'+otherLang+'/account/login');assert.equal(languageHref.searchParams.get('return_to'),'/'+otherLang+'/account','Language switch must retain a localized account destination');
  assert.equal(await page.locator('.customer-login-help').getAttribute('href'),'/'+lang+'/contact');
  assert.deepEqual(await page.locator('.customer-login-policy a').evaluateAll(links=>links.map(link=>link.getAttribute('href'))),['/'+lang+'/terms','/'+lang+'/privacy']);
  const logo=page.locator('.customer-login-brand img');assert.equal(await logo.getAttribute('src'),'/images/safeplaces-logo.webp','Login must use the existing Safe Places logo');
  await logo.evaluate(img=>img.decode());
  assert.equal(await page.locator('main [role="alert"]').count(),0,'A fresh sign-in page must not carry an old error');
  await captureBoth(page,lang,'login-google');
  await visit(page,loginInstance,path+'&error=invalid_code');await page.locator('main [role="alert"]').waitFor({state:'visible'});
  assert.ok((await page.locator('main [role="alert"]').textContent()).trim().length>0,'A callback failure must explain the next step');
  assert.ok(await google.isEnabled(),'A callback failure must leave Google sign-in available');
  await captureBoth(page,lang,'login-google-error');
 }
 const loginCounts=await loginInstance.db.prepare('SELECT (SELECT COUNT(*) FROM auth_user) AS users,(SELECT COUNT(*) FROM auth_session) AS sessions,(SELECT COUNT(*) FROM auth_account) AS accounts').first();
 assert.deepEqual(loginCounts,{users:0,sessions:0,accounts:0},'Login visual checks must not create identities or sessions');
 pass('Configured Google login, branded focused layout, working navigation and callback error at Arabic/English 390/1440 pixels');
 assert.deepEqual(report.pageErrors,[],'Browser JavaScript errors');assert.deepEqual(report.assetErrors,[],'Required asset errors');assert.deepEqual(report.apiErrors,[],'Unexpected administration API errors');assert.deepEqual(report.blockedWorkerRequests,[],'Disabled mail and native fixtures must make no worker network calls');
 report.status='passed';console.log('PASS: admin browser suite, '+report.pages.length+' viewport checks and '+report.screenshots.length+' screenshots; no email sends or cart tests');
}catch(error){
 report.status='failed';report.error={message:error.message,stack:error.stack};process.exitCode=1;console.error(error);
 if(page&&!page.isClosed())try{const filename='admin-failure.png';await page.screenshot({path:join(screenshots,filename),fullPage:true,animations:'disabled'});report.screenshots.push('screenshots/'+filename);}catch{}
}finally{
 report.blockedExternalRequests=[...blocked];report.durationSeconds=Math.round((Date.now()-started)/100)/10;report.finishedAt=new Date().toISOString();
 writeFileSync(join(output,'admin-browser.json'),JSON.stringify(report,null,2)+'\n');
 await browser?.close();
 for(const instance of [...instances].reverse()){
  if(instance.server)await new Promise(done=>{instance.server.close(done);instance.server.closeAllConnections();});
  await instance.mf?.dispose();
 }
}

