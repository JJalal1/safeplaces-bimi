import assert from 'node:assert/strict';

// Only the public business identifier is used here. Never publish PDF contents,
// an owner's identity number, TIN or a certificate's serial number in evidence.
const origin='https://safeplaces.sa',registration='7027770788';
const pages=['','about','services','shop','quote','contact','certificates','privacy','terms','returns','collection'];
for(const lang of ['ar','en'])for(const path of pages){
 const response=await fetch(origin+'/'+lang+(path?'/'+path:''),{redirect:'error',signal:AbortSignal.timeout(20000)});
 assert.equal(response.status,200,'Public business page must render: '+lang+'/'+path);
 const html=await response.text();
 const blocks=[...html.matchAll(/<dl class="business-details">([\s\S]*?)<\/dl>/g)].map(match=>match[1]);
 assert.ok(blocks.length>0,'Verified company details must be visible: '+lang+'/'+path);
 for(const block of blocks){
  assert.ok(block.includes(registration),'The published registration must match its certificate');
  assert.ok(block.includes(lang==='ar'?'الرقم الوطني الموحد':'National unified number'),'Use the identifier type printed on the certificate');
  for(const number of block.match(/\b\d{10,15}\b/g)||[]){
   assert.ok(number===registration||/^3\d{13}3$/.test(number),'Do not expose private or mislabeled identifiers');
  }
 }
 if(lang==='ar')assert.ok(html.includes('مؤسسة المناطق الامنة لادوات ومواد السلامة'),'Use the registered Arabic company name');
 if(path==='certificates')assert.ok(html.includes('https://mc.gov.sa/ar/eservices/Pages/Commercial-data.aspx'),'Retain an official registration lookup link');
 if(path==='privacy')assert.ok(html.includes('id="policy-rights"')&&html.includes('id="policy-retention"'));
}
console.log('PASS: verified registration, registered name, bilingual footer/contact/documents/policies and public-ID publication checks across 22 live pages');
