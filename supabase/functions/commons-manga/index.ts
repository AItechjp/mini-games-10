import configured from './sources.json' with {type:'json'};
import {collectSource,RETENTION,INTERVAL} from './core.mjs';
import {verifyBatch,isFree,coverage,VERIFIED_FOR} from './availability.mjs';
const REST=Deno.env.get('SUPABASE_URL')+'/rest/v1/';
const KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey,content-type,x-manga-token','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff'};
async function db(path:string,method='GET',body?:unknown){
 const r=await fetch(REST+path,{method,headers:{apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
 if(!r.ok)throw new Error('Snapshot storage unavailable');return r.status===204?null:r.json();
}
function json(body:unknown,status=200,cache=false){return new Response(JSON.stringify(body),{status,headers:{...CORS,'Cache-Control':cache?'public, max-age=20':'no-store'}});}
async function sha(value:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function collect(){
 const owner=crypto.randomUUID();if(!await db('rpc/commons_manga_claim','POST',{p_owner:owner}))return {ok:true,skipped:'recently_checked_or_running'};
 const path='commons_manga_state?id=eq.1&lease_owner=eq.'+owner;
 try{
  const deadline=Date.now()+48000;
  const row=(await db('commons_manga_state?id=eq.1'))[0],old=row.payload||{sources:[],items:[]},results:any[]=[];let index=0;
  const feeds=configured.filter(s=>s.feed);
  await Promise.all(Array.from({length:4},async()=>{while(index<feeds.length){const source=feeds[index++];results.push(await collectSource(source,old.sources.find((s:any)=>s.id===source.id),old.items));}}));
  const sources=configured.map(s=>results.find(x=>x.source.id===s.id)?.source||{...s,status:'directory'});
  const candidates=results.flatMap(x=>x.items).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
  const items=await verifyBatch(candidates,configured,fetch,Date.now(),deadline);
  const saved=await db(path,'PATCH',{payload:{sources,items},completed_at:new Date().toISOString(),lease_until:null,lease_owner:null,last_error:null});
  if(!saved.length)throw new Error('Collection lease expired');
  return {ok:true,sources:sources.length,successful:sources.filter(s=>s.status==='ok').length,...coverage(items)};
 }catch(error){await db(path,'PATCH',{lease_until:null,lease_owner:null,last_error:'巡回が完了しませんでした。次回に再試行します。'}).catch(()=>{});throw error;}
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
 try{
  if(req.method==='POST'){
   const token=req.headers.get('x-manga-token')||'';if(!/^[a-f0-9]{64}$/.test(token))return json({error:'Collector authentication required'},401);
   const row=(await db('commons_manga_state?id=eq.1&select=token_hash'))[0];if(await sha(token)!==row?.token_hash)return json({error:'Collector authentication failed'},403);
   return json(await collect());
  }
  if(req.method!=='GET')return json({error:'Method not allowed'},405);
  const row=(await db('commons_manga_state?id=eq.1&select=payload,completed_at,started_at,lease_until,last_error'))[0];
  if(!row)return json({error:'収集データを準備しています。'},503);
  const now=Date.now(),payload=row.payload||{sources:[],items:[]};
  const candidates=payload.items.filter((x:any)=>Date.parse(x.updatedAt)>=now-RETENTION);
  const items=candidates.filter((x:any)=>isFree(x,now)).map(({verifyAfter,verificationError,...item}:any)=>item);
  const sources=configured.map(s=>{const previous=payload.sources.find((x:any)=>x.id===s.id)||{};const {etag,lastModified,...safe}=previous;return {...safe,...s,status:s.feed?(safe.status||'pending'):'directory',count:items.filter((x:any)=>x.sourceId===s.id).length,coverage:coverage(candidates.filter((x:any)=>x.sourceId===s.id),now)};});
  return json({version:1,verificationVersion:2,now:new Date(now).toISOString(),collectedAt:row.completed_at,startedAt:row.started_at,collecting:Date.parse(row.lease_until)>now,error:row.last_error,intervalMs:INTERVAL,retentionDays:30,verificationMaxAgeMs:VERIFIED_FOR,coverage:coverage(candidates,now),sources,items},200,true);
 }catch(error){console.error('manga:',error instanceof Error?error.message:'request failed');return json({error:'収集データを取得できません。時間をおいて再試行してください。'},503);}
});
