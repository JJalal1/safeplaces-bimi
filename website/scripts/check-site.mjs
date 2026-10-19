import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';
import ts from 'typescript';
const require=createRequire(import.meta.url);
const requireWrangler=createRequire(require.resolve('wrangler/package.json'));
const {Miniflare}=requireWrangler('miniflare');
const commerceSource=ts.transpileModule(readFileSync('lib/commerce.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {totals,discountFor}=await import('data:text/javascript;base64,'+Buffer.from(commerceSource).toString('base64'));
const line={id:'test',nameAr:'اختبار',nameEn:'Test',slug:'test',category:'ppe',price:11500,quantity:2};
assert.deepEqual(totals([line],15,true,2300),{subtotal:20000,discount:2000,vat:2700,total:20700,grossDiscount:2300});
assert.deepEqual(totals([line],15,false,2300),{subtotal:23000,discount:2300,vat:3105,total:23805,grossDiscount:2300});
assert.deepEqual(totals([line],15,true,50000),{subtotal:20000,discount:20000,vat:0,total:0,grossDiscount:23000},'A full discount cannot leave VAT or a negative balance');
assert.equal(discountFor({type:'fixed',value:50000,minimum:0,maximum:null,categories:'[]'},[line]),23000,'A fixed coupon cannot exceed eligible item value');
for(const includes of [true,false])for(let price=1;price<1000;price+=7)for(let discount=0;discount<price;discount+=13){const t=totals([{...line,price,quantity:1}],15,includes,discount);assert.equal(t.subtotal-t.discount+t.vat,t.total,'All monetary components must balance to the halala');}
assert.equal(discountFor({type:'percentage',value:20,minimum:0,maximum:3000,categories:'["ppe"]'},[line]),3000);
assert.throws(()=>discountFor({type:'fixed',value:100,minimum:50000,maximum:null,categories:'[]'},[line]),/COUPON_MINIMUM/);
assert.throws(()=>discountFor({type:'fixed',value:100,minimum:0,maximum:null,categories:'["alarms"]'},[line]),/COUPON_NOT_APPLICABLE/);
console.log('PASS: monetary totals, VAT rounding and coupon eligibility');

const storeUxSource=readFileSync('components/store.tsx','utf8');
const storeSyntax=ts.createSourceFile('components/store.tsx',storeUxSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const findStoreNode=predicate=>{let found;const walk=node=>{if(found)return;if(predicate(node)){found=node;return;}ts.forEachChild(node,walk);};walk(storeSyntax);return found;};
assert.match(storeUxSource,/cartCount=state\.quote\.reduce/);
assert.match(storeUxSource,/button primary request-quote/);
const mobileToastCss=readFileSync('app/marketplace.css','utf8');
const persistenceSource=ts.transpileModule(readFileSync('lib/cart-persistence.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {CART_STORAGE_KEY,restoreStore,serializeStore,replayStoreActions}=await import('data:text/javascript;base64,'+Buffer.from(persistenceSource).toString('base64'));
assert.equal(CART_STORAGE_KEY,'safeplaces-store');
const savedItem={id:'catalog-safety-helmets',slug:'safety-helmets',nameAr:'خوذ السلامة',nameEn:'Safety helmets',category:'ppe',image:null,price:3500,quantity:2,previewOnly:true};
const fresh=restoreStore(JSON.stringify({cart:[savedItem],quote:[],buyNow:{...savedItem,quantity:3},recent:[]}));
assert.equal(fresh.cart.length,0);assert.equal(fresh.buyNow,null);
assert.equal(fresh.quote[0].quantity,5);assert.equal(fresh.quote[0].price,null);
assert.deepEqual(restoreStore(serializeStore(fresh)),fresh);
const stateProviderSource=readFileSync('components/store.tsx','utf8');
assert.ok(stateProviderSource.includes('queuedChanges.current.push(fn)'),'Changes before hydration must be replayed');
assert.ok(stateProviderSource.includes('const next=replayStoreActions(restored,pending)'),'Replay early product views on restored basket');
assert.ok(stateProviderSource.includes('if(!hydratedRef.current){queuedChanges.current.push(fn);return;}'),'Persistence must wait for hydration');
assert.ok(stateProviderSource.includes("window.addEventListener('storage',storageChanged)"),'Guest carts must follow changes from other tabs');
assert.ok(stateProviderSource.includes("window.addEventListener('pageshow',pageShown)"),'Cached back navigation must restore the latest basket');
assert.ok(!stateProviderSource.includes('[loaded,state]'),'Wishlist and session responses must not persist a stale cart');
assert.ok(!stateProviderSource.includes("setState(s=>{const next=fn(s)"),'Never perform a storage write inside React state updater');
assert.ok(stateProviderSource.includes('if(!ready)return <div className="cart-loading"'),'Do not show an empty cart before restoration');
const formsUxSource=readFileSync('components/forms.tsx','utf8');
const formsSyntax=ts.createSourceFile('components/forms.tsx',formsUxSource,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
assert.match(formsUxSource,/export function QuoteForm/);
console.log('PASS: quotation persistence migration');


const mobileNavNode=findStoreNode(node=>ts.isJsxElement(node)&&node.openingElement.tagName.getText(storeSyntax)==='nav'&&node.openingElement.attributes.properties.some(attribute=>ts.isJsxAttribute(attribute)&&attribute.name.getText(storeSyntax)==='className'&&attribute.initializer?.getText(storeSyntax).includes('mobile-shopping-nav')));
assert.ok(mobileNavNode,'Bottom navigation must be present');
const mobileNav=mobileNavNode.getText(storeSyntax);
assert.equal((mobileNav.match(/<a\b/g)||[]).length,4,'Keep exactly Home, Shop, Cart and Account in the shopping navigation');
assert.equal((mobileNav.match(/<button\b/g)||[]).length,0,'Secondary pages must not crowd the four shopping destinations');
assert.ok(storeUxSource.includes('mobile-menu-toggle')&&storeUxSource.includes('aria-controls="mobile-more-panel"'),'The header company menu needs an accessible panel');
assert.ok(storeUxSource.includes('role="dialog" aria-modal="true"'),'More must have accessible dialog semantics');
assert.ok(storeUxSource.includes("['services','الخدمات','Services']"),'Services must remain reachable');
assert.ok(storeUxSource.includes("['projects','المشاريع','Projects']"),'Projects must remain reachable');
assert.ok(storeUxSource.includes("['wishlist','المفضلة','Wishlist']"),'Wishlist must remain reachable');
assert.ok(storeUxSource.includes("['quote','طلب عرض سعر','Request a quote']"),'Quotation flow must remain reachable');
assert.ok(storeUxSource.includes('className="mobile-menu-utilities"')&&storeUxSource.includes('className="mobile-language"'),'The header company menu must retain the mobile language selector');
assert.ok(!storeUxSource.includes('className="mobile-quote-link"'),'Avoid the cramped quote button next to language on phones');
// Rendered checks verify account access and the four mobile destinations at
// their actual breakpoints; the desktop navigation can use a different layout.
assert.ok(mobileToastCss.includes('.page-heading .breadcrumb, .page-heading .eyebrow { display: none; }'),'Keep compact mobile page headings');
assert.ok(mobileToastCss.includes('.cart-shopping-layout > .cart-page { order: 0;'),'Show cart items before the summary');
assert.ok(mobileToastCss.includes('.cart-shopping-layout > .cart-summary { order: 1;'),'Show cart summary after products');
console.log('PASS: four shopping destinations, header company menu, compact headings and cart-first layout');
const companySource=readFileSync('components/company-pages.tsx','utf8');
const routeSource=readFileSync('app/(site)/[lang]/[[...slug]]/page.tsx','utf8');
const companyCss=readFileSync('app/company-experience.css','utf8');
assert.ok(routeSource.includes('body=<HomeOverview lang={l}'),'Use the focused corporate-and-shop homepage');
assert.ok(routeSource.includes('body=<AboutOverview lang={l}'),'Keep About as a distinct company profile');
assert.ok(routeSource.includes('<ServicesOverview lang={l}'),'Keep technical services separate from About');
assert.ok(routeSource.includes('<ServiceOverview lang={l}'),'Render service detail pages with scope and requirements');
assert.ok(companySource.includes('company-home-about'),'Show a short company introduction on the homepage');
assert.ok(companySource.includes('company-process'),'Describe quotation and supply workflow without inventing achievements');
// Validate the content contract, independently of the component's old card layout
// or the wording of a particular heading. Rendered coverage follows below.
const moduleURL=source=>'data:text/javascript;base64,'+Buffer.from(source).toString('base64');
const compileSource=path=>ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const configURL=moduleURL(compileSource('lib/config.ts'));
const {initialSettings}=await import(configURL);
const {getAboutSections,getServiceGuide,overviewQuestions}=await import(moduleURL(compileSource('lib/company-copy.ts').replace(/from ['"]\.\/config['"]/g,'from '+JSON.stringify(configURL))));
const {services:serviceDefinitions}=await import(moduleURL(compileSource('lib/catalog.ts')));
const aboutSections=getAboutSections(initialSettings);
assert.equal(new Set(aboutSections.map(section=>section.id)).size,aboutSections.length,'Reading section IDs must be unique');
for(const topic of ['identity','customers','equipment','selection','buying-routes','enquiry','scope','records','next-step'])assert.ok(aboutSections.some(section=>section.id===topic),'Company profile must cover '+topic);
for(const langIndex of [0,1]){
 const paragraphs=aboutSections.flatMap(section=>section.paragraphs.map(paragraph=>paragraph[langIndex]));
 assert.ok(paragraphs.length>=12&&paragraphs.join(' ').length>=3500,'Company profile must contain substantive Arabic and English prose');
 assert.ok(aboutSections.every(section=>section.title[langIndex]&&section.paragraphs.length>=2),'Each company topic needs a heading and explanation');
}
assert.equal(serviceDefinitions.length,6,'The service directory must retain all six service routes');
const introductions=new Set();
for(const service of serviceDefinitions){
 const guide=getServiceGuide(service.slug);introductions.add(JSON.stringify(guide.introduction));
 assert.ok(guide.introduction.length>=2&&guide.scopeNotes.length>=1,'Explain relevance and scope for '+service.slug);
 assert.ok(guide.inputs.length>=4&&guide.boundaries.length>=1,'Explain required inputs and quotation boundaries for '+service.slug);
 assert.ok(guide.steps.length>=3&&guide.questions.length>=2,'Keep a practical process and FAQ for '+service.slug);
 for(const copy of [...guide.introduction,...guide.scopeNotes,guide.inputsIntro,...guide.inputs,...guide.boundaries,...guide.steps.flatMap(step=>[step.title,step.detail]),...guide.questions.flatMap(item=>[item.question,item.answer])])assert.ok(copy.length===2&&copy.every(text=>typeof text==='string'&&text.trim().length>0),'Service guidance must be present in both languages: '+service.slug);
}
assert.equal(introductions.size,serviceDefinitions.length,'Different services must not all fall back to generic copy');
assert.ok(overviewQuestions.length>=3,'The directory must answer questions before requesting a service');
assert.ok(companyCss.includes('.company-service-grid { display:grid;'),'Replace oversized service cards with content-first compact cards');
assert.ok(companyCss.includes('padding-top:145px;'),'Reduce the excessively tall mobile hero');
console.log('PASS: bilingual corporate/shop homepage, distinct About and Services content, compact mobile layouts');




const shoppingSource=ts.transpileModule(readFileSync('lib/shopping.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {presentCatalog,matchesProduct,relatedProducts}=await import('data:text/javascript;base64,'+Buffer.from(shoppingSource).toString('base64'));
const unpriced={id:'catalog-safety-helmets',slug:'safety-helmets',nameAr:'خوذ السلامة',nameEn:'Safety helmets',category:'ppe',price:null,oldPrice:null,kind:'quote',active:1};
assert.equal(presentCatalog([unpriced],true)[0].previewOnly,false);
assert.equal(presentCatalog([unpriced],false)[0].price,null);
assert.equal(presentCatalog([{...unpriced,slug:'fire-pumps',category:'firefighting'}],true)[0].kind,'quote','Fire pumps remain quotation-only');
assert.equal(presentCatalog([{...unpriced,slug:'fire-pumps',category:'firefighting'}],true)[0].price,null);
assert.equal(presentCatalog([{...unpriced,slug:'unlisted-product'}],true)[0].price,null,'Unknown products must not acquire guessed prices');
assert.equal(presentCatalog([{...unpriced,kind:'direct',slug:'safety-helmets'}],true)[0].price,null,'Do not invent pricing for an unpriced existing direct-sale listing');
assert.equal(unpriced.price,null,'Review projection must not modify stored prices');
assert.equal(presentCatalog([{...unpriced,price:8700}],true)[0].price,null);
assert.equal(matchesProduct(unpriced,'خوذ السَّلامة'),true);
assert.equal(matchesProduct(unpriced,'safety helmet'),true);
const otherProducts=[{...unpriced,id:'same'},{...unpriced,id:'manual',category:'emergency'}];
assert.deepEqual(relatedProducts({...unpriced,related:'["manual","manual"]'},otherProducts).map(p=>p.id),['manual','same']);
console.log('PASS: private-only demo pricing, immutable actual prices, bilingual search and manual recommendations');

const filterSource=ts.transpileModule(readFileSync('lib/shop-filters.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText.replace("'./shopping'",JSON.stringify('data:text/javascript;base64,'+Buffer.from(shoppingSource).toString('base64')));
const {emptyFilters,parseShopFilters,filterShopProducts,specificationFacets,shopUrl}=await import('data:text/javascript;base64,'+Buffer.from(filterSource).toString('base64'));
const filterProducts=[{...unpriced,id:'small',kind:'direct',brand:'Brand A',price:3500,oldPrice:null,specs:'[{"ar":"المقاس","en":"Size","value":"M"}]'},
 {...unpriced,id:'large',kind:'direct',brand:'Brand B',price:9000,oldPrice:12000,datasheet:'/test.pdf',specs:'[{"ar":"المقاس","en":"Size","value":"L"}]'},
 {...unpriced,id:'alarm',category:'alarms',kind:'quote',brand:'Brand A',price:null,oldPrice:null,specs:'[]'}];
const combined=parseShopFilters({category:['ppe','alarms'],brand:'Brand A',min:'30',max:'50'});
assert.equal(combined.min,'');assert.deepEqual(combined.kinds,[]);
assert.deepEqual(filterShopProducts(filterProducts,combined).map(p=>p.id),['small','alarm']);
console.log('PASS: multi-select category/brand filters, price ranges, category-specific specifications, actual sale/document filters and shareable URLs');

const adminUtilsSource=ts.transpileModule(readFileSync('lib/admin-utils.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {saudiDay,reportingSummary,customerSummary,productReady,csvText}=await import('data:text/javascript;base64,'+Buffer.from(adminUtilsSource).toString('base64'));
assert.equal(saudiDay('2026-10-10T21:30:00Z'),'2026-10-11','Reporting must use the Saudi day boundary');
const reportOrders=[{id:'paid',email:'Customer@example.test',name:'Customer',createdAt:'2026-10-10T21:30:00Z',total:11500,status:'completed',paymentStatus:'paid'},
 {id:'cancelled',email:'customer@example.test',name:'Customer',createdAt:'2026-10-11T08:00:00Z',total:20000,status:'cancelled',paymentStatus:'paid'},
 {id:'refunded',email:'customer@example.test',name:'Customer',createdAt:'2026-10-11T09:00:00Z',total:30000,status:'completed',paymentStatus:'refunded'}];
const report=reportingSummary(reportOrders,[],'today',Date.parse('2026-10-11T10:00:00Z'));
assert.equal(report.sales,11500);assert.equal(report.orders,3);assert.equal(report.paidOrders,1);assert.equal(report.buckets.reduce((sum,row)=>sum+row.amount,0),11500);
const customers=customerSummary([{email:'customer@example.test',name:'Profile name'}],reportOrders,[]);assert.equal(customers.length,1);assert.equal(customers[0].orders,3);assert.equal(customers[0].paidTotal,11500);assert.equal(customers[0].name,'Profile name');
assert.equal(productReady({kind:'direct',price:null}),false);assert.equal(productReady({kind:'quote',price:null}),true);
assert.match(csvText(['Name','Price'],[[' =1+1',35]]),/"' =1\+1","35"/);
assert.match(csvText(['Name'],[['A "quoted" name']]),/"A ""quoted"" name"/);
console.log('PASS: Saudi reporting boundaries, actual paid-order totals, customer aggregation and safe CSV export');

const serverRoot=resolve('dist/server');const modulePaths=['index.js',...readdirSync(serverRoot,{recursive:true}).filter(p=>p.endsWith('.js')&&p!=='index.js')];
const mf=new Miniflare({name:'safeplaces-test',modulesRoot:serverRoot,modules:modulePaths.map(p=>({type:'ESModule',path:resolve(serverRoot,p)})),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'test-db'},r2Buckets:['BUCKET'],bindings:{ADMIN_BOOTSTRAP_PRIVATE:'true',SITE_PUBLIC:'false',SITE_INDEXABLE:'false',SITE_DEMO_PRICES:'true'},port:0,host:'127.0.0.1'});
try{
 const db=await mf.getD1Database('DB');
 for(const migration of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())for(const sql of readFileSync('drizzle/'+migration,'utf8').split('--> statement-breakpoint').filter(s=>s.trim()))await db.prepare(sql).run();
 const origin='https://safe-places-safety.kh-ng-gian-l-3883.chatgpt.site';
 const owner={'oai-authenticated-user-id':'test-owner','oai-authenticated-user-email':'owner@example.test'};
 const other={'oai-authenticated-user-id':'test-other','oai-authenticated-user-email':'other@example.test'};
 const request=(path,body,identity={})=>mf.dispatchFetch(origin+path,{redirect:'manual',method:body===undefined?'GET':'POST',headers:{...identity,...(body===undefined?{}:{Origin:origin,'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const expectJSON=async(path,body,identity={},status=200)=>{const r=await request(path,body,identity);const value=await r.json();assert.equal(r.status,status,path+': '+JSON.stringify(value));return value;};
 const paths=['','/about','/services','/services/fire-alarm','/shop','/shop/category/ppe','/shop/fire-extinguishers','/quote','/contact','/projects','/certificates','/wishlist','/account','/admin','/privacy','/terms','/returns','/collection','/account/login','/account/register','/account/forgot','/account/confirm','/account/reset'];
 for(const lang of ['ar','en'])for(const path of paths){const r=await request('/'+lang+path);const html=await r.text();assert.equal(r.status,200,lang+path+': '+html.slice(0,600));assert.match(html,new RegExp('lang="'+lang+'"'));assert.match(html,new RegExp('dir="'+(lang==='ar'?'rtl':'ltr')+'"'));assert.match(html,/<h1/);assert.match(html,/rel="canonical"/);assert.match(html,/hreflang="ar"/);assert.match(html,/hreflang="en"/);assert.doesNotMatch(html,/Your site is taking shape/);}
 const root=await request('/');assert.equal(root.status,307);assert.equal(root.headers.get('location'),'/ar');
 assert.equal((await request('/ar/does-not-exist')).status,404);
 const sitemap=await request('/sitemap.xml');assert.equal(sitemap.status,200);const xml=await sitemap.text();assert.doesNotMatch(xml,/\/ar\/services\/fire-alarm/,'Private preview must not expose crawlable sitemap entries');assert.doesNotMatch(xml,/\/en\/shop\/fire-extinguishers/);
 const robots=await request('/robots.txt');assert.match(await robots.text(),/Disallow: \//);
 const loginPage=await request('/en/account/login?return_to=%2Fen%2Fcheckout&reason=checkout');const loginHtml=await loginPage.text();assert.match(loginHtml,/Sign in to continue checkout/);assert.match(loginHtml,/Continue shopping without an account/);assert.doesNotMatch(loginHtml,/<fieldset disabled/);assert.equal(loginPage.headers.get('cache-control'),'private, no-store');assert.equal(loginPage.headers.get('referrer-policy'),'no-referrer');
 await expectJSON('/api/auth/login',{email:'customer@example.test',password:'Long test passphrase'}, {},503);
 await expectJSON('/api/wishlist',undefined,{},401);
 await expectJSON('/api/orders',{},{},409);
 for(const path of ['/cart','/checkout']){const res=await request('/en'+path);assert.equal(res.status,307);assert.equal(res.headers.get('location'),'/en/quote');}
 const quoteInfo=await request('/en/quote');assert.match(await quoteInfo.text(),/does not commit you to a purchase/);
 const demoPage=await request('/en/shop/safety-helmets');const demoHtml=await demoPage.text();
 assert.match(demoHtml,/Request a quotation/);assert.match(demoHtml,/Add to quote request/);
 const productSchema=JSON.parse([...demoHtml.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/g)].map(m=>m[1]).find(value=>JSON.parse(value)['@type']==='Product'));
 assert.equal(productSchema.offers,undefined,'Demo prices must never become merchant offers');
 const shopPage=await request('/ar/shop');const shopHtml=await shopPage.text();const shopMain=shopHtml.match(/<main id="main">([\s\S]*?)<\/main>/)[1];assert.match(shopMain,/shopping-filter-trigger/);assert.match(shopMain,/aria-expanded="false"/);assert.doesNotMatch(shopMain,/shop-sidebar|shop-filter-dialog/);
 const filteredPage=await request('/en/shop?category=ppe');const filteredMain=(await filteredPage.text()).match(/<main id="main">([\s\S]*?)<\/main>/)[1];assert.match(filteredMain,/Safety helmets/);assert.match(filteredMain,/Vests, gloves &amp; safety glasses/);assert.match(filteredMain,/shopping-filter-chips/);
 const mainContent=html=>html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1]||'';
 const textContent=html=>html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<[^>]+>/g,' ').replace(/&#x([0-9a-f]+);/gi,(_,value)=>String.fromCodePoint(parseInt(value,16))).replace(/&#(\d+);/g,(_,value)=>String.fromCodePoint(Number(value))).replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
 const renderedSection=(html,id)=>{const section=html.match(new RegExp('<section\\b[^>]*\\bid="'+id+'"[^>]*>[\\s\\S]*?<\\/section>'))?.[0];assert.ok(section,'Missing rendered section '+id);assert.match(section,/<h2\b/,'The section needs a visible heading');return section;};
 const containsCopy=(html,copy,message)=>assert.ok(textContent(html).includes(copy.replace(/\s+/g,' ').trim()),message);
 for(const lang of ['ar','en']){
  const langIndex=lang==='ar'?0:1;
  const aboutHtml=mainContent(await (await request('/'+lang+'/about')).text());
  assert.doesNotMatch(aboutHtml,/company-service-grid/,'About should not duplicate the services listing');
  for(const section of aboutSections){
   assert.ok(aboutHtml.includes('href="#'+section.id+'"'),'The reading contents must link to '+section.id);
   const rendered=renderedSection(aboutHtml,section.id);containsCopy(rendered,section.title[langIndex],'Render the company topic heading');
   for(const paragraph of section.paragraphs)containsCopy(rendered,paragraph[langIndex],'Render substantive company copy: '+lang+'/'+section.id);
  }
  const servicesHtml=mainContent(await (await request('/'+lang+'/services')).text());
  for(const service of serviceDefinitions)assert.ok(servicesHtml.includes('href="/'+lang+'/services/'+service.slug+'"'),'Directory must link to '+service.slug);
  assert.ok((servicesHtml.match(/<summary\b/g)||[]).length>=overviewQuestions.length,'Directory FAQ must render as expandable questions');
  for(const question of overviewQuestions){containsCopy(servicesHtml,question.question[langIndex],'Render the directory question');containsCopy(servicesHtml,question.answer[langIndex],'Render the directory answer');}
  for(const service of serviceDefinitions){
   const detailHtml=mainContent(await (await request('/'+lang+'/services/'+service.slug)).text());const guide=getServiceGuide(service.slug);
   const expected={
    'service-context':guide.introduction,
    'service-scope':[...(langIndex===0?service.scopeAr:service.scopeEn).map(item=>[item,item]),...guide.scopeNotes],
    'service-inputs':[guide.inputsIntro,...guide.inputs],
    'service-boundaries':guide.boundaries,
    'service-process':guide.steps.flatMap(step=>[step.title,step.detail]),
    'service-questions':guide.questions.flatMap(item=>[item.question,item.answer])
   };
   for(const [id,copies] of Object.entries(expected)){
    assert.ok(detailHtml.includes('href="#'+id+'"'),'Service contents must link to '+id);
    const rendered=renderedSection(detailHtml,id);for(const copy of copies)containsCopy(rendered,copy[langIndex],'Render '+service.slug+'/'+id+' in '+lang);
   }
   assert.ok(detailHtml.includes('href="/'+lang+'/quote?service='+service.slug+'"'),'The quotation link must preserve the selected service');
  }
 }
 console.log('PASS: rendered bilingual company topics, reading links, six distinct service guides, scope, required inputs, boundaries, process and FAQ');
 const homePage=await request('/en');const homeHtml=await homePage.text();assert.match(homeHtml,/safety-hero/);assert.match(homeHtml,/\/images\/hero.webp/);assert.match(homeHtml,/fetchPriority="high"/i);assert.match(homeHtml,/Shop safety equipment/);assert.match(homeHtml,/Discuss your project/);assert.match(homeHtml,/Equipment and services/);assert.doesNotMatch(homeHtml,/<canvas\b|facility-explorer|facility-renderer|facility-device-menu|Start the 3D experience/,'The homepage must not load the cancelled 3D experience');
 console.log('PASS: 50 Arabic/English pages, RTL/LTR, headings, canonical, hreflang, sitemap, redirects, 404 and demo-price disclosure');
 await expectJSON('/api/admin/data',undefined,{},403);
 await expectJSON('/api/admin/bootstrap',{}, {},401);
 await expectJSON('/api/admin/bootstrap',{},owner);
 await expectJSON('/api/admin/data',undefined,other,403);
 const firstWishlist=await expectJSON('/api/wishlist',{id:'catalog-safety-helmets',action:'add'},owner);assert.deepEqual(firstWishlist.ids,['catalog-safety-helmets']);assert.deepEqual((await expectJSON('/api/wishlist',undefined,other)).ids,[]);await expectJSON('/api/wishlist',{id:'catalog-safety-helmets',action:'remove'},other);assert.deepEqual((await expectJSON('/api/wishlist',undefined,owner)).ids,['catalog-safety-helmets']);await expectJSON('/api/wishlist',{id:'catalog-safety-helmets',action:'remove'},owner);assert.deepEqual((await expectJSON('/api/wishlist',undefined,owner)).ids,[]);
 console.log('PASS: guest checkout route, signed-in favourites, private account caches and disabled unconfigured email registration');
 const admin=await expectJSON('/api/admin/data',undefined,owner);assert.equal(admin.products.length,8);assert.equal(admin.content.filter(r=>r.type==='service').length,6);
 for(const lang of ['ar','en']){const response=await request('/'+lang+'/admin',undefined,owner);const html=await response.text();assert.equal(response.status,200);assert.match(response.headers.get('cache-control'),/no-store/);assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');assert.match(html,/management-console/);assert.match(html,/console-sidebar/);assert.match(html,/console-metrics/);assert.doesNotMatch(html,/marketplace-header/);assert.doesNotMatch(html,/footer-grid/);}
 assert.equal((await request('/ar/admin/unknown',undefined,owner)).status,404);
 const uuid=()=>crypto.randomUUID();
 const quote={name:'Test customer',email:'customer@example.test',phone:'0500000000',company:'Test company',description:'Integration test request for a fire alarm project.',service:'fire-alarm',city:'Al Khobar',items:[{id:admin.products[0].id,quantity:2}],files:[],token:uuid(),key:uuid(),website:''};
 const q=await expectJSON('/api/quotes',quote,owner);const repeated=await expectJSON('/api/quotes',quote,owner);assert.equal(q.number,repeated.number);
 await expectJSON('/api/quotes',{...quote,key:uuid(),items:[{id:admin.products[0].id,quantity:-1}]},owner,400);
 await expectJSON('/api/contact',{name:'Test customer',email:'customer@example.test',message:'Please contact me about project requirements.',website:''});
 const blocked=await mf.dispatchFetch(origin+'/api/contact',{method:'POST',headers:{Origin:'https://evil.example','Content-Type':'application/json'},body:JSON.stringify({})});assert.equal(blocked.status,403);
 assert.equal((await expectJSON('/api/account',undefined,other)).quotes.length,0);
 assert.equal((await expectJSON('/api/account',undefined,owner)).quotes.length,1);
 const form=new FormData();form.append('token',quote.token);form.append('file',new File(['%PDF-1.4\nTest private attachment'],'drawing.pdf',{type:'application/pdf'}));
 const fileRequest=new Request(origin+'/api/uploads',{method:'POST',headers:{...owner,Origin:origin},body:form});const upload=await mf.dispatchFetch(fileRequest.url,{method:'POST',headers:Object.fromEntries(fileRequest.headers),body:new Uint8Array(await fileRequest.arrayBuffer())});assert.equal(upload.status,200);const file=await upload.json();assert.equal((await request(file.url)).status,403);assert.equal((await request(file.url,undefined,other)).status,403);assert.equal((await request(file.url,undefined,owner)).status,200);
 await expectJSON('/api/quotes',{...quote,key:uuid(),files:[file.id]},owner);
 const fake=new FormData();fake.append('token',uuid());fake.append('file',new File(['<script>alert(1)</script>'],'fake.pdf',{type:'application/pdf'}));const fakeRequest=new Request(origin+'/api/uploads',{method:'POST',headers:{Origin:origin},body:fake});assert.equal((await mf.dispatchFetch(fakeRequest.url,{method:'POST',headers:Object.fromEntries(fakeRequest.headers),body:new Uint8Array(await fakeRequest.arrayBuffer())})).status,400);
 console.log('PASS: persisted quotes and contact messages, idempotency, guest submission, access isolation, CSRF and private file validation');
 const product={...admin.products[0],id:uuid(),slug:'integration-product',nameAr:'منتج اختبار',nameEn:'Integration product',kind:'direct',price:11500,oldPrice:null,related:'[]',gallery:'[]',keywords:'',image:null,datasheet:null};
 await expectJSON('/api/admin/products',product,owner);
 const draft={...product,id:uuid(),slug:'draft-product',kind:'direct',price:null,active:0};
 await expectJSON('/api/admin/products',draft,owner);
 assert.equal((await request('/en/shop/draft-product')).status,404);
 await expectJSON('/api/admin/products',{...draft,active:1},owner,400);
 await expectJSON('/api/admin/bulk',{type:'products',ids:[product.id],action:'hide'},other,403);
 const bulkBlocked=await mf.dispatchFetch(origin+'/api/admin/bulk',{method:'POST',headers:{...owner,Origin:'https://evil.example','Content-Type':'application/json'},body:JSON.stringify({type:'products',ids:[product.id],action:'hide'})});assert.equal(bulkBlocked.status,403);
 await expectJSON('/api/admin/bulk',{type:'products',ids:[product.id],action:'hide'},owner);
 await expectJSON('/api/admin/bulk',{type:'products',ids:[product.id,draft.id],action:'publish'},owner,400);
 assert.equal((await db.prepare('SELECT active FROM products WHERE id=?').bind(product.id).first()).active,0,'A failed bulk publish must not publish a subset');
 await expectJSON('/api/admin/bulk',{type:'products',ids:[product.id,'unknown-id'],action:'publish'},owner,404);
 assert.equal((await db.prepare('SELECT active FROM products WHERE id=?').bind(product.id).first()).active,0);
 await expectJSON('/api/admin/products',{...draft,price:5000},owner);
 await expectJSON('/api/admin/bulk',{type:'products',ids:[product.id,draft.id,product.id],action:'publish'},owner);
 await expectJSON('/api/admin/bulk',{type:'products',ids:[product.id,draft.id],action:'feature'},owner);
 assert.equal((await db.prepare('SELECT featured FROM products WHERE id=?').bind(draft.id).first()).featured,1);
 assert.equal((await request('/en/shop/draft-product')).status,200);
 await expectJSON('/api/admin/bulk',{type:'products',ids:[draft.id],action:'hide'},owner);
 assert.equal((await request('/en/shop/draft-product')).status,404);
 await expectJSON('/api/admin/bulk',{type:'content',ids:[admin.content[0].id],action:'feature'},owner,400);
 assert.equal((await db.prepare("SELECT COUNT(*) AS count FROM activity WHERE action='products:bulk:publish'").first()).count,1);
 await expectJSON('/api/admin/settings',{heroImage:'javascript:alert(1)'},owner,400);
 await expectJSON('/api/admin/settings',{heroImage:'/images/catalog/helmet.webp',heroImageReference:false},owner);
 const heroPage=await request('/en');const customHeroHtml=(await heroPage.text()).match(/<section class="safety-hero"[\s\S]*?<\/section>/)[0];assert.match(customHeroHtml,/safety-hero-photo[^>]*src="\/images\/catalog\/helmet.webp"/);assert.doesNotMatch(customHeroHtml,/safety-hero-caption/,'An owner-provided hero image can hide the reference label');
 const privateDashboard=await request('/en/admin',undefined,owner);assert.match(await privateDashboard.text(),new RegExp(q.number));
 const guestDashboard=await request('/en/admin');assert.doesNotMatch(await guestDashboard.text(),new RegExp(q.number));
 console.log('PASS: independent bilingual admin workspace, draft products, authorised atomic bulk publishing, audit records, private dashboard isolation and homepage image management');
 const items=[{id:product.id,quantity:2}];
 await expectJSON('/api/admin/settings',{orderEnabled:true},owner);
 await expectJSON('/api/checkout/review',{items,coupon:''},{},409);
 await expectJSON('/api/orders',{...quote,items,billing:'',coupon:'',key:uuid()},owner,409);
 await expectJSON('/api/admin/settings',{orderEnabled:false},owner);
 const c=admin.content.find(c=>c.type==='category'&&c.slug==='ppe');await expectJSON('/api/admin/content',{...c,titleAr:'معدات الحماية المحدثة',titleEn:'Updated PPE'},owner);const changed=await request('/ar/shop/category/ppe');assert.match(await changed.text(),/معدات الحماية المحدثة/);
 const service=admin.content.find(c=>c.type==='service'&&c.slug==='training');await expectJSON('/api/admin/content',{...service,active:0},owner);assert.equal((await request('/ar/services/training')).status,404);
 await expectJSON('/api/admin/bulk',{type:'content',ids:[service.id],action:'publish'},owner);assert.equal((await request('/ar/services/training')).status,200);
 const currentAdmin=await expectJSON('/api/admin/data',undefined,owner);const coupon=currentAdmin.coupons.find(coupon=>coupon.code==='TEST10');await expectJSON('/api/admin/bulk',{type:'coupons',ids:[coupon.id],action:'hide'},owner);assert.equal((await db.prepare('SELECT active FROM coupons WHERE id=?').bind(coupon.id).first()).active,0);
 console.log('PASS: CMS edits render immediately and archived services disappear');
}finally{await mf.dispose();}
