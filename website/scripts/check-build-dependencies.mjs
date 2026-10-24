import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {createServer as createNetServer} from 'node:net';
import {once} from 'node:events';
const require=createRequire(import.meta.url);
const nextLintRequire=createRequire(require.resolve('eslint-config-next'));
const nextPluginRequire=createRequire(nextLintRequire.resolve('@next/eslint-plugin-next'));
const globRequire=createRequire(nextPluginRequire.resolve('fast-glob'));
const micromatchRequire=createRequire(globRequire.resolve('micromatch'));
const braces=micromatchRequire('braces');
assert.deepEqual(braces.expand('assets/{ar,en}/file{1..2}.js'),['assets/ar/file1.js','assets/ar/file2.js','assets/en/file1.js','assets/en/file2.js']);
for(const char of ['{','(']){
 const close=char==='{'?'}':')',pattern=char.repeat(2000)+'a'+close.repeat(2000);
 for(const method of ['compile','expand','stringify'])assert.throws(()=>braces[method](pattern),/safe nesting limit/);
}
let ast={type:'text',value:'a'};
for(let depth=0;depth<1000;depth++)ast={type:'root',nodes:[ast]};
for(const method of ['compile','expand','stringify'])assert.throws(()=>braces[method](ast),/safe nesting limit/,'Already parsed ASTs are bounded too');
const minimatchRequire=createRequire(require.resolve('eslint/package.json'));
const minimatch=minimatchRequire('minimatch');
assert.equal(minimatch('source/ar/file.ts','source/{ar,en}/*.ts'),true);
assert.equal(minimatch('source/fr/file.ts','source/{ar,en}/*.ts'),false);
for(const entry of readdirSync('node_modules/.pnpm').filter(name=>name.startsWith('minimatch@'))){
 const local=createRequire(resolve('node_modules/.pnpm',entry,'node_modules/minimatch/package.json'));
 const module=local('minimatch'),match=typeof module==='function'?module:module.minimatch;
 assert.equal(match('source/ar/file.ts','source/{ar,en}/*.ts'),true,entry+' brace expansion remains compatible');
 assert.equal(match('source/fr/file.ts','source/{ar,en}/*.ts'),false,entry+' rejects other paths');
}
const rscRequire=createRequire(require.resolve('@vitejs/plugin-rsc'));
assert.equal(rscRequire('react-server-dom-webpack/package.json').version,'19.2.8');
console.log('PASS: reviewed RSC patch, common glob patterns and bounded nested string/AST walkers for the locally patched braces advisory');

// GHSA-mrhx-c7xc-m3w5: reject oversized collections before walking elements.
const {z}=await import('zod');
let parsedItems=0;
const element=z.number().refine(()=>{parsedItems++;return true;});
for(const [schema,input,valid]of [
 [z.array(element).max(2),Array.from({length:2000},(_,i)=>i),[1,2]],
 [z.set(element).max(2),new Set([1,2,3]),new Set([1,2])],
 [z.map(z.string(),element).max(2),new Map([['a',1],['b',2],['c',3]]),new Map([['a',1],['b',2]])],
]){
 parsedItems=0;
 assert.equal(schema.safeParse(input).success,false);
 assert.equal(parsedItems,0,'Length limits must stop parsing before element validators run');
 assert.equal(schema.safeParse(valid).success,true);
 assert.equal(parsedItems,2,'Ordinary valid collections keep their validation');
}
const {invocationSchema,driverMessageSchema,grantSchema,sessionOptionsSchema}=await import('./connector-preview/protocol.mjs');
const invocation={connectorId:'fixture',actionName:'fetch',arguments:{q:'safety',limit:3}};
assert.deepEqual(invocationSchema.parse(invocation),invocation);
assert.equal(invocationSchema.safeParse({...invocation,accountId:'untrusted'}).success,false);
assert.equal(grantSchema.safeParse({connectorId:'fixture',actionName:'fetch',readOnly:false}).success,false);
assert.deepEqual(sessionOptionsSchema.parse({}),{timeoutMs:120000,maxConcurrent:64});
assert.equal(driverMessageSchema.safeParse({jsonrpc:'2.0',id:'00000000-0000-4000-8000-000000000001',result:{content:[]}}).success,true);
console.log('PASS: bounded collection validation and existing strict connector protocol with the patched Zod runtime');

// GHSA-xjj6-f33q-929c: an early close after an oversized encoding chain
// must be a rejected request, never an orphaned stream error or process crash.
// This uses a loopback fixture and the actual pinned build dependency.
const undiciRequire=createRequire(resolve('node_modules/.pnpm/undici@7.30.1/node_modules/undici/package.json'));
assert.equal(undiciRequire('./package.json').version,'7.30.1');
const {fetch:buildFetch,Client}=undiciRequire('undici');
let closedBadSocket;
const badSocketClosed=new Promise(done=>{closedBadSocket=done;});
const encodingServer=createNetServer(socket=>socket.once('data',request=>{
 if(request.toString().startsWith('GET /oversized ')){
  socket.once('close',closedBadSocket);
  socket.end('HTTP/1.1 200 OK\r\nContent-Encoding: '+Array(7).fill('gzip').join(', ')+'\r\nContent-Length: 4\r\nConnection: close\r\n\r\n');
 }else socket.end('HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nOK');
}));
encodingServer.listen(0,'127.0.0.1');await once(encodingServer,'listening');
const localOrigin='http://127.0.0.1:'+encodingServer.address().port,client=new Client(localOrigin);
try{
 const response=await buildFetch(localOrigin+'/ordinary',{dispatcher:client,signal:AbortSignal.timeout(3000)});
 assert.equal(await response.text(),'OK','Ordinary build fetches remain compatible');
 await assert.rejects(buildFetch(localOrigin+'/oversized',{dispatcher:client,signal:AbortSignal.timeout(3000)}),error=>{
  assert.match(error.cause?.message||'',/content-encoding/);return true;
 });
 await badSocketClosed;await new Promise(done=>setImmediate(done));
}finally{await client.destroy();await new Promise(done=>encodingServer.close(done));}
console.log('PASS: pinned Undici handles ordinary requests and rejects excessive encodings with early close without crashing');
