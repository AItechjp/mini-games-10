import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,ArrowUpRight,Clock3,MapPin,RefreshCw,Search,Phone,Database,ChevronLeft,ChevronRight,Download} from 'lucide-react';
import {localStatus,readableHours,type LocalStore} from '../lib/local-hours';
import {prefectures,regions} from '../lib/sauna-types';
import records from '../data/sauna-nationwide.json';
import inventoryData from '../data/sauna-inventory.json';
import {realtimeFetch} from './realtime-api';
import './live-directory.css';

type Facility=LocalStore&{kind:'sauna'|'sento'|'spa'|'hotel'|'sports'|'other';closedText?:string;lastEntry?:number;lastEntryBeforeClose?:number;manualCalendar?:boolean;lockReviewedHours?:boolean;closedMonthDays?:number[];closurePeriods?:{from:string;through:string}[];scheduleChanges?:{from:string;hours:string}[];live?:boolean;inventoryOnly?:boolean;acquiredAt?:string;sourceDate?:string;hoursEvidence?:'official'|'osm'|'registry';accessLabel?:string;status?:'inactive'|'active'|'unverified'};
type InventorySource={name:string;url:string;count:number;withHours:number;license:string;sourceDate:string;scope:string};
type Inventory={facilities:Facility[];coverage:{rawRecords:number;uniqueFacilities:number;withHours:number;withoutHours:number;sourceCount:number;acquiredAt:string;sources:InventorySource[];excluded:number;duplicates:number}};
type LiveStore=LocalStore&{kinds:string[];expiresAt:string;lastEntry?:number;lastEntryBeforeClose?:number};
type LiveData={stores:LiveStore[];serverNow:number;updatedAt:string|null};
const inventory=inventoryData as unknown as Inventory;
const curated=records as Facility[];
const savedFacilities=inventory.facilities?.length?inventory.facilities:curated;
const normalize=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/[\s・･「」『』()（）－-]/g,'');
const day=(n:number)=>new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'numeric',day:'numeric'}).format(n);
const dateLabel=(value?:string)=>{
 if(!value)return '';
 if(/^\d{4}$/.test(value))return value+'年';
 if(/^\d{4}-\d{2}$/.test(value))return value.slice(0,4)+'年'+Number(value.slice(5))+'月';
 return Number.isFinite(Date.parse(value))?day(Date.parse(value)):'';
};
const clock=(n:number)=>new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(n);
const count=(n:number)=>n.toLocaleString('ja-JP');
const labels={sauna:'サウナ',sento:'銭湯',spa:'温浴施設',hotel:'宿泊施設の浴場',sports:'スポーツ施設の浴場',other:'その他の入浴施設'};
const sourceLabels={official:'公式案内',osm:'OpenStreetMap',directory:'施設情報サイト',registry:'公的施設台帳'};
const hasHours=(store:Facility)=>Boolean(store.hours?.trim()||store.hoursText?.trim());
function accessGroup(store:Facility){
 if(['no','private','members','customers','permit','facility_users_or_members','guests_or_day_use_unverified','public_or_local_residents_unverified'].includes(store.access||'')||['hotel','sports'].includes(store.kind))return 'conditional';
 if(['yes','public','permissive'].includes(store.access||''))return 'public';
 return 'unlisted';
}
function accessText(store:Facility){
 if(store.accessLabel)return store.accessLabel;
 const known:Record<string,string>={yes:'一般利用の記載あり',public:'一般利用の記載あり',permissive:'一般利用の記載あり',no:'一般利用不可',private:'限定利用・一般利用条件を確認',members:'会員向け',customers:'宿泊者・利用客向け',permit:'利用許可が必要',facility_users_or_members:'施設利用者・会員向け：利用条件を確認',guests_or_day_use_unverified:'宿泊施設：日帰り利用条件を確認',public_or_local_residents_unverified:'共同浴場：地域住民以外の利用条件を確認',conditions_not_reverified:'利用条件の確認待ち',unclassified:'利用条件の確認待ち'};
 return known[store.access||'']||(store.kind==='hotel'?'宿泊施設：日帰り利用条件を確認':store.kind==='sports'?'スポーツ施設：会員・利用条件を確認':'利用条件の記載なし');
}
function hasCoordinates(store:LocalStore):store is LocalStore&{lat:number;lon:number}{
 return Number.isFinite(store.lat)&&Number.isFinite(store.lon)&&Math.abs(store.lat!)<=90&&Math.abs(store.lon!)<=180&&(store.lat!==0||store.lon!==0);
}
const genericNames=new Set(['名称未登録','名称が登録されていない施設','露天風呂','男湯','女湯','サウナ','温泉','onsen','sauna','publicbath','bath'].map(normalize));
function sameFacility(a:LocalStore,b:LocalStore){
 if(a.id===b.id)return true;
 if(a.prefecture!==b.prefecture||!normalize(a.name)||normalize(a.name)!==normalize(b.name))return false;
 if(genericNames.has(normalize(a.name)))return false;
 if(a.city&&b.city&&normalize(a.city)!==normalize(b.city))return false;
 const addressA=normalize(a.address||''),addressB=normalize(b.address||'');
 // A prefecture or city alone is not an address-level identity match.
 const broadAddress=[normalize(a.prefecture),normalize(a.city||''),normalize(a.prefecture+(a.city||''))];
 if(addressA&&addressA===addressB&&!broadAddress.includes(addressA))return true;
 const phone=(value:string)=>value.replace(/\D/g,'').replace(/^81(\d{9,10})$/,'0$1');
 const phoneA=phone(a.phone||''),phoneB=phone(b.phone||'');
 if(phoneA.length>=9&&phoneA===phoneB)return true;
 if(!hasCoordinates(a)||!hasCoordinates(b))return false;
 const radians=(value:number)=>value*Math.PI/180;
 const latitude=radians(b.lat-a.lat),longitude=radians(b.lon-a.lon);
 const distance=2*6371000*Math.asin(Math.min(1,Math.sqrt(Math.sin(latitude/2)**2+Math.cos(radians(a.lat))*Math.cos(radians(b.lat))*Math.sin(longitude/2)**2)));
 return distance<=60;
}
function mapUrl(store:LocalStore){
 const query=hasCoordinates(store)?`${store.lat},${store.lon}`:store.name+' '+store.address;
 return 'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(query);
}
function liveProvenance(saved:Facility,store:LiveStore){
 const otherSources=new Map<string,{name:string;url:string}>();
 const sourceKey=(url:string)=>url.replace(/#.*$/,'').replace(/\/$/,'');
 for(const source of [...(saved.otherSources||[]),{name:saved.sourceName,url:saved.sourceUrl}]){
  if(source.url&&sourceKey(source.url)!==sourceKey(store.sourceUrl))otherSources.set(sourceKey(source.url),source);
 }
 return {checkedAt:store.checkedAt,sourceUrl:store.sourceUrl,sourceName:store.sourceName,sourceType:store.sourceType,sourceDate:undefined,hoursEvidence:store.sourceType==='directory'?undefined:store.sourceType,otherSources:[...otherSources.values()]};
}
export function combineFacilities(saved:Facility[],fresh:LiveStore[],now:number):Facility[]{
 const result=[...saved];
 for(const store of fresh){
  const expiry=Date.parse(store.expiresAt),checked=Date.parse(store.checkedAt);
  if(!store.kinds.some(k=>['sauna','saunas','sento'].includes(k))||!store.hours?.trim()||!Number.isFinite(expiry)||!Number.isFinite(checked)||expiry<=now||checked>now)continue;
  const i=result.findIndex(x=>sameFacility(x,store));
  if(i>=0){
   // A failed fetch never erases a researched schedule. A newer successful
   // fetch may replace the schedule, while keeping researched venue details.
   if(Number.isFinite(Date.parse(store.checkedAt))&&(!Number.isFinite(Date.parse(result[i].checkedAt))||Date.parse(store.checkedAt)>Date.parse(result[i].checkedAt))&&!result[i].lockReviewedHours){
    const saved=result[i],sameHours=(h:string)=>h.replace(/\bMo-Su\s*/g,'').replace(/\s/g,'');
    if(!hasHours(saved))result[i]={...saved,...liveProvenance(saved,store),hours:store.hours,hoursText:store.hoursText,exceptions:{...saved.exceptions,...store.exceptions},lastEntry:store.lastEntry,lastEntryBeforeClose:store.lastEntryBeforeClose,inventoryOnly:false,manualCalendar:accessGroup(saved)==='conditional'||localStatus({...store,access:''},now).state==='unknown',live:true};
    else if(sameHours(saved.hours)===sameHours(store.hours))result[i]={...saved,...liveProvenance(saved,store),exceptions:{...saved.exceptions,...store.exceptions},...(store.lastEntry!==undefined||store.lastEntryBeforeClose!==undefined?{lastEntry:store.lastEntry,lastEntryBeforeClose:store.lastEntryBeforeClose}:{}),live:true};
    else result[i]={...saved,manualCalendar:true,note:[saved.note,'自動取得した時間に違いがあります。最新の営業案内をご確認ください。'].filter(Boolean).join(' ')};
   }
  }else result.push({...store,kind:'spa',live:true});
 }
 return result.sort((a,b)=>prefectures.indexOf(a.prefecture)-prefectures.indexOf(b.prefecture)||a.name.localeCompare(b.name,'ja'));
}
export function facilityState(store:Facility,now:number){
 if(store.status==='inactive')return 'inactive';
 if(!hasHours(store))return 'unlisted';
 const date=new Date(now+9*3600000).toISOString().slice(0,10);
 if(store.closurePeriods?.some(p=>date>=p.from&&date<=p.through))return 'closed';
 if(store.closedMonthDays?.includes(Number(date.slice(-2))))return 'closed';
 if(store.exceptions?.[date]==='off')return 'closed';
 if(store.manualCalendar||accessGroup(store)==='conditional')return 'calendar';
 const change=store.scheduleChanges?.filter(s=>s.from<=date).sort((a,b)=>b.from.localeCompare(a.from))[0];
 const status=localStatus(change?{...store,hours:change.hours}:store,now);
 if(status.state==='unknown')return 'calendar';
 if(status.state==='open'){
  if(store.lastEntryBeforeClose!==undefined&&status.nextChange!==undefined&&status.nextChange-now<=store.lastEntryBeforeClose*60000)return 'reception-ended';
  if(store.lastEntry!==undefined&&new Set([...store.hours.matchAll(/\d{2}:\d{2}-(\d{2}:\d{2})/g)].map(m=>m[1])).size===1){
   const jst=new Date(now+9*3600000),minute=jst.getUTCHours()*60+jst.getUTCMinutes();
   // For an overnight cutoff, midnight belongs to yesterday's business day.
   const cutoff=store.lastEntry,close=status.nextChange;
   if(close){const end=new Date(close+9*3600000),endMinute=end.getUTCHours()*60+end.getUTCMinutes();const until=(endMinute-(cutoff%1440)+1440)%1440;if(until<12*60&&close-now<=until*60000)return 'reception-ended';}
   else if(cutoff<1440&&minute>=cutoff)return 'reception-ended';
  }
 }
 return status.state;
}
export default function SaunaNationwide(){
 const [live,setLive]=useState<LiveData|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [query,setQuery]=useState(''),[pref,setPref]=useState('all'),[city,setCity]=useState('all'),[kind,setKind]=useState('all'),[filter,setFilter]=useState('all'),[hoursFilter,setHoursFilter]=useState('all'),[accessFilter,setAccessFilter]=useState('all'),[now,setNow]=useState(Date.now());
 const [page,setPage]=useState(1),[pageSize,setPageSize]=useState(50);
 const request=useRef<AbortController|null>(null),origin=useRef({server:Date.now(),local:0});
 async function refresh(){
  request.current?.abort();const controller=new AbortController();request.current=controller;const timeout=setTimeout(()=>controller.abort(),20000);setBusy(true);
  try{const r=await realtimeFetch('/directory',controller.signal);if(!r.ok)throw new Error();const d=await r.json() as LiveData;if(!Array.isArray(d.stores)||!Number.isFinite(d.serverNow))throw new Error();if(request.current!==controller)return;setLive(d);origin.current={server:d.serverNow,local:performance.now()};setNow(d.serverNow);setError('');}
  catch{if(request.current===controller)setError('追加の更新情報を取得できませんでした。保存済みの施設情報を表示しています。');}
  finally{clearTimeout(timeout);if(request.current===controller)setBusy(false);}
 }
 useEffect(()=>{
  document.title='サウナナウ 全国版｜47都道府県のサウナ・銭湯 | COMMONS';
  const p=new URLSearchParams(location.search);
  if(prefectures.includes(p.get('pref')||''))setPref(p.get('pref')!);
  setQuery(p.get('q')||'');
  if(Object.keys(labels).includes(p.get('kind')||''))setKind(p.get('kind')!);
  if(['open','closed','all'].includes(p.get('status')||''))setFilter(p.get('status')!);
  if(['listed','unlisted'].includes(p.get('hours')||''))setHoursFilter(p.get('hours')!);
  if(['public','conditional','unlisted'].includes(p.get('access')||''))setAccessFilter(p.get('access')!);
  origin.current.local=performance.now();void refresh();
  const tick=setInterval(()=>setNow(origin.current.server+performance.now()-origin.current.local),15000),poll=setInterval(()=>{if(!document.hidden)void refresh()},60000);
  const visible=()=>{if(!document.hidden)void refresh()};document.addEventListener('visibilitychange',visible);window.addEventListener('online',visible);
  return()=>{request.current?.abort();request.current=null;clearInterval(tick);clearInterval(poll);document.removeEventListener('visibilitychange',visible);window.removeEventListener('online',visible);};
 },[]);
 useEffect(()=>setPage(1),[query,pref,city,kind,filter,hoursFilter,accessFilter,pageSize]);
 function updateParam(key:string,value:string){const p=new URLSearchParams(location.search);value==='all'||!value?p.delete(key):p.set(key,value);history.replaceState(null,'',location.pathname+(p.size?'?'+p:''));}
 function clearFilters(){setKind('all');setFilter('all');setHoursFilter('all');setAccessFilter('all');setCity('all');setQuery('');['kind','status','hours','access','q'].forEach(k=>updateParam(k,'all'));}
 const liveMinute=Math.floor(now/60000);
 // Reconcile once per minute; retain exact current time for live-source expiry.
 const facilities=useMemo(()=>combineFacilities(savedFacilities,live?.stores||[],now),[live,liveMinute]);
 const counts=useMemo(()=>{const result=new Map(prefectures.map(p=>[p,0]));for(const s of facilities)result.set(s.prefecture,(result.get(s.prefecture)||0)+1);return result;},[facilities]);
 const cities=useMemo(()=>[...new Set(facilities.filter(s=>pref==='all'||s.prefecture===pref).map(s=>s.city).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja')),[facilities,pref]);
 const searchable=useMemo(()=>facilities.map(store=>({store,search:normalize(store.name+store.address)})),[facilities]);
 const candidates=useMemo(()=>{const needle=normalize(query);return searchable.filter(({store:s,search})=>(pref==='all'||s.prefecture===pref)&&(city==='all'||s.city===city)&&(kind==='all'||s.kind===kind)&&(hoursFilter==='all'||hasHours(s)===(hoursFilter==='listed'))&&(accessFilter==='all'||accessGroup(s)===accessFilter)&&search.includes(needle)).map(({store})=>store);},[searchable,pref,city,kind,query,hoursFilter,accessFilter]);
 const matched=useMemo(()=>candidates.map(store=>({store,state:facilityState(store,now)})),[candidates,now]);
 const shown=useMemo(()=>matched.filter(x=>filter==='all'||(filter==='open'?x.state==='open':['closed','reception-ended'].includes(x.state))),[matched,filter]);
 const totalPages=Math.max(1,Math.ceil(shown.length/pageSize)),currentPage=Math.min(page,totalPages),start=(currentPage-1)*pageSize;
 const visibleFacilities=shown.slice(start,start+pageSize);
 const withHours=useMemo(()=>facilities.filter(hasHours).length,[facilities]),matchedHours=useMemo(()=>shown.filter(({store})=>hasHours(store)).length,[shown]);
 const sourceCount=inventory.coverage?.sourceCount||new Set(facilities.map(s=>s.sourceName)).size;
 function movePage(next:number){setPage(Math.min(totalPages,Math.max(1,next)));document.querySelector('.verified-result-head')?.scrollIntoView({behavior:'smooth',block:'start'});}
 const pagination=<nav className="national-pagination" aria-label="施設一覧のページ切り替え"><span>{shown.length?`${count(start+1)}–${count(Math.min(start+pageSize,shown.length))}件 / ${count(shown.length)}件`:'0件'}</span><div><button disabled={currentPage===1} onClick={()=>movePage(currentPage-1)} aria-label="前のページ"><ChevronLeft size={17}/>前へ</button><span>{currentPage} / {totalPages}</span><button disabled={currentPage===totalPages} onClick={()=>movePage(currentPage+1)} aria-label="次のページ">次へ<ChevronRight size={17}/></button></div></nav>;
 return <div className="verified-directory sauna-national">
  <header className="verified-top"><a href="/commons/"><ArrowLeft size={17}/>COMMONS</a><a href="/">AITECH</a></header>
  <main>
   <div className="verified-title"><div><p>47都道府県 · サウナ・銭湯・温浴施設</p><h1>サウナナウ <span className="national-label">全国版</span></h1></div><div className="verified-clock"><Clock3 size={20}/><time>{clock(now)}</time><small>日本時間</small></div></div>
   <p className="verified-intro">全国の施設を、都道府県・市区町村から検索。銭湯や日帰り温浴施設に加え、宿泊施設・スポーツ施設の浴場も利用条件とともに掲載します。</p>
   <section className="national-coverage" aria-label="施設情報の収集状況">
    <div><span>収集・掲載施設</span><strong>{count(facilities.length)}<small>件</small></strong></div><div><span>営業時間の掲載あり</span><strong>{count(withHours)}<small>件</small></strong></div><div><span>営業時間の掲載待ち</span><strong>{count(facilities.length-withHours)}<small>件</small></strong></div>
    <p>収集した施設は営業時間の有無にかかわらず表示しています。全国すべての施設の収集・営業時間の確認は完了していません。<a href="#verified-sources">収集範囲と出典</a></p>
   </section>
   <section className="verified-controls" aria-label="サウナと銭湯を絞り込む">
    <label className="verified-search"><Search size={18}/><input value={query} onChange={e=>{setQuery(e.target.value);updateParam('q',e.target.value)}} placeholder="施設名・住所を全件から検索" aria-label="店名・住所を検索"/></label>
    <label><span>都道府県</span><select aria-label="都道府県" value={pref} onChange={e=>{setPref(e.target.value);setCity('all');updateParam('pref',e.target.value)}}><option value="all">全国（{count(facilities.length)}件）</option>{regions.map(r=><optgroup key={r.name} label={r.name}>{prefectures.slice(r.start,r.end).map(p=><option key={p} value={p}>{p}（{count(counts.get(p)||0)}件）</option>)}</optgroup>)}</select></label>
    <label><span>市区町村</span><select aria-label="市区町村" value={city} onChange={e=>setCity(e.target.value)}><option value="all">すべて</option>{cities.map(c=><option key={c}>{c}</option>)}</select></label>
    <label><span>施設の種類</span><select aria-label="施設の種類" value={kind} onChange={e=>{setKind(e.target.value);updateParam('kind',e.target.value)}}><option value="all">すべて</option>{Object.entries(labels).map(([key,label])=><option value={key} key={key}>{label}</option>)}</select></label>
    <label><span>営業時間</span><select aria-label="営業時間の掲載状況" value={hoursFilter} onChange={e=>{setHoursFilter(e.target.value);updateParam('hours',e.target.value)}}><option value="all">掲載状況すべて</option><option value="listed">営業時間の掲載あり</option><option value="unlisted">営業時間の掲載待ち</option></select></label>
    <label><span>利用条件</span><select aria-label="施設の利用条件" value={accessFilter} onChange={e=>{setAccessFilter(e.target.value);updateParam('access',e.target.value)}}><option value="all">条件すべて</option><option value="public">一般利用の記載あり</option><option value="conditional">宿泊・会員等の条件あり</option><option value="unlisted">利用条件の記載なし</option></select></label>
    <button onClick={()=>void refresh()} disabled={busy} aria-label="営業判定と更新情報を再取得"><RefreshCw size={17}/>{busy?'更新中':'更新'}</button>
   </section>
   <div className="verified-tabs" role="group" aria-label="営業時間で絞り込み">{[['all','掲載全件'],['open','営業時間内'],['closed','時間外・受付終了']].map(([key,label])=><button key={key} aria-pressed={filter===key} onClick={()=>{setFilter(key);updateParam('status',key)}}>{label}<b>{count(matched.filter(x=>key==='all'||(key==='open'?x.state==='open':['closed','reception-ended'].includes(x.state))).length)}</b></button>)}</div>
   <div className="verified-result-head"><h2 aria-live="polite">{pref==='all'?'全国':pref} · {count(shown.length)}件</h2><label className="national-page-size">1ページ<select value={pageSize} onChange={e=>setPageSize(Number(e.target.value))} aria-label="1ページの表示件数"><option value={50}>50件</option><option value={100}>100件</option></select></label></div>
   <p className="national-status-note">この条件：営業時間の掲載あり {count(matchedHours)}件・掲載待ち {count(shown.length-matchedHours)}件。「営業時間内」は公表時間からの計算です。当日の臨時休業や予約枠は各施設の案内をご確認ください。</p>
   {error&&<p className="verified-error" role="status">{error}</p>}
   {shown.length>0&&pagination}
   <section className="verified-list" aria-label="収集した施設一覧">{visibleFacilities.map(({store:s,state})=><article key={s.id} data-facility-id={s.id}>
    <div><p className="verified-place">{s.prefecture} {s.city} · {labels[s.kind]||labels.other}</p><h3>{s.name}</h3><p>{s.address||'住所の詳細は施設情報の出典をご確認ください'}</p><p className={'national-access '+(accessGroup(s)==='conditional'?'is-conditional':'')}>{accessText(s)}</p>{s.note&&<p className="verified-note">{s.note}</p>}</div>
    <div className="verified-hours"><span className={'verified-badge '+(state==='open'?'is-open':state==='unlisted'?'is-unlisted':'')}>{state==='open'?'営業時間内':state==='reception-ended'?'受付終了':state==='closed'?'営業時間外':state==='inactive'?'休業・廃止の記載あり':state==='unlisted'?'営業時間未掲載':'当日の営業案内を確認'}</span><strong>{hasHours(s)?s.hoursText||readableHours(s.hours):'営業時間の掲載待ち'}</strong>{!hasHours(s)&&<small>収集元に営業時間の記載がありません。公式案内・電話での確認が必要です。</small>}{s.closedText&&<small>定休日：{s.closedText}</small>}{s.scope==='facility'&&<small>浴場・施設の利用時間</small>}{hasHours(s)&&<small>{dateLabel(s.checkedAt)?`営業時間の根拠日 ${dateLabel(s.checkedAt)}`:'営業時間の確認日は未記録'}{s.live?' · 自動照合':''}</small>}{s.sourceDate&&<small>出典データ日 {dateLabel(s.sourceDate)||s.sourceDate}</small>}{s.acquiredAt&&<small>施設データ取得日 {dateLabel(s.acquiredAt)||s.acquiredAt}</small>}<small>出典：{s.sourceName||sourceLabels[s.sourceType]}{s.sourceType==='osm'?'（地図投稿情報）':s.sourceType==='registry'?'（公的台帳）':''}</small></div>
    <div className="verified-actions">{s.website&&s.website!==s.sourceUrl&&<a href={s.website} target="_blank" rel="noopener noreferrer">施設のウェブサイト<ArrowUpRight size={16}/></a>}{s.sourceUrl&&<a href={s.sourceUrl} target="_blank" rel="noopener noreferrer">{hasHours(s)?'営業時間の出典':'施設情報の出典'}<ArrowUpRight size={16}/></a>}<a href={mapUrl(s)} target="_blank" rel="noopener noreferrer"><MapPin size={16}/>地図</a>{s.phone&&<a href={'tel:'+s.phone.replace(/[^+\d]/g,'')}><Phone size={16}/>電話</a>}{s.otherSources&&s.otherSources.length>0&&<details className="national-other-sources"><summary>その他の出典</summary>{s.otherSources.map((source,index)=><a href={source.url} key={source.url+index} target="_blank" rel="noopener noreferrer">{source.name}<ArrowUpRight size={14}/></a>)}</details>}</div>
   </article>)}</section>
   {shown.length>0&&pagination}
   {!shown.length&&<div className="verified-empty"><Clock3 size={28}/><h2>この条件の掲載施設はありません</h2><p>施設の種類・営業時間・利用条件の絞り込みを変更してください。</p><button onClick={clearFilters}>この県の全件を表示</button></div>}
   <section className="verified-source-strip national-sources"><Database size={22}/><div><b>{count(sourceCount)}の収集元を統合</b><span>{new Set(facilities.map(s=>s.prefecture).filter(p=>prefectures.includes(p))).size}都道府県 · {count(facilities.length)}施設 · 営業時間の掲載あり {count(withHours)}件</span></div><a href="/commons/sauna-inventory.json" download><Download size={16}/>施設データをダウンロード</a></section>
   <section className="verified-method" id="verified-sources"><h2>収集範囲と更新</h2><p>公式案内、OpenStreetMap、公的な施設台帳を照合し、収集した施設を掲載しています。営業時間が未掲載の施設も検索対象です。各収集元の対象外・未登録施設があるため、全国すべての施設を網羅した一覧ではありません。</p><p>営業時間の掲載と、現在営業しているかの確認は別です。収集元の更新日や記録日を営業時間の根拠日として示し、確認から90日を過ぎた情報・利用条件がある施設・自動計算できない営業日程では「営業時間内」の判定を出しません。施設データ取得日は、営業時間を確認した日を意味しません。</p><p>既存の自動収集対象では追加の照合結果を1分ごとに読み込みます。画面の時刻更新は、全施設の営業時間を再調査したことを意味しません。宿泊施設・スポーツ施設は、宿泊者や会員以外の利用条件を施設にご確認ください。</p>
    {inventory.coverage&&<><p className="national-acquisition">収集日：{dateLabel(inventory.coverage.acquiredAt)||inventory.coverage.acquiredAt} · 元データ {count(inventory.coverage.rawRecords)}件 · 重複統合 {count(inventory.coverage.duplicates)}件 · 対象外 {count(inventory.coverage.excluded)}件</p><div className="national-source-table"><table><caption>収集元別の対象範囲（統合前の件数）</caption><thead><tr><th scope="col">収集元</th><th scope="col">収集件数</th><th scope="col">営業時間あり</th><th scope="col">対象範囲・出典の日付</th><th scope="col">ライセンス</th></tr></thead><tbody>{inventory.coverage.sources.map((source,index)=><tr key={source.url+index}><th scope="row"><a href={source.url} target="_blank" rel="noopener noreferrer">{source.name}</a></th><td>{count(source.count)}件</td><td>{count(source.withHours)}件</td><td>{source.scope}<small>{dateLabel(source.sourceDate)||source.sourceDate}</small></td><td>{source.license}</td></tr>)}</tbody></table></div></>}
    <p className="national-attribution">地図由来の施設情報：© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a>。OpenStreetMapのデータは <a href="https://opendatacommons.org/licenses/odbl/1-0/" target="_blank" rel="noopener noreferrer">ODbL</a> に基づいて利用しています。施設ごとの出典を保持した<a href="/commons/sauna-inventory.json" download>収集データ（JSON）</a>を取得できます。ほかの収集元の利用条件は上表をご確認ください。</p>
    <details><summary>都道府県別の掲載件数</summary><div className="national-pref-grid">{prefectures.map(p=><button key={p} onClick={()=>{setPref(p);clearFilters();updateParam('pref',p);document.querySelector('.verified-controls')?.scrollIntoView({behavior:'smooth'});}}>{p}<span>{count(counts.get(p)||0)}件</span></button>)}</div></details>
   </section>
  </main>
 </div>;
}
