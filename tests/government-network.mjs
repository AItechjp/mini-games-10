import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const org=JSON.parse(await readFile('commons/government-network/organizations.json','utf8'));
const jobs=JSON.parse(await readFile('commons/government-network/reemployment.json','utf8'));
const ids=new Set(org.nodes.map(n=>n.id));assert.equal(ids.size,org.nodes.length);assert.equal(org.nodes.filter(n=>n.number).length,86);
const expected={'内閣府':3,'消費者庁':1,'総務省':3,'外務省':2,'財務省':3,'文部科学省':22,'厚生労働省':16,'農林水産省':9,'経済産業省':9,'国土交通省':15,'環境省':2,'防衛省':1};
for(const [ministry,count] of Object.entries(expected))assert.equal(org.nodes.filter(n=>n.number&&n.parent===ministry).length,count,ministry);
for(const e of org.edges){assert(ids.has(e.source)&&ids.has(e.target));assert.notEqual(e.source,e.target);}
assert(!org.edges.some(e=>e.target==='会計検査院'));
for(const [name,parent] of [['警察庁','国家公安委員会'],['国税不服審判所','国税庁'],['日本芸術院','文化庁']])assert(org.edges.some(e=>e.source===parent&&e.target===name));
assert.equal(org.nodes.filter(n=>n.kind==='行政執行法人').length,7);assert.equal(org.nodes.filter(n=>n.kind==='国立研究開発法人').length,26);
assert.equal(jobs.records.length,20);assert.equal(new Set(jobs.records.map(r=>r.person)).size,19);assert.equal(jobs.records.filter(r=>r.person==='山田滝雄').length,2);
for(const r of jobs.records){assert(r.source.startsWith('https://www.mofa.go.jp/'));assert(r.retiredAt<=r.joinedAt);assert.equal(r.careerStatus,'採用区分未確認');}
console.log('PASS: 86 corporations, ministry totals and types, organization parents, 20 sourced reemployment records.');
