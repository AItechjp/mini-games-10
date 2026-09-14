const endpoint = 'https://dcvtubivtextycifngtk.supabase.co/functions/v1/commons-yugioh';
const publicKey = 'sb_publishable_IcEN-3GgzcLCHiyNLyRiCQ_RpkAhCGI';
const $ = id => document.getElementById(id);
const form = $('search-form'), dialog = $('reader-dialog'), memory = new Map();
let state = {}, page = 1, total = 0, cards = [], controller, generation = 0, readerIndex = -1, readerGeneration = 0;
function el(tag, className, value) { const n = document.createElement(tag); if (className) n.className = className; if (value !== undefined) n.textContent = value; return n; }
function option(value, name) { const n = el('option', '', name); n.value = value; return n; }
const today = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(new Date());
function sourceURL(value, image = false) {
  try { const u = new URL(value); return u.origin === 'https://www.db.yugioh-card.com' && !u.username && !u.password && (image ? u.pathname === '/yugiohdb/get_image.action' : ['/yugiohdb/card_search.action', '/yugiohdb/card_list.action'].includes(u.pathname)) ? u.href : ''; } catch { return ''; }
}
function sourceLink(url, label = '公式カード情報 ↗') { const a = el('a', '', label); a.href = sourceURL(url); a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; }
function readForm() { return Object.fromEntries(new FormData(form)); }
async function api(params, signal) {
  const key = today() + ':' + new URLSearchParams(params), saved = memory.get(key);
  if (saved && Date.now() - saved.at < 900000) return saved.data;
  const r = await fetch(endpoint + '?' + new URLSearchParams(params), { credentials: 'omit', headers: { apikey: publicKey, 'x-region': 'ap-southeast-2' }, signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000) });
  let data; try { data = await r.json(); } catch { throw new Error('カード情報の応答を読み取れませんでした。再試行してください。'); }
  if (!r.ok) throw new Error(data.error || 'カードを取得できませんでした。');
  if (memory.size >= 80) memory.delete(memory.keys().next().value);
  memory.set(key, { at: Date.now(), data }); return data;
}
function updateURL() {
  const url = new URL(location.href); url.search = '';
  for (const [key, value] of Object.entries(state)) if (value) url.searchParams.set(key, value);
  if (page > 1) url.searchParams.set('page', String(page));
  history.replaceState(null, '', url.pathname + url.search);
}
function cardText(parent, card, full = false) {
  parent.append(el('span', 'text-kind', card.textKind === 'flavor' ? 'FLAVOR / モンスターの物語' : 'TEXT / カード効果・説明'));
  parent.append(el(card.textKind === 'flavor' ? 'blockquote' : 'p', card.textKind === 'flavor' ? 'flavor' : 'effect-text', card.text ?? '本文を取得できませんでした。公式カード情報から確認できます。'));
  if (card.pendulum) {
    const section = el('details', 'pendulum'); section.open = full;
    section.append(el('summary', '', 'ペンデュラム効果'), el('p', 'effect-text', card.pendulum)); parent.append(section);
  }
  if (card.notes) parent.append(el('p', 'metadata', card.notes));
}
function createImage(url, name, failure) {
  const img = el('img'); img.alt = name; img.loading = 'lazy'; img.decoding = 'async'; img.referrerPolicy = 'no-referrer'; img.width = 400; img.height = 580;
  img.onerror = () => { img.hidden = true; failure(); };
  const safe = sourceURL(url, true); if (safe) img.src = safe; else { img.hidden = true; queueMicrotask(failure); }
  return img;
}
function renderCard(card, index) {
  const article = el('article', 'card'), inner = el('div', 'card-inner'), content = el('div', 'card-content');
  const imageButton = el('button', 'image-button'); imageButton.type = 'button'; imageButton.setAttribute('aria-label', card.name + 'の画像と本文を拡大');
  const hint = el('span', 'img-hint', 'タップで拡大');
  imageButton.append(createImage(card.image, card.name, () => { hint.textContent = '画像を取得できません'; }), hint); imageButton.onclick = () => openReader(index);
  content.append(el('span', 'language', /[ぁ-んァ-ヶ一-龠]/.test(card.text || '') ? '日本語' : '公式掲載の原文'), el('h2', '', card.name));
  content.append(el('p', 'metadata', [card.attribute, card.type].filter(Boolean).join(' · ')), el('p', 'metadata', card.stats)); cardText(content, card);
  inner.append(imageButton, content); article.append(inner);
  const bottom = el('div', 'card-bottom'), detail = el('button', '', '別イラスト・収録セット'); detail.type = 'button'; detail.onclick = () => openReader(index);
  bottom.append(sourceLink(card.sourceUrl), detail); article.append(bottom); return article;
}
function resetSearch() { HTMLFormElement.prototype.reset.call(form); state = readForm(); page = 1; load(true); }
function errorMessage(error) {
  const box = el('div', 'message error'); box.setAttribute('role', 'alert'); box.append(el('p', '', error.message));
  const retry = el('button', 'primary', 'もう一度読み込む'); retry.onclick = () => load(); box.append(retry);
  $('results').className = ''; $('results').replaceChildren(box); $('count').textContent = '取得できませんでした'; $('pager').hidden = true;
}
async function load(scroll = false) {
  if (dialog.open) dialog.close();
  controller?.abort(); controller = new AbortController(); const signal = controller.signal, g = ++generation;
  updateURL(); document.body.classList.add('loading'); $('results').setAttribute('aria-busy', 'true'); $('search-button').disabled = true;
  $('announcement').textContent = 'カードを読み込んでいます。';
  try {
    const data = await api({ ...state, kind: 'search', page }, signal); if (g !== generation) return;
    total = data.total; cards = data.cards;
    const pages = Math.max(1, Math.ceil(total / data.pageSize));
    if (page > pages) { page = pages; return load(scroll); }
    $('count').replaceChildren(el('strong', '', total.toLocaleString('ja-JP')), document.createTextNode('種類のカード'));
    const date = new Date(data.fetchedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    $('stamp').textContent = `取得 ${date}\n${total ? (page - 1) * 10 + 1 : 0}–${Math.min(page * 10, total)} 件を表示`;
    $('cutoff').textContent = data.cutoff; $('result-source').href = sourceURL(data.sourceUrl);
    $('result-source').textContent = state.set ? '収録セットを公式サイトで確認 ↗' : '現在の検索条件を公式サイトで確認 ↗';
    $('view-note').textContent = state.type === 'normal' ? '通常モンスターのフレーバーを表示中。ペンデュラム効果は別枠で読めます。' : '通常モンスターはフレーバー、効果モンスター・魔法・罠は効果や説明文を表示します。';
    $('results').className = 'grid'; $('results').replaceChildren(...cards.map(renderCard));
    if (!cards.length) {
      const box = el('div', 'message'); box.append(el('p', '', '一致するカードがありません。'), el('p', 'view-note', '検索語を短くするか、属性・セットの指定を外してください。'));
      const reset = el('button', '', '条件をリセット'); reset.onclick = resetSearch;
      const all = el('button', '', '全カード種別で検索'); all.onclick = () => { $('type').value = 'all'; state = readForm(); page = 1; load(); };
      box.append(all, document.createTextNode(' '), reset); $('results').className = ''; $('results').append(box);
    }
    $('page-input').value = page; $('page-input').max = pages; $('page-total').textContent = `/ ${pages.toLocaleString()} ページ`;
    $('prev').disabled = page <= 1; $('next').disabled = page >= pages; $('pager').hidden = !total;
    $('announcement').textContent = `${total.toLocaleString()}種類中、${cards.length}件を表示しました。`;
    if (scroll) $('count').scrollIntoView({ block: 'start' });
  } catch (e) { if (!signal.aborted && g === generation) errorMessage(e); }
  finally { if (g === generation) { document.body.classList.remove('loading'); $('results').setAttribute('aria-busy', 'false'); $('search-button').disabled = false; } }
}
async function loadSets() {
  try {
    const data = await api({ kind: 'sets' }); const selected = state.set || '';
    $('set').replaceChildren(option('', 'すべての収録セット'), ...data.sets.map(s => option(s.id, `${s.releasedAt} · ${s.name}`)));
    if (selected && !data.sets.some(s => s.id === selected)) $('set').append(option(selected, `セット ${selected}`));
    $('set').value = selected;
  } catch {
    const retry = el('button', '', 'セット一覧を再取得'); retry.type = 'button'; retry.onclick = () => { $('set-status').replaceChildren(); loadSets(); };
    $('set-status').replaceChildren(document.createTextNode('セット一覧を取得できませんでした。カード検索は利用できます。 '), retry);
  }
}
async function readerDetails(card, imagesBox, detailsBox, token) {
  const status = el('p', 'art-status', '別イラスト・収録セットを読み込み中…'); detailsBox.append(status);
  try {
    const data = await api({ kind: 'detail', id: card.id }); if (token !== readerGeneration || !dialog.open) return;
    status.remove();
    if (data.images.length > 1) {
      const label = el('label', 'field'); label.append(el('span', '', '公式掲載のイラスト'));
      const select = el('select'); select.append(...data.images.map((art, i) => option(art.id, `イラスト ${i + 1} / ${data.images.length}`)));
      const caption = el('p', 'art-status', '公式のSAMPLE画像を表示しています。');
      const switchImage = () => {
        const art = data.images.find(a => a.id === select.value); const img = createImage(art?.url, card.name, () => { caption.textContent = 'このイラストを取得できませんでした。公式カード情報で確認できます。'; });
        imagesBox.querySelector('img')?.replaceWith(img); caption.textContent = '公式のSAMPLE画像を表示しています。';
      };
      select.onchange = switchImage; label.append(select); imagesBox.append(label, caption); switchImage();
    }
    if (data.sets.length) {
      const printings = el('details', 'printings'); printings.append(el('summary', '', `収録セットをたどる · ${data.sets.length}件`));
      for (const set of data.sets) {
        const row = el('div', 'printing'), button = el('button', '', set.name); button.type = 'button';
        button.onclick = () => { HTMLFormElement.prototype.reset.call(form); $('type').value = 'all'; if (![...$('set').options].some(o => o.value === set.id)) $('set').append(option(set.id, set.name)); $('set').value = set.id; state = readForm(); page = 1; load(true); };
        row.append(button, el('span', '', [set.releasedAt, set.number, set.rarity].filter(Boolean).join(' · '))); printings.append(row);
      }
      detailsBox.append(printings);
    } else detailsBox.append(el('p', 'metadata', '収録セットは公式カード情報から確認してください。'));
  } catch (e) {
    if (token !== readerGeneration || !dialog.open) return;
    status.className = 'load-error'; status.textContent = '別イラスト・収録セットを取得できませんでした。';
    const retry = el('button', '', '詳細を再取得'); retry.onclick = () => { status.remove(); retry.remove(); readerDetails(card, imagesBox, detailsBox, token); }; detailsBox.append(retry);
  }
}
function openReader(index) {
  if (index < 0 || index >= cards.length) return;
  readerIndex = index; const card = cards[index], token = ++readerGeneration;
  const imagesBox = el('div', 'reader-images'), content = el('div');
  const missing = el('p', 'image-missing', '画像を取得できませんでした。公式カード情報から確認できます。'); missing.hidden = true;
  imagesBox.append(createImage(card.images?.[0]?.url || card.image, card.name, () => { missing.hidden = false; }), missing);
  const heading = el('h2', '', card.name); heading.id = 'reader-title';
  content.append(el('p', 'eyebrow', 'YU-GI-OH! OCG'), heading, el('p', 'metadata', card.ruby), el('p', 'metadata', [card.attribute, card.type].filter(Boolean).join(' · ')), el('p', 'metadata', card.stats));
  cardText(content, card, true); content.append(sourceLink(card.sourceUrl));
  $('reader-body').replaceChildren(imagesBox, content); $('reader-position').textContent = `${index + 1} / ${cards.length}`;
  $('reader-prev').disabled = index === 0; $('reader-next').disabled = index === cards.length - 1;
  if (!dialog.open) dialog.showModal(); dialog.scrollTop = 0; readerDetails(card, imagesBox, content, token);
}
form.onsubmit = e => { e.preventDefault(); state = readForm(); page = 1; load(true); };
for (const name of ['scope', 'type', 'attribute', 'set', 'sort']) $(name).onchange = () => { state = readForm(); page = 1; load(); };
$('reset').onclick = resetSearch;
document.querySelectorAll('[data-query]').forEach(button => { button.onclick = () => { HTMLFormElement.prototype.reset.call(form); $('q').value = button.dataset.query; state = readForm(); page = 1; load(true); }; });
$('prev').onclick = () => { if (page > 1) { page--; load(true); } };
$('next').onclick = () => { if (page * 10 < total) { page++; load(true); } };
$('page-jump').onsubmit = e => { e.preventDefault(); page = Math.max(1, Math.min(Math.ceil(total / 10), Math.trunc(Number($('page-input').value)) || 1)); load(true); };
$('reader-close').onclick = () => dialog.close();
dialog.addEventListener('close', () => { readerGeneration++; });
dialog.addEventListener('click', e => { if (e.target === dialog) { const r = dialog.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close(); } });
$('reader-prev').onclick = () => openReader(readerIndex - 1);
$('reader-next').onclick = () => openReader(readerIndex + 1);
const params = new URLSearchParams(location.search);
for (const key of ['q', 'scope', 'type', 'attribute', 'sort']) {
  const input = $(key), value = params.get(key);
  if (value !== null && (input.tagName !== 'SELECT' || [...input.options].some(o => o.value === value))) input.value = value;
}
const set = params.get('set'); if (set && /^\d{1,16}$/.test(set)) { $('set').append(option(set, `セット ${set}`)); $('set').value = set; }
state = readForm(); page = Math.max(1, Math.min(10000, Math.trunc(Number(params.get('page'))) || 1));
$('cutoff').textContent = today(); if (matchMedia('(max-width:650px)').matches) $('filters').open = false;
load(); loadSets();
