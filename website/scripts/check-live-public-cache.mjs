import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';
import {execFileSync} from 'node:child_process';

const origin='https://safeplaces.sa';
const evidence={release:process.env.GITHUB_SHA,checkedAt:new Date().toISOString(),mode:'anonymous read-only requests; no account or submission',requests:[],status:'running'};
async function read(path,headers={}){
 const started=performance.now();
 const response=await fetch(origin+path,{redirect:'error',signal:AbortSignal.timeout(15000),headers:{Accept:'text/html',...headers}});
 evidence.requests.push({path,status:response.status,cache:response.headers.get('x-safeplaces-cache'),vary:response.headers.get('vary'),type:response.headers.get('content-type'),cacheControl:response.headers.get('cache-control'),robots:response.headers.get('x-robots-tag'),durationMs:Math.round(performance.now()-started)});
 assert.equal(response.status,200,path);
 const html=await response.text();
 return {response,html};
}
function readRscHeaders(){
 const started=performance.now();
 // Keep a raw streamed RSC probe separate from the pooled HTML connection.
 // The standalone live smoke probe established the same 200/header behavior.
 // No RSC payload is interpreted as HTML, and no retries hide a failed probe.
 const code=`const r=await fetch('https://safeplaces.sa/ar',{headers:{RSC:'1',Accept:'text/x-component',Connection:'close'},signal:AbortSignal.timeout(15000)});console.log(JSON.stringify({status:r.status,type:r.headers.get('content-type'),cache:r.headers.get('x-safeplaces-cache'),cacheControl:r.headers.get('cache-control')}));await r.body?.cancel();`;
 const result=JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8',timeout:20000}));
 evidence.requests.push({path:'/ar',...result,durationMs:Math.round(performance.now()-started),headersOnly:true,transport:'isolated Node fetch connection'});
 assert.equal(result.status,200);assert.equal(result.type,'text/x-component');assert.notEqual(result.cache,'HIT');
}
try{
 let hit;
 for(let attempt=0;attempt<5;attempt++){
  hit=await read('/ar');
  if(hit.response.headers.get('x-safeplaces-cache')==='HIT')break;
  await delay(200);
 }
 assert.equal(hit.response.headers.get('x-safeplaces-cache'),'HIT','Repeated anonymous navigation must use the edge cache');
 assert.match(hit.response.headers.get('cache-control'),/no-store/,'Browser HTML storage remains disabled');
 assert.ok(hit.html.includes('https://safeplaces.sa/ar')&&/<meta\s+name="description"/i.test(hit.html.split(/<\/head>/i)[0]),'Cached HTML retains initial-head search metadata');
 readRscHeaders();
 for(const [path,headers]of [
  ['/ar',{Cookie:'safeplaces_cache_fixture=1'}],
  ['/ar',{'Cache-Control':'no-cache'}],
  ['/ar?cache-fixture=1',{}],
  ['/ar/quote',{}],
  ['/api/session',{Accept:'application/json'}],
 ]){
  const {response}=await read(path,headers);
  assert.notEqual(response.headers.get('x-safeplaces-cache'),'HIT',path+' must bypass public HTML storage');
  if(path.startsWith('/api/'))assert.match(response.headers.get('cache-control'),/private, no-store/);
 }
 evidence.status='passed';
 console.log('PASS: live anonymous HTML cache hit, intact head metadata, cookie/RSC/query/freshness/form/API bypasses and private API headers');
}catch(error){evidence.status='failed';evidence.error=error.message;console.error(error.message);process.exitCode=1;}
finally{mkdirSync('test-results',{recursive:true});writeFileSync('test-results/live-public-cache.json',JSON.stringify(evidence,null,2)+'\n');}
