import assert from 'node:assert/strict';
import {mkdirSync,readFileSync,rmSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';

const source=pathToFileURL(resolve('scripts/check-live-notifications.mjs')).href;
for(const mode of ['sent','blocked']){
 const cwd=resolve('test-results/notification-evidence-fixtures',mode);
 mkdirSync(cwd,{recursive:true});
 const harness=`
  import assert from 'node:assert/strict';
  const calls=[];
  globalThis.fetch=async (url,options)=>{
   calls.push(String(url));
   if(String(url).endsWith('/api/contact'))return Response.json({ok:true});
   assert.ok(String(url).endsWith('/query'),'Only the fixed evidence API is allowed');
   const body=JSON.parse(options.body);
   assert.ok(/^SELECT\\s/i.test(body.sql),'A read-only evidence credential must never execute writes');
   assert.ok(Array.isArray(body.params)&&body.params.length===2);
   const rows=['customer_confirmation','staff_notification'].map(kind=>({kind,status:${JSON.stringify(mode)},last_error:null,attempts:1,sender:'info@safeplaces.sa'}));
   return Response.json({success:true,result:[{results:rows}]});
  };
  await import(${JSON.stringify(source)});
  assert.equal(calls.length,2,'No extra emails or cleanup writes are allowed');
 `;
 const run=spawnSync(process.execPath,['--input-type=module','-'],{cwd,input:harness,encoding:'utf8',env:{...process.env,GITHUB_ACTIONS:'true',GITHUB_SHA:'a'.repeat(40),CLOUDFLARE_D1_READ_TOKEN:'fixture_read_only_credential_000000000',CLOUDFLARE_API_TOKEN:''}});
 assert.equal(run.status,mode==='sent'?0:1,run.stderr);
 const evidence=JSON.parse(readFileSync(resolve(cwd,'test-results/live-notification-acceptance.json'),'utf8'));
 assert.equal(evidence.status,mode==='sent'?'provider_accepted':'not_confirmed');
 assert.equal(evidence.notifications.length,2);
 rmSync(cwd,{recursive:true,force:true});
}
console.log('PASS: accepted mail remains successful with read-only D1 evidence, blocked mail fails, and no cleanup writes or duplicate sends occur');
