import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../fps-game.js', import.meta.url), 'utf8');
const eventTarget = extra => ({ addEventListener() {}, removeEventListener() {}, ...extra });
const gradient = { addColorStop() {} };
const drawingContext = new Proxy({
  createRadialGradient: () => gradient,
  createLinearGradient: () => gradient
}, {
  get(target, key) { return key in target ? target[key] : () => {}; },
  set(target, key, value) { target[key] = value; return true; }
});
const documentTarget = eventTarget({ hidden: false });
const windowTarget = eventTarget({});
const context = vm.createContext({
  window: windowTarget,
  document: documentTarget,
  navigator: {},
  matchMedia: () => ({ matches: false }),
  performance: { now: () => 1000 },
  requestAnimationFrame: () => 1,
  cancelAnimationFrame() {},
  setTimeout: () => 1,
  clearTimeout() {},
  console
});
vm.runInContext(source, context, { filename: 'fps-game.js' });

const game = context.window.ARCADE_GAME;
assert.ok(game, 'ARCADE_GAME must be registered');
assert.equal(game.balance.targetKills, 20);
assert.equal(game.balance.bossUnlockKills, 19);
assert.ok(game.balance.bossHp > 1, 'boss must survive a normal shot');

assert.deepEqual(Array.from(game.balance.oneShotTypes).sort(), ['crawler', 'runner', 'spitter', 'walker']);
assert.deepEqual(Array.from(game.balance.fatTypes).sort(), ['brute', 'tank']);

for (const type of game.balance.oneShotTypes) {
  const cfg = game.balance.enemyTypes[type];
  assert.equal(cfg.hp, 1, `${type} config must have exactly one HP`);
  assert.equal(cfg.fat, false, `${type} must not be classified as fat`);
  assert.equal(game.balance.resolveDamage({ type, hp: 99 }, 1, false), 99, `${type} must die from any valid hit even if its HP drifts`);
}

for (const type of game.balance.fatTypes) {
  const cfg = game.balance.enemyTypes[type];
  assert.ok(cfg.hp > 1, `${type} must take multiple body shots`);
  assert.equal(cfg.fat, true, `${type} must be classified as fat`);
  assert.equal(game.balance.resolveDamage({ type, hp: cfg.hp }, 1, false), 1, `${type} body shot damage must remain one`);
  assert.equal(game.balance.resolveDamage({ type, hp: cfg.hp }, 1, true), 2, `${type} critical hit must deal double damage`);
}

assert.equal(game.balance.resolveDamage({ boss: true, type: 'boss', hp: game.balance.bossHp }, 1, false), 1);
assert.equal(game.balance.resolveDamage({ boss: true, type: 'boss', hp: game.balance.bossHp }, 1, true), 2);
assert.match(game.instructions, /1発/);

const canvas = eventTarget({
  width: 960,
  height: 540,
  getContext: () => drawingContext,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 960, height: 540 }),
  setPointerCapture() {},
  releasePointerCapture() {}
});
const engine = game.create({
  canvas,
  controlsRoot: { querySelectorAll: () => [] },
  fireButton: eventTarget({}),
  mode: 'solo',
  onScore() {},
  onToast() {},
  onComplete() {},
  onProgress() {}
});
engine.start(20260911);
const snapshot = engine.stop();
assert.equal(snapshot.kills, 0);
assert.equal(snapshot.revives, 1);
engine.destroy();

console.log('FPS systems OK', JSON.stringify({
  oneShot: Array.from(game.balance.oneShotTypes),
  fat: Array.from(game.balance.fatTypes),
  bossHp: game.balance.bossHp
}));
