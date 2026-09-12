'use client';
import {useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {ArrowDown,Check,Copy,MessageSquare,Pencil,Search,Send,ThumbsUp,Trash2,X} from 'lucide-react';
import type {Tool} from '@/lib/catalog';
import type {Item} from '@/lib/types';
import type {Actions} from './room';
import {useDraft} from '@/hooks/use-draft';
import {draftScope,isMessageDraft} from '@/lib/drafts';
import {recentWindow} from '@/lib/paging';
import {myVote,voteCount} from '@/lib/vote-data';
import {Button} from '@/components/ui/button';
import {Textarea} from '@/components/ui/textarea';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Blank,Picker,dateTime} from './common';
import {DraftStatus} from './draft-status';
import {DiscardChanges} from './discard-changes';

function MessageEditor({item,a,onClose}:{item:Item;a:Actions;onClose:()=>void}){
  const initial={text:String(item.body.text),group:String(item.body.group??''),parent:item.body.parent??null};
  const draft=useDraft(draftScope(a.data.room.id,a.data.me,'message-edit',item.id),initial,isMessageDraft,String(item.revision));
  const [discard,setDiscard]=useState(false),[error,setError]=useState('');
  const close=()=>{if(draft.sending)return;if(draft.dirty)setDiscard(true);else onClose()};
  async function save(event:React.FormEvent){event.preventDefault();setError('');const ok=await draft.submit(value=>a.request({op:'edit',id:item.id,revision:Number(draft.base),body:{...item.body,text:value.text}}),value=>value);if(ok)onClose();else setError('変更を保存できませんでした。入力を残しています。上部の案内を確認してください。')}
  return <><Dialog open onOpenChange={open=>{if(!open)close()}}><DialogContent><DialogHeader><DialogTitle>メッセージを編集</DialogTitle><DialogDescription>変更はルームの全員に表示されます。</DialogDescription></DialogHeader><form className="stack" onSubmit={save}><Textarea autoFocus aria-label="編集するメッセージ" maxLength={10000} rows={6} disabled={!draft.ready||draft.sending} value={draft.value.text} onChange={e=>draft.setValue(v=>({...v,text:e.target.value}))}/><DraftStatus draft={draft}/>{error&&<p className="notice" role="alert">{error}</p>}<div className="row wrap"><Button disabled={!draft.ready||draft.sending||!draft.value.text.trim()||a.busy}><Check size={16}/>変更を保存</Button><Button type="button" variant="outline" disabled={draft.sending} onClick={close}>キャンセル</Button></div></form></DialogContent></Dialog><DiscardChanges open={discard} onOpenChange={setDiscard} onDiscard={()=>{draft.discard();onClose()}}/></>;
}
function MessageText({text,query}:{text:string;query:string}){
  if(!query)return <>{text}</>;
  const lower=text.toLocaleLowerCase('ja'),needle=query.toLocaleLowerCase('ja'),parts:React.ReactNode[]=[];
  let cursor=0,index=lower.indexOf(needle);
  while(index>=0){parts.push(text.slice(cursor,index),<mark key={index}>{text.slice(index,index+query.length)}</mark>);cursor=index+query.length;index=lower.indexOf(needle,cursor)}
  parts.push(text.slice(cursor));return <>{parts}</>;
}
export default function Chat({tool,actions:a}:{tool:Tool;actions:Actions}){
  const draft=useDraft(draftScope(a.data.room.id,a.data.me,'chat',tool.id),{text:'',group:tool.labels[0]??'',parent:null},isMessageDraft);
  const [filter,setFilter]=useState('すべて'),[query,setQuery]=useState(''),[visibleCount,setVisibleCount]=useState(100),[unread,setUnread]=useState(0),[editing,setEditing]=useState<Item|null>(null);
  const list=useRef<HTMLDivElement>(null),input=useRef<HTMLTextAreaElement>(null);
  const stickToBottom=useRef(true),anchor=useRef<{height:number;top:number}|null>(null),knownIds=useRef<Set<string>|null>(null);
  const search=query.trim();
  const allMessages=useMemo(()=>a.data.items.filter(item=>item.kind==='message'),[a.data.items]);
  const messages=useMemo(()=>allMessages.filter(item=>(filter==='すべて'||item.body.group===filter)&&[item.body.text,item.name].join(' ').toLocaleLowerCase('ja').includes(search.toLocaleLowerCase('ja'))),[allMessages,filter,search]);
  const visible=recentWindow(messages,visibleCount,100);
  const reply=allMessages.find(item=>item.id===draft.value.parent);
  const setReply=(item:Item|null)=>{draft.setValue(v=>({...v,parent:item?.id??null}));input.current?.focus()};
  function latest(){setQuery('');setUnread(0);stickToBottom.current=true;requestAnimationFrame(()=>{if(list.current)list.current.scrollTop=list.current.scrollHeight})}
  useEffect(()=>{setVisibleCount(100);anchor.current=null;stickToBottom.current=!search},[filter,search]);
  useEffect(()=>{
    const before=knownIds.current;knownIds.current=new Set(allMessages.map(item=>item.id));
    if(!before)return;
    const added=allMessages.filter(item=>!before.has(item.id)&&item.author!==a.data.me).length;
    if(added&&(!stickToBottom.current||search||document.hidden))setUnread(n=>n+added);
  },[allMessages,a.data.me,search]);
  useLayoutEffect(()=>{
    const el=list.current;if(!el)return;
    if(anchor.current){el.scrollTop=anchor.current.top+el.scrollHeight-anchor.current.height;anchor.current=null}
    else if(stickToBottom.current&&!search)el.scrollTop=el.scrollHeight;
  },[visibleCount,messages.length,search]);
  useEffect(()=>{const el=input.current;if(el){el.style.height='auto';el.style.height=Math.min(el.scrollHeight,180)+'px'}},[draft.value.text]);
  async function send(e:React.FormEvent){e.preventDefault();if(!draft.value.text.trim()||a.busy)return;const ok=await draft.submit((value,id)=>a.add('message',value,id(value)),v=>({...v,text:'',parent:null}));if(ok){latest();input.current?.focus()}}
  async function copy(text:string){try{await navigator.clipboard.writeText(text);a.notify('メッセージをコピーしました')}catch{a.notify('文章を長押し、または選択してコピーしてください')}}
  return <>
    <div className="surface-toolbar"><h2 className="grow">トーク <span className="mini-tag">{allMessages.length}</span></h2><div className="search-box chat-search"><Search size={18}/><input type="search" aria-label="メッセージ・表示名を検索" placeholder="メッセージを検索" value={query} onChange={e=>setQuery(e.target.value)}/></div>{tool.labels.length>1&&<Picker value={filter} onChange={setFilter} label="表示する話題" options={['すべて',...tool.labels]}/>}</div>
    {search&&<p className="list-summary" role="status">{messages.length}件のメッセージが見つかりました</p>}
    <div className="panel chat-panel"><div className="chat-list" ref={list} role="region" aria-label="会話の履歴" tabIndex={0} onScroll={()=>{const el=list.current;if(el){stickToBottom.current=el.scrollHeight-el.scrollTop-el.clientHeight<60;if(stickToBottom.current&&!search)setUnread(0)}}}>
      {visible.hidden>0&&<Button type="button" variant="ghost" className="history-button" onClick={()=>{const el=list.current;if(el)anchor.current={height:el.scrollHeight,top:el.scrollTop};stickToBottom.current=false;setVisibleCount(n=>n+100)}}>前の100件を表示（残り{visible.hidden}件）</Button>}
      {messages.length?visible.items.map((item,index)=>{
        const count=voteCount(a.data,item.id,'like'),liked=myVote(a.data,item.id)==='like',own=item.author===a.data.me;
        const previous=visible.items[index-1],day=new Date(item.created).toLocaleDateString('ja-JP');
        return <div className="chat-entry" key={item.id}>{(!previous||new Date(previous.created).toLocaleDateString('ja-JP')!==day)&&<div className="chat-date">{day}</div>}<article className={'message '+(own?'own':'')}><span className="avatar" aria-hidden="true">{Array.from(item.name)[0]}</span><div className="message-content"><div className="message-meta"><strong>{item.name}</strong><time dateTime={new Date(item.created).toISOString()}>{dateTime(item.created)}</time>{item.revision>1&&<span>編集済み</span>}</div>{item.body.parent&&<p className="chat-quote">{allMessages.find(parent=>parent.id===item.body.parent)?.body.text?.slice(0,140)??'削除されたメッセージ'}への返信</p>}<div className="message-text"><MessageText text={String(item.body.text)} query={search}/></div><div className="message-actions"><button className={'text-action '+(liked?'active':'')} aria-label={'いいね '+count} aria-pressed={liked} disabled={a.busy} onClick={()=>a.vote(item.id,'like',liked)}><ThumbsUp/>{count||'いいね'}</button><button className="text-action" disabled={!draft.ready} onClick={()=>setReply(item)}><MessageSquare/>返信</button><button className="text-action" onClick={()=>void copy(String(item.body.text))}><Copy/>コピー</button>{own&&<button className="text-action" disabled={a.busy} onClick={()=>setEditing(item)}><Pencil/>編集</button>}{(own||a.data.room.owner===a.data.me)&&<button className="text-action" aria-label={item.name+'のメッセージを削除'} disabled={a.busy} onClick={()=>a.remove(item)}><Trash2/></button>}</div></div></article></div>;
      }):<Blank title={search?'メッセージが見つかりません':'最初のメッセージを送る'} text={search?'検索の言葉を変えてみてください。':'上部の「招待」からリンクを共有できます。'}/>}
    </div>
    {unread>0&&<div className="chat-new" role="status"><Button size="sm" variant="secondary" onClick={latest}><ArrowDown size={16}/>新着 {unread}件 · 最新へ</Button></div>}
    {draft.value.parent&&<div className="replying"><span>{reply?reply.name+'への返信：'+String(reply.body.text).slice(0,70):'削除されたメッセージへの返信'}</span><button aria-label="返信を取り消す" onClick={()=>setReply(null)}><X size={18}/></button></div>}
    <DraftStatus draft={draft}/>
    <form className="composer" onSubmit={send}><div className="grow stack" style={{gap:8}}>{tool.labels.length>1&&<Picker value={draft.value.group} onChange={group=>draft.setValue(v=>({...v,group}))} label="投稿の話題" options={tool.labels}/>}<Textarea ref={input} rows={1} aria-label="メッセージ" disabled={!draft.ready} placeholder="メッセージを書く…" maxLength={10000} value={draft.value.text} onChange={e=>draft.setValue(v=>({...v,text:e.target.value}))} onKeyDown={e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)&&!e.nativeEvent.isComposing){e.preventDefault();void send(e)}}}/><div className="composer-meta"><span>Enterで改行 · Ctrl / ⌘ + Enterで送信</span><span>{draft.value.text.length.toLocaleString()} / 10,000</span></div></div><Button aria-label="メッセージを送信" disabled={a.busy||draft.sending||!draft.ready||!draft.value.text.trim()}><Send size={17}/><span className="desktop-only">送信</span></Button></form></div>
    {editing&&<MessageEditor key={editing.id} item={editing} a={a} onClose={()=>setEditing(null)}/>}
  </>;
}
