import {randomBytes} from 'node:crypto';

// One deliberate registration request to Resend's nonhuman delivery simulator.
// A fixed address per commit and no retries keep the fixture bounded. A 200
// response can also be opaque duplicate-account success: the release operator
// must correlate the returned UUID with D1 and the fixed provider-acceptance log.
// REQUESTED is not evidence of delivery or even background-provider acceptance.
// https://resend.com/docs/dashboard/emails/send-test-emails
const origin='https://safeplaces.sa';

async function main(){
 const sha=process.env.GITHUB_SHA||'';
 if(process.env.GITHUB_ACTIONS!=='true'||!/^[0-9a-f]{40}$/.test(sha))throw new Error();
 const email=`delivered+safeplaces-auth-${sha.slice(0,12)}@resend.dev`;
 const password=randomBytes(32).toString('base64url');
 const response=await fetch(origin+'/api/auth/sign-up/email',{
  method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),
  headers:{Origin:origin,'Content-Type':'application/json'},
  body:JSON.stringify({name:'Safe Places auth mail check',email,password,callbackURL:'/ar/account/login?verified=1'})
 });
 if(response.status!==200||response.headers.has('set-cookie')){
  await response.body?.cancel();
  throw new Error();
 }
 const cfRay=response.headers.get('cf-ray')||'';
 const data=await response.json();
 if(data?.token!==null||data?.user?.emailVerified!==false||data?.user?.email!==email||
  typeof data.user.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(data.user.id)||
  !/^[0-9a-f]{16,32}-[A-Z]{3}$/i.test(cfRay))throw new Error();
 // Only this owned simulator address, a validated UUID and a validated ray ID
 // may leave memory. Never log the body, password, token or any cookie.
 console.log(JSON.stringify({status:'REQUESTED',email,userId:data.user.id,cfRay}));
}

main().catch(()=>{
 console.error('FAILED: synthetic auth mail request was not confirmed; no retry was made');
 process.exitCode=1;
});
