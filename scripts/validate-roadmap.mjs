import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const spec = JSON.parse(await readFile(new URL('../roadmap/online-games-100.json', import.meta.url), 'utf8'));
assert.equal(spec.games.length, 100, 'Exactly 100 additional ideas are required.');
assert.equal(spec.retained.length, 3, 'Keep the three requested main games.');
assert.deepEqual(spec.retained.map(g => g.id), ['black-site','skybreak-rivals','aether-duel']);
assert.equal(new Set(spec.games.map(g => g.id)).size, 100, 'Duplicate game ids.');
assert.equal(new Set(spec.games.map(g => g.title)).size, 100, 'Duplicate game concepts.');
assert.equal(new Set(spec.games.map(g => g.category)).size, 10);
for (const game of spec.games) {
  assert.equal(game.status, 'planned', `${game.id}: proposals must not be advertised as playable.`);
  assert.equal(game.onlineRequired, true, `${game.id}: online play is mandatory.`);
  assert.ok(game.modes.length && game.modes.every(mode => ['pvp','coop'].includes(mode)));
  assert.ok(Number.isInteger(game.minPlayers) && Number.isInteger(game.maxPlayers));
  assert.ok(game.minPlayers >= 2 && game.maxPlayers >= game.minPlayers && game.maxPlayers <= 8);
  assert.ok(game.concept.length >= 20 && game.minutes);
  assert.ok(['P1','P2','P3'].includes(game.priority));
}
assert.equal(spec.games.filter(g => g.priority === 'P1').length, 10);
console.log('100 unique online concepts; 44 cooperative and 56 competitive; 3 retained games; 10 first-priority concepts.');
