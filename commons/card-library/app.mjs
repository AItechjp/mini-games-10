import { mtgQuery, mtgPage, normalizeMTG, safeURL, japanDate, MTG_PAGE_SIZE } from './catalog-core.mjs';

const game = document.body.dataset.game;
const dm = game === 'dm';
const $ = id => document.getElementById(id);
const endpoint = 'https://dcvtubivtextycifngtk.supabase.co/functions/v1/commons-cards';
const publicKey = 'sb_publishable_IcEN-3GgzcLCHiyNLyRiCQ_RpkAhCGI';
const form = $('search-form'), dialog = $('reader-dialog');
let state = {}, page = 1, total = 0, cards = [], controller, generation = 0, readerIndex = -1;
let sfQueue = Promise.resolve(), lastSF = 0;
const memory = new Map();
const languageNames = { ja: '日本語', en: 'English', de: 'Deutsch', fr: 'Français', it: 'Italiano', es: 'Español', pt: 'Português', ru: 'Русский', ko: '한국어', zhs: '简体中文', zht: '繁體中文', la: 'Latin', grc: 'Greek', sa: 'Sanskrit', he: 'Hebrew', ar: 'Arabic', ph: 'Phyrexian' };
const rarityNames = { common: 'コモン', uncommon: 'アンコモン', rare: 'レア', mythic: '神話レア' };
function el(tag, className, value) { const n = document.createElement(tag); if (className) n.className = className; if (value !== undefined) n.textContent = value; return n; }
function option(value, name) { const n = el('option', '', name); n.value = value; return n; }
function readForm() { return { ...Object.fromEntries(new FormData(form)), oracle: state.oracle || '' }; }
function formatDate(value) { return new Intl.DateTimeFormat('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
function dateLabel() { $('cutoff').textContent = japanDate().replaceAll('-', '/'); }
async function jsonFetch(url, signal, headers = {}) {
  const timer = AbortSignal.timeout(24000);
  const response = await fetch(url, { signal: signal ? AbortSignal.any([signal, timer]) : timer, headers, credentials: 'omit' });
  let data; try { data = await response.json(); } catch { throw new Error('データの応答を読み取れませんでした。再試行してください。'); }
  if (response.status === 404 && data.object === 'error' && data.code === 'not_found') return { data: [], total_cards: 0 };
  if (!response.ok) throw new Error(response.status === 429 ? '読み込みが集中しています。1分ほど待って再試行してください。' : data.error || data.details || 'カード情報を取得できませんでした。');
  return data;
}
async function scryfall(path, signal) {
  const key = 'sf:' + path, saved = memory.get(key);
  if (saved && Date.now() - saved.at < 900000) return saved.data;
  const job = sfQueue.catch(() => {}).then(async () => {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    await new Promise(r => setTimeout(r, Math.max(0, 140 - (Date.now() - lastSF))));
    lastSF = Date.now();
    const data = await jsonFetch('https://api.scryfall.com' + path, signal, { Accept: 'application/json' });
    data._fetchedAt = new Date().toISOString();
    if (memory.size > 12) memory.delete(memory.keys().next().value);
    memory.set(key, { data, at: Date.now() }); return data;
  });
  sfQueue = job; return job;
}
const dmFetch = (params, signal) => jsonFetch(endpoint + '?' + new URLSearchParams(params), signal, { apikey: publicKey, 'x-region': 'ap-southeast-2' });
function updateURL() {
  const url = new URL(location.href); url.search = '';
  for (const [key, value] of Object.entries(state)) if (value) url.searchParams.set(key, value);
  if (page > 1) url.searchParams.set('page', page);
  history.replaceState(null, '', url.pathname + url.search);
}
function configure() {
  const url = new URL(location.href);
  if (dm) {
    $('language-field').hidden = true; $('flavor-field').hidden = true;
    $('sort').replaceChildren(option('release_new', '公式の新しい順'), option('release_old', '公式の古い順'), option('cardname_asc', 'カード名順'));
    $('color').replaceChildren(option('', 'すべての文明'), ...['光', '水', '闇', '火', '自然', 'ゼロ'].map(c => option(c, c)));
    $('rarity').replaceChildren(option('', 'すべて'), ...[['or', 'OR'], ['s', 'SR'], ['v', 'VR'], ['r', 'R'], ['u', 'U'], ['c', 'C'], ['no_rare', 'レアリティなし']].map(([v, n]) => option(v, n)));
  }
  for (const key of ['q', 'scope', 'lang', 'color', 'rarity', 'sort', 'flavor']) if (url.searchParams.has(key) && $(key)) $(key).value = url.searchParams.get(key);
  state = readForm(); state.set = url.searchParams.get('set') || ''; state.oracle = dm ? '' : url.searchParams.get('oracle') || '';
  page = Math.max(1, Math.min(10000, Number(url.searchParams.get('page')) || 1));
  if (state.set) $('set').append(option(state.set, state.set));
  $('set').value = state.set;
  if (matchMedia('(min-width: 900px)').matches) $('filters').open = true;
  dateLabel();
}
async function loadSets() {
  try {
    const data = dm ? await dmFetch({ kind: 'sets' }) : await scryfall('/sets');
    const current = state.set;
    const sets = dm ? data.sets : data.data.filter(s => !s.digital && s.released_at <= japanDate()).map(s => ({ id: s.code, name: `${s.name} (${s.code.toUpperCase()})` }));
    $('set').replaceChildren(option('', 'すべての収録セット'), ...sets.map(s => option(s.id, s.name)));
    if (current && !sets.some(s => s.id === current)) $('set').append(option(current, current));
    $('set').value = current;
  } catch { $('set-status').textContent = 'セット一覧は読み込めませんでした。カード名・本文で検索できます。'; }
}
function showError(message) {
  const box = el('div', 'message error'); box.setAttribute('role', 'alert');
  box.append(el('p', '', message));
  const retry = el('button', 'primary', 'もう一度読み込む'); retry.onclick = () => load(); box.append(retry);
  $('results').replaceChildren(box); $('results').className = ''; $('count').textContent = '取得できませんでした';
  $('pager').hidden = true;
}
function renderCount(at) {
  if (!dm) $('view-note').textContent = ({ja:'日本語版を表示。日本語未発売のカードは「日本語＋英語」で探せます。',en:'英語版を表示しています。',both:'日本語版と英語版を表示。それぞれの言語の収録版を別件として数えます。',all:'全言語の収録版を表示。各カードに印刷された原文を読みます。'}[state.lang] || '日本語版を表示しています。');
  const size = dm ? 10 : MTG_PAGE_SIZE;
  $('count').replaceChildren(el('strong', '', total.toLocaleString('ja-JP')), document.createTextNode('収録版'));
  $('stamp').textContent = `取得 ${formatDate(at)}\n${total ? ((page - 1) * size + 1).toLocaleString() + '–' + Math.min(page * size, total).toLocaleString() + ' 件を表示' : ''}`;
  $('page-input').value = page; $('page-input').max = Math.max(1, Math.ceil(total / size));
  $('page-total').textContent = '/ ' + Math.ceil(total / size).toLocaleString() + ' ページ';
  $('prev').disabled = page <= 1; $('next').disabled = page * size >= total;
  $('pager').hidden = !total;
  $('active-filter').hidden = !state.oracle;
  $('active-label').textContent = '選んだカードの再録版を表示中';
}
function addFlavor(parent, card) {
  for (const face of card.faces || []) {
    if (card.faces.length > 1) parent.append(el('p', 'face-name', face.name));
    if (face.flavor) parent.append(el('blockquote', 'flavor', face.flavor));
    else parent.append(el('p', 'empty-flavor', dm && face.flavorStatus === 'none' ? 'この収録版の公式フレーバー欄は空です。' : 'この版のデータに本文がありません。画像または出典で確認できます。'));
  }
}
function photoButton(card, index) {
  const button = el('button', 'image-button'); button.type = 'button'; button.setAttribute('aria-label', (card.name || card.id) + 'のカード画像と本文を拡大');
  const image = el('img'); image.src = safeURL(card.image, 'image'); image.alt = card.name || `カード ${card.id}`; image.loading = 'lazy'; image.decoding = 'async'; image.width = 252; image.height = 352;
  image.onerror = () => { image.hidden = true; button.querySelector('.img-hint').textContent = '画像を取得できません'; };
  button.append(image, el('span', 'img-hint', 'タップで拡大'));
  button.onclick = () => { if (cards[index]?.faces) openReader(index); else window.open(safeURL(card.sourceUrl), '_blank', 'noopener,noreferrer'); };
  return button;
}
function renderCard(card, index) {
  const article = el('article', 'card'); article.id = 'card-' + index;
  const inner = el('div', 'card-inner'), content = el('div', 'card-content');
  inner.append(photoButton(card, index), content); article.append(inner);
  if (card.language) content.append(el('span', 'language', languageNames[card.language] || card.language.toUpperCase()));
  if (card.faces) {
    content.append(el('h2', '', card.name));
    content.append(el('p', 'metadata', card.set + (card.number ? ' · #' + card.number : '')));
    if (card.releasedAt) content.append(el('p', 'metadata', card.releasedAt + ' 発売'));
    addFlavor(content, card);
  } else {
    content.append(el('h2', '', card.id));
    if (card.error) {
      content.append(el('p', 'load-error', '本文を取得できませんでした。'));
      const retry = el('button', 'retry', '本文を再取得'); retry.onclick = async () => { retry.disabled = true; await hydrateOne(index, generation, controller.signal); }; content.append(retry);
    } else {
      content.append(el('p', 'metadata', 'カード名・本文を読み込み中'));
      content.append(el('div', 'skeleton'), el('div', 'skeleton short'));
    }
  }
  const bottom = el('div', 'card-bottom');
  const source = el('a', '', dm ? '公式カード情報 ↗' : 'Scryfall ↗'); source.href = safeURL(card.sourceUrl); source.target = '_blank'; source.rel = 'noopener noreferrer'; bottom.append(source);
  if (card.faces) {
    const editions = el('button', '', '再録版をたどる'); editions.onclick = () => {
      if (dm) { $('q').value = card.faces[0].name; $('scope').value = 'name'; $('set').value = ''; state = readForm(); state.set = ''; }
      else { $('q').value = ''; $('set').value = ''; $('color').value = ''; $('rarity').value = ''; $('flavor').value = 'all'; state = readForm(); state.oracle = card.oracle; }
      page = 1; load(true);
    }; bottom.append(editions);
  }
  article.append(bottom); return article;
}
async function hydrateOne(index, g, signal) {
  const card = cards[index];
  try {
    const key = 'dm:' + card.id; const cached = memory.get(key);
    const detail = cached?.data || await dmFetch({ kind: 'detail', id: card.id }, signal);
    if (g !== generation) return;
    if (memory.size > 160) memory.delete(memory.keys().next().value);
    memory.set(key, { at: Date.now(), data: detail });
    cards[index] = { ...card, ...detail, image: detail.image || card.image, error: false };
  } catch (error) { if (g !== generation || signal.aborted) return; cards[index] = { ...card, error: true }; }
  if (g === generation) $('card-' + index)?.replaceWith(renderCard(cards[index], index));
}
async function hydrateDM(g, signal) {
  let index = 0;
  await Promise.all([0, 1].map(async () => { while (index < cards.length && g === generation && !signal.aborted) { const i = index++; await hydrateOne(i, g, signal); await new Promise(r => setTimeout(r, 200)); } }));
  if (g === generation) {
    const failed = cards.filter(c => c.error).length;
    $('hydration-status').textContent = failed ? `${failed}件の本文を取得できませんでした。各カードの「本文を再取得」から再試行できます。` : '';
  }
}
async function load(scroll = false) {
  controller?.abort(); controller = new AbortController(); const signal = controller.signal; const g = ++generation;
  const snapshot = { ...state }; dateLabel(); updateURL();
  document.body.classList.add('loading'); $('results').setAttribute('aria-busy', 'true'); $('search-button').disabled = true;
  $('hydration-status').textContent = ''; $('announcement').textContent = 'カードを読み込んでいます。';
  try {
    let at;
    if (dm) {
      const data = await dmFetch({ ...snapshot, kind: 'search', page }, signal);
      if (g !== generation) return;
      cards = data.cards; total = data.total; at = data.fetchedAt;
      $('result-source').href = safeURL(data.sourceUrl);
    } else {
      const pagination = mtgPage(page), q = mtgQuery(snapshot);
      const params = new URLSearchParams({ q, unique: 'prints', include_extras: 'true', include_multilingual: 'true', include_variations: 'true', page: pagination.sourcePage,
        order: snapshot.sort === 'name' ? 'name' : 'released', dir: snapshot.sort === 'old' || snapshot.sort === 'name' ? 'asc' : 'desc' });
      const data = await scryfall('/cards/search?' + params, signal);
      if (g !== generation) return;
      cards = data.data.slice(pagination.offset, pagination.offset + MTG_PAGE_SIZE).map(normalizeMTG); total = data.total_cards; at = data._fetchedAt;
      $('result-source').href = 'https://scryfall.com/search?' + new URLSearchParams({ q, unique: 'prints' });
    }
    if (total && page > Math.ceil(total / (dm ? 10 : MTG_PAGE_SIZE))) { page = 1; return load(); }
    renderCount(at);
    if (!cards.length) {
      const box = el('div', 'message'); box.append(el('p', '', '一致するカードがありません。'));
      box.append(el('p', 'view-note', dm ? '検索語を短くするか、セット・文明の指定を外してください。' : '日本語版がないカードは、言語を「日本語＋英語」または「全言語」に切り替えてください。'));
      const reset = el('button', '', '条件をリセット'); reset.onclick = resetSearch; box.append(reset);
      $('results').className = ''; $('results').replaceChildren(box);
    } else { $('results').className = 'grid'; $('results').replaceChildren(...cards.map(renderCard)); }
    $('announcement').textContent = `${total.toLocaleString()}収録版中、${cards.length}件を表示しました。`;
    if (scroll) $('result-bar').scrollIntoView({ block: 'start', behavior: 'instant' });
    if (dm && cards.length) void hydrateDM(g, signal);
  } catch (error) {
    if (g !== generation || signal.aborted) return;
    showError(error.name === 'TimeoutError' ? '読み込みに時間がかかっています。もう一度お試しください。' : error.message);
    $('announcement').textContent = '読み込めませんでした。再試行できます。';
  } finally { if (g === generation) { document.body.classList.remove('loading'); $('results').setAttribute('aria-busy', 'false'); $('search-button').disabled = false; } }
}
function openReader(index) {
  const card = cards[index]; if (!card?.faces) return;
  readerIndex = index;
  const photos = el('div', 'reader-images'), text = el('div', 'reader-text');
  const seen = new Set();
  for (const f of card.faces) {
    const src = safeURL(f.largeImage || f.image, 'image'); if (!src || seen.has(src)) continue; seen.add(src);
    const img = el('img'); img.src = src; img.alt = f.name; img.width = 488; img.height = 680; photos.append(img);
  }
  const title = el('h2', '', card.name); title.id = 'reader-title'; text.append(title);
  text.append(el('p', 'metadata', [card.set, card.number ? '#' + card.number : '', card.releasedAt, card.language ? languageNames[card.language] || card.language : ''].filter(Boolean).join(' · ')));
  addFlavor(text, card);
  const artists = [...new Set(card.faces.map(f => f.artist).filter(Boolean))].join(' / ');
  if (artists) text.append(el('p', 'artist', 'Illustration: ' + artists));
  const source = el('a', '', dm ? '公式のカード情報を開く ↗' : 'Scryfallでカード情報を開く ↗'); source.href = safeURL(card.sourceUrl); source.target = '_blank'; source.rel = 'noopener noreferrer'; text.append(source);
  $('reader-body').replaceChildren(photos, text);
  $('reader-prev').disabled = index === 0; $('reader-next').disabled = index >= cards.length - 1 || !cards[index + 1]?.faces;
  $('reader-position').textContent = (index + 1) + ' / ' + cards.length;
  if (!dialog.open) dialog.showModal(); dialog.scrollTop = 0;
}
function resetSearch() { form.reset(); state = readForm(); state.oracle = ''; state.set = ''; page = 1; load(); }
form.addEventListener('submit', e => { e.preventDefault(); state = readForm(); page = 1; load(); });
for (const n of form.querySelectorAll('select')) n.addEventListener('change', () => { state = readForm(); page = 1; load(); });
$('reset').onclick = resetSearch;
$('clear-active').onclick = () => { state.oracle = ''; page = 1; load(); };
$('prev').onclick = () => { if (page > 1) { page--; load(true); } };
$('next').onclick = () => { if (page * (dm ? 10 : MTG_PAGE_SIZE) < total) { page++; load(true); } };
$('page-jump').onsubmit = e => { e.preventDefault(); const n = Number($('page-input').value); if (Number.isInteger(n) && n > 0 && n <= Math.ceil(total / (dm ? 10 : MTG_PAGE_SIZE))) { page = n; load(true); } };
$('reader-close').onclick = () => dialog.close();
$('reader-prev').onclick = () => openReader(readerIndex - 1); $('reader-next').onclick = () => openReader(readerIndex + 1);
dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
configure(); void load(); void loadSets();
