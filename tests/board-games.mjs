import assert from 'node:assert/strict';
import * as E from '../board-games/engines.mjs';
import * as R from '../board-games/royal.mjs';
import {parseSfen,makeSfen} from '../board-games/vendor/rules.mjs';
import '../gomoku-engine.js';
let s=E.createOthello();assert.deepEqual(E.othelloMoves(s),[19,26,37,44]);assert.equal(E.othelloMove(s,0),false);assert.equal(E.othelloMove(s,19),true);assert.equal(s.board.filter(x=>x===1).length,4);assert.equal(s.turn,2);
let turns=0;while(s.winner===null&&turns++<65)assert.ok(E.othelloMove(s,E.othelloAI(s)));assert.notEqual(s.winner,null);assert.equal(E.othelloMove(s,0),false);
// Go: capture, self-capture, positional superko, scoring and agreements.
s=E.createGo();s.board[10]=2;[1,9,11].forEach(i=>s.board[i]=1);assert.ok(E.goMove(s,19));assert.equal(s.board[10],0);assert.equal(s.captures[0],1);
s=E.createGo();[1,9,11,19].forEach(i=>s.board[i]=2);assert.equal(E.goMove(s,10),false);
s=E.createGo();const b=s.board.slice();b[40]=1;s.history.push(b.join(''));assert.equal(E.goMove(s,40),false);
s=E.createGo();E.goMove(s,40);E.goPass(s);E.goPass(s);assert.equal(s.phase,'score');assert.equal(E.goMove(s,20),false);E.goAccept(s,1);assert.equal(s.winner,null);E.goRemove(s,40);assert.deepEqual(s.scoreAccepted,[]);E.goResume(s);assert.equal(s.board[40],1);E.goPass(s);E.goPass(s);E.goAccept(s,1);E.goAccept(s,2);assert.notEqual(s.winner,null);assert.deepEqual(E.goScore(Array(81).fill(0)),[0,7.5]);
// Chess starts with 20 moves; reply tree is 400. Castling, en-passant, promotion and mate.
s=R.createChess();assert.equal(R.chessMoves(s).length,20);let nodes=0;for(const m of R.chessMoves(s)){s.pos.move(m);nodes+=s.pos.moves().length;s.pos.undo();}assert.equal(nodes,400);
for(const m of ['f3','e5','g4','Qh4#'])assert.ok(R.chessMove(s,m));assert.equal(s.winner,2);assert.equal(R.chessMove(s,'e4'),false);
s=R.createChess();s.pos.load('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');assert.ok(R.chessMoves(s).some(m=>m.flags.includes('k')));assert.ok(R.chessMove(s,{from:'e1',to:'g1'}));assert.equal(s.pos.get('f1').type,'r');
s=R.createChess();for(const m of ['e4','a6','e5','d5'])R.chessMove(s,m);assert.ok(R.chessMove(s,{from:'e5',to:'d6'}));assert.equal(s.pos.get('d5'),undefined);
s=R.createChess();s.pos.load('7k/P7/8/8/8/8/8/7K w - - 0 1');assert.equal(R.chessMoves(s,8).filter(m=>m.to==='a8').length,4);
// Shogi: exact initial legal tree, drops, forced promotions, CPU is non-mutating.
s=R.createShogi();assert.equal(R.shogiMoves(s).length,30);nodes=0;for(const m of R.shogiMoves(s)){const p=s.pos.clone();p.play(m);nodes+=R.shogiMoves({pos:p,winner:null}).length;}assert.equal(nodes,900);
assert.equal(R.shogiMove(s,{from:R.shogiSquare(76),to:R.shogiSquare(4)}),false);
const before=makeSfen(s.pos);assert.ok(R.shogiAI(s));assert.equal(makeSfen(s.pos),before);
s=R.createShogi();s.pos=parseSfen('standard','4k4/9/9/9/9/9/PPPPPPPPP/9/4K4 b P 1').unwrap();assert.equal(R.shogiMoves(s,'pawn').length,0,'Nifu disallows every pawn file');
s=R.createShogi();s.pos=parseSfen('standard','8k/P8/9/9/9/9/9/9/4K4 b - 1').unwrap();const promotion=R.shogiMoves(s,9);assert.ok(promotion.length);assert.ok(promotion.every(m=>m.promotion));
// Property: no cash duplication, auctions, houses, mortgages, bankruptcy and round cap.
s=E.createProperty();assert.ok(E.propertyRoll(s,[1,2]));assert.equal(s.phase,'buy');assert.ok(E.propertyBuy(s));assert.equal(s.players[0].cash,1380);assert.equal(s.owners[3],1);assert.equal(E.propertyBuy(s),false);
E.propertyEnd(s);E.propertyRoll(s,[1,2]);assert.equal(s.players[1].cash,1484);assert.equal(s.players[0].cash,1396);
s=E.createProperty();s.owners[1]=s.owners[3]=1;assert.equal(E.rent(s,1),24);assert.ok(E.propertyManage(s,1,'build'));assert.equal(E.rent(s,1),60);assert.equal(E.propertyManage(s,1,'build'),false);assert.equal(E.propertyManage(s,3,'mortgage'),false);assert.ok(E.propertyManage(s,1,'sell'));assert.ok(E.propertyManage(s,1,'mortgage'));assert.equal(E.rent(s,1),0);assert.ok(E.propertyManage(s,1,'redeem'));
s=E.createProperty();E.propertyRoll(s,[1,2]);E.propertyAuction(s);E.propertyBid(s,true);E.propertyBid(s,false);assert.equal(s.owners[3],2);assert.equal(s.players[1].cash,1490);assert.equal(s.phase,'end');
s=E.createProperty();E.propertyRoll(s,[1,2]);E.propertyAuction(s);E.propertyBid(s,false);E.propertyBid(s,true);assert.equal(s.phase,'end');assert.equal(s.owners[3],1);assert.equal(s.players[0].cash,1490);
s=E.createProperty();s.players[0].cash=5;E.propertyRoll(s,[1,3]);assert.equal(s.phase,'debt');assert.equal(E.propertyEnd(s),false);E.propertyBankrupt(s);assert.equal(s.winner,2);
s=E.createProperty();s.actions=39;s.phase='end';E.propertyEnd(s);assert.equal(s.winner,'draw');
// Life: salaries on passing, borrowing, insurance, choice, score and completed-player skips.
s=E.createLife();assert.ok(E.lifeCareer(s,2));assert.equal(s.players[0].cash,400);E.lifeRoll(s,6,0);assert.equal(s.players[0].cash,890);E.lifeEnd(s);assert.equal(s.phase,'career');E.lifeCareer(s,0);s.players[1].pos=11;s.players[1].cash=0;E.lifeRoll(s,1,2);assert.equal(s.players[1].debt,330);assert.equal(s.players[1].cash,50);
s=E.createLife();E.lifeCareer(s,0);E.lifeInsure(s);s.players[0].pos=11;const cash=s.players[0].cash;E.lifeRoll(s,1,2);assert.equal(s.players[0].cash,cash);
s=E.createLife();E.lifeCareer(s,0);s.players[0].pos=35;E.lifeRoll(s,1);E.lifeEnd(s);E.lifeCareer(s,1);s.players[1].pos=35;E.lifeRoll(s,1);assert.notEqual(s.winner,null);
console.log('Board games: all rule and end-state checks passed.');
