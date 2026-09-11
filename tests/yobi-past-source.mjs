import fs from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import './ronbun-source.mjs';
import './study-storage.mjs';
const html=fs.readFileSync('yobi-quiz.html','utf8');
for(const required of ['yobi-past.js','yobi-engine.js','practiceView','sessionView'])assert(html.includes(required),required+' missing');
for(const forbidden of ['yobi-complete.js','yobi-complete-data.js','yobi-quiz.js','yobi-quiz-randomize.js','ads-bootstrap','admax','adsbygoogle'])assert(!html.includes(forbidden),'generated bank or advertising must not be connected: '+forbidden);
const bank=JSON.parse(fs.readFileSync('assets/tanto/bank.json','utf8')),meta=JSON.parse(fs.readFileSync('assets/tanto/manifest.json','utf8')),guide=JSON.parse(fs.readFileSync('assets/tanto/guide.json','utf8')),lessonIds=new Set(JSON.parse(fs.readFileSync('assets/ronbun/lessons.json','utf8')).map(l=>l.id));
assert.equal(bank.length,meta.count);assert.equal(new Set(bank.map(q=>q.id)).size,bank.length);
for(const q of bank){
 assert(['preliminary','bar'].includes(q.exam));assert(q.year>=2011&&q.year<=2025);assert(q.n>0&&q.text.length>30);
 assert.match(q.source,/^https:\/\/www\.moj\.go\.jp\/(content|content\/|jinji\/)[\w/.-]+\.pdf$/);
 assert(q.answer.length>0&&q.answer.every(a=>/^[1-9]$/.test(a)&&Number(a)<=q.maxChoice));assert(q.points>0&&q.points<=4);
 assert(['single','set','vector'].includes(q.kind));if(q.kind==='single')assert.equal(q.answer.length,1);if(q.kind==='set')assert.equal(new Set(q.answer).size,q.answer.length,'set has duplicate answers: '+q.id);
 assert(!q.text.includes('(cid:'));assert(Array.isArray(q.topics)&&q.topics.length);
}
for(const subject of ['憲法','行政法','民法','商法','民事訴訟法','刑法','刑事訴訟法']){
 const latest=bank.filter(q=>q.exam==='preliminary'&&q.year===2025&&q.subject===subject);assert(latest.length>=12,subject+' insufficient coverage');assert.equal(latest.reduce((s,q)=>s+q.points,0),30,subject+' points');
}
for(const p of meta.coverage){const qs=bank.filter(q=>q.exam===p.exam&&q.year===p.year&&q.block===p.block);assert.equal(qs.length,p.loaded);assert.equal(p.loaded+p.missing.length,p.count,'coverage mismatch: '+JSON.stringify(p));}
for(const g of Object.values(guide))assert(lessonIds.has(g.ronbunLesson),'broken essay lesson link: '+g.ronbunLesson);
assert(html.includes('yobi-ronbun.html'));assert(fs.readFileSync('yobi-past.js','utf8').includes('memoTemplate'));
vm.runInThisContext(fs.readFileSync('yobi-engine.js','utf8'));const E=globalThis.YobiEngine;
// Validate all real answer encodings, including multi-select order and missing answers.
for(const q of bank){assert(E.grade(q,q.answer).correct,q.id+' correct key does not score');assert(!E.grade(q,[]).correct,q.id+' missing answer scores');if(q.kind==='set')assert(E.grade(q,q.answer.slice().reverse()).correct,q.id+' order sensitive set');}
// Known official answer correction and explicit partial-credit example.
const q=bank.find(q=>q.id==='shihou_2023_憲法_008');assert.deepEqual(q.answer,['1','2','1']);assert(q.answerSource);
const partial=bank.find(q=>q.id==='shihou_2024_憲法_001');assert.equal(E.grade(partial,['1','2','2']).points,1);
const civil=bank.find(q=>q.id==='shihou_yobi_2025_民法商法民事訴訟法_001');const store=E.emptyStore();const now=Date.UTC(2026,8,11,0,0);
E.recordAttempt(store,civil,civil.answer,'guess',now);assert.equal(store.records[civil.id].stage,0);assert.equal(E.stats([civil],store,now).unsure,1);
E.recordAttempt(store,civil,civil.answer,'sure',now+E.DAY);assert.equal(store.records[civil.id].stage,1);
E.recordAttempt(store,civil,civil.answer,'sure',now+E.DAY+60000);assert.equal(store.records[civil.id].stage,1,'same-day repeats must not imply mastery');
E.recordAttempt(store,civil,civil.answer,'sure',now+2*E.DAY);E.recordAttempt(store,civil,civil.answer,'sure',now+5*E.DAY);assert.equal(E.stats([civil],store).mastered,1);
const wrong=[String(Number(civil.answer[0])%civil.maxChoice+1)];E.recordAttempt(store,civil,wrong,'sure',now+6*E.DAY);assert.equal(store.records[civil.id].stage,0);assert(E.filterBank([civil],store,{status:'wrong'}).length===1);
assert(E.filterBank(bank,store,{subject:'民法',year:'2025',exam:'preliminary'}).every(q=>q.subject==='民法'&&q.year===2025));
const officialOnly=E.filterBank(bank,store,{source:'official'});assert.equal(officialOnly.length,meta.officialAnswerVerified);assert(officialOnly.every(q=>q.answerSource));
assert(E.filterBank(bank,store,{source:'dataset'}).every(q=>!q.answerSource));
store.records[civil.id].choiceReviewed=true;assert.deepEqual(E.filterBank([civil],store,{status:'choiceReviewed'}),[civil]);
const queue=E.dailyQueue(bank.filter(q=>!q.pdfOnly&&q.exam==='preliminary'),E.emptyStore(),20);assert.equal(new Set(queue.map(q=>q.id)).size,20);assert.equal(new Set(queue.map(q=>q.subject)).size,7);
const s={duration:60000,deadline:now+60000,paused:false};assert.equal(E.remaining(s,now+30000),30);E.pause(s,now+30000);assert.equal(E.remaining(s,now+90000),30);E.resume(s,now+120000);assert.equal(E.remaining(s,now+130000),20);assert.equal(E.remaining(s,now+160000),0);
const restored=E.validateBackup(JSON.parse(JSON.stringify(store)),bank);assert.equal(restored.records[civil.id].attempts,store.records[civil.id].attempts);assert.throws(()=>E.validateBackup({schema:0},bank));assert.throws(()=>E.validateBackup({schema:3,records:null},bank));
assert(restored.records[civil.id].choiceReviewed,'full-choice self-check must survive backup restore');
const readinessStore=E.emptyStore(),legal=bank.filter(q=>q.exam==='preliminary'&&q.subject!=='一般教養'&&!q.pdfOnly);
for(const q of legal)readinessStore.records[q.id]={attempts:3,correct:3,firstCorrect:true,lastCorrect:true,confidence:'sure',stage:3,due:now+30*E.DAY,lastAt:now,lastDay:E.dayKey(now)};
for(const block of ['public','civil','criminal'])for(let i=0;i<2;i++)readinessStore.history.push({id:block+i,title:block,at:now,correct:1,total:1,points:80,max:100,mode:'exam',pauses:0,block,exam:'preliminary',year:2024+i});
for(let i=0;i<2;i++)readinessStore.history.push({id:'general'+i,title:'一般教養',at:now,correct:14,total:20,points:42,max:60,mode:'exam',pauses:0,block:'general',exam:'preliminary',year:2024+i});
assert(E.readiness(bank,readinessStore,now).passed,'completed readiness gates should pass');assert(!E.readiness(bank,E.emptyStore(),now).passed,'empty record must not pass readiness');
const roundtrip=E.validateBackup(readinessStore,bank);assert.equal(roundtrip.history[0].block,'public');
console.log(JSON.stringify({ok:true,questions:bank.length,legal:meta.legalCount,general:meta.generalCount,officialAnswerVerified:meta.officialAnswerVerified,scoring:'all answer keys checked',review:'spaced repetitions and confidence checked',timer:'pause/resume/expiry checked'}));
