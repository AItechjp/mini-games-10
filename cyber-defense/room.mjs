// Reuses AItech's existing two-seat room RPCs and opaque channel keys.
const protocol='aegis-duo-1';let sdk;
function loadSdk(){
 if(window.supabase)return Promise.resolve();
 sdk??=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.115.0/dist/umd/supabase.js';s.onload=resolve;s.onerror=()=>{sdk=null;s.remove();reject(new Error('通信機能を読み込めません。接続を確認して再試行してください。'));};document.head.append(s);});return sdk;
}
export function roomCode(){const a='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return Array.from(crypto.getRandomValues(new Uint8Array(6)),n=>a[n%a.length]).join('');}
export class DefenseRoom extends EventTarget{
 constructor(){super();this.token=crypto.randomUUID();this.code='';this.side=0;this.online=false;this.active=false;this.lastSeen=0;this.peer='';this.seq=0;this.seen=0;this.ready=false;this.remoteReady=false;this.pending=new Map();}
 emit(type,detail){this.dispatchEvent(new CustomEvent(type,{detail}));}
 async connect(side,code){
  await loadSdk();const cfg=window.SUPABASE_CONFIG;
  if(!cfg?.enabled||!cfg.url||!cfg.publishableKey)throw new Error('オンラインの設定を読み込めませんでした。ページを再読込みしてください。');
  this.client??=window.supabase.createClient(cfg.url,cfg.publishableKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  this.side=side;this.code=code;this.active=true;
  const {data,error}=await this.client.rpc(side===0?'create_game_room':'join_game_room',{p_code:code,p_player_token:this.token});
  if(error){this.active=false;const e=error.message||'';throw new Error(e.includes('TAKEN')?'このコードは使用中です。もう一度部屋を作ってください。':e.includes('FULL')?'部屋は満員です。':e.includes('NOT_FOUND')?'部屋が見つかりません。ホストのコードを確認してください。':'部屋に接続できませんでした。少し待って再試行してください。');}
  const key=(Array.isArray(data)?data[0]:data)?.channel_key;if(!key)throw new Error('部屋の接続情報を取得できませんでした。');
  this.channel=this.client.channel('room:'+key,{config:{broadcast:{self:false},presence:{key:this.token}}});
  this.channel.on('broadcast',{event:'aegis'},({payload:m})=>{
   if(!m||m.protocol!==protocol||m.sender===this.token||m.side===this.side||typeof m.sender!=='string'||!Number.isSafeInteger(m.seq))return;
   if(this.peer&&m.sender!==this.peer)return;this.peer=m.sender;
   if(m.seq<=this.seen)return;this.seen=m.seq;this.lastSeen=Date.now();
   if(!this.online){this.online=true;this.emit('status',true);}
   if(m.kind==='hello'){this.send('helloAck');this.emit('hello');return;}
   if(m.kind==='helloAck'){this.emit('hello');return;}
   if(m.kind==='heartbeat')return;
   if(m.kind==='ack'){this.pending.delete(m.commandId);return;}
   if(m.kind==='bye'){this.online=false;this.emit('status',false);return;}
   this.emit('message',m);
  });
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(new Error('接続に時間がかかっています。もう一度接続してください。')),12000);
   this.channel.subscribe(status=>{if(status==='SUBSCRIBED'){clearTimeout(timer);this.send('hello');resolve();}if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)){this.online=false;this.emit('status',false);if(status!=='CLOSED'){clearTimeout(timer);reject(new Error('通信が中断しました。再接続できます。'));}}});
  });
  this.tick=setInterval(()=>{if(!this.active)return;this.send(this.online?'heartbeat':'hello');for(const p of this.pending.values())if(Date.now()-p.at>1200){p.at=Date.now();this.send('command',p.body);}if(this.lastSeen&&Date.now()-this.lastSeen>9000&&this.online){this.online=false;this.emit('status',false);}},1500);
 }
 send(kind,body={}){if(!this.channel||!this.active)return;this.channel.send({type:'broadcast',event:'aegis',payload:{...body,kind,protocol,sender:this.token,side:this.side,seq:++this.seq}}).catch(()=>{});}
 command(body){const commandId=crypto.randomUUID();const payload={...body,commandId};this.pending.set(commandId,{body:payload,at:Date.now()});this.send('command',payload);}
 ack(commandId){this.send('ack',{commandId});}
 reconnect(){this.send('hello');}
 async close(){if(!this.active)return;this.send('bye');clearInterval(this.tick);this.active=false;this.online=false;this.pending.clear();if(this.channel)await this.client.removeChannel(this.channel);this.client?.realtime.disconnect();if(this.code)await this.client.rpc('leave_game_room',{p_code:this.code,p_player_token:this.token});}
}
