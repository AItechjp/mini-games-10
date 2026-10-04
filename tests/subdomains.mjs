import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { apps as guidedApps } from '../quality/apps.mjs';
import { createRootRouter, validateRegistry } from '../cloudflare/subdomain-router.mjs';
import worker from '../cloudflare/subdomain-worker.mjs';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = path => readFile(resolve(root, path), 'utf8');
const registry = JSON.parse(await read('docs/subdomains.json'));
const route = createRootRouter(registry);
const entries = Object.entries(registry.hosts);
const local = entries.filter(([, item]) => item.delivery === 'static');
assert.equal(registry.status, 'configuration-only-not-activated');
assert(entries.every(([, entry]) => entry.activation !== 'active' && entry.commercialReview === 'not-verified'));

for (const [host, entry] of local) {
  const target = new URL(entry.target, 'https://aitechd.com');
  const path = resolve(root, '.' + target.pathname, target.pathname.endsWith('/') ? 'index.html' : '');
  assert(path.startsWith(root + sep), host);
  assert((await stat(path)).isFile(), `Target must exist: ${host}`);
  assert.equal(route(new Request(`https://${host}/`)).headers.get('Location'), target.pathname + target.search);
}

const targets = local.map(([, item]) => new URL(item.target, 'https://aitechd.com'));
const key = url => url.pathname.replace(/index\.html$/, '') + '|' + (url.searchParams.get('game') || '');
const known = new Set(targets.map(key));
// The user's current scope is all 31 Commons sites and these ten retained 2D entries.
const commonsSites = [
  ['whiteboard', 'tools/whiteboard'], ['yobi', 'study'], ['chat', 'tools/chat'],
  ['hotel-search', 'hotels'], ['rental-search', 'rentals'],
  ['local-supermarkets', 'local/supermarkets'], ['local-saunas', 'local/saunas'],
  ['local-sento', 'local/sento'], ['local-fishmongers', 'local/fishmongers'],
  ['ramen', 'ramen'], ['sauna-now', 'sauna'], ['restaurant-openings', 'openings/ramen'],
  ['sauna-openings', 'openings/sauna'], ['camera', 'camera'], ['weather', 'weather'],
  ['bitcoin', 'bitcoin'], ['onion', 'onion'], ['cyber-news', 'cyber-news'],
  ['government-network', 'government-network'], ['reemployment-network', 'reemployment-network'],
  ['law-watch', 'law'], ['government-documents', 'documents'], ['manga-links', 'manga'],
  ['mtg-flavor', 'mtg-flavor'], ['duel-masters-flavor', 'duel-masters-flavor'],
  ['yugioh-flavor', 'yugioh-flavor'], ['onepiece-cards', 'onepiece-cards'],
  ['pokemon-cards', 'pokemon-cards'], ['zx-cards', 'zx-cards'],
  ['usage-dashboard', 'usage'], ['constitution-map', 'constitution'],
];
const gameDirectories = ['pulse-drums', 'pixel-wallpapers', 'cyber-quiz', 'music', 'law-quiz',
  'it-quiz', 'hacking-story', 'lantern-duo', 'quick-hop', 'startrail'];
const supportPages = ['/games.html', '/games-2d.html', '/yobi-quiz.html', '/yobi-ronbun.html',
  '/commons/', '/commons/constitution/textbook.html'];
const allowedPaths = new Set([...commonsSites.map(([, path]) => `/commons/${path}/`),
  ...gameDirectories.map(path => `/${path}/`), ...supportPages]);
assert.equal(commonsSites.length, 31);
assert.equal(new Set(commonsSites.map(([id]) => id)).size, 31);
assert.equal(local.length, 47);
assert.equal(entries.length, 50);
assert.deepEqual(entries.filter(([, entry]) => entry.delivery === 'sites').map(([host]) => host),
  ['camera.aitechd.com', 'commons.aitechd.com', 'saunanow.aitechd.com']);
assert.deepEqual(new Set(targets.map(url => url.pathname)), allowedPaths);
for (const [id, path] of commonsSites) {
  assert(known.has(key(new URL(`/commons/${path}/`, 'https://aitechd.com'))), `Missing Commons site: ${id}`);
}
for (const path of gameDirectories) {
  assert(known.has(key(new URL(`/${path}/`, 'https://aitechd.com'))), `Missing retained 2D entry: ${path}`);
}
// Assert coverage against the current public navigation, not removed catalog pages.
for (const page of ['index.html', 'games.html', 'games-2d.html']) {
  for (const [, href] of (await read(page)).matchAll(/<a\b[^>]*\bhref=["']([^"']+)["']/gi)) {
    if (href.startsWith('#') || /legal\.html/.test(href)) continue;
    const url = new URL(href.replaceAll('&amp;', '&'), 'https://aitechd.com/' + page);
    if (url.origin !== 'https://aitechd.com') {
      assert(entries.some(([, item]) => item.delivery === 'sites' && new URL(item.target).origin === url.origin), `Missing Sites link: ${href}`);
    } else if (url.pathname !== '/index.html') {
      assert(known.has(key(url)), `Missing public entry: ${page} -> ${href}`);
    }
  }
}
for (const app of guidedApps.filter(app => app.path.startsWith('/') && allowedPaths.has(new URL(app.path, 'https://aitechd.com').pathname))) {
  assert(known.has(key(new URL(app.path, 'https://aitechd.com'))), `Missing guided app: ${app.id}`);
}
// The Commons catalog also contains generated local-directory entries; cover those explicitly.
const commonsSource = await read('commons-src/lib/site-catalog.ts');
for (const [, path] of commonsSource.matchAll(/href:\s*['"]([^'"]+)['"]/g)) {
  assert(known.has(key(new URL(path, 'https://aitechd.com'))), `Missing Commons tool: ${path}`);
}
for (const kind of ['supermarkets', 'saunas', 'sento', 'fishmongers']) {
  assert(known.has(key(new URL(`/commons/local/${kind}/`, 'https://aitechd.com'))));
}
assert(!entries.some(([host]) => /^(?:app-\d|arcade-\d|party-\d)/.test(host)), 'Removed bulk catalogs must not return to migration');
for (const name of ['aether', 'zx', 'naruto', 'gash', 'velora', 'windbound', 'racing', 'black-site',
  'skybreak', 'digimon', 'dungeon-dice', 'trump', 'board', 'babanuki', 'daifugo', 'gomoku',
  'games-3d', 'games-board', 'games-trump', 'apps', 'arcade', 'party']) {
  const host = `${name}.aitechd.com`;
  assert(!Object.hasOwn(registry.hosts, host), `Removed host must not be listed: ${host}`);
  assert.equal(route(new Request(`https://${host}/`)), null, `Removed host must not be routed: ${host}`);
}

const response = route(new Request('https://drums.aitechd.com/?mode=solo&room=AB12&tag=a&tag=b&next=https%3A%2F%2Fevil.invalid'));
const result = new URL(response.headers.get('Location'), 'https://drums.aitechd.com');
assert.equal(result.pathname, '/pulse-drums/');
assert.equal(result.searchParams.get('mode'), 'duo');
assert.equal(result.searchParams.get('room'), 'AB12');
assert.deepEqual(result.searchParams.getAll('tag'), ['a', 'b']);
assert.equal(result.origin, 'https://drums.aitechd.com');
assert.equal(response.headers.get('Cache-Control'), 'no-store');
assert.equal(route(new Request('https://whiteboard.aitechd.com/?room=ABC')).headers.get('Location'), '/commons/tools/whiteboard/?room=ABC');
assert.equal(route(new Request('https://games.aitechd.com/', { method: 'HEAD' })).status, 302);

for (const url of ['https://aitechd.com/', 'https://www.aitechd.com/', 'https://unknown.aitechd.com/',
  'https://games.aitechd.com.evil.invalid/', 'https://games.aitechd.com:444/', 'http://games.aitechd.com/',
  'https://games.aitechd.com/games.html?room=ABC', 'https://games.aitechd.com/assets/file.js',
  'https://games.aitechd.com/commons/api/', ...entries.filter(([, entry]) => entry.delivery !== 'static').map(([host]) => `https://${host}/`)]) {
  assert.equal(route(new Request(url)), null, `Must pass through unchanged: ${url}`);
}
assert.equal(route(new Request('https://games.aitechd.com/', { method: 'POST', body: 'saved-input' })), null);

// The Worker forwards the original request and asset response, including bodies,
// Range headers, status and content type. It must never fetch an arbitrary origin.
for (const request of [new Request('https://games.aitechd.com/pulse-drums/song.ogg', { headers: { Range: 'bytes=0-99' } }),
  new Request('https://games.aitechd.com/legal.html'), new Request('https://games.aitechd.com/ads.txt'),
  new Request('https://unknown.aitechd.com/'), new Request('https://games.aitechd.com/', { method: 'POST', body: 'saved-input' })]) {
  const asset = new Response('asset-body', { status: 206, headers: { 'Content-Type': 'text/plain', 'Content-Range': 'bytes 0-9/10' } });
  const response = await worker.fetch(request, { ASSETS: { fetch(value) { assert.strictEqual(value, request); return asset; } } });
  assert.strictEqual(response, asset);
}
const routed = await worker.fetch(new Request('https://games.aitechd.com/'), { ASSETS: { fetch() { throw new Error('Root route should not fetch assets'); } } });
assert.equal(routed.headers.get('Location'), '/games.html');
await worker.fetch(new Request('https://sauna.aitechd.com/commons/sauna/?prefecture=21', { method: 'HEAD', headers: { 'Accept-Language': 'ja' } }), {
  ASSETS: { fetch(request) {
    assert.equal(request.url, 'https://sauna.aitechd.com/commons/sauna/index.html?prefecture=21');
    assert.equal(request.method, 'HEAD');
    assert.equal(request.headers.get('Accept-Language'), 'ja');
    return new Response(null);
  } },
});

for (const target of ['//evil.invalid/', 'https://evil.invalid/', '/onepiece-battle/', '/docs/subdomains.json',
  '/commons-src/index.html', '/source/private.html', '/supabase/config.js', '/.git/config', '/foo/../docs/private.html',
  '/%2f%2fevil.invalid/', '/foo\\bar.html', '/']) {
  assert.throws(() => validateRegistry({ ...registry, hosts: { 'test.aitechd.com': { delivery: 'static', target } } }), undefined, target);
}
assert(!targets.some(url => url.pathname.startsWith('/onepiece-battle')));
const build = await read('scripts/build-static.mjs');
assert(build.includes("'onepiece-battle'"), 'Keep the APK-only ONE PIECE source out of the public bundle');
assert(build.includes("'cloudflare'") && build.includes("'docs'"), 'Do not publish routing infrastructure or the private registry');
console.log(`Subdomains passed: ${local.length} local routes with ${commonsSites.length} Commons sites and ${gameDirectories.length} retained 2D entries, ${entries.length - local.length} separate/reserved hosts; removed-host exclusion, query preservation and source coverage verified.`);
