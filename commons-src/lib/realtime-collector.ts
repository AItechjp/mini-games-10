import targetsJson from '../data/realtime-targets.json';
import reviewsJson from '../data/realtime-reviews.json';
import {inspectTarget,siteName,visibleText,announcedClosures,maxAge,type Target,type Evidence,type EvidenceSnapshot,type SourceCheck} from './realtime-evidence';
import {holidays} from './ramen-data';
export const targets=targetsJson as Target[];
const urls=[...new Set(targets.map(t=>t.url))];
const allowedSites=new Set(urls.map(siteName));
export async function fetchPage(url:string){
 const timer=AbortSignal.timeout(12000);let next=new URL(url);
 if(next.protocol!=='https:'||!allowedSites.has(siteName(next.href)))throw new Error('収集対象外の情報源です');
 for(let i=0;i<4;i++){
  const r=await fetch(next,{signal:timer,redirect:'manual',headers:{'User-Agent':'CommonsEvidence/1.0 (+https://aitechd.com/commons/)','Accept':'text/html,application/json;q=0.9'}});
  if([301,302,303,307,308].includes(r.status)){await r.body?.cancel();next=new URL(r.headers.get('location')||'',next);if(next.protocol!=='https:'||!allowedSites.has(siteName(next.href)))throw new Error('収集対象外へ転送されました');continue}
  if(!r.ok)throw new Error('HTTP '+r.status);
  if(!r.body)throw new Error('本文が空です');
  const reader=r.body.getReader(),decoder=new TextDecoder();let text='',bytes=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>1_500_000){await reader.cancel();throw new Error('本文が取得上限を超えました')}text+=decoder.decode(value,{stream:true})}text+=decoder.decode()}finally{reader.releaseLock()}
  return text;
 }
 throw new Error('転送回数が上限を超えました');
}
function inspectBase(target:Target,html:string,now=new Date()):Evidence{
 const review=(reviewsJson as {id:string;hours:string;required:string[];scope:string;note?:string;lastEntry?:number;lastEntryBeforeClose?:number;scopeStart?:string;scopeEnd?:string;scopeLength?:number;holidayEveClose?:string;weekdayOpen?:string;weekendOpen?:string}[]).find(r=>r.id===target.id);
 if(review){
  let text=visibleText(html).replace(/\s/g,'');
  if(review.scopeStart){const start=text.indexOf(review.scopeStart.replace(/\s/g,''));if(start<0)text='';else text=text.slice(start);if(review.scopeEnd){const end=text.indexOf(review.scopeEnd);if(end<0)text='';else text=text.slice(0,end)}else text=text.slice(0,review.scopeLength||500)}
  const ok=review.required.every(part=>text.includes(part.normalize('NFKC').replace(/\s/g,'')));
  const exceptions:Record<string,string>={};
  if(review.holidayEveClose){for(const day of holidays){const prev=new Date(Date.parse(day+'T00:00:00Z')-86400000),key=prev.toISOString().slice(0,10),weekday=prev.getUTCDay();exceptions[key]=(weekday===0||weekday===6||holidays.has(key)?review.weekendOpen:review.weekdayOpen)+'-'+review.holidayEveClose}}
  return {id:target.id,url:target.url,checkedAt:now.toISOString(),expiresAt:new Date(now.getTime()+maxAge).toISOString(),ok,...(ok?{hours:review.hours,exceptions,method:'公式本文を照合',scope:review.scope,notice:review.note,lastEntry:review.lastEntry,lastEntryBeforeClose:review.lastEntryBeforeClose}:{reason:'公式の営業案内が変更されました。再照合が必要です'})};
 }
 const result=inspectTarget(target,html,now);
 if(result.ok&&targets.filter(t=>t.url===target.url).length>1&&result.method!=='公式の構造化データ')return {...result,ok:false,reason:'複数店舗のページでは店舗別の営業時間を確定できません'};
 return result;
}
export function inspectReviewed(target:Target,html:string,now=new Date()):Evidence{
 const e=inspectBase(target,html,now);
 if(e.ok&&targets.filter(t=>t.url===target.url).length===1){const closures=announcedClosures(html,now);e.exceptions={...e.exceptions,...closures};const days=Object.keys(closures);if(days.length)e.notice=[e.notice,'公式発表の休業日：'+days.join('・')].filter(Boolean).join(' ')}
 return e;
}
export async function collectEvidence(previous:EvidenceSnapshot,now=new Date(),limit=64):Promise<EvidenceSnapshot>{
 const old=new Map(previous.sources.map(s=>[s.url,s])),evidence=new Map(previous.evidence.map(e=>[e.id,e]));
 // Refresh the oldest pages first; interleave independent sites so one chain cannot
 // occupy the entire collection batch. A request never chooses a fetch target.
 const groups=new Map<string,string[]>();
 for(const url of [...urls].sort((a,b)=>(Date.parse(old.get(a)?.checkedAt||'')||0)-(Date.parse(old.get(b)?.checkedAt||'')||0))){const site=siteName(url);groups.set(site,[...(groups.get(site)||[]),url])}
 const chosen:string[]=[];while(chosen.length<Math.min(limit,urls.length)){for(const group of groups.values()){if(group.length&&chosen.length<limit)chosen.push(group.shift()!)}if(![...groups.values()].some(g=>g.length))break}
 let cursor=0;
 const worker=async()=>{while(cursor<chosen.length){const url=chosen[cursor++],items=targets.filter(t=>t.url===url),checkedAt=now.toISOString();
  try{const html=await fetchPage(url);let records=0;for(const t of items){const e=inspectReviewed(t,html,now);evidence.set(t.id,e);records+=Number(e.ok)}old.set(url,{url,site:siteName(url),checkedAt,ok:true,httpStatus:200,records})}
  catch(error){const reason=error instanceof Error?error.message:'本文を取得できません';old.set(url,{url,site:siteName(url),checkedAt,ok:false,records:0,reason});for(const t of items)evidence.set(t.id,{id:t.id,url,checkedAt,expiresAt:checkedAt,ok:false,reason})}
 }};
 await Promise.all(Array.from({length:8},worker));
 return {version:1,updatedAt:now.toISOString(),cursor:0,sources:[...old.values()],evidence:[...evidence.values()]};
}
