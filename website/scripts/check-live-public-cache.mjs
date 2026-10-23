import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';

const origin='https://safeplaces.sa';
const evidence={release:process.env.GITHUB_SHA,checkedAt:new Date().toISOString(),mode:'anonymous read-only requests; no account or submission',requests:[],status:'running'};
async function read(path,headers={},headersOnly=false){
 const started=performance.now();
 const response=await fetch(origin+path,{redirect:'error',signal:AbortSignal.timeout(15000),headers:{Accept:'text/html',...headers}});
 evidence.requests.push({path,status:response.status,cache:response.headers.get('x-safeplaces-cache'),vary:response.headers.get('vary'),type:response.headers.get('content-type'),cacheControl:response.headers.get('cache-control'),robots:response.headers.get('x-robots-tag'),durationMs:Math.round(performance.now()-started),headersOnly});
 assert.equal(response.status,200,path);
 // RSC is a streamed framework protocol. Cache isolation needs its response
 // headers, not consumption of a raw protocol stream as an HTML document.
 const html=headersOnly?'':await response.text();
 if(headersOnly)await response.body?.cancel();
 return {response,html};
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
 for(const [path,headers,headersOnly]of [
  ['/ar',{Cookie:'safeplaces_cache_fixture=1'}],
  ['/ar',{'Cache-Control':'no-cache'}],
  ['/ar',{RSC:'1',Accept:'text/x-component'},true],
  ['/ar?cache-fixture=1',{}],
  ['/ar/quote',{}],
  ['/api/session',{Accept:'application/json'}],
 ]){
  const {response}=await read(path,headers,headersOnly);
  assert.notEqual(response.headers.get('x-safeplaces-cache'),'HIT',path+' must bypass public HTML storage');
  if(path.startsWith('/api/'))assert.match(response.headers.get('cache-control'),/private, no-store/);
 }
 evidence.status='passed';
 console.log('PASS: live anonymous HTML cache hit, intact head metadata, cookie/RSC/query/freshness/form/API bypasses and private API headers');
}catch(error){evidence.status='failed';evidence.error=error.message;console.error(error.message);process.exitCode=1;}
finally{mkdirSync('test-results',{recursive:true});writeFileSync('test-results/live-public-cache.json',JSON.stringify(evidence,null,2)+'\n');}
