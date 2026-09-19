import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,ArrowUpRight,Clock3,MapPin,RefreshCw,Search,Phone,CheckCircle2} from 'lucide-react';
import {localStatus,readableHours,type LocalStore} from '../lib/local-hours';
import {prefectures,regions} from '../lib/sauna-types';
import records from '../data/sauna-nationwide.json';
import {realtimeFetch} from './realtime-api';
import './live-directory.css';

type Facility=LocalStore&{kind:'sauna'|'sento'|'spa';closedText?:string;lastEntry?:number;lastEntryBeforeClose?:number;manualCalendar?:boolean;lockReviewedHours?:boolean;closedMonthDays?:number[];closurePeriods?:{from:string;through:string}[];scheduleChanges?:{from:string;hours:string}[];live?:boolean};
type LiveStore=LocalStore&{kinds:string[];expiresAt:string;lastEntry?:number;lastEntryBeforeClose?:number};
type LiveData={stores:LiveStore[];serverNow:number;updatedAt:string|null};
const curated=records as Facility[];
const normalize=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/[\s・･「」『』()（）－-]/g,'');
const day=(n:number)=>new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'numeric',day:'numeric'}).format(n);
const clock=(n:number)=>new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(n);
const labels={sauna:'サウナ',sento:'銭湯',spa:'温浴施設'};
function sameFacility(a:LocalStore,b:LocalStore){return a.id===b.id||(a.prefecture===b.prefecture&&normalize(a.name)===normalize(b.name));}
export function combineFacilities(saved:Facility[],fresh:LiveStore[],now:number):Facility[]{
 const result=[...saved];
 for(const store of fresh){
  if(!store.kinds.some(k=>['sauna','saunas','sento'].includes(k))||!store.hours||Date.parse(store.expiresAt)<=now||Date.parse(store.checkedAt)>now)continue;
  const i=result.findIndex(x=>sameFacility(x,store));
  if(i>=0){
   // A failed fetch never erases a researched schedule. A newer successful
   // fetch may replace the schedule, while keeping researched venue details.
   if(Date.parse(store.checkedAt)>Date.parse(result[i].checkedAt)&&!result[i].lockReviewedHours){
    const saved=result[i],sameHours=(h:string)=>h.replace(/\bMo-Su\s*/g,'').replace(/\s/g,'');
    if(sameHours(saved.hours)===sameHours(store.hours))result[i]={...saved,checkedAt:store.checkedAt,exceptions:{...saved.exceptions,...store.exceptions},...(store.lastEntry!==undefined||store.lastEntryBeforeClose!==undefined?{lastEntry:store.lastEntry,lastEntryBeforeClose:store.lastEntryBeforeClose}:{}),live:true};
    else result[i]={...saved,manualCalendar:true,note:[saved.note,'自動取得した時間に違いがあります。最新の営業案内をご確認ください。'].filter(Boolean).join(' ')};
   }
  }else result.push({...store,kind:'spa',live:true});
 }
 return result.sort((a,b)=>prefectures.indexOf(a.prefecture)-prefectures.indexOf(b.prefecture)||a.name.localeCompare(b.name,'ja'));
}
export function facilityState(store:Facility,now:number){
 const date=new Date(now+9*3600000).toISOString().slice(0,10);
 if(store.closurePeriods?.some(p=>date>=p.from&&date<=p.through))return 'closed';
 if(store.closedMonthDays?.includes(Number(date.slice(-2))))return 'closed';
 if(store.exceptions?.[date]==='off')return 'closed';
 if(store.manualCalendar)return 'calendar';
 const change=store.scheduleChanges?.filter(s=>s.from<=date).sort((a,b)=>b.from.localeCompare(a.from))[0];
 const status=localStatus(change?{...store,hours:change.hours}:store,now);
 if(status.state==='unknown')return 'calendar';
 if(status.state==='open'){
  if(store.lastEntryBeforeClose!==undefined&&status.nextChange!==undefined&&status.nextChange-now<=store.lastEntryBeforeClose*60000)return 'reception-ended';
  if(store.lastEntry!==undefined&&new Set([...store.hours.matchAll(/\d{2}:\d{2}-(\d{2}:\d{2})/g)].map(m=>m[1])).size===1){
   const jst=new Date(now+9*3600000),minute=jst.getUTCHours()*60+jst.getUTCMinutes();
   // For an overnight cutoff, midnight belongs to yesterday's business day.
   const cutoff=store.lastEntry,close=status.nextChange;
   if(close){const end=new Date(close+9*3600000),endMinute=end.getUTCHours()*60+end.getUTCMinutes();let until=(endMinute-(cutoff%1440)+1440)%1440;if(until<12*60&&close-now<=until*60000)return 'reception-ended';}
   else if(cutoff<1440&&minute>=cutoff)return 'reception-ended';
  }
 }
 return status.state;
}
export default function SaunaNationwide(){
 const [live,setLive]=useState<LiveData|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [query,setQuery]=useState(''),[pref,setPref]=useState('all'),[city,setCity]=useState('all'),[kind,setKind]=useState('all'),[filter,setFilter]=useState('all'),[now,setNow]=useState(Date.now());
 const request=useRef<AbortController|null>(null),origin=useRef({server:Date.now(),local:0});
 async function refresh(){
  request.current?.abort();const controller=new AbortController();request.current=controller;const timeout=setTimeout(()=>controller.abort(),20000);setBusy(true);
  try{const r=await realtimeFetch('/directory',controller.signal);if(!r.ok)throw new Error();const d=await r.json() as LiveData;if(!Array.isArray(d.stores)||!Number.isFinite(d.serverNow))throw new Error();if(request.current!==controller)return;setLive(d);origin.current={server:d.serverNow,local:performance.now()};setNow(d.serverNow);setError('');}
  catch{if(request.current===controller)setError('追加の更新情報を取得できませんでした。確認日付きの営業時間を表示しています。');}
  finally{clearTimeout(timeout);if(request.current===controller)setBusy(false);}
 }
 useEffect(()=>{
  document.title='サウナナウ 全国版｜47都道府県のサウナ・銭湯 | COMMONS';
  const p=new URLSearchParams(location.search);if(prefectures.includes(p.get('pref')||''))setPref(p.get('pref')!);setQuery(p.get('q')||'');if(['sauna','sento','spa'].includes(p.get('kind')||''))setKind(p.get('kind')!);if(['open','closed','all'].includes(p.get('status')||''))setFilter(p.get('status')!);
  origin.current.local=performance.now();void refresh();
  const tick=setInterval(()=>setNow(origin.current.server+performance.now()-origin.current.local),15000),poll=setInterval(()=>{if(!document.hidden)void refresh()},60000);
  const visible=()=>{if(!document.hidden)void refresh()};document.addEventListener('visibilitychange',visible);window.addEventListener('online',visible);
  return()=>{request.current?.abort();request.current=null;clearInterval(tick);clearInterval(poll);document.removeEventListener('visibilitychange',visible);window.removeEventListener('online',visible);};
 },[]);
 function updateParam(key:string,value:string){const p=new URLSearchParams(location.search);value==='all'||!value?p.delete(key):p.set(key,value);history.replaceState(null,'',location.pathname+(p.size?'?'+p:''));}
 const facilities=useMemo(()=>combineFacilities(curated,live?.stores||[],now),[live,now]);
 const counts=useMemo(()=>new Map(prefectures.map(p=>[p,facilities.filter(s=>s.prefecture===p).length])),[facilities]);
 const cities=[...new Set(facilities.filter(s=>pref==='all'||s.prefecture===pref).map(s=>s.city).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'));
 const matched=useMemo(()=>facilities.filter(s=>(pref==='all'||s.prefecture===pref)&&(city==='all'||s.city===city)&&(kind==='all'||s.kind===kind)&&normalize(s.name+s.address).includes(normalize(query))).map(store=>({store,state:facilityState(store,now)})),[facilities,pref,city,kind,query,now]);
 const shown=matched.filter(x=>filter==='all'||(filter==='open'?x.state==='open':['closed','reception-ended'].includes(x.state)));
 const sourceCount=new Set(facilities.map(s=>new URL(s.sourceUrl).hostname.replace(/^www\./,''))).size;
 return <div className="verified-directory sauna-national">
  <header className="verified-top"><a href="/commons/"><ArrowLeft size={17}/>COMMONS</a><a href="/">AITECH</a></header>
  <main>
   <div className="verified-title"><div><p>47都道府県 · サウナ・銭湯・日帰り温浴</p><h1>サウナナウ <span className="national-label">全国版</span></h1></div><div className="verified-clock"><Clock3 size={20}/><time>{clock(now)}</time><small>日本時間</small></div></div>
   <p className="verified-intro">都道府県を選んで、営業時間と定休日を確認。各施設に確認日と出典を掲載しています。</p>
   <section className="verified-controls" aria-label="サウナと銭湯を絞り込む">
    <label className="verified-search"><Search size={18}/><input value={query} onChange={e=>{setQuery(e.target.value);updateParam('q',e.target.value)}} placeholder="施設名・住所" aria-label="店名・住所を検索"/></label>
    <label><span>都道府県</span><select aria-label="都道府県" value={pref} onChange={e=>{setPref(e.target.value);setCity('all');updateParam('pref',e.target.value)}}><option value="all">全国（{facilities.length}件）</option>{regions.map(r=><optgroup key={r.name} label={r.name}>{prefectures.slice(r.start,r.end).map(p=><option key={p} value={p}>{p}（{counts.get(p)}件）</option>)}</optgroup>)}</select></label>
    <label><span>市区町村</span><select aria-label="市区町村" value={city} onChange={e=>setCity(e.target.value)}><option value="all">すべて</option>{cities.map(c=><option key={c}>{c}</option>)}</select></label>
    <label><span>施設の種類</span><select aria-label="施設の種類" value={kind} onChange={e=>{setKind(e.target.value);updateParam('kind',e.target.value)}}><option value="all">すべて</option><option value="sauna">サウナ施設</option><option value="sento">銭湯</option><option value="spa">温浴施設</option></select></label>
    <button onClick={()=>void refresh()} disabled={busy} aria-label="営業判定と更新情報を再取得"><RefreshCw size={17}/>{busy?'更新中':'更新'}</button>
   </section>
   <div className="verified-tabs" role="group" aria-label="営業時間で絞り込み">{[['all','確認できた全件'],['open','営業時間内'],['closed','時間外・受付終了']].map(([key,label])=><button key={key} aria-pressed={filter===key} onClick={()=>{setFilter(key);updateParam('status',key)}}>{label}<b>{matched.filter(x=>key==='all'||(key==='open'?x.state==='open':['closed','reception-ended'].includes(x.state))).length}</b></button>)}</div>
   <div className="verified-result-head"><h2>{pref==='all'?'全国':pref} · {shown.length}件</h2><span>掲載全件に営業時間あり</span></div>
   <p className="national-status-note">「営業時間内」は公表された時間からの計算です。当日の臨時休業や予約枠は、各施設の営業案内をご確認ください。</p>
   {error&&<p className="verified-error" role="status">{error}</p>}
   <section className="verified-list" aria-label="確認できた施設一覧">{shown.map(({store:s,state})=><article key={s.id} data-facility-id={s.id}>
    <div><p className="verified-place">{s.prefecture} {s.city} · {labels[s.kind]}</p><h3>{s.name}</h3><p>{s.address}</p>{s.note&&<p className="verified-note">{s.note}</p>}</div>
    <div className="verified-hours"><span className={'verified-badge '+(state==='open'?'is-open':'')}>{state==='open'?'営業時間内':state==='reception-ended'?'受付終了':state==='closed'?'営業時間外':'当日の営業案内を確認'}</span><strong>{s.hoursText||readableHours(s.hours)}</strong>{s.closedText&&<small>定休日：{s.closedText}</small>}{s.scope==='facility'&&<small>浴場・施設の利用時間</small>}<small>営業時間の確認日 {day(Date.parse(s.checkedAt))}{s.live?' · 自動照合':''}</small></div>
    <div className="verified-actions"><a href={s.sourceUrl} target="_blank" rel="noopener noreferrer">営業時間の出典<ArrowUpRight size={16}/></a><a href={'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(s.name+' '+s.address)} target="_blank" rel="noopener noreferrer"><MapPin size={16}/>地図</a>{s.phone&&<a href={'tel:'+s.phone.replace(/[^+\d]/g,'')}><Phone size={16}/>電話</a>}</div>
   </article>)}</section>
   {!shown.length&&<div className="verified-empty"><Clock3 size={28}/><h2>この条件の掲載施設はありません</h2><p>施設の種類や営業時間の絞り込みを変更してください。</p><button onClick={()=>{setKind('all');setFilter('all');setCity('all');setQuery('');['kind','status','q'].forEach(k=>updateParam(k,'all'));}}>この県の全件を表示</button></div>}
   <section className="verified-source-strip national-sources"><CheckCircle2 size={22}/><div><b>{sourceCount}サイトの営業時間を掲載</b><span>{new Set(facilities.map(s=>s.prefecture)).size}都道府県 · {facilities.length}施設 · 各施設に出典・確認日</span></div><a href="#verified-sources">収集範囲</a></section>
   <section className="verified-method" id="verified-sources"><h2>収集範囲と更新</h2><p>施設・運営会社・自治体・銭湯組合の案内から営業時間を確認しました。全国のすべての施設を網羅する一覧ではありません。掲載件数は確認できた施設数です。</p><p>調査した営業時間は確認日とともに保存しています。既存の自動収集対象では追加の照合結果を1分ごとに読み込みます。画面の時刻更新は、全施設の営業時間を再調査したことを意味しません。</p><p>不定休・予約制・祝日振替など、自動計算できない条件は施設の案内を併記します。サウナ室の稼働時間が浴場全体と異なる場合は、施設ごとの記載をご確認ください。</p><details><summary>都道府県別の掲載件数</summary><div className="national-pref-grid">{prefectures.map(p=><button key={p} onClick={()=>{setPref(p);setCity('all');setQuery('');setKind('all');setFilter('all');updateParam('pref',p);['kind','status','q'].forEach(k=>updateParam(k,'all'));document.querySelector('.verified-controls')?.scrollIntoView({behavior:'smooth'});}}>{p}<span>{counts.get(p)}件</span></button>)}</div></details></section>
  </main>
 </div>;
}
