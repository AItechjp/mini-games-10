'use client';
import {useState} from 'react';
import type {Tool} from '@/lib/catalog';
import type {Item} from '@/lib/types';
import type {Actions} from './room';
import {useDraft} from '@/hooks/use-draft';
import {draftScope, isEditorDraft, type EditorDraft} from '@/lib/drafts';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Textarea} from '@/components/ui/textarea';
import {Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription} from '@/components/ui/dialog';
import {Picker, dateTime} from './common';
import {DiscardChanges} from './discard-changes';
import {DraftStatus} from './draft-status';

function localDate(iso: string) {
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '';
}
export function CollectionEditor({tool, kind, item, initialGroup, actions: a, onClose}: {
  tool: Tool; kind: string; item: Item | null; initialGroup: string; actions: Actions; onClose: () => void;
}) {
  const initial: EditorDraft = {
    text: item?.body.text ?? '', group: item?.body.group ?? initialGroup,
    assignee: item?.body.assignee ?? '', due: item?.body.due ?? '', detail: item?.body.detail ?? '',
    url: item?.body.url ?? '', minutes: item?.body.minutes ?? 5,
    date: item?.body.date ? localDate(item.body.date) : '', values: item?.body.values ?? tool.fields.map(() => '')
  };
  const draft = useDraft(draftScope(a.data.room.id, a.data.me, 'editor', tool.id, item?.id ?? `new:${initialGroup}`), initial, isEditorDraft, item ? String(item.revision) : 'new');
  const v = draft.value;
  const [error, setError] = useState('');
  const [discard, setDiscard] = useState(false);
  const busy = a.busy || draft.sending || !draft.ready;
  const board = tool.engine === 'tasks';
  const record = tool.engine === 'directory';
  const latest = item ? a.data.items.find(i => i.id === item.id) : null;
  const conflict = !!item && (!latest || String(latest.revision) !== draft.base);
  function field<K extends keyof EditorDraft>(key: K, value: EditorDraft[K]) { draft.setValue(previous => ({...previous, [key]: value})); }
  function close() { if (busy) return; if (draft.dirty) setDiscard(true); else onClose(); }
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (busy) return;
    const asNew = (e.nativeEvent as SubmitEvent).submitter?.getAttribute('name') === 'save-copy';
    setError('');
    if (tool.engine === 'links') {
      try { if (!['http:', 'https:'].includes(new URL(v.url).protocol)) throw new Error(); }
      catch { setError('http または https で始まるURLを入力してください。'); return; }
    }
    if (v.date && !Number.isFinite(new Date(v.date).getTime())) { setError('有効な日時を入力してください。'); return; }
    const ok = await draft.submit((sent, operationId) => {
      const body = {...item?.body, ...sent, text: record ? sent.values[0] : sent.text, date: sent.date ? new Date(sent.date).toISOString() : undefined};
      return item && !asNew ? a.edit({...item, revision: Number(draft.base)}, body) : a.add(kind, body, operationId(body));
    }, initial);
    if (ok) onClose();
    else setError('保存できませんでした。入力は残っています。通信状態と最新の内容を確認してください。');
  }
  return <>
    <Dialog open onOpenChange={open => {if (!open) close();}}><DialogContent><DialogHeader>
      <DialogTitle>{item ? '内容を編集' : tool.engine === 'queue' ? '手を挙げる' : '新しく追加'}</DialogTitle>
      <DialogDescription>{tool.name}に内容を保存して共有します。</DialogDescription>
    </DialogHeader>
    <DraftStatus draft={draft}/>
    {conflict && <section className="draft-conflict" aria-label="共有内容の更新">
      <p>{latest ? '編集中に共有内容が更新されています。あなたの下書きは下の入力欄に残っています。' : '元の項目は削除されています。あなたの下書きは残っています。'}</p>
      {latest && <><h3>最新の共有内容 <span>{dateTime(latest.updated)}</span></h3><div className="draft-latest">{[latest.body.text, latest.body.detail, latest.body.group, latest.body.assignee, latest.body.due, latest.body.date, latest.body.url, ...(latest.body.values ?? [])].filter(Boolean).join('\n')}</div></>}
      <p>新しい内容は上書きしません。この下書きは「別の項目として保存」できます。</p>
    </section>}
    <form onSubmit={save} className="stack dialog-form"><fieldset disabled={busy} className="draft-fields stack">
      {tool.labels.length > 0 && tool.engine !== 'poll' && <div className="field"><label>項目</label><Picker label="項目" value={v.group} onChange={value => field('group', value)} options={tool.labels}/></div>}
      {record ? tool.fields.map((name, i) => <div className="field" key={name}><label htmlFor={`entry-${i}`}>{name}</label><Textarea id={`entry-${i}`} rows={2} style={{minHeight: 65}} required={i === 0} maxLength={i === 0 ? 500 : 10000} value={v.values[i] ?? ''} onChange={e => field('values', tool.fields.map((_, n) => n === i ? e.target.value : v.values[n] ?? ''))}/></div>) :
        <div className="field"><label htmlFor="entry-text">{tool.engine === 'schedule' ? '予定・候補名' : tool.engine === 'poll' ? '候補' : (tool.engine === 'retro' && tool.fields.length > 1 ? tool.fields[1] : tool.fields[0]) || '内容'}</label><Textarea id="entry-text" required maxLength={10000} value={v.text} onChange={e => field('text', e.target.value)} placeholder="内容を書いてください…"/></div>}
      {(board || tool.engine === 'agenda') && <><div className="field"><label htmlFor="entry-assignee">{tool.fields[1] || '担当者'}</label><Input id="entry-assignee" value={v.assignee} maxLength={60} onChange={e => field('assignee', e.target.value)}/></div>
        {board ? <><div className="field"><label htmlFor="entry-due">{tool.fields[2] || '期限'}</label><Input id="entry-due" type="date" value={v.due} onChange={e => field('due', e.target.value)}/></div><div className="field"><label htmlFor="entry-detail">補足</label><Textarea id="entry-detail" value={v.detail} maxLength={10000} onChange={e => field('detail', e.target.value)}/></div></> :
          <div className="field"><label htmlFor="entry-minutes">持ち時間（分）</label><Input type="number" id="entry-minutes" min={1} max={240} value={v.minutes} required onChange={e => field('minutes', Number(e.target.value))}/></div>}
      </>}
      {tool.engine === 'schedule' && <div className="field"><label htmlFor="entry-date">日時（この端末のタイムゾーン）</label><Input id="entry-date" required type="datetime-local" value={v.date} onChange={e => field('date', e.target.value)}/></div>}
      {tool.engine === 'links' && <><div className="field"><label htmlFor="entry-url">URL</label><Input id="entry-url" type="url" required placeholder="https://…" value={v.url} maxLength={2048} onChange={e => field('url', e.target.value)}/></div><div className="field"><label htmlFor="entry-description">{tool.fields[2] || '説明'}</label><Textarea id="entry-description" value={v.detail} maxLength={10000} onChange={e => field('detail', e.target.value)}/></div></>}
      {tool.engine === 'retro' && tool.fields.length > 1 && <div className="field"><label htmlFor="entry-extra">{tool.fields[0]}</label><Input id="entry-extra" value={v.detail} maxLength={1000} onChange={e => field('detail', e.target.value)}/></div>}
      {error && <p className="notice" role="alert">{error}</p>}
      <Button type="submit" className="full-button" disabled={!!item && !latest}>{busy ? '保存中…' : conflict ? '元の項目への保存を再試行' : '保存する'}</Button>
      {conflict && <Button type="submit" name="save-copy" variant="secondary" className="full-button">別の項目として保存</Button>}
    </fieldset>
    {draft.dirty && draft.stored && <Button type="button" variant="ghost" disabled={busy} onClick={onClose}>下書きを残して閉じる</Button>}
    </form></DialogContent></Dialog>
    <DiscardChanges open={discard} onOpenChange={setDiscard} onDiscard={() => {draft.discard(); onClose();}}/>
  </>;
}
