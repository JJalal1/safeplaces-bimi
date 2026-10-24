import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {setTimeout as delay} from 'node:timers/promises';

// Exactly one idempotent contact fixture per release. Resend's documented
// nonhuman delivery simulator receives the acknowledgement. The normal staff
// notification follows the same path as a new customer request.
const origin='https://safeplaces.sa';
const account='b67109c9489a46ae25fb36370c4ba880',database='da06d822-b7ee-4a14-b3a5-7bcbc5839821';
const sha=process.env.GITHUB_SHA||'';
assert.ok(process.env.GITHUB_ACTIONS==='true'&&/^[0-9a-f]{40}$/.test(sha));
const token=(process.env.CLOUDFLARE_D1_READ_TOKEN||process.env.CLOUDFLARE_API_TOKEN||'').replace(/\s+/g,'');
assert.ok(/^[A-Za-z0-9._-]{20,512}$/.test(token));
const hex=createHash('sha256').update('safeplaces-notification-check:'+sha).digest('hex');
const key=hex.slice(0,8)+'-'+hex.slice(8,12)+'-4'+hex.slice(13,16)+'-8'+hex.slice(17,20)+'-'+hex.slice(20,32);
const email='delivered+safeplaces-notice-'+sha.slice(0,12)+'@resend.dev';
const evidence={release:sha,checkedAt:new Date().toISOString(),simulator:'Resend nonhuman delivery simulator',from:'info@safeplaces.sa',status:'running',notifications:[]};
async function query(sql,params){
 const response=await fetch(`https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${database}/query`,{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({sql,params})});
 assert.equal(response.status,200,'Notification evidence query was denied');
 const data=await response.json();assert.equal(data.success,true);
 return data.result.flatMap(item=>item.results||[]);
}
try{
 const response=await fetch(origin+'/api/contact',{method:'POST',redirect:'error',signal:AbortSignal.timeout(20000),headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({name:'Safe Places delivery simulator',email,message:'Automated notification acceptance check. No customer data.',key})});
 assert.equal(response.status,200,'The synthetic contact request was not accepted');await response.body?.cancel();
 for(let attempt=0;attempt<8;attempt++){
  const rows=await query('SELECT n.kind,n.status,n.last_error,n.attempts,n.sender FROM notification_outbox n JOIN contacts c ON c.id=n.request_id WHERE n.request_type=? AND c.idempotency_key=? ORDER BY n.kind',['contacts',key]);
  evidence.notifications=rows;
  if(rows.length===2&&rows.every(row=>row.status==='sent'))break;
  if(rows.some(row=>['failed','blocked'].includes(row.status)))break;
  await delay(3000);
 }
 assert.equal(evidence.notifications.length,2,'Both customer and staff notifications must be recorded');
 assert.ok(evidence.notifications.every(row=>row.status==='sent'&&row.sender==='info@safeplaces.sa'),'Provider acceptance of both notifications was not confirmed');
 // Evidence queries use the deliberately read-only D1 credential. Closing a
 // synthetic request is a separate administrative write, not a mail result.
 evidence.status='provider_accepted';
 console.log('PASS: customer acknowledgement and staff notification accepted by provider from info@safeplaces.sa; this does not assert inbox delivery');
}catch{
 evidence.status='not_confirmed';
 console.error('FAIL: live notification provider acceptance was not confirmed; see the fixed error categories in the saved evidence');
 process.exitCode=1;
}finally{
 mkdirSync('test-results',{recursive:true});
 writeFileSync('test-results/live-notification-acceptance.json',JSON.stringify(evidence,null,2)+'\n');
}
