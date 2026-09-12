'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {ArrowLeft,Cloud,Download,Info,Link,LoaderCircle,Users,Check} from 'lucide-react';
import {findTool,engineNames} from '@/lib/catalog';
import type {Item,RoomData} from '@/lib/types';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogAction,AlertDialogCancel} from '@/components/ui/alert-dialog';
import {Skeleton} from '@/components/ui/skeleton';
import {api,Brand,ToolIcon,download} from './common';
import {Surface,Discussion} from './surfaces';
import {scheduleChoice} from '@/lib/vote-data';
export type Actions={data:RoomData;busy:boolean;add:(kind:string,body:Record<string,any>,id?:string,epoch?:number)=>Promise<boolean>;edit:(item:Item,body:Record<string,any>)=>Promise<boolean>;remove:(item:Item)=>void;vote:(scope:string,choice:string,remove?:boolean)=>Promise<boolean>;request:(payload:Record<string,any>)=>Promise<boolean>;notify:(message:string)=>void};
export default function Room({id}:{id:string}) {
  const [data,setData]=useState<RoomData|null>(null);
  const [error,setError]=useState('');
  const [deleteError,setDeleteError]=useState('');
  const [syncError,setSyncError]=useState('');
  const [isOffline,setIsOffline]=useState(false);
  const [name,setName]=useState('');
  const [pending,setPending]=useState(0);
  const [share,setShare]=useState(false);
  const [shareUrl,setShareUrl]=useState('');
  const [removeItem,setRemoveItem]=useState<Item|null>(null);
  const [toast,setToast]=useState('');
  const [lastSync,setLastSync]=useState(0);
  const current=useRef<RoomData|null>(null);
  const version=useRef<number|undefined>(undefined);
  const memberSync=useRef(0);
  const mounted=useRef(true);
  const needsFull=useRef(true);
  const inFlight=useRef<Promise<boolean>|null>(null);
  const abortRead=useRef<AbortController|null>(null);
  const failures=useRef(0);
  const retryIds=useRef(new Map<string,string>());
  const toastTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const load=useCallback(async function refresh(force=false):Promise<boolean>{
    if(force)needsFull.current=true;
    if(inFlight.current){
      const ok=await inFlight.current;
      if(needsFull.current&&mounted.current)return refresh();
      return ok;
    }
    if(!navigator.onLine){
      setIsOffline(true);setSyncError('オフラインです。接続が戻ると自動で同期します。');failures.current++;
      return false;
    }
    const full=needsFull.current||version.current===undefined;
    const refreshMembers=full||Date.now()-memberSync.current>=25000;
    needsFull.current=false;
    const controller=new AbortController();abortRead.current=controller;
    const work=(async()=>{
      const started=Date.now();
      try{
        const params=new URLSearchParams({format:'2'});
        if(!full&&version.current!==undefined)params.set('since',String(version.current));
        if(refreshMembers)params.set('members','1');
        const result=await api(`/api/rooms/${id}?${params}`,undefined,{signal:controller.signal});
        if(!mounted.current)return false;
        const clockOffset=result.now-Math.round((started+Date.now())/2);
        if(result.unchanged){
          if(current.current){
            current.current={...current.current,...(Array.isArray(result.members)?{members:result.members}:{}),now:result.now,clockOffset};setData(current.current);
            if(Array.isArray(result.members))memberSync.current=Date.now();
          }
        }else if(!current.current||result.room.updated>=current.current.room.updated||result.me!==current.current.me){
          current.current={...result,clockOffset};setData(current.current);
          version.current=result.room.updated;memberSync.current=Date.now();
        }
        failures.current=0;setSyncError('');setIsOffline(false);setLastSync(Date.now());
        return true;
      }catch(e){
        if(!mounted.current||controller.signal.aborted)return false;
        failures.current++;setSyncError((e as Error).message);setIsOffline(!navigator.onLine);
        return false;
      }
    })();
    inFlight.current=work;
    try{return await work}finally{if(inFlight.current===work)inFlight.current=null}
  },[id]);
  useEffect(()=>{
    mounted.current=true;
    try{setName(localStorage.getItem('commons_name')??'')}catch{}
    setShareUrl(window.location.href);
    let timer:ReturnType<typeof setTimeout>|undefined;
    let generation=0,stopped=false;
    async function tick(g:number){
      if(stopped||g!==generation)return;
      if(document.visibilityState==='visible')await load();
      if(stopped||g!==generation)return;
      timer=setTimeout(()=>tick(g),Math.min(30000,3000*2**Math.min(failures.current,4)));
    }
    function wake(){if(timer)clearTimeout(timer);memberSync.current=0;void tick(++generation)}
    function offline(){setIsOffline(true);setSyncError('オフラインです。接続が戻ると自動で同期します。')}
    function visible(){if(document.visibilityState==='visible')wake()}
    wake();
    document.addEventListener('visibilitychange',visible);window.addEventListener('online',wake);window.addEventListener('offline',offline);
    return()=>{stopped=true;mounted.current=false;generation++;if(timer)clearTimeout(timer);abortRead.current?.abort();document.removeEventListener('visibilitychange',visible);window.removeEventListener('online',wake);window.removeEventListener('offline',offline);if(toastTimer.current)clearTimeout(toastTimer.current)};
  },[load]);
  const joined=!!data?.members.some(m=>m.actor===data.me);
  useEffect(()=>{
    if(!joined)return;
    const ping=()=>{if(navigator.onLine&&document.visibilityState==='visible')api(`/api/rooms/${id}`,{op:'presence'}).catch(()=>{})};
    ping();const t=setInterval(ping,25000);return()=>clearInterval(t);
  },[id,joined]);
  const notify=(message:string)=>{setToast(message);if(toastTimer.current)clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(''),4500)};
  async function mutate(payload:Record<string,any>){
    if(!navigator.onLine){setError('オフラインのため保存できません。入力を残して、接続後にもう一度保存してください。');return false}
    setPending(n=>n+1);setError('');
    try{
      await api(`/api/rooms/${id}`,{epoch:current.current?.room.canvas_epoch??0,...payload});
      await load(true);return true;
    }catch(e){setError((e as Error).message);await load(true);return false}
    finally{if(mounted.current)setPending(n=>Math.max(0,n-1))}
  }
  async function add(kind:string,body:Record<string,any>,providedId?:string,epoch?:number){
    const key=`${kind}:${JSON.stringify(body)}`;
    const itemId=providedId??retryIds.current.get(key)??crypto.randomUUID();
    if(!providedId)retryIds.current.set(key,itemId);
    const ok=await mutate({op:'add',kind,body,id:itemId,...(epoch===undefined?{}:{epoch})});
    if(ok)retryIds.current.delete(key);
    return ok;
  }
  const actions:Actions|null=data?{
    data,busy:pending>0,add,
    edit:(item,body)=>mutate({op:'edit',id:item.id,revision:item.revision,body}),
    remove:item=>{setDeleteError('');setRemoveItem(item)},
    vote:(scope,choice,remove)=>mutate({op:'vote',scope,choice,remove}),
    request:mutate,notify
  }:null;
  async function join(e:React.FormEvent){e.preventDefault();if(await mutate({op:'join',name})){try{localStorage.setItem('commons_name',name)}catch{}}}
  async function copy(){try{await navigator.clipboard.writeText(shareUrl);notify('招待リンクをコピーしました')}catch{notify('リンクを選択してコピーしてください')}}
const tool=data?findTool(data.room.tool):null;
if(!data||!tool||!actions)return <><header className="page-header"><Brand/><a href="/commons/" className="back-link"><ArrowLeft size={16}/>コモンズ</a></header><main className="workspace">{(error||syncError)?<div className="notice" role="alert">{error||syncError}<Button variant="outline" onClick={()=>{setError('');load(true)}} style={{marginLeft:12}}>再試行</Button></div>:<div className="stack" aria-label="ルームを読み込み中"><Skeleton className="h-10 w-64"/><Skeleton className="h-80 w-full"/></div>}</main></>;
if(!joined)return <><header className="page-header"><Brand/><a className="back-link" href="/commons/">コモンズへ</a></header><main className="join-panel"><div className="form-card"><ToolIcon tool={tool}/><h2 style={{marginTop:20}}>{data.room.title}</h2><p>{tool.name}に参加します。</p><form onSubmit={join} className="stack"><div className="field"><label htmlFor="join-name">あなたの表示名</label><Input id="join-name" value={name} maxLength={32} required placeholder="呼んでほしい名前" onChange={e=>setName(e.target.value)}/></div>{error&&<p className="notice" role="alert">{error}</p>}<Button className="full-button" disabled={pending>0}>参加する<Users size={16}/></Button><p className="form-hint">参加者はルームの内容を閲覧・共同編集できます。表示名は本人確認を行わないニックネームです。</p></form></div></main></>;
const online=data.members.filter(m=>data.now-m.seen<65000);
return <><header className="workspace-header"><a href="/commons/" aria-label="コモンズへ" className="brand-mark"><ArrowLeft size={18}/></a><div className="workspace-name grow"><h1>{data.room.title}</h1><p>{tool.name} · {engineNames[tool.engine]}</p></div><div className="workspace-tools"><Button variant="outline" aria-label="ルームのデータを書き出す" onClick={()=>{download(`commons-${tool.id}.json`,JSON.stringify({format:'commons-room',version:2,title:data.room.title,tool:tool.id,exported:new Date().toISOString(),items:data.items.map(({author,...i})=>i),members:data.members.map(m=>({name:m.name})),voteSummary:data.voteSummary,scheduleResponses:data.items.filter(i=>i.kind==='slot').map(i=>({item:i.id,responses:data.members.map((m,index)=>({name:m.name,choice:scheduleChoice(data,i.id,index)??null}))})),myVotes:data.myVotes},null,2));notify('ルームのデータを書き出しました')}}><Download size={16}/><span className="export-text">書き出し</span></Button><Button onClick={()=>setShare(true)}><Link size={16}/>招待</Button></div></header><div className="members-strip"><div className="avatars">{online.slice(0,6).map(m=><span className="avatar" title={m.name} key={m.actor}>{m.name.slice(0,1)}</span>)}</div><span className="small">{online.length}人が参加中</span><span className="muted small desktop-only">あなた：{data.members.find(m=>m.actor===data.me)?.name}</span><span className="sync" role="status" title={lastSync?`最終同期 ${new Date(lastSync).toLocaleTimeString('ja-JP')}`:undefined}>{pending>0?<><LoaderCircle size={13} className="animate-spin"/>保存中</>:syncError?<span style={{color:'#ba4b54'}}>{isOffline?'オフライン':'再接続中'}</span>:error?<span style={{color:'#ba4b54'}}>未保存の操作あり</span>:<><span className="sync-dot"/>共有データを同期済み</>}</span></div><main className="workspace">{syncError&&<div className="notice row spread" role="status"><span>{syncError}</span><Button variant="outline" onClick={()=>load(true)}>接続を再確認</Button></div>}{error&&<div className="notice row spread" role="alert"><span>{error}</span><Button variant="ghost" onClick={()=>{setError('');load(true)}}>再読込</Button></div>}<p className="workspace-intro"><Info/>{tool.hint}</p><div className={tool.engine==='chat'?'workspace-cols chat-layout':'workspace-cols'}><section className="work-surface"><Surface tool={tool} actions={actions}/></section><aside>{tool.engine==='chat'?<div className="panel"><h2 className="panel-title"><Users size={17}/>参加メンバー <span className="mini-tag">{data.members.length}</span></h2><ul className="participant-list">{data.members.map(member=><li key={member.actor}><span className="avatar" aria-hidden="true">{Array.from(member.name)[0]}</span><span className="grow">{member.name}{member.actor===data.me&&<small>（あなた）</small>}</span><span className="member-state">{data.now-member.seen<65000?'参加中':'離席中'}</span></li>)}</ul></div>:<Discussion actions={actions}/> }<p className="form-hint" style={{padding:'15px 7px'}}>このサイトへのアクセス権がある人が、リンクから参加できます。内容は数秒ごとに同期されます。<br/>同じカードの編集が重なった場合は、入力を残してお知らせします。</p></aside></div></main>
<Dialog open={share} onOpenChange={setShare}><DialogContent><DialogHeader><DialogTitle>ルームに招待</DialogTitle><DialogDescription>このリンクを一緒に使う人へ送ってください。</DialogDescription></DialogHeader><Input aria-label="ルームの招待リンク" className="share-link" readOnly value={shareUrl} onFocus={e=>e.target.select()}/><Button onClick={copy}><Link size={16}/>リンクをコピー</Button><p className="form-hint">このサイトへのアクセス権とルームのリンクを持つ人が、閲覧・共同編集できます。投稿の削除は投稿者とルーム作成者が行えます。</p></DialogContent></Dialog>
<AlertDialog open={!!removeItem} onOpenChange={v=>{if(!v&&!pending)setRemoveItem(null)}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>この項目を削除しますか？</AlertDialogTitle><AlertDialogDescription>ルームの全員の画面から削除されます。この操作は取り消せません。</AlertDialogDescription></AlertDialogHeader>{deleteError&&<p className="notice" role="alert">{deleteError}</p>}<AlertDialogFooter><AlertDialogCancel disabled={pending>0}>キャンセル</AlertDialogCancel><Button variant="destructive" disabled={pending>0} onClick={async()=>{if(!removeItem)return;setDeleteError('');if(await mutate({op:'delete',id:removeItem.id,revision:removeItem.revision}))setRemoveItem(null);else setDeleteError('削除できませんでした。入力内容を確認して再試行するか、キャンセルしてください。')}}>{pending?'削除中…':'削除する'}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>{toast&&<div className="status-toast" role="status">{toast}</div>}</>}
