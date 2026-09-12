import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {Game,platforms,coins,goal}=createRequire(import.meta.url)('../quick-hop/rules.js');
assert.equal(coins.length,22);
for(const hz of [30,60,120,144]){
  const g=new Game();g.state='playing';let hold=0;
  for(let i=0;i<hz*50&&g.state!=='won';i++){
    if(g.grounded){const p=platforms.find(([x,z,w])=>x-14<g.x&&g.x<x+w+14&&Math.abs(g.z-z)<1);if(p&&p[0]+p[2]-g.x<75)hold=.75;}
    g.step(1/hz,1,hold>0);hold=Math.max(0,hold-1/hz);
  }
  assert.equal(g.state,'won',`course reachable at ${hz}Hz`);assert.equal(g.falls,0);assert.equal(g.checkpoint,3120);
  const time=g.time;g.step(1/60,1,true);assert.equal(g.time,time);
}
const g=new Game();g.state='playing';g.step(1/60);assert.equal(g.z,0);g.step(1/60,0,true);assert(g.z>0);
g.z=-360;g.step(1/60);assert.equal(g.x,100);assert.equal(g.falls,1);
g.x=3200;g.z=0;g.vz=0;g.step(1/60);assert.equal(g.checkpoint,3120);g.z=-360;g.step(1/60);assert.equal(g.x,3120);
g.x=coins[0][0];g.z=coins[0][1]-22;g.step(1/60);assert(g.taken.has(0));const n=g.taken.size;g.step(1/60);assert.equal(g.taken.size,n);
g.state='paused';const x=g.x;g.step(1/30,1,true);assert.equal(g.x,x);
console.log('Quick Hop: course completion at 30/60/120/144 Hz, jump, respawn, checkpoint, coin collection, pause, and win passed.');
