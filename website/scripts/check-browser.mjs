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
const paths=['','about','services','services/fire-protection','services/fire-alarm','services/maintenance','services/readiness','services/training','services/safety-supply','shop','shop/category/ppe','shop/safety-helmets','cart','checkout','quote','contact','projects','certificates','privacy','terms','returns','collection','account'];
const critical=new Set(['','about','shop','cart','checkout','quote']);
const screenshotPages=new Set(['','about','services','services/fire-protection','shop','shop/category/ppe','shop/safety-helmets','checkout','quote','contact','projects','certificates','privacy']);
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
  return state.cart.length===Object.keys(expected).length&&state.cart.every(item=>expected[item.slug]===item.quantity);
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
 assert.deepEqual(chrome.navLinks.map(link=>link.href),[root,root+'/shop',root+'/cart',root+'/account'],'Shopping navigation must expose four real destinations');
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
 const url=target.url();await actions.locator('button.add-to-cart').click();
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
 browser=await playwright().chromium.launch({headless:true});
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
   if(screenshotPages.has(route)&&((lang==='ar'&&width===390)||(lang==='en'&&width===1440)))await screenshot(page,lang+'-'+(route||'home').replaceAll('/','-')+'-'+width);
  }
  if(critical.has(route))for(const width of [360,768])await layout(page,path,width);
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

 await page.setViewportSize({width:390,height:844});await visit(page,'/ar/shop/safety-helmets');
 const menu=page.locator('.mobile-menu-toggle[aria-controls="mobile-more-panel"]');
 await menu.click();await page.locator('#mobile-more-panel').waitFor({state:'visible'});
 assert.ok(await page.evaluate(()=>document.querySelector('#mobile-more-panel').contains(document.activeElement)),'Opening the company menu must move focus into it');
 await page.screenshot({path:join(screenshots,'ar-company-menu-390.png'),fullPage:false,animations:'disabled'});
 report.screenshots.push('screenshots/ar-company-menu-390.png');
 await page.keyboard.press('Shift+Tab');assert.ok(await page.evaluate(()=>document.querySelector('#mobile-more-panel').contains(document.activeElement)),'Menu focus must stay in the dialog');
 await page.keyboard.press('Escape');await page.locator('#mobile-more-panel').waitFor({state:'detached'});
 assert.ok(await menu.evaluate(element=>document.activeElement===element),'Closing the company menu must restore focus');
 await shoppingScreenshots(page,'shop/safety-helmets','product-purchase');
 await page.setViewportSize({width:390,height:844});await visit(page,'/ar/shop/safety-helmets');
 await addProduct(page);await savedCart(page,{'safety-helmets':1});
 await page.locator('main .product-actions:not(.small) button.add-to-cart').first().dblclick();await savedCart(page,{'safety-helmets':3});
 await visit(page,'/ar/shop/fire-extinguishers');await addProduct(page,2);await savedCart(page,{'safety-helmets':3,'fire-extinguishers':2});
 await visit(page,'/ar/cart');await cartRow(page,'safety-helmets').locator('input[type="number"]').fill('4');await savedCart(page,{'safety-helmets':4,'fire-extinguishers':2});
 await savedSelection(page,{'safety-helmets':true,'fire-extinguishers':true});await selectedTotal(page,['safety-helmets','fire-extinguishers']);
 await shoppingScreenshots(page,'cart','cart-filled');

 await cartRow(page,'fire-extinguishers').locator('input[type="checkbox"]').uncheck();
 await savedSelection(page,{'safety-helmets':true,'fire-extinguishers':false});await selectedTotal(page,['safety-helmets']);
 await until(()=>page.locator('.cart-select-all input[type="checkbox"]').first().evaluate(element=>element.indeterminate),'Select all must express a partial selection');
 await shoppingScreenshots(page,'cart','cart-selected');
 const selectAll=page.locator('.cart-select-all input[type="checkbox"]').first();
 await selectAll.check();await savedSelection(page,{'safety-helmets':true,'fire-extinguishers':true});await selectedTotal(page,['safety-helmets','fire-extinguishers']);
 await selectAll.uncheck();await savedSelection(page,{'safety-helmets':false,'fire-extinguishers':false});await selectedTotal(page,[]);
 assert.ok(await page.locator('.cart-summary-checkout').isDisabled(),'Checkout must be disabled with no selected items');
 assert.ok(await page.locator('.cart-checkout-action').isDisabled(),'Mobile checkout must be disabled with no selected items');
 assert.ok(await page.locator('.remove-selected').isDisabled(),'An empty selection cannot remove other items');
 await cartRow(page,'safety-helmets').locator('input[type="checkbox"]').check();await savedSelection(page,{'safety-helmets':true,'fire-extinguishers':false});
 const selectedBasket=await cartSnapshot(page);
 await page.locator('.cart-summary-checkout').click();await page.waitForURL('**/en/checkout');
 await displayedQuantity(page,'safety-helmets',4);assert.equal(await cartRow(page,'fire-extinguishers').count(),0,'Checkout must omit an unselected item');
 await demoCheckout(page);assert.deepEqual(await cartSnapshot(page),selectedBasket,'Reviewing a selection must preserve the rest of the basket');

 await page.setViewportSize({width:390,height:844});await visit(page,'/ar/cart');
 await cartRow(page,'safety-helmets').locator('a.line-name').click();await page.waitForURL('**/ar/shop/safety-helmets');
 await page.goBack({waitUntil:'domcontentloaded'});await displayedQuantity(page,'safety-helmets',4);await displayedQuantity(page,'fire-extinguishers',2);
 await savedSelection(page,{'safety-helmets':true,'fire-extinguishers':false});
 await page.reload({waitUntil:'domcontentloaded'});await displayedQuantity(page,'safety-helmets',4);await displayedQuantity(page,'fire-extinguishers',2);await savedSelection(page,{'safety-helmets':true,'fire-extinguishers':false});
 await switchShoppingLanguage(page,'/en/cart');await displayedQuantity(page,'safety-helmets',4);
 await savedSelection(page,{'safety-helmets':true,'fire-extinguishers':false});await selectedTotal(page,['safety-helmets']);
 const other=await context.newPage();await visit(other,'/en/cart');
 await savedSelection(other,{'safety-helmets':true,'fire-extinguishers':false});
 await cartRow(page,'fire-extinguishers').locator('input[type="checkbox"]').check();await savedSelection(other,{'safety-helmets':true,'fire-extinguishers':true});
 await cartRow(other,'safety-helmets').locator('input[type="checkbox"]').uncheck();await savedSelection(page,{'safety-helmets':false,'fire-extinguishers':true});
 await cartRow(page,'fire-extinguishers').locator('input[type="checkbox"]').uncheck();await savedSelection(other,{'safety-helmets':false,'fire-extinguishers':false});
 await cartRow(page,'safety-helmets').locator('input[type="number"]').fill('5');await savedCart(page,{'safety-helmets':5,'fire-extinguishers':2});
 await visit(other,'/en/shop/safety-helmets');
 await addProduct(other);await savedCart(other,{'safety-helmets':6,'fire-extinguishers':2});await displayedQuantity(page,'safety-helmets',6);
 await savedSelection(page,{'safety-helmets':true,'fire-extinguishers':false});
 await visit(other,'/en/cart');await other.locator('.remove-selected').click();
 await savedCart(page,{'fire-extinguishers':2});await savedSelection(page,{'fire-extinguishers':false});
 await until(async()=>await cartRow(page,'safety-helmets').count()===0,'Removing selected items must propagate to another tab');
 await cartRow(other,'fire-extinguishers').locator('button.remove-button').click();await savedCart(page,{});
 await until(async()=>await cartRow(page,'fire-extinguishers').count()===0,'Removing one item must propagate to another tab');await other.close();
 report.checks.push({name:'Select one/all/none, exact selected totals and checkout, selection persistence across product/back/reload/language/tabs, and selected-only removal',status:'passed'});

 await visit(page,'/en/shop/safety-helmets');await addProduct(page);await savedCart(page,{'safety-helmets':1});
 await visit(page,'/en/checkout');await demoCheckout(page);
 await layout(page,'/en/checkout',1440);await screenshot(page,'en-checkout-filled-1440');
 await visit(page,'/ar/checkout');await demoCheckout(page);
 await layout(page,'/ar/checkout',390);await screenshot(page,'ar-checkout-filled-390');

 const basketBeforeBuyNow=await cartSnapshot(page);
 await visit(page,'/ar/shop/safety-helmets');
 const buyActions=page.locator('main .product-actions:not(.small)').first();
 await buyActions.locator('input[type="number"]').fill('3');await buyActions.locator('button.buy-now').click();await page.waitForURL('**/ar/checkout?intent=buy-now');
 await savedBuyNow(page,'safety-helmets',3);await displayedQuantity(page,'safety-helmets',3);await demoCheckout(page);
 assert.equal(await page.locator('.checkout-grid .cart-line').count(),1,'Buy now must show only the chosen product');
 assert.deepEqual(await cartSnapshot(page),basketBeforeBuyNow,'Buy now must not add to or replace the existing basket');
 await page.goBack({waitUntil:'domcontentloaded'});await page.waitForURL('**/ar/shop/safety-helmets');
 const returnedBuyActions=page.locator('main .product-actions:not(.small)').first();
 await until(async()=>!(await returnedBuyActions.locator('button.buy-now').isDisabled()),'Returning from checkout must make Buy now available again');
 assert.deepEqual(await cartSnapshot(page),basketBeforeBuyNow,'Returning to the product must preserve the existing basket');
 await returnedBuyActions.locator('input[type="number"]').fill('3');await returnedBuyActions.locator('button.buy-now').click();await page.waitForURL('**/ar/checkout?intent=buy-now');
 await savedBuyNow(page,'safety-helmets',3);await displayedQuantity(page,'safety-helmets',3);
 assert.deepEqual(await cartSnapshot(page),basketBeforeBuyNow,'Buying again after Back must leave basket quantities and selection unchanged');
 await cartRow(page,'safety-helmets').locator('input[type="number"]').fill('4');await savedBuyNow(page,'safety-helmets',4);
 assert.deepEqual(await cartSnapshot(page),basketBeforeBuyNow,'Editing a Buy now quantity must not edit the basket');
 await page.reload({waitUntil:'domcontentloaded'});await displayedQuantity(page,'safety-helmets',4);await savedBuyNow(page,'safety-helmets',4);
 await switchShoppingLanguage(page,'/en/checkout?intent=buy-now');await displayedQuantity(page,'safety-helmets',4);
 assert.deepEqual(await cartSnapshot(page),basketBeforeBuyNow,'Switching language must preserve the independent purchase and basket');
 await shoppingScreenshots(page,'checkout?intent=buy-now','checkout-buy-now');await demoCheckout(page);
 await page.locator('.header-tool.bag').click();await page.waitForURL('**/en/cart');await displayedQuantity(page,'safety-helmets',1);
 await savedSelection(page,{'safety-helmets':true});assert.deepEqual(await cartSnapshot(page),basketBeforeBuyNow,'Returning to the basket must restore its original quantity and selection');
 await page.goBack({waitUntil:'domcontentloaded'});await displayedQuantity(page,'safety-helmets',4);await demoCheckout(page);
 assert.equal(new URL(page.url()).searchParams.get('intent'),'buy-now','Back navigation must keep the independent purchase intent');
 // Prove the demo guard independently of the general order switch. This flag
 // belongs only to the disposable database, and no order request is permitted.
 await setSetting('orderEnabled',true);await visit(page,'/en/checkout?intent=buy-now');await demoCheckout(page);await setSetting('orderEnabled',false);
 report.checks.push({name:'Buy now uses the exact chosen quantity, survives reload/language/back navigation, permits isolated quantity edits, and leaves the saved basket unchanged',status:'passed'});

 await visit(page,'/en/cart');await cartRow(page,'safety-helmets').locator('button.remove-button').click();await savedCart(page,{});
 await page.reload({waitUntil:'domcontentloaded'});await page.locator('main .empty-state').waitFor({state:'visible'});
 report.checks.push({name:'Non-blocking add, rapid additions, quantities, icon navigation, mobile fixed-bar geometry and protected demo checkout without billing or order requests',status:'passed'});
 console.log('PASS: selected guest cart, independent Buy now and protected demo checkout');

 // Exercise the fallback with the browser Storage API actually refusing writes.
 await visit(page,'/en/shop/safety-helmets');
 await page.evaluate(()=>{const original=Storage.prototype.setItem;window.restoreCartWrites=()=>{Storage.prototype.setItem=original;delete window.restoreCartWrites;};Storage.prototype.setItem=function(key,value){if(key==='safeplaces-store')throw new DOMException('Test storage failure','QuotaExceededError');return original.call(this,key,value);};});
 await addProduct(page);await addProduct(page);
 await until(async()=>await page.locator('.header-tool.bag b').textContent()==='2','The in-memory cart must survive failed writes');
 const storageFailureURL=page.url();await page.locator('main .product-actions:not(.small) input[type="number"]').fill('7');await page.locator('main .product-actions:not(.small) button.buy-now').click();
 await page.locator('.toast').waitFor({state:'visible'});await stable(page);
 assert.equal(page.url(),storageFailureURL,'Buy now must not navigate when its independent purchase cannot be saved');
 assert.equal(await page.locator('.header-tool.bag b').textContent(),'2','A failed Buy now must preserve in-memory cart quantities');
 await page.evaluate(()=>window.restoreCartWrites());await addProduct(page);await savedCart(page,{'safety-helmets':3});
 await visit(page,'/en/cart');await cartRow(page,'safety-helmets').locator('button.remove-button').click();await savedCart(page,{});
 report.checks.push({name:'Failed storage writes preserve rapid additions, prevent a lost Buy now navigation, and recover without losing quantities',status:'passed'});

 // Only the disposable test database receives an approved price/order flag.
 // No order is submitted: hold real local review responses to test stale totals.
 await db.prepare("UPDATE products SET kind='direct',price=11500 WHERE slug='safety-helmets'").run();
 await db.prepare("UPDATE products SET kind='direct',price=5750 WHERE slug='fire-extinguishers'").run();await setSetting('orderEnabled',true);
 await visit(page,'/en/shop/safety-helmets');await addProduct(page);
 await visit(page,'/en/shop/fire-extinguishers');await addProduct(page,2);await visit(page,'/en/cart');
 await cartRow(page,'fire-extinguishers').locator('input[type="checkbox"]').uncheck();await savedSelection(page,{'safety-helmets':true,'fire-extinguishers':false});
 const held=[];
 await page.route('**/api/checkout/review',async route=>{
  const response=await route.fetch();let release;const wait=new Promise(resolve=>{release=resolve;});
  const pending={body:route.request().postDataJSON(),response,release,delivered:false};held.push(pending);
  await wait;await route.fulfill({response});pending.delivered=true;
 });
 const release=async(index)=>{held[index].release();await until(()=>held[index].delivered,'Review response did not reach the browser');await stable(page);};
 await visit(page,'/en/checkout');await until(()=>held.length===1,'Initial checkout review was not requested');
 assert.deepEqual(held[0].body.items,[{id:'catalog-safety-helmets',quantity:1}],'The server must review exact selected product IDs and quantities, without unselected items or client-supplied prices');
 assert.equal(await cartRow(page,'fire-extinguishers').count(),0,'Live local checkout must omit unselected products');
 const submit=page.locator('.checkout-grid > form button.primary');const total=page.locator('.order-summary .total-line.final');
 assert.ok(await submit.isDisabled());await release(0);await until(async()=>!(await submit.isDisabled()),'Reviewed local cart should be eligible for submission');
 await cartRow(page,'safety-helmets').locator('input[type="number"]').fill('2');await until(()=>held.length===2,'Quantity update did not request review');
 assert.equal(await total.count(),0,'A changed basket must not show its previous total');assert.ok(await submit.isDisabled(),'A changed basket must await its own review');
 await cartRow(page,'safety-helmets').locator('input[type="number"]').fill('3');await until(()=>held.length===3,'Second quantity update did not request review');
 await release(2);await until(async()=>!(await submit.isDisabled()),'Latest review should be accepted');
 const latestTotal=await total.textContent();assert.match(latestTotal,/345\.00/);
 await release(1);assert.equal(await total.textContent(),latestTotal,'An older response must not replace the latest reviewed total');
 await page.locator('.coupon-form input').fill('INVALID_BROWSER_TEST');await page.locator('.coupon-form button').click();await until(()=>held.length===4,'Coupon update did not request review');
 assert.equal(await total.count(),0);assert.ok(await submit.isDisabled());await release(3);await page.locator('.checkout-grid .form-error').waitFor({state:'visible'});assert.ok(await submit.isDisabled());
 await page.unroute('**/api/checkout/review');await setSetting('orderEnabled',false);
 report.checks.push({name:'Changed quantity/coupon invalidates totals immediately and late review responses cannot enable stale checkout',status:'passed'});
 console.log('PASS: checkout review timing, late-response isolation and coupon rejection');

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
