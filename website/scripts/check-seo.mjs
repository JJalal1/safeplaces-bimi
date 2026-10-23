import assert from 'node:assert/strict';
import {readFileSync,readdirSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';

// The same checks run against the built public Worker and the deployed domain.
// Local fixtures never use production credentials or send requests externally.
const live=process.argv.includes('--live');
const origin='https://safeplaces.sa';
let mf;
const report={mode:live?'live':'isolated-public-worker',pages:[],checks:[],status:'running'};
const internalLinks=new Set();
const decode=value=>value.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#x([\da-f]+);/gi,(_,v)=>String.fromCodePoint(parseInt(v,16))).replace(/&#(\d+);/g,(_,v)=>String.fromCodePoint(Number(v)));
function attributes(tag){return Object.fromEntries([...tag.matchAll(/([\w:-]+)="([^"]*)"/g)].map(m=>[m[1],decode(m[2])]));}
const tags=(html,name)=>[...html.matchAll(new RegExp('<'+name+'\\b[^>]*>','g'))].map(m=>attributes(m[0]));
async function request(path){return live?fetch(origin+path,{redirect:'manual',signal:AbortSignal.timeout(20000)}):mf.dispatchFetch(origin+path,{redirect:'manual'});}
async function page(url){
 const path=new URL(url).pathname;
 const response=await request(path);
 assert.equal(response.status,200,path+' must be an actual public page');
 assert.doesNotMatch(response.headers.get('x-robots-tag')||'',/noindex/i,path+' must be indexable in headers');
 const html=await response.text(),lang=path.split('/')[1];
 const head=html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/)?.[1]||'';
 const title=decode(head.match(/<title>([\s\S]*?)<\/title>/)?.[1]||'');
 const meta=tags(head,'meta'),links=tags(head,'link');
 const description=meta.find(m=>m.name==='description')?.content||'';
 assert.ok(title.length>=12&&title.length<=130,path+' needs a descriptive title');
 assert.ok(description.length>=45&&description.length<=260,path+' needs a useful unique description');
 assert.equal(links.find(l=>l.rel==='canonical')?.href,url,path+' must self-canonicalise');
 for(const code of ['ar','en','x-default'])assert.equal(links.find(l=>l.rel==='alternate'&&l.hrefLang===code||l.rel==='alternate'&&l.hreflang===code)?.href,origin+path.replace(/^\/(ar|en)(?=\/|$)/,'/'+(code==='x-default'?'ar':code)),path+' language alternative '+code);
 assert.ok(meta.some(m=>m.name==='robots'&&m.content.includes('index')&&!m.content.includes('noindex')),path+' robots must permit indexing');
 assert.ok(!meta.some(m=>m.name==='keywords'),'Do not publish keyword stuffing meta tags');
 assert.ok(meta.some(m=>m.property==='og:title'&&m.content),'Open Graph belongs in the initial head');
 assert.ok(meta.some(m=>m.property==='og:description'&&m.content),'Open Graph needs a description');
 assert.equal(response.headers.get('x-frame-options'),'DENY');
 assert.match(response.headers.get('content-security-policy')||'',/frame-ancestors 'none'/);
 for(const image of tags(html,'img'))assert.ok(Object.hasOwn(image,'alt'),path+' image needs an ALT attribute');
 for(const anchor of tags(html,'a')){
  if(!anchor.href||anchor.href==='#')continue;
  const target=new URL(anchor.href,url);
  if(target.origin!==origin||!['https:','http:'].includes(target.protocol))continue;
  if(target.pathname===path&&target.hash){
   const id=decodeURIComponent(target.hash.slice(1));
   assert.ok(tags(html,'section').concat(tags(html,'div'),tags(html,'h2'),tags(html,'h3'),tags(html,'main')).some(t=>t.id===id),path+' broken section link '+target.hash);
  }
  internalLinks.add(target.pathname+target.search);
 }
 const main=html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/)?.[1]||'';
 assert.equal([...main.matchAll(/<h1\b/g)].length,1,path+' needs exactly one main heading');
 const schema=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(m=>JSON.parse(m[1]));
 const org=schema.find(s=>s['@type']==='Organization');
 assert.equal(org?.['@id'],origin+'/#organization');
 assert.ok(org.legalName&&org.telephone&&org.email,'Publish consistent organisation identity');
 if(path==='/'+lang){
  assert.equal(schema.find(s=>s['@type']==='WebSite')?.publisher?.['@id'],org['@id']);
 }else{
  const crumbs=schema.find(s=>s['@type']==='BreadcrumbList')?.itemListElement;
  assert.ok(crumbs?.length>=2,path+' needs an actual breadcrumb trail');
  assert.equal(crumbs.at(-1).item,url,path+' breadcrumb must reach the current page');
  assert.equal(crumbs[0].item,origin+'/'+lang);
  crumbs.forEach((c,index)=>{assert.equal(c.position,index+1);assert.ok(c.name);});
  if(/^\/(ar|en)\/shop\/category\//.test(path))assert.equal(crumbs.length,3);
  if(/^\/(ar|en)\/shop\/(?!category\/).+/.test(path))assert.equal(crumbs.length,4);
 }
 const product=schema.find(s=>s['@type']==='Product');
 if(product){assert.equal(product.url,url);assert.ok(product.name);assert.equal(product.offers,undefined,'Quote-only products must never fabricate a price, offer or stock');assert.equal(product.aggregateRating,undefined);}
 const service=schema.find(s=>s['@type']==='Service');
 if(service){assert.equal(service.url,url);assert.equal(service.provider?.['@id'],org['@id']);}
 if(path.endsWith('/eastern-province')){
  for(const text of lang==='ar'?['الخبر','الدمام','الظهران','المواصفات','الكميات']:['Al Khobar','Dammam','Dhahran','specifications','quantities'])assert.ok(main.includes(text),path+' needs real regional project guidance');
  assert.ok(tags(main,'a').filter(a=>a.href?.includes('/shop/category/')||a.href?.includes('/services/')).length>=6);
 }
 report.pages.push({path,title,description,structuredTypes:schema.map(s=>s['@type'])});
}
try{
 if(!live){
  const require=createRequire(import.meta.url),wranglerRequire=createRequire(require.resolve('wrangler/package.json'));
  const {Miniflare}=wranglerRequire('miniflare');
  const root=resolve('dist/server'),modules=['index.js',...readdirSync(root,{recursive:true}).filter(p=>p.endsWith('.js')&&p!=='index.js')];
  mf=new Miniflare({name:'safeplaces-public-seo-test',modulesRoot:root,modules:modules.map(p=>({type:'ESModule',path:resolve(root,p)})),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],d1Databases:{DB:'seo-test-db'},bindings:{SITE_PUBLIC:'true',SITE_INDEXABLE:'true',PRODUCTION_LAUNCH_LOCKED:'false',SITE_DEMO_PRICES:'false',STANDALONE_AUTH_ENABLED:'false',CUSTOMER_AUTH_ENABLED:'false',EMAIL_NOTIFICATIONS_ENABLED:'false'},port:0,host:'127.0.0.1',outboundService:()=>new Response(null,{status:503})});
  const db=await mf.getD1Database('DB');
  for(const file of readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())for(const sql of readFileSync('drizzle/'+file,'utf8').split('--> statement-breakpoint').filter(s=>s.trim()))await db.prepare(sql).run();
 }
 const robots=await request('/robots.txt');assert.equal(robots.status,200);const robotsText=await robots.text();
 assert.match(robotsText,/Allow: \/\s/);assert.doesNotMatch(robotsText,/Disallow: \/\s/);
 assert.doesNotMatch(robotsText,/Disallow: \/\*\?/,'Let Google see query-page noindex and clean canonicals');
 assert.ok(robotsText.includes('Sitemap: '+origin+'/sitemap.xml'));
 for(const privatePath of ['/api/','/ar/account','/en/account','/ar/admin','/en/admin'])assert.ok(robotsText.includes('Disallow: '+privatePath));
  assert.ok(robotsText.includes('Allow: /api/media/'),'Google can fetch deliberately public product photos and datasheets; private media remains authorized server-side');
 const response=await request('/sitemap.xml');assert.equal(response.status,200);const xml=await response.text();
 const urls=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>decode(m[1]));
 assert.ok(urls.length>=60,'Include real bilingual public pages in the sitemap');assert.equal(new Set(urls).size,urls.length);
 assert.ok(!urls.some(u=>/\/account|\/admin|\/cart|\/checkout|\/wishlist|\?/.test(u)));
 for(const block of xml.match(/<url>[\s\S]*?<\/url>/g)||[]){
  for(const lang of ['ar','en','x-default'])assert.ok(block.includes('hreflang="'+lang+'"'),'Reciprocal language alternatives in every sitemap entry');
 }
 for(const lang of ['ar','en'])for(const path of ['eastern-province','privacy','terms','returns','collection'])assert.ok(urls.includes(origin+'/'+lang+'/'+path));
 for(let i=0;i<urls.length;i+=3)await Promise.all(urls.slice(i,i+3).map(page));
 for(const field of ['title','description'])assert.equal(new Set(report.pages.map(p=>p[field])).size,report.pages.length,'Every sitemap page needs a unique '+field);
 for(const path of internalLinks){
  const linked=await request(path);
  assert.ok([200,301,302,303,307,308].includes(linked.status),'Broken internal link '+path+' returned '+linked.status);
  const location=linked.headers.get('location');
  if(location)assert.equal(new URL(location,origin).origin,origin,'Internal links must remain on the canonical site');
  await linked.body?.cancel();
 }
 report.internalLinksChecked=internalLinks.size;
 for(const lang of ['ar','en']){
  const filtered=await request('/'+lang+'/shop?q=helmet'),html=await filtered.text();
  const robots=tags(html,'meta').find(m=>m.name==='robots')?.content||'';
  assert.ok(robots.includes('noindex')&&robots.includes('follow')&&!robots.includes('nofollow'),'Filtered catalog stays out of the index while following product links');
  assert.equal(tags(html,'link').find(l=>l.rel==='canonical')?.href,origin+'/'+lang+'/shop');
  const missing=await request('/'+lang+'/eastern-province/not-a-branch');assert.equal(missing.status,404);
  const missingHtml=await missing.text();assert.ok(missingHtml.includes(lang==='ar'?'الصفحة غير موجودة':'Page not found'));
  assert.equal(missing.headers.get('x-robots-tag'),'noindex, nofollow');
 }
 report.status='passed';report.checks.push('All sitemap URLs: status, unique title/description, canonical, reciprocal hreflang, indexing, one H1 and consistent structured data','Regional guide, deep breadcrumbs, no invented offers, private-route exclusions, readable query-page noindex and real 404s');
 console.log('PASS: '+urls.length+' '+report.mode+' sitemap pages, bilingual metadata, canonical/hreflang, breadcrumbs, organisation/service/product schemas and regional content');
}catch(error){report.status='failed';report.error=error.message;throw error;}
finally{mkdirSync('test-results',{recursive:true});writeFileSync('test-results/seo-'+(live?'live':'public-worker')+'.json',JSON.stringify(report,null,2)+'\n');await mf?.dispose();}
