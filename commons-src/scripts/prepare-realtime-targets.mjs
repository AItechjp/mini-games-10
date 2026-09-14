import {readFile,writeFile} from 'node:fs/promises';
import {build} from 'esbuild';
await build({entryPoints:['lib/ramen-data.ts'],outfile:'/tmp/commons-ramen-data.mjs',bundle:true,platform:'node',format:'esm'});
const {ramenShops}=await import('/tmp/commons-ramen-data.mjs');
const local=JSON.parse(await readFile('public/local-data.json','utf8'));
const sauna=JSON.parse(await readFile('data/sauna-snapshot.json','utf8'));
const targets=local.stores.filter(s=>s.sourceType==='official').map(s=>({...s,url:s.sourceUrl,kinds:s.categories}));
for(const s of ramenShops)if(!s.source.includes('instagram.com'))targets.push({...s,url:s.source,kinds:['ramen'],prefecture:'岐阜県',sourceName:s.sourceLabel});
const curated=[
 ['tenko','天光の湯','岐阜県','多治見市','岐阜県多治見市大畑町6-105-1','https://tenko-spa.jp/'],
 ['megumi','恵みの湯','岐阜県','各務原市','岐阜県各務原市鵜沼各務原町2-68','https://www.meguminoyu.jp/'],
 ['minori','湯どころ みのり','岐阜県','岐南町','岐阜県羽島郡岐南町下印食2-60-1','https://yudocoro-minori.com/price/'],
 ['bizin','美人の湯かかみがはら','岐阜県','各務原市','岐阜県各務原市蘇原申子町1丁目1','https://bizin-yu.co.jp/'],
 ['eagle','サウナイーグル','愛知県','知立市','愛知県知立市宝町塩掻58','https://sauna-eagle.jp/'],
 ['canal','キャナルリゾート','愛知県','名古屋市','愛知県名古屋市中川区玉川町4-1','https://canalresort.jp/guide/'],
 ['toukichirou','湯吉郎','愛知県','清須市','愛知県清須市下河原下之切1110-1','https://toukichirou.com/'],
 ];
for(const [id,name,prefecture,city,address,url] of curated)targets.push({id:'realtime-'+id,name,prefecture,city,address,url,kinds:['saunas','sento','sauna'],sourceName:'施設公式',phone:'',scope:'facility'});
const hosts=['asaka-sauna-nagomi.com','www.funabashi-sauna.com','www.ryusenjinoyu.com','www.yurakirari.com','www.timesspa-resta.jp','floba-mitaka.jp','www.takaosan-onsen.jp','www.chichibuonsen.co.jp','www.sauna-noel.com','sekinoyu-spa.com','eastland.jp','sakaeyu.com','rakuspa.com'];
for(const s of sauna.facilities)if(s.website.startsWith('https://')&&hosts.includes(new URL(s.website).hostname))targets.push({...s,url:s.website,kinds:['sauna'],sourceName:'施設公式',scope:'facility'});
const seen=new Set();const unique=targets.filter(s=>{const key=s.name.replace(/\s/g,'')+'|'+s.prefecture;if(seen.has(key))return false;seen.add(key);return true;}).map(s=>({id:s.id,name:s.name,prefecture:s.prefecture,city:s.city||'',address:s.address,phone:s.phone||'',url:s.url,kinds:s.kinds,sourceName:s.sourceName,scope:s.scope||'store'}));
await writeFile('data/realtime-targets.json',JSON.stringify(unique,null,2)+'\n');
console.log({targets:unique.length,pages:new Set(unique.map(x=>x.url)).size,hosts:new Set(unique.map(x=>new URL(x.url).hostname)).size});
