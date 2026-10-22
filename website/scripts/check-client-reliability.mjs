import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const load=async file=>import('data:text/javascript;base64,'+Buffer.from(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText).toString('base64'));
const {requestJSON}=await load('lib/client-request.ts');
let attempts=0;
const body={name:'Fixture',key:'unchanged-idempotency-key',message:'Preserve the existing enquiry'};
const fetcher=async(path,options)=>{attempts++;assert.equal(path,'/api/contact');assert.deepEqual(JSON.parse(options.body),body);assert.equal(options.credentials,'same-origin');assert.equal(options.headers['Content-Type'],'application/json');return Response.json({reference:'SPC-FIXTURE'});};
assert.deepEqual(await requestJSON('/api/contact',body,{fetcher}),{reference:'SPC-FIXTURE'});assert.equal(attempts,1);
await assert.rejects(requestJSON('/api/contact',body,{fetcher:async()=>new Response('Temporary HTML failure',{status:502})}),/SERVER_ERROR/);
await assert.rejects(requestJSON('/api/contact',body,{fetcher:async()=>Response.json({error:'RATE_LIMIT'},{status:429})}),/RATE_LIMIT/);
await assert.rejects(requestJSON('/api/contact',body,{fetcher:async()=>Response.json({error:'private internal details'},{status:500})}),/SERVER_ERROR/);
await assert.rejects(requestJSON('/api/contact',body,{fetcher:async()=>{throw new TypeError('Failed to fetch');}}),/NETWORK_ERROR/);
attempts=0;
await assert.rejects(requestJSON('/api/contact',body,{timeoutMs:5,fetcher:async(_,options)=>{attempts++;return new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(new Error('Aborted'))));}}),/REQUEST_TIMEOUT/);assert.equal(attempts,1,'Never repeat a mutation automatically');
assert.equal(body.key,'unchanged-idempotency-key');
const multipart=new FormData();multipart.set('token','fixture');
await requestJSON('/api/uploads',multipart,{fetcher:async(_,options)=>{assert.equal(options.body,multipart);assert.equal(options.headers,undefined,'The browser sets the multipart boundary');return Response.json({id:'file'});}});
console.log('PASS: bounded JSON/multipart requests, readable network/server errors and one attempt per mutation with preserved data');

const {responsePolicy}=await load('lib/response-policy.ts');
const bindings={SITE_PUBLIC:'true',SITE_INDEXABLE:'true'};
for(const path of ['/api/session','/api/account/requests/quotes/fixture','/api/admin/data','/ar/account/reset','/en/admin']){
 const response=responsePolicy(new Request('https://safeplaces.sa'+path),Response.json({ok:true}),bindings);
 assert.equal(response.headers.get('cache-control'),'private, no-store');assert.equal(response.headers.get('referrer-policy'),'no-referrer');assert.equal(response.headers.get('x-robots-tag'),'noindex, nofollow');assert.equal(response.headers.get('x-frame-options'),'DENY');assert.match(response.headers.get('content-security-policy'),/frame-ancestors 'none'/);
}
const headers=new Headers({'Content-Type':'text/html'});headers.append('Set-Cookie','one=1; HttpOnly');headers.append('Set-Cookie','two=2; HttpOnly');
const cookies=responsePolicy(new Request('https://safeplaces.sa/ar'),new Response('page',{headers}),bindings);assert.equal(cookies.headers.getSetCookie().length,2);assert.equal(await cookies.text(),'page');assert.match(cookies.headers.get('cache-control'),/no-store/);
const image=responsePolicy(new Request('https://safeplaces.sa/api/media/fixture'),new Response('image',{headers:{'Content-Type':'image/webp','Cache-Control':'public,max-age=86400','Content-Security-Policy':"default-src 'none'; sandbox"}}),bindings);assert.equal(image.headers.get('x-robots-tag'),null);assert.equal(image.headers.get('cache-control'),'public,max-age=86400');assert.match(image.headers.get('content-security-policy'),/default-src 'none'; sandbox/);
const preview=responsePolicy(new Request('https://preview.example/ar'),new Response('preview'),{SITE_PUBLIC:'false',SITE_INDEXABLE:'false'});assert.equal(preview.headers.get('x-frame-options'),null);assert.equal(preview.headers.get('x-robots-tag'),'noindex, nofollow');
const missing=responsePolicy(new Request('https://safeplaces.sa/ar/missing'),new Response('404',{status:404}),bindings);assert.equal(missing.headers.get('x-robots-tag'),'noindex, nofollow');
console.log('PASS: nested private routes, cookies, public image caching, file CSP, public frame protection, preview embedding and 404 indexing');
