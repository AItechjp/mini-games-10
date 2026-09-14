export const rank = card => card % 13 + 1;
export function shuffle(cards, random = Math.random) {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function newMemory(random = Math.random) {
  return {version:1,game:'memory',cards:shuffle([...Array(12)].flatMap((_,i) => [i,i+13]),random),
    matched:Array(24).fill(false),open:[],seen:{},turn:0,scores:[0,0],moves:0,over:false,winner:null};
}
export function flipMemory(s, index, player) {
  if (s.over || player !== s.turn || !Number.isInteger(index) || index < 0 || index >= 24 || s.matched[index] || s.open.includes(index) || s.open.length === 2) return false;
  s.open.push(index); s.seen[index] = rank(s.cards[index]); s.moves++;
  if (s.open.length === 2 && rank(s.cards[s.open[0]]) === rank(s.cards[s.open[1]])) {
    s.open.forEach(i => { s.matched[i] = true; }); s.open = []; s.scores[player]++;
    s.over = s.matched.every(Boolean);
    if (s.over) s.winner = s.scores[0] === s.scores[1] ? -1 : Number(s.scores[1] > s.scores[0]);
  }
  return true;
}
export function resolveMemory(s) {
  if (s.over || s.open.length !== 2) return false;
  s.open = []; s.turn = 1 - s.turn; return true;
}
export function memoryChoice(s, random = Math.random) {
  const available = s.matched.map((matched,i) => !matched && !s.open.includes(i) ? i : -1).filter(i => i >= 0);
  if (!available.length || s.over || s.open.length === 2) return -1;
  // The CPU only knows cards both players have previously turned face up.
  if (s.open.length) {
    const match = available.find(i => s.seen[i] === s.seen[s.open[0]]);
    if (match !== undefined) return match;
  } else {
    const pair = available.find(i => s.seen[i] !== undefined && available.some(j => i !== j && s.seen[i] === s.seen[j]));
    if (pair !== undefined) return pair;
  }
  const unknown = available.filter(i => s.seen[i] === undefined);
  const choices = unknown.length ? unknown : available;
  return choices[Math.floor(random() * choices.length)];
}
export function newSpeed(random = Math.random) {
  const deck = shuffle(Array.from({length:52},(_,i) => i),random);
  return {version:1,game:'speed',hands:[deck.slice(0,4),deck.slice(26,30)],stocks:[deck.slice(4,25),deck.slice(30,51)],
    piles:[[deck[25]],[deck[51]]],moves:0,over:false,winner:null};
}
export const adjacent = (card, top) => [1,12].includes(Math.abs(rank(card) - rank(top)));
export function speedMoves(s, player) {
  if (s.over) return [];
  return s.hands[player].flatMap((card,index) => s.piles.flatMap((pile,p) => adjacent(card,pile.at(-1)) ? [{index,pile:p}] : []));
}
export function playSpeed(s, player, index, pile) {
  if (s.over || ![0,1].includes(player) || !Number.isInteger(index) || index < 0 || index >= s.hands[player].length || ![0,1].includes(pile)) return false;
  const card = s.hands[player][index];
  if (!adjacent(card,s.piles[pile].at(-1))) return false;
  s.hands[player].splice(index,1); s.piles[pile].push(card); s.moves++;
  if (s.stocks[player].length) s.hands[player].push(s.stocks[player].shift());
  if (!s.hands[player].length && !s.stocks[player].length) { s.over = true; s.winner = player; }
  return true;
}
export function dealSpeed(s, random = Math.random) {
  if (s.over || speedMoves(s,0).length || speedMoves(s,1).length) return false;
  if (!s.stocks[0].length && !s.stocks[1].length) {
    const reserve = shuffle(s.piles.flatMap(p => p.slice(0,-1)),random);
    if (!reserve.length) return false;
    s.piles = s.piles.map(p => [p.at(-1)]);
    reserve.forEach((card,i) => s.stocks[i%2].push(card));
  }
  for (let i=0; i<2; i++) if (s.stocks[i].length) s.piles[i].push(s.stocks[i].shift());
  return true;
}
export function validState(s, game) {
  if (!s || s.version !== 1 || s.game !== game || typeof s.over !== 'boolean' || !Number.isInteger(s.moves) || s.moves < 0) return false;
  if (game === 'memory') {
    if (!Array.isArray(s.cards) || s.cards.length !== 24 || new Set(s.cards).size !== 24 || s.cards.some(c => !Number.isInteger(c) || ![...Array(12)].some((_,i) => c===i || c===i+13))) return false;
    if (!Array.isArray(s.matched) || s.matched.length !== 24 || s.matched.some(v => typeof v !== 'boolean') || ![0,1].includes(s.turn)) return false;
    if (!Array.isArray(s.open) || s.open.length > 2 || new Set(s.open).size !== s.open.length || s.open.some(i => !Number.isInteger(i) || i<0 || i>=24 || s.matched[i])) return false;
    if (!s.seen || typeof s.seen !== 'object' || Array.isArray(s.seen) || Object.entries(s.seen).some(([i,r]) => !/^\d+$/.test(i) || Number(i)>=24 || rank(s.cards[Number(i)])!==r)) return false;
    if (!Array.isArray(s.scores) || s.scores.length!==2 || s.scores.some(n => !Number.isInteger(n) || n<0) || s.scores[0]+s.scores[1]!==s.matched.filter(Boolean).length/2) return false;
    return s.over === s.matched.every(Boolean);
  }
  if (game !== 'speed' || ![s.hands,s.stocks,s.piles].every(a => Array.isArray(a) && a.length === 2 && a.every(Array.isArray))) return false;
  const cards = [...s.hands.flat(),...s.stocks.flat(),...s.piles.flat()];
  if (cards.length!==52 || new Set(cards).size!==52 || cards.some(c => !Number.isInteger(c) || c<0 || c>51) || s.hands.some(h => h.length>4) || s.piles.some(p => !p.length)) return false;
  return !s.over || [0,1].includes(s.winner) && !s.hands[s.winner].length && !s.stocks[s.winner].length;
}
