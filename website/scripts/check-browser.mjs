import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdirSync,writeFileSync,existsSync,statSync} from 'node:fs';
import {resolve,join,extname,sep} from 'node:path';
import {createRequire} from 'node:module';
import {createServer} from 'node:http';
import {setTimeout as delay} from 'node:timers/promises';

// Run after the default build. Every request and database write stays local.
// CI may install Playwright separately and point this variable at its package.
const require=createRequire(import.meta.url);
function playwright(){
 const location=process.env.SAFEPLACES_PLAYWRIGHT_MODULE;
 if(location){const path=resolve(location);return createRequire(statSync(path).isDirectory()?join(path,'package.json'):path)('playwright');}
 try{return require('playwright');}catch(error){
  const modules=process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES;
  if(modules)return createRequire(join(modules,'playwright','package.json'))('playwright');
  throw new Error('Install Playwright Chromium or set SAFEPLACES_PLAYWRIGHT_MODULE to the installed playwright package.',{cause:error});
 }
}
const output=resolve('test-results');const screenshots=join(output,'screenshots');
mkdirSync(screenshots,{recursive:true});
const report={startedAt:new Date().toISOString(),pages:[],checks:[],pageErrors:[],assetErrors:[],orderRequestAttempts:[],blockedExternalRequests:[],screenshots:[]};
const started=Date.now();const blocked=new Set();
let mf,server,browser,context,page,origin;
const storageKey='safeplaces-store';
const paths=['','eastern-province','about','services','services/fire-protection','services/fire-alarm','services/maintenance','services/readiness','services/training','services/safety-supply','shop','shop/category/ppe','shop/safety-helmets','quote','contact','projects','certificates','privacy','terms','returns','collection','account'];
const critical=new Set(['','about','shop','quote']);
const screenshotPages=new Set(['','eastern-province','about','services','services/fire-protection','shop','shop/category/ppe','shop/safety-helmets','quote','contact','projects','certificates','privacy']);
const mime={'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.ico':'image/x-icon','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.txt':'text/plain','.xml':'application/xml'};

async function until(check,message,timeout=6000){
 const end=Date.now()+timeout;
 while(Date.now()<end){if(await check())return;await delay(35);}
 throw new Error(message);
}
async function stable(target){
 await target.evaluate(async()=>{await document.fonts.ready;await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));});
}
async function visit(target,path){
 const hydrated=target.waitForResponse(response=>new URL(response.url()).pathname==='/api/session'&&response.status()===200,{timeout:10000});
 // Attach a rejection handler before navigation in case navigation itself fails.
 void hydrated.catch(()=>{});
 const response=await target.goto(origin+path,{waitUntil:'domcontentloaded',timeout:15000});
 assert.equal(response?.status(),200,path+' must render successfully');
 await hydrated;await stable(target);
}
async function screenshot(target,name){
 // Exercise native lazy loading at each viewport before capturing the whole page.
 // A fullPage screenshot alone does not make below-the-fold images load.
 await target.evaluate(()=>window.scrollTo({top:0,left:0,behavior:'instant'}));
 for(let step=0;step<80;step++){
  await stable(target);
  const images=await target.evaluate(async()=>{
   const visible=[...document.querySelectorAll('main img')].filter(img=>{
    const rect=img.getBoundingClientRect();const style=getComputedStyle(img);
    return style.display!=='none'&&style.visibility!=='hidden'&&rect.width>0&&rect.height>0&&rect.bottom>0&&rect.top<innerHeight&&rect.right>0&&rect.left<innerWidth;
   });
   await Promise.all(visible.map(img=>img.complete?undefined:new Promise(resolve=>{
    const finish=()=>{clearTimeout(timer);img.removeEventListener('load',finish);img.removeEventListener('error',finish);resolve();};
    const timer=setTimeout(finish,6000);img.addEventListener('load',finish,{once:true});img.addEventListener('error',finish,{once:true});
    if(img.complete)finish();
   })));
   return visible.map(img=>({src:img.currentSrc||img.src,complete:img.complete,naturalWidth:img.naturalWidth}));
  });
  const failed=images.filter(img=>!img.complete||img.naturalWidth===0);
  assert.deepEqual(failed,[],name+' has visible images that did not load: '+JSON.stringify(failed));
  const advanced=await target.evaluate(()=>{
   const next=Math.min(Math.max(document.documentElement.scrollHeight,document.body.scrollHeight)-innerHeight,scrollY+innerHeight);
   if(next<=scrollY+1)return false;
   window.scrollTo({top:next,behavior:'instant'});return true;
  });
  if(!advanced)break;
  assert.ok(step<79,name+' did not reach the end while preparing screenshots');
 }
 await target.evaluate(()=>window.scrollTo({top:0,left:0,behavior:'instant'}));await stable(target);
 const file=join(screenshots,name+'.png');
 await target.screenshot({path:file,fullPage:true,animations:'disabled',timeout:15000});
 report.screenshots.push('screenshots/'+name+'.png');
}
async function layout(target,path,width){
 await target.setViewportSize({width,height:width<800?844:1000});await stable(target);
 const view=await target.evaluate(()=>{
  const visible=element=>{const style=getComputedStyle(element);return style.display!=='none'&&style.visibility!=='hidden'&&element.getClientRects().length>0;};
  const offenders=[...document.querySelectorAll('main *, .site-header *, .mobile-shopping-nav *')].filter(visible).map(element=>({tag:element.tagName,className:String(element.className).slice(0,120),rect:element.getBoundingClientRect().toJSON()})).filter(item=>item.rect.width>0&&(item.rect.right>innerWidth+2||item.rect.left< -2)).slice(0,8);
  return {width:innerWidth,scrollWidth:Math.max(document.documentElement.scrollWidth,document.body.scrollWidth),h1:document.querySelectorAll('main h1').length,lang:document.documentElement.lang,dir:document.documentElement.dir,offenders};
 });
 assert.equal(view.h1,1,path+' must have exactly one main heading');
 const lang=path.split('/')[1];assert.equal(view.lang,lang);assert.equal(view.dir,lang==='ar'?'rtl':'ltr');
 assert.ok(view.scrollWidth<=width+2,path+' overflows at '+width+'px: '+JSON.stringify(view));
 report.pages.push({path,viewport:width,scrollWidth:view.scrollWidth,h1:view.h1,lang:view.lang,dir:view.dir});
}
function cartRow(target,slug){return target.locator('.cart-line:has(a.line-name[href$="/'+slug+'"])');}
async function savedCart(target,expected){
 await target.waitForFunction(({key,expected})=>{
  const state=JSON.parse(localStorage.getItem(key)||'{"cart":[]}');
  return state.quote.length===Object.keys(expected).length&&state.quote.every(item=>expected[item.slug]===item.quantity);
 },{key:storageKey,expected},{timeout:6000});
}
async function displayedQuantity(target,slug,quantity){
 await until(async()=>await cartRow(target,slug).locator('input[type="number"]').inputValue()===String(quantity),'Cart quantity did not update: '+slug);
}
async function cartSnapshot(target){return target.evaluate(key=>JSON.parse(localStorage.getItem(key)||'{"cart":[]}').cart,storageKey);}
async function savedSelection(target,expected){
 await target.waitForFunction(({key,expected})=>{
  const cart=JSON.parse(localStorage.getItem(key)||'{"cart":[]}').cart;
  return cart.length===Object.keys(expected).length&&cart.every(item=>(item.selected!==false)===expected[item.slug]);
 },{key:storageKey,expected},{timeout:6000});
 for(const [slug,selected]of Object.entries(expected))await until(async()=>await cartRow(target,slug).locator('input[type="checkbox"]').isChecked()===selected,'Selection did not update: '+slug);
}
async function savedBuyNow(target,slug,quantity){
 await target.waitForFunction(({key,slug,quantity})=>{
  const item=JSON.parse(localStorage.getItem(key)||'{}').buyNow;
  return item?.slug===slug&&item.quantity===quantity;
 },{key:storageKey,slug,quantity},{timeout:6000});
}
async function switchShoppingLanguage(target,path){
 await target.locator('.mobile-menu-toggle').click();
 const language=target.locator('#mobile-more-panel .mobile-language');
 assert.equal(await language.getAttribute('href'),path,'The language link must preserve the current purchase intent');
 await language.click();await target.waitForURL(origin+path);await stable(target);
}
async function selectedTotal(target,selectedSlugs){
 // This fixture has VAT-inclusive prices. Compute the expected amount from
 // the requested selection, independently of the component's selected flags.
 await until(async()=>target.evaluate(({key,selectedSlugs})=>{
  const cart=JSON.parse(localStorage.getItem(key)||'{"cart":[]}').cart;
  const amount=cart.filter(item=>selectedSlugs.includes(item.slug)).reduce((sum,item)=>sum+(item.price||0)*item.quantity,0);
  const expected=new Intl.NumberFormat(document.documentElement.lang==='ar'?'ar-SA':'en-SA',{style:'currency',currency:'SAR'}).format(amount/100);
  return document.querySelector('.cart-summary .total-line.final strong:last-child')?.textContent.trim()===expected&&document.querySelector('.cart-checkout-total > strong')?.textContent.trim()===expected;
 },{key:storageKey,selectedSlugs}),'Cart total must include exactly the selected items: '+selectedSlugs.join(', '));
}
async function demoCheckout(target){
 const submit=target.locator('.checkout-grid > form button.primary');
 assert.ok(await submit.isDisabled(),'Demo checkout must stay blocked');
 assert.equal(await target.locator('.checkout-grid input[name="name"], .checkout-grid input[name="email"], .checkout-grid input[name="phone"], .checkout-grid textarea[name="billing"]').count(),0,'A demo purchase must not collect billing details');
 assert.equal(await target.locator('.coupon-form input').count(),0,'Demo prices must not collect live coupon input');
 await target.locator('.order-summary .total-line.final').waitFor({state:'visible'});
 assert.equal(await target.locator('.order-summary .total-line.final').count(),1,'Demo totals must still be reviewable');
 const before=report.orderRequestAttempts.length;
 // Exercise the handler itself: disabled buttons alone are not an order gate.
 await target.locator('.checkout-grid > form').dispatchEvent('submit');await stable(target);
 assert.equal(report.orderRequestAttempts.length,before,'Demo form submission must never POST an order');
}
async function shoppingLayout(target,path,width){
 await layout(target,path,width);
 const chrome=await target.evaluate(()=>{
  const visible=element=>!!element&&getComputedStyle(element).display!=='none'&&getComputedStyle(element).visibility!=='hidden'&&element.getClientRects().length>0;
  const details=selector=>{
   const element=document.querySelector(selector);
   return visible(element)?{rect:element.getBoundingClientRect().toJSON(),position:getComputedStyle(element).position}:null;
  };
  const controls=[...document.querySelectorAll('.product-purchase-bar button, .product-purchase-bar a, .cart-checkout-bar button, .cart-checkout-bar a, .cart-checkout-bar input, .mobile-shopping-nav a, .site-header .header-inner a, .site-header .header-inner button')].filter(visible).map(element=>({tag:element.tagName,className:String(element.className),rect:element.getBoundingClientRect().toJSON()}));
  const nav=document.querySelector('.mobile-shopping-nav');
  return {nav:details('.mobile-shopping-nav'),purchase:details('.product-purchase-bar'),checkout:details('.cart-checkout-bar'),controls,navLinks:[...nav.querySelectorAll('a')].map(a=>({href:a.getAttribute('href'),icons:a.querySelectorAll('svg').length})),headerAccounts:[...document.querySelectorAll('.site-header a')].filter(a=>visible(a)&&a.getAttribute('href')==='/'+document.documentElement.lang+'/account').map(a=>({icons:a.querySelectorAll('svg').length})),height:innerHeight};
 });
 const lang=path.split('/')[1];const root='/'+lang;
 assert.deepEqual(chrome.navLinks.map(link=>link.href),[root,root+'/shop',root+'/quote',root+'/account'],'Shopping navigation must expose four real destinations');
 assert.ok(chrome.navLinks.every(link=>link.icons===1),'Every shopping destination must have an icon');
 assert.ok(chrome.headerAccounts.length>0&&chrome.headerAccounts.every(link=>link.icons===1),'The header needs a visible account icon at '+width+'px');
 for(const control of chrome.controls)assert.ok(control.rect.left>=-1&&control.rect.right<=width+1,'Shopping control extends outside the viewport: '+JSON.stringify(control));
 if(width<800){
  const product=/\/shop\/[^/?]+$/.test(path);
  const bar=product?chrome.purchase:chrome.checkout;
  if(product)assert.equal(chrome.nav,null,'The product purchase bar must have the mobile bottom edge to itself');
  else assert.ok(chrome.nav&&chrome.nav.rect.bottom<=chrome.height+1,'Cart/account navigation must remain visible');
  if(bar){
   assert.equal(bar.position,'fixed','The mobile purchase/review action must stay available while scrolling');
   assert.ok(bar.rect.top>=0&&bar.rect.bottom<=chrome.height+1,'The fixed purchase/review bar must fit the viewport');
   if(chrome.nav)assert.ok(bar.rect.bottom<=chrome.nav.rect.top+1,'The cart review bar must not overlap bottom navigation');
   for(const control of chrome.controls.filter(control=>control.rect.top>=bar.rect.top&&control.rect.bottom<=bar.rect.bottom+1))assert.ok(control.rect.top>=0&&control.rect.bottom<=chrome.height+1,'A purchase control is clipped vertically');
  }
 }
}
async function shoppingScreenshots(target,route,label){
 for(const lang of ['ar','en']){
  const path='/'+lang+'/'+route;await visit(target,path);
  for(const width of [390,1440]){
   await shoppingLayout(target,path,width);await screenshot(target,lang+'-'+label+'-'+width);
   if(width===390){const name=lang+'-'+label+'-390-viewport';await target.screenshot({path:join(screenshots,name+'.png'),fullPage:false,animations:'disabled'});report.screenshots.push('screenshots/'+name+'.png');}
  }
 }
}
async function addProduct(target,quantity=1){
 const actions=target.locator('main .product-actions:not(.small)').first();
 await actions.locator('input[type="number"]').fill(String(quantity));
 const url=target.url();await actions.locator('button.request-quote').click();
 await target.locator('.toast').waitFor({state:'visible'});
 assert.equal(target.url(),url,'Add to cart must keep the customer on the product page');
 assert.equal(await target.locator('.cart-drawer').count(),0,'Add to cart must not open a blocking drawer');
 await stable(target);
 const feedback=await target.evaluate(()=>{
  const toast=document.querySelector('.toast').getBoundingClientRect().toJSON();
  const bars=[...document.querySelectorAll('.product-purchase-bar, .mobile-shopping-nav')].filter(element=>getComputedStyle(element).position==='fixed'&&getComputedStyle(element).display!=='none'&&element.getClientRects().length).map(element=>element.getBoundingClientRect().toJSON());
  return {toast,bars};
 });
 for(const bar of feedback.bars)assert.ok(feedback.toast.bottom<=bar.top+1,'Cart feedback must appear above the fixed shopping controls');
}

try{
 const {Miniflare}=createRequire(require.resolve('wrangler/package.json'))('miniflare');
 const serverRoot=resolve('dist/server');
 const modules=['index.js',...readdirSync(serverRoot,{recursive:true}).filter(path=>path.endsWith('.js')&&path!=='index.js')];
 mf=new Miniflare({name:'safeplaces-browser-test',modulesRoot:serverRoot,modules:modules.map(path=>({type:'ESModule',path:join(serverRoot,path)})),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'browser-test-db'},bindings:{SITE_PUBLIC:'true',SITE_INDEXABLE:'false',SITE_DEMO_PRICES:'true',STANDALONE_AUTH_ENABLED:'false',CUSTOMER_AUTH_ENABLED:'false',ADMIN_BOOTSTRAP_PRIVATE:'false'},port:0,host:'127.0.0.1'});
 const db=await mf.getD1Database('DB');
 for(const migration of readdirSync('drizzle').filter(file=>file.endsWith('.sql')).sort())for(const sql of readFileSync(join('drizzle',migration),'utf8').split('--> statement-breakpoint').filter(sql=>sql.trim()))await db.prepare(sql).run();
 const snapshot=JSON.parse(readFileSync('data/public-content.snapshot.json','utf8')).tables;
 // Seed only catalog/service information: no customer, staff, project or client claims.
 for(const table of ['products','content','settings'])for(const source of snapshot[table]){
  if(table==='content'&&!['category','service'].includes(source.type))continue;
  const row=table==='products'?{...source,price:null,kind:'quote'}:source;
  const columns=Object.keys(row);assert.ok(columns.every(column=>/^[a-z_]+$/.test(column)));
  await db.prepare('INSERT INTO '+table+' ('+columns.map(column=>'"'+column+'"').join(',')+') VALUES ('+columns.map(()=>'?').join(',')+')').bind(...Object.values(row)).run();
 }
 const setSetting=(key,value)=>db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key,JSON.stringify(value)).run();
 await setSetting('orderEnabled',false);
 await setSetting('pricesIncludeVat',true);await setSetting('vatRate',15);
 // A small static-file front end avoids relying on a different Miniflare assets API.
 const assetRoots=[resolve('dist/client'),resolve('public')];
 server=createServer(async(request,response)=>{
  try{
   const url=new URL(request.url,origin);const pathname=decodeURIComponent(url.pathname);
   if(request.method==='GET'||request.method==='HEAD')for(const root of assetRoots){
    const file=resolve(root,'.'+pathname);
    if(file.startsWith(root+sep)&&existsSync(file)&&statSync(file).isFile()){
     const bytes=readFileSync(file);response.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Content-Length':bytes.length,'Cache-Control':'no-store'});response.end(request.method==='HEAD'?undefined:bytes);return;
    }
   }
   const parts=[];for await(const part of request)parts.push(part);
   const result=await mf.dispatchFetch(url.href,{method:request.method,headers:request.headers,redirect:'manual',...(!['GET','HEAD'].includes(request.method)?{body:Buffer.concat(parts)}:{})});
   const headers=Object.fromEntries(result.headers);delete headers['content-length'];delete headers['transfer-encoding'];
   const cookies=result.headers.getSetCookie?.();if(cookies?.length)headers['set-cookie']=cookies;
   response.writeHead(result.status,headers);response.end(request.method==='HEAD'?undefined:Buffer.from(await result.arrayBuffer()));
  }catch(error){response.writeHead(500,{'Content-Type':'text/plain'});response.end('Local browser-test server: '+String(error));}
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 origin='http://127.0.0.1:'+server.address().port;
 browser=await playwright().chromium.launch({headless:true,...(process.env.SAFEPLACES_BROWSER_PATH?{executablePath:process.env.SAFEPLACES_BROWSER_PATH}:{})});
 context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 context.setDefaultTimeout(6000);
 context.on('request',request=>{const url=new URL(request.url());if(url.pathname==='/api/orders'&&request.method()==='POST')report.orderRequestAttempts.push({path:url.pathname,method:request.method()});});
 await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin===origin||['data:','blob:'].includes(url.protocol))return route.continue();blocked.add(url.href);return route.abort('blockedbyclient');});
 context.on('page',target=>{
  target.on('pageerror',error=>report.pageErrors.push({url:target.url(),message:error.message}));
  target.on('response',response=>{if(response.status()>=400&&['script','stylesheet'].includes(response.request().resourceType()))report.assetErrors.push({url:response.url(),status:response.status()});});
 });
 page=await context.newPage();
 for(const lang of ['ar','en'])for(const route of paths){
  const path='/'+lang+(route?'/'+route:'');await visit(page,path);
  for(const width of [390,1440]){
   await layout(page,path,width);
   if(!route){
    const brand=page.locator('.site-header .wordmark');
    assert.ok(await brand.locator('.brand-logo').isVisible(),'Company logo must remain visible in the header');
    assert.ok(await brand.locator('.brand-copy').isVisible(),'Company name must remain visible beside the logo');
    assert.ok((await brand.locator('.brand-copy').innerText()).includes(lang==='ar'?'المناطق الآمنة':'SAFE PLACES'));
    assert.ok(await brand.locator('.brand-logo').evaluate(img=>img.complete&&img.naturalWidth>0));
   }
   if(screenshotPages.has(route)&&((lang==='ar'&&width===390)||(lang==='en'&&width===1440)))await screenshot(page,lang+'-'+(route||'home').replaceAll('/','-')+'-'+width);
  }
  if(critical.has(route))for(const width of [360,768])await layout(page,path,width);
  assert.equal(await page.locator('head meta[name=\"description\"]').count(),1,'Page description belongs in head after hydration: '+path);
  assert.ok(await page.locator('head link[rel=canonical]').count()===1,'One canonical survives hydration: '+path);
  assert.match(await page.locator('.brand-logo').first().evaluate(image=>image.currentSrc),/\/images\/responsive\/logo-/,'Use the responsive logo at the current viewport');
  if(route==='about'){
   const text=await page.locator('main .company-article-section p').allTextContents();
   assert.ok(text.length>=12&&text.join(' ').length>=3500,'About needs a substantive company profile in '+lang);
  }
  if(route==='quote')assert.equal(await page.locator('main input[type="file"]').count(),0,'Unavailable R2 must not appear as an operational upload field');
  if(route==='services')assert.ok(await page.locator('main a[href*="/services/"]').count()>=6,'All service detail pages must remain reachable');
  assert.equal(report.pageErrors.length,0,'Browser JavaScript error: '+JSON.stringify(report.pageErrors));
  assert.equal(report.assetErrors.length,0,'Required browser assets failed: '+JSON.stringify(report.assetErrors));
 }
 report.checks.push({name:'Arabic/English routes, four viewport sizes, one heading, substantial About content, and unavailable attachment UX',status:'passed'});
 console.log('PASS: '+paths.length*2+' bilingual route visits and '+report.pages.length+' viewport checks');

 // A failed non-JSON response must preserve the enquiry and its idempotency key.
 for(const lang of ['ar','en']){
  const attempts=[];
  await page.route('**/api/contact',async route=>{
   attempts.push(route.request().postDataJSON());
   await route.fulfill(attempts.length===1?{status:502,contentType:'text/html',body:'Temporary upstream failure'}:{status:200,contentType:'application/json',body:JSON.stringify({reference:'SPC-RECOVERY-FIXTURE'})});
  });
  try{
   await visit(page,'/'+lang+'/contact');
   const form=page.locator('main form');
   await form.locator('input[name=name]').fill('Recovery fixture');
   await form.locator('input[name=email]').fill('recovery@example.test');
   await form.locator('textarea[name=message]').fill('Keep the enquiry after an interrupted response.');
   await form.locator('input[type=checkbox]').check();
   await form.locator('button[type=submit],button:not([type])').last().click();
   await form.locator('[role=alert]').waitFor();
   assert.equal(await form.locator('textarea[name=message]').inputValue(),'Keep the enquiry after an interrupted response.');
   await form.locator('button[type=submit],button:not([type])').last().click();
   await page.getByText('SPC-RECOVERY-FIXTURE',{exact:true}).waitFor();
   assert.equal(attempts.length,2);assert.deepEqual(attempts[1],attempts[0],'The customer retries the exact same enquiry key and contents');
  }finally{await page.unroute('**/api/contact');}
 }
 report.checks.push({name:'Bilingual contact form retains data and idempotency key after a non-JSON server error; explicit retry succeeds',status:'passed'});

 // Exercise the documented-registration state without inventing an address or VAT ID.
 const identityKeys=['cr','businessIdentityVerified','nationalAddressVerified','vatRegistrationVerified'];
 const savedIdentity=(await db.prepare("SELECT key,value FROM settings WHERE key IN ('cr','businessIdentityVerified','nationalAddressVerified','vatRegistrationVerified')").all()).results;
 try{
  await setSetting('cr','7000000000');await setSetting('businessIdentityVerified',true);
  await setSetting('nationalAddressVerified',false);await setSetting('vatRegistrationVerified',false);
  for(const lang of ['ar','en'])for(const width of [390,1440]){
   const path='/'+lang+'/certificates';await visit(page,path);await layout(page,path,width);
   assert.equal(await page.locator('.support-registration').count(),1,'A documented registration must be visible independently of address/VAT proof');
   assert.ok((await page.locator('.support-registration .business-details').innerText()).includes('7000000000'));
   const rows=await page.locator('.support-registration .business-details > div').count();assert.equal(rows,1,'Only the supported registration should be shown');
   assert.equal(await page.locator('.support-registration a[href="https://mc.gov.sa/ar/eservices/Pages/Commercial-data.aspx"]').count(),1);
   assert.ok((await page.locator('footer .business-details').innerText()).includes('7000000000'));
   await screenshot(page,lang+'-verified-registration-'+width);
  }
  await setSetting('businessIdentityVerified',false);await visit(page,'/ar/certificates');
  assert.equal(await page.locator('.support-registration').count(),0,'Revoked registration approval must hide the record');
  assert.equal(await page.locator('footer .business-details').count(),0);
 }finally{
  const saved=new Map(savedIdentity.map(row=>[row.key,row.value]));
  for(const key of identityKeys){if(saved.has(key))await db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').bind(key,saved.get(key)).run();else await db.prepare('DELETE FROM settings WHERE key=?').bind(key).run();}
 }
 report.checks.push({name:'Verified registration without unsupported address/VAT at Arabic/English 390/1440; revoked approval hides public details',status:'passed'});
 console.log('PASS: independently documented registration card and footer at Arabic/English mobile and desktop; unsupported address/VAT and revoked approvals stay hidden');

 await page.setViewportSize({width:390,height:844});await visit(page,'/ar/shop/safety-helmets');
 const menu=page.locator('.mobile-menu-toggle[aria-controls="mobile-more-panel"]');
 await menu.click();await page.locator('#mobile-more-panel').waitFor({state:'visible'});
 assert.ok(await page.evaluate(()=>document.querySelector('#mobile-more-panel').contains(document.activeElement)),'Opening the company menu must move focus into it');
 await page.screenshot({path:join(screenshots,'ar-company-menu-390.png'),fullPage:false,animations:'disabled'});
 report.screenshots.push('screenshots/ar-company-menu-390.png');
 await page.keyboard.press('Shift+Tab');assert.ok(await page.evaluate(()=>document.querySelector('#mobile-more-panel').contains(document.activeElement)),'Menu focus must stay in the dialog');
 await page.keyboard.press('Escape');await page.locator('#mobile-more-panel').waitFor({state:'detached'});
 assert.ok(await menu.evaluate(element=>document.activeElement===element),'Closing the company menu must restore focus');
 await shoppingScreenshots(page,'shop/safety-helmets','product-quote');
 await page.setViewportSize({width:390,height:844});await visit(page,'/ar/shop/safety-helmets');
 assert.equal(await page.locator('main button.buy-now, main button.add-to-cart').count(),0);
 await addProduct(page,2);await visit(page,'/ar/quote');await displayedQuantity(page,'safety-helmets',2);
 await switchShoppingLanguage(page,'/en/quote');await displayedQuantity(page,'safety-helmets',2);
 await page.locator('form.form-card input[name="name"]').fill('Safe Places quotation test');
 await page.locator('form.form-card input[name="phone"]').fill('0500000000');
 await page.locator('form.form-card input[name="email"]').fill('quote@example.test');
 await page.locator('form.form-card textarea[name="description"]').fill('Please provide a quotation for two safety helmets.');
 await page.locator('form.form-card input[type="checkbox"][required]').check();
 const reply=page.waitForResponse(r=>new URL(r.url()).pathname==='/api/quotes'&&r.request().method()==='POST');
 await page.locator('form.form-card button[type="submit"]').click();assert.equal((await reply).status(),200);
 assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM quotes').first()).count,1);
 assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM orders').first()).count,0);
 assert.equal(report.orderRequestAttempts.length,0,'The browser check must never POST an order');
 assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM orders').first()).count,0,'The browser check must never create an order');
 assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM files').first()).count,0,'R2-unavailable preview must not claim to save files');
 assert.equal(report.pageErrors.length,0,JSON.stringify(report.pageErrors));assert.equal(report.assetErrors.length,0,JSON.stringify(report.assetErrors));
 report.status='passed';
}catch(error){
 report.status='failed';report.error={message:error.message,stack:error.stack};process.exitCode=1;
 console.error(error);
 if(page&&!page.isClosed())try{await screenshot(page,'failure');}catch{}
}finally{
 report.blockedExternalRequests=[...blocked];report.durationSeconds=Math.round((Date.now()-started)/100)/10;report.finishedAt=new Date().toISOString();
 writeFileSync(join(output,'browser-results.json'),JSON.stringify(report,null,2)+'\n');
 await browser?.close();
 if(server)await new Promise(resolve=>{server.close(resolve);server.closeAllConnections();});
 await mf?.dispose();
}

