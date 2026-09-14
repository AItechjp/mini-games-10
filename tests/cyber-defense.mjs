import assert from 'node:assert/strict';
import {MISSIONS,LEVELS,GOALS} from '../cyber-defense/missions.mjs';
import {createRun,getStep,command,resolveTurn,nextTurn,validSnapshot} from '../cyber-defense/engine.mjs';
assert.equal(MISSIONS.length,100);
assert.equal(new Set(MISSIONS.map(x=>x.id)).size,100);
assert.equal(new Set(MISSIONS.map(x=>x.title)).size,100);
assert.equal(new Set(MISSIONS.map(x=>x.opening)).size,100);
assert.equal(MISSIONS.filter(x=>x.boss).length,5);
for(let i=0;i<5;i++)assert.equal(MISSIONS.filter(m=>m.level===i).length,20);
let victories=0,failures=0;const health=[];
for(const m of MISSIONS){
 assert.ok(m.evidence.length>10&&m.place&&m.opening.length>20);
 let s=createRun(m.id,'local',true,42);
 assert.equal(s.remaining,LEVELS[m.level].seconds);
 for(let i=0;i<6;i++){
  assert.ok(validSnapshot(s));
  const step=getStep(s);assert.equal(step.options.length,3);assert.equal(new Set(step.options.map(x=>x.id)).size,3);
  const best=step.options.find(o=>o.quality===2);assert.ok(best.cost<=s.cp,`mission ${m.id} must afford a sound plan`);
  s=command(s,0,'pick',best.id);s=command(s,0,'lock');
  assert.equal(resolveTurn(s),s,'a single confirmed player must not advance');
  const lockedPick=s.picks[0];s=command(s,0,'pick','risky');assert.equal(s.picks[0],lockedPick);
  s=command(s,1,'pick',best.support);s=command(s,1,'lock');
  if(s.charge>=100){const before=s.cp;s=command(s,1,'link');assert.equal(s.cp,before+3);assert.equal(command(s,1,'link'),s);}
  s=resolveTurn(s);assert.ok(validSnapshot(s));assert.equal(s.history.length,i+1);
  if(i<5){assert.equal(s.phase,'report');s=nextTurn(s);}else{assert.equal(s.phase,'result');assert.ok(s.won,`mission ${m.id} must be winnable`);}
 }
 assert.equal(resolveTurn(s),s,'completed games cannot resolve twice');
 victories++;health.push([m.id,s.service,s.data,s.trust]);
 let bad=createRun(m.id,'local',false,42);
 for(let i=0;i<6;i++){bad=command(bad,0,'pick','risky');bad=command(bad,0,'lock');bad=command(bad,1,'pick','scan');bad=command(bad,1,'lock');bad=resolveTurn(bad);if(bad.phase==='result')break;bad=nextTurn(bad);}
 assert.equal(bad.phase,'result');assert.equal(bad.won,false,`mission ${m.id} must be loseable`);failures++;
}
let s=createRun(100,'local',true,44);
assert.equal(command(s,2,'pick','precise'),s);
assert.equal(command(s,0,'pick','invented'),s);
assert.equal(command({...s,cp:0},0,'pick','precise').picks[0],null);
const timed=resolveTurn(s,true);assert.equal(timed.history[0].timeout,true);assert.equal(timed.history[0].support,'支援なし');
const paused={...s,paused:true};assert.equal(resolveTurn(paused,true),paused);assert.equal(command(paused,0,'pick','precise'),paused);
assert.equal(command(s,0,'link'),s,'P1 cannot use the P2 ability');
assert.equal(validSnapshot({...s,history:[{label:'<script>'}]}),false);
assert.equal(validSnapshot({...s,service:Infinity}),false);
const objectiveFailure={...s,turn:5,service:1,data:100,trust:100,threat:1};
assert.ok(GOALS[MISSIONS[99].goal]);
console.log(JSON.stringify({missions:100,victories,failures,cooperativeTurnGates:true,timerAndPause:true,snapshotValidation:true,finalBossHealth:health.at(-1)},null,2));
