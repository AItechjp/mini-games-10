import {database} from '@/db';
import {findTool} from './catalog';
import {canvasTextLayout} from './canvas-geometry';
export class ApiError extends Error{constructor(public status:number,message:string){super(message)}}
export const clean=(v:unknown,max=10000)=>typeof v==='string'?v.trim().slice(0,max):'';
export async function session(request:Request){const actor=request.headers.get('X-Commons-Verified-Actor');if(!actor||!/^[a-f0-9]{64}$/.test(actor))throw new ApiError(401,'サインインしてください。');return {actor,cookie:''}}
export function reply(data:unknown,status=200,cookie=''){const headers:Record<string,string>={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(status===429?{'Retry-After':'60'}:{})};if(cookie)headers['Set-Cookie']=cookie;return Response.json(data,{status,headers});}
export function failure(e:unknown){if(e instanceof ApiError)return reply({error:e.message},e.status);console.error('COMMONS API',e);return reply({error:'接続できませんでした。入力を残したまま、少し待って再試行してください。'},503);}
export async function body(request:Request){
  const origin=request.headers.get('origin');
  if(origin&&new URL(request.url).origin!==origin)throw new ApiError(403,'この操作はサイト内から行ってください。');
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new ApiError(415,'JSON形式で送信してください。');
  if(+(request.headers.get('content-length')??0)>150000)throw new ApiError(413,'データが大きすぎます。');
  const reader=request.body?.getReader();
  if(!reader)throw new ApiError(400,'入力を確認してください。');
  const chunks:Uint8Array[]=[];let bytes=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>150000){await reader.cancel();throw new ApiError(413,'データが大きすぎます。')}chunks.push(value)}}finally{reader.releaseLock()}
  const all=new Uint8Array(bytes);let offset=0;for(const part of chunks){all.set(part,offset);offset+=part.byteLength}
  try{const parsed=JSON.parse(new TextDecoder().decode(all));if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw 0;return parsed}catch{throw new ApiError(400,'入力を確認してください。');}
}
export async function limit(actor:string,type='write',max=180){const db=database();const key=`${actor}:${type}`;const window=Math.floor(Date.now()/60000);const r=await db.prepare('INSERT INTO rate_limits (key, window, count) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET count = CASE WHEN rate_limits.window = excluded.window THEN rate_limits.count + 1 ELSE 1 END, window = excluded.window RETURNING count').bind(key,window).first<{count:number}>();if((r?.count??0)>max)throw new ApiError(429,'操作が続いています。1分ほど待ってから再試行してください。');}
export async function room(id:string){if(!/^[a-f0-9]{32}$/.test(id))throw new ApiError(404,'ルームが見つかりません。リンクを確認してください。');const r=await database().prepare('SELECT * FROM rooms WHERE id = ?').bind(id).first<any>();if(!r)throw new ApiError(404,'ルームが見つかりません。リンクを確認してください。');return r;}
export async function member(id:string,actor:string){const m=await database().prepare('SELECT * FROM members WHERE room = ? AND actor = ?').bind(id,actor).first<any>();if(!m)throw new ApiError(403,'表示名を入力してルームに参加してください。');return m;}
export function initialItems(toolId:string){const t=findTool(toolId)!;if(t.engine==='poll')return t.labels.map((label,i)=>({id:`option-${i}`,kind:'option',body:{text:label}}));if(t.engine==='timer')return [{id:'timer',kind:'timer',body:{duration:(t.minutes??25)*60,remaining:(t.minutes??25)*60,running:false,endsAt:0,label:t.labels[0]??'集中'}}];return [];}
const isCanvasKind=(kind:string)=>['stroke','sticky','shape','text'].includes(kind);
const allowed:Record<string,string[]>={chat:['message'],canvas:['stroke','sticky','shape','text'],notes:['note'],tasks:['task'],agenda:['agenda','timer'],poll:['option'],schedule:['slot'],retro:['card'],links:['link'],directory:['record'],timer:['timer'],queue:['hand']};
export function validateItem(tool:string,kind:string,b:any){const t=findTool(tool);if(!t||!b||typeof b!=='object'||Array.isArray(b)||!(allowed[t.engine].includes(kind)||kind==='comment'))throw new ApiError(400,'この種類のデータは保存できません。');if(JSON.stringify(b).length>90000)throw new ApiError(413,'1件の内容を短くしてください。');
if(['message','comment','note','task','card','option','hand','sticky','agenda','record','link','slot'].includes(kind)&&(!clean(b.text,20000)||String(b.text).length>20000))throw new ApiError(400,'内容は1〜20,000文字で入力してください。');
if(b.group!==undefined&&(typeof b.group!=='string'||(t.labels.length>0&&!['poll','timer','canvas'].includes(t.engine)&&kind!=='comment'&&!t.labels.includes(b.group))))throw new ApiError(400,'項目を確認してください。');
if(kind==='record'&&(!Array.isArray(b.values)||b.values.length!==t.fields.length||b.values.some((v:any)=>typeof v!=='string'||v.length>10000)))throw new ApiError(400,'入力項目を確認してください。');
if(kind==='agenda'&&(!Number.isFinite(b.minutes)||b.minutes<1||b.minutes>240))throw new ApiError(400,'持ち時間は1〜240分で入力してください。');
if(b.assignee!==undefined&&typeof b.assignee!=='string')throw new ApiError(400,'担当者を確認してください。');
if(b.detail!==undefined&&typeof b.detail!=='string')throw new ApiError(400,'補足を確認してください。');
if(kind==='comment'&&(!clean(b.parent,60)||b.parent.length>60))throw new ApiError(400,'コメント先を確認してください。');
if(isCanvasKind(kind)&&b.color!==undefined&&(typeof b.color!=='string'||!/^#[0-9a-f]{6}$/i.test(b.color)))throw new ApiError(400,'描画の色を確認してください。');
if(kind==='sticky'&&(b.text.length>240||(b.fill!==undefined&&(typeof b.fill!=='string'||!/^#[0-9a-f]{6}$/i.test(b.fill)))))throw new ApiError(400,'付箋は240文字以内で入力してください。');
if(kind==='text'){
  if(!clean(b.text,1000)||b.text.length>1000||!Number.isFinite(b.fontSize)||b.fontSize<16||b.fontSize>64||!Number.isFinite(b.w)||b.w<160||b.w>1000)throw new ApiError(400,'文字は1〜1,000文字、サイズは16〜64で入力してください。');
  const height=canvasTextLayout(b.text,b.fontSize,b.w).height;
  if(height>800)throw new ApiError(400,'文字が盤面に収まりません。サイズを小さくするか、文章を分けてください。');
  if(b.x+b.w>1200||b.y+height>800)throw new ApiError(400,'文字を盤面の内側に置いてください。');
}
if(kind==='stroke'&&b.smooth!==undefined&&typeof b.smooth!=='boolean')throw new ApiError(400,'描画の形式を確認してください。');
if(isCanvasKind(kind)&&b.width!==undefined&&(!Number.isFinite(b.width)||b.width<1||b.width>30))throw new ApiError(400,'ペンの太さを確認してください。');
if(kind==='shape'&&(!['rect','line'].includes(b.type)||!(b.type==='rect'?[b.w,b.h]:[b.x2,b.y2]).every((n:any)=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=2000)))throw new ApiError(400,'図形のデータを確認してください。');
if(kind==='link'){try{const u=new URL(b.url);if(!['http:','https:'].includes(u.protocol))throw 0}catch{throw new ApiError(400,'http または https で始まるURLを入力してください。');}}
if(kind==='slot'&&(!b.date||!Number.isFinite(Date.parse(b.date))))throw new ApiError(400,'日時を入力してください。');
if(kind==='stroke'){if(!Array.isArray(b.points)||b.points.length<1||b.points.length>2500||b.points.some((p:any)=>!Array.isArray(p)||p.length!==2||p.some((n:any)=>typeof n!=='number'||!Number.isFinite(n)||n<0||n>2000)))throw new ApiError(400,'描画データを確認してください。');}
if(['sticky','shape','text'].includes(kind)){if(![b.x,b.y].every((n:any)=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=2000))throw new ApiError(400,'位置を確認してください。');}
if(kind==='timer'&&(!Number.isFinite(b.remaining)||b.remaining<0||b.remaining>31536000||!Number.isFinite(b.duration)||b.duration<1||b.duration>31536000||typeof b.running!=='boolean'||!Number.isFinite(b.endsAt)))throw new ApiError(400,'タイマーの時間を確認してください。');
return b;}
