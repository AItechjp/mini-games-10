import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {realpathSync} from 'node:fs';
const {build}=createRequire(realpathSync('node_modules/wrangler/package.json'))('esbuild');
await build({entryPoints:['lib/realtime-collector.ts'],outfile:'/tmp/commons-collector.mjs',bundle:true,platform:'node',format:'esm'});
await build({entryPoints:['lib/realtime-evidence.ts'],outfile:'/tmp/commons-evidence.mjs',bundle:true,platform:'node',format:'esm'});
const {siteName,emptySnapshot}=await import('/tmp/commons-evidence.mjs');
const {inspectReviewed}=await import('/tmp/commons-collector.mjs');
const targets=JSON.parse(await readFile('data/realtime-targets.json','utf8'));
const result={...emptySnapshot,updatedAt:new Date().toISOString()},sources=new Map();
for(const target of targets){
 const key=createHash('sha256').update(target.url).digest('hex'),capture=await readFile('/tmp/commons-realtime-captures/'+key+'.json','utf8').then(JSON.parse).catch(()=>({checkedAt:new Date().toISOString(),error:'未取得'}));
 const e=capture.status===200?inspectReviewed(target,capture.html,new Date(capture.checkedAt)):{id:target.id,url:target.url,checkedAt:capture.checkedAt,expiresAt:capture.checkedAt,ok:false,reason:capture.error};
 if(capture.html)e.hash=createHash('sha256').update(capture.html).digest('hex');
 result.evidence.push(e);
 const s=sources.get(target.url)||{url:target.url,site:siteName(target.url),checkedAt:capture.checkedAt,ok:capture.status===200,httpStatus:capture.status||null,records:0,reason:capture.error};s.records+=Number(e.ok);sources.set(target.url,s);
}
result.sources=[...sources.values()];
await writeFile('data/realtime-initial.json',JSON.stringify(result)+'\n');
console.log(JSON.stringify({pages:result.sources.length,successfulPages:result.sources.filter(s=>s.ok).length,successfulSites:new Set(result.sources.filter(s=>s.ok).map(s=>s.site)).size,verified:result.evidence.filter(e=>e.ok).length,methods:result.evidence.filter(e=>e.ok).reduce((a,e)=>(a[e.method]=(a[e.method]||0)+1,a),{})}));
