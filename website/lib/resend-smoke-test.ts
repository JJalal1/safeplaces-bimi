import type { OperationsBindings } from './operations-types';

/** Short-lived, one-recipient email delivery smoke test. No public endpoint. */
const RECORD='release_resend_smoke_20261020';
const RECIPIENT='info@safeplaces.sa';
const IDEMPOTENCY_KEY='safeplaces-production-resend-smoke-20261020';
const EXPIRES=Date.parse('2026-10-22T00:00:00Z');

export async function runResendSmokeTestOnce(env: OperationsBindings, fetcher:typeof fetch=fetch, now=Date.now()):Promise<void>{
 const flag=(name:string):string=>typeof env[name]==='string'?String(env[name]).trim():'';
 if(!env.DB || now>=EXPIRES || flag('SITE_PUBLIC')!=='false' ||
    flag('SITE_INDEXABLE')!=='false' || flag('EMAIL_NOTIFICATIONS_ENABLED')!=='false' ||
    flag('NOTIFICATION_FROM')!==RECIPIENT || flag('NOTIFICATION_REPLY_TO')!==RECIPIENT) return;
 const apiKey=flag('RESEND_API_KEY');
 if(!apiKey||apiKey.includes('\n')||apiKey.includes('\r')) return;
 // Claim atomically. Only the operator can arm this key in D1 once.
 const claimed=await env.DB.prepare("UPDATE settings SET value='attempted' WHERE key=? AND value='armed' RETURNING key")
  .bind(RECORD).first<{key:string}>();
 if(!claimed)return;
 let status='unknown:provider_confirmation_unavailable';
 try{
  const response=await fetcher('https://api.resend.com/emails',{
   method:'POST',
   headers:{'Authorization':'Bearer '+apiKey,'Content-Type':'application/json','Idempotency-Key':IDEMPOTENCY_KEY},
   body:JSON.stringify({
    from:'Safe Places <info@safeplaces.sa>',
    to:[RECIPIENT],
    reply_to:RECIPIENT,
    subject:'Safe Places - one-time email verification (2026-10-20)',
    text:'هذه رسالة اختبار واحدة للتأكد من إعداد البريد الإلكتروني لمؤسسة المناطق الآمنة.\nلا توجد طلبات عملاء أو مشتريات أو مدفوعات مرتبطة بهذه الرسالة.\n\nThis is a one-time Safe Places email test. No customer notification or payment is involved.'
   }),
   signal:AbortSignal.timeout(12000)
  });
  if(response.ok){
   const data=await response.json() as {id?:unknown};
   status=typeof data.id==='string'&&/^[a-z0-9-]{8,80}$/i.test(data.id)?'accepted:'+data.id:'unknown:malformed_provider_response';
  }else{
   status='failed:http_'+response.status;
   await response.body?.cancel();
  }
 }catch{
  // The provider may accept a timed-out request: never automatically retry.
  status='unknown:network_or_timeout';
 }
 await env.DB.prepare("UPDATE settings SET value=? WHERE key=? AND value='attempted'")
  .bind(status,RECORD).run();
}
