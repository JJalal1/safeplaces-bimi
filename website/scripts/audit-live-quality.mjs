import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {resolve,join} from 'node:path';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';

// Public, anonymous, read-only audit. No customer account, cookie, API token,
// form submission, external tracking or intrusive security probe is used.
const modules=process.env.SAFEPLACES_AUDIT_MODULES;
assert.ok(modules,'Provide isolated audit tool modules');
const require=createRequire(join(modules,'safeplaces-audit.cjs'));
const {chromium}=require('playwright');
const {default:lighthouse}=await import(pathToFileURL(require.resolve('lighthouse')).href);
const chromeLauncher=await import(pathToFileURL(require.resolve('chrome-launcher')).href);
const axe=readFileSync(require.resolve('axe-core/axe.min.js'),'utf8');
const output=resolve('test-results/quality');mkdirSync(output,{recursive:true});
const origin='https://safeplaces.sa';
const paths=['','/shop','/shop/fire-extinguishers','/services/fire-alarm','/quote','/contact','/eastern-province'];
const report={release:process.env.GITHUB_SHA,checkedAt:new Date().toISOString(),environment:'GitHub Actions Ubuntu Chromium; anonymous lab measurements, not Saudi visitor field data',tools:{playwright:require('playwright/package.json').version,lighthouse:require('lighthouse/package.json').version,axe:require('axe-core/package.json').version},pages:[],lighthouse:[],errors:[],blockedMutations:[]};
let browser;
try{
 browser=await chromium.launch({headless:true,...(process.env.SAFEPLACES_BROWSER_PATH?{executablePath:process.env.SAFEPLACES_BROWSER_PATH}:{})});
 for(const lang of ['ar','en'])for(const suffix of paths){
  const path='/'+lang+suffix;
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
  await context.route('**/*',route=>{
   const request=route.request(),url=new URL(request.url());
   if(!['GET','HEAD'].includes(request.method())){report.blockedMutations.push({path:url.pathname,method:request.method()});return route.abort();}
   if(url.origin!==origin)return route.abort();
   return route.continue();
  });
  const page=await context.newPage();
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.coverage.startCSSCoverage();
  const response=await page.goto(origin+path,{waitUntil:'networkidle',timeout:45000});
  assert.equal(response.status(),200,path);
  await page.evaluate(async()=>{await document.fonts.ready;});
  await page.addScriptTag({content:axe});
  const result=await page.evaluate(async()=>{
   const result=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']}});
   const main=document.querySelector('main');
   return {violations:result.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,help:v.help,helpUrl:v.helpUrl,nodes:v.nodes.map(n=>({target:n.target,html:n.html.slice(0,500),summary:n.failureSummary}))})),incomplete:result.incomplete.map(v=>({id:v.id,impact:v.impact,count:v.nodes.length})),missingAlt:[...document.images].filter(i=>!i.hasAttribute('alt')).map(i=>i.getAttribute('src')),brokenVisibleImages:[...document.images].filter(i=>i.getBoundingClientRect().top<innerHeight&&i.getBoundingClientRect().bottom>0&&i.complete&&i.naturalWidth===0).map(i=>i.getAttribute('src')),headMetadata:[...document.head.querySelectorAll('meta[name=description],link[rel=canonical],meta[property=\"og:description\"]')].map(n=>({tag:n.tagName,name:n.getAttribute('name')||n.getAttribute('property')||n.getAttribute('rel'),value:n.getAttribute('content')||n.getAttribute('href')})),headings:[...main.querySelectorAll('h1,h2,h3,h4')].map(h=>({level:h.tagName,text:h.textContent.trim()})),links:[...main.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')),resources:performance.getEntriesByType('resource').map(r=>({name:r.name,bytes:r.transferSize,encodedBytes:r.encodedBodySize,type:r.initiatorType,duration:r.duration})),overflow:document.documentElement.scrollWidth>innerWidth+2};
  });
  const coverage=await page.coverage.stopCSSCoverage();
  const css=coverage.map(s=>({url:s.url,bytes:s.text.length,usedBytes:s.ranges.reduce((n,r)=>n+r.end-r.start,0)}));
  report.pages.push({path,headers:Object.fromEntries(Object.entries(await response.allHeaders()).filter(([k])=>['content-security-policy','x-content-type-options','x-frame-options','referrer-policy','permissions-policy','strict-transport-security','cache-control','x-safeplaces-cache','x-robots-tag','content-encoding'].includes(k))),...result,css,errors});
  console.log(JSON.stringify({path,violations:result.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.length})),missingAlt:result.missingAlt.length,overflow:result.overflow,errors:errors.length}));
  await context.close();
 }
 await browser.close();browser=null;
 // Compare identical throttling/device profiles before and after changes.
 // Lighthouse's full JSON/HTML reports retain exact settings and diagnostics.
 for(const [path,desktop] of [['/ar',false],['/ar/shop',false],['/ar/shop/fire-extinguishers',false],['/ar/quote',false],['/en',true]]){
  const chrome=await chromeLauncher.launch({chromePath:process.env.SAFEPLACES_BROWSER_PATH||chromium.executablePath(),chromeFlags:['--headless=new','--no-sandbox','--disable-dev-shm-usage'],logLevel:'error'});
  try{
   const flags={port:chrome.port,logLevel:'error',output:['json','html'],onlyCategories:['performance','accessibility','best-practices','seo']};
   if(desktop){flags.formFactor='desktop';flags.screenEmulation={mobile:false,width:1350,height:940,deviceScaleFactor:1,disabled:false};flags.throttling={rttMs:40,throughputKbps:10240,cpuSlowdownMultiplier:1,requestLatencyMs:0,downloadThroughputKbps:0,uploadThroughputKbps:0};}
   const {lhr,report:files}=await lighthouse(origin+path,flags);
   const label=path.slice(1).replaceAll('/','-')+(desktop?'-desktop':'-mobile');
   writeFileSync(join(output,label+'.json'),files[0]);writeFileSync(join(output,label+'.html'),files[1]);
   const audits=lhr.audits;
   const result={path,profile:desktop?'desktop':'mobile',scores:Object.fromEntries(Object.entries(lhr.categories).map(([key,value])=>[key,Math.round(value.score*100)])),metrics:Object.fromEntries(['first-contentful-paint','largest-contentful-paint','total-blocking-time','cumulative-layout-shift','speed-index','server-response-time','total-byte-weight'].map(id=>[id,{value:audits[id]?.numericValue,display:audits[id]?.displayValue}])),diagnostics:Object.values(audits).filter(a=>a.score!==null&&a.score<1&&!['notApplicable','manual','informative'].includes(a.scoreDisplayMode)).map(a=>({id:a.id,title:a.title,score:a.score,display:a.displayValue,savingsMs:a.details?.overallSavingsMs,savingsBytes:a.details?.overallSavingsBytes})),environment:lhr.environment,runtimeError:lhr.runtimeError,runWarnings:lhr.runWarnings};
   report.lighthouse.push(result);console.log('LIGHTHOUSE '+JSON.stringify(result));
  }finally{await chrome.kill();}
 }
 if(process.argv.includes('--enforce')){
  assert.ok(report.pages.every(p=>p.violations.length===0),'Resolve detected WCAG violations before completing the release');
  assert.ok(report.pages.every(p=>!p.overflow&&!p.errors.length&&!p.missingAlt.length&&!p.brokenVisibleImages.length),'Public pages must have intact assets and layouts');
  assert.ok(report.pages.every(p=>p.headMetadata.some(m=>m.name==='description'&&m.value)),'Description metadata must survive hydration in head');
  assert.ok(report.lighthouse.every(p=>!p.runtimeError&&p.scores.seo===100),'Every Lighthouse sample must pass technical SEO');
 }
}catch(error){report.errors.push({message:error.message});process.exitCode=1;}
finally{await browser?.close();writeFileSync(join(output,'summary.json'),JSON.stringify(report,null,2)+'\n');}
