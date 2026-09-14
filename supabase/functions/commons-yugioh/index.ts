import { ORIGIN, PAGE_SIZE, parseSearch, parseSets, parseDetail, searchParams, validId, japanDate, filterPack } from './core.mjs';
import { PUBLIC_KEY } from './public-key.mjs';

// Public catalog reader. It neither reads nor writes the database or private data.
const origins = new Set(['https://aitechd.com', 'https://www.aitechd.com']);
const cache = new Map<string, { at: number; data: any }>();
const pending = new Map<string, Promise<any>>();
const budgets = new Map<string, { at: number; count: number }>();
let active = 0;
const headers = (origin: string | null) => ({
  'Access-Control-Allow-Origin': origin && origins.has(origin) ? origin : 'https://aitechd.com',
  'Access-Control-Allow-Headers': 'apikey, content-type, x-region',
  'Access-Control-Allow-Methods': 'GET, OPTIONS', 'Access-Control-Max-Age': '600',
  'Vary': 'Origin', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
});
async function upstream(path: string, body?: URLSearchParams) {
  // Fixed origin and fixed paths: this is not an arbitrary URL proxy.
  const r = await fetch(ORIGIN + path, { method: body ? 'POST' : 'GET', body,
    redirect: 'error', signal: AbortSignal.timeout(22000),
    headers: { 'User-Agent': 'AItech-Card-Library/1.0 (+https://aitechd.com/commons/yugioh-flavor/)', 'Accept': 'text/html' } });
  if (!r.ok) { await r.body?.cancel(); throw new Error(r.status === 429 ? '公式検索が混み合っています。時間をおいて再試行してください。' : '公式検索に接続できませんでした。'); }
  const reader = r.body?.getReader(); if (!reader) throw new Error('公式検索の応答が空です。');
  const decoder = new TextDecoder(); let html = '', size = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length;
    if (size > 2000000) { await reader.cancel(); throw new Error('公式検索の応答を確認できませんでした。'); }
    html += decoder.decode(value, { stream: true }); }
  return html + decoder.decode();
}
async function cached(key: string, ttl: number, fn: () => Promise<any>) {
  const saved = cache.get(key); if (saved && Date.now() - saved.at < ttl) return saved.data;
  if (pending.has(key)) return pending.get(key);
  if (active >= 4) throw new Error('カードの読み込みが混み合っています。少し待って再試行してください。');
  const work = (async () => { active++; try {
    const data = await fn(); if (cache.size >= 160) cache.delete(cache.keys().next().value!);
    cache.set(key, { at: Date.now(), data }); return data;
  } finally { active--; pending.delete(key); } })();
  pending.set(key, work); return work;
}
export async function handler(request: Request) {
  const origin = request.headers.get('origin');
  const send = (data: any, status = 200) => Response.json(data, { status, headers: headers(origin) });
  if (origin && !origins.has(origin)) return send({ error: 'このサイトからは利用できません。' }, 403);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: headers(origin) });
  if (request.method !== 'GET') return send({ error: 'GETのみ利用できます。' }, 405);
  if (request.headers.get('apikey') !== PUBLIC_KEY) return send({ error: 'カード検索の接続設定を確認してください。' }, 401);
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anonymous';
  const now = Date.now(), b = budgets.get(ip);
  if (!b || now - b.at > 60000) budgets.set(ip, { at: now, count: 1 });
  else if (++b.count > 100) return send({ error: '読み込み回数が多いため、1分ほど待ってください。' }, 429);
  if (budgets.size > 1500) budgets.clear();
  const q = new URL(request.url).searchParams;
  try {
    const today = japanDate();
    if (q.get('kind') === 'detail') {
      const id = q.get('id') || ''; if (!validId(id)) return send({ error: 'カード番号が不正です。' }, 400);
      return send(await cached('detail:' + today + ':' + id, 3600000, async () => parseDetail(await upstream('/yugiohdb/card_search.action?ope=2&request_locale=ja&cid=' + id), id, today)));
    }
    if (q.get('kind') === 'sets') return send(await cached('sets:' + today, 3600000, async () => ({ sets: parseSets(await upstream('/yugiohdb/card_list.action?clm=3&request_locale=ja'), today), fetchedAt: new Date().toISOString() })));
    if (q.get('kind') !== 'search') return send({ error: '検索種別が不正です。' }, 400);
    let spec; try { spec = searchParams(q, today); } catch (e) { return send({ error: (e as Error).message }, 400); }
    if (spec.params.has('pid')) {
      const pid = spec.params.get('pid')!;
      const path = '/yugiohdb/card_search.action?ope=1&request_locale=ja&rp=99999&pid=' + pid;
      const result = await cached('pack:' + today + ':' + pid, 3600000, async () => {
        const html = await upstream(path);
        const date = html.match(/id="previewed"[^>]*>[\s\S]*?(\d{4})年(\d{2})月(\d{2})日/);
        if (!date || date.slice(1).join('-') > today) throw new Error('このセットの発売済み情報を確認できませんでした。');
        return { ...parseSearch(html, true), fetchedAt: new Date().toISOString() };
      });
      let filtered; try { filtered = filterPack(result, q, spec.page); } catch (e) { return send({ error: (e as Error).message }, 400); }
      return send({ ...filtered, page: spec.page, pageSize: PAGE_SIZE, cutoff: today, fetchedAt: result.fetchedAt,
        sourceUrl: ORIGIN + path, coverage: 'official-ocg-catalog', releaseScope: 'official-date-through-today' });
    }
    const path = '/yugiohdb/card_search.action?' + spec.params;
    const result = await cached('search:' + spec.params, 900000, async () => ({ ...parseSearch(await upstream(path)), fetchedAt: new Date().toISOString() }));
    return send({ ...result, page: spec.page, pageSize: PAGE_SIZE, cutoff: today,
      sourceUrl: ORIGIN + path, coverage: 'official-ocg-catalog', releaseScope: 'official-date-through-today' });
  } catch (e) { return send({ error: e instanceof Error ? e.message : 'カードを取得できませんでした。' }, 502); }
}
Deno.serve(handler);
