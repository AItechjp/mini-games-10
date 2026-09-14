import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
const org=JSON.parse(await readFile('commons/government-network/agencies.json','utf8'));
const jobs=JSON.parse(await readFile('commons/reemployment-network/records.json','utf8'));
const ids=new Set(org.nodes.map(n=>n.id));
assert.equal(ids.size,org.nodes.length,'Institution IDs must be unique');
assert.equal(org.nodes.filter(n=>n.type==='iaa').length,86,'Match all 86 corporations in the official 2026-04-01 list');
for(const n of org.nodes){assert(n.name);assert.match(n.sourceUrl,/^https:\/\//);assert(n.asOf);}
for(const e of org.edges){assert(ids.has(e.source)&&ids.has(e.target),'Every relationship must reference a known node');assert.notEqual(e.source,e.target);assert.match(e.sourceUrl,/^https:\/\//);}
assert.equal(jobs.records.length,1753);
assert.equal(new Set(jobs.records.map(r=>r.id)).size,1753);
assert.equal(jobs.metadata.extractionComplete,true);assert.equal(jobs.records.filter(r=>r.isSpecialService).length,20);
const counts={};
for(const r of jobs.records){assert(r.name&&r.ministry&&r.formerTitle&&r.destination&&r.destinationTitle);assert.equal(r.careerTrack,'unknown');assert.match(r.sourceUrl,/^https:\/\/www\.(?:cas|mofa)\.go\.jp\/.*\.pdf$/);assert(Number.isInteger(r.sourcePage)&&r.sourcePage>=1&&r.sourcePage<=190);if(!r.isSpecialService)assert(r.spreadsheetRow>=1);counts[r.ministry]=(counts[r.ministry]??0)+1;}
assert.deepEqual(counts,jobs.metadata.ministryCounts);
assert.equal(jobs.records.filter(r=>r.senior).length,213);
for(const route of ['government-network','reemployment-network']){const html=await readFile(`commons/${route}/index.html`,'utf8');assert.match(html,/キャリア|所属/);assert.match(html,/<option value="10000" selected>全件を(?:一|1)枚に/);for(const [,p]of html.matchAll(/(?:src|href)="(\/commons\/[^"?]+)\??[^" ]*"/g))if(/\.(?:js|css|svg)$/.test(p))await access('.'+p);}
console.log(JSON.stringify({passed:true,nodes:org.nodes.length,edges:org.edges.length,incorporatedAgencies:86,records:1753,sourcePagesValidated:true,careerTrackInferences:0}));
