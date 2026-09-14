import assert from 'node:assert/strict';
import {SCENARIOS,DIFFICULTIES,GOALS,TECHNIQUES} from '../hacking-story/data.mjs';
import {createMission,vote,execute,advance,validState,actions,objectiveMet} from '../hacking-story/engine.mjs';
assert.equal(SCENARIOS.length,100);
assert.equal(new Set(SCENARIOS.map(m=>m.title)).size,100);
for(let i=0;i<5;i++)assert.equal(SCENARIOS.filter(s=>s.difficulty===i).length,20);
for(const g of Object.keys(GOALS))assert.equal(SCENARIOS.filter(s=>s.goal===g).length,20);
const move=(s,id,support='intel')=>execute(vote(vote(s,0,id),1,support));
const ideal=s=>({recon:'public',access:'matched',discovery:SCENARIOS[s.mission-1].route,pivot:'linked',credential:'evidence',privilege:'scoped',vault:'exact',encrypt:'bounded',exfil:'transfer'})[s.node];
let decisions=0;
for(const m of SCENARIOS){let s=createMission(m.id);while(s.phase!=='ended'&&s.log.length<30){const before=s;const picked=vote(s,0,ideal(s));assert.equal(execute(picked),picked,'one player cannot advance alone');s=move(s,ideal(s));assert.notEqual(s,before);assert(validState(s));assert(s.log.every(l=>!l.tech||TECHNIQUES[l.tech]));decisions++;if(s.phase==='feedback')s=advance(s);}assert(s.ending?.success,`${m.id}: ${s.ending?.text}`);assert(objectiveMet(s));assert.equal(s.node,'end');assert.equal(execute(s),s,'finished goals cannot continue');}
let s=createMission(1);s=advance(move(s,'public'));s=advance(move(s,'matched'));s=advance(move(s,SCENARIOS[0].route==='archive'?'service':'archive'));assert.equal(s.node,'deadend');s=advance(move(s,'return'));assert.equal(s.node,'discovery');
let recovery=move({...createMission(1),node:'recovery'},'abort');assert.equal(recovery.ending.success,false);
let timeout=move({...createMission(1),turns:1},'public','watch');assert.equal(timeout.ending.success,false);
let blocked=move({...createMission(1),trace:99},'scan');assert.equal(blocked.ending.success,false);
let corrupt=move({...createMission(1),node:'vault',integrity:55},'exact');assert.equal(corrupt.ending.success,false);
let exact=move({...createMission(1),node:'vault',turns:1},'exact');assert.equal(exact.ending.success,true,'goal on last available turn succeeds');
let support=move({...createMission(1),node:'vault',integrity:74},'bulk','protect');assert.equal(support.ending.success,true,'preservation support makes the risky collection viable');
let none={...createMission(1),assist:0};assert.equal(vote(none,1,'watch'),none);
assert.equal(validState({...createMission(1),mission:101}),false);
assert.equal(validState({...createMission(1),node:'unknown'}),false);
assert.equal(validState({...createMission(1),trace:NaN}),false);
assert.equal(validState({...createMission(1),phase:'feedback',feedback:{text:'bad'}}),false);
assert.equal(validState({...createMission(1),log:[{step:1,node:'recon',action:'x',support:'x',tech:'javascript:bad',trace:1,integrity:0,cost:1}]}),false);
// Explore decisions across every scenario; each reachable state keeps valid choices
// and resource limits guarantee termination even through repeated recovery loops.
let seed=713;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
for(const m of SCENARIOS){let r=createMission(m.id);while(r.phase!=='ended'&&r.log.length<40){const available=actions(r).filter(a=>!a.disabled);assert(available.length);r=move(r,available[Math.floor(random()*available.length)].id);assert(validState(r));if(r.phase==='feedback')r=advance(r);}assert.equal(r.phase,'ended');}
console.log(JSON.stringify({result:'PASS',scenarios:100,goalTypes:5,difficulties:DIFFICULTIES.length,successfulDecisions:decisions,checks:['all goals reachable','both roles required','branch recovery','withdrawal','trace limit','turn limit','integrity threshold','last-turn goal','support effects','invalid snapshots','100 exploratory routes terminate']}));
