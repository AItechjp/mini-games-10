// Exact origins for the planned Commons subdomain routes in docs/subdomains.json.
// Each read-only endpoint permits only its own consumers; no suffix/wildcard match.
const baseOrigins = ['https://aitechd.com', 'https://www.aitechd.com'];
const commonsOrigins = ['https://tools.aitechd.com', 'https://commons.aitechd.com'];
export const endpointOrigins = Object.freeze({
  search: Object.freeze([...baseOrigins, ...commonsOrigins,
    'https://commons-100.douga071132.chatgpt.site',
    'https://hotels.aitechd.com', 'https://rentals.aitechd.com']),
  yugioh: Object.freeze([...baseOrigins, ...commonsOrigins, 'https://yugioh.aitechd.com']),
  cards: Object.freeze([...baseOrigins, ...commonsOrigins, 'https://duel-masters.aitechd.com']),
  tcg: Object.freeze([...baseOrigins, ...commonsOrigins,
    'https://onepiece-cards.aitechd.com', 'https://pokemon-cards.aitechd.com', 'https://zx-cards.aitechd.com']),
});

export function commonsCors(endpoint) {
  if (!Object.hasOwn(endpointOrigins, endpoint)) throw new Error('Unknown Commons endpoint');
  const allowed = new Set(endpointOrigins[endpoint]);
  // Absent Origin keeps existing server-to-server requests working. The literal
  // "null", empty, HTTP, port, path and lookalike origins never match this set.
  const isAllowed = origin => origin === null || allowed.has(origin);
  const headers = origin => ({
    ...(allowed.has(origin) ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': endpoint === 'search'
      ? 'apikey, authorization, content-type' : 'apikey, content-type, x-region',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Max-Age': '600',
    'Vary': 'Origin',
    'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  return { isAllowed, headers };
}
