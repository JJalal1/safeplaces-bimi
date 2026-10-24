import assert from 'node:assert/strict';
import sharp from 'sharp';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

export async function checkBrandIcons(root){
 const checked=[];
 for(const [path,size] of [['images/brand-favicon.png',96],['apple-touch-icon.png',180]]){
  const bytes=readFileSync(resolve(root,path)),meta=await sharp(bytes).metadata();
  assert.equal(meta.format,'png',path+' must be a real PNG');
  assert.equal(meta.width,size,path+' must have the declared square width');
  assert.equal(meta.height,size,path+' must be square for search and browser use');
  // Decode the payload as well as its header to catch corrupt assets.
  await sharp(bytes).raw().toBuffer();
  checked.push({path,width:meta.width,height:meta.height,bytes:bytes.length});
 }
 const ico=readFileSync(resolve(root,'favicon.ico'));
 assert.equal(ico.readUInt16LE(0),0);assert.equal(ico.readUInt16LE(2),1);
 assert.equal(ico.readUInt16LE(4),4);
 for(const [index,size]of [16,32,48,96].entries()){
  const entry=6+index*16,length=ico.readUInt32LE(entry+8),offset=ico.readUInt32LE(entry+12);
  assert.equal(ico[entry],size);assert.equal(ico[entry+1],size);
  assert.ok(offset>=70&&offset+length<=ico.length,'ICO frame must be inside the file');
  const frame=ico.subarray(offset,offset+length),meta=await sharp(frame).metadata();
  assert.equal(meta.width,size);assert.equal(meta.height,size);await sharp(frame).raw().toBuffer();
 }
 const svg=readFileSync(resolve(root,'favicon.svg'),'utf8');
 assert.ok(svg.includes(readFileSync(resolve(root,'images/brand-favicon.png')).toString('base64')),'The legacy SVG must use the same company mark');
 console.log('PASS: square company PNG icons, decoded ICO frames and consistent legacy favicon');
 return checked;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
 await checkBrandIcons(resolve(process.argv[2]||'public'));
