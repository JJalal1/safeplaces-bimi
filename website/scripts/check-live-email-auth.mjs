import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

// Readiness and password RPC verification only. The synthetic address does not
// exist and sign-in cannot create an account or send mail. No secrets or live
// user identities are used, and bodies/cookies are never written to logs.
const origin='https://safeplaces.sa';
const session=await fetch(origin+'/api/session?scope=customer',{redirect:'error',signal:AbortSignal.timeout(20000)});
assert.equal(session.status,200);
const capability=await session.json();
assert.equal(capability.user,null);assert.equal(capability.authConfigured,true);assert.equal(capability.emailPasswordEnabled,true);
for(const language of ['ar','en']){
 for(const mode of ['login','register','forgot','verify']){
  const response=await fetch(`${origin}/${language}/account/${mode}`,{redirect:'error',signal:AbortSignal.timeout(20000)});
  assert.equal(response.status,200);assert.match(response.headers.get('cache-control')||'',/no-store/);
  const html=await response.text();assert.ok(html.includes('name="email"'),language+' '+mode+' must offer email authentication');
  if(['login','register'].includes(mode))assert.ok(html.includes('name="password"'));
 }
 const admin=await fetch(`${origin}/${language}/account/login?reason=admin&return_to=%2F${language}%2Fadmin`);
 assert.equal(admin.status,200);const html=await admin.text();
 assert.ok(html.includes('Google'));assert.ok(!html.includes('name="password"'));
}
const denied=await fetch(origin+'/api/auth/sign-in/email',{
 method:'POST',redirect:'error',signal:AbortSignal.timeout(30000),
 headers:{Origin:origin,'Content-Type':'application/json'},
 body:JSON.stringify({email:'safeplaces-check-'+randomUUID()+'@example.invalid',password:'Temporary verification '+randomUUID(),callbackURL:'/ar/account'})
});
assert.equal(denied.status,401,'A nonexistent account must safely execute the password path and remain unauthenticated');
assert.equal((await denied.json()).code,'INVALID_EMAIL_OR_PASSWORD');
assert.ok(!denied.headers.get('set-cookie'));
console.log('PASS: production bilingual customer forms, private cache policy, Google-only administration, email capability and live password RPC; no accounts created or emails sent');
