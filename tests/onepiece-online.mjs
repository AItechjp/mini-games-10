import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {BattleSession} from '../onepiece-battle/online.mjs';
import {chooseAI,legalActions} from '../onepiece-battle/engine.mjs';

const ctx={window:{}};
vm.runInNewContext(await readFile('supabase-config.js','utf8'),ctx);
const h=new BattleSession(ctx.window.SUPABASE_CONFIG),g=new BattleSession(ctx.window.SUPABASE_CONFIG);
let guest;
g.addEventListener('update',e=>guest=e.detail);
const until=async(check,label,ms=25000)=>{
 const end=Date.now()+ms;
 while(!check()){if(Date.now()>end)throw Error('Timeout: '+label);await new Promise(r=>setTimeout(r,75));}
};
try{
 const code=await h.create('ST01');await g.join(code,'ST02');
 await until(()=>h.peer&&g.peer&&h.decks[1]==='ST02','two player handshake');
 await new Promise(r=>setTimeout(r,350));assert(h.room.seq<50&&g.room.seq<50,'lobby must not echo messages in a loop');
 h.start();await until(()=>guest?.view,'initial snapshot');
 assert(guest.view.players[0].hand.every(c=>c.hidden),'host hand hidden');
 assert(guest.view.players.every(p=>p.deck.every(c=>c.hidden)&&p.life.every(c=>c.hidden)),'decks and life hidden');
 for(let i=0;i<24&&h.state.phase!=='ended';i++){
   const side=legalActions(h.state,0).length?0:1;
   const a=chooseAI(h.state,side);assert(a,'legal progress action');
   const rev=h.rev;
   if(side===0)h.action(a);else {await until(()=>guest?.rev===h.rev&&guest.actions.length,'guest move view');g.action(a);}
   await until(()=>h.rev>rev&&guest?.rev===h.rev,'replicated move');
 }
 const before=h.rev;
 h.receive({type:'move',body:{session:h.session,rev:before,action:{type:'cheat',label:'cheat'}}});
 assert.equal(h.rev,before,'illegal guest move rejected');
 h.receive({type:'move',body:{session:h.session,rev:before-1,action:legalActions(h.state,1)[0]}});
 assert.equal(h.rev,before,'stale move rejected');
 h.room.ws.close();await until(()=>!h.connected,'disconnect');
 await until(()=>h.connected&&h.peer&&g.connected&&g.peer,'automatic reconnect',30000);
 await until(()=>guest.rev===h.rev,'snapshot after reconnect');
 await g.leave();await until(()=>!h.peer,'departure');
 console.log('PASS: independent online sessions, private hand/deck views, 24 validated moves, stale/illegal move rejection, reconnect, departure.');
}finally{await g.leave();await h.leave();}
