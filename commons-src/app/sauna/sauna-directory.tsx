import {apiFetch} from '@/aitech/auth';
'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,ArrowUpRight,Check,Clock,Flame,Info,MapPin,Phone,RefreshCw,Search} from 'lucide-react';
import {Select,SelectContent,SelectGroup,SelectItem,SelectLabel,SelectTrigger,SelectValue} from '@/components/ui/select';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {Empty,EmptyHeader,EmptyTitle,EmptyDescription} from '@/components/ui/empty';
import {prefectures,regions,type SaunaFacility,type SaunaSnapshot} from '@/lib/sauna-types';
import type {SaunaStatus} from '@/lib/sauna-status';
import s from './sauna.module.css';

type Filter='open'|'unknown'|'closed'|'all';
const dateFormat=new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'long',day:'numeric',weekday:'short'});
const clockFormat=new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const fullFormat=new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'});
const labels={open:'営業時間内',unknown:'要確認',closed:'営業時間外',all:'すべて'};
const normalize=(text:string)=>text.normalize('NFKC').toLocaleLowerCase('ja').replace(/\s+/g,' ').trim();
function hoursText(text:string) {
  if(!text) return '営業時間が未登録';
  if(text==='24/7') return '24時間営業';
  const names:Record<string,string>={Mo:'月',Tu:'火',We:'水',Th:'木',Fr:'金',Sa:'土',Su:'日',PH:'祝日',SH:'学校休暇',off:'休業',closed:'休業',open:'営業',unknown:'要確認'};
  return text.replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH|SH|off|closed|open|unknown)\b/g,t=>names[t]).replaceAll(';',' ／ ');
}
function safeUrl(text:string) {try{const u=new URL(text);return ['http:','https:'].includes(u.protocol)?u.href:''}catch{return ''}}
function accessText(facility:SaunaFacility) {
  const known:Record<string,string>={private:'一般利用は要確認',no:'一般利用不可',customers:'利用者向け',members:'会員向け',permissive:'利用条件を確認',yes:''};
  return known[facility.access]??(facility.access?'利用条件を確認':'');
}
function Facility({facility,status,now}:{facility:SaunaFacility;status:SaunaStatus;now:number}) {
  const map=`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(facility.name==='名称未登録'?facility.lat+','+facility.lon:facility.name+' '+(facility.address||facility.prefecture))}`;
  const phoneValue=facility.phone.split(/[;,]/)[0].replace(/[^+\d]/g,'');
  const phone=/^\+?\d{6,15}$/.test(phoneValue)?phoneValue:'';
  const website=safeUrl(facility.website);
  const access=accessText(facility);
  const next=status.nextChange;
  const sameDay=next&&fullFormat.format(next)===fullFormat.format(now);
  return <article className={s.facility} data-facility-id={facility.id}>
    <div className={s.facilityName}><span className={s.pref}>{facility.prefecture||'都道府県未確定'}{facility.kind&&` · ${facility.kind}`}</span><h3>{facility.name}</h3><p>{facility.address||`所在地の詳細は地図で確認（${facility.lat.toFixed(4)}, ${facility.lon.toFixed(4)}）`}</p>{access&&<span className={s.restriction}>{access}</span>}</div>
    <div className={s.facilityHours}><span className={`${s.badge} ${s[status.state]}`}>{status.state==='open'?<Check size={15}/>:<Clock size={15}/>} {labels[status.state]}</span><p>{hoursText(facility.hours)}</p>{next&&<span className={s.next}>{sameDay?'':dateFormat.format(next)+' '}{clockFormat.format(next)}{status.state==='open'?'まで（登録時間）':'から（登録時間）'}</span>}{status.reason&&<span className={s.next}>{status.reason}</span>}</div>
    <div className={s.facilityActions}><a href={map} target="_blank" rel="noopener noreferrer" className={s.mapLink}><MapPin size={16}/>地図</a>{website&&<a href={website} target="_blank" rel="noopener noreferrer">施設サイト<ArrowUpRight size={15}/></a>}{phone&&<a href={`tel:${phone}`} aria-label={`${facility.name}に電話`}><Phone size={15}/>電話</a>}<details className={s.details}><summary>情報の出典</summary><p>{facility.hoursScope==='sauna'?'サウナの登録営業時間です。':'施設の登録営業時間です。サウナ室の稼働時間・最終受付は異なる場合があります。'}</p>{facility.note&&<p>{facility.note}</p>}{facility.checkedOn&&<p>営業時間の確認日：{facility.checkedOn}</p>}<a href={facility.sourceUrl} target="_blank" rel="noopener noreferrer">OpenStreetMapの登録情報<ArrowUpRight size={14}/></a></details></div>
  </article>;
}

export default function Directory({snapshot,initialNow,initialStatuses}:{snapshot:SaunaSnapshot;initialNow:number;initialStatuses:SaunaStatus[]}) {
  const [pref,setPref]=useState('all');
  const [query,setQuery]=useState('');
  const [filter,setFilter]=useState<Filter>('open');
  const [now,setNow]=useState(initialNow);
  const [statuses,setStatuses]=useState(initialStatuses);
  const [syncing,setSyncing]=useState(false);
  const [error,setError]=useState('');
  const [stale,setStale]=useState(false);
  const lastSync=useRef(0);
  const busy=useRef(false);
  const revisionChanged=useRef(false);
  const clockOrigin=useRef({server:initialNow,local:0});
  const count=useMemo(()=>{
    const counts=new Map<string,number>();for(const f of snapshot.facilities)counts.set(f.prefecture,(counts.get(f.prefecture)||0)+1);return counts;
  },[snapshot]);
  async function refresh() {
    if(busy.current)return;
    busy.current=true;setSyncing(true);
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),15000);
    try {
      const response=await apiFetch('/api/sauna/status',{cache:'no-store',signal:controller.signal});
      if(!response.ok)throw new Error('request');
      const data=await response.json() as {now:number;revision:string;statuses:SaunaStatus[]};
      const ids=new Set(snapshot.facilities.map(f=>f.id));
      if(data.revision!==snapshot.fetchedAt){revisionChanged.current=true;setStale(true);setError('施設データが更新されました。ページを再読み込みしてください。');return;}
      if(!Number.isFinite(data.now)||!Array.isArray(data.statuses)||data.statuses.length!==ids.size||new Set(data.statuses.map((x:SaunaStatus)=>x.id)).size!==ids.size||data.statuses.some((x:SaunaStatus)=>!ids.has(x.id)||!['open','unknown','closed'].includes(x.state)))throw new Error('incomplete');
      clockOrigin.current={server:data.now,local:performance.now()};lastSync.current=performance.now();setNow(data.now);setStatuses(data.statuses);setStale(false);setError('');
    } catch {setError('営業判定を更新できませんでした。通信が戻ると再試行します。');}
    finally{clearTimeout(timeout);setSyncing(false);busy.current=false;}
  }
  useEffect(()=>{
    clockOrigin.current.local=performance.now();lastSync.current=performance.now();
    const params=new URLSearchParams(location.search);
    const requested=params.get('pref');if(requested&&(prefectures.includes(requested)||requested==='unknown'))setPref(requested);
    const requestedFilter=params.get('status');if(requestedFilter&&['open','unknown','closed','all'].includes(requestedFilter))setFilter(requestedFilter as Filter);
    setQuery(params.get('q')||'');
    void refresh();
    const timer=setInterval(()=>{setNow(clockOrigin.current.server+performance.now()-clockOrigin.current.local);if(performance.now()-lastSync.current>120000||revisionChanged.current)setStale(true);},10000);
    const poll=setInterval(()=>{if(document.visibilityState==='visible')void refresh();},60000);
    const visible=()=>{if(document.visibilityState==='visible')void refresh();};
    document.addEventListener('visibilitychange',visible);window.addEventListener('online',visible);
    return()=>{clearInterval(timer);clearInterval(poll);document.removeEventListener('visibilitychange',visible);window.removeEventListener('online',visible);};
  // The snapshot is immutable for a page visit; refresh validates its revision.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  const evaluated=useMemo(()=>{
    const byId=new Map(statuses.map(status=>[status.id,status]));
    return snapshot.facilities.map(facility=>({facility,status:stale?{id:facility.id,state:'unknown' as const,reason:'最新の営業判定を確認できません'}:byId.get(facility.id)||{id:facility.id,state:'unknown' as const}}));
  },[snapshot,statuses,stale]);
  const matches=useMemo(()=>{
    const terms=normalize(query).split(' ').filter(Boolean);
    return evaluated.filter(({facility:f})=>(pref==='all'||(pref==='unknown'?!f.prefecture:f.prefecture===pref))&&terms.every(term=>normalize(f.name+' '+f.address+' '+f.prefecture).includes(term)));
  },[evaluated,pref,query]);
  const totals=useMemo(()=>({all:matches.length,open:matches.filter(x=>x.status.state==='open').length,unknown:matches.filter(x=>x.status.state==='unknown').length,closed:matches.filter(x=>x.status.state==='closed').length}),[matches]);
  const shown=useMemo(()=>matches.filter(x=>filter==='all'||x.status.state===filter),[matches,filter]);
  const dataOld=now-Date.parse(snapshot.sourceDate)>30*86400000;
  function clear(){setPref('all');setQuery('');}
  function setPrefecture(value:string){setPref(value);const params=new URLSearchParams(location.search);value==='all'?params.delete('pref'):params.set('pref',value);history.replaceState(null,'',location.pathname+(params.size?'?'+params.toString():''));}
  return <div className={s.page}>
    <a className="skip-link" href="#sauna-results">施設一覧へ移動</a>
    <header className={s.header}><a href="/commons/" className={s.back}><ArrowLeft size={17}/>COMMONS</a><span className={s.headerTitle}><Flame size={19}/>全国のサウナ</span><a className={s.aitech} href="/">AITECH</a></header>
    <main className={s.main}>
      <div className={s.titleRow}><div><p className={s.eyebrow}>全国 · 47都道府県から探す</p><h1>いま開いている<br className={s.mobileBreak}/>サウナを探す。</h1><p className={s.lead}>登録営業時間を、日本時間で判定。</p></div><div className={s.clock}><span><Clock size={16}/>{dateFormat.format(now)}</span><time dateTime={new Date(now).toISOString()}>{clockFormat.format(now)}</time><small>日本時間 / 1分ごとに判定</small></div></div>
      <div className={s.coverage}><Info size={18}/><div><p><strong>掲載 {snapshot.facilities.length.toLocaleString()}件 · 取得データを件数制限なしで表示</strong></p><p>全国の全施設を網羅する一覧ではありません。未登録施設・臨時休業・サウナ室の休止・最終受付は反映しきれません。</p></div><a href="#sauna-data">収集範囲を見る</a></div>
      {dataOld&&<p className={s.dataAge}>データ基準日：{fullFormat.format(Date.parse(snapshot.sourceDate))}。現在の施設情報と異なる場合があります。お出かけ前に施設サイトや電話でご確認ください。</p>}
      <section className={s.controls} aria-label="サウナを絞り込み">
        <div className={s.search}><Search size={19}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="施設名・市区町村で検索" aria-label="施設名・市区町村で検索"/></div>
        <Select value={pref} onValueChange={setPrefecture}><SelectTrigger className={s.select} aria-label="都道府県を選択"><MapPin size={18}/><SelectValue/></SelectTrigger><SelectContent position="popper"><SelectItem value="all">全国すべて（{snapshot.facilities.length}件）</SelectItem>{regions.map(region=><SelectGroup key={region.name}><SelectLabel>{region.name}</SelectLabel>{prefectures.slice(region.start,region.end).map(name=><SelectItem key={name} value={name}>{name}（{count.get(name)||0}件）</SelectItem>)}</SelectGroup>)}{count.get('')&&<SelectItem value="unknown">都道府県未確定（{count.get('')}件）</SelectItem>}</SelectContent></Select>
        <button className={s.refresh} onClick={()=>void refresh()} disabled={syncing}><RefreshCw size={16} className={syncing?s.spin:''}/>{syncing?'判定中':'判定を更新'}</button>
      </section>
      {error&&<div className={s.error} role="status"><p>{error}{stale&&!revisionChanged.current&&'前回の判定から2分以上経過したため、全施設を「要確認」に切り替えています。'}</p>{revisionChanged.current&&<button onClick={()=>location.reload()}>再読み込み</button>}</div>}
      <Tabs value={filter} onValueChange={value=>setFilter(value as Filter)}>
        <TabsList className={s.tabs} aria-label="営業状況"><TabsTrigger value="open">営業時間内 <b>{totals.open.toLocaleString()}</b></TabsTrigger><TabsTrigger value="unknown">要確認 <b>{totals.unknown.toLocaleString()}</b></TabsTrigger><TabsTrigger value="closed">営業時間外 <b>{totals.closed.toLocaleString()}</b></TabsTrigger><TabsTrigger value="all">すべて <b>{totals.all.toLocaleString()}</b></TabsTrigger></TabsList>
        <div className={s.resultHeader}><h2>{pref==='all'?'全国':pref==='unknown'?'都道府県未確定':pref} <span>{shown.length.toLocaleString()}<small>件を全件表示</small></span></h2>{(query||pref!=='all')&&<button onClick={clear}>絞り込みを解除</button>}</div>
        <p className={s.resultNote}>{filter==='open'?'営業時間内の施設を表示しています。入館・サウナ利用を保証する情報ではありません。':filter==='unknown'?'営業時間が未登録の施設も、一覧から除外していません。':filter==='all'?'営業時間が不明な施設・営業時間外の施設を含め、取得した全施設を表示しています。':'登録営業時間では、いま営業時間外の施設です。'}</p>
        <TabsContent value={filter} className={s.results} id="sauna-results" tabIndex={-1}>
          {!!shown.length&&<div className={s.tableHead} aria-hidden="true"><span>施設・所在地</span><span>営業状況・登録営業時間</span><span>施設情報</span></div>}
          {shown.map(({facility,status})=><Facility key={facility.id} facility={facility} status={status} now={now}/>)}
          {!shown.length&&<Empty className={s.empty}><EmptyHeader><Flame size={30}/><EmptyTitle>条件に合う掲載施設はありません</EmptyTitle><EmptyDescription>{!totals.all?'この条件の施設データを取得できていません。施設が存在しないという意味ではありません。':'「要確認」や「すべて」に切り替えると、ほかの掲載施設を確認できます。'}</EmptyDescription></EmptyHeader><div className={s.emptyActions}>{filter!=='all'&&<button onClick={()=>setFilter('all')}>すべての営業状況を見る</button>}{(pref!=='all'||query)&&<button onClick={clear}>絞り込みを解除</button>}</div></Empty>}
        </TabsContent>
        {!!shown.length&&<p className={s.end}>以上、条件に合う {shown.length.toLocaleString()}件をすべて表示しました。</p>}
      </Tabs>
      <footer className={s.footer} id="sauna-data"><h2>収集範囲と営業判定</h2><p>OpenStreetMapでサウナとして登録された地点と、サウナ設備の登録がある施設を収集。日本の行政界と所在地から都道府県を分類しています。施設の登録状況は地域によって大きく異なり、掲載件数は実際の施設数を表しません。</p><dl><div><dt>掲載件数</dt><dd>{snapshot.facilities.length.toLocaleString()}件 / {new Set(snapshot.facilities.map(f=>f.prefecture).filter(Boolean)).size}都道府県にデータあり</dd></div><div><dt>データ基準日</dt><dd>{fullFormat.format(Date.parse(snapshot.sourceDate))}</dd></div><div><dt>取得日</dt><dd>{fullFormat.format(Date.parse(snapshot.fetchedAt))}</dd></div><div><dt>更新の対象</dt><dd>営業判定は1分ごと。施設情報は上記取得日の保存データです。</dd></div></dl><p>夜間の営業・昼休み・定休日・登録された祝日ルールを判定します。判定できない記載は「要確認」に残します。施設全体の営業時間しか登録されていない場合は、その時間を使用します。予約枠・入館受付・混雑・男女入替・臨時休止は施設にご確認ください。</p><details><summary>都道府県ごとの掲載件数</summary><div className={s.prefGrid}>{prefectures.map(name=><button key={name} onClick={()=>{setPrefecture(name);setFilter('all');document.querySelector('main')?.scrollIntoView({behavior:'smooth'});}}><span>{name}</span><b>{count.get(name)||0}件</b></button>)}</div><p>0件は未収集を意味し、その県にサウナがないという意味ではありません。</p></details><p className={s.attribution}>© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap contributors</a> · <a href={snapshot.licenseUrl} target="_blank" rel="noopener noreferrer">{snapshot.license}</a> · <a href="/commons/sauna-data.json" download>掲載データ</a></p><a className={s.footerBack} href="/commons/"><ArrowLeft size={16}/>COMMONSに戻る</a></footer>
    </main>
  </div>;
}
