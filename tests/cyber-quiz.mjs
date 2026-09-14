import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import '../scripts/build-cyber-bank.mjs';
import * as C from '../cyber-quiz/core.mjs';
const bank=JSON.parse(await readFile(new URL('../cyber-quiz/bank.json',import.meta.url),'utf8'));
const by=new Map(bank.questions.map(q=>[q.id,q]));
assert.equal(bank.categories.length,20);assert.equal(bank.questions.length,1000);assert.equal(by.size,1000);assert.equal(new Set(bank.questions.map(q=>q.prompt)).size,1000);
for(const cat of bank.categories)assert.equal(bank.questions.filter(q=>q.category===cat.id).length,50);
for(const q of bank.questions){assert([2,4].includes(q.choices.length));assert.equal(new Set(q.choices).size,q.choices.length);assert(Number.isInteger(q.answer)&&q.answer>=0&&q.answer<q.choices.length);assert(q.explanation.length>=20);assert(q.source.startsWith('https://'));}
const answerPositions=new Set();
for(const cat of bank.categories)for(const mode of ['solo','local']){
 const s=C.makeSession(bank,{category:cat.id,mode,difficulty:'normal',seed:34});assert(C.validSnapshot(s,by));const ids=s.deck.flat().filter(Boolean).map(q=>q.id);assert.equal(ids.length,new Set(ids).size);
 while(s.phase!=='finished'){
  if(s.phase==='result'){C.next(s);continue;}
  const initial=s.hp;for(let p=0;p<s.players;p++){const q=C.questionFor(s,p,by);if(!q)continue;answerPositions.add(q.correct);assert(C.answer(s,p,q.correct,by));assert(!C.answer(s,p,q.correct,by));}
  assert.equal(s.hp,initial);assert(C.validSnapshot(s,by));
 }
 assert(s.won);assert.equal(C.summary(s).accuracy,100);
}
assert.equal(answerPositions.size,4);
const s=C.makeSession(bank,{mode:'local',category:'all',seed:1,difficulty:'expert'});
s.paused=true;C.tick(s,60000,by);assert.equal(s.remaining,25000);assert(!C.answer(s,0,0,by));s.paused=false;
assert(C.useSkill(s,1));assert(!C.useSkill(s,1));C.tick(s,26000,by);assert.equal(s.phase,'result');assert.equal(s.hp,100);assert.equal(s.outcome.wrong,2);C.next(s);C.tick(s,26000,by);assert.equal(s.hp,76);
assert(!C.validSnapshot(null,by));assert(!C.validSnapshot({...s,deck:[null]},by));assert(!C.validSnapshot({...s,round:500},by));assert(!C.validSnapshot({...s,score:Infinity},by));
assert.equal(C.makeSession(bank,{mode:'local',questionMode:'review'},{}),null);
const one=bank.questions[0];const single=C.makeSession(bank,{mode:'local',questionMode:'review',seed:2},{[one.id]:{wrong:1,streak:0}});assert.equal(single.rounds,1);assert.equal(single.deck.flat().filter(Boolean).length,1);const side=single.deck[0][0]?0:1;C.answer(single,side,C.questionFor(single,side,by).correct,by);C.next(single);assert(single.won);
// Fresh-priority must eventually reach every question, including defense in solo.
for(const mode of ['solo','local']){const progress={};for(let n=0;n<110;n++){const t=C.makeSession(bank,{mode,category:'all',questionMode:'fresh',seed:n},progress);for(const q of t.deck.flat().filter(Boolean))progress[q.id]={streak:2};if(Object.keys(progress).length===1000)break;}assert.equal(Object.keys(progress).length,1000);}
console.log('Cyber quiz: 1,000 unique questions; all 20 areas; 40 complete campaigns; answer balance; shared scoring; timeout and shield; malformed state; and all-question learning coverage passed.');
