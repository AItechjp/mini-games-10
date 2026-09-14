export const DM_ORIGIN = 'https://dm.takaratomy.co.jp';
export const DM_PAGE_SIZE = 50;
export const PAGE_SIZE = 10;
export const validId = id => /^[a-zA-Z0-9_-]{1,90}$/.test(id);
export function plain(value = '') {
  return String(value).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>|<\/p>|<\/li>/gi, '\n').replace(/<[^>]*>/g, '')
    .replace(/&#(x[0-9a-f]+|\d+);/gi, (_, n) => { const c = n[0].toLowerCase() === 'x' ? parseInt(n.slice(1), 16) : Number(n); return c > 0 && c <= 0x10ffff ? String.fromCodePoint(c) : ''; })
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, n) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }[n]))
    .replace(/[\t\r ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
const attr = (s, name) => s.match(new RegExp('\\b' + name + '\\s*=\\s*["\x27]([^"\x27]*)["\x27]', 'i'))?.[1] || '';
export function safeImage(path) {
  try { const u = new URL(path, DM_ORIGIN); return u.origin === DM_ORIGIN && /^\/wp-content\/card\/(cardimage|cardthumb)\/[a-zA-Z0-9_.-]+\.(jpg|png|webp)$/i.test(u.pathname) && !u.search ? u.href : ''; } catch { return ''; }
}
export function parseSearch(html) {
  const count = html.match(/id\s*=\s*["']total_count["'][^>]*>\s*([\d,]+)/i);
  if (!count) throw new Error('公式検索の形式が変わりました。公式サイトで確認してください。');
  const list = html.match(/<ul[^>]*class=["'][^"']*cardList01[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i)?.[1] || '';
  const cards = [];
  for (const m of list.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    const id = m[1].match(/\/card\/detail\/\?id=([a-zA-Z0-9_-]+)/)?.[1];
    const tag = m[1].match(/<img\b[^>]*>/i)?.[0] || '';
    const image = safeImage(attr(tag, 'src'));
    if (id && validId(id) && image) cards.push({ id, image, sourceUrl: DM_ORIGIN + '/card/detail/?id=' + id });
  }
  const total = Number(count[1].replaceAll(',', ''));
  if (total && !cards.length) throw new Error('公式検索のカード一覧を取得できませんでした。');
  return { cards, total };
}
export function parseSets(html) {
  const s = html.match(/<select[^>]*name=["']products["'][^>]*>([\s\S]*?)<\/select>/i)?.[1];
  if (!s) throw new Error('収録セットを取得できませんでした。');
  return [...s.matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)].map(m => ({ id: attr(m[1], 'value'), name: plain(m[2]) })).filter(s => s.id);
}
export function parseDetail(html, id) {
  if (!validId(id)) throw new Error('カード番号が不正です。');
  const blocks = html.split(/<div\b[^>]*class=["']card-itself["'][^>]*>/i).slice(1);
  const faces = blocks.map(block => {
    const heading = block.match(/<h3\b[^>]*class=["']card-name["'][^>]*>([\s\S]*?)<\/h3>/i)?.[1];
    if (!heading) return null;
    const cell = name => block.match(new RegExp('<td\\b[^>]*class=["\x27]' + name + '(?: [^"\x27]*)?["\x27][^>]*>([\\s\\S]*?)<\\/td>', 'i'));
    const imageTag = block.match(/<div\b[^>]*class=["']card-img["'][^>]*>\s*(<img\b[^>]*>)/i)?.[1] || '';
    const flavor = cell('flavor');
    return {
      name: plain(heading.replace(/<span\b[\s\S]*?<\/span>/gi, '')),
      set: plain(heading.match(/<span\b[^>]*class=["']packname["'][^>]*>([\s\S]*?)<\/span>/i)?.[1] || ''),
      image: safeImage(attr(imageTag, 'src')), flavor: flavor ? plain(flavor[1]) : null,
      flavorStatus: !flavor ? 'unavailable' : plain(flavor[1]) ? 'present' : 'none',
      color: plain(cell('civil')?.[1]), rarity: plain(cell('rarelity')?.[1]),
      type: plain(cell('type')?.[1]), artist: plain(cell('illusttxt')?.[1]),
    };
  }).filter(Boolean);
  if (!faces.length) throw new Error('カード本文を取得できませんでした。');
  if (faces.length > 1 && faces.every(f => f.name === faces[0].name)) {
    const names = faces[0].name.split(' / ');
    if (names.length === faces.length) faces.forEach((f, i) => { f.name = names[i]; });
  }
  return { id, name: [...new Set(faces.map(f => f.name))].join(' / '), set: faces[0].set, image: faces[0].image, faces,
    sourceUrl: DM_ORIGIN + '/card/detail/?id=' + id, fetchedAt: new Date().toISOString() };
}
export function searchParams(query) {
  const p = new URLSearchParams();
  const page = Number(query.get('page') || 1);
  if (!Number.isInteger(page) || page < 1 || page > 10000) throw new Error('ページ番号を確認してください。');
  const keyword = (query.get('q') || '').trim();
  if (keyword.length > 120) throw new Error('検索語は120文字以内にしてください。');
  p.set('pagenum', String(Math.floor((page - 1) * PAGE_SIZE / DM_PAGE_SIZE) + 1));
  p.set('samename', 'show');
  const sort = query.get('sort') || 'release_new';
  if (!['release_new', 'release_old', 'cardname_asc'].includes(sort)) throw new Error('並び順が不正です。');
  p.set('sort', sort);
  if (keyword) {
    p.set('keyword', keyword);
    const scope = query.get('scope') || 'all';
    if (!['all', 'name', 'flavor'].includes(scope)) throw new Error('検索対象が不正です。');
    if (scope !== 'flavor') p.append('keyword_type[]', 'card_name');
    if (scope !== 'name') p.append('keyword_type[]', 'flavor');
  }
  for (const [key, max] of [['set', 60], ['color', 8], ['rarity', 20]]) {
    const v = query.get(key) || '';
    if (!v) continue;
    if (v.length > max || /[<>\x00-\x1f]/.test(v)) throw new Error('検索条件が不正です。');
    if (key === 'color' && !['光', '水', '闇', '火', '自然', 'ゼロ'].includes(v)) throw new Error('文明が不正です。');
    p.set(key === 'set' ? 'products' : key === 'color' ? 'culture[]' : 'rarity', v);
  }
  return { page, offset: ((page - 1) * PAGE_SIZE) % DM_PAGE_SIZE, params: p };
}
