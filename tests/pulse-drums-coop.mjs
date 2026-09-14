import assert from 'node:assert/strict';
import {TRACKS,makeChart,localChart,WEIGHTS} from '../pulse-drums/music.mjs';
import {cooperativeChart,createPlayerStats,recordPlayer,playerAccuracy,synchronizedPair} from '../pulse-drums/coop.mjs';

let charts=0,pairs=0;
function verify(source){
  const before=JSON.stringify(source),notes=cooperativeChart(source),players=createPlayerStats(notes);
  assert.equal(JSON.stringify(source),before,'Keep the solo chart unchanged');
  assert.equal(notes.length,source.length,'Every drum attack is assigned exactly once');
  assert.equal(new Set(notes.map(n=>n.sourceIndex)).size,source.length);
  assert.ok(Math.abs(players[0].total-players[1].total)<=1,'Balanced roles even on BASIC');
  const keys=new Set(),groups=new Map(),last=Array(6).fill(-10);
  for(const n of notes){
    assert.equal(n.t,source[n.sourceIndex].t);assert.equal(n.sourceLane,source[n.sourceIndex].lane);
    assert.equal(Math.floor(n.lane/3),n.player,'Dedicated three-lane sides');
    const key=`${n.t.toFixed(5)}:${n.lane}`;assert.ok(!keys.has(key));keys.add(key);
    assert.ok(n.t-last[n.lane]>.06,'No impossible rapid duplicate on a condensed lane');last[n.lane]=n.t;
    if(n.pair!==null){if(!groups.has(n.pair))groups.set(n.pair,[]);groups.get(n.pair).push(n);}
  }
  for(const group of groups.values()){assert.equal(group.length,2);assert.notEqual(group[0].player,group[1].player);pairs++;}
  for(const n of notes)recordPlayer(players[n.player],'perfect',WEIGHTS.perfect);
  assert.equal(playerAccuracy(players[0],true),100);assert.equal(playerAccuracy(players[1],true),100);
  const p2=structuredClone(players[1]);recordPlayer(players[0],'empty',0);assert.deepEqual(players[1],p2,'An error only resets that player’s personal combo');
  assert.ok(playerAccuracy(players[0],true)<100);assert.equal(players[0].combo,0);charts++;
}
for(const track of TRACKS.filter(t=>!t.local))for(let d=0;d<3;d++)verify(makeChart(track,d));
for(let d=0;d<3;d++)verify(localChart({duration:30,peaks:Array.from({length:80},(_,i)=>({t:.2+i*.3,strength:i%3===0?.9:.4,brightness:i%4===0?1.4:.3}))},d));
assert.ok(synchronizedPair({player:0,status:'perfect',delta:-.02},{player:1,status:'great',delta:.04}));
assert.equal(synchronizedPair({player:0,status:'great',delta:-.09},{player:1,status:'great',delta:.09}),false);
assert.equal(synchronizedPair({player:0,status:'perfect',delta:0},{player:1,status:'miss',delta:0}),false);
assert.equal(synchronizedPair({player:0,status:'perfect',delta:0},{player:0,status:'perfect',delta:0}),false);
console.log(JSON.stringify({charts,pairs,balancedPlayers:true,originalTimingAndSoundsPreserved:true,independentStats:true}));
