import {checkBrandIcons} from './check-brand-icons.mjs';
import assert from 'node:assert/strict';
import {readFileSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const profiles=JSON.parse(readFileSync('data/responsive-images.json','utf8'));
const entries=JSON.parse(readFileSync('dist/client/images/responsive/manifest.json','utf8'));
assert.equal(entries.length,profiles.reduce((sum,p)=>sum+p.widths.length,0));
for(const profile of profiles)for(const width of profile.widths){
 const entry=entries.find(e=>e.source===profile.src&&e.width===width);
 assert.ok(entry,profile.src+' variant '+width);
 const file=resolve('dist/client'+entry.url),bytes=readFileSync(file);
 assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
 assert.equal(statSync(file).size,entry.bytes);assert.ok(entry.height>0);
 if(width===profile.widths[0])assert.ok(entry.bytes<entry.sourceBytes,'The smallest variant must reduce download size');
}
mkdirSync('test-results',{recursive:true});writeFileSync('test-results/responsive-images.json',JSON.stringify(entries,null,2)+'\n');
console.log('PASS: '+entries.length+' real responsive WebP assets with expected widths, intact payloads and smaller mobile variants');

await checkBrandIcons(resolve('dist/client'));
