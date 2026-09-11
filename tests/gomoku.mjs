import assert from 'node:assert/strict';
import '../gomoku-engine.js';
const G = globalThis.GomokuRules;

const fresh = G.create();
assert.equal(fresh.board.length, 225);
assert.equal(G.chooseMove(fresh), 112);
for (const index of [-1, 225, 1.5, NaN, '0', null]) assert.equal(G.move(fresh, index, 0), false);
assert.equal(G.move(fresh, 112, 1), false);
assert.equal(G.move(fresh, 112, 0), true);
assert.equal(G.move(fresh, 112, 1), false);
assert.equal(G.move(fresh, 113, 0), false);
assert.equal(fresh.turn, 1);
const snapshot = JSON.stringify(fresh);
assert.equal(fresh.board[G.chooseMove(fresh)], 0);
assert.equal(JSON.stringify(fresh), snapshot, 'CPU search must not change the match');

// Edge-to-edge checks cover horizontal, vertical, and both diagonal directions.
for (const line of [[0,1,2,3,4],[0,15,30,45,60],[0,16,32,48,64],[14,28,42,56,70],[220,221,222,223,224]]) {
  const s = G.create();
  for (const i of line.slice(0,4)) s.board[i] = 1;
  assert.equal(G.move(s, line[4], 0), true);
  assert.equal(s.winner, 0);
  assert.equal(s.winningLine.length, 5);
  assert.equal(G.move(s, 112, 1), false, 'No moves after the result');
}
const wrap = G.create();
[12,13,14,15,16].forEach(i => wrap.board[i] = 1);
assert.equal(G.lineAt(wrap.board, 14).length, 0, 'Rows must not wrap');
const overline = G.create();
[105,106,107,109,110].forEach(i => overline.board[i] = 1);
assert.equal(G.move(overline,108,0), true);
assert.equal(overline.winner,0, 'Freestyle allows six stones');

const defend = G.create();
[105,106,107,108].forEach(i => defend.board[i] = 1);
defend.turn = 1;
assert.equal(G.chooseMove(defend),109,'CPU must block the winning move');
const attack = structuredClone(defend);
[30,31,32,33].forEach(i => attack.board[i] = 2);
assert.equal(G.chooseMove(attack),34,'CPU must take a win before defending');

const draw = G.create();
draw.board = Array.from({length:225},(_,i) => (Math.floor(i/15)+Math.floor((i%15)/2))%2+1);
draw.board[224] = 0;
draw.turn = 1;
assert.equal(G.move(draw,224,1),true);
assert.equal(draw.winner,'draw');
assert.equal(G.chooseMove(draw),-1);

const match = G.create();
for (let turn=0; turn<225 && match.winner===null; turn++) {
  assert.equal(G.move(match,G.chooseMove(match),match.turn),true);
}
assert.notEqual(match.winner,null,'A complete CPU match must terminate');
console.log('Gomoku rules, invalid moves, CPU tactics and complete match: OK');
