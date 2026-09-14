import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { mtgQuery, mtgPage, japanDate, normalizeMTG, safeURL } from '../commons/card-library/catalog-core.mjs';
import { plain, safeImage, parseSearch, parseDetail, searchParams, validId } from '../supabase/functions/commons-cards/core.mjs';

// Boundary tests for complete pagination, original-language text, and untrusted upstream HTML.
for (let page = 1; page <= 2000; page++) {
  const { sourcePage, offset } = mtgPage(page);
  assert.equal((sourcePage - 1) * 175 + offset, (page - 1) * 25);
  const dm = searchParams(new URLSearchParams({ page }));
  assert.equal((Number(dm.params.get('pagenum')) - 1) * 50 + dm.offset, (page - 1) * 10);
}
assert.equal(japanDate(new Date('2026-09-14T15:01:00Z')), '2026-09-15');
const query = mtgQuery({ lang: 'both', q: 'A" OR game:arena', flavor: 'all' }, '2026-09-15');
assert.match(query, /^game:paper date<=2026-09-15 \(lang:ja OR lang:en\)/);
assert.match(query, /name:"A  OR game:arena"/);
assert.equal(plain('A<br>B &amp; &#x1f4d6; <script>alert(1)</script>'), 'A\nB & 📖');
assert.equal(safeImage('https://evil.example/card.jpg'), '');
assert.equal(safeURL('javascript:alert(1)'), '');
assert.equal(safeURL('https://scryfall.com.evil.example/test'), '');
assert.equal(validId('../admin?url=https://evil.example'), false);
assert.throws(() => searchParams(new URLSearchParams({ page: '-1' })));
assert.throws(() => parseSearch('<h1>Unavailable</h1>'));
assert.throws(() => parseDetail('<h1>Not found</h1>', 'dm01-001'));
const list = '<span id="total_count">51</span><ul class="cardList01 clearfix"><li><a href="/card/detail/?id=dm01-001"><img src="/wp-content/card/cardthumb/dm01-001.jpg"></a></li></ul>';
assert.equal(parseSearch(list).total, 51);
assert.equal(parseSearch(list).cards.length, 1);
const block = (name, flavor) => `<div class='card-itself'><h3 class='card-name'>${name}<span class='packname'>(TEST 1/2)</span></h3><div class='card-img'><img src='/wp-content/card/cardimage/test-001.jpg'></div>${flavor === null ? '' : `<td class='flavor full'>${flavor}</td>`}</div>`;
const detail = parseDetail(block('A / B', '') + block('A / B', null), 'test-001');
assert.equal(detail.name, 'A / B');
assert.deepEqual(detail.faces.map(f => f.flavorStatus), ['none', 'unavailable']);
const normalized = normalizeMTG({ id: 'test', name: 'Two faces', lang: 'ja', set_name: 'Test', card_faces: [{ name: 'Face A', printed_name: '表', flavor_text: '独自のテスト文章。' }, { name: 'Face B', printed_name: '裏', flavor_text: '裏面のテスト文章。' }], scryfall_uri: 'https://scryfall.com/card/test' });
assert.equal(normalized.faces.length, 2);
assert.equal(normalized.faces[1].flavor, '裏面のテスト文章。');
for (const slug of ['mtg-flavor', 'duel-masters-flavor']) {
  const html = await readFile(`commons/${slug}/index.html`, 'utf8');
  assert.match(html, /id="search-form"/); assert.match(html, /id="reader-dialog"/);
  assert.match(html, /収録範囲/); assert.doesNotMatch(html, /maximum-scale=1|user-scalable=no/);
  for (const path of ['styles.css', 'app.mjs', 'catalog-core.mjs']) assert.ok((await stat('commons/card-library/' + path)).size > 0);
}
console.log('Card library: 2,000 pagination boundaries per game, Japanese day boundary, dual faces, missing text, source failure, safe URLs and both route shells passed.');
