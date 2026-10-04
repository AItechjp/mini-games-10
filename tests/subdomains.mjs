import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { apps as guidedApps } from '../quality/apps.mjs';
import { GAMES } from '../arcade100/catalog.mjs';
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
// Assert coverage against real public links, including the individual board/card games.
for (const page of ['index.html', 'games.html', 'games-2d.html', 'games-3d.html', 'games-trump.html', 'games-board.html', 'apps.html']) {
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
for (const app of guidedApps.filter(app => app.path.startsWith('/'))) {
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
const appNames = [...(await read('apps.js')).matchAll(/\['([^']*)','([^']*)','([^']*)','([^']*)','([^']*)'\]/g)];
assert.equal(appNames.length, 100);
for (let id = 1; id <= 100; id++) {
  const entry = registry.hosts[`app-${String(id).padStart(3, '0')}.aitechd.com`];
  assert.equal(entry.target, `/app-tool.html?id=${id}`);
  assert.equal(entry.name, appNames[id - 1][1]);
}
assert.equal(GAMES.length, 100);
for (const game of GAMES) {
  assert.equal(registry.hosts[`arcade-${String(game.number).padStart(3, '0')}.aitechd.com`].target, `/arcade100/?game=${game.id}`);
}
for (let id = 24; id <= 43; id++) {
  assert.equal(registry.hosts[`party-${id}.aitechd.com`].target, `/party.html?game=${id}`);
}

const response = route(new Request('https://app-007.aitechd.com/?id=98&room=AB12&tag=a&tag=b&next=https%3A%2F%2Fevil.invalid'));
const result = new URL(response.headers.get('Location'), 'https://app-007.aitechd.com');
assert.equal(result.pathname, '/app-tool.html');
assert.equal(result.searchParams.get('id'), '7');
assert.equal(result.searchParams.get('room'), 'AB12');
assert.deepEqual(result.searchParams.getAll('tag'), ['a', 'b']);
assert.equal(result.origin, 'https://app-007.aitechd.com');
assert.equal(response.headers.get('Cache-Control'), 'no-store');
assert.equal(route(new Request('https://gomoku.aitechd.com/?mode=local&room=ABC')).headers.get('Location'), '/board-games/?game=gomoku&mode=local&room=ABC');
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
console.log(`Subdomains passed: ${local.length} existing local routes, ${appNames.length} utility apps, ${GAMES.length} arcade entries, ${entries.length - local.length} separate/reserved hosts; query preservation, source coverage and private exclusions verified.`);
