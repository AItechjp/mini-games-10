import {apiFetch} from '@/aitech/api';
'use client';

import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,ArrowRight,ArrowUpRight,Bitcoin,Check,ChevronLeft,ChevronRight,Copy,ExternalLink,GitBranch,Info,LoaderCircle,Search,ZoomIn,ZoomOut,RotateCcw,Wallet} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Tabs,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {Empty,EmptyHeader,EmptyTitle,EmptyDescription} from '@/components/ui/empty';
import {Skeleton} from '@/components/ui/skeleton';
import {Brand} from '@/app/ui/common';
import {btc,EXAMPLE_TX,outputKind,parseTarget,relation,sampleNext,sampleTx,shortId,type AddressInfo,type Spend,type Transaction} from '@/lib/bitcoin';

type Envelope<T>={data:T;source:string;fetchedAt:string};
type Visit={tx:Transaction;source:string;fetchedAt:string;via?:string};
type OutputStatus={data?:Spend;error?:string;source?:string;time?:string};
const PAGE_SIZE=6;
const demoVisit:Visit={tx:sampleTx,source:'サンプル',fetchedAt:''};
const date=(value?:number)=>value?new Date(value*1000).toLocaleString('ja-JP'):'未確定';
const initialError='ビットコインのアドレス（1・3・bc1から始まる文字列）または64桁の取引IDを入力してください。';

async function requestData<T>(kind:string,id:string,signal?:AbortSignal,extra:Record<string,string>={}):Promise<Envelope<T>>{
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),22000);
  const cancel=()=>controller.abort();
  if(signal?.aborted)controller.abort();
  signal?.addEventListener('abort',cancel,{once:true});
  try{
    const response=await apiFetch('/api/bitcoin?'+new URLSearchParams({kind,id,...extra}),{signal:controller.signal,cache:'no-store'});
    let body:Partial<Envelope<T>>&{error?:string};try{body=await response.json() as typeof body;}catch{throw new Error('応答を受け取れませんでした。再検索してください。');}
    if(!body||typeof body!=='object')throw new Error('応答を受け取れませんでした。再検索してください。');
    if(!response.ok)throw new Error(body.error??'データを取得できませんでした。');
    if(!('data' in body)||typeof body.source!=='string'||typeof body.fetchedAt!=='string')throw new Error('データの形式を確認できませんでした。');
    return body as Envelope<T>;
  }catch(e){
    if(signal?.aborted)throw e;
    if(controller.signal.aborted)throw new Error('通信に時間がかかっています。もう一度お試しください。');
    throw e instanceof Error?e:new Error('通信状態を確認してください。');
  }finally{clearTimeout(timeout);signal?.removeEventListener('abort',cancel);}
}

function Graph({tx,selected,onSelect,onPrevious,inputPage,setInputPage,outputPage,setOutputPage,zoom,demo,busy}:{
  tx:Transaction;selected:number;onSelect:(index:number)=>void;onPrevious:(id:string,index:number)=>void;
  inputPage:number;setInputPage:(n:number)=>void;outputPage:number;setOutputPage:(n:number)=>void;zoom:number;demo:boolean;busy:boolean;
}){
  const inputs=tx.vin.slice(inputPage*PAGE_SIZE,(inputPage+1)*PAGE_SIZE);
  const outputs=tx.vout.slice(outputPage*PAGE_SIZE,(outputPage+1)*PAGE_SIZE);
  const height=Math.max(350,Math.max(inputs.length,outputs.length)*120+86),middle=height/2+12;
  const y=(index:number,count:number)=>86+(height-112)/Math.max(count,1)*(index+.5);
  const totalInput=tx.vin.reduce((sum,i)=>sum+(i.prevout?.value??0),0);
  const totalOutput=tx.vout.reduce((sum,o)=>sum+o.value,0);
  const pagination=(label:string,count:number,page:number,setPage:(n:number)=>void)=><div className="btc-graph-page"><span>{label} {count?`${page*PAGE_SIZE+1}–${Math.min((page+1)*PAGE_SIZE,count)} / ${count}`:'0件'}</span>{count>PAGE_SIZE&&<><Button variant="ghost" size="icon" aria-label={label+'を前の6件に'} disabled={!page||busy} onClick={()=>setPage(page-1)}><ChevronLeft/></Button><Button variant="ghost" size="icon" aria-label={label+'を次の6件に'} disabled={(page+1)*PAGE_SIZE>=count||busy} onClick={()=>setPage(page+1)}><ChevronRight/></Button></>}</div>;
  return <>
    <div className="btc-graph-paging">{pagination('入力',tx.vin.length,inputPage,setInputPage)}{(tx.vin.length>PAGE_SIZE||tx.vout.length>PAGE_SIZE)&&<span className="btc-subtle">一部を表示中</span>}{pagination('出力',tx.vout.length,outputPage,setOutputPage)}</div>
    <div className="btc-graph-scroll" tabIndex={0} role="region" aria-label="送金の流れ。左右にスクロールできます。送金先を選ぶと下または右に詳細を表示します。">
      <div style={{width:1000*zoom,height:height*zoom}}><div className="btc-graph-stage" style={{width:1000,height,transform:`scale(${zoom})`}}>
        <div className="btc-column-label" style={{left:28}}>入力 <span>使われたビットコイン</span></div><div className="btc-column-label" style={{left:387}}>取引</div><div className="btc-column-label" style={{left:694}}>出力 <span>送金先候補</span></div>
        <svg className="btc-edges" width="1000" height={height} aria-hidden="true">
          <defs><marker id="btc-arrow-in" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#7697ca"/></marker><marker id="btc-arrow-out" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#d49649"/></marker></defs>
          {inputs.map((input,index)=><path key={index} d={`M 282 ${y(index,inputs.length)} C 338 ${y(index,inputs.length)},330 ${middle},380 ${middle}`} fill="none" stroke="#90acd4" strokeWidth={2+4*Math.sqrt((input.prevout?.value??0)/Math.max(totalInput,1))} markerEnd="url(#btc-arrow-in)"/>)}
          {outputs.map((out,index)=><path key={index} d={`M 596 ${middle} C 640 ${middle},635 ${y(index,outputs.length)},686 ${y(index,outputs.length)}`} fill="none" stroke={selected===outputPage*PAGE_SIZE+index?'#ce8126':'#e0bb89'} strokeWidth={2+4*Math.sqrt(out.value/Math.max(totalOutput,1))} markerEnd="url(#btc-arrow-out)"/>)}
        </svg>
        {inputs.map((input,index)=><button type="button" key={index} disabled={input.is_coinbase||demo||busy} onClick={()=>onPrevious(input.txid,input.vout)} className={'btc-node btc-input-node '+(input.is_coinbase?'btc-coinbase':'')} style={{left:28,top:y(index,inputs.length)-47}} title={input.prevout?.scriptpubkey_address??'採掘報酬 / 入力情報なし'}>
          <span className="btc-node-label">{input.is_coinbase?'採掘報酬':'入力 #'+(inputPage*PAGE_SIZE+index)}{!input.is_coinbase&&!demo&&<ArrowUpRight size={14}/>}</span>
          <span className="btc-node-address">{input.is_coinbase?'新規発行 + 採掘手数料':shortId(input.prevout?.scriptpubkey_address??'アドレス表記なし',12,9)}</span>
          <strong>{input.is_coinbase?'コインベース':input.prevout?btc(input.prevout.value)+' BTC':'金額情報なし'}</strong>
        </button>)}
        <div className="btc-tx-node" style={{left:380,top:middle-82}}><span className="btc-tx-icon"><GitBranch size={23}/></span><span>ビットコイン取引</span><code>{demo?'サンプル '+(tx.txid==='sample-01'?'01':'02'):shortId(tx.txid,8,6)}</code><div className="btc-tx-fee">手数料 <strong>{btc(tx.fee)} BTC</strong></div></div>
        {outputs.map((out,index)=>{const number=outputPage*PAGE_SIZE+index;return <button type="button" key={number} className={'btc-node btc-output-node '+(selected===number?'is-selected':'')} style={{left:694,top:y(index,outputs.length)-47}} onClick={()=>onSelect(number)} disabled={busy} aria-pressed={selected===number} aria-label={`出力 ${number}、${out.scriptpubkey_address??outputKind(tx,out)}、${btc(out.value)} BTC の詳細`}>
          <span className="btc-node-label">出力 #{number}<span>{selected===number?'選択中':'詳細を見る'}{selected===number?<Check size={13}/>:<ChevronRight size={13}/>}</span></span>
          <span className="btc-node-address">{shortId(out.scriptpubkey_address??outputKind(tx,out),12,9)}</span><strong>{btc(out.value)} <small>BTC</small></strong>
          {outputKind(tx,out)==='入力と同じアドレス'&&<span className="btc-return-label">入力と同じアドレス</span>}
        </button>;})}
      </div></div>
    </div>
    <div className="btc-graph-caption"><Info size={16}/><span>入力から取引を経て、出力へ流れます。出力にはお釣りも含まれます。</span><span className="btc-scroll-hint">左右にスクロール</span></div>
  </>;
}

export default function BitcoinExplorer(){
  const [query,setQuery]=useState(''),[demo,setDemo]=useState(true),[tx,setTx]=useState<Transaction|null>(sampleTx);
  const [visits,setVisits]=useState<Visit[]>([demoVisit]),[source,setSource]=useState('サンプル'),[fetchedAt,setFetchedAt]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[selected,setSelected]=useState(0);
  const [inputPage,setInputPage]=useState(0),[outputPage,setOutputPage]=useState(0),[zoom,setZoom]=useState(1);
  const [outputStatus,setOutputStatus]=useState<OutputStatus|null>(null),[spendRetry,setSpendRetry]=useState(0),[copyLabel,setCopyLabel]=useState('');
  const [address,setAddress]=useState(''),[info,setInfo]=useState<AddressInfo|null>(null),[transactions,setTransactions]=useState<Transaction[]>([]);
  const [historySource,setHistorySource]=useState(''),[historyFilter,setHistoryFilter]=useState('all'),[historyError,setHistoryError]=useState('');
  const [more,setMore]=useState(false),[cursor,setCursor]=useState(''),[moreBusy,setMoreBusy]=useState(false);
  const mainRequest=useRef<AbortController|null>(null),historyRequest=useRef<AbortController|null>(null),generation=useRef(0);
  const historyMeta=useRef<Record<string,{source:string;fetchedAt:string}>>({});
  useEffect(()=>()=>{mainRequest.current?.abort();historyRequest.current?.abort();},[]);
  useEffect(()=>{
    setCopyLabel('');setOutputStatus(null);
    if(!tx||!tx.vout[selected])return;
    if(demo){setOutputStatus({data:{spent:tx.txid==='sample-01'&&selected===0,...(tx.txid==='sample-01'&&selected===0?{txid:'sample-02'}:{})},source:'サンプル'});return;}
    const controller=new AbortController();
    requestData<Spend>('outspend',tx.txid,controller.signal,{index:String(selected)}).then(r=>{if(!controller.signal.aborted)setOutputStatus({data:r.data,source:r.source,time:r.fetchedAt});}).catch(e=>{if(!controller.signal.aborted)setOutputStatus({error:e.message});});
    return ()=>controller.abort();
  },[tx,selected,demo,spendRetry]);

  function showVisit(visit:Visit,trail:Visit[],chosen=0){
    if(visit.tx!==tx||chosen!==selected)setOutputStatus(null);
    setTx(visit.tx);setSource(visit.source);setFetchedAt(visit.fetchedAt);setVisits(trail);
    setSelected(chosen);setOutputPage(Math.floor(chosen/PAGE_SIZE));setInputPage(0);setError('');
  }
  function sample(){
    mainRequest.current?.abort();historyRequest.current?.abort();generation.current++;historyMeta.current={};
    setBusy(false);setMoreBusy(false);setDemo(true);setQuery('');setAddress('');setInfo(null);setTransactions([]);setHistoryError('');setMore(false);setZoom(1);showVisit(demoVisit,[demoVisit]);
  }
  async function search(raw:string){
    const target=parseTarget(raw);if(!target){setError(initialError);return;}
    mainRequest.current?.abort();historyRequest.current?.abort();generation.current++;historyMeta.current={};
    const controller=new AbortController();mainRequest.current=controller;
    setBusy(true);setMoreBusy(false);setDemo(false);setError('');setTx(null);setVisits([]);setAddress('');setInfo(null);setTransactions([]);setMore(false);setHistoryError('');setHistoryFilter('all');setZoom(1);
    try{
      if(target.kind==='tx'){
        const r=await requestData<Transaction>('tx',target.value,controller.signal);
        if(controller.signal.aborted)return;
        const visit={tx:r.data,source:r.source,fetchedAt:r.fetchedAt};showVisit(visit,[visit]);
      }else{
        const results=await Promise.allSettled([requestData<AddressInfo>('address',target.value,controller.signal),requestData<Transaction[]>('history',target.value,controller.signal)]);
        if(controller.signal.aborted)return;
        setAddress(target.value);
        const [summary,history]=results;
        if(summary.status==='fulfilled')setInfo(summary.value.data);
        else setHistoryError('残高情報: '+summary.reason.message);
        if(history.status==='fulfilled'){
          const r=history.value;setTransactions(r.data);setHistorySource(r.source);
          for(const transaction of r.data)historyMeta.current[transaction.txid]={source:r.source,fetchedAt:r.fetchedAt};
          const confirmed=r.data.filter(t=>t.status.confirmed);setCursor(confirmed.at(-1)?.txid??'');setMore(confirmed.length===25);
          const first=r.data.find(t=>relation(t,target.value).spending)??r.data[0];
          if(first){const visit={tx:first,source:r.source,fetchedAt:r.fetchedAt};showVisit(visit,[visit],Math.max(0,first.vout.findIndex(o=>o.scriptpubkey_address!==target.value)));}
        }else setHistoryError(previous=>(previous?previous+' / ':'')+'取引履歴: '+history.reason.message);
      }
    }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'データを取得できませんでした。');}
    finally{if(mainRequest.current===controller)setBusy(false);}
  }
  async function openTransaction(id:string,via:string,previousOutput?:number){
    if(busy)return;
    if(demo){if(id==='sample-02'){const visit={tx:sampleNext,source:'サンプル',fetchedAt:'',via};showVisit(visit,[...visits,visit]);}return;}
    mainRequest.current?.abort();const controller=new AbortController();mainRequest.current=controller;setBusy(true);setError('');
    try{
      const r=await requestData<Transaction>('tx',id,controller.signal);if(controller.signal.aborted)return;
      if(previousOutput===undefined&&tx&&!r.data.vin.some(i=>i.txid===tx.txid&&i.vout===selected))throw new Error('選択した出力とのつながりを確認できませんでした。使用状況を更新してお試しください。');
      const visit={tx:r.data,source:r.source,fetchedAt:r.fetchedAt,via};
      const chosen=previousOutput!==undefined&&previousOutput<r.data.vout.length?previousOutput:0;
      showVisit(visit,[...visits,visit].slice(-30),chosen);
    }catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'取引を取得できませんでした。');}
    finally{if(mainRequest.current===controller)setBusy(false);}
  }
  async function loadMore(){
    if(!address||!cursor||moreBusy)return;
    const turn=generation.current,controller=new AbortController();historyRequest.current=controller;setMoreBusy(true);setHistoryError('');
    try{
      const r=await requestData<Transaction[]>('history',address,controller.signal,{cursor});if(controller.signal.aborted||generation.current!==turn)return;
      for(const transaction of r.data)historyMeta.current[transaction.txid]={source:r.source,fetchedAt:r.fetchedAt};
      setTransactions(old=>{const seen=new Set(old.map(t=>t.txid));return [...old,...r.data.filter(t=>!seen.has(t.txid))];});
      setCursor(r.data.at(-1)?.txid??'');setMore(r.data.length===25);setHistorySource(r.source);
    }catch(e){if(!controller.signal.aborted&&generation.current===turn)setHistoryError(e instanceof Error?e.message:'追加の取引を取得できませんでした。');}
    finally{if(historyRequest.current===controller)setMoreBusy(false);}
  }
  async function copy(value:string){try{await navigator.clipboard.writeText(value);setCopyLabel('コピーしました');}catch{setCopyLabel('アドレスを長押ししてコピーしてください');}}
  const out=tx?.vout[selected],sum=tx?.vout.reduce((n,o)=>n+o.value,0)??0;
  const filtered=transactions.filter(t=>historyFilter==='all'||(historyFilter==='out'?relation(t,address).spending:!relation(t,address).spending));

  return <div className="btc-app">
    <header className="btc-header"><Brand/><a href="/commons/" className="btc-back"><ArrowLeft size={16}/>サイト一覧へ</a></header>
    <main className="btc-main">
      <div className="btc-heading"><div className="btc-title-icon"><Bitcoin size={28}/></div><div><div className="btc-eyebrow">BITCOIN EXPLORER</div><h1>ビットコイン送金マップ</h1></div><span className="btc-network">Bitcoin メインネット</span></div>
      <form className="btc-search" onSubmit={e=>{e.preventDefault();search(query);}}><label htmlFor="btc-query">アドレスまたは取引ID</label><div className="btc-search-row"><div className="btc-input-wrap"><Search size={19}/><Input id="btc-query" value={query} onChange={e=>setQuery(e.target.value)} placeholder="1… / 3… / bc1… / 64桁の取引ID" autoComplete="off" autoCapitalize="off" spellCheck={false} maxLength={120}/></div><Button type="submit" disabled={busy} className="btc-search-button">{busy?<LoaderCircle className="btc-spin"/>:<Search/>}検索</Button></div><div className="btc-search-help"><span>公開された取引から、送金先とその後の流れを確認。</span><button type="button" onClick={()=>{setQuery(EXAMPLE_TX);search(EXAMPLE_TX);}} disabled={busy}>実際の取引で試す<ArrowUpRight size={14}/></button><button type="button" onClick={sample}>サンプル図</button></div></form>
      {error&&<div className="btc-error" role="alert">{error}</div>}
      {address&&<section className="btc-address-summary"><div><span className="btc-kicker">検索したアドレス</span><code>{address}</code></div>{info&&<div className="btc-address-numbers"><div><span>確定済み残高</span><strong>{btc(info.chain_stats.funded_txo_sum-info.chain_stats.spent_txo_sum)} <small>BTC</small></strong></div><div><span>未確定の増減</span><strong>{btc(info.mempool_stats.funded_txo_sum-info.mempool_stats.spent_txo_sum)} <small>BTC</small></strong></div><div><span>確定済み取引</span><strong>{info.chain_stats.tx_count.toLocaleString()} <small>件</small></strong></div></div>}</section>}
      {demo&&<div className="btc-demo-banner"><Info size={17}/><span><strong>サンプル図</strong> · 操作説明用の架空の取引です。検索すると実データに切り替わります。</span></div>}
      {tx&&<>
        <nav className="btc-trail" aria-label="たどった取引"><span><GitBranch size={15}/>探索した取引</span><ol>{visits.map((visit,index)=><li key={index}>{index>0&&<ArrowRight size={14}/>}<button disabled={busy} aria-current={index===visits.length-1?'step':undefined} title={visit.via??'検索した取引'} onClick={()=>showVisit(visit,visits.slice(0,index+1))}>{String(index+1).padStart(2,'0')} <code>{demo?visit.tx.txid==='sample-01'?'サンプル01':'サンプル02':shortId(visit.tx.txid,5,4)}</code></button></li>)}</ol></nav>
        <div className="btc-workspace" aria-busy={busy}>
          <section className="btc-map-panel">
            <div className="btc-map-toolbar"><div><h2>送金の流れ</h2><span className={'btc-status '+(!tx.status.confirmed?'pending':'')}>{demo?'サンプル':tx.status.confirmed?'確定済み':'未確定'}</span>{!demo&&tx.status.block_time&&<time>{date(tx.status.block_time)}</time>}</div><div className="btc-zoom"><Button variant="ghost" size="icon" aria-label="図を縮小" disabled={zoom<=.7} onClick={()=>setZoom(v=>Math.max(.7,Math.round((v-.1)*10)/10))}><ZoomOut/></Button><button aria-label="図の大きさを100パーセントに戻す" onClick={()=>setZoom(1)}>{Math.round(zoom*100)}%</button><Button variant="ghost" size="icon" aria-label="図を拡大" disabled={zoom>=1.5} onClick={()=>setZoom(v=>Math.min(1.5,Math.round((v+.1)*10)/10))}><ZoomIn/></Button></div></div>
            <div className="btc-map-metrics"><div><span>出力合計</span><strong>{btc(sum)} <small>BTC</small></strong></div><div><span>手数料</span><strong>{btc(tx.fee)} <small>BTC</small></strong></div><div><span>入力 → 出力</span><strong>{tx.vin.length.toLocaleString()} <ArrowRight size={15}/> {tx.vout.length.toLocaleString()}</strong></div></div>
            {busy&&<div role="status" className="btc-inline-loading"><LoaderCircle size={16} className="btc-spin"/>取引を読み込み中…</div>}
            <Graph tx={tx} selected={selected} onSelect={setSelected} onPrevious={(id,index)=>openTransaction(id,'入力元の取引へ',index)} inputPage={inputPage} setInputPage={setInputPage} outputPage={outputPage} setOutputPage={n=>{setOutputPage(n);setSelected(n*PAGE_SIZE);}} zoom={zoom} demo={demo} busy={busy}/>
          </section>
          <aside className="btc-detail" aria-label="選択した送金先の詳細">
            {out?<><div className="btc-detail-top"><span className="btc-detail-icon"><Wallet size={20}/></span><span>送金先の詳細</span><span>出力 #{selected}</span></div><div className="btc-detail-body"><span className="btc-kicker">この出力の金額</span><p className="btc-amount">{btc(out.value)} <small>BTC</small></p><p className="btc-sats">{out.value.toLocaleString()} sat</p><div className="btc-address-box"><span>{outputKind(tx,out)}</span><code>{out.scriptpubkey_address??'標準のアドレスとして表示できない出力です。'}</code>{out.scriptpubkey_address&&!demo&&<div className="btc-address-actions"><button onClick={()=>copy(out.scriptpubkey_address!)}><Copy size={14}/>コピー</button><a href={'https://mempool.space/address/'+encodeURIComponent(out.scriptpubkey_address)} target="_blank" rel="noopener noreferrer">外部で確認<ExternalLink size={14}/></a></div>}</div>{copyLabel&&<p className="btc-copy-status" role="status">{copyLabel}</p>}
              {outputKind(tx,out)==='入力と同じアドレス'&&<p className="btc-same-address"><RotateCcw size={15}/>入力と同じアドレスに戻っています。お釣りかどうかは断定できません。</p>}
              <div className="btc-spend"><span className="btc-kicker">このビットコインの、その後</span>{!outputStatus?<p role="status" className="btc-spend-message"><LoaderCircle size={17} className="btc-spin"/>使用状況を確認中…</p>:outputStatus.error?<><p className="btc-error-text" role="alert">{outputStatus.error}</p><Button variant="outline" onClick={()=>setSpendRetry(v=>v+1)}>使用状況を再確認</Button></>:outputStatus.data?.spent?<><p className="btc-spend-message"><GitBranch size={18}/><strong>次の取引で使用済み</strong></p>{!demo&&<code className="btc-spend-id">{shortId(outputStatus.data.txid!,13,10)}</code>}<Button className="btc-next-button" disabled={busy} onClick={()=>openTransaction(outputStatus.data!.txid!,'出力 #'+selected+' → 次の取引')}>次の送金をたどる<ArrowRight/></Button><p className="btc-detail-note">選んだ出力を使った取引を開きます。</p></>:<><p className="btc-spend-message"><Check size={18}/><strong>{out.scriptpubkey_type==='op_return'?'使用できないデータ出力':'まだ使われていません'}</strong></p><p className="btc-detail-note">{out.scriptpubkey_type==='op_return'?'この出力から次の送金はできません。':'取得時点では未使用です。次の送金は見つかっていません。'}</p></>}{!demo&&outputStatus?.data&&<button className="btc-refresh-status" onClick={()=>setSpendRetry(v=>v+1)}><RotateCcw size={13}/>使用状況を更新</button>}</div>
              {!demo&&<a className="btc-tx-external" href={'https://mempool.space/tx/'+tx.txid} target="_blank" rel="noopener noreferrer">この取引をエクスプローラーで確認<ExternalLink size={14}/></a>}
            </div></>:<Empty><EmptyHeader><EmptyTitle>出力がありません</EmptyTitle></EmptyHeader></Empty>}
          </aside>
        </div>
        {!demo&&<p className="btc-data-source">取引データ: {source} · {fetchedAt?new Date(fetchedAt).toLocaleString('ja-JP'):''} 取得{outputStatus?.time&&<> ／ 使用状況: {outputStatus.source} · {new Date(outputStatus.time).toLocaleTimeString('ja-JP')}</>}</p>}
      </>}
      {busy&&!tx&&<section className="btc-loading" role="status"><LoaderCircle className="btc-spin"/><p>公開された取引を読み込んでいます…</p><Skeleton className="btc-loading-bar"/><Skeleton className="btc-loading-bar short"/></section>}
      {!busy&&!tx&&!error&&!address&&<Empty className="btc-empty"><EmptyHeader><EmptyTitle>送金先を検索</EmptyTitle><EmptyDescription>アドレスまたは取引IDを入力してください。</EmptyDescription></EmptyHeader></Empty>}
      {address&&<section className="btc-history"><div className="btc-history-heading"><div><h2>このアドレスの取引</h2><p>新しい順 · 読み込み済み {transactions.length}件{info?' / 確定済み '+info.chain_stats.tx_count.toLocaleString()+'件＋未確定 '+info.mempool_stats.tx_count.toLocaleString()+'件':''}</p></div><Tabs value={historyFilter} onValueChange={setHistoryFilter}><TabsList><TabsTrigger value="all">すべて</TabsTrigger><TabsTrigger value="out">支出を含む</TabsTrigger><TabsTrigger value="in">受取のみ</TabsTrigger></TabsList></Tabs></div>
        {historyError&&<div className="btc-error" role="alert">{historyError}<Button variant="outline" disabled={busy} onClick={()=>search(address)}>再検索</Button></div>}
        {!historyError&&!transactions.length&&!busy&&<Empty><EmptyHeader><EmptyTitle>取引は見つかりませんでした</EmptyTitle><EmptyDescription>このアドレスに公開された取引がないか、まだ反映されていません。</EmptyDescription></EmptyHeader></Empty>}
        {transactions.length>0&&<><div className="btc-history-columns"><span>取引 / 日時</span><span>種別</span><span>このアドレスの増減</span></div><div className="btc-history-list">{filtered.map(t=>{const r=relation(t,address);return <button key={t.txid} disabled={busy} onClick={()=>{const visit={tx:t,...(historyMeta.current[t.txid]??{source:historySource,fetchedAt:''})};showVisit(visit,[visit],Math.max(0,t.vout.findIndex(o=>o.scriptpubkey_address!==address)));}} className={'btc-history-item '+(tx?.txid===t.txid?'selected':'')}><span><code>{shortId(t.txid,14,10)}</code><time>{t.status.confirmed?date(t.status.block_time):'未確定'}</time></span><span className={'btc-direction '+(r.spending?'out':'in')}>{r.spending?'支出を含む':'受取'}</span><span className={'btc-history-net '+(r.net<0?'negative':'positive')}>{r.net>0?'+':''}{btc(r.net)} <small>BTC</small><ChevronRight size={16}/></span></button>;})}</div>{!filtered.length&&<p className="btc-history-empty">読み込み済みの範囲に該当する取引はありません。</p>}<p className="btc-history-note">増減は、このアドレスの出力額 − 入力額です。相手への送金額や、ウォレット全体の増減ではありません。</p></>}
        {more&&<Button variant="outline" className="btc-load-more" disabled={moreBusy||busy} onClick={loadMore}>{moreBusy?<LoaderCircle className="btc-spin"/>:null}過去の取引をさらに25件読み込む</Button>}
        <p className="btc-history-note">初回は最新の確定済み25件と未確定最大50件を取得します。未確定取引は取り消し・置き換えされる場合があります。</p>
      </section>}
      <details className="btc-guide"><summary><Info size={17}/>図の見方と、分かること</summary><div><p><strong>出力は送金先の候補です。</strong> 自分へのお釣りも含まれます。アドレスだけで所有者の氏名や取引所名、お釣りかどうかを確定することはできません。</p><p><strong>線は取引のつながりを表します。</strong> 複数の入力が混ざる取引では、特定の入力のお金がどの出力にいくら移ったかは断定できません。「次の送金」は、選んだ出力を実際に使った取引を表示します。</p><p>Bitcoinメインネットの公開データが対象です。Lightningや取引所内部の移動は表示されません。検索内容はデータ提供元に照会されます。</p><p>データ提供・仕様: <a href="https://mempool.space/docs/api/rest" target="_blank" rel="noopener noreferrer">mempool.space</a> / <a href="https://github.com/Blockstream/esplora/blob/master/API.md" target="_blank" rel="noopener noreferrer">Blockstream Esplora</a></p></div></details>
      <footer className="btc-footer"><span>COMMONS / BITCOIN</span><a href="/commons/">サイト一覧に戻る<ArrowRight size={14}/></a></footer>
    </main>
  </div>;
}
