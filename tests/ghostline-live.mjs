// Real two-client transport verification. This is not a browser visual test.
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {webcrypto} from 'node:crypto';
import {StoryRoom,roomCode} from '../hacking-story/network.mjs';
import {createMission,vote,execute,validState} from '../hacking-story/engine.mjs';
const configScope={window:{}};vm.runInNewContext(await readFile(new URL('../supabase-config.js',import.meta.url),'utf8'),configScope);
const res=await fetch('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0/dist/umd/supabase.js',{signal:AbortSignal.timeout(20000)});assert(res.ok);
const vendor={module:{exports:{}},exports:{},console,require:createRequire(import.meta.url),process,Buffer,setTimeout,clearTimeout,setInterval,clearInterval,fetch,WebSocket,Headers,Request,Response,URL,AbortController,TextEncoder,TextDecoder,crypto:webcrypto};vendor.exports=vendor.module.exports;vm.runInNewContext(await res.text(),vendor);
const sdk=vendor.supabase||vendor.module.exports,clients=[],supabase={createClient:(...args)=>{const c=sdk.createClient(...args);clients.push(c);return c;}},shim=await readFile(new URL('../peer-supabase-shim.js',import.meta.url),'utf8');
function peer(token){const values=new Map([['mg20-player-token',token]]),context={window:{SUPABASE_CONFIG:configScope.window.SUPABASE_CONFIG,supabase},setTimeout,clearTimeout,crypto:webcrypto,localStorage:{getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)}};vm.runInNewContext(shim,context);return context.window.SupabasePeer;}
const hostPeer=peer(webcrypto.randomUUID()),guestPeer=peer(webcrypto.randomUUID());const h=new StoryRoom(),g=new StoryRoom();
async function until(fn,name,timeout=20000){const start=Date.now();while(!fn()){if(Date.now()-start>timeout)throw new Error('Timed out: '+name);await new Promise(r=>setTimeout(r,50));}}
let state=createMission(100),received=null,guestReady=false,commands=0;
h.addEventListener('message',e=>{const m=e.detail;if(m.type==='ready')guestReady=true;if(m.type==='command'){h.acknowledge(m.id);if(m.run===state.run&&m.step===state.log.length){commands++;state=vote(state,1,m.value);h.send({type:'snapshot',state});}}});
g.addEventListener('message',e=>{if(e.detail.type==='snapshot'&&validState(e.detail.state))received=e.detail.state;});
const code=roomCode();try{globalThis.SupabasePeer=hostPeer;await h.connect(0,code);globalThis.SupabasePeer=guestPeer;await g.connect(1,code);await until(()=>h.online&&g.online,'both clients connected');console.log('Real room: two clients connected');g.send({type:'ready',ready:true});await until(()=>guestReady,'guest readiness');h.send({type:'snapshot',state});await until(()=>received?.run===state.run,'initial snapshot');
 // Concurrent choices operate on the same phase; the host's revision changes
 // before the analyst packet arrives, and that must not discard the support.
 const phase=state.log.length;state=vote(state,0,'public');g.command({kind:'support',value:'intel',run:state.run,node:state.node,step:phase,revision:0});await until(()=>commands>0&&state.votes[1]==='intel','concurrent support');await until(()=>g.pending.size===0,'command acknowledgement');state=execute(state);h.send({type:'snapshot',state});await until(()=>received?.phase==='feedback','shared action result');assert.equal(received.trace,state.trace);assert.equal(received.turns,state.turns);
 await g.close();await until(()=>!h.online,'guest disconnect');globalThis.SupabasePeer=guestPeer;await g.connect(1,code);await until(()=>h.online&&g.online,'guest rejoin');received=null;h.send({type:'snapshot',state});await until(()=>received?.revision===state.revision,'same mission restored');assert.equal(received.log.length,1);
 console.log(JSON.stringify({result:'PASS',transport:'real Supabase rooms and Realtime',checks:['two clients','ready','snapshot','concurrent disjoint choices','ack','shared outcome','disconnect','rejoin and state restore']}));
}finally{await g.close();await h.close();delete globalThis.SupabasePeer;for(const c of clients){await c.removeAllChannels();c.realtime.disconnect();}}
