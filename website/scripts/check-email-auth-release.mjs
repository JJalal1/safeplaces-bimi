import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {protectAuthLogs} from './auth-log-protection.mjs';

// Deployment checks read fixed schema, binding metadata and public OAuth settings.
// Public setting comparisons never log values. The optional
// logging action changes script observability, never credentials or bindings.
const accountId='b67109c9489a46ae25fb36370c4ba880';
const target=process.argv[2],action=process.argv[3]||'preflight';
const targets={production:{worker:'safeplaces-production',database:'da06d822-b7ee-4a14-b3a5-7bcbc5839821'},staging:{worker:'safeplaces-staging',database:'d0d80657-6032-40b4-af39-407731d3c972'}};
assert.ok(Object.hasOwn(targets,target),'Choose the fixed production or staging target');
assert.ok(['preflight','protect-logs'].includes(action),'Unknown release check');
assert.equal(process.env.CLOUDFLARE_ACCOUNT_ID,accountId,'Unexpected Cloudflare account');
const token=(process.env.CLOUDFLARE_API_TOKEN||'').replace(/\s+/g,'');
if(!/^[A-Za-z0-9._-]{20,512}$/.test(token))throw new Error('Cloudflare deployment credential is unavailable');
const readToken=(process.env.CLOUDFLARE_D1_READ_TOKEN||'').replace(/\s+/g,'')||token;
if(!/^[A-Za-z0-9._-]{20,512}$/.test(readToken))throw new Error('D1 read credential is unavailable');
const {worker,database}=targets[target];
const workerPath=`/accounts/${accountId}/workers/scripts/${worker}`;
async function api(method,path,body){
 let response;
 try{response=await fetch('https://api.cloudflare.com/client/v4'+path,{
  method,redirect:'error',signal:AbortSignal.timeout(20000),
  headers:{Authorization:'Bearer '+(path.includes('/d1/database/')?readToken:token),Accept:'application/json',...(body?{'Content-Type':'application/json'}:{})},
  ...(body?{body:JSON.stringify(body)}:{})
 });}catch{throw new Error('Cloudflare release check could not connect');}
 if(!response.ok){await response.body?.cancel();throw new Error('Cloudflare release check denied: HTTP '+response.status);}
 const result=await response.json();
 if(result.success!==true)throw new Error('Cloudflare release check was not confirmed');
 return result.result;
}
if(action==='preflight'){
 const query=async(sql,params=[])=>{
  const result=await api('POST',`/accounts/${accountId}/d1/database/${database}/query`,{sql,params});
  assert.ok(result.every(item=>item.success===true),'D1 schema query failed');
  return result.flatMap(item=>item.results||[]);
 };
 const columns=await query("SELECT name,type,\"notnull\",dflt_value FROM pragma_table_info('auth_session') WHERE name='auth_method'");
 assert.equal(columns.length,1,'Apply the reviewed session-method migration before this release');
 assert.equal(columns[0].type,'TEXT');assert.equal(columns[0].notnull,1);assert.equal(columns[0].dflt_value,"'unknown'");
 const migration='0005_auth_session_method.sql';
 const hash=createHash('sha256').update(readFileSync('drizzle/'+migration)).digest('hex');
 const evidence=await query('SELECT name,sha256,applied_at,backup_bookmark FROM safeplaces_migrations WHERE name=?',[migration]);
 assert.equal(evidence.length,1,'The session migration requires recorded application evidence');
 assert.equal(evidence[0].sha256,hash,'The deployed schema must match this reviewed migration');
 assert.ok(Number.isFinite(Date.parse(evidence[0].applied_at))&&evidence[0].backup_bookmark,'Recovery evidence is incomplete');
 const settings=await api('GET',workerPath+'/settings');
 const bindings=settings.bindings||[];
 if(target==='production'){
  const compiled=JSON.parse(readFileSync('dist/server/wrangler.json','utf8'));
  assert.ok(compiled.name===worker,'The compiled authentication target is incorrect');
  for(const name of ['GOOGLE_CLIENT_ID','BETTER_AUTH_URL']){
   const current=bindings.filter(binding=>binding.name===name),value=compiled.vars?.[name];
   assert.ok(typeof value==='string'&&value.length>0&&current.length===1&&current[0].type==='plain_text'&&current[0].text===value,'Production public OAuth settings must match the compiled release');
  }
  console.log('PASS: production public OAuth settings match the compiled release');
 }
 assert.ok(bindings.some(binding=>binding.name==='DB'&&binding.id===database),'Unexpected production database binding');
 for(const name of target==='production'?['BETTER_AUTH_SECRET','GOOGLE_CLIENT_SECRET','RESEND_API_KEY']:['BETTER_AUTH_SECRET'])
  assert.ok(bindings.some(binding=>binding.name===name&&binding.type==='secret_text'),'A required authentication secret is missing');
 console.log('PASS: exact '+target+' database, additive session schema, migration fingerprint, recovery evidence and required secret names');
}else{
 const compiled=JSON.parse(readFileSync('dist/server/wrangler.json','utf8'));
 assert.equal(compiled.name,worker);
 for(const [name,value]of Object.entries({enabled:compiled.observability?.enabled,logs:compiled.observability?.logs?.enabled,invocations:compiled.observability?.logs?.invocation_logs,traces:compiled.observability?.traces?.enabled}))assert.equal(value,false,'The compiled release must explicitly disable '+name);
 const protection=await protectAuthLogs({api,workerPath,compiledDisabled:true});
 mkdirSync('test-results',{recursive:true});writeFileSync('test-results/auth-log-protection.json',JSON.stringify({target,release:process.env.GITHUB_SHA,...protection},null,2)+'\n');
 console.log(protection.status==='protected'?'PASS: fixed auth diagnostics enabled, query strings redacted, invocation logs and traces disabled':'PASS: auth diagnostic persistence verified disabled; invocation details/traces and external log exporters remain off');
}
