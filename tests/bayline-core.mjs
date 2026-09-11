import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import * as C from '../bayline/core.mjs';
const results=[];
const test=(name,fn)=>{try{fn();results.push({name,ok:true});}catch(e){results.push({name,ok:false,error:e.stack});}};
const step=(s,i={},n=1)=>{for(let j=0;j<n;j++)C.tick(s,[i,{}],1/60);};
test('136 deterministic buildings, 24 caches and 12 distinct chapters',()=>{assert.equal(C.BUILDINGS.length,136);assert.equal(C.CACHES.length,24);assert.equal(C.CHAPTERS.length,12);assert.equal(C.JOBS.length,6);assert.deepEqual(C.buildCity(),C.buildCity());for(const p of Object.values(C.POI))assert.equal(C.blocked(p.x,p.z,.55),false,JSON.stringify(p));});
test('invalid inputs and saves are bounded',()=>{const i=C.cleanInput({x:Infinity,y:100,yaw:NaN,seq:1e99,action:'delete'});assert.equal(i.x,0);assert.equal(i.y,1);assert.equal(i.action,'');const s=C.newGame({v:1,chapter:999,cash:Infinity,engine:999});assert.equal(s.chapter,12);assert.equal(s.engine,3);assert.equal(s.cash,1200);});
test('walking, walls and city bounds',()=>{const s=C.newGame();s.players[0].x=0;s.players[0].z=0;step(s,{y:1,yaw:0},120);assert.ok(s.players[0].z>8);assert.ok(!C.blocked(s.players[0].x,s.players[0].z));const b=C.BUILDINGS[0];assert.equal(C.blocked(b.x,b.z),true);assert.equal(C.blocked(700,0),true);});
test('driver, passenger and exit state stay consistent',()=>{const s=C.newGame();C.addPlayer(s);s.players[1].x=-313;s.players[1].z=431;C.tick(s,[{seq:1,action:'enter'},{seq:1,action:'enter'}],1/60);assert.equal(s.players[0].car,0);assert.equal(s.players[1].car,0);assert.equal(s.players[0].seat,0);assert.equal(s.players[1].seat,1);step(s,{seq:1,y:1},90);assert.ok(Math.abs(s.cars[0].speed)>5);assert.equal(s.players[1].x,s.cars[0].x);C.removeGuest(s);assert.equal(s.cars[0].passenger,-1);assert.equal(s.players.length,1);});
test('reload and garage upgrades work once per action sequence',()=>{const s=C.newGame();s.players[0].ammo=0;step(s,{seq:1,action:'reload'},100);assert.equal(s.players[0].ammo,30);step(s,{seq:2,action:'engine'},10);assert.equal(s.engine,1);assert.equal(s.cash,500);});
test('compact network state roundtrip and invalid-frame rejection',()=>{const s=C.newGame();C.addPlayer(s);const d=C.snapshot(s),r=C.readSnapshot(d);assert.ok(r);assert.equal(r.cars.length,25);assert.equal(r.players.length,2);assert.equal(r.chapter,0);assert.equal(C.readSnapshot({...d,players:[[0,Infinity,0]]}),null);assert.equal(C.readSnapshot(null),null);});
test('save restores current checkpoint without persisting online identity',()=>{const s=C.newGame();s.chapter=4;s.stage=2;s.active=true;s.caches=[1,4];s.cash=2345;const data=C.saveGame(s),r=C.newGame(data);assert.equal(r.chapter,4);assert.equal(r.stage,2);assert.equal(r.cash,2345);assert.equal(r.active,true);assert.deepEqual(r.caches,[1,4]);assert.equal(r.players.length,1);assert.ok(!JSON.stringify(data).includes('publishable'));});
test('both players can be revived or respawn without a broken vehicle seat',()=>{const s=C.newGame();C.addPlayer(s);s.players[1].x=s.players[0].x+1;s.players[1].z=s.players[0].z;s.players[1].hp=0;C.tick(s,[{interact:true},{}],.05);for(let i=0;i<70;i++)C.tick(s,[{interact:true},{}],.05);assert.ok(s.players[1].hp>0);for(const p of s.players)p.hp=0;for(let i=0;i<80;i++)C.tick(s,[{},{}],.05);assert.ok(s.players.every(p=>p.hp>0));});
test('all 12 campaign chapters complete through their actual stage handlers',()=>{
 const s=C.newGame();let guard=0;while(!s.complete&&guard++<200){if(!s.active)C.startMission(s);const q=C.currentStep(s),p=s.players[0],before=[s.chapter,s.stage].join(':');assert.ok(q);const t=C.target(s);p.x=t.x;p.z=t.z;p.hp=160;s.enemies=[];
  if(['drive','race'].includes(q.type)){p.car=0;p.seat=0;s.cars[0].driver=0;s.cars[0].x=t.x;s.cars[0].z=t.z;s.cars[0].speed=0;}else{p.car=-1;p.seat=-1;s.cars[0].driver=-1;}
  C.tick(s,[{interact:true},{}],.05);
  if(q.type==='race'){let n=0;while(C.currentStep(s)===q&&n++<20){const a=C.target(s);p.x=s.cars[0].x=a.x;p.z=s.cars[0].z=a.z;s.cars[0].speed=0;C.tick(s,[{},{}],.05);}}
  else if(q.type==='combat'){for(const e of s.enemies)e.hp=0;C.tick(s,[{},{}],.05);}
  else if(q.type==='defend'||q.type==='hack'||q.type==='interact'){s.started=true;s.progress=(q.duration||1)+.01;for(const e of s.enemies)e.hp=0;s.wave=999;C.tick(s,[{interact:true},{}],.05);}
  else if(q.type==='escape'){s.started=true;s.wanted=0;s.enemies=[];C.tick(s,[{},{}],.05);}
  assert.notEqual([s.chapter,s.stage].join(':'),before,`stuck on ${before}: ${q.type}`);
 }
 assert.equal(s.complete,true);assert.equal(s.chapter,12);assert.ok(s.cash>20000);
});
await mkdir('test-output/bayline',{recursive:true});await writeFile('test-output/bayline/core-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));if(results.some(r=>!r.ok))process.exitCode=1;
