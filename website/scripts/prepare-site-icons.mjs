import sharp from 'sharp';
import {mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';

// Run only when the verified company artwork changes:
// node scripts/prepare-site-icons.mjs /path/to/company-logo.png
const input=process.argv[2];
if(!input)throw new Error('Pass the verified company logo image path.');
const root=fileURLToPath(new URL('../public/',import.meta.url));
mkdirSync(resolve(root,'images'),{recursive:true});
const source=await sharp(input).metadata();
if(!source.width||!source.height||Math.min(source.width,source.height)<180)
 throw new Error('Use the original company artwork, at least 180px on both sides.');
// Preserve the complete logo and its proportions. Pad rather than crop it.
const png=size=>sharp(input).rotate().resize(size,size,{fit:'contain',background:'#ffffff'}).flatten({background:'#ffffff'}).png().toBuffer();
const favicon=await png(96);
writeFileSync(resolve(root,'images/brand-favicon.png'),favicon);
writeFileSync(resolve(root,'apple-touch-icon.png'),await png(180));
const sizes=[16,32,48,96],frames=await Promise.all(sizes.map(png));
const directory=Buffer.alloc(6+16*frames.length);
directory.writeUInt16LE(1,2);directory.writeUInt16LE(frames.length,4);
let offset=directory.length;
frames.forEach((frame,index)=>{
 const entry=6+index*16;
 directory[entry]=sizes[index];directory[entry+1]=sizes[index];
 directory.writeUInt16LE(1,entry+4);directory.writeUInt16LE(32,entry+6);
 directory.writeUInt32LE(frame.length,entry+8);directory.writeUInt32LE(offset,entry+12);
 offset+=frame.length;
});
writeFileSync(resolve(root,'favicon.ico'),Buffer.concat([directory,...frames]));
// Keep the old SVG URL consistent for any existing browser bookmarks.
writeFileSync(resolve(root,'favicon.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><image width="96" height="96" href="data:image/png;base64,'+favicon.toString('base64')+'"/></svg>\n');
console.log('Prepared square 96px favicon, 180px touch icon and 16/32/48/96px ICO from verified company artwork.');
