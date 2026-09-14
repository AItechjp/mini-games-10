import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const sharp=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'sharp') : 'sharp');
const input=process.argv[2];
if(!input) throw new Error('Pass the JSON file containing the generated portrait paths.');
const entries=JSON.parse(await fs.readFile(input,'utf8'));
const dest=new URL('../dungeon-dice/artwork/',import.meta.url);
await fs.mkdir(dest,{recursive:true});
const manifest=[];
for(const entry of entries){
  const original=sharp(entry.source);
  const metadata=await original.metadata();
  if(!metadata.width || metadata.width!==metadata.height) throw new Error(`Portrait must be square: ${entry.key}`);
  let full;
  compression: for(const width of [640,576,512,480,448,416]){
    for(const quality of [78,70,62,54,46]){
      full=await original.clone().resize(width,width,{fit:'inside',withoutEnlargement:true}).webp({quality,effort:6}).toBuffer();
      if(full.length<=42000)break compression;
    }
  }
  if(full.length>42000) throw new Error(`Portrait exceeds the mobile image budget: ${entry.key}`);
  const thumb=await original.clone().resize(160,160).webp({quality:75,effort:6}).toBuffer();
  await fs.writeFile(new URL(`${entry.key}.webp`,dest),full);
  await fs.writeFile(new URL(`${entry.key}-thumb.webp`,dest),thumb);
  manifest.push({key:entry.key,name:entry.name,file:`${entry.key}.webp`,thumbnail:`${entry.key}-thumb.webp`,bytes:full.length,thumbnailBytes:thumb.length,prompt:entry.prompt});
  console.log(`${entry.key}: full ${full.length} bytes; thumbnail ${thumb.length} bytes`);
}
await fs.writeFile(new URL('manifest.json',dest),JSON.stringify({version:'20260915-anime-v1',method:'Built-in image_gen tool; original AI-generated reinterpretations, not official card scans.',count:manifest.length,images:manifest},null,2)+'\n');
