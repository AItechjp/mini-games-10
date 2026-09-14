export const ORIGIN = 'https://www.db.yugioh-card.com';
export const PAGE_SIZE = 10;
export const validId = value => /^[1-9]\d{0,7}$/.test(String(value));
export const japanDate = (now = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(now);
const decode = value => value.replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => {
  const c = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n);
  return c > 0 && c <= 0x10ffff ? String.fromCodePoint(c) : '';
}).replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, n) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[n]));
export function plain(value = '') {
  // Official text encodes its line breaks as &lt;br&gt;. Decode before stripping markup.
  return decode(String(value)).replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>|<hr\s*\/?>/gi, '\n').replace(/<[^>]*>/g, '')
    .replace(/[\t\r\n ]+/g, ' ').replace(/ *\u2028 */g, '\n').trim();
}
function text(value = '') { return plain(value.replace(/(?:<|&lt;)(?:br|hr)\s*\/?(?:>|&gt;)/gi, '\u2028')); }
function part(html, name, tag = '[a-z0-9]+') {
  return html.match(new RegExp('<(' + tag + ')\\b[^>]*class=["\x27](?:[^"\x27]*\\s)?' + name + '(?:\\s[^"\x27]*)?["\x27][^>]*>([\\s\\S]*?)<\\/\\1>', 'i'))?.[2] ?? null;
}
export function safeURL(value, image = false) {
  try {
    const u = new URL(decode(value || ''), ORIGIN);
    if (u.origin !== ORIGIN || u.username || u.password) return '';
    if (image && u.pathname !== '/yugiohdb/get_image.action') return '';
    if (!image && !['/yugiohdb/card_search.action', '/yugiohdb/card_list.action'].includes(u.pathname)) return '';
    if (image && (!validId(u.searchParams.get('cid')) || !/^\d{1,3}$/.test(u.searchParams.get('ciid') || ''))) return '';
    u.searchParams.set('request_locale', 'ja');
    return u.href;
  } catch { return ''; }
}
function imageURLs(html, id) {
  const images = new Map();
  for (const m of html.matchAll(/['"]([^'"\s]*\/yugiohdb\/get_image\.action\?[^'"\s]+)['"]/g)) {
    const url = safeURL(m[1], true); if (!url) continue;
    const u = new URL(url); if (u.searchParams.get('cid') !== String(id)) continue;
    const art = u.searchParams.get('ciid'); u.searchParams.set('type', '2');
    images.set(art, { id: art, url: u.href });
  }
  return [...images.values()].sort((a, b) => Number(a.id) - Number(b.id));
}
export function classify(type, attribute = '') {
  const monster = /族/.test(type) && !/魔法|罠/.test(attribute);
  return monster && /(?:^|[／/\s])通常(?:$|[／/\s])/.test(type) ? 'flavor' : 'effect';
}
export function parseSearch(html, pack = false) {
  const match = html.match(/検索結果\s*([\d,]+)件中\s*([\d,]+)[～〜–-]([\d,]+)件/);
  const packCount = pack ? html.match(/全([\d,]+)枚/) : null;
  if (!match && !packCount) {
    if (/class=["']no_data["'][^>]*>\s*該当データがありません。/.test(html)) return { total: 0, cards: [] };
    throw new Error('公式検索の応答を確認できませんでした。時間をおいて再試行してください。');
  }
  const total = Number((match || packCount)[1].replaceAll(',', ''));
  const blocks = html.split(/<div\b[^>]*class=["']t_row c_normal[^"']*["'][^>]*>/i).slice(1);
  const cards = blocks.map(block => {
    block = block.split('<!-- .t_row c_normal -->')[0];
    const id = block.match(/class=["']link_value["'][^>]*value=["'][^"']*[?&]cid=(\d+)/)?.[1];
    const name = plain(part(block, 'card_name', 'span') || '');
    if (!validId(id) || !name) throw new Error('カード一覧の形式が変わりました。公式サイトで確認してください。');
    const type = plain(part(block, 'card_info_species_and_other_item') || '').replace(/[【】]/g, '').replace(/\s+/g, '');
    const attribute = plain(part(block, 'box_card_attribute') || '');
    const main = [...block.matchAll(/<dd\b[^>]*class=["']([^"']*\bbox_card_text\b[^"']*)["'][^>]*>([\s\S]*?)<\/dd>/gi)];
    const body = main.find(m => !/\bbiko\b/.test(m[1]));
    const images = imageURLs(html, id), thumbnail = images[0] ? new URL(images[0].url) : null;
    if (thumbnail) thumbnail.searchParams.set('type', '1');
    return { id, name, ruby: plain(part(block, 'card_ruby') || ''), type, attribute,
      stats: ['box_card_level_rank', 'atk_power', 'def_power', 'box_card_pen_scale'].map(c => plain(part(block, c) || '')).filter(Boolean).join(' · '),
      text: body ? text(body[2]) : null, textStatus: body ? 'present' : 'unavailable', textKind: classify(type, attribute),
      pendulum: text(part(block, 'box_card_pen_effect') || ''), notes: main.filter(m => /\bbiko\b/.test(m[1])).map(m => text(m[2])).join('\n'),
      image: thumbnail?.href || '', images, sourceUrl: `${ORIGIN}/yugiohdb/card_search.action?ope=2&cid=${id}&request_locale=ja` };
  });
  const expected = packCount ? total : Number(match[3].replaceAll(',', '')) - Number(match[2].replaceAll(',', '')) + 1;
  if (cards.length !== expected || new Set(cards.map(c => c.id)).size !== cards.length) throw new Error('カード一覧の一部を取得できませんでした。再試行してください。');
  return { total, cards };
}
export function filterPack(result, query, page = 1) {
  // Konami's product pages ignore ordinary search filters and have a different
  // count header. Read one complete bounded product, then filter before paging.
  const norm = value => String(value || '').normalize('NFKC').toLocaleLowerCase('ja').replace(/\s+/g, '');
  const q = norm(query.get('q')), scope = query.get('scope') || 'name', type = query.get('type') || 'normal';
  if (scope === 'number') throw new Error('カードNo.を検索するときは収録セットの指定を外してください。');
  const attribute = { dark: '闇属性', light: '光属性', earth: '地属性', water: '水属性', fire: '炎属性', wind: '風属性', divine: '神属性' }[query.get('attribute')];
  const matches = result.cards.filter(c => {
    if (q && !norm(scope === 'text' ? c.text : scope === 'pendulum' ? c.pendulum : c.name + c.ruby).includes(q)) return false;
    if (attribute && c.attribute !== attribute) return false;
    if (type === 'normal' && c.textKind !== 'flavor') return false;
    if (type === 'monster' && !/族/.test(c.type)) return false;
    if (type === 'effect' && !/族/.test(c.type)) return false;
    if (type === 'effect' && !/効果/.test(c.type)) return false;
    if (type === 'spell' && !/魔法/.test(c.attribute)) return false;
    if (type === 'trap' && !/罠/.test(c.attribute)) return false;
    return true;
  });
  if (query.get('sort') === 'name') matches.sort((a, b) => (a.ruby || a.name).localeCompare(b.ruby || b.name, 'ja'));
  if (query.get('sort') === 'atk') matches.sort((a, b) => Number(b.stats.match(/攻撃力\s*(\d+)/)?.[1] || 0) - Number(a.stats.match(/攻撃力\s*(\d+)/)?.[1] || 0));
  return { total: matches.length, cards: matches.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE) };
}
export function parseSets(html, today = japanDate()) {
  const sets = [];
  for (const block of html.split(/<div\b[^>]*class=["']t_row packc[^"']*["'][^>]*>/i).slice(1)) {
    const id = block.match(/[?&]pid=(\d+)/)?.[1], name = plain(block.match(/<div class="main">\s*<p>([\s\S]*?)<\/p>/)?.[1] || '');
    const releasedAt = plain(part(block, 'time') || '').replaceAll('/', '-');
    if (id && name && /^\d{4}-\d{2}-\d{2}$/.test(releasedAt) && releasedAt <= today) sets.push({ id, name, releasedAt });
  }
  if (!sets.length) throw new Error('収録セット一覧を取得できませんでした。');
  return [...new Map(sets.map(s => [s.id, s])).values()];
}
export function parseDetail(html, id, today = japanDate()) {
  if (!validId(id)) throw new Error('カード番号が不正です。');
  const cardSet = html.match(/<div id="CardSet">([\s\S]*?)<!-- #CardSet -->/)?.[1];
  if (!cardSet) throw new Error('カード詳細を取得できませんでした。');
  const images = imageURLs(html, id);
  const sets = [];
  const list = html.split(/<div id="update_list" class="list">/)[1]?.split(/<div id="card_list"/)[0] || '';
  for (const block of list.split(/<div class="t_row [^"]*">/).slice(1)) {
    const pid = block.match(/[?&]pid=(\d+)/)?.[1], name = plain(part(block, 'pack_name') || '');
    const releasedAt = plain(part(block, 'time') || '').replaceAll('/', '-');
    if (pid && name && releasedAt <= today) sets.push({ id: pid, name, releasedAt, number: plain(part(block, 'card_number') || ''), rarity: plain(part(block, 'lr_icon') || '') });
  }
  return { id, images, sets, fetchedAt: new Date().toISOString() };
}
export function searchParams(query, today = japanDate()) {
  const page = Number(query.get('page') || 1), keyword = (query.get('q') || '').trim();
  if (!Number.isInteger(page) || page < 1 || page > 10000) throw new Error('ページ番号を確認してください。');
  if (keyword.length > 50) throw new Error('検索語は50文字以内にしてください。');
  const p = new URLSearchParams({ ope: '1', request_locale: 'ja', rp: String(PAGE_SIZE), page: String(page), mode: '1', keyword });
  const choose = (key, fallback, choices) => { const value = query.get(key) || fallback; if (!Object.hasOwn(choices, value)) throw new Error('検索条件が不正です。'); return choices[value]; };
  p.set('stype', choose('scope', 'name', { name: '1', text: '2', pendulum: '3', number: '4' }));
  p.set('sort', choose('sort', 'new', { new: '21', old: '20', name: '1', atk: '4' }));
  const [ctype, other] = choose('type', 'normal', { normal: ['1','0'], all: ['',''], monster: ['1',''], effect: ['1','1'], spell: ['2',''], trap: ['3',''] });
  if (ctype) p.set('ctype', ctype); if (other) p.set('other', other);
  const attribute = choose('attribute', 'all', { all: '', dark: '12', light: '11', water: '15', earth: '13', fire: '14', wind: '16', divine: '17' });
  if (attribute) p.set('attr', attribute);
  const set = query.get('set') || ''; if (set && !/^\d{1,16}$/.test(set)) throw new Error('収録セットが不正です。');
  if (set) p.set('pid', set);
  const [year, month, day] = today.split('-');
  p.set('releaseYEnd', year); p.set('releaseMEnd', month); p.set('releaseDEnd', day);
  return { page, params: p, cutoff: today };
}
