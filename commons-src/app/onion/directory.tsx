'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Check, Copy, ExternalLink, Globe2, RefreshCw, Search, Clock3, Radio } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import initial from '@/data/onion-snapshot.json';
import { isResponsive, isStale, nextUpdate, statusLabels, type OnionSite, type OnionSnapshot } from '@/lib/onion';
import './onion.css';

const formatTime = (at: string | null) => at ? new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(at)) : '未測定';
const formatFull = (at: string) => new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(at));
const filters = [ ['responsive', '応答あり'], ['all', 'すべて'], ['unreachable', '応答なし'], ['errors', '制限・エラー'], ['stale', '未測定・期限切れ'] ] as const;

function matchesFilter(site: OnionSite, filter: string, now: number) {
  if (filter === 'all') return true;
  if (filter === 'responsive') return isResponsive(site, now);
  if (filter === 'stale') return isStale(site.checkedAt, now);
  if (isStale(site.checkedAt, now)) return false;
  if (filter === 'errors') return site.status === 'restricted' || site.status === 'error';
  return site.status === filter;
}

export default function OnionDirectory() {
  const [data, setData] = useState(initial as OnionSnapshot);
  const [now, setNow] = useState(Date.parse(initial.importedAt));
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [filter, setFilter] = useState('responsive');
  const [page, setPage] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');
  const [message, setMessage] = useState('');
  const pageSize = 30;

  async function reload(manual = false) {
    if (manual) { setBusy(true); setError(''); }
    try {
      const response = await fetch('/commons/onion/snapshot.json', { cache: 'no-store' });
      if (!response.ok) throw new Error('更新データを取得できません。前回の一覧を表示しています。');
      const next = await response.json() as OnionSnapshot;
      if (next.schemaVersion !== 1 || !Array.isArray(next.sites) || !next.importedAt) throw new Error('更新データを読み取れません。前回の一覧を表示しています。');
      setData(next); setNow(Date.now());
      if (manual) setMessage('最新の掲載データを読み込みました。');
    } catch (e) {
      setError(e instanceof Error ? e.message : '更新できませんでした。');
    } finally { if (manual) setBusy(false); }
  }

  useEffect(() => {
    setNow(Date.now());
    const params = new URLSearchParams(window.location.search);
    if (params.get('q')) { setQuery(params.get('q')!.slice(0,500)); setFilter('all'); }
    void reload();
    const tick = window.setInterval(() => { setNow(Date.now()); if (document.visibilityState === 'visible') void reload(); }, 60000);
    return () => window.clearInterval(tick);
  }, []);
  useEffect(() => { setPage(0); }, [query, category, filter]);
  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(''), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const categories = useMemo(() => [...new Set(data.sites.map(s => s.categoryLabel))].sort((a,b) => a.localeCompare(b, 'ja')), [data]);
  const counts = useMemo(() => Object.fromEntries(filters.map(([key]) => [key, data.sites.filter(s => matchesFilter(s, key, now)).length])), [data, now]);
  const found = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return data.sites.filter(s => matchesFilter(s, filter, now) && (category === 'all' || s.categoryLabel === category) && words.every(word => [s.name, s.url, s.host, s.category, s.categoryLabel].join(' ').toLowerCase().includes(word))).sort((a,b) => a.name.localeCompare(b.name));
  }, [data, query, filter, category, now]);
  const pages = Math.max(1, Math.ceil(found.length / pageSize));
  const activePage = Math.min(page, pages - 1);
  const visible = found.slice(activePage * pageSize, (activePage + 1) * pageSize);
  const importOverdue = now - Date.parse(data.importedAt) > 26 * 60 * 60 * 1000;

  async function copy(value: string, id: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(id); setMessage(id === 'all' ? `${found.length}件のURLをコピーしました。` : 'URLをコピーしました。');
    } catch { setError('コピーできませんでした。URLの文字列を長押し、または選択してコピーしてください。'); }
  }

  return <div className="onion-page">
    <a className="skip-link" href="#onion-results">一覧へ移動</a>
    <header className="onion-header"><a href="/commons/" className="onion-home"><ArrowLeft size={18}/><span>COMMONS</span></a><div className="onion-wordmark"><Radio size={19}/>ONION CHECK</div><span className="onion-timezone">日本時間 / JST</span></header>
    <main className="onion-main">
      <section className="onion-intro">
        <div><p className="onion-kicker">URL DIRECTORY</p><h1>onion URLを確認</h1><p className="onion-description">公開URLの応答状況と、実際に測定された時刻を確認できます。</p></div>
        <div className="onion-schedule"><Clock3 size={20}/><div><strong>{data.schedule.enabled ? '毎日 0:00 にデータ更新を開始' : '毎日 0:00 の更新を設定中'}</strong><span>次回 {formatTime(nextUpdate(now))} · 日本時間</span></div></div>
      </section>

      <section className="onion-summary" aria-label="掲載状況">
        <div className="onion-summary-main"><span className="onion-signal"><Radio size={21}/></span><div><span>応答が確認されたURL</span><p><strong>{counts.responsive}</strong><span> / {data.sites.length} 件</span></p></div></div>
        <div className="onion-summary-date"><span>データ取り込み</span><time dateTime={data.importedAt}>{formatFull(data.importedAt)}</time><span>測定日時は各URLに表示</span></div>
        <button className="onion-refresh" onClick={() => void reload(true)} disabled={busy}><RefreshCw size={17} className={busy ? 'onion-spinning' : ''}/>{busy ? '読み込み中' : '一覧を再読み込み'}</button>
      </section>

      {(error || importOverdue) && <p className="onion-notice" role="alert">{error || '予定の更新時刻を過ぎています。前回のデータと測定日時を確認してください。'}</p>}
      <div className="onion-explainer"><span className="onion-note-label">対象範囲</span><p>Real-World Onion Sitesに掲載された公開URL。すべてのonionサイトを網羅するものではありません。応答状況は掲載元のTor経由の測定結果です。</p></div>

      <section className="onion-workspace" id="onion-results" tabIndex={-1}>
        <div className="onion-controls"><label className="onion-search"><Search size={20}/><input type="search" value={query} onChange={e => setQuery(e.target.value)} placeholder="サイト名・onion URLで検索" aria-label="サイト名またはonion URLを検索" autoComplete="off" spellCheck={false} maxLength={500}/></label><label className="onion-category"><span>カテゴリ</span><select value={category} onChange={e => setCategory(e.target.value)}><option value="all">すべて</option>{categories.map(c => <option value={c} key={c}>{c}</option>)}</select></label></div>
        <Tabs value={filter} onValueChange={setFilter}><TabsList className="onion-tabs">{filters.map(([value,label]) => <TabsTrigger key={value} value={value}>{label}<span>{counts[value]}</span></TabsTrigger>)}</TabsList></Tabs>
        <div className="onion-list-heading"><p><strong>{found.length}</strong> 件のURL{query && <span> · 検索結果</span>}</p><button onClick={() => void copy(found.map(s => s.url).join('\n'), 'all')} disabled={!found.length}>{copied === 'all' ? <Check size={16}/> : <Copy size={16}/>}表示対象のURLをコピー</button></div>
        {visible.length ? <Table className="onion-table"><TableHeader><TableRow><TableHead>サイト / onion URL</TableHead><TableHead>応答状況</TableHead><TableHead>最終測定 <span>JST</span></TableHead><TableHead><span className="sr-only">操作</span></TableHead></TableRow></TableHeader><TableBody>{visible.map(site => {
          const stale = isStale(site.checkedAt, now);
          const label = stale && site.checkedAt ? '測定が期限切れ' : statusLabels[site.status];
          const tone = stale ? 'unverified' : site.status;
          return <TableRow key={site.id}>
            <TableCell className="onion-site-cell"><div className="onion-site-name"><span className="onion-site-icon"><Globe2 size={18}/></span><h2>{site.name}</h2><span className="onion-category-tag">{site.categoryLabel}</span></div><a className="onion-url" href={site.url} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-label={`${site.name}をTor Browserで開く`}>{site.url}<ArrowUpRight size={13}/></a><details className="onion-evidence"><summary>出典・最近の測定</summary><div>{site.proofUrl && <a href={site.proofUrl} target="_blank" rel="noopener noreferrer">運営者の案内ページ<ExternalLink size={13}/></a>}<a href={data.source.url} target="_blank" rel="noopener noreferrer">公開測定データ<ExternalLink size={13}/></a><p>最後の正常応答：{formatTime(site.lastSuccessAt)}</p><ol>{site.history.map(check => <li key={check.at}><time dateTime={check.at}>{formatTime(check.at)}</time><span className={`onion-history-dot ${check.status}`}/><span>{statusLabels[check.status]}{check.httpStatus ? ` (${check.httpStatus})` : ''}</span></li>)}</ol></div></details></TableCell>
            <TableCell className="onion-status-cell"><span className={`onion-status ${tone}`}><span/>{label}</span>{site.httpStatus && <span className="onion-http">HTTP {site.httpStatus}</span>}</TableCell>
            <TableCell className="onion-measured"><span className="onion-mobile-label">最終測定</span><time dateTime={site.checkedAt ?? undefined}>{formatTime(site.checkedAt)}</time></TableCell>
            <TableCell className="onion-copy-cell"><button className="onion-copy" onClick={() => void copy(site.url, site.id)} aria-label={`${site.name}のURLをコピー`}>{copied === site.id ? <Check size={17}/> : <Copy size={17}/>}<span>{copied === site.id ? 'コピー済み' : 'コピー'}</span></button></TableCell>
          </TableRow>;
        })}</TableBody></Table> : <div className="onion-empty"><Search size={27}/><h2>条件に合うURLがありません</h2><p>検索語やカテゴリを変えてください。未掲載のURLについては、接続状況を判定できません。</p><button onClick={() => { setQuery(''); setCategory('all'); setFilter('all'); }}>すべての掲載URLを表示</button></div>}
        {pages > 1 && <nav className="onion-pagination" aria-label="URL一覧のページ"><span>{found.length}件中 {activePage * pageSize + 1}–{Math.min((activePage + 1) * pageSize, found.length)}件</span><div><button disabled={activePage === 0} onClick={() => setPage(activePage - 1)}>前へ</button><span>{activePage + 1} / {pages}</span><button disabled={activePage + 1 >= pages} onClick={() => setPage(activePage + 1)}>次へ</button></div></nav>}
      </section>

      <section className="onion-method"><h2>表示の見方</h2><div><p><strong>応答あり</strong>はHTTP 2xx、<strong>転送応答あり</strong>は3xxです。転送先の稼働までは確認していません。4xxはアクセス制限、5xxはサーバーエラーとして表示します。</p><p><strong>応答なし</strong>は閉鎖の確定ではありません。Torの混雑や測定側の接続障害も含みます。48時間を超えた測定は「期限切れ」とし、応答ありの件数から外します。</p><p>URLを開くにはTor Browserが必要です。毎日0時に公開データの取り込みを開始し、完了後に反映します。掲載元の測定時刻は更新時刻と異なります。</p></div></section>
      <footer className="onion-footer"><span>COMMONS / ONION CHECK</span><p>出典：<a href={data.source.url} target="_blank" rel="noopener noreferrer">{data.source.name}</a> · {data.source.author} · <a href={data.source.licenseUrl} target="_blank" rel="noopener noreferrer">CC BY-SA</a><br/>公開データからURLと測定結果を抽出し、日本語で分類・表示しています。</p></footer>
    </main>
    <div className="sr-only" role="status" aria-live="polite">{message}</div>
  </div>;
}
