import {database} from './database';
import {allowedOrigins} from './origins';
import {collectEvidence,targets} from '../lib/realtime-collector';
import {validEvidence,siteName,type EvidenceSnapshot} from '../lib/realtime-evidence';
import initialEvidence from '../data/realtime-initial.json';
import initialOpenings from '../data/opening-verified-initial.json';
import {collectOpenings} from '../lib/opening-feeds';
import type {OpeningSnapshot} from '../lib/openings';
declare const EdgeRuntime:{waitUntil(p:Promise<unknown>):void};
async function cached<T extends object>(key:string,initial:T,interval:number,collect:(value:T)=>Promise<T>):Promise<T&{refreshing?:boolean;storageError?:boolean}>{
 const db=database(),now=Date.now();
 try{
  await db.prepare('INSERT OR IGNORE INTO opening_cache (key,payload,updated,locked_until) VALUES (?,?,0,0)').bind(key,JSON.stringify(initial)).run();
  const row=await db.prepare('SELECT payload,updated,locked_until FROM opening_cache WHERE key=?').bind(key).first<{payload:string;updated:number;locked_until:number}>();
  const snapshot=row?JSON.parse(row.payload) as T:initial;
  if(row&&now-row.updated<interval)return snapshot;
  const lock=await db.prepare('UPDATE opening_cache SET locked_until=? WHERE key=? AND locked_until<? AND updated<? RETURNING key').bind(now+145000,key,now,now-interval).first();
  if(lock)EdgeRuntime.waitUntil((async()=>{try{const value=await collect(snapshot);await db.prepare('UPDATE opening_cache SET payload=?,updated=?,locked_until=0 WHERE key=?').bind(JSON.stringify(value),Date.now(),key).run()}catch(error){console.error('Commons collection failed',String(error));await db.prepare('UPDATE opening_cache SET locked_until=0 WHERE key=?').bind(key).run()}})());
  return {...snapshot,refreshing:true};
 }catch{return {...initial,storageError:true}}
}
async function handle(request:Request){
 const u=new URL(request.url),path=u.pathname.replace(/^.*\/commons-realtime/,'');
 if(request.method!=='GET')return Response.json({error:'Method not allowed'},{status:405});
 if(path==='/health')return Response.json({ok:true,service:'commons-realtime',version:1,minimumSites:20});
 if(path==='/directory'){
  const snapshot=await cached<EvidenceSnapshot>('evidence-directory-v1',initialEvidence as EvidenceSnapshot,300000,collectEvidence);
  const now=Date.now(),byId=new Map(snapshot.evidence.map(e=>[e.id,e]));
  const stores=targets.flatMap(target=>{const e=byId.get(target.id);return validEvidence(e,now)?[{...target,hours:e!.hours,hoursText:e!.hoursText,checkedAt:e!.checkedAt,expiresAt:e!.expiresAt,sourceUrl:e!.url,sourceType:'official',scope:e!.scope,note:e!.notice,lastEntry:e!.lastEntry,lastEntryBeforeClose:e!.lastEntryBeforeClose,exceptions:e!.exceptions,method:e!.method,categories:target.kinds}]:[]});
  const freshSources=snapshot.sources.filter(s=>s.ok&&now-Date.parse(s.checkedAt)<2*3600000);
  return Response.json({serverNow:now,updatedAt:snapshot.updatedAt,refreshing:snapshot.refreshing,storageError:snapshot.storageError,stores,sources:snapshot.sources,coverage:{targeted:targets.length,verified:stores.length,withheld:targets.length-stores.length,sitesConfigured:new Set(targets.map(t=>siteName(t.url))).size,sitesFetched:new Set(freshSources.map(s=>s.site)).size},nextRefreshSeconds:300});
 }
 if(path==='/openings'){
  const initial=initialOpenings as OpeningSnapshot;
  const snapshot=await cached<OpeningSnapshot>('opening-directory-v3-verified',initial,900000,collectOpenings);
  const now=Date.now();
  return Response.json({...snapshot,records:snapshot.records.filter(r=>r.status==='scheduled'&&r.reviewed&&r.address&&now-Date.parse(r.checkedAt)<3600000&&Date.parse(r.checkedAt)<=now),serverNow:new Date(now).toISOString()});
 }
 return Response.json({error:'Not found'},{status:404});
}
Deno.serve(async(request:Request)=>{
 const origin=request.headers.get('Origin');
 const headers=new Headers({'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
 if(origin&&!allowedOrigins.has(origin))return new Response('Origin not allowed',{status:403,headers});
 if(origin){headers.set('Access-Control-Allow-Origin',origin);headers.set('Vary','Origin');headers.set('Access-Control-Allow-Methods','GET, OPTIONS');headers.set('Access-Control-Allow-Headers','apikey, content-type, x-region');headers.set('Access-Control-Max-Age','600')}
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
 let response:Response;try{response=await handle(request)}catch{response=Response.json({error:'情報を取得できませんでした。再試行してください。'},{status:503})}
 response.headers.forEach((value,key)=>headers.set(key,value));return new Response(response.body,{status:response.status,headers});
});
