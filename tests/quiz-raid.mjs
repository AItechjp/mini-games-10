import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {BOSSES,newRaid,resolveRound,nextRound,useSkill,selectQuestions} from '../quiz-raid/core.mjs';
const {questions:q}=JSON.parse(await readFile(new URL('../quiz-raid/questions.json',import.meta.url)));
assert.equal(q.length,1000);assert.equal(new Set(q.map(x=>x.id)).size,1000);assert.equal(new Set(q.map(x=>x.question)).size,1000);
for(const domain of ['law','it'])assert.equal(q.filter(x=>x.domain===domain).length,500);
for(const x of q){assert.equal(x.options.length,4,x.id);assert.equal(new Set(x.options).size,4,x.id);assert.ok(x.correct>=0&&x.correct<4,x.id);assert.ok(x.explanation.length>10,x.id);assert.ok(/^https:\/\//.test(x.source),x.id);}
const source=JSON.parse(await readFile(new URL('../assets/ronbun/articles.json',import.meta.url))).articles;
for(const x of q.filter(x=>x.kind==='条文')){const excerpt=x.question.slice(x.question.indexOf('「')+1,-1);assert.equal(excerpt.split('〔　？　〕').length,2,x.id);const original=excerpt.replace('〔　？　〕',x.options[x.correct]);assert.ok(Object.values(source).some(a=>a.text.includes(original)),x.id+' must reconstruct its original provision');}
for(const x of q.filter(x=>x.kind==='コード')){let code=x.question.replace(/^JavaScript: /,'').replace(/ の値は？$/,'');assert.equal(String(runInNewContext(code,{}, {timeout:1000})),x.options[x.correct],x.id);}
for(const difficulty of ['easy','normal','hard']){let s=newRaid({difficulty}),turns=0;while(turns<100){const r=resolveRound(s,[true,true]);assert.equal(r.hurt,0);if(r.won)break;assert.ok(nextRound(s));turns++;}assert.equal(s.cleared,5);assert.ok(s.hp>0);assert.equal(nextRound(s),false);assert.equal(s.phase,'result');}
{
 const s=newRaid();const first=resolveRound(s,[true,false]);assert.ok(first.attack>0);assert.ok(first.hurt>0);const snapshot=JSON.stringify(s);assert.equal(resolveRound(s,[true,true]),null);assert.equal(JSON.stringify(s),snapshot,'a double click must not score twice');
}
{
 const guarded=newRaid(),plain=newRaid();assert.ok(useSkill(guarded,'guard'));assert.equal(useSkill(guarded,'guard'),false);assert.ok(resolveRound(guarded,[false,false]).hurt<resolveRound(plain,[false,false]).hurt);
 const s=newRaid();assert.ok(useSkill(s,'hint'));assert.ok(useSkill(s,'hint'));assert.equal(useSkill(s,'hint'),false);assert.equal(useSkill(s,'unison'),false);s.charge=100;assert.ok(useSkill(s,'unison'));assert.equal(useSkill(s,'unison'),false);const r=resolveRound(s,[true,true]);assert.ok(r.unison&&r.attack>=159);
}
{
 const s=newRaid();let turns=0;while(s.hp>0&&turns<100){resolveRound(s,[false,false]);turns++;if(s.hp)assert.ok(nextRound(s));}assert.equal(s.hp,0);assert.equal(nextRound(s),false);
}
{
 const s=newRaid({review:true});for(let i=0;i<150;i++){resolveRound(s,i%4===0?[false,false]:[true,true]);assert.ok(nextRound(s),'review must continue beyond five bosses');assert.ok(s.wave<BOSSES.length&&s.hp>0);}
}
assert.equal(selectQuestions(q,'law','all').length,500);assert.ok(selectQuestions(q,'it','データベース').every(x=>x.domain==='it'&&x.category==='データベース'));assert.equal(selectQuestions(q,'mix','all',[q[0].id,q[500].id]).length,2);
console.log('QUIZ RAID: 1,000 questions, original statutory excerpts, executable code answers, three difficulties, co-op skills, defeat, victory and long review verified.');
