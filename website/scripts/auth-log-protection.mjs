import {setTimeout as delay} from 'node:timers/promises';

export const disabledObservability={enabled:false,logs:{enabled:false,invocation_logs:false},traces:{enabled:false}};
const protectedObservability={enabled:true,head_sampling_rate:1,redact_query_string:true,logs:{enabled:true,invocation_logs:false,head_sampling_rate:1,persist:true},traces:{enabled:false}};
const noExporters=s=>s?.logpush===false&&(s.tail_consumers===null||Array.isArray(s.tail_consumers)&&s.tail_consumers.length===0);
export function protectedSettings(s){const o=s?.observability;return noExporters(s)&&o?.enabled===true&&o.redact_query_string===true&&o.logs?.enabled===true&&o.logs.invocation_logs===false&&o.traces?.enabled===false;}
export function disabledSettings(s,{compiledDisabled=false,disableConfirmed=false}={}){
 if(!noExporters(s))return false;
 const o=s.observability;
 // Cloudflare's nullable script-level setting may be returned as null after
 // disablement. Accept that representation only after a confirmed disable
 // write AND an explicitly disabled compiled release. Missing data is rejected.
 if(Object.hasOwn(s,'observability')&&o===null)return compiledDisabled&&disableConfirmed;
 return o?.enabled===false&&o.logs?.enabled===false&&o.logs.invocation_logs===false&&o.traces?.enabled===false;
}
export async function protectAuthLogs({api,workerPath,compiledDisabled,pause=delay}){
 const path=workerPath+'/script-settings';
 const verify=async predicate=>{
  for(let attempt=0;attempt<3;attempt++){
   const settings=await api('GET',path);
   if(predicate(settings))return true;
   if(attempt<2)await pause(400*(attempt+1));
  }
  return false;
 };
 try{
  await api('PATCH',path,{observability:protectedObservability});
  if(await verify(protectedSettings))return {status:'protected',invocationLogs:false,traces:false,queryRedaction:true};
 }catch{/* Only verified safe states are accepted; provider errors are not logged. */}
 // Diagnostic persistence is optional. Disabling logs/traces is a safe
 // alternative; customer notifications and application features are untouched.
 await api('PATCH',path,{observability:disabledObservability});
 if(await verify(s=>disabledSettings(s,{compiledDisabled,disableConfirmed:true})))return {status:'disabled',invocationLogs:false,traces:false,queryRedaction:null};
 throw new Error('Authentication logging protection could not be confirmed');
}
