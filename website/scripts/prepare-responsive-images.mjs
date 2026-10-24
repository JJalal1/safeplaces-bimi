import sharp from 'sharp';
import {readFileSync,statSync,mkdirSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const profiles=JSON.parse(readFileSync(join(root,'data/responsive-images.json'),'utf8'));
const output=join(root,'public/images/responsive');mkdirSync(output,{recursive:true});
const results=[];
for(const profile of profiles){
 const input=join(root,'public',profile.src),sourceBytes=statSync(input).size;
 const source=await sharp(input).metadata();
 for(const width of profile.widths){
  const path=join(output,profile.name+'-'+width+'.webp');
  // Avoid invented descriptors: a future asset replacement must still cover
  // the declared width. Never silently upscale a lower-resolution source.
  if(!source.width||source.width<width)throw new Error(profile.src+' is smaller than responsive width '+width);
  const result=await sharp(input).rotate().resize({width,withoutEnlargement:true}).webp({quality:profile.quality,effort:5}).toFile(path);
  results.push({source:profile.src,url:'/images/responsive/'+profile.name+'-'+width+'.webp',width:result.width,height:result.height,bytes:result.size,sourceBytes});
 }
}
writeFileSync(join(output,'manifest.json'),JSON.stringify(results,null,2)+'\n');
console.log('Prepared '+results.length+' responsive WebP variants from '+profiles.length+' existing images.');
