'use client';
import {useEffect,useState} from 'react';
import type {Tool} from '@/lib/catalog';
import {ArrowLeft,ArrowRight,Clock,Link,Cloud,Users,RotateCw} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Brand,ToolIcon,api,dateTime} from './common';
import {useDraft} from '@/hooks/use-draft';
import {draftScope} from '@/lib/drafts';
import {DraftStatus} from './draft-status';

type Creation={title:string;name:string};
const validCreation=(value:unknown):value is Creation=>{const v=value as Creation;return !!v&&typeof v.title==='string'&&v.title.length<=80&&typeof v.name==='string'&&v.name.length<=32};
type Recent={id:string;title:string;updated:number};
export default function Start({tool}:{tool:Tool}){
  const draft=useDraft(draftScope('create-room',tool.id),{title:tool.name+'のルーム',name:''},validCreation);
  const [error,setError]=useState(''),[ready,setReady]=useState(false),[recent,setRecent]=useState<Recent[]>([]);
  const [createdId,setCreatedId]=useState('');
  async function load(){setError('');try{const data=await api('/api/rooms?tool='+encodeURIComponent(tool.id));setRecent(data.rooms);setReady(true)}catch(e){setError((e as Error).message)}}
  useEffect(()=>{void load()},[tool.id]);
  useEffect(()=>{if(!draft.ready||draft.recovered)return;try{const name=localStorage.getItem('commons_name');if(name)draft.setValue(v=>({...v,name:name.slice(0,32)}))}catch{}},[draft.ready]);
  useEffect(()=>{if(createdId&&!draft.dirty&&!draft.sending)window.location.assign('/commons/r/?id='+createdId)},[createdId,draft.dirty,draft.sending]);
  async function create(e:React.FormEvent){
    e.preventDefault();if(!ready)return;setError('');
    await draft.submit(async(value,operationId)=>{
      const body={tool:tool.id,title:value.title.trim(),name:value.name.trim()};
      try{const result=await api('/api/rooms',{...body,requestId:operationId(body)});try{localStorage.setItem('commons_name',body.name)}catch{}setCreatedId(result.id);return true}catch(e){setError((e as Error).message);return false}
    },{title:tool.name+'のルーム',name:''});
  }
  return <>
    <header className="page-header"><Brand/><a className="back-link" href="/commons/"><ArrowLeft size={16}/>コモンズ</a></header>
    <main className="start-page room-start">
      <section className="start-info"><ToolIcon tool={tool}/><h1>{tool.name}</h1><p>{tool.description}</p><ul className="start-points"><li><Link/>リンクを共有して招待</li><li><Users/>参加者の変更を自動で同期</li><li><Cloud/>保存したルームから続きを再開</li></ul>
        <section className="start-recent" aria-label="最近のルーム"><h2><Clock size={18}/>最近のルーム</h2>{!ready&&!error?<p role="status">ルームを確認中…</p>:recent.length?<div className="room-list">{recent.slice(0,4).map(room=><a href={'/commons/r/?id='+room.id} className="recent-room" key={room.id}><div className="grow"><h3>{room.title}</h3><p>{dateTime(room.updated)}</p></div><ArrowRight size={17}/></a>)}</div>:<p>このブラウザで参加したルームから、続きを開けます。</p>}</section>
      </section>
      <section className="form-card"><h2>新しいルーム</h2><p>名前を付けて始めましょう。</p><form onSubmit={create} className="stack">
        <div className="field"><label htmlFor="room-title">ルーム名</label><Input id="room-title" required maxLength={80} disabled={!draft.ready||draft.sending} value={draft.value.title} onChange={e=>draft.setValue(v=>({...v,title:e.target.value}))}/></div>
        <div className="field"><label htmlFor="display-name">あなたの表示名</label><Input id="display-name" placeholder="例：たろう" autoComplete="nickname" required maxLength={32} disabled={!draft.ready||draft.sending} value={draft.value.name} onChange={e=>draft.setValue(v=>({...v,name:e.target.value}))}/></div>
        {error&&<div className="notice" role="alert"><p>{error}</p>{!ready&&<Button type="button" variant="outline" onClick={()=>void load()}><RotateCw size={16}/>再試行</Button>}</div>}
        {draft.recovered&&<DraftStatus draft={draft}/>}
        <Button type="submit" disabled={!ready||!draft.ready||draft.sending||!draft.value.title.trim()||!draft.value.name.trim()} className="full-button">{draft.sending?'ルームを作成中…':!ready?'接続を確認中…':'ルームを作る'}<ArrowRight size={16}/></Button>
        <p className="form-hint">招待された参加者は内容を閲覧・共同編集できます。表示名はニックネームです。</p>
      </form></section>
    </main>
  </>;
}
