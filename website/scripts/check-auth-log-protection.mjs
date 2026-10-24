import assert from 'node:assert/strict';
import {protectAuthLogs,disabledSettings,disabledObservability} from './auth-log-protection.mjs';
const path='/accounts/fixture/workers/scripts/fixture';
const base=()=>({logpush:false,tail_consumers:[],observability:null});
const run=async({mode='protected',compiledDisabled=true}={})=>{
 const settings=base(),writes=[];let reads=0;
 const result=await protectAuthLogs({workerPath:path,compiledDisabled,pause:async()=>{},api:async(method,url,body)=>{
  assert.equal(url,path+'/script-settings');
  if(method==='PATCH'){
   assert.deepEqual(Object.keys(body),['observability']);writes.push(body.observability);
   if(mode==='protected')settings.observability=structuredClone(body.observability);
   else if(mode==='explicit-off')settings.observability=body.observability.enabled?{enabled:true,logs:{enabled:true,invocation_logs:true},traces:{enabled:true}}:structuredClone(disabledObservability);
   else if(mode==='unsafe')settings.observability={enabled:true,logs:{enabled:true,invocation_logs:true},traces:{enabled:true}};
   else if(mode==='missing')delete settings.observability;
   else settings.observability=null;
  }else{assert.equal(method,'GET');reads++;}
  return settings;
 }});
 return {result,writes,reads};
};
assert.equal((await run()).result.status,'protected');
const nullable=await run({mode:'nullable-off'});assert.equal(nullable.result.status,'disabled');assert.equal(nullable.writes.length,2);assert.deepEqual(nullable.writes[1],disabledObservability);
assert.equal((await run({mode:'explicit-off'})).result.status,'disabled');
for(const mode of ['unsafe','missing'])await assert.rejects(run({mode}),/could not be confirmed/);
await assert.rejects(run({mode:'nullable-off',compiledDisabled:false}),/could not be confirmed/);
assert.equal(disabledSettings(base()),false,'A null read alone never proves a protected release');
assert.equal(disabledSettings({...base(),logpush:true},{compiledDisabled:true,disableConfirmed:true}),false);
assert.equal(disabledSettings({...base(),tail_consumers:[{service:'unreviewed'}]},{compiledDisabled:true,disableConfirmed:true}),false);
console.log('PASS: protected logs, confirmed disabled/null settings, explicit compiled disablement, exporter exclusions and unsafe/missing read-back rejection');
