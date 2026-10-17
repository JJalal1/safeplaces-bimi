import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source=readFileSync(new URL('../lib/standalone-auth-policy.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{
 compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},
 reportDiagnostics:true
});
assert.equal(compiled.diagnostics?.length,0);
const url='data:text/javascript;base64,'+Buffer.from(compiled.outputText).toString('base64');
const {standaloneCustomer,standaloneAdmin,standaloneAuthConfig}=await import(url);
const valid={id:'44eec956-693f-4b4c-a78d-3e71a79e0188',email:'OWNER@EXAMPLE.COM',emailVerified:true,name:'Test Owner'};
const user=standaloneCustomer(valid);
assert.equal(user.userId,'customer:'+valid.id);
assert.equal(user.email,'owner@example.com');
assert.equal(user.provider,'standalone');
assert.equal(standaloneCustomer({...valid,emailVerified:false}),null);
assert.equal(standaloneCustomer({...valid,emailVerified:'true'}),null);
assert.equal(standaloneCustomer({...valid,email:null}),null);
assert.equal(standaloneCustomer({...valid,id:123}),null);
assert.equal(standaloneCustomer({...valid,id:'supplied-by-customer'}),null);
assert.equal(standaloneCustomer({...valid,email:'invalid'}),null);
assert.equal(standaloneAdmin(valid,valid.id,'owner@example.com')?.adminId,valid.id);
assert.equal(standaloneAdmin(valid,valid.id,'other@example.com'),null);
assert.equal(standaloneAdmin(valid,'00eec956-693f-4b4c-a78d-3e71a79e0188','owner@example.com'),null);
assert.equal(standaloneAdmin({...valid,emailVerified:false},valid.id,'owner@example.com'),null);
const good={STANDALONE_AUTH_ENABLED:'true',BETTER_AUTH_SECRET:'a'.repeat(48),BETTER_AUTH_URL:'https://safeplaces.sa'};
assert.deepEqual(standaloneAuthConfig(good),{secret:good.BETTER_AUTH_SECRET,baseURL:'https://safeplaces.sa'});
for(const invalid of [
 {...good,STANDALONE_AUTH_ENABLED:'false'},
 {...good,BETTER_AUTH_SECRET:'short'},
 {...good,BETTER_AUTH_SECRET:' '.repeat(48)},
 {...good,BETTER_AUTH_SECRET:good.BETTER_AUTH_SECRET+'\n'},
 {...good,BETTER_AUTH_URL:'http://safeplaces.sa'},
 {...good,BETTER_AUTH_URL:'https://evil.test/path'},
 {...good,BETTER_AUTH_URL:'https://safeplaces.sa?redirect=bad'},
 {...good,BETTER_AUTH_URL:'https://*.safeplaces.sa'},
 {...good,BETTER_AUTH_URL:'https://safeplaces.sa\n'}
]) assert.equal(standaloneAuthConfig(invalid),null);
assert.equal(standaloneAuthConfig({...good,BETTER_AUTH_URL:'http://localhost:5173'},true)?.baseURL,'http://localhost:5173');
console.log('PASS: standalone identity policy, owner authorization, fail-closed production auth configuration');

const policySource=readFileSync(new URL('../lib/auth-request-policy.ts',import.meta.url),'utf8');
const policyCode=ts.transpileModule(policySource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {authRequestError,boundedAuthRequest,AUTH_BODY_LIMIT}=await import('data:text/javascript;base64,'+Buffer.from(policyCode).toString('base64'));
const origin='https://safeplaces-preview.pages.dev';
const post=(headers={},body='{}')=>new Request(origin+'/api/auth/sign-in/social',{method:'POST',headers:{origin,'content-type':'application/json',...headers},body});
assert.equal(authRequestError(post(),origin),null);
assert.equal(authRequestError(post({origin:'https://untrusted.example'}),origin)?.status,403);
assert.equal(authRequestError(post({origin:''}),origin)?.status,403);
assert.equal(authRequestError(post({'sec-fetch-site':'cross-site'}),origin)?.status,403);
assert.equal(authRequestError(post({'content-type':'text/plain'}),origin)?.status,415);
assert.equal(authRequestError(post({'content-length':String(AUTH_BODY_LIMIT+1)}),origin)?.status,413);
assert.equal(authRequestError(new Request('https://other-preview.pages.dev/api/auth/get-session'),origin)?.status,403);
assert.equal(authRequestError(new Request(origin+'/api/auth/callback/google?state=not-proof',{headers:{'sec-fetch-site':'cross-site'}}),origin),null,'Google GET callback continues to Better Auth state verification');
assert.equal(await (await boundedAuthRequest(post({},'{"provider":"google"}'))).text(),'{"provider":"google"}');
assert.equal(await boundedAuthRequest(post({'content-length':'2'},'x'.repeat(AUTH_BODY_LIMIT+1))),null,'Reject the actual oversized body even when Content-Length lies');
// Node accepts some consumed Request constructor inputs that Workerd rejects.
// Exercise the stricter boundary without starting an application runtime.
const NativeRequest=globalThis.Request;
const payload=JSON.stringify({provider:'google',callbackURL:'/ar/admin',label:'دخول الإدارة'});
const incoming=new NativeRequest(origin+'/api/auth/sign-in/social?fixture=preserve',{
 method:'POST',redirect:'manual',
 headers:{origin,'content-type':'application/json; charset=utf-8',cookie:'fixture.session=opaque','x-request-id':'auth-body-fixture'},
 body:payload
});
let rebuilt;
try{
 globalThis.Request=class extends NativeRequest{
  constructor(input,options){
   if(input instanceof NativeRequest&&(input.bodyUsed||input.body?.locked))throw new TypeError('Cannot reconstruct a consumed request');
   super(input,options);
  }
 };
 rebuilt=await boundedAuthRequest(incoming);
}finally{globalThis.Request=NativeRequest;}
assert.ok(incoming.bodyUsed,'The input body must be consumed to enforce the byte limit');
assert.ok(rebuilt instanceof NativeRequest);
assert.equal(rebuilt.url,incoming.url);
assert.equal(rebuilt.method,'POST');
assert.equal(rebuilt.redirect,'manual');
assert.deepEqual([...rebuilt.headers],[...incoming.headers],'Forward origin, session cookie and request headers unchanged');
assert.deepEqual(new Uint8Array(await rebuilt.arrayBuffer()),new TextEncoder().encode(payload),'Preserve the complete multibyte JSON body');
console.log('PASS: canonical auth origin, POST CSRF boundary, Google callback forwarding and streamed request-size limits');
