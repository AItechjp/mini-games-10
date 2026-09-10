import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createRequire} from 'node:module';
import {OnlineRoom} from '../arcade100/network.mjs';
import {createGame,action,view} from '../arcade100/engine.mjs';
const require=createRequire((process.env.ARCADE_DEPENDENCIES||'/tmp/arcade-ci')+'/package.json');
const {createClient}=require('@supabase/supabase-js');
const context={window:{}};vm.runInNewContext(fs.readFileSync('supabase-config.js','utf8'),context);const config={...context.window.SUPABASE_CONFIG,createClient};
const local=new Map();globalThis.sessionStorage={getItem:k=>local.get(k)||null,setItem:(k,v)=>local.set(k,v),removeItem:k=>local.delete(k)};
const host=await new OnlineRoom(config).init();local.clear();const guest=await new OnlineRoom(config).init();
const waitFor=(emitter,type,predicate,timeout=20000)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{emitter.removeEventListener(type,listener);reject(new Error('Timed out waiting for '+type));},timeout);function listener(e){if(predicate(e.detail)){clearTimeout(timer);emitter.removeEventListener(type,listener);resolve(e.detail);}}emitter.addEventListener(type,listener);});
try{
 const r=await host.create('g031','CI HOST');assert.equal(r.status,'waiting');await guest.join(r.room,'CI GUEST');await host.poll();assert.equal(host.room.members.length,2);await guest.setReady(true);await host.poll();await host.start();await guest.poll();
 const s=createGame('g031',host.room.members,93);assert(action(s,0,{type:'cell',i:9}));const received=waitFor(guest,'message',e=>e.body.type==='state');await host.send(guest.me.id,{type:'state',state:view(s,1)});const got=await received;assert.equal(got.side,0);assert.equal(got.body.state.board.cells[15],1);assert.equal(got.body.state.turn,1);
 const command=waitFor(host,'message',e=>e.body.type==='action');await guest.send(host.me.id,{type:'action',request:'live-valid-command',action:{type:'cell',i:10}});const act=await command;assert.equal(act.side,1);assert(action(s,act.side,act.body.action));
 await host.checkpoint(s);const restored=await host.api('resume');assert.equal(restored.checkpoint.ply,2);const guestResume=await guest.api('resume');assert(!guestResume.checkpoint);
 const before=host.seen.get(guest.me.id);await guest.channel.send({type:'broadcast',event:'packet',payload:{from:guest.me.id,to:host.me.id,seq:before+1000000,iv:'AAAAAAAAAAAAAAAA',data:'fake'}});await new Promise(r=>setTimeout(r,500));assert.equal(host.seen.get(guest.me.id),before,'tampered packet rejected');
 console.log('PASS: live two-player room, encrypted WebSocket relay in both directions, legal gameplay, checkpoint recovery and tamper rejection');
}finally{await guest.leave();await host.leave();}
