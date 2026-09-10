import {GAME_BY_ID} from '../catalog.mjs';
export const PROTOCOL=1;
const ORIGINS=new Set(['https://aitechd.com','https://www.aitechd.com','https://aitechjp.github.io','https://aitechjp-mini-games-10.pages.dev']);
const hex=b=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
const hash=async s=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
const random=n=>crypto.getRandomValues(new Uint8Array(n));
const specFor=id=>id==='skybreak'?{minPlayers:2,maxPlayers:2}:GAME_BY_ID[id];
const publicRoom=(r,side,includeState=false)=>({protocol:PROTOCOL,room:r.code,game:r.game,side,topic:r.topic,status:r.status,revision:r.revision,members:r.members.map(({hash,...m})=>m),...(includeState&&side===0?{checkpoint:r.state}:{}),checkpointAt:r.checkpoint_at});
export function makeHandler(db){return async req=>{
 const origin=req.headers.get('origin');const headers={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Headers':'content-type, apikey, authorization','Access-Control-Allow-Methods':'POST, OPTIONS',...(ORIGINS.has(origin)?{'Access-Control-Allow-Origin':origin}:{})};
 const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(origin&&!ORIGINS.has(origin))return reply({error:'このサイトからは接続できません。'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method==='GET')return reply({protocol:PROTOCOL,status:'ready',games:Object.keys(GAME_BY_ID).length+1});
 if(req.method!=='POST')return reply({error:'操作が不正です。'},405);
 try{
  if(Number(req.headers.get('content-length')||0)>600000)return reply({error:'データが大きすぎます。'},413);
  const raw=await req.text();if(raw.length>600000)return reply({error:'データが大きすぎます。'},413);let b;try{b=JSON.parse(raw);}catch{return reply({error:'データが不正です。'},400);}
  if(b.protocol!==PROTOCOL)return reply({error:'ページを再読み込みしてください。'},426);
  if(!/^[a-f0-9]{64}$/.test(b.token||''))return reply({error:'接続情報が不正です。'},401);
  const identity=await hash(b.token),now=Date.now(),iso=new Date(now).toISOString();
  const ip=req.headers.get('cf-connecting-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]||'unknown';
  const bucket=await hash(['create','join'].includes(b.op)?'ip:'+ip:identity);
  const limit=b.op==='create'?12:b.op==='join'?30:100;
  if(!await db.rate(bucket+':'+b.op+':'+Math.floor(now/60000),limit,new Date(now+120000).toISOString()))return reply({error:'操作が続いています。少し待ってください。'},429);
  const member=async()=>{const k=b.publicKey;if(!k||k.kty!=='EC'||k.crv!=='P-256'||k.d||!/^[-_A-Za-z0-9]{43}$/.test(k.x)||!/^[-_A-Za-z0-9]{43}$/.test(k.y))return null;try{await crypto.subtle.importKey('jwk',k,{name:'ECDH',namedCurve:'P-256'},false,[]);}catch{return null;}return {id:hex(random(8)),hash:identity,name:String(b.name||'PLAYER').replace(/[\u0000-\u001f<>]/g,'').trim().slice(0,16)||'PLAYER',publicKey:{kty:k.kty,crv:k.crv,x:k.x,y:k.y},ready:false,seen:now};};
  if(b.op==='create'){
   if(!specFor(b.game))return reply({error:'ゲームが見つかりません。'},400);const m=await member();if(!m)return reply({error:'接続キーを作り直してください。'},400);m.ready=true;
   await db.cleanup(iso);const letters='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
   for(let attempt=0;attempt<5;attempt++){const code=Array.from(random(6),n=>letters[n%32]).join('');const row=await db.insert({code,game:b.game,host_hash:identity,topic:hex(random(24)),members:[m],state:null,status:'waiting',revision:0,expires_at:new Date(now+21600000).toISOString()});if(row)return reply(publicRoom(row,0));}return reply({error:'ルーム作成が混み合っています。'},503);
  }
  if(!/^[A-HJ-NP-Z2-9]{6}$/.test(b.room||''))return reply({error:'6文字のルームコードを入力してください。'},400);
  for(let retry=0;retry<5;retry++){
   const r=await db.get(b.room);if(!r||Date.parse(r.expires_at)<now||r.status==='closed')return reply({error:'ルームが終了したか、コードが違います。',code:'gone'},404);
   let side=r.members.findIndex(m=>m.hash===identity),patch=null;
   if(b.op==='join'&&side<0){if(r.status!=='waiting'||r.members.length>=specFor(r.game).maxPlayers)return reply({error:'満員か、ゲームが始まっています。'},409);const m=await member();if(!m)return reply({error:'接続キーが不正です。'},400);patch={members:[...r.members,m]};side=r.members.length;}
   else if(side<0)return reply({error:'このルームの参加者ではありません。'},403);
   else if(b.op==='get'||b.op==='resume'||b.op==='join'){if(now-r.members[side].seen>10000){const members=r.members.map(m=>({...m}));members[side].seen=now;patch={members};}else return reply(publicRoom(r,side,b.op==='resume'));}
   else if(b.op==='ready'){if(r.status!=='waiting')return reply({error:'すでに開始しています。'},409);const members=r.members.map(m=>({...m}));members[side].ready=!!b.ready;members[side].seen=now;patch={members};}
   else if(b.op==='start'){if(side!==0)return reply({error:'ホストが開始します。'},403);if(r.status!=='waiting')return reply({error:'すでに開始しています。'},409);const spec=specFor(r.game);if(r.members.length<spec.minPlayers||r.members.some(m=>!m.ready))return reply({error:'必要な人数が揃い、全員が準備OKになると開始できます。'},409);patch={status:'playing',state:null};}
   else if(b.op==='checkpoint'){if(side!==0||r.status!=='playing')return reply({error:'保存できません。'},403);if(!b.state||b.state.id!==r.game||JSON.stringify(b.state).length>500000)return reply({error:'ゲーム状態が不正です。'},400);patch={state:b.state,checkpoint_at:iso,status:b.state.phase==='over'?'finished':'playing'};}
   else if(b.op==='rematch'){if(side!==0||r.status!=='finished')return reply({error:'再戦できません。'},409);patch={status:'waiting',state:null,members:r.members.map((m,i)=>({...m,ready:i===0}))};}
   else if(b.op==='leave'){if(side===0)patch={status:'closed',expires_at:iso};else if(r.status==='waiting')patch={members:r.members.filter((_,i)=>i!==side)};else{const members=r.members.map(m=>({...m}));members[side].seen=0;patch={members};}}
   else return reply({error:'操作が不正です。'},400);
   const updated=await db.update(r.code,r.revision,{...patch,revision:r.revision+1});if(updated)return reply(publicRoom(updated,side,b.op==='resume'));
  }return reply({error:'同時操作を調整しています。もう一度お試しください。'},409);
 }catch(e){console.error('arcade room',e instanceof Error?e.message:'error');return reply({error:'対戦サーバーに接続できません。再接続してください。'},503);}
};}
