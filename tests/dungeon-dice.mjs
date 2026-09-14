import assert from 'node:assert/strict';
import * as E from '../dungeon-dice/engine.mjs';
import {CARDS,BY_ID,ABILITIES} from '../dungeon-dice/catalog.mjs';
assert.equal(CARDS.filter(c=>c.edition==='physical').length,139);
assert.equal(CARDS.filter(c=>c.edition==='gba').length,124);
assert.equal(new Set(CARDS.map(c=>c.id)).size,263);
assert.equal(E.NETS.length,11);
for(const c of CARDS){assert(ABILITIES[c.skill],c.en);assert.equal(E.diceFaces(c).length,6);assert.equal(E.diceFaces(c).filter(x=>x==='summon').length,5-c.level);}
const s=E.newGame({seed:123,mode:'local'}),fresh=JSON.stringify(s);
assert(E.rollDice(s,[0,0,1]));assert.equal(JSON.stringify(s),fresh,'invalid rolls are atomic');
let summonable;
for(let seed=1;seed<50;seed++){const x=E.newGame({seed});E.rollDice(x,E.chooseDice(x));if(x.phase==='summon'){summonable=x;break;}}
assert(summonable);const pos=E.bestPlacement(summonable,summonable.candidates[0]);assert(pos);
assert.equal(E.summon(summonable,summonable.candidates[0],pos.netIndex,pos.r,pos.flip,pos.x,pos.y,pos.spawnIndex),null);
assert.equal(summonable.board.filter(Boolean).length,8);assert.equal(summonable.units.length,1);
assert(!E.canPlace(summonable,E.transformNet(E.NETS[pos.netIndex],pos.r,pos.flip),pos.x,pos.y));
// Every roster entry can be summoned; each of the 39 implemented ability families has a legal execution.
for(const c of CARDS){const g=E.newGame({deck:[c.id,...E.defaultDeck().filter(id=>id!==c.id)].slice(0,15),mode:'local'});g.phase='summon';g.candidates=[0];const p=E.bestPlacement(g,0);assert(p,c.en);assert.equal(E.summon(g,0,p.netIndex,p.r,p.flip,p.x,p.y,p.spawnIndex),null,c.en);assert.equal(g.players[0].deck[0].used,true);assert.equal((c.tribe==='item'?g.items:g.units)[0].id,c.id);}
function combat(skill='strike'){const g=E.newGame({mode:'local'});g.phase='action';g.board=Array(19*13).fill(null).map(()=>({owner:0}));g.players.forEach((p,i)=>g.board[p.y*19+p.x]={owner:i,home:true});const c=CARDS.find(c=>c.skill===skill&&c.tribe!=='item'),d=CARDS.find(c=>c.en==='Blue-Eyes White Dragon');g.units=[{uid:1,id:c.id,owner:0,x:5,y:6,hp:Math.max(c.hp,10),maxHp:Math.max(c.hp,10),attacks:0,skillUsed:false,buff:0,permanent:0,guard:0,stunned:0,poison:0},{uid:2,id:d.id,owner:1,x:6,y:6,hp:d.hp,maxHp:d.hp,attacks:0,skillUsed:false,buff:0,permanent:0,guard:0,stunned:0,poison:0}];for(const p of g.players)p.bank={move:50,attack:50,defend:50,magic:50,trap:50};return g;}
for(const [key,ability]of Object.entries(ABILITIES)){if(['passive','item'].includes(ability[3]))continue;const g=combat(key),u=g.units[0];if(ability[3]==='ally')u.hp=1;const ts=E.skillTargets(g,u);assert(ts.length,`target ${key}`);assert.equal(E.useSkill(g,u.uid,ts[0]),null,key);assert.equal(u.skillUsed,true);assert.equal(E.skillTargets(g,u).length,0);}
const m=combat(),u=m.units[0];assert(!E.reachable(m,u).has('6,6'));assert(E.moveUnit(m,1,6,6));const bank=m.players[0].bank.move;assert.equal(E.moveUnit(m,1,5,5),null);assert.equal(m.players[0].bank.move,bank-1);
const g=combat();assert.equal(E.attack(g,1,{uid:2}),null);assert.equal(g.phase,'defense');assert.equal(E.resolveDefense(g,'trap'),null);assert.equal(g.players[1].bank.trap,48);assert.equal(g.units.find(u=>u.uid===2).hp,50);
const v=combat();v.units[0].x=17;v.units[0].y=6;v.players[1].hp=1;assert.equal(E.attack(v,1,{lord:1}),null);assert.equal(v.winner,0);
const saved=JSON.parse(JSON.stringify(summonable));assert.deepEqual(E.reachable(saved,saved.units[0]),E.reachable(summonable,summonable.units[0]));
const simulated=[];for(const seed of [12,64,192]){const t=E.newGame({seed,difficulty:'hard'});let steps=0;while(t.winner===null&&steps++<2200){E.aiStep(t);assert(t.units.every(u=>E.inside(u.x,u.y)&&E.at(t,u.x,u.y)&&u.hp>0));assert.equal(new Set(t.units.map(u=>`${u.x},${u.y}`)).size,t.units.length);assert(t.players.every(p=>Object.values(p.bank).every(v=>v>=0&&v<=99)));}assert(t.winner!==null,'AI must finish');simulated.push({seed,winner:t.winner,turns:t.round,steps});}
console.log(JSON.stringify({catalog:263,cubeNets:11,abilityFamilies:Object.keys(ABILITIES).length,simulated},null,2));
