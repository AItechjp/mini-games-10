import {safeEpisode, limitedText, text, INTERVAL} from './core.mjs';

// A free-start date in a feed is not evidence that a reader is free now.
// Require an anonymous public reader and expire that evidence after six hours.
export const VERIFIED_FOR = 6 * 60 * 60 * 1000;
export const CHECK_LIMIT = 40;
function attribute(tag, name) {
  return tag.match(new RegExp('(?:^|\\s)' + name + '\\s*=\\s*(["\x27])([\\s\\S]*?)\\1', 'i'))?.[2] || '';
}
function decode(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, code) => {
    const fixed = {amp: '&', lt: '<', gt: '>', quot: '"', apos: "'"};
    if (fixed[code.toLowerCase()]) return fixed[code.toLowerCase()];
    const n = code[1]?.toLowerCase() === 'x' ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
    return n > 0 && n <= 0x10ffff && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : '';
  });
}
export function inFreePeriod(item, now = Date.now()) {
  return (!item.freeFrom || Date.parse(item.freeFrom) <= now)
    && (!item.freeUntil || Date.parse(item.freeUntil) > now);
}
export function isFree(item, now = Date.now()) {
  const checked = Date.parse(item.verifiedAt);
  return item.access === 'free' && item.proof === 'public-reader'
    && Number.isFinite(checked) && checked <= now + 60000 && now - checked < VERIFIED_FOR
    && inFreePeriod(item, now);
}
export function parseAvailability(html, item, source) {
  const script = [...html.matchAll(/<script\b[^>]*>/gi)].find(m => attribute(m[0], 'id') === 'episode-json');
  if (!script) throw new Error('reader_metadata_missing');
  const product = JSON.parse(decode(attribute(script[0], 'data-value')))?.readableProduct;
  if (!product || product.typeName !== 'episode' || typeof product.id !== 'string'
    || product.id !== new URL(item.url).pathname.split('/').filter(Boolean).at(-1)
    || safeEpisode(product.permalink, source) !== item.url) throw new Error('reader_identity_mismatch');
  const pages = product.pageStructure?.pages;
  // Never retain page/image metadata. It is used only as a public-reader signal.
  const hasPublicPages = Array.isArray(pages) && pages.some(p => p.type === 'main' && typeof p.src === 'string' && p.src.startsWith('https://'));
  const access = product.isPublic === true && product.hasPurchased === false && hasPublicPages ? 'free'
    : product.isPublic === false ? 'restricted' : 'unknown';
  return {access, proof: access === 'free' ? 'public-reader' : null, series: text(product.series?.title || '').slice(0, 160)};
}
export async function checkEpisode(item, source, fetcher = fetch, now = Date.now()) {
  const checked = new Date(now).toISOString();
  try {
    const url = safeEpisode(item.url, source);
    if (!url || url !== item.url) throw new Error('invalid_episode');
    const response = await fetcher(url, {redirect: 'manual', credentials: 'omit',
      signal: AbortSignal.timeout(10000), headers: {Accept: 'text/html',
        'User-Agent': 'AItech-MangaLinks/2.0 (+https://aitechd.com/commons/manga/)'}});
    if (response.status !== 200) { await response.body?.cancel(); throw new Error('reader_unavailable'); }
    const result = parseAvailability(await limitedText(response, 1500000), item, source);
    return {...item, ...result, verifiedAt: checked, verificationError: null,
      verifyAfter: new Date(now + (result.access === 'unknown' ? 60 * 60 * 1000 : VERIFIED_FOR / 2)).toISOString()};
  } catch {
    // A failed recheck must not extend an old free claim.
    return {...item, access: 'unknown', proof: null, verifiedAt: checked,
      verifyAfter: new Date(now + 6 * INTERVAL).toISOString(), verificationError: '閲覧条件を確認できませんでした'};
  }
}
export async function verifyBatch(items, sources, fetcher = fetch, now = Date.now(), deadline = Date.now() + 40000) {
  const byId = new Map(sources.filter(s => s.feed).map(s => [s.id, s]));
  const groups = [...byId.keys()].map(id => items.filter(x => x.sourceId === id && inFreePeriod(x, now)
    && !(Date.parse(x.verifyAfter) > now)).sort((a, b) => {
      // Recheck existing free evidence before it expires; otherwise inspect oldest checks first.
      const priority = x => x.access === 'free' ? 0 : 1;
      return priority(a) - priority(b) || (Date.parse(a.verifiedAt) || 0) - (Date.parse(b.verifiedAt) || 0)
        || Number(Boolean(b.freeFrom)) - Number(Boolean(a.freeFrom)) || b.updatedAt.localeCompare(a.updatedAt);
    }));
  const queue = [];
  for (let i = 0; queue.length < CHECK_LIMIT && groups.some(g => g[i]); i++) {
    for (const group of groups) if (group[i] && queue.length < CHECK_LIMIT) queue.push(group[i]);
  }
  let cursor = 0;
  const checked = new Map();
  await Promise.all(Array.from({length: 4}, async () => {
    while (cursor < queue.length && Date.now() + 10500 < deadline) {
      const item = queue[cursor++];
      checked.set(item.url, await checkEpisode(item, byId.get(item.sourceId), fetcher, now));
    }
  }));
  return items.map(item => checked.get(item.url) || item);
}
export function coverage(items, now = Date.now()) {
  return {candidates: items.length, free: items.filter(x => isFree(x, now)).length,
    restricted: items.filter(x => x.access === 'restricted' && now - Date.parse(x.verifiedAt) < VERIFIED_FOR).length,
    pending: items.filter(x => inFreePeriod(x, now) && !isFree(x, now)
      && !(x.access === 'restricted' && now - Date.parse(x.verifiedAt) < VERIFIED_FOR)).length};
}
