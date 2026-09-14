import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {CyberRoom} from '../cyber-quiz/network.mjs';
const context={window:{}};vm.runInNewContext(await readFile('supabase-config.js','utf8'),context);const cfg=context.window.SUPABASE_CONFIG;
const h=new CyberRoom(cfg),g=new CyberRoom(cfg),third=new CyberRoom(cfg);let hPeer=false,gPeer=false,received=null,input=null;
const until=async(test,label,ms=18000)=>{const limit=Date.now()+ms;while(!test()){if(Date.now()>limit)throw Error('Timeout: '+label);await new Promise(r=>setTimeout(r,100));}};
h.addEventListener('connection',e=>hPeer=e.detail.online&&e.detail.peer);g.addEventListener('connection',e=>gPeer=e.detail.online&&e.detail.peer);
g.addEventListener('message',e=>received=e.detail);h.addEventListener('message',e=>input=e.detail);
try{
 const code=await h.create();assert.match(code,/^[A-Z0-9]{6}$/);await g.join(code);await until(()=>hPeer&&gPeer,'mutual handshake');
 await assert.rejects(third.join(code),/満員/);
 h.broadcast('state',{test:'cyber-round',round:3});await until(()=>received?.type==='state','host state');assert.equal(received.body.round,3);
 g.broadcast('action',{session:'test',round:3,type:'answer',side:1,value:2});await until(()=>input?.type==='action','guest answer');assert.equal(input.body.value,2);
 const last=input;h.receive({protocol:'neon-sentinels-1',sender:g.token,side:1,seq:1,type:'action',body:{value:99}});assert.equal(input,last,'replayed packet ignored');
 h.ws.close();await until(()=>!h.ready,'disconnect');await until(()=>h.ready&&hPeer&&gPeer,'automatic reconnect',22000);
 received=null;h.broadcast('state',{round:4});await until(()=>received?.body?.round===4,'state after reconnect');
 await g.leave();await until(()=>!hPeer,'guest departure');
 console.log('Live online: two independent clients, full-room rejection, state replication, guest answers, replay rejection, reconnect and departure passed.');
}finally{await g.leave();await h.leave();await third.leave();}
