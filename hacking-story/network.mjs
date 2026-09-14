// Reuse the site's existing two-slot rooms. No new database or real target systems.
const PROTOCOL='ghostline-story-1';
let dependencies;
function script(src){return new Promise((resolve,reject)=>{const el=document.createElement('script');el.src=src;el.onload=resolve;el.onerror=()=>reject(new Error('通信機能を読み込めませんでした。再接続してください。'));document.head.append(el);});}
async function load(){if(globalThis.SupabasePeer)return;if(!dependencies)dependencies=(async()=>{if(!globalThis.supabase)await script('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0/dist/umd/supabase.js');await script('../peer-supabase-shim.js');if(!globalThis.SupabasePeer)throw new Error('通信設定を読み込めませんでした。');})().catch(e=>{dependencies=null;throw e;});await dependencies;}
export class StoryRoom extends EventTarget{
 constructor(){super();this.peer=null;this.connection=null;this.code='';this.side=0;this.online=false;this.sequence=Date.now()*1000;this.received=0;this.lastSeen=0;this.active=false;this.ready=false;this.remoteReady=false;this.pending=new Map();}
 emit(type,detail){this.dispatchEvent(new CustomEvent(type,{detail}));}
 async connect(side,code){await this.close();await load();this.active=true;this.side=side;this.ready=side===0;this.remoteReady=false;this.code=code;this.received=0;const Peer=globalThis.SupabasePeer;
 return new Promise((resolve,reject)=>{let settled=false;const timer=setTimeout(()=>{if(!settled){settled=true;reject(new Error('接続に時間がかかっています。部屋のコードを確認して再接続してください。'));}},15000);
 const fail=e=>{const text=e.type==='unavailable-id'?'このコードの部屋は使用中です。新しい部屋を作成してください。':e.type==='peer-unavailable'?'部屋が見つからないか、満員です。ホストが待機中か確認してください。':'通信が切れました。部屋のコードを使って再接続できます。';this.emit('error',text);if(!settled){settled=true;clearTimeout(timer);reject(new Error(text));}};
 this.peer=side===0?new Peer('mg20-'+code.toLowerCase()):new Peer();this.peer.on('error',fail);this.peer.on('connection',c=>this.attach(c));this.peer.on('open',()=>{if(side===1){const c=this.peer.connect('mg20-'+code.toLowerCase());this.attach(c);c.on('open',()=>{if(!settled){settled=true;clearTimeout(timer);resolve();}});}else if(!settled){settled=true;clearTimeout(timer);resolve();}});
 this.tick=setInterval(()=>{if(!this.active)return;if(this.connection?.open){this.send({type:'heartbeat'});for(const p of this.pending.values())if(Date.now()-p.sent>1400){p.sent=Date.now();this.send(p.message);}if(this.lastSeen&&Date.now()-this.lastSeen>15000&&this.online){this.online=false;this.emit('status',false);}}},2000);
 });}
 attach(c){this.connection=c;c.on('open',()=>{this.lastSeen=Date.now();this.send({type:'hello'});});c.on('data',m=>{if(!m||m.protocol!==PROTOCOL||!Number.isSafeInteger(m.seq)||m.seq<=this.received)return;this.received=m.seq;this.lastSeen=Date.now();if(!this.online){this.online=true;this.emit('status',true);}if(m.type==='heartbeat')return;if(m.type==='hello'){this.send({type:'hello-ack'});this.emit('hello');return;}if(m.type==='hello-ack'){this.emit('hello');return;}if(m.type==='ack'){this.pending.delete(m.id);return;}this.emit('message',m);});c.on('close',()=>{this.online=false;this.emit('status',false);});c.on('error',()=>{this.online=false;this.emit('status',false);});}
 send(body){if(!this.connection?.open)return;this.connection.send({...body,protocol:PROTOCOL,seq:++this.sequence});}
 command(body){const message={...body,type:'command',id:crypto.randomUUID()};this.pending.set(message.id,{message,sent:Date.now()});this.send(message);}
 acknowledge(id){this.send({type:'ack',id});}
 async close(){this.active=false;clearInterval(this.tick);this.pending.clear();this.connection?.close();if(this.peer)await this.peer.destroy();this.peer=null;this.connection=null;this.online=false;}
}
export function roomCode(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return Array.from(crypto.getRandomValues(new Uint8Array(6)),n=>chars[n%chars.length]).join('');}
