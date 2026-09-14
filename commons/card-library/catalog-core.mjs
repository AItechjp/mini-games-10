export const japanDate = (now = new Date()) => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Tokyo' }).format(now);
export const MTG_PAGE_SIZE = 25;
export function mtgQuery(state, today = japanDate()) {
  const lang = ['ja', 'en', 'both', 'all'].includes(state.lang) ? state.lang : 'ja';
  const parts = ['game:paper', `date<=${today}`];
  if (lang === 'both') parts.push('(lang:ja OR lang:en)');
  else if (lang !== 'all') parts.push(`lang:${lang}`);
  if (state.flavor !== 'all') parts.push('has:flavor');
  const term = String(state.q || '').trim().slice(0, 120).replace(/["\\]/g, ' ');
  if (term) { const t = `"${term}"`; parts.push(state.scope === 'flavor' ? `flavor:${t}` : state.scope === 'name' ? `name:${t}` : `(name:${t} OR flavor:${t})`); }
  if (/^[a-zA-Z0-9]{2,8}$/.test(state.set || '')) parts.push(`set:${state.set}`);
  if (/^[WUBRGCM]$/.test(state.color || '')) parts.push(state.color === 'M' ? 'c:multicolor' : `c:${state.color}`);
  if (['common', 'uncommon', 'rare', 'mythic'].includes(state.rarity)) parts.push(`r:${state.rarity}`);
  if (state.oracle && /^[a-f0-9-]{36}$/.test(state.oracle)) parts.push(`oracleid:${state.oracle}`);
  return parts.join(' ');
}
export function mtgPage(page) {
  if (!Number.isInteger(page) || page < 1) throw new Error('Invalid page');
  return { sourcePage: Math.floor((page - 1) / 7) + 1, offset: ((page - 1) % 7) * MTG_PAGE_SIZE };
}
export function safeURL(value, kind = 'link') {
  try {
    const u = new URL(value);
    const hosts = kind === 'image' ? ['cards.scryfall.io', 'dm.takaratomy.co.jp'] : ['scryfall.com', 'dm.takaratomy.co.jp', 'gatherer.wizards.com'];
    return u.protocol === 'https:' && !u.username && !u.password && hosts.includes(u.hostname) ? u.href : '';
  } catch { return ''; }
}
export function normalizeMTG(card) {
  const faces = (card.card_faces?.length ? card.card_faces : [card]).map(face => ({
    name: face.printed_name || face.name,
    image: safeURL((face.image_uris || card.image_uris)?.normal, 'image'),
    largeImage: safeURL((face.image_uris || card.image_uris)?.large, 'image'),
    flavor: face.flavor_text ?? null,
    flavorStatus: face.flavor_text ? 'present' : 'unavailable',
    type: face.printed_type_line || face.type_line || card.type_line,
    artist: face.artist || card.artist || '', color: (face.colors || card.colors || []).join(' '), rarity: card.rarity,
  }));
  return { id: card.id, oracle: card.oracle_id, name: card.printed_name || card.name, originalName: card.name,
    image: faces[0].image, faces, language: card.lang, setCode: card.set, set: card.set_name,
    number: card.collector_number, releasedAt: card.released_at, sourceUrl: safeURL(card.scryfall_uri) };
}
