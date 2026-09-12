import test from 'node:test';
import assert from 'node:assert/strict';
import {deck,removePairs,newGame,draw,sourcePlayer} from '../babanuki-engine.js';
function seeded(seed){return()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};}
test('53 unique cards; pairs match ranks and preserve joker',()=>{
  assert.equal(new Set(deck().map(c=>c.id)).size,53);
  const result=removePairs([deck()[0],deck()[13],deck()[26],deck()[39],deck()[52]]);
  assert.equal(result.removed.length,4);assert.deepEqual(result.hand,[deck()[52]]);
});
test('1000 complete games preserve all cards and finish with only the joker',()=>{
  for(let seed=1;seed<=1000;seed++){
    const random=seeded(seed),state=newGame(random);
    while(!state.over){
      assert.ok(state.hands[state.turn].length>0);
      const from=sourcePlayer(state);assert.notEqual(from,state.turn);
      draw(state,Math.floor(random()*state.hands[from].length),random);
      const all=[...state.hands.flat(),...state.discarded];
      assert.equal(all.length,53);assert.equal(new Set(all.map(c=>c.id)).size,53);
      for(const hand of state.hands)assert.equal(new Set(hand.map(c=>c.rank)).size,hand.length);
      assert.ok(state.moves<10000,`did not finish seed ${seed}`);
    }
    assert.equal(state.discarded.length,52);assert.equal(state.hands[state.loser][0].rank,0);
    assert.equal(new Set([...state.ranking,state.loser]).size,4);
    assert.throws(()=>draw(state,0));
  }
});
test('skip empty seats and rank donor before drawer when both go out',()=>{
  const state={hands:[[deck()[0]],[deck()[13]],[],[deck()[52]]],discarded:[],ranking:[2],turn:0,over:false,moves:0};
  draw(state,0);assert.deepEqual(state.ranking,[2,1,0]);assert.equal(state.loser,3);assert.equal(state.over,true);
  const s={hands:[[deck()[0]],[],[deck()[1]],[deck()[52]]],turn:0,over:false};
  assert.equal(sourcePlayer(s),2);
});
test('invalid draws do not change state',()=>{
  const state=newGame(seeded(99));const before=JSON.stringify(state);
  for(const i of [-1,99,NaN,0.5])assert.throws(()=>draw(state,i));
  assert.equal(JSON.stringify(state),before);
});
