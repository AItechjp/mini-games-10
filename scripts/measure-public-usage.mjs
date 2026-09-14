import {readdir,stat,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
export async function measurePublicUsage(directory){
 const root=resolve(directory),target=join(root,'commons/usage/build-usage.json');
 await mkdir(join(root,'commons/usage'),{recursive:true});
 const commit=process.env.GITHUB_SHA||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 if(!/^[a-f\d]{40}$/.test(commit))throw new Error('Invalid build commit');
 const record={version:1,measuredAt:new Date().toISOString(),commit,bytes:0,files:0,largestFileBytes:0};
 // Include this report itself in the published size; iterate until its digit count stabilizes.
 for(let pass=0;pass<8;pass++){
  await writeFile(target,JSON.stringify(record,null,2)+'\n');
  let bytes=0,files=0,largestFileBytes=0;
  async function walk(dir){for(const item of await readdir(dir,{withFileTypes:true})){const path=join(dir,item.name);if(item.isDirectory())await walk(path);else if(item.isFile()){const {size}=await stat(path);bytes+=size;files++;largestFileBytes=Math.max(largestFileBytes,size);}}}
  await walk(root);
  if(record.bytes===bytes&&record.files===files&&record.largestFileBytes===largestFileBytes)return record;
  Object.assign(record,{bytes,files,largestFileBytes});
 }
 throw new Error('Public size report did not converge');
}
