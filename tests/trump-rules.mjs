import assert from 'node:assert/strict';
import {newMemory,flipMemory,resolveMemory,memoryChoice,newSpeed,adjacent,speedMoves,playSpeed,dealSpeed,validState} from '../trump/rules.mjs';
let seed=314159;
const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
for(let round=0;round<80;round++){
 const s=newMemory(random);assert(validState(s,'memory'));
 assert.equal(flipMemory(s,0,1),false,'Only the active player may flip');
 for(let i=0;i<400&&!s.over;i++){
   if(s.open.length===2)resolveMemory(s);else flipMemory(s,memoryChoice(s,random),s.turn);
   assert(validState(s,'memory'));
 }
 assert(s.over,'A full Memory match must finish');assert.equal(s.scores[0]+s.scores[1],12);
 assert.equal(flipMemory(s,0,0),false);
 assert(validState(JSON.parse(JSON.stringify(s)),'memory'),'Saved Memory match must round-trip');
}
const a=newMemory(random),b=newMemory(random);
assert.equal(memoryChoice(a,()=>.3),memoryChoice(b,()=>.3),'CPU cannot read unseen cards');
assert(!validState({...a,cards:Array(24).fill(0)},'memory'));
assert(adjacent(0,12),'A and K must connect');assert(adjacent(12,0));assert(!adjacent(0,0));assert(!adjacent(0,6));
let totalMoves=0;
for(let round=0;round<80;round++){
 const s=newSpeed(random);assert(validState(s,'speed'));
 for(let i=0;i<10000&&!s.over;i++){
   const first=random()<.5?0:1;
   let choices=speedMoves(s,first),player=first;
   if(!choices.length){player=1-first;choices=speedMoves(s,player)}
   if(choices.length){const move=choices[Math.floor(random()*choices.length)];assert(playSpeed(s,player,move.index,move.pile));}
   else assert(dealSpeed(s,random),'A stalled Speed table must be recoverable');
   assert(validState(s,'speed'),'Every move must preserve all 52 unique cards');
 }
 assert(s.over,'A full Speed match must finish');totalMoves+=s.moves;
 assert.equal(playSpeed(s,0,0,0),false);
 assert(validState(JSON.parse(JSON.stringify(s)),'speed'),'Saved Speed match must round-trip');
}
assert(!validState({version:1,game:'speed',over:false,moves:0,hands:[],stocks:[],piles:[]},'speed'));
console.log(JSON.stringify({passed:true,memoryMatches:80,speedMatches:80,speedMoves:totalMoves,cardConservation:true,hiddenCardFairness:true,saveRoundtrip:true}));
