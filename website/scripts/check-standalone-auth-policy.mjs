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
 {...good,BETTER_AUTH_URL:'http://safeplaces.sa'},
 {...good,BETTER_AUTH_URL:'https://evil.test/path'},
 {...good,BETTER_AUTH_URL:'https://safeplaces.sa?redirect=bad'}
]) assert.equal(standaloneAuthConfig(invalid),null);
assert.equal(standaloneAuthConfig({...good,BETTER_AUTH_URL:'http://localhost:5173'},true)?.baseURL,'http://localhost:5173');
console.log('PASS: standalone identity policy, owner authorization, fail-closed production auth configuration');
