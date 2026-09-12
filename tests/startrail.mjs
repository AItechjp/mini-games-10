import assert from 'node:assert/strict';
import {Game,FINISH,layout} from '../startrail/engine.mjs';
function begin(){const g=new Game();g.start();return g;}
let tests=0;
function test(name,fn){fn();tests++;console.log('PASS',name);}
test('five zones and 195 collectible coins',()=>{const l=layout();assert.equal(l.checkpoints.length,5);assert.equal(l.coins.length,195);assert.equal(l.enemies.length,20);});
test('jump lands and holding changes height',()=>{
  const peaks=[];for(const hold of [8,120]){const g=begin();let peak=0;for(let i=0;i<170;i++){g.step(1/120,{jump:i<hold});peak=Math.max(peak,g.z);}assert(g.grounded);peaks.push(peak);}
  assert(peaks[1]>peaks[0]+40);
});
test('floating platform is reachable',()=>{const g=begin(),p=g.platforms.find(p=>p.floating);g.x=p.x+p.w/2;g.z=p.z-100;for(let i=0;i<150;i++)g.step(1/120,{jump:true});assert.equal(g.z,p.z+p.h);});
test('coin only counts once',()=>{const g=begin(),c=g.coins[0];g.x=c.x;g.z=c.z-27;g.step(1/120);g.step(1/120);assert.equal(g.score,1);});
test('stomp defeats enemy without damage',()=>{const g=begin(),e=g.enemies[0];g.x=e.x;g.z=e.z+35;g.vz=-300;g.grounded=false;for(let i=0;i<4;i++)g.step(1/120);assert(!e.alive);assert(g.vz>0);assert.equal(g.health,3);});
test('checkpoint respawn and invulnerability',()=>{const g=begin();g.x=8500;g.step(1/120);assert.equal(g.checkpoint,1);g.z=-400;g.step(1/120);assert.equal(g.x,8540);assert.equal(g.health,2);g.damage();assert.equal(g.health,2);});
test('timeout and win are terminal',()=>{let g=begin();g.time=.001;g.step(1/120);assert.equal(g.state,'timeout');g=begin();g.x=FINISH;g.step(1/120);assert.equal(g.state,'won');const t=g.time;g.step(1);assert.equal(g.time,t);});
test('complete route can be cleared within five minutes',()=>{
 const g=begin();
 for(let frame=0;frame<36000&&g.state==='playing';frame++){
   let jump=false;
   if(g.grounded){
     for(const p of g.platforms){if(p.floating)continue;const edge=p.x+p.w;
       if(p.x<=g.x&&g.x<edge&&edge-g.x<84){const next=g.platforms.find(q=>!q.floating&&q.x>=edge-.1);if(next&&(next.x>edge+1||next.z+next.h>g.z+5))jump=true;}}
     for(const s of g.spikes)if(s.x-g.x>0&&s.x-g.x<90&&Math.abs(g.z-s.z)<10)jump=true;
     for(const e of g.enemies)if(e.alive&&e.x-g.x>0&&e.x-g.x<105&&Math.abs(g.z-e.z)<10)jump=true;
   }
   g.step(1/120,{move:1,jump:jump||(!g.grounded&&g.vz>0),sprint:true});
 }
 assert.equal(g.state,'won');assert.equal(g.checkpoint,4);assert(g.elapsed<300);console.log(`Route cleared in ${g.elapsed.toFixed(2)}s, ${g.score} coins, ${g.deaths} respawns`);
});
console.log(`${tests} STARTRAIL checks passed`);
