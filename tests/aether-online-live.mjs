import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
const endpoint='https://dcvtubivtextycifngtk.supabase.co/functions/v1/aether-duel';
const tokens=[randomBytes(32).toString('hex'),randomBytes(32).toString('hex'),randomBytes(32).toString('hex')];
const counts=[3,3,3,3,3,3,3,2,2,2,2,1];
const deck=prefix=>[...counts.flatMap((n,i)=>Array(n).fill(prefix+(i+1))),...['n1','n2','n3','n4','n5'].flatMap(id=>[id,id])];
let room=null;
async function api(side,op,extra={}){const res=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json',apikey:'sb_publishable_IcEN-3GgzcLCHiyNLyRiCQ_RpkAhCGI',origin:'https://aether-card-duel.douga071132.chatgpt.site'},body:JSON.stringify({protocol:'aether-200-v3',token:tokens[side],op,...(room?{room}:{}),...extra}),signal:AbortSignal.timeout(20000)});return {status:res.status,data:await res.json()};}
try{
 const created=await api(0,'create',{cl:'forest',deck:deck('f')});assert.equal(created.status,200,JSON.stringify(created.data));room=created.data.room;assert.match(room,/^\d{6}$/);console.log('PASS live room creation');
 assert.equal((await api(2,'get')).status,403);console.log('PASS non-member access rejected');
 const joined=await api(1,'join',{cl:'rune',deck:deck('r')});assert.equal(joined.status,200,JSON.stringify(joined.data));assert.equal(joined.data.state.seed,undefined);assert.ok(joined.data.state.players[1].hand.every(c=>c.hidden&&!c.id));assert.ok(joined.data.state.players[0].deck.every(c=>c.hidden&&!c.id));console.log('PASS joining and hidden information');
 let host=(await api(0,'get')).data;const m0=await api(0,'mulligan',{ids:[],revision:host.revision,requestId:randomUUID()});assert.equal(m0.status,200,JSON.stringify(m0.data));let guest=(await api(1,'get')).data;const m1=await api(1,'mulligan',{ids:[],revision:guest.revision,requestId:randomUUID()});assert.equal(m1.status,200,JSON.stringify(m1.data));assert.equal(m1.data.state.phase,'battle');console.log('PASS two-player mulligan and game start');
 host=(await api(0,'get')).data;guest=(await api(1,'get')).data;assert.equal(host.state.active,1-guest.state.active);assert.equal(host.state.players[0].hp,guest.state.players[1].hp);const active=host.state.active;
 const invalid=await api(1-active,'action',{revision:host.revision,requestId:randomUUID(),action:{type:'end'}});assert.equal(invalid.status,422);
 const nonce=randomUUID();const end=await api(active,'action',{revision:host.revision,requestId:nonce,action:{type:'end'}});assert.equal(end.status,200,JSON.stringify(end.data));const replay=await api(active,'action',{revision:host.revision,requestId:nonce,action:{type:'end'}});assert.equal(replay.status,200);assert.equal(replay.data.revision,end.data.revision);console.log('PASS authoritative turn handling and idempotent retry');
 host=(await api(0,'get')).data;guest=(await api(1,'get')).data;assert.equal(host.revision,guest.revision);assert.equal(host.state.active,1-active);const result=await api(0,'concede',{revision:host.revision,requestId:randomUUID()});assert.equal(result.status,200);assert.equal(result.data.state.winner,1);guest=(await api(1,'get')).data;assert.equal(guest.state.winner,0);assert.equal(guest.status,'finished');console.log('PASS reconnect, synchronized result and clean match termination');
 console.log('AETHER ONLINE LIVE CHECKS PASSED');
}catch(e){if(room){try{const h=(await api(0,'get')).data;if(h.status==='waiting')await api(0,'leave');else if(h.status==='playing')await api(0,'concede',{revision:h.revision,requestId:randomUUID()});}catch{}}throw e;}
