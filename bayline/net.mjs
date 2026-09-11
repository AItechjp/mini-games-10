// Supabase Realtime protocol v1. No accounts, database rows, or privileged keys.
export const token=(bytes=16)=>Array.from(crypto.getRandomValues(new Uint8Array(bytes)),n=>n.toString(16).padStart(2,'0')).join('');
export function invitation(value){let s=String(value||'').trim();try{if(s.includes('://'))s=new URL(s).hash.slice(1);}catch{return null;}s=s.replace(/^#?join=/,'');const a=s.split('.');return a.length===2&&/^[a-f0-9]{32}$/.test(a[0])&&/^[a-f0-9]{16}$/.test(a[1])?{code:a[0],host:a[1]}:null;}
export class Room{
 constructor(config,onPacket,onStatus){this.config=config;this.onPacket=onPacket;this.onStatus=onStatus;this.role='solo';this.id=token(8);this.ws=null;this.joined=false;this.connected=false;this.guest=null;this.host=null;this.closed=true;this.timers=[];this.retries=0;this.ref=0;this.lastPeer=0;this.lastSeq=-1;this.seq=0;}
 create(){this.close();this.id=token(8);this.role='host';this.code=token();this.host=this.id;this.guest=null;this.start();return`${this.code}.${this.host}`;}
 join(invite){const info=invitation(invite);if(!info)throw new Error('招待リンクをそのまま貼り付けてください。');this.close();this.id=token(8);this.role='guest';this.code=info.code;this.host=info.host;this.start();}
 start(){if(!this.config?.enabled||!this.config?.url||!this.config?.publishableKey)throw new Error('協力プレイの接続設定を読み込めません。');this.closed=false;this.connected=false;this.joined=false;this.retries=0;this.lastPeer=Date.now();this.lastSeq=-1;this.seq=0;this.open();this.timers.push(setInterval(()=>this.monitor(),1000));}
 status(kind,text){this.onStatus?.({kind,text,role:this.role,connected:this.connected});}
 open(){if(this.closed)return;this.joined=false;this.status('connecting','オンライン接続中…');const url=this.config.url.replace(/^https:/,'wss:')+'/realtime/v1/websocket?apikey='+encodeURIComponent(this.config.publishableKey)+'&vsn=1.0.0';let socket;try{socket=new WebSocket(url);}catch{this.status('error','通信を開始できません。ソロはそのまま遊べます。');return;}this.ws=socket;this.joinRef=String(++this.ref);
 socket.onopen=()=>{if(this.ws!==socket)return;this.push('phx_join',{config:{broadcast:{self:false,ack:false},presence:{enabled:false},postgres_changes:[],private:false}},this.joinRef);};
 socket.onmessage=e=>{if(this.ws!==socket||typeof e.data!=='string'||e.data.length>50000)return;let m;try{m=JSON.parse(e.data);}catch{return;}if(m.event==='phx_reply'&&m.ref===this.joinRef){if(m.payload?.status==='ok'){this.joined=true;this.retries=0;this.status(this.role==='host'?'waiting':'joining',this.role==='host'?'招待リンクを友だちに送ってください':'ホストへ参加を申請しています…');if(this.role==='guest')this.send('hello',{});}else{this.status('error','接続が拒否されました。ソロは利用できます。');this.closed=true;socket.close();}}else if(m.event==='broadcast'&&m.payload?.event==='game')this.receive(m.payload.payload);else if(m.event==='phx_error'||m.event==='phx_close'){this.status('reconnecting','通信を再接続しています…');socket.close();}else if(m.event==='system'&&m.payload?.status==='error')this.status('error','オンライン通信で制限または接続エラーが発生しました。');};
 socket.onerror=()=>this.status('reconnecting','通信を確認しています…');
 socket.onclose=()=>{if(this.ws!==socket||this.closed)return;this.joined=false;if(this.retries>=3){this.connected=false;this.status('error','再接続できませんでした。接続を終了してやり直してください。');return;}const delay=[1000,3000,7000][this.retries++];this.status('reconnecting','接続が切れました。再接続中…');this.timers.push(setTimeout(()=>this.open(),delay));};
 this.timers.push(setTimeout(()=>{if(this.ws===socket&&!this.joined&&!this.closed){socket.close();}},12000));
 }
 push(event,payload,ref=String(++this.ref),topic=`realtime:bayline-v1:${this.code}`){if(this.ws?.readyState!==WebSocket.OPEN||this.ws.bufferedAmount>64000)return false;this.ws.send(JSON.stringify({topic,event,payload,ref,join_ref:topic==='phoenix'?null:this.joinRef}));return true;}
 send(type,data={}){if(!this.joined)return false;return this.push('broadcast',{type:'broadcast',event:'game',payload:{v:1,type,from:this.id,host:this.host,seq:++this.seq,...data}});}
 receive(p){if(!p||p.v!==1||p.host!==this.host||p.from===this.id||!/^[a-f0-9]{16}$/.test(p.from||'')||!Number.isSafeInteger(p.seq)||typeof p.type!=='string')return;
  if(this.role==='host'){
   if(p.type==='hello'){
    if(this.guest&&this.guest!==p.from&&Date.now()-this.lastPeer<15000){this.send('busy',{to:p.from});return;}
    const fresh=this.guest!==p.from;this.guest=p.from;this.connected=true;this.lastPeer=Date.now();if(fresh)this.onPacket?.({type:'admit',id:p.from});this.send('welcome',{to:p.from});this.status('connected','2人協力 / HOST');return;
   }
   if(p.from!==this.guest)return;this.lastPeer=Date.now();if(p.type==='bye'){this.guest=null;this.connected=false;this.onPacket?.({type:'left'});this.status('waiting','相棒が退出しました。招待リンクは再利用できます。');return;}
   if(p.type==='input')this.onPacket?.(p);
  }else{
   if(p.from!==this.host)return;
   if(p.type==='busy'&&p.to===this.id){this.status('full','この部屋は2人でプレイ中です。');this.close(false);return;}
   if(p.type==='welcome'&&p.to===this.id){this.connected=true;this.lastPeer=Date.now();this.lastSeq=-1;this.status('connected','2人協力 / PARTNER');return;}
   if(p.type==='bye'){this.connected=false;this.status('ended','ホストが部屋を閉じました。ソロへ戻れます。');return;}
   if(!this.connected)return;
   if(p.seq<=this.lastSeq)return;this.lastSeq=p.seq;this.lastPeer=Date.now();if(p.type==='state')this.onPacket?.(p);
  }
 }
 monitor(){if(this.closed)return;const now=Date.now();if(this.joined){if(!this.lastHeartbeat||now-this.lastHeartbeat>20000){this.lastHeartbeat=now;this.push('heartbeat',{},String(++this.ref),'phoenix');}if(this.role==='guest')this.send(this.connected?'ping':'hello');if(this.role==='host'&&this.guest)this.send('ping');}
  if(this.connected&&now-this.lastPeer>8000){this.status('stale','相手との通信が途切れています。ホスト側の画面も開いておいてください。');}
  if(this.role==='host'&&this.guest&&now-this.lastPeer>18000){this.guest=null;this.connected=false;this.onPacket?.({type:'left'});this.status('waiting','相棒の接続待ち。リンクから再参加できます。');}
  if(this.role==='guest'&&!this.connected&&now-this.lastPeer>25000)this.status('missing','ホストが見つかりません。ホストが部屋を開いているか確認してください。');
 }
 close(announce=true){if(announce&&this.joined)this.send('bye');this.closed=true;for(const t of this.timers){clearInterval(t);clearTimeout(t);}this.timers=[];const s=this.ws;this.ws=null;if(s){s.onclose=null;s.close();}this.joined=false;this.connected=false;this.guest=null;this.role='solo';}
}
