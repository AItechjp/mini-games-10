import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),Notebook=require('../study-storage.js');
class Storage{data=new Map();fail='';getItem(k){return this.data.get(k)??null}setItem(k,v){if(k===this.fail)throw Error('quota');this.data.set(k,v)}}
const storage=new Storage(),key='notebook',original=JSON.stringify({answer:'消えてはいけない答案'});storage.setItem(key,original);
const a=new Notebook(storage,key),b=new Notebook(storage,key);a.read();b.read();a.write({answer:'別タブの新しい答案'});
assert.throws(()=>b.write({answer:'古いタブの答案'}),e=>e.code==='conflict');assert.equal(JSON.parse(storage.getItem(key)).answer,'別タブの新しい答案');
assert.throws(()=>b.replace({answer:'インポート'}),e=>e.code==='conflict');
const before=storage.getItem(key);a.replace({answer:'復元した答案'});assert.equal(a.previous(),before);assert.equal(JSON.parse(storage.getItem(key)).answer,'復元した答案');
storage.fail=key;const live=storage.getItem(key);assert.throws(()=>a.replace({answer:'容量不足'}));assert.equal(storage.getItem(key),live);assert.equal(a.observed,live);
storage.fail=key+':before-restore';assert.throws(()=>a.replace({answer:'控えを保存できない'}));assert.equal(storage.getItem(key),live);
storage.fail='';storage.setItem(key,'{broken');const corrupt=new Notebook(storage,key);assert.equal(corrupt.read(),'{broken');corrupt.replace({answer:'有効なバックアップ'});assert.equal(corrupt.previous(),'{broken','exact unreadable source remains available for rescue');
assert.throws(()=>new Notebook(storage,key).write({answer:'uninitialized'}));
vm.runInThisContext(fs.readFileSync('yobi-engine.js','utf8'));const E=globalThis.YobiEngine,bank=JSON.parse(fs.readFileSync('assets/tanto/bank.json','utf8'));
const vector=bank.find(q=>q.kind==='vector'),single=bank.find(q=>q.kind==='single'),now=Date.now(),state=E.emptyStore();
state.legacy={old:{memo:'以前の演習メモ'}};
state.session={id:'active-exam',title:'中断中の演習',mode:'exam',ids:[vector.id,single.id],index:1,answers:{[vector.id]:['1','', '2'],[single.id]:single.answer},confidence:{[single.id]:'unsure'},graded:{[single.id]:true},flags:{[vector.id]:true},started:now-60000,duration:3600000,deadline:now+3540000,remainingMs:3540000,paused:true,pauses:1,block:'public'};
let restored=E.validateBackup(JSON.parse(JSON.stringify(state)),bank);assert.deepEqual(restored.session,state.session);assert.deepEqual(restored.legacy,state.legacy);
assert.equal(E.remaining(restored.session,now+99999999),3540,'paused timers retain remaining time after restore');
state.session.paused=false;restored=E.validateBackup(state,bank);assert.equal(E.remaining(restored.session,state.session.deadline+1),0,'running timer restore cannot restart a deadline');
for(const mutate of [s=>s.ids.push(s.ids[0]),s=>s.ids[0]='unknown',s=>s.index=2,s=>s.graded[vector.id]=true,s=>s.answers[vector.id]=[{}],s=>s.duration=Infinity]){const bad=JSON.parse(JSON.stringify(state));mutate(bad.session);assert.throws(()=>E.validateBackup(bad,bank));}
for(const page of ['yobi-quiz.html','yobi-ronbun.html']){const html=fs.readFileSync(page,'utf8');assert(html.indexOf('study-storage.js')<html.indexOf(page==='yobi-quiz.html'?'yobi-past.js':'ronbun.js'));}
console.log(JSON.stringify({ok:true,storage:['stale write and import rejection','pre-restore checkpoint','quota failure preserves current data','corrupt source rescue'],shortAnswer:['active session roundtrip','partial vector answers','paused and running timers','invalid sessions rejected']}));
