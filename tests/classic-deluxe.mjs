import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const gomoku=vm.createContext({});
for(const path of ['gomoku-engine.js','classic-deluxe.js'])vm.runInContext(fs.readFileSync(path,'utf8'),gomoku);
const {GomokuRules:G,ClassicDeluxe:D}=gomoku;
assert.equal(D.puzzles.length,36);assert.equal(new Set(D.puzzles.map(p=>p.board.join(''))).size,36);
for(const p of D.puzzles){for(let i=0;i<225;i++)assert.equal(G.lineAt(p.board,i).length,0,p.id+' starts unfinished');const solution=D.solution(p);assert.ok(solution>=0,p.id);const s=G.create();s.board=[...p.board];assert.ok(G.move(s,solution,0));assert.ok(D.solved(p,s,solution),p.id);}
for(const level of ['easy','normal','expert']){const s=G.create();for(let n=0;n<225&&s.winner===null;n++){const before=JSON.stringify(s),move=G.chooseMove(s,s.turn,level);assert.equal(JSON.stringify(s),before);assert.ok(G.move(s,move,s.turn));}assert.notEqual(s.winner,null);}
const source=fs.readFileSync('classic-advanced.js','utf8');const engine=source.slice(source.indexOf('const SUITS='),source.indexOf('// OLD MAID'));
let games=0;
for(const players of [2,3,4])for(const rules of ['simple','standard','full'])for(let seed=1;seed<=8;seed++){
 let x=seed*77+players;const math=Object.create(Math);math.random=()=>{x=(Math.imul(x,1664525)+1013904223)>>>0;return x/4294967296;};
 const scope=vm.createContext({Math:math,console});vm.runInContext(`let state;const mode='solo',deluxe={players:${players},rules:'${rules}'};const localIndex=()=>0;const commit=()=>{};${engine};state=initDaifugo();`,scope);
 let n=0;
 while(vm.runInContext('state.winner===null',scope)&&n++<1200){vm.runInContext('daiCpu()',scope);const facts=vm.runInContext('({hands:state.hands,finished:state.finished,turn:state.turn,winner:state.winner})',scope);const ids=facts.hands.flat().map(c=>c.id);assert.equal(new Set(ids).size,ids.length);if(facts.winner===null)assert.ok(!facts.finished.includes(facts.turn));}
 const facts=vm.runInContext('({winner:state.winner,finished:state.finished})',scope);assert.notEqual(facts.winner,null,`${players}/${rules}/${seed}`);assert.equal(facts.finished.length,players);assert.equal(new Set(facts.finished).size,players);games++;
}
console.log(`PASS 36 solvable Gomoku lessons, three AI levels, and ${games} complete Daifugo games across all table sizes and presets.`);
