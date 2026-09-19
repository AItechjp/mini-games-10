import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createGame, act, legalActions, validateDeck, viewFor, chooseAI, stackDP, securityAttack, SUPPORTED_IDS} from '../digimon-card/engine.mjs';

const paths = ['../digimon-card/starter.json', '../../digimon-data/starter.json'];
const source = paths.map(p => new URL(p, import.meta.url)).find(p => fs.existsSync(p));
assert.ok(source, 'A verified starter catalog is required.');
const raw = JSON.parse(fs.readFileSync(source, 'utf8'));
const catalog = Object.fromEntries((Array.isArray(raw) ? raw : Object.values(raw)).map(c => [c.id, c]));
assert.equal(catalog['ST1-10'].evolution[0].level, 5, 'Phoenixmon uses the verified printed Lv.5 requirement, not the official HTML typo.');
const quantities = {
  ST1: [4,4,4,4,4,2,4,4,2,2,4,4,4,2,2],
  ST2: [4,4,4,4,2,4,4,4,2,2,4,4,4,2,2]
};
const deck = set => ({main: quantities[set].flatMap((n, i) => Array(n).fill(`${set}-${String(i + 2).padStart(2, '0')}`)), eggs: Array(4).fill(`${set}-01`)});
const fresh = (options = {}) => createGame(catalog, {decks: {p1: deck('ST1'), p2: deck('ST2')}, seed: 193, ...options});
let testUid = 10000;
const instance = id => ({uid: `test${testUid++}`, id});
const stack = (...ids) => ({uid: `stack${testUid++}`, cards: ids.map(instance), suspended: false, bornTurn: 0, mods: [], used: {}});
function fixture() {
  const s = fresh({mulligan: false});
  s.turnNumber = 3; s.turnCounts = {p1: 2, p2: 1}; s.phase = 'main'; s.memory = 10;
  for (const p of Object.values(s.players)) { p.hand = []; p.battle = []; p.tamers = []; p.breeding = null; p.trash = []; }
  return s;
}
function hand(s, side, id) { const c = instance(id); s.players[side].hand.push(c); return c.uid; }
function choose(s, predicate = () => true) {
  assert.ok(s.pending, 'Expected an effect choice.');
  const c = s.pending.choices.find(predicate);
  assert.ok(c, 'Expected choice missing.');
  return act(s, s.pending.player, {type: 'choose', choice: c.id});
}
function finishChoices(s) { let guard = 0; while (s.pending && guard++ < 20) s = choose(s); return s; }
function attack(s, attacker, target = 'security') { return act(s, 'p1', {type: 'attack', stack: attacker.uid, target}); }
function securityHit(s, attacker, cardIds) {
  s.players.p2.security = cardIds.map(instance);
  s = finishChoices(attack(s, attacker));
  return act(s, 'p2', {type: 'declineBlock'});
}

test('deck size, egg rules, card-number copy cap and unsupported-card rejection', () => {
  assert.deepEqual(validateDeck(catalog, deck('ST1')), []);
  assert.equal(SUPPORTED_IDS.length, 32);
  assert.match(validateDeck(catalog, {...deck('ST1'), main: deck('ST1').main.slice(1)}).join(), /exactly 50/);
  assert.match(validateDeck(catalog, {...deck('ST1'), eggs: Array(6).fill('ST1-01')}).join(), /at most 5/);
  const invalid = deck('ST1'); invalid.main[49] = 'ST1-02';
  assert.match(validateDeck(catalog, invalid).join(), /maximum 4/);
  invalid.main[49] = 'BT1-001';
  assert.match(validateDeck(catalog, invalid).join(), /no verified automated effect support/);
  assert.throws(() => fresh({decks: {p1: invalid, p2: deck('ST2')}}), /unsupported|support/);
});

test('seeded setup, whole-hand mulligan before reverse-order security, no first draw', () => {
  const original = fresh();
  assert.deepEqual(original, fresh());
  assert.equal(original.players.p1.security.length, 0);
  assert.equal(original.players.p1.deck.length, 45);
  let s = act(original, 'p1', {type: 'mulligan', take: true});
  assert.equal(s.players.p1.deck.length, 45);
  assert.equal(s.players.p1.hand.length, 5);
  assert.equal(original.players.p1.mulliganDone, false, 'act does not mutate previous state');
  const expected = s.players.p2.deck.slice(0, 5).reverse();
  s = act(s, 'p2', {type: 'mulligan', take: false});
  assert.deepEqual(s.players.p2.security, expected);
  assert.equal(s.players.p1.hand.length, 5);
  assert.equal(s.players.p1.deck.length, 40);
  assert.equal(s.phase, 'raising');
  assert.throws(() => act(s, 'p1', {type: 'mulligan', take: true}), /Illegal/);
});

test('raising permits exactly one choice; level 2 cannot promote; first turn cannot attack', () => {
  let s = fresh({mulligan: false});
  s = act(s, 'p1', {type: 'hatch'});
  assert.equal(s.phase, 'main');
  assert.throws(() => act(s, 'p1', {type: 'hatch'}), /Illegal/);
  s.players.p1.battle.push(stack('ST1-04'));
  assert.ok(!legalActions(s, 'p1').some(a => a.type === 'attack'));
  s = act(s, 'p1', {type: 'pass'});
  assert.equal(s.turn, 'p2'); assert.equal(s.memory, 3);
  assert.equal(s.players.p2.hand.length, 6);
  s = act(s, 'p2', {type: 'skipRaising'});
  s = act(s, 'p2', {type: 'pass'});
  assert.ok(!legalActions(s, 'p1').some(a => a.type === 'raise'));
});

test('the first player declares mulligan before the second player, including p2 first', () => {
  let s = fresh({firstPlayer: 'p2'});
  assert.deepEqual(legalActions(s, 'p1'), []);
  assert.equal(legalActions(s, 'p2').length, 2);
  assert.throws(() => act(s, 'p1', {type: 'mulligan', take: false}), /Illegal/);
  s = act(s, 'p2', {type: 'mulligan', take: false});
  assert.deepEqual(legalActions(s, 'p2'), []);
  assert.equal(legalActions(s, 'p1').length, 2);
  s = act(s, 'p1', {type: 'mulligan', take: false});
  assert.equal(s.turn, 'p2'); assert.equal(s.players.p2.hand.length, 5);
});

test('summoning sickness survives evolution; raising evolution draws with no effects', () => {
  let s = fixture();
  const base = hand(s, 'p1', 'ST1-04');
  s = act(s, 'p1', {type: 'play', card: base});
  const uid = s.players.p1.battle[0].uid;
  const evo = hand(s, 'p1', 'ST1-05');
  const before = s.players.p1.deck.length;
  s = act(s, 'p1', {type: 'evolve', card: evo, stack: uid});
  assert.equal(s.players.p1.deck.length, before - 1);
  assert.ok(!legalActions(s, 'p1').some(a => a.type === 'attack'));
  s = fixture();
  s.players.p1.breeding = stack('ST1-01', 'ST1-03', 'ST1-05');
  const raising = s.players.p1.breeding;
  const garuda = hand(s, 'p1', 'ST1-08');
  s = act(s, 'p1', {type: 'evolve', card: garuda, stack: raising.uid});
  assert.equal(s.pending, null);
  assert.equal(stackDP(s, 'p1', s.players.p1.breeding), 7000);
  assert.equal(s.players.p1.breeding.mods.length, 0);
});

test('evolution condition and memory limit are enforced, Phoenixmon evolves from level 5', () => {
  let s = fixture(); s.memory = 0;
  const high = hand(s, 'p1', 'ST1-11');
  assert.ok(!legalActions(s, 'p1').some(a => a.type === 'play' && a.card === high));
  const base = stack('ST1-09'); s.players.p1.battle.push(base);
  const phoenix = hand(s, 'p1', 'ST1-10');
  assert.ok(legalActions(s, 'p1').some(a => a.type === 'evolve' && a.card === phoenix));
  const wrong = hand(s, 'p1', 'ST2-10');
  assert.ok(!legalActions(s, 'p1').some(a => a.type === 'evolve' && a.card === wrong));
  s = act(s, 'p1', {type: 'evolve', card: phoenix, stack: base.uid});
  assert.equal(s.turn, 'p2'); assert.equal(s.memory, 2);
});

test('normal turn pass grants exactly 3; mandatory empty draw loses, evolution draw does not', () => {
  let s = fixture(); s.players.p2.deck = [];
  s = act(s, 'p1', {type: 'pass'});
  assert.equal(s.winner, 'p1');
  s = fixture(); s.players.p1.deck = [];
  const base = stack('ST1-03'); s.players.p1.battle.push(base);
  const evo = hand(s, 'p1', 'ST1-05');
  s = act(s, 'p1', {type: 'evolve', card: evo, stack: base.uid});
  assert.equal(s.winner, null);
  s = act(s, 'p1', {type: 'pass'});
  assert.equal(s.memory, 3);
});

test('option colors can come from breeding, never from hand or inherited colors', () => {
  let s = fixture(); const spark = hand(s, 'p1', 'ST2-13'); hand(s, 'p1', 'ST2-03');
  assert.ok(!legalActions(s, 'p1').some(a => a.card === spark));
  s.players.p1.breeding = stack('ST2-01');
  assert.ok(legalActions(s, 'p1').some(a => a.card === spark));
  s.memory = 1; s = act(s, 'p1', {type: 'play', card: spark});
  assert.equal(s.memory, 2);
});

test('Koromon, Agumon and Tai stack only in own battle turn; Greymon and WarGreymon security counts', () => {
  const s = fixture();
  const digimon = stack('ST1-01', 'ST1-03', 'ST1-07', 'ST1-09', 'ST1-11');
  s.players.p1.battle.push(digimon);
  s.players.p1.tamers.push(instance('ST1-12'), instance('ST1-12'));
  assert.equal(stackDP(s, 'p1', digimon), 16000);
  assert.equal(securityAttack(s, 'p1', digimon), 4);
  s.turn = 'p2';
  assert.equal(stackDP(s, 'p1', digimon), 12000);
  assert.equal(securityAttack(s, 'p1', digimon), 2);
  const short = stack('ST1-01', 'ST1-03', 'ST1-08');
  s.turn = 'p1';
  assert.equal(stackDP(s, 'p1', short), 10000);
});

test('Garudamon and Shadow Wing grant chosen +3000 this turn, expiring at turn end', () => {
  for (const sourceId of ['ST1-08', 'ST1-13']) {
    let s = fixture();
    const base = stack('ST1-05'); s.players.p1.battle.push(base);
    const card = hand(s, 'p1', sourceId);
    s = act(s, 'p1', sourceId === 'ST1-08' ? {type: 'evolve', card, stack: base.uid} : {type: 'play', card});
    assert.equal(s.pending.player, 'p1');
    s = choose(s);
    assert.equal(s.players.p1.battle[0].mods[0].amount, 3000);
    s = act(s, 'p1', {type: 'pass'});
    assert.equal(s.players.p1.battle[0].mods.length, 0);
  }
});

test('explicit blockers, attacker memory penalty, blocked MetalGreymon gain, equal DP deletes both', () => {
  let s = fixture(); s.memory = 1;
  const attacker = stack('ST1-09', 'ST1-06'), defender = stack('ST2-07');
  s.players.p1.battle.push(attacker); s.players.p2.battle.push(defender);
  s = attack(s, attacker);
  assert.equal(s.memory, -1);
  assert.equal(s.turn, 'p1', 'attack must finish before memory changes turns');
  assert.ok(legalActions(s, 'p2').some(a => a.type === 'block'));
  assert.deepEqual(legalActions(s, 'p1'), []);
  s = act(s, 'p2', {type: 'block', stack: defender.uid});
  assert.equal(s.memory, 2);
  assert.equal(s.players.p1.battle.length, 0);
  assert.equal(s.players.p2.battle.length, 0);
  assert.equal(s.players.p1.trash.length, 2);
});

test('attack can only target suspended enemy; ordinary battle does not trigger blocked gain', () => {
  let s = fixture();
  const attacker = stack('ST1-09', 'ST1-10'), defender = stack('ST2-04');
  s.players.p1.battle.push(attacker); s.players.p2.battle.push(defender);
  assert.ok(!legalActions(s, 'p1').some(a => a.target === defender.uid));
  defender.suspended = true;
  s.memory = 3;
  s = attack(s, attacker, defender.uid);
  s = act(s, 'p2', {type: 'declineBlock'});
  assert.equal(s.memory, 3);
  assert.equal(s.players.p2.battle.length, 0);
});

test('multiple checks do not win just by exhausting security; next player attack does', () => {
  let s = fixture(); const attacker = stack('ST1-07', 'ST1-10');
  s.players.p1.battle.push(attacker);
  s = securityHit(s, attacker, ['ST2-02']);
  assert.equal(s.players.p2.security.length, 0);
  assert.equal(s.winner, null);
  s.players.p1.battle[0].suspended = false;
  s = attack(s, s.players.p1.battle[0]);
  s = act(s, 'p2', {type: 'declineBlock'});
  assert.equal(s.winner, 'p1');
});

test('security Hammer Spark changes memory immediately but remaining checks still finish', () => {
  let s = fixture(); s.memory = 1;
  const attacker = stack('ST1-07', 'ST1-10'); s.players.p1.battle.push(attacker);
  s = securityHit(s, attacker, ['ST2-13', 'ST2-02', 'ST2-04']);
  assert.equal(s.players.p2.security.length, 1);
  assert.equal(s.turn, 'p2'); assert.equal(s.memory, 1);
});

test('security Gaia Force resolves its choice immediately and stops remaining checks', () => {
  let s = fixture(); const attacker = stack('ST1-07', 'ST1-10'); s.players.p1.battle.push(attacker);
  s = securityHit(s, attacker, ['ST1-16', 'ST2-02']);
  assert.equal(s.pending.player, 'p2');
  assert.equal(s.players.p2.security.length, 1);
  s = choose(s);
  assert.equal(s.attack, null);
  assert.equal(s.players.p1.battle.length, 0);
  assert.equal(s.players.p2.security.length, 1);
});

test('security Shadow Wing aura also applies to future entrants through next own turn', () => {
  let s = fixture(); const attacker = stack('ST1-10'); s.players.p1.battle.push(attacker);
  s = securityHit(s, attacker, ['ST1-13']);
  const future = stack('ST2-04'); s.players.p2.battle.push(future);
  assert.equal(securityAttack(s, 'p2', future), 2);
  s = act(s, 'p1', {type: 'pass'});
  assert.equal(securityAttack(s, 'p2', s.players.p2.battle[0]), 2);
  s = act(s, 'p2', {type: 'skipRaising'}); s = act(s, 'p2', {type: 'pass'});
  assert.equal(securityAttack(s, 'p2', s.players.p2.battle[0]), 1);
});

test('Starlight Explosion main protects next opposing turn; security protects current checks', () => {
  let s = fixture(); const red = stack('ST1-04'); s.players.p1.battle.push(red);
  const card = hand(s, 'p1', 'ST1-14'); s = act(s, 'p1', {type: 'play', card});
  assert.equal(s.players.p1.auras[0].amount, 7000);
  s = act(s, 'p1', {type: 'pass'});
  assert.equal(s.players.p1.auras.length, 1);
  s = act(s, 'p2', {type: 'skipRaising'}); s = act(s, 'p2', {type: 'pass'});
  assert.equal(s.players.p1.auras.length, 0);
  s = fixture(); const attacker = stack('ST1-07', 'ST1-08'); s.players.p1.battle.push(attacker);
  s = securityHit(s, attacker, ['ST1-14', 'ST2-02']);
  assert.equal(s.players.p1.battle.length, 0, '3000 security DP +7000 defeats 7000 attacker');
});

test('Giga Destroyer selects one or two eligible targets under current rules, Gaia Force any one', () => {
  for (const option of ['ST1-15', 'ST1-16']) {
    let s = fixture(); s.players.p1.breeding = stack('ST1-01');
    s.players.p2.battle.push(stack('ST2-02'), stack('ST2-04'), stack('ST2-10'));
    const card = hand(s, 'p1', option); s = act(s, 'p1', {type: 'play', card});
    if (option === 'ST1-15') {
      assert.ok(s.pending.choices.every(c => c.targets.length >= 1));
      assert.ok(s.pending.choices.every(c => !c.targets.includes(s.players.p2.battle[2].uid)));
      s = choose(s, c => c.targets.length === 2);
      assert.equal(s.players.p2.battle.length, 1);
    } else { s = choose(s, c => c.stack === s.players.p2.battle[2].uid); assert.equal(s.players.p2.battle.length, 2); }
  }
});

test('Tsunomon applies only against source-free battle Digimon, WereGarurumon needs an opponent', () => {
  const s = fixture(), attacker = stack('ST2-01', 'ST2-08', 'ST2-11');
  s.players.p1.battle.push(attacker);
  assert.equal(stackDP(s, 'p1', attacker), 11000);
  assert.equal(securityAttack(s, 'p1', attacker), 1);
  const enemy = stack('ST1-04'); s.players.p2.breeding = enemy;
  assert.equal(securityAttack(s, 'p1', attacker), 1);
  s.players.p2.battle.push(enemy); s.players.p2.breeding = null;
  assert.equal(stackDP(s, 'p1', attacker, enemy), 12000);
  assert.equal(securityAttack(s, 'p1', attacker), 2);
  enemy.cards.unshift(instance('ST1-01'));
  assert.equal(stackDP(s, 'p1', attacker, enemy), 11000);
  assert.equal(securityAttack(s, 'p1', attacker), 1);
});

test('Gabumon/Garurumon source stripping and MetalGarurumon simultaneous ordering/once per turn', () => {
  let s = fixture();
  const attacker = stack('ST2-01', 'ST2-03', 'ST2-06', 'ST2-08', 'ST2-11');
  const enemy = stack('ST1-01', 'ST1-03', 'ST1-08');
  s.players.p1.battle.push(attacker); s.players.p2.battle.push(enemy);
  s.players.p2.security = [instance('ST1-02'), instance('ST1-02'), instance('ST1-02'), instance('ST1-02')];
  s = finishChoices(attack(s, attacker));
  assert.equal(s.players.p2.battle[0].cards.length, 1);
  assert.equal(s.players.p2.trash[0].id, 'ST1-01');
  assert.equal(s.players.p1.battle[0].suspended, false);
  s = act(s, 'p2', {type: 'declineBlock'});
  assert.equal(s.players.p2.security.length, 2, 'source stripping enables WereGarurumon before checks');
  s = finishChoices(attack(s, s.players.p1.battle[0]));
  assert.equal(s.players.p1.battle[0].suspended, true, 'once-per-turn unsuspend cannot recur');
});

test('Gabumon does not target level 6, Garurumon can; Zudomon strips up to two bottoms', () => {
  for (const inherited of ['ST2-03', 'ST2-06']) {
    let s = fixture(); const attacker = stack(inherited, 'ST2-10'); s.players.p1.battle.push(attacker);
    s.players.p2.battle.push(stack('ST1-01', 'ST1-10'));
    s = attack(s, attacker);
    assert.equal(Boolean(s.pending), inherited === 'ST2-06');
  }
  for (const sources of [1, 2]) {
    let s = fixture(); const own = stack('ST2-05'); s.players.p1.battle.push(own);
    s.players.p2.battle.push(sources === 1 ? stack('ST1-03', 'ST1-05') : stack('ST1-01', 'ST1-03', 'ST1-05'));
    const card = hand(s, 'p1', 'ST2-09'); s = act(s, 'p1', {type: 'evolve', card, stack: own.uid}); s = choose(s);
    assert.equal(s.players.p2.battle[0].cards.length, 1);
    assert.equal(s.players.p2.trash.length, sources);
  }
});

test('Matt gains memory only at own turn start, each Tamer stacks, breeding does not count', () => {
  let s = fixture(); s.players.p2.tamers.push(instance('ST2-12'), instance('ST2-12'));
  s.players.p1.battle.push(stack('ST1-04'));
  s = act(s, 'p1', {type: 'pass'});
  assert.equal(s.memory, 5);
  s = fixture(); s.players.p2.tamers.push(instance('ST2-12')); s.players.p1.breeding = stack('ST1-04');
  s = act(s, 'p1', {type: 'pass'});
  assert.equal(s.memory, 3);
});

test('source-stripping can select an otherwise eligible source-free Digimon and do nothing', () => {
  for (const id of ['ST2-03', 'ST2-06', 'ST2-09']) {
    let s = fixture();
    const naked = stack('ST1-05'), evolved = stack('ST1-03', 'ST1-05');
    s.players.p2.battle.push(naked, evolved);
    if (id === 'ST2-09') {
      const base = stack('ST2-05'); s.players.p1.battle.push(base);
      const card = hand(s, 'p1', id); s = act(s, 'p1', {type: 'evolve', card, stack: base.uid});
    } else {
      const attacker = stack(id, 'ST2-10'); s.players.p1.battle.push(attacker);
      s = attack(s, attacker);
    }
    assert.equal(s.pending.choices.length, 2);
    s = choose(s, c => c.stack === naked.uid);
    assert.equal(s.players.p2.trash.length, 0);
    assert.equal(s.players.p2.battle[1].cards.length, 2);
  }
});

test('both security Tamers enter for free and do not enter trash', () => {
  for (const id of ['ST1-12', 'ST2-12']) {
    let s = fixture(); const attacker = stack('ST1-10'); s.players.p1.battle.push(attacker);
    s = securityHit(s, attacker, [id]);
    assert.equal(s.players.p2.tamers[0].id, id);
    assert.equal(s.players.p2.trash.length, 0);
    assert.equal(s.memory, 10);
  }
});

test('Sorrow Blue main persists through evolution and prevents attack/block through next enemy turn', () => {
  let s = fixture(); s.players.p1.breeding = stack('ST2-01');
  const target = stack('ST1-03'); s.players.p2.battle.push(target);
  const card = hand(s, 'p1', 'ST2-14'); s = act(s, 'p1', {type: 'play', card}); s = choose(s);
  s = act(s, 'p1', {type: 'pass'}); s = act(s, 'p2', {type: 'skipRaising'});
  const evo = hand(s, 'p2', 'ST1-06'); s = act(s, 'p2', {type: 'evolve', card: evo, stack: target.uid});
  assert.ok(!legalActions(s, 'p2').some(a => a.type === 'attack'));
  assert.equal(s.players.p2.battle[0].mods.length, 1);
  s = act(s, 'p2', {type: 'pass'});
  assert.equal(s.players.p2.battle[0].mods.length, 0);
});

test('Sorrow Blue security lasts through next own turn and does not cancel current attack', () => {
  let s = fixture(); const attacker = stack('ST1-10'); s.players.p1.battle.push(attacker);
  s = securityHit(s, attacker, ['ST2-14']); s = choose(s);
  assert.equal(s.attack, null);
  assert.equal(s.players.p1.battle[0].mods.length, 1);
  s = act(s, 'p1', {type: 'pass'});
  assert.equal(s.players.p1.battle[0].mods.length, 1);
  s = act(s, 'p2', {type: 'skipRaising'}); s = act(s, 'p2', {type: 'pass'});
  assert.equal(s.players.p1.battle[0].mods.length, 0);
});

test('Kaiser Nail main/security only select Digimon sources, play active without parent modifiers', () => {
  for (const security of [false, true]) {
    let s = fixture(); const owner = security ? 'p2' : 'p1';
    const parent = stack('ST2-01', 'ST2-03', 'ST2-08'); parent.suspended = true;
    parent.mods.push({kind: 'dp', amount: 3000, expires: {side: 'p1', turn: 2}});
    s.players[owner].battle.push(parent);
    if (security) { const attacker = stack('ST1-10'); s.players.p1.battle.push(attacker); s = securityHit(s, attacker, ['ST2-15']); }
    else { const card = hand(s, owner, 'ST2-15'); s = act(s, owner, {type: 'play', card}); }
    assert.equal(s.pending.choices.length, 1);
    s = choose(s);
    const summoned = s.players[owner].battle[1];
    assert.equal(summoned.cards[0].id, 'ST2-03'); assert.equal(summoned.suspended, false);
    assert.equal(summoned.mods.length, 0); assert.equal(summoned.bornTurn, 3);
    assert.ok(!legalActions(s, owner).some(a => a.type === 'attack' && a.stack === summoned.uid));
  }
});

test('Cocytus Breath main/security returns only top card; sources go to trash', () => {
  for (const security of [false, true]) {
    let s = fixture(); const targetSide = security ? 'p1' : 'p2';
    const target = stack('ST1-01', 'ST1-03', 'ST1-10'); s.players[targetSide].battle.push(target);
    if (security) s = securityHit(s, target, ['ST2-16', 'ST2-02']);
    else { s.players.p1.breeding = stack('ST2-01'); const card = hand(s, 'p1', 'ST2-16'); s = act(s, 'p1', {type: 'play', card}); }
    s = choose(s);
    assert.equal(s.players[targetSide].battle.length, 0);
    assert.equal(s.players[targetSide].hand.at(-1).id, 'ST1-10');
    assert.deepEqual(s.players[targetSide].trash.map(c => c.id), ['ST1-01', 'ST1-03']);
  }
});

test('online view hides both decks/security and opponent hand, preserves own hand and legal actions', () => {
  const s = fresh(), view = viewFor(s, 'p1');
  assert.ok(view.players.p1.hand.every(c => c.id));
  assert.ok(view.players.p2.hand.every(c => c === null));
  assert.ok(view.players.p1.deck.every(c => c === null));
  assert.ok(view.players.p2.deck.every(c => c === null));
  assert.equal(view.rng, undefined); assert.equal(view.nextUid, undefined);
  assert.deepEqual(view.legalActions, legalActions(s, 'p1'));
  const ready = viewFor(fresh({mulligan: false}), 'p2');
  assert.ok(ready.players.p1.security.every(c => c === null));
  assert.ok(ready.players.p2.security.every(c => c === null));
});

test('AI completes deterministic games using only legal actions, without mutating state', () => {
  for (const seed of [1, 2, 73]) {
    let s = fresh({seed, firstPlayer: seed === 2 ? 'p2' : 'p1'}), moves = 0;
    while (!s.winner && moves++ < 1200) {
      const second = s.firstPlayer === 'p1' ? 'p2' : 'p1';
      const side = s.pending?.player || (s.attack?.stage === 'block' ? (s.attack.player === 'p1' ? 'p2' : 'p1') : s.phase === 'mulligan' ? (!s.players[s.firstPlayer].mulliganDone ? s.firstPlayer : second) : s.turn);
      const before = JSON.stringify(s);
      const action = chooseAI(s, side);
      assert.ok(action, `AI must have an action in ${s.phase}`);
      assert.equal(JSON.stringify(s), before);
      s = act(s, side, action);
    }
    assert.ok(s.winner, `Seed ${seed} must finish, ${moves} actions`);
  }
});
