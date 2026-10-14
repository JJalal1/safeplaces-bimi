import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import ts from 'typescript';

const source=readFileSync(new URL('../lib/admin-permissions.ts',import.meta.url),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true});
assert.equal(compiled.diagnostics?.length,0);
const uri='data:text/javascript;base64,'+Buffer.from(compiled.outputText).toString('base64');
const {ADMIN_PERMISSIONS,parseAdminPermissions,canAdmin,contentPermission,canAdminContent}=await import(uri);
const staff={role:'staff',permissions:['orders','quotes']};
const owner={role:'owner',permissions:[]};
assert.equal(canAdmin(null,'orders'),false);
assert.equal(canAdmin(staff,'orders'),true);
assert.equal(canAdmin(staff,'products'),false);
assert.equal(canAdmin(owner,'settings'),true);
assert.equal(canAdmin(owner,'dashboard'),true);
assert.equal(canAdminContent(staff,'service'),false);
assert.equal(canAdminContent(owner,'service'),true);
assert.equal(canAdminContent(staff,'__proto__'),false);
assert.equal(canAdminContent(owner,'__proto__'),false);
assert.equal(canAdminContent(owner,'constructor'),false);
assert.equal(contentPermission('category'),'category');
assert.equal(contentPermission('banner'),'homepage');
assert.equal(contentPermission('unknown'),null);
assert.deepEqual(parseAdminPermissions(['orders','invalid','orders','settings']),['orders','settings']);
assert.deepEqual(parseAdminPermissions(['owner','team','admin','*']),[]);
assert.deepEqual(parseAdminPermissions(null),[]);
assert.ok(ADMIN_PERMISSIONS.includes('customers'));
assert.ok(!ADMIN_PERMISSIONS.includes('team'));
const api=readFileSync(new URL('../app/api/[...path]/route.ts',import.meta.url),'utf8');
for(const required of [
 "requirePermission('products')","requirePermission('coupons')",
 "requirePermission(b.type)","canAdminContent(admin,b.type)",
 "selected.some(row=>!canAdminContent(admin,'type' in row?String(row.type):''))",
 "admin.role!=='owner'",
 "getAdminData(admin)"
]) assert.ok(api.includes(required),'Missing API guard: '+required);
console.log('PASS: admin RBAC denies missing grants and checks dangerous API routes');
