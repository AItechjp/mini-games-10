/**
 * Deterministic ST1/ST2 rules engine. No DOM, network or hidden-information AI.
 * Sources (accessed 2026-09-19):
 * https://digimoncard.com/rule/pdf/general_rule.pdf?20260918= (v4.3)
 * https://digimoncard.com/cards/?search=true&category=503101
 * https://digimoncard.com/cards/?search=true&category=503102
 * Supported automated card effects are deliberately limited to these 32 cards.
 * In a stack, cards are ordered bottom-to-top; deck/security arrays are top-first.
 * All returned states/actions are JSON serializable. act() never mutates its input.
 */

export const SUPPORTED_IDS = Object.freeze([1, 2].flatMap(set =>
  Array.from({length: 16}, (_, i) => `ST${set}-${String(i + 1).padStart(2, '0')}`)));
const SUPPORTED = new Set(SUPPORTED_IDS);
const SIDES = ['p1', 'p2'];
const other = side => side === 'p1' ? 'p2' : 'p1';
const who = side => side === 'p1' ? 'プレイヤー1' : 'プレイヤー2';
const clone = value => JSON.parse(JSON.stringify(value));
const top = stack => stack.cards[stack.cards.length - 1];
const cardMap = catalog => Array.isArray(catalog) ? Object.fromEntries(catalog.map(c => [c.id, c])) : catalog;
const idOf = card => typeof card === 'string' ? card : card.id;
const sourceCount = stack => stack.cards.length - 1;
const sourceIds = stack => stack.cards.slice(0, -1).map(c => c.id);
const isSupported = id => SUPPORTED.has(id);

export function validateDeck(catalog, deck) {
  catalog = cardMap(catalog);
  const errors = [];
  const main = deck?.main || [];
  const eggs = deck?.eggs || deck?.eggDeck || [];
  if (main.length !== 50) errors.push('The main deck must contain exactly 50 cards.');
  if (eggs.length > 5) errors.push('The Digi-Egg deck may contain at most 5 cards.');
  const counts = {};
  for (const [cards, isEgg] of [[main, false], [eggs, true]]) {
    for (const item of cards) {
      const id = idOf(item);
      const card = catalog[id];
      counts[id] = (counts[id] || 0) + 1;
      if (!card) errors.push(`Unknown card: ${id}.`);
      else if ((card.category === 'egg') !== isEgg) errors.push(`${id} is in the wrong deck.`);
      if (!isSupported(id)) errors.push(`${id} has no verified automated effect support; only ST1 and ST2 are playable.`);
    }
  }
  for (const [id, count] of Object.entries(counts)) if (count > 4) errors.push(`${id}: maximum 4 copies across your decks.`);
  return [...new Set(errors)];
}

function random(state) {
  let x = state.rng;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  state.rng = x >>> 0;
  return state.rng / 0x100000000;
}
function shuffle(state, cards) {
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(random(state) * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }
}
function uid(state, prefix = 'c') { return `${prefix}${state.nextUid++}`; }
function instantiate(state, id) { return {uid: uid(state), id: idOf(id)}; }
function note(state, text, extra = {}) {
  state.log.push({turn: state.turnNumber, text, ...extra});
}
function draw(state, side, count = 1, mandatory = false) {
  const player = state.players[side];
  for (let i = 0; i < count; i++) {
    if (!player.deck.length) {
      if (mandatory) finishGame(state, other(side), `${who(side)}はドローフェイズにカードを引けないため敗北。`);
      return;
    }
    player.hand.push(player.deck.shift());
  }
  note(state, `${who(side)}が${count}枚ドロー。`);
}
function finishGame(state, winner, reason) {
  state.winner = winner;
  state.phase = 'finished';
  state.attack = null;
  state.pending = null;
  state.queue = [];
  note(state, reason, {winner});
}

export function createGame(catalog, options = {}) {
  catalog = cardMap(catalog);
  const firstPlayer = options.firstPlayer || 'p1';
  if (!SIDES.includes(firstPlayer)) throw new Error('firstPlayer must be p1 or p2.');
  for (const side of SIDES) {
    const errors = validateDeck(catalog, options.decks?.[side]);
    if (errors.length) throw new Error(`${side}: ${errors.join(' ')}`);
  }
  const state = {
    version: 1, catalog: clone(catalog), players: {}, firstPlayer, turn: firstPlayer,
    turnNumber: 0, turnCounts: {p1: 0, p2: 0}, phase: 'mulligan', memory: 0,
    pending: null, queue: [], attack: null, revealedSecurity: null, winner: null,
    rng: (Number(options.seed ?? 1) >>> 0) || 1, nextUid: 1, log: [],
    supportedSets: ['ST1', 'ST2']
  };
  for (const side of SIDES) {
    const deck = options.decks[side];
    state.players[side] = {
      deck: deck.main.map(id => instantiate(state, id)),
      eggDeck: (deck.eggs || deck.eggDeck || []).map(id => instantiate(state, id)),
      hand: [], security: [], breeding: null, battle: [], tamers: [], trash: [], auras: [], mulliganDone: false
    };
    shuffle(state, state.players[side].deck);
    shuffle(state, state.players[side].eggDeck);
    draw(state, side, 5);
  }
  note(state, '先攻から順に手札を確認し、引き直すか選んでください。その後セキュリティを置きます。');
  if (options.mulligan === false) {
    for (const side of SIDES) state.players[side].mulliganDone = true;
    setupSecurity(state);
  }
  return state;
}

function setupSecurity(state) {
  for (const side of SIDES) state.players[side].security = state.players[side].deck.splice(0, 5).reverse();
  note(state, '双方のセキュリティに5枚ずつ配置。');
  beginTurn(state);
}
function gainMemory(state, side, amount) {
  state.memory = Math.max(-10, Math.min(10, state.memory + (side === state.turn ? amount : -amount)));
}
function beginTurn(state) {
  state.turnNumber++;
  state.turnCounts[state.turn]++;
  const side = state.turn, player = state.players[side];
  state.phase = 'raising';
  note(state, `${who(side)}の${state.turnCounts[side]}ターン目。`);
  // Start-of-turn effects occur before unsuspending and drawing.
  if (hasSourcelessOpponent(state, side)) {
    const matts = player.tamers.filter(c => c.id === 'ST2-12').length;
    if (matts) { gainMemory(state, side, matts); note(state, `石田ヤマトの効果で${who(side)}のメモリー+${matts}。`); }
  }
  for (const stack of player.battle) { stack.suspended = false; stack.used = {}; }
  for (const tamer of player.tamers) tamer.suspended = false;
  if (state.turnNumber !== 1) draw(state, side, 1, true);
}
function endTurn(state) {
  const side = state.turn;
  const expired = mod => mod.expires.side === side && mod.expires.turn <= state.turnCounts[side];
  for (const player of Object.values(state.players)) {
    player.auras = player.auras.filter(mod => !expired(mod));
    for (const stack of player.battle) stack.mods = stack.mods.filter(mod => !expired(mod));
    if (player.breeding) player.breeding.mods = player.breeding.mods.filter(mod => !expired(mod));
  }
  state.turn = other(side);
  state.memory = -state.memory;
  beginTurn(state);
}
function expiry(state, side, next = false) { return {side, turn: state.turnCounts[side] + (next ? 1 : 0)}; }
function newStack(state, card, played = true) {
  return {uid: uid(state, 's'), cards: [card], suspended: false, bornTurn: played ? state.turnNumber : -1, mods: [], used: {}};
}
function findStack(state, side, stackUid, includeBreeding = false) {
  const p = state.players[side];
  return p.battle.find(stack => stack.uid === stackUid) || (includeBreeding && p.breeding?.uid === stackUid ? p.breeding : null);
}
export function cardForStack(state, stack) { return state.catalog[top(stack).id]; }
function hasSourcelessOpponent(state, side) { return state.players[other(side)].battle.some(s => sourceCount(s) === 0); }
function isBreeding(state, side, stack) { return state.players[side].breeding?.uid === stack.uid; }

export function stackDP(state, side, stack, opposingStack = null) {
  if (!stack) return 0;
  const card = cardForStack(state, stack);
  let value = card.dp || 0;
  if (isBreeding(state, side, stack)) return value;
  for (const mod of stack.mods) if (mod.kind === 'dp') value += mod.amount;
  if (state.turn === side) {
    value += state.players[side].tamers.filter(c => c.id === 'ST1-12').length * 1000;
    for (const id of sourceIds(stack)) {
      if (id === 'ST1-03') value += 1000;
      if (id === 'ST1-01' && sourceCount(stack) >= 4) value += 1000;
      if (id === 'ST2-01' && opposingStack && sourceCount(opposingStack) === 0) value += 1000;
    }
  }
  return value;
}
export function securityAttack(state, side, stack) {
  let count = 1;
  if (!stack || isBreeding(state, side, stack)) return count;
  count += sourceIds(stack).filter(id => id === 'ST1-07').length;
  if (state.turn === side) {
    if (top(stack).id === 'ST1-11') count += Math.floor(sourceCount(stack) / 2);
    if (hasSourcelessOpponent(state, side)) count += sourceIds(stack).filter(id => id === 'ST2-08').length;
  }
  count += state.players[side].auras.filter(a => a.kind === 'securityAttack').reduce((sum, a) => sum + a.amount, 0);
  return count;
}
function locked(stack) { return stack.mods.some(mod => mod.kind === 'cannotAttackBlock'); }
function blocker(stack) { return ['ST1-06', 'ST2-07'].includes(top(stack).id); }
function optionColorMet(state, side, card) {
  const p = state.players[side];
  const colors = new Set([...p.battle.map(s => cardForStack(state, s)), ...p.tamers.map(c => state.catalog[c.id]),
    ...(p.breeding ? [cardForStack(state, p.breeding)] : [])].flatMap(c => c.colors));
  return card.colors.every(color => colors.has(color));
}
function evolutionCost(state, card, stack) {
  const previous = cardForStack(state, stack);
  const matches = card.evolution.filter(e => e.level === previous.level && previous.colors.includes(e.color));
  return matches.length ? Math.min(...matches.map(e => e.cost)) : null;
}

export function legalActions(state, side) {
  if (!SIDES.includes(side) || state.winner) return [];
  if (state.phase === 'mulligan') {
    const next = state.players[state.firstPlayer].mulliganDone ? other(state.firstPlayer) : state.firstPlayer;
    return side !== next || state.players[side].mulliganDone ? [] : [{type: 'mulligan', take: false}, {type: 'mulligan', take: true}];
  }
  if (state.pending) return state.pending.player === side ? state.pending.choices.map(choice => ({type: 'choose', choice: choice.id})) : [];
  if (state.attack) {
    if (state.attack.stage !== 'block' || side !== other(state.attack.player)) return [];
    return [{type: 'declineBlock'}, ...state.players[side].battle.filter(s => blocker(s) && !s.suspended && !locked(s)).map(s => ({type: 'block', stack: s.uid}))];
  }
  if (state.turn !== side) return [];
  const player = state.players[side];
  if (state.phase === 'raising') {
    const actions = [{type: 'skipRaising'}];
    if (!player.breeding && player.eggDeck.length) actions.unshift({type: 'hatch'});
    if (player.breeding && cardForStack(state, player.breeding).dp != null) actions.unshift({type: 'raise'});
    return actions;
  }
  if (state.phase !== 'main' || state.memory < 0) return [];
  const actions = [];
  for (const cardInstance of player.hand) {
    const card = state.catalog[cardInstance.id];
    if (card.category !== 'egg' && card.playCost <= state.memory + 10 &&
      (card.category !== 'option' || optionColorMet(state, side, card))) actions.push({type: 'play', card: cardInstance.uid});
    if (card.category === 'digimon') {
      for (const stack of [...player.battle, ...(player.breeding ? [player.breeding] : [])]) {
        const cost = evolutionCost(state, card, stack);
        if (cost !== null && cost <= state.memory + 10) actions.push({type: 'evolve', card: cardInstance.uid, stack: stack.uid});
      }
    }
  }
  if (state.turnNumber !== 1) for (const stack of player.battle) {
    if (stack.suspended || stack.bornTurn === state.turnNumber || locked(stack)) continue;
    actions.push({type: 'attack', stack: stack.uid, target: 'security'});
    for (const enemy of state.players[other(side)].battle) if (enemy.suspended) actions.push({type: 'attack', stack: stack.uid, target: enemy.uid});
  }
  actions.push({type: 'pass'});
  return actions;
}

function actionKey(action) { return JSON.stringify(Object.fromEntries(Object.keys(action).sort().map(k => [k, action[k]]))); }
export function act(previous, side, action) {
  if (!action || !legalActions(previous, side).some(a => actionKey(a) === actionKey(action))) throw new Error('Illegal action for the current player, phase or card.');
  const state = clone(previous), player = state.players[side];
  switch (action.type) {
    case 'mulligan':
      if (action.take) { player.deck.push(...player.hand); player.hand = []; shuffle(state, player.deck); draw(state, side, 5); }
      player.mulliganDone = true;
      note(state, `${who(side)}は${action.take ? '手札を全て戻して引き直しました' : 'この手札で開始します'}。`);
      if (SIDES.every(s => state.players[s].mulliganDone)) setupSecurity(state);
      break;
    case 'hatch':
      player.breeding = newStack(state, player.eggDeck.shift(), false);
      note(state, `${who(side)}が${top(player.breeding).id}を孵化。`);
      state.phase = 'main'; break;
    case 'raise':
      player.battle.push(player.breeding); player.breeding = null;
      note(state, `${who(side)}が育成エリアからバトルエリアに移動。`);
      state.phase = 'main'; break;
    case 'skipRaising': state.phase = 'main'; break;
    case 'play': {
      const instance = player.hand.splice(player.hand.findIndex(c => c.uid === action.card), 1)[0];
      const card = state.catalog[instance.id];
      gainMemory(state, side, -card.playCost);
      note(state, `${who(side)}が${card.id}を${card.playCost}コストで${card.category === 'option' ? '使用' : '登場'}。`);
      if (card.category === 'digimon') player.battle.push(newStack(state, instance));
      else if (card.category === 'tamer') player.tamers.push({...instance, suspended: false});
      else { state.queue.push({type: 'effect', player: side, effect: card.id, security: false}, {type: 'trashOption', player: side, card: instance}); }
      break;
    }
    case 'evolve': {
      const instance = player.hand.splice(player.hand.findIndex(c => c.uid === action.card), 1)[0];
      const stack = findStack(state, side, action.stack, true), card = state.catalog[instance.id];
      const cost = evolutionCost(state, card, stack);
      gainMemory(state, side, -cost);
      stack.cards.push(instance);
      draw(state, side, 1); // Evolution bonus never causes deck-out.
      note(state, `${who(side)}が${card.id}に${cost}コストで進化。`);
      if (!isBreeding(state, side, stack) && ['ST1-08', 'ST2-09'].includes(card.id)) state.queue.push({type: 'effect', player: side, effect: card.id});
      break;
    }
    case 'attack': declareAttack(state, side, action); break;
    case 'block': {
      const block = findStack(state, side, action.stack);
      block.suspended = true;
      state.attack.target = block.uid;
      state.attack.stage = 'resolve';
      const attacker = findStack(state, state.attack.player, state.attack.attacker);
      const gains = sourceIds(attacker).filter(id => id === 'ST1-09').length * 3;
      if (gains) gainMemory(state, state.attack.player, gains);
      note(state, `${who(side)}が${top(block).id}でブロック。${gains ? ` メタルグレイモンの効果でアタック側のメモリー+${gains}。` : ''}`);
      state.queue.push({type: 'resolveAttack'}); break;
    }
    case 'declineBlock': state.attack.stage = 'resolve'; state.queue.push({type: 'resolveAttack'}); break;
    case 'choose': resolveChoice(state, action.choice); break;
    case 'pass': state.memory = -3; note(state, `${who(side)}がパス。相手のメモリーを3にします。`); break;
  }
  advance(state);
  return state;
}

function declareAttack(state, side, action) {
  const stack = findStack(state, side, action.stack);
  stack.suspended = true;
  state.attack = {player: side, attacker: stack.uid, target: action.target, stage: 'effects', checksDone: 0};
  const targetName = action.target === 'security' ? '相手プレイヤー' : top(findStack(state, other(side), action.target)).id;
  note(state, `${who(side)}が${top(stack).id}で${targetName}にアタック。`);
  const effects = [];
  if (blocker(stack)) effects.push({effect: 'attackMemory', amount: -2});
  if (top(stack).id === 'ST2-11' && !stack.used.metalGarurumon) effects.push({effect: 'unsuspend', stack: stack.uid});
  for (const [index, id] of sourceIds(stack).entries()) {
    if (id === 'ST2-03') effects.push({effect: 'strip', amount: 1, maxLevel: 5, source: index});
    if (id === 'ST2-06') effects.push({effect: 'strip', amount: 1, source: index});
  }
  if (effects.length) state.queue.push({type: 'effects', player: side, effects});
  state.queue.push({type: 'blockWindow'});
}

function ask(state, event, choices, prompt) {
  if (!choices.length) return;
  state.pending = {player: event.player, prompt, effect: event.effect, event, choices};
}
function stackChoice(stack, extra = {}) { return {id: stack.uid, label: top(stack).id, stack: stack.uid, ...extra}; }
function effect(state, event) {
  const side = event.player, player = state.players[side], enemy = state.players[other(side)];
  switch (event.effect) {
    case 'ST1-08': case 'ST1-13':
      if (event.security) player.auras.push({kind: 'securityAttack', amount: 1, expires: expiry(state, side, true)});
      else ask(state, {...event, effect: 'boost'}, player.battle.map(s => stackChoice(s)), 'このターンDP+3000する、自分のデジモン1体を選んでください。');
      break;
    case 'ST1-14':
      player.auras.push({kind: 'securityDP', amount: 7000, expires: event.security ? expiry(state, state.turn) : expiry(state, other(side), true)});
      break;
    case 'ST1-15': {
      const eligible = enemy.battle.filter(s => stackDP(state, other(side), s) <= 4000);
      // Current general rule 1-3-6 requires at least one card when selection is possible.
      const choices = [];
      for (let i = 0; i < eligible.length; i++) {
        choices.push({id: eligible[i].uid, label: top(eligible[i]).id, targets: [eligible[i].uid]});
        for (let j = i + 1; j < eligible.length; j++) choices.push({id: `${eligible[i].uid}+${eligible[j].uid}`, label: `${top(eligible[i]).id} + ${top(eligible[j]).id}`, targets: [eligible[i].uid, eligible[j].uid]});
      }
      if (eligible.length) ask(state, event, choices, '消滅させるDP4000以下の相手デジモンを1～2体選んでください。');
      break;
    }
    case 'ST1-16': ask(state, event, enemy.battle.map(s => stackChoice(s)), '消滅させる相手のデジモン1体を選んでください。'); break;
    case 'ST2-09': effect(state, {...event, effect: 'strip', amount: 2}); break;
    case 'strip': ask(state, event, enemy.battle.filter(s => !event.maxLevel || cardForStack(state, s).level <= event.maxLevel).map(s => stackChoice(s)), `進化元を下から${event.amount}枚破棄する、相手の${event.maxLevel ? 'Lv.5以下の' : ''}デジモン1体を選んでください。`); break;
    case 'attackMemory': gainMemory(state, side, event.amount); break;
    case 'unsuspend': {
      const stack = findStack(state, side, event.stack);
      if (stack) { stack.suspended = false; stack.used.metalGarurumon = true; }
      break;
    }
    case 'ST2-13': gainMemory(state, side, event.security ? 2 : 1); break;
    case 'ST2-14': ask(state, event, enemy.battle.filter(s => !sourceCount(s)).map(s => stackChoice(s)), 'アタック・ブロックを禁止する、進化元のない相手デジモン1体を選んでください。'); break;
    case 'ST2-15': {
      const choices = player.battle.flatMap(stack => stack.cards.slice(0, -1).filter(c => state.catalog[c.id].category === 'digimon').map(c => ({id: c.uid, label: `${top(stack).id}の進化元：${c.id}`, stack: stack.uid, card: c.uid})));
      ask(state, event, choices, '自分の進化元から、無料で登場させるデジモンカード1枚を選んでください。');
      break;
    }
    case 'ST2-16': ask(state, event, enemy.battle.map(s => stackChoice(s)), '手札に戻す相手デジモン1体を選んでください。進化元は破棄します。'); break;
    default: throw new Error(`Unsupported effect handler: ${event.effect}`);
  }
}
function resolveChoice(state, choiceId) {
  const pending = state.pending, choice = pending.choices.find(c => c.id === choiceId), event = pending.event;
  state.pending = null;
  const side = pending.player;
  if (pending.effect === 'order') {
    const selected = event.effects[choice.index];
    const remaining = event.effects.filter((_, i) => i !== choice.index);
    if (remaining.length) state.queue.unshift({type: 'effects', player: side, effects: remaining});
    state.queue.unshift({type: 'effect', player: side, ...selected});
    return;
  }
  switch (pending.effect) {
    case 'boost': findStack(state, side, choice.stack).mods.push({kind: 'dp', amount: 3000, expires: expiry(state, state.turn)}); break;
    case 'ST1-15': for (const target of choice.targets) removeStack(state, other(side), target); break;
    case 'ST1-16': removeStack(state, other(side), choice.stack); break;
    case 'strip': {
      const stack = findStack(state, other(side), choice.stack);
      state.players[other(side)].trash.push(...stack.cards.splice(0, Math.min(event.amount, sourceCount(stack))));
      note(state, `${who(side)}が${top(stack).id}の進化元を下から破棄。`);
      break;
    }
    case 'ST2-14': findStack(state, other(side), choice.stack).mods.push({kind: 'cannotAttackBlock', expires: event.security ? expiry(state, side, true) : expiry(state, other(side), true)}); break;
    case 'ST2-15': {
      const source = findStack(state, side, choice.stack);
      const card = source.cards.splice(source.cards.findIndex(c => c.uid === choice.card), 1)[0];
      state.players[side].battle.push(newStack(state, card));
      note(state, `${who(side)}が進化元の${card.id}を無料で登場。`);
      break;
    }
    case 'ST2-16': removeStack(state, other(side), choice.stack, true); break;
    default: throw new Error(`Unsupported choice: ${pending.effect}`);
  }
}
function removeStack(state, side, stackUid, returnToHand = false) {
  const player = state.players[side], index = player.battle.findIndex(s => s.uid === stackUid);
  if (index < 0) return;
  const stack = player.battle.splice(index, 1)[0];
  if (returnToHand) player.hand.push(stack.cards.pop());
  player.trash.push(...stack.cards);
  note(state, `${who(side)}のデジモンを${returnToHand ? '手札に戻し' : '消滅させ'}、進化元をトラッシュに置きます。`);
}

function resolveAttack(state) {
  const attack = state.attack;
  if (!attack) return;
  const attacker = findStack(state, attack.player, attack.attacker);
  if (!attacker) { state.attack = null; return; }
  if (attack.target === 'security') { state.queue.unshift({type: 'securityCheck'}); return; }
  const defender = findStack(state, other(attack.player), attack.target);
  if (defender) {
    const attackerDP = stackDP(state, attack.player, attacker, defender);
    const defenderDP = stackDP(state, other(attack.player), defender, attacker);
    note(state, `デジモンバトル：${attackerDP} DP 対 ${defenderDP} DP。`);
    if (attackerDP <= defenderDP) removeStack(state, attack.player, attacker.uid);
    if (defenderDP <= attackerDP) removeStack(state, other(attack.player), defender.uid);
  }
  state.attack = null;
}
function securityCheck(state) {
  const attack = state.attack;
  if (!attack) return;
  const attacker = findStack(state, attack.player, attack.attacker), defender = other(attack.player);
  if (!attacker || attack.checksDone >= securityAttack(state, attack.player, attacker)) { state.attack = null; return; }
  const player = state.players[defender];
  if (!player.security.length) {
    if (attack.checksDone === 0) finishGame(state, attack.player, `${who(attack.player)}がセキュリティ0枚の相手へのアタックを成功させて勝利。`);
    else state.attack = null;
    return;
  }
  const instance = player.security.shift(), card = state.catalog[instance.id];
  attack.checksDone++;
  state.revealedSecurity = {player: defender, card: instance};
  note(state, `${who(defender)}のセキュリティから${instance.id}をチェック。`, {card: instance.id, side: defender, kind: 'security'});
  state.queue.unshift({type: 'securityFinish', player: defender, card: instance});
  if (card.category === 'tamer') {
    player.tamers.push({...instance, suspended: false});
    state.revealedSecurity.played = true;
    note(state, `${who(defender)}がセキュリティの${instance.id}を無料で登場。`);
  } else if (card.category === 'option') state.queue.unshift({type: 'effect', player: defender, effect: instance.id, security: true});
}
function securityFinish(state, event) {
  const attack = state.attack, instance = event.card, card = state.catalog[instance.id];
  const attacker = attack && findStack(state, attack.player, attack.attacker);
  if (attacker && card.category === 'digimon') {
    const securityDP = card.dp + state.players[event.player].auras.filter(a => a.kind === 'securityDP').reduce((sum, a) => sum + a.amount, 0);
    const attackerDP = stackDP(state, attack.player, attacker);
    note(state, `セキュリティバトル：${attackerDP} DP 対 ${securityDP} DP。`);
    if (attackerDP <= securityDP) removeStack(state, attack.player, attacker.uid);
  }
  if (!state.revealedSecurity?.played) state.players[event.player].trash.push(instance);
  state.revealedSecurity = null;
  if (state.attack) state.queue.unshift({type: 'securityCheck'});
}
function advance(state) {
  let guard = 0;
  while (!state.winner && !state.pending && state.queue.length) {
    if (++guard > 500) throw new Error('Effect resolution exceeded its safety limit.');
    const event = state.queue.shift();
    switch (event.type) {
      case 'effect': effect(state, event); break;
      case 'effects':
        if (event.effects.length === 1) state.queue.unshift({type: 'effect', player: event.player, ...event.effects[0]});
        else if (event.effects.length > 1) ask(state, {...event, effect: 'order'}, event.effects.map((e, index) => ({id: String(index), index, label: e.effect === 'strip' ? `進化元を下から${e.amount}枚破棄${e.maxLevel ? '（Lv.5以下）' : ''}` : e.effect === 'unsuspend' ? 'メタルガルルモンをアクティブに' : 'メモリーを-2する'})), '同時に誘発した【アタック時】効果を、解決する順に選んでください。');
        break;
      case 'blockWindow':
        if (state.attack && findStack(state, state.attack.player, state.attack.attacker)) state.attack.stage = 'block';
        else state.attack = null;
        break;
      case 'resolveAttack': resolveAttack(state); break;
      case 'securityCheck': securityCheck(state); break;
      case 'securityFinish': securityFinish(state, event); break;
      case 'trashOption': state.players[event.player].trash.push(event.card); break;
      default: throw new Error(`Unknown queue event: ${event.type}`);
    }
  }
  if (!state.winner && !state.pending && !state.attack && !state.queue.length && state.phase === 'main' && state.memory < 0) endTurn(state);
}

/** Send this snapshot to a remote player, never the authoritative game state. */
export function viewFor(state, side) {
  if (!SIDES.includes(side)) throw new Error('Unknown player.');
  const view = clone(state);
  delete view.rng;
  delete view.nextUid;
  for (const playerSide of SIDES) {
    const player = view.players[playerSide];
    player.deck = Array(player.deck.length).fill(null);
    player.eggDeck = Array(player.eggDeck.length).fill(null);
    player.security = Array(player.security.length).fill(null);
    if (playerSide !== side) player.hand = Array(player.hand.length).fill(null);
  }
  view.legalActions = legalActions(state, side);
  view.viewer = side;
  return view;
}

/** Modest deterministic opponent: decisions use public zones and its own hand only. */
export function chooseAI(state, side) {
  const actions = legalActions(state, side);
  if (!actions.length) return null;
  if (state.phase === 'mulligan') {
    const low = state.players[side].hand.some(c => state.catalog[c.id].level === 3);
    return actions.find(a => a.take === !low);
  }
  if (state.pending) {
    const choices = state.pending.choices;
    const ranked = choices.map((c, index) => {
      let score = 0;
      if (c.targets) score = c.targets.reduce((sum, id) => sum + stackDP(state, other(side), findStack(state, other(side), id)), 0);
      else if (c.stack) {
        const stack = findStack(state, state.pending.effect === 'boost' || state.pending.effect === 'ST2-15' ? side : other(side), c.stack);
        score = stack ? stackDP(state, state.pending.effect === 'boost' || state.pending.effect === 'ST2-15' ? side : other(side), stack) : 0;
        if (state.pending.effect === 'strip') score += sourceCount(stack) * 1500;
        if (c.card) score = state.catalog[stack.cards.find(card => card.uid === c.card).id].playCost * 1000;
      }
      return {index, score};
    }).sort((a, b) => b.score - a.score);
    return actions[ranked[0].index];
  }
  if (state.attack?.stage === 'block') {
    const attack = state.attack, attacker = findStack(state, attack.player, attack.attacker);
    const blocks = actions.filter(a => a.type === 'block');
    return blocks.find(a => stackDP(state, side, findStack(state, side, a.stack), attacker) >= stackDP(state, attack.player, attacker, findStack(state, side, a.stack))) ||
      ((!state.players[side].security.length || attack.target !== 'security') && blocks[0]) || actions[0];
  }
  const raise = actions.find(a => a.type === 'raise');
  if (raise) return raise;
  const hatch = actions.find(a => a.type === 'hatch');
  if (hatch) return hatch;
  const enemy = state.players[other(side)];
  const attacks = actions.filter(a => a.type === 'attack');
  if (!enemy.security.length && attacks.length) return attacks.find(a => a.target === 'security');
  const evolve = actions.filter(a => a.type === 'evolve').sort((a, b) => {
    const card = action => state.catalog[state.players[side].hand.find(c => c.uid === action.card).id];
    return evolutionCost(state, card(a), findStack(state, side, a.stack, true)) - evolutionCost(state, card(b), findStack(state, side, b.stack, true));
  });
  if (evolve.length) return evolve[0];
  for (const attack of attacks) if (attack.target !== 'security') {
    const attacker = findStack(state, side, attack.stack), target = findStack(state, other(side), attack.target);
    if (stackDP(state, side, attacker, target) >= stackDP(state, other(side), target, attacker)) return attack;
  }
  if (attacks.length) return attacks.find(a => a.target === 'security');
  const plays = actions.filter(a => a.type === 'play').map(action => ({action, card: state.catalog[state.players[side].hand.find(c => c.uid === action.card).id]}));
  const usefulPlays = plays.filter(({card}) => card.category !== 'option' ||
    (card.id === 'ST2-13') ||
    (['ST1-16', 'ST2-16', 'ST2-14'].includes(card.id) && enemy.battle.length) ||
    (card.id === 'ST1-15' && enemy.battle.some(s => stackDP(state, other(side), s) <= 4000)) ||
    (card.id === 'ST2-15' && state.players[side].battle.some(s => s.cards.slice(0, -1).some(c => state.catalog[c.id].category === 'digimon'))));
  usefulPlays.sort((a, b) => a.card.playCost - b.card.playCost);
  return usefulPlays[0]?.action || actions.find(a => a.type === 'skipRaising') || actions.find(a => a.type === 'pass') || actions[0];
}
