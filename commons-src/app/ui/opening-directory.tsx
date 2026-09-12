import {apiFetch} from '@/aitech/auth';
'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,ArrowUpRight,CalendarDays,MapPin,RefreshCw,Search,Soup,Flame,Info,Clock,ChevronDown} from 'lucide-react';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Skeleton} from '@/components/ui/skeleton';
import {addDays,dateLabel,dayMs,japanDay,monthsInRange,inWindow,prefectures,regionMatches,windowFor,type Opening,type OpeningKind,type OpeningSnapshot} from '@/lib/openings';
import './opening-directory.css';

const checkedLabel=(value:string)=>new Intl.DateTimeFormat('ja-JP',{month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Tokyo'}).format(new Date(value));
function OpeningRow({item,today,now}:{item:Opening;today:string;now:number}){
  const days=Math.round((Date.parse(item.openingDate)-Date.parse(today))/dayMs);
  const stale=now-Date.parse(item.checkedAt)>3*dayMs;
  return <article className="opening-row">
    <div className="opening-date"><span>{Number(item.openingDate.slice(5,7))}月</span><strong>{Number(item.openingDate.slice(8))}</strong><span>{dateLabel(item.openingDate).split('(')[1]?.replace(')','')??''}</span></div>
    <div className="opening-body"><div className="opening-tags"><span className="opening-countdown">{days<0?`${-days}日前の開業情報`:days===0?'本日オープン予定':days===1?'明日オープン予定':`あと${days}日`}</span><span>{item.prefecture}</span><span>{item.genre}</span></div>
      <h2><a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.name}<ArrowUpRight size={19}/></a></h2>
      <p className="opening-address"><MapPin size={16}/>{item.address||item.prefecture+' · 詳細な所在地は出典でご確認ください'}</p>
      {item.note&&<p className="opening-note">{item.note}</p>}
      <div className="opening-provenance"><span>{item.official?'公式・運営会社の告知':'メディアの開店情報'}</span><span>{item.reviewed?'開店日確認済み':'告知から日付を自動抽出'}</span><time dateTime={item.checkedAt}>確認 {checkedLabel(item.checkedAt)}</time></div>
      {stale&&<p className="opening-stale"><Clock size={15}/>最終確認から3日以上経過しています。出典で最新情報をご確認ください。</p>}
    </div>
    <div className="opening-links"><a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">出典を開く<ArrowUpRight size={16}/></a><a href={'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(item.name+' '+item.prefecture+' '+item.address)} target="_blank" rel="noopener noreferrer">地図<MapPin size={15}/></a><span>{item.sourceName}</span></div>
  </article>;
}

export default function OpeningDirectory({kind,initial,serverNow}:{kind:OpeningKind;initial:OpeningSnapshot;serverNow:string}){
  const [snapshot,setSnapshot]=useState(initial),[now,setNow]=useState(Date.parse(serverNow)),[region,setRegion]=useState('local'),[query,setQuery]=useState(''),[selectedDay,setSelectedDay]=useState(''),[busy,setBusy]=useState(true),[error,setError]=useState('');
  const inFlight=useRef(false),clock=useRef({server:Date.parse(serverNow),local:0});
  const title=kind==='ramen'?'ラーメン屋':'サウナ',Icon=kind==='ramen'?Soup:Flame;
  const range=windowFor(new Date(now),kind),today=japanDay(new Date(now)),isSauna=kind==='sauna';
  const listingLabel=isSauna?'開業情報':'開店予定';
  const refresh=useCallback(async()=>{
    if(inFlight.current)return;inFlight.current=true;setBusy(true);setError('');
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),45000);
    try{const response=await apiFetch('/api/openings',{cache:'no-store',signal:controller.signal});if(!response.ok)throw new Error();const data=await response.json() as OpeningSnapshot&{serverNow:string};if(!Array.isArray(data.records)||!Array.isArray(data.sources)||!Number.isFinite(Date.parse(data.serverNow)))throw new Error();setSnapshot(data);clock.current={server:Date.parse(data.serverNow),local:Date.now()};setNow(clock.current.server)}
    catch{setError('最新情報を取得できませんでした。最後に確認できた情報を表示しています。')}
    finally{clearTimeout(timeout);setBusy(false);inFlight.current=false}
  },[]);
  useEffect(()=>{
    clock.current.local=Date.now();const params=new URLSearchParams(window.location.search),r=params.get('region');if(r==='all'||r==='local'||prefectures.includes(r??''))setRegion(r!);
    void refresh();
    const tick=()=>{setNow(clock.current.server+Date.now()-clock.current.local)};
    const timer=setInterval(tick,30000),update=setInterval(()=>void refresh(),15*60*1000);
    const visible=()=>{if(document.visibilityState==='visible'){tick();void refresh()}};document.addEventListener('visibilitychange',visible);
    return ()=>{clearInterval(timer);clearInterval(update);document.removeEventListener('visibilitychange',visible)};
  },[refresh]);
  useEffect(()=>{if(!snapshot.refreshing)return;const timer=setTimeout(()=>void refresh(),10000);return ()=>clearTimeout(timer)},[snapshot.refreshing,snapshot.updatedAt,refresh,busy]);
  useEffect(()=>{if(selectedDay&&(selectedDay<range.start.slice(0,isSauna?7:10)||selectedDay>range.end.slice(0,isSauna?7:10)))setSelectedDay('')},[range.start,range.end,selectedDay,isSauna]);
  const selectRegion=(value:string)=>{setRegion(value);setSelectedDay('');const url=new URL(window.location.href);url.searchParams.set('region',value);window.history.replaceState(null,'',url)};
  const all=useMemo(()=>snapshot.records.filter(r=>r.kind===kind&&inWindow(r,range.start,range.end)),[snapshot.records,kind,range.start,range.end]);
  const filtered=useMemo(()=>all.filter(r=>regionMatches(r,region)&&[r.name,r.prefecture,r.address,r.genre].join(' ').toLocaleLowerCase('ja').includes(query.trim().toLocaleLowerCase('ja'))),[all,region,query]);
  const visible=filtered.filter(r=>!selectedDay||r.openingDate.startsWith(selectedDay)),days=isSauna?monthsInRange(range.start,range.end):Array.from({length:15},(_,i)=>addDays(range.start,i));
  const failed=snapshot.sources.filter(s=>!s.ok).length;
  const oldFeeds=snapshot.sources.filter(s=>s.latestPublishedAt&&now-Date.parse(s.latestPublishedAt)>3*dayMs).length;
  const uncertainty=snapshot.records.filter(r=>r.kind===kind&&r.status==='uncertain'&&r.openingDate>=range.start&&r.openingDate<=range.end&&regionMatches(r,region));
  const counterpart=kind==='ramen'?'sauna':'ramen';
  return <div className={'opening-app opening-'+kind}>
    <a className="skip-link" href="#opening-results">一覧へ移動</a>
    <header className="opening-header"><a href="/commons/" className="opening-back"><ArrowLeft size={18}/>COMMONS</a><span>NEW OPENINGS</span><a href={'/openings/'+counterpart+'?region='+encodeURIComponent(region)}>{kind==='ramen'?'サウナ版へ':'ラーメン屋版へ'}<ArrowUpRight size={16}/></a></header>
    <main className="opening-main">
      <div className="opening-heading"><div><div className="opening-kicker"><Icon size={19}/><span>OPENING CALENDAR</span></div><h1>{isSauna?'前後2か月の':'これから15日の'}<span>{title}</span></h1><p><CalendarDays size={17}/><strong>{dateLabel(range.start)} — {dateLabel(range.end)}</strong><span>{isSauna?'今日の2か月前から2か月後 · 日本時間':'今日を含む15日間 · 日本時間'}</span></p></div><div className="opening-total"><strong>{filtered.length}</strong><span>件の{listingLabel}</span></div></div>
      <nav aria-label="開店情報の種類" className="opening-kind-nav"><a href={'/openings/ramen?region='+encodeURIComponent(region)} aria-current={kind==='ramen'?'page':undefined}><Soup size={18}/>ラーメン屋</a><a href={'/openings/sauna?region='+encodeURIComponent(region)} aria-current={kind==='sauna'?'page':undefined}><Flame size={18}/>サウナ</a></nav>
      <section aria-label="絞り込み" className="opening-controls"><div className="opening-region"><label id="opening-region-label">地域</label><Select value={region} onValueChange={selectRegion}><SelectTrigger aria-labelledby="opening-region-label"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="local">岐阜・愛知</SelectItem><SelectItem value="all">全国</SelectItem>{prefectures.map(p=><SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div><div className="opening-search"><label htmlFor="opening-query">店舗名・エリア</label><div><Search size={18}/><Input id="opening-query" value={query} onChange={e=>setQuery(e.target.value)} placeholder={kind==='ramen'?'店名、名古屋、つけ麺…':'施設名、サウナ、ホテル…'}/></div></div><Button variant="outline" className="opening-refresh" onClick={()=>void refresh()} disabled={busy}><RefreshCw size={17} className={busy?'opening-spin':''}/>{busy?'確認中':'更新'}</Button></section>
      <div className="opening-updated" role="status" aria-live="polite">{busy?'公開されている開店告知を確認しています…':snapshot.updatedAt?'情報確認 '+checkedLabel(snapshot.updatedAt)+' · 掲載は開店日順':'確認済みの開業情報を表示しています'}</div>
      {(error||snapshot.storageError||failed>0)&&<p role="alert" className="opening-warning"><Info size={18}/>{error||(snapshot.storageError?'情報の更新を利用できません。最後に確認できた予定を表示しています。':`${failed}件の情報源に接続できませんでした。取得済みの情報を表示しています。`)}</p>}
      <div className={'opening-days'+(isSauna?' opening-months':'')} aria-label={isSauna?'開業月で絞り込み':'開店日で絞り込み'}><button aria-pressed={!selectedDay} onClick={()=>setSelectedDay('')} className={!selectedDay?'is-selected':''}><span>期間内</span><strong>すべて</strong><small>{filtered.length}件</small></button>{days.map((day,i)=>{const count=filtered.filter(r=>r.openingDate.startsWith(day)).length;return <button key={day} className={(selectedDay===day?'is-selected ':'')+(count?'has-openings':'')} aria-pressed={selectedDay===day} aria-label={(isSauna?day.replace('-','年')+'月':dateLabel(day))+' '+listingLabel+count+'件'} onClick={()=>setSelectedDay(day)}><span>{isSauna?day.slice(0,4)+'年':i===0?'今日':dateLabel(day).split('(')[1]?.replace(')','')}</span><strong>{isSauna?Number(day.slice(5))+'月':Number(day.slice(8))}</strong><small>{count?count+'件':'—'}</small></button>})}</div>
      <section id="opening-results" tabIndex={-1} aria-label={listingLabel+'の一覧'}><div className="opening-results-heading"><h2>{selectedDay?(isSauna?selectedDay.replace('-','年')+'月':dateLabel(selectedDay))+'の'+listingLabel:listingLabel+'一覧'}<span>{visible.length}件</span></h2>{selectedDay&&<button onClick={()=>setSelectedDay('')}>日付の絞り込みを解除</button>}</div>
        {visible.length?<div className="opening-list">{visible.map(item=><OpeningRow key={item.id} item={item} today={today} now={now}/>)}</div>:busy?<div className="opening-loading" aria-label="開店情報を読み込み中"><Skeleton className="h-24 w-full"/><Skeleton className="h-24 w-full"/></div>:<div className="opening-empty"><CalendarDays size={34}/><h3>この条件の{listingLabel}は、まだ確認できていません</h3><p>{uncertainty.length?`${uncertainty.length}件の告知は、開店日を再確認する必要があるため一覧から外しています。`:'開店日が明記された告知を掲載します。情報源に未掲載の施設は表示されません。'}</p><div>{region!=='all'&&<Button onClick={()=>selectRegion('all')}>全国の{listingLabel}を見る{all.length>0?'（'+all.length+'件）':''}</Button>}{(query||selectedDay)&&<Button variant="outline" onClick={()=>{setQuery('');setSelectedDay('')}}>絞り込みを解除</Button>}</div></div>}
      </section>
      <aside className="opening-method"><details><summary><Info size={18}/><span>掲載範囲・情報源・更新について</span><ChevronDown size={17}/></summary><div className="opening-method-body"><p>{isSauna?'日本時間の今日の2か月前から2か月後まで、両端の日付を含む開業情報です。暦の月単位で計算し、同じ日がない月は月末を境界とします。過去の告知もさかのぼって収集します。':'日本時間の今日から14日後まで、合計15日間にオープン予定のラーメン店です。つけ麺・まぜそば・油そばの専門店も含みます。'}アクセス時に対象期間を切り替え、前回の情報取得から6時間以上経っている場合は告知を再取得します。日付は告知に基づき、現在の営業状況を保証するものではありません。訪問前に出典もご確認ください。</p><p>運営会社の告知と公開ニュースを対象にしています。全国の全施設を網羅するものではありません。日付が不明・複数の日付を特定できない告知、イベント、期間限定出店は自動掲載の対象外です。サウナ版には既存施設へのサウナ新設を含みます。</p>{oldFeeds>0&&<p>{oldFeeds}件の配信元は、最新記事の掲載から3日以上経過しています。</p>}<ul>{snapshot.sources.length?snapshot.sources.map(s=><li key={s.url}><a href={s.url.replace(/\/feed\/$/,'/')} target="_blank" rel="noopener noreferrer">{s.name}<ArrowUpRight size={14}/></a><span>{s.ok?'取得済み':'取得できませんでした'}</span></li>):<li>初回の情報取得後に、取得元と取得状況を表示します。</li>}</ul></div></details></aside>
      <footer className="opening-footer"><a href="/commons/">COMMONS</a><span>開店告知のある、新しい場所へ。</span></footer>
    </main>
  </div>;
}
