import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,ArrowUpRight,Clock3,MapPin,RefreshCw,Search,Phone,CheckCircle2} from 'lucide-react';
import {localStatus,readableHours,type LocalStore} from '../lib/local-hours';
import {prefectures} from '../lib/sauna-types';
import {realtimeFetch} from './realtime-api';
import type {SourceCheck} from '../lib/realtime-evidence';
import './live-directory.css';
type Store=LocalStore&{kinds:string[];expiresAt:string;method:string;lastEntry?:number;lastEntryBeforeClose?:number};
type Snapshot={stores:Store[];sources:SourceCheck[];serverNow:number;updatedAt:string|null;refreshing?:boolean;storageError?:boolean;coverage:{targeted:number;verified:number;withheld:number;sitesConfigured:number;sitesFetched:number}};
const names:Record<string,string>={ramen:'ラーメン',sauna:'全国のサウナ',saunas:'サウナ',sento:'銭湯',fishmongers:'魚屋',supermarkets:'スーパー'};
const routes=[['supermarkets','/commons/local/supermarkets/'],['saunas','/commons/local/saunas/'],['sento','/commons/local/sento/'],['fishmongers','/commons/local/fishmongers/'],['ramen','/commons/ramen/'],['sauna','/commons/sauna/']];
const date=(n:number)=>new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(n);
const normalize=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/\s/g,'');
export default function LiveDirectory({kind}:{kind:string}){
 const [data,setData]=useState<Snapshot|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [query,setQuery]=useState(''),[pref,setPref]=useState('all'),[city,setCity]=useState('all'),[filter,setFilter]=useState('open'),[now,setNow]=useState(Date.now());
 const request=useRef<AbortController|null>(null),clock=useRef<{server:number;monotonic:number}|null>(null);
 async function refresh(){
  request.current?.abort();const controller=new AbortController();request.current=controller;const timeout=setTimeout(()=>controller.abort(),20000);setBusy(true);setError('');
  try{const r=await realtimeFetch('/directory',controller.signal);if(!r.ok)throw new Error();const d=await r.json() as Snapshot;if(!Array.isArray(d.stores)||!Array.isArray(d.sources)||!Number.isFinite(d.serverNow)||!d.coverage)throw new Error();if(request.current!==controller)return;setData(d);clock.current={server:d.serverNow,monotonic:performance.now()};setNow(d.serverNow);}
  catch{if(request.current===controller)setError('公式情報を読み込めませんでした。再取得してください。')}
  finally{clearTimeout(timeout);if(request.current===controller)setBusy(false)}
 }
 useEffect(()=>{
  document.title=names[kind]+'の公式営業時間 | コモンズ';
  const params=new URLSearchParams(location.search);if(prefectures.includes(params.get('pref')||''))setPref(params.get('pref')!);setQuery(params.get('q')||'');
  void refresh();const tick=setInterval(()=>{if(clock.current)setNow(clock.current.server+performance.now()-clock.current.monotonic)},15000),poll=setInterval(()=>{if(!document.hidden)void refresh()},60000);
  const visible=()=>{if(!document.hidden)void refresh()};document.addEventListener('visibilitychange',visible);
  return()=>{request.current?.abort();request.current=null;clearInterval(tick);clearInterval(poll);document.removeEventListener('visibilitychange',visible)};
 },[kind]);
 const candidates=useMemo(()=>(data?.stores||[]).filter(s=>s.kinds.includes(kind)||(kind==='sauna'&&s.kinds.includes('saunas'))).filter(s=>kind==='sauna'||kind==='ramen'||['岐阜県','愛知県'].includes(s.prefecture)),[data,kind]);
 const verified=useMemo(()=>candidates.filter(s=>Date.parse(s.expiresAt)>now&&Date.parse(s.checkedAt)<=now).map(store=>{
  const status=localStatus(store,now);let state:string=status.state;
  const minute=new Date(now+9*3600000).getUTCHours()*60+new Date(now+9*3600000).getUTCMinutes();
  if(state==='open'&&((store.lastEntry!==undefined&&minute>=store.lastEntry)||(store.lastEntryBeforeClose!==undefined&&status.nextChange!==undefined&&status.nextChange-now<=store.lastEntryBeforeClose*60000)))state='reception-ended';
  return {store,state};
 }).filter(x=>x.state!=='unknown'),[candidates,now]);
 const matched=verified.filter(({store:s})=>(pref==='all'||s.prefecture===pref)&&(city==='all'||s.city===city)&&normalize(s.name+' '+s.address).includes(normalize(query)));
 const shown=matched.filter(x=>filter==='all'||(filter==='closed'?x.state!=='open':x.state==='open'));
 const sources=useMemo(()=>{const groups=new Map<string,SourceCheck[]>();for(const s of data?.sources||[])groups.set(s.site,[...(groups.get(s.site)||[]),s]);return [...groups].sort(([a],[b])=>a.localeCompare(b));},[data]);
 const cities=[...new Set(candidates.filter(s=>pref==='all'||s.prefecture===pref).map(s=>s.city).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'));
 return <div className="verified-directory">
  <header className="verified-top"><a href="/commons/"><ArrowLeft size={17}/>COMMONS</a><a href="/">AITECH</a></header>
  <main>
   <nav className="verified-nav" aria-label="店舗の種類">{routes.map(([k,url])=><a key={k} href={url} aria-current={kind===k?'page':undefined}>{names[k]}</a>)}</nav>
   <div className="verified-title"><div><p>公式ページの営業案内を照合</p><h1>{names[kind]}の営業時間</h1></div><div className="verified-clock"><Clock3 size={20}/><time>{date(now)}</time><small>日本時間</small></div></div>
   <p className="verified-intro">店舗ごとに公式本文を再取得。曜日・深夜営業・休館日を確認できた情報を掲載します。表示は公表された営業時間による判定です。</p>
   <section className="verified-source-strip" aria-label="収集状況"><CheckCircle2 size={22}/><div><b>{data?data.coverage.sitesFetched:'—'}サイトから取得</b><span>対象 {data?.coverage.sitesConfigured??'—'}サイト · 最終収集 {data?.updatedAt?date(Date.parse(data.updatedAt)):'取得中'}{data?.refreshing?' · 更新処理中':''}</span></div><a href="#verified-sources">取得元・確認時刻</a></section>
   <section className="verified-controls" aria-label="店舗を絞り込む"><label className="verified-search"><Search size={18}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="店名・住所" aria-label="店名・住所を検索"/></label><label><span>都道府県</span><select value={pref} onChange={e=>{setPref(e.target.value);setCity('all')}}><option value="all">{kind==='sauna'?'全国':kind==='ramen'?'岐阜県すべて':'岐阜・愛知すべて'}</option>{(kind==='sauna'?prefectures:kind==='ramen'?['岐阜県']:['岐阜県','愛知県']).map(p=><option key={p}>{p}</option>)}</select></label><label><span>市町村</span><select value={city} onChange={e=>setCity(e.target.value)}><option value="all">すべて</option>{cities.map(c=><option key={c}>{c}</option>)}</select></label><button onClick={()=>void refresh()} disabled={busy}><RefreshCw size={17}/>{busy?'取得中':'更新'}</button></section>
   <div className="verified-tabs" role="group" aria-label="営業時間で絞り込み">{[['open','公式営業時間内'],['closed','時間外・受付終了'],['all','確認できた全件']].map(([key,label])=><button key={key} aria-pressed={filter===key} onClick={()=>setFilter(key)}>{label}<b>{matched.filter(x=>key==='all'||(key==='open'?x.state==='open':x.state!=='open')).length}</b></button>)}</div>
   {error&&<p className="verified-error" role="alert">{error} 確認期限を過ぎた情報は表示しません。</p>}
   {data?.storageError&&<p className="verified-error" role="alert">更新情報を保存できませんでした。期限内の確認結果だけを表示しています。</p>}
   <div className="verified-result-head"><h2>{shown.length}件</h2><span>各店舗に出典・確認時刻を記載</span></div>
   <section className="verified-list" aria-label="確認できた施設一覧">{shown.map(({store:s,state})=><article key={s.id}><div><p className="verified-place">{s.prefecture} {s.city}</p><h3>{s.name}</h3><p>{s.address}</p>{s.note&&<p className="verified-note">{s.note}</p>}</div><div className="verified-hours"><span className={'verified-badge '+(state==='open'?'is-open':'')}>{state==='open'?'公式営業時間内':state==='reception-ended'?'受付終了':'公式営業時間外'}</span><strong>{s.hoursText||readableHours(s.hours)}</strong>{s.scope==='facility'&&<small>施設の入館・浴場時間</small>}{s.lastEntry!==undefined&&<small>最終受付 {Math.floor(s.lastEntry/60)}:{String(s.lastEntry%60).padStart(2,'0')}</small>}{s.lastEntryBeforeClose!==undefined&&<small>最終受付は終了の{s.lastEntryBeforeClose}分前</small>}<small>本文確認 {date(Date.parse(s.checkedAt))}</small></div><div className="verified-actions"><a href={s.sourceUrl} target="_blank" rel="noopener noreferrer">公式の営業案内<ArrowUpRight size={16}/></a><a href={'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(s.name+' '+s.address)} target="_blank" rel="noopener noreferrer"><MapPin size={16}/>地図</a>{s.phone&&<a href={'tel:'+s.phone.replace(/[^+\d]/g,'')}><Phone size={16}/>電話</a>}</div></article>)}</section>
   {!shown.length&&<div className="verified-empty"><Clock3 size={28}/><h2>{busy?'公式情報を取得しています':'この条件で掲載できる情報はありません'}</h2><p>{busy?'店舗ごとの確認結果を読み込んでいます。':'未確認や期限切れの情報を営業中として表示しません。絞り込みを変更して確認できます。'}</p>{filter!=='all'&&<button onClick={()=>setFilter('all')}>確認できた全件を表示</button>}</div>}
   <section className="verified-method"><h2>掲載する情報の基準</h2><p>施設名と営業時間を公式本文で照合し、取得後2時間以内の情報を掲載します。5分ごとに収集を進め、画面は1分ごとに再取得します。ページに書かれていない臨時休業や売り切れを「営業中確認済み」とは表示しません。</p><p>収集対象 {data?.coverage.targeted??'—'}施設中、営業時間を確定できたのは {data?.coverage.verified??'—'}施設です。掲載できない {data?.coverage.withheld??'—'}施設は、取得・営業時間の照合を継続します。全国・地域の全施設を網羅したものではありません。</p></section>
   <section className="verified-method" id="verified-sources"><h2>収集元と取得結果</h2><p>同じ運営ドメインの別ページは、1サイトとして数えています。</p><div className="verified-source-list">{sources.map(([site,checks])=><details key={site}><summary><b>{site}</b><span>取得 {checks.filter(x=>x.ok).length}/{checks.length}ページ · 営業時間照合 {checks.reduce((n,x)=>n+x.records,0)}件</span></summary>{checks.map(s=><p key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer">公式ページ ↗</a> {date(Date.parse(s.checkedAt))} · {s.ok?'本文取得完了':s.reason||'本文取得失敗'}</p>)}</details>)}</div></section>
  </main>
 </div>;
}
