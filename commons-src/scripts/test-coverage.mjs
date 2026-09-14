import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {realpathSync,readFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
const require=createRequire(import.meta.url),esbuild=createRequire(realpathSync('node_modules/vite/package.json'))('esbuild');
mkdirSync('.coverage-check',{recursive:true});
for(const name of ['site-catalog','municipalities','ramen-data'])await esbuild.build({entryPoints:['lib/'+name+'.ts'],outfile:'.coverage-check/'+name+'.cjs',bundle:true,platform:'node',format:'cjs',logLevel:'silent'});
const {sites,siteGroups}=require(resolve('.coverage-check/site-catalog.cjs'));
assert.ok(sites.length>=18);
assert.deepEqual(siteGroups.slice(0,4).map(g=>g.numbers.filter(n=>n<=18)),[[1,3,14],[2],[4,5,6,7,8,9,10,11,12,13,15],[16,17,18]]);
assert.equal(new Set(sites.map(s=>s.id)).size,sites.length,'Every app has a unique identity');
assert.deepEqual(siteGroups.flatMap(g=>g.sites.map(s=>s.id)).sort(),sites.map(s=>s.id).sort(),'Every app appears in exactly one group');
assert.equal(sites[17].id,'cyber-news');
assert.equal(sites[17].href,'/commons/cyber-news/');
const {municipalities,municipalityOf,matchesSearch}=require(resolve('.coverage-check/municipalities.cjs'));
assert.equal(new Set(municipalities['岐阜県']).size,42);assert.equal(new Set(municipalities['愛知県']).size,54);
assert.equal(municipalityOf('愛知県','名古屋市中区'),'名古屋市');
assert.equal(municipalityOf('岐阜県','','岐阜県加茂郡白川町河岐'),'白川町');
assert(matchesSearch('岐阜県 関ケ原町 スーパーABC','スーパー ＡＢＣ 関ヶ原'));
assert(!matchesSearch('岐阜県 スーパーABC','愛知 ABC'));
const local=JSON.parse(readFileSync('public/local-data.json','utf8'));
const {ramenShops}=require(resolve('.coverage-check/ramen-data.cjs'));
const report={};
for(const kind of ['supermarkets','saunas','sento','fishmongers','ramen']){
 const rows=kind==='ramen'?ramenShops.map(s=>({...s,prefecture:'岐阜県'})):local.stores.filter(s=>s.categories.includes(kind));
 report[kind]={records:rows.length,regions:Object.entries(municipalities).filter(([p])=>kind!=='ramen'||p==='岐阜県').map(([pref,towns])=>({pref,covered:towns.filter(t=>rows.some(s=>s.prefecture===pref&&municipalityOf(pref,s.city,s.address)===t)).length,total:towns.length}))};
}
console.log(JSON.stringify(report,null,2));console.log('Coverage and hierarchy checks passed');
