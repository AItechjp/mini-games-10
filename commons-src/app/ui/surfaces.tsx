'use client';
import { useEffect, useRef, useState } from 'react';
import { Plus, Send, MessageSquare, ThumbsUp, Trash2, Pencil, Search, ArrowLeft, ArrowRight, CalendarDays, Check, Play, Pause, RotateCcw, Hand, ExternalLink, Clock, GripVertical, X } from 'lucide-react';
import type { Tool } from '@/lib/catalog';
import type { Item } from '@/lib/types';
import type { Actions } from './room';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Blank, Picker, dateTime } from './common';
import Canvas from './whiteboard';
import Chat from './chat';
import { useDraft } from '@/hooks/use-draft';
import { draftScope, isMessageDraft } from '@/lib/drafts';
import { DraftStatus } from './draft-status';
import { CollectionEditor as Editor } from './collection-editor';
import {myVote, scheduleChoice, voteCount} from '@/lib/vote-data';
import {pageWindow,recentWindow} from '@/lib/paging';
import {Pager} from './pager';
const kindMap: Record<string, string> = { notes: 'note', tasks: 'task', agenda: 'agenda', poll: 'option', schedule: 'slot', retro: 'card', links: 'link', directory: 'record', queue: 'hand' };
export function Surface({ tool, actions }: {
    tool: Tool;
    actions: Actions;
}) { if (tool.engine === 'canvas')
    return <Canvas tool={tool} actions={actions}/>; if (tool.engine === 'chat')
    return <Chat tool={tool} actions={actions}/>; if (tool.engine === 'timer')
    return <Timer tool={tool} actions={actions}/>; return <Collection tool={tool} actions={actions}/>; }
function CanDelete({ item, a }: {
    item: Item;
    a: Actions;
}) { return item.author === a.data.me || a.data.room.owner === a.data.me ? <button className="text-action" aria-label="削除" disabled={a.busy} onClick={() => a.remove(item)}><Trash2 /></button> : null; }
function Like({ item, a }: {
    item: Item;
    a: Actions;
}) { const count = voteCount(a.data,item.id,'like'); const mine = myVote(a.data,item.id)==='like'; return <button className={`text-action ${mine ? 'active' : ''}`} aria-label={`いいね ${count}`} aria-pressed={mine} disabled={a.busy} onClick={() => a.vote(item.id, 'like', mine)}><ThumbsUp />{count || 'いいね'}</button>; }
export function Discussion({ actions: a, parent = 'room', title = 'ルームの会話' }: {
    actions: Actions;
    parent?: string;
    title?: string;
}) {
    const draft = useDraft(draftScope(a.data.room.id, a.data.me, 'comment', parent), {text: '', group: '', parent}, isMessageDraft);
    const text = draft.value.text;
    const setText = (text: string) => draft.setValue(v => ({...v, text}));
    const comments = a.data.items.filter(i => i.kind === 'comment' && i.body.parent === parent);
    const [visibleCount,setVisibleCount]=useState(50);
    const visibleComments=recentWindow(comments,visibleCount,50);
    async function submit(e: React.FormEvent) {
        e.preventDefault(); if (!text.trim() || a.busy) return;
        await draft.submit((v, id) => {const body = {text: v.text, parent}; return a.add('comment', body, id(body));}, v => ({...v, text: ''}));
    }
    return <div className="panel discussion"><div className="panel-title"><MessageSquare size={16}/>{title}<span className="mini-tag" style={{ marginLeft: 'auto' }}>{comments.length}</span></div><div className="panel-body comment-list">{visibleComments.hidden>0&&<Button type="button" variant="ghost" size="sm" className="history-button" onClick={()=>setVisibleCount(n=>n+50)}>過去のコメントをさらに50件表示（残り{visibleComments.hidden}件）</Button>}{comments.length ? visibleComments.items.map(c => <div className="comment" key={c.id}><strong>{c.name}<time>{dateTime(c.created)}</time></strong><p>{c.body.text}</p><CanDelete item={c} a={a}/></div>) : <p className="form-hint">相談や補足をここで共有できます。</p>}</div><DraftStatus draft={draft}/><form className="composer" onSubmit={submit}><Textarea aria-label="コメント" disabled={!draft.ready} placeholder="ひとこと書く…" value={text} maxLength={10000} onChange={e => setText(e.target.value)}/><Button size="sm" disabled={a.busy || draft.sending || !draft.ready || !text.trim()}><Send size={14}/>送信</Button></form></div>;
}
function Collection({ tool, actions: a }: {
    tool: Tool;
    actions: Actions;
}) {
    const [query, setQuery] = useState('');
    const [group, setGroup] = useState('すべて');
    const [sort, setSort] = useState('追加した順');
    const [page,setPage]=useState(1);
    const [boardVisible,setBoardVisible]=useState<Record<string,number>>({});
    const top=useRef<HTMLDivElement>(null);
    const [editor, setEditor] = useState<{
        item: Item | null;
        group: string;
    } | null>(null);
    const [discuss, setDiscuss] = useState<Item | null>(null);
    const kind = kindMap[tool.engine];
    const entries = a.data.items.filter(i => i.kind === kind);
    let shown = entries.filter(i => (group === 'すべて' || i.body.group === group) && JSON.stringify(i.body).toLowerCase().includes(query.toLowerCase()));
    if (sort === '期限順')
        shown = [...shown].sort((x, y) => (x.body.due || '9999').localeCompare(y.body.due || '9999'));
    if (tool.engine === 'schedule')
        shown = [...shown].sort((x, y) => Date.parse(x.body.date) - Date.parse(y.body.date));
    const isBoard = tool.engine === 'tasks' || tool.engine === 'retro';
    const pageData=pageWindow(shown,page,tool.engine==='schedule'?20:50);
    useEffect(()=>{setPage(1);setBoardVisible({})},[query,group,sort,tool.id]);
    const goPage=(next:number)=>{setPage(next);requestAnimationFrame(()=>top.current?.scrollIntoView({behavior:'smooth',block:'start'}))};
    const toolsBar = <div ref={top} className="surface-toolbar"><h2 className="grow">{entries.length}件{tool.engine === 'tasks' && <span className="muted small"> · {entries.filter(i=>i.body.group===tool.labels.at(-1)).length} 完了</span>}</h2><div className="search-box"><Search /><input aria-label="ルーム内を検索" placeholder="内容を検索" value={query} onChange={e=>setQuery(e.target.value)}/></div>{tool.engine==='tasks'&&<Picker label="並び順" value={sort} onChange={setSort} options={['追加した順','期限順']}/>}<Button disabled={a.busy} onClick={()=>setEditor({item:null,group:tool.labels[0]??''})}><Plus size={16}/>{tool.engine==='poll'?'候補を追加':tool.engine==='schedule'?'日時を追加':tool.engine==='queue'?'手を挙げる':'追加する'}</Button></div>;
    function editButton(i: Item) { return <button className="text-action" aria-label="編集" onClick={() => setEditor({ item: i, group: i.body.group ?? '' })}><Pencil /></button>; }
    function controls(i: Item) { return <div className="message-actions"><Like item={i} a={a}/><button className="text-action" onClick={() => setDiscuss(i)}><MessageSquare />{a.data.items.filter(c => c.kind === 'comment' && c.body.parent === i.id).length || 'コメント'}</button>{editButton(i)}<CanDelete item={i} a={a}/></div>; }
    function taskCard(i:Item){const complete=tool.engine==='tasks'&&i.body.group===tool.labels.at(-1);const late=i.body.due&&!complete&&new Date(i.body.due+'T23:59:59')<new Date();const n=tool.labels.indexOf(i.body.group);return <article className="item-card" key={i.id} draggable onDragStart={e=>e.dataTransfer.setData('text/plain',i.id)}><div className="row" style={{alignItems:'flex-start',gap:9}}>{tool.engine==='tasks'&&<Checkbox aria-label={`${i.body.text}を完了にする`} checked={complete} disabled={a.busy} onCheckedChange={v=>a.edit(i,{...i.body,group:v?tool.labels.at(-1):tool.labels[0]})} style={{marginTop:4}}/>}<h3 className="grow" style={{textDecoration:complete?'line-through':undefined}}>{i.body.text}</h3></div>{i.body.detail&&<p className="description">{i.body.detail}</p>}<div className="item-footer"><span>{i.body.assignee||i.name}</span>{i.body.due&&<span className={`due ${late?'late':''}`}>{i.body.due}</span>}</div>{controls(i)}<div className="card-actions">{n>0&&<Button size="sm" variant="secondary" disabled={a.busy} onClick={()=>a.edit(i,{...i.body,group:tool.labels[n-1]})} aria-label={`${tool.labels[n-1]}へ移動`}><ArrowLeft/>{tool.labels[n-1]}</Button>}{n>=0&&n<tool.labels.length-1&&<Button size="sm" variant="secondary" disabled={a.busy} onClick={()=>a.edit(i,{...i.body,group:tool.labels[n+1]})} aria-label={`${tool.labels[n+1]}へ移動`}>{tool.labels[n+1]}<ArrowRight/></Button>}</div></article>}
    return <>{toolsBar}{tool.labels.length > 1 && !isBoard && tool.engine !== 'poll' && <Tabs className="filter-tabs" value={group} onValueChange={setGroup}><TabsList>{['すべて', ...tool.labels].map(l => <TabsTrigger key={l} value={l}>{l}</TabsTrigger>)}</TabsList></Tabs>}
        {isBoard ? <div className="board-columns" style={{ '--cols': tool.labels.length } as React.CSSProperties}>{tool.labels.map(l => {const column=shown.filter(i=>i.body.group===l);const visible=recentWindow(column,boardVisible[l]??40,40);return <section className="board-column" key={l} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const item=entries.find(i=>i.id===e.dataTransfer.getData('text/plain'));if(item&&!a.busy)a.edit(item,{...item.body,group:l})}}><h3 className="column-heading">{l}<span>{column.length}</span></h3>{visible.hidden>0&&<Button type="button" variant="ghost" size="sm" className="history-button full-button" onClick={()=>setBoardVisible(v=>({...v,[l]:(v[l]??40)+40}))}>以前の項目をさらに40件表示（残り{visible.hidden}件）</Button>}{visible.items.map(taskCard)}<Button variant="ghost" size="sm" className="full-button" disabled={a.busy} onClick={()=>setEditor({item:null,group:l})}><Plus size={14}/>追加</Button></section>})}</div> :
            !shown.length ? <Blank title={query||group!=='すべて' ? '条件に一致する項目がありません' : 'まだ項目はありません'} text={query||group!=='すべて'?'検索語や絞り込みを変更してください。':tool.engine==='poll'?'候補を追加して投票を始めましょう。':'上の追加ボタンから、最初のひとつを登録してください。'}/> :
                tool.engine === 'poll' ? <><p className="list-summary">{voteCount(a.data,'poll')}人が投票済み · 1人1票（同じブラウザー単位）</p>{pageData.items.map(i => { const total=voteCount(a.data,'poll'); const count=voteCount(a.data,'poll',i.id); const selected=myVote(a.data,'poll')===i.id; const pct = total ? Math.round(count / total * 100) : 0; return <article className={`vote-option ${selected ? 'selected' : ''}`} key={i.id}><div className="vote-title"><span>{i.body.text}</span><Button size="sm" variant={selected ? 'default' : 'outline'} disabled={a.busy} onClick={() => a.vote('poll', i.id, selected)}>{selected ? <><Check size={14}/>投票済み</> : '投票する'}</Button></div><Progress className="vote-bar" value={pct} aria-label={`${i.body.text} ${pct}%`}/><div className="vote-footer"><span>{count}票</span><span>{pct}%</span></div><div className="message-actions">{editButton(i)}<CanDelete item={i} a={a}/></div></article>; })}</> :
                    tool.engine === 'schedule' ? <><div className="records-grid">{pageData.items.map(i => { const me=myVote(a.data,i.id); return <article className="item-card" key={i.id}><h3 className="slot-title">{i.body.text}</h3><p className="slot-date"><CalendarDays size={14} style={{ display: 'inline', marginRight: 5 }}/>{new Date(i.body.date).toLocaleString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit' })}</p><div className="slot-responses">{[['yes', '○ 参加'], ['maybe', '△ 未定'], ['no', '× 不可']].map(([k, l]) => <Button key={k} size="sm" disabled={a.busy} variant={me === k ? 'default' : 'outline'} onClick={() => a.vote(i.id, k)}>{l} {voteCount(a.data,i.id,k)}</Button>)}</div><p className="slot-members">{a.data.members.map((m,index)=>[m,scheduleChoice(a.data,i.id,index)] as const).filter(([,choice])=>choice).map(([m,choice]) => `${m.name} ${choice==='yes'?'○':choice==='maybe'?'△':'×'}`).join(' / ')||'まだ回答はありません'}</p>{controls(i)}</article>; })}</div><div className="panel grid-table" style={{ marginTop: 24 }}><Table><TableHeader><TableRow><TableHead>メンバー</TableHead>{pageData.items.map(i => <TableHead key={i.id}>{i.body.text}<br />{dateTime(Date.parse(i.body.date))}</TableHead>)}</TableRow></TableHeader><TableBody>{a.data.members.map((m,memberIndex) => <TableRow key={m.actor}><TableCell>{m.name}</TableCell>{pageData.items.map(i => { const choice=scheduleChoice(a.data,i.id,memberIndex); return <TableCell key={i.id}>{choice==='yes'?'○':choice==='maybe'?'△':choice==='no'?'×':'—'}</TableCell>; })}</TableRow>)}</TableBody></Table></div></> :
                        tool.engine === 'notes' ? pageData.items.map(i => <article key={i.id} className={`note-card ${tool.id === 'snippets' && i.body.group === 'コード' ? 'code' : ''}`}><div className="row spread"><span className="mini-tag">{i.body.group || 'メモ'}</span><span className="small muted">{i.name}</span></div><div className="note-text">{i.body.text}</div>{controls(i)}</article>) :
                            tool.engine === 'agenda' ? <>{pageData.items.map((i, n) => <article className={`note-card ${i.body.done ? 'agenda-done' : ''}`} key={i.id}><div className="row"><Checkbox aria-label={`${i.body.text}の完了`} checked={!!i.body.done} onCheckedChange={v => a.edit(i, { ...i.body, done: v })}/><h3 className="grow" style={{ fontSize: 16 }}>{pageData.from+n}. {i.body.text}</h3><span className="mini-tag">{i.body.minutes || 5}分</span></div><p className="small muted" style={{ margin: '12px 0' }}>話す人：{i.body.assignee || '未定'}</p><Button size="sm" variant="secondary" disabled={a.busy} onClick={() => { const timer=a.data.items.find(x=>x.id==='timer');const b={duration:Number(i.body.minutes||5)*60,remaining:Number(i.body.minutes||5)*60,running:true,endsAt:Date.now()+(a.data.clockOffset??0)+Number(i.body.minutes||5)*60000,label:i.body.text};if(timer)
                                a.edit(timer, b);
                            else
                                a.add('timer', b, 'timer'); }}><Play size={14}/>議題のタイマーを開始</Button>{controls(i)}</article>)}{a.data.items.some(i => i.kind === 'timer') && <Timer tool={tool} actions={a}/>}</> :
                                tool.engine === 'queue' ? <div className="panel">{pageData.items.filter(i=>!i.body.done).map(i=><div className="queue-item" key={i.id}><span className="queue-number">{shown.indexOf(i)+1}</span><div className="grow"><h3>{i.name}</h3><p>{i.body.text}</p></div><Button variant="outline" size="sm" disabled={a.busy} onClick={()=>a.edit(i,{...i.body,done:true})}>発言完了</Button><CanDelete item={i} a={a}/></div>)}{shown.every(i=>i.body.done)&&<Blank title="発言待ちはいません" text="話したいことがあれば、手を挙げるボタンを押してください。"/>}<div className="panel-body"><p className="small muted">発言済み：{shown.filter(i=>i.body.done).map(i=>i.name).join('、')||'まだいません'}</p></div></div> :
                                    <div className="records-grid">{pageData.items.map(i=><article className="item-card" key={i.id}><h3>{i.body.text}</h3>{tool.engine==='links'?<><p className="description">{i.body.detail}</p><a className="link-url" href={safeUrl(i.body.url)} target="_blank" rel="noreferrer noopener"><ExternalLink size={13} style={{display:'inline',marginRight:5}}/>{i.body.url}</a><span className="mini-tag" style={{display:'inline-block',marginTop:10}}>{i.body.group}</span></>:tool.fields.slice(1).map((f,n)=><div className="record-field" key={f}><label>{f}</label><p>{i.body.values?.[n+1]||'—'}</p></div>)}<div className="item-footer"><span>{i.name}</span><span>{dateTime(i.created)}</span></div>{controls(i)}</article>)}</div>}
    {!isBoard&&shown.length>0&&<Pager value={pageData} onChange={goPage}/>}
    {editor && <Editor key={editor.item?.id ?? `new-${editor.group}`} tool={tool} kind={kind} item={editor.item} initialGroup={editor.group} actions={a} onClose={() => setEditor(null)}/>}
    <Dialog open={!!discuss} onOpenChange={v => { if (!v)
        setDiscuss(null); }}><DialogContent><DialogHeader><DialogTitle>コメント</DialogTitle><DialogDescription>{String(discuss?.body.text ?? '').slice(0, 150)}</DialogDescription></DialogHeader>{discuss && <Discussion key={discuss.id} actions={a} parent={discuss.id} title="この項目へのコメント"/>}</DialogContent></Dialog></>;
}
function safeUrl(url: unknown) { try {
    const u = new URL(String(url));
    return ['http:', 'https:'].includes(u.protocol) ? u.href : undefined;
}
catch {
    return undefined;
} }
function Timer({ tool, actions: a }: {
    tool: Tool;
    actions: Actions;
}) {
    const timer = a.data.items.find(i => i.id === 'timer');
    const b = timer?.body;
    const [clock, setClock] = useState(Date.now());
    const [minutes, setMinutes] = useState(tool.minutes ?? 25);
    const [target, setTarget] = useState('');
    const [label, setLabel] = useState(tool.labels[0] ?? 'タイマー');
    useEffect(() => { const t = setInterval(() => setClock(Date.now()), 250); return () => clearInterval(t); }, []);
    if (!b)
        return <Blank title="タイマーを準備しています" text="議題からタイマーを開始してください。"/>;
    const seconds = b.running ? Math.max(0, Math.ceil((b.endsAt - (clock + (a.data.clockOffset ?? 0))) / 1000)) : Math.max(0, Math.ceil(b.remaining));
    const h = Math.floor(seconds / 3600);
    const display = `${h ? `${h}:` : ''}${String(Math.floor(seconds % 3600 / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    function patch(next: Record<string, any>) { if (timer)
        a.edit(timer, { ...b, ...next }); }
    function configure() { const duration = target ? Math.ceil((new Date(target).getTime() - (Date.now() + (a.data.clockOffset ?? 0))) / 1000) : minutes * 60; if (!Number.isFinite(duration) || duration <= 0 || duration > 31536000) {
        a.notify('未来の日時、または有効な分数を指定してください');
        return;
    } patch({ duration, remaining: duration, running: false, endsAt: 0, label }); }
    return <div className="timer-panel"><span className="mini-tag">{b.label ?? label}</span><div className="timer-face" aria-label="残り時間">{display}</div><p className="muted small" role="status">{b.running ? (seconds ? 'みんなで同じ時間を共有中' : '時間になりました') : '開始すると全員の画面に反映されます'}</p><div className="timer-controls" style={{ marginTop: 23 }}><Button disabled={a.busy || (!seconds && !b.running)} onClick={() => patch(b.running ? { remaining: seconds, running: false } : { running: true, endsAt: Date.now() + (a.data.clockOffset ?? 0) + seconds * 1000 })}>{b.running ? <><Pause size={16}/>一時停止</> : <><Play size={16}/>スタート</>}</Button><Button variant="outline" disabled={a.busy} onClick={() => patch({ remaining: b.duration, running: false, endsAt: 0 })}><RotateCcw size={16}/>リセット</Button></div><div className="timer-settings"><div className="field"><label htmlFor="timer-minutes">時間（分）</label><Input id="timer-minutes" type="number" min={1} max={525600} value={minutes} onChange={e => { setMinutes(Number(e.target.value)); setTarget(''); }}/></div>{tool.labels.length > 1 && <div className="field"><label>モード</label><Picker value={label} onChange={v => { setLabel(v); if (v === '休憩')
        setMinutes(5); }} options={tool.labels} label="タイマーのモード"/></div>}<Button disabled={a.busy || b.running} variant="secondary" onClick={configure}>設定を反映</Button>{tool.id === 'countdown' && <div className="field" style={{ minWidth: '100%' }}><label htmlFor="timer-date">または開催日時</label><Input id="timer-date" type="datetime-local" value={target} onChange={e => setTarget(e.target.value)}/></div>}</div></div>;
}
