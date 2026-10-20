import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';

// Deployment checks read only fixed schema and binding metadata. The optional
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
 assert.ok(bindings.some(binding=>binding.name==='DB'&&binding.id===database),'Unexpected production database binding');
 for(const name of target==='production'?['BETTER_AUTH_SECRET','GOOGLE_CLIENT_SECRET','RESEND_API_KEY']:['BETTER_AUTH_SECRET'])
  assert.ok(bindings.some(binding=>binding.name===name&&binding.type==='secret_text'),'A required authentication secret is missing');
 console.log('PASS: exact '+target+' database, additive session schema, migration fingerprint, recovery evidence and required secret names');
}else{
 const protectedLogs={enabled:true,head_sampling_rate:1,redact_query_string:true,logs:{enabled:true,invocation_logs:false,head_sampling_rate:1,persist:true},traces:{enabled:false}};
 try{
  await api('PATCH',workerPath+'/script-settings',{observability:protectedLogs});
  const settings=await api('GET',workerPath+'/script-settings'),o=settings.observability;
  assert.ok(o?.enabled&&o.redact_query_string===true&&o.logs?.enabled&&o.logs.invocation_logs===false&&o.traces?.enabled===false);
  console.log('PASS: fixed auth diagnostics enabled, query strings redacted, invocation logs and traces disabled');
 }catch{
  await api('PATCH',workerPath+'/script-settings',{observability:{enabled:false,logs:{enabled:false,invocation_logs:false},traces:{enabled:false}}});
  const settings=await api('GET',workerPath+'/script-settings'),o=settings.observability;
  if(o?.enabled!==false||o.logs?.enabled!==false||o.logs?.invocation_logs!==false||o.traces?.enabled!==false)throw new Error('Authentication log protection and recovery could not be confirmed');
  throw new Error('Auth logging was verified disabled because safe redaction could not be confirmed');
 }
}
