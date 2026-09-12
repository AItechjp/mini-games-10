export const NAMES = ['あなた', 'ソラ', 'リン', 'カイ'];
export function shuffle(cards, random = Math.random) {
  const result = [...cards];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
export function deck() {
  return ['♠','♥','♦','♣'].flatMap((suit,s) => Array.from({length:13}, (_,i) => ({id:s*13+i,rank:i+1,suit})))
    .concat({id:52,rank:0,suit:'★'});
}
export function removePairs(hand) {
  const kept = [], removed = [];
  for (const card of hand) {
    const index = card.rank === 0 ? -1 : kept.findIndex(c => c.rank === card.rank);
    if (index < 0) kept.push(card);
    else removed.push(kept.splice(index,1)[0],card);
  }
  return {hand:kept, removed};
}
export function activePlayers(state) {return state.hands.map((h,i) => h.length ? i : -1).filter(i => i >= 0);}
export function nextPlayer(state, player) {
  for (let step=1;step<4;step++) {const p=(player+step)%4;if(state.hands[p].length)return p;}
  return -1;
}
export function sourcePlayer(state) {return state.over ? -1 : nextPlayer(state,state.turn);}
function finish(state) {
  for (let p=0;p<4;p++) if(!state.hands[p].length && !state.ranking.includes(p)) state.ranking.push(p);
  const active = activePlayers(state);
  if(active.length === 1) {state.over=true;state.loser=active[0];}
}
export function newGame(random = Math.random) {
  const hands = [[],[],[],[]], discarded=[];
  shuffle(deck(),random).forEach((c,i)=>hands[i%4].push(c));
  for (let p=0;p<4;p++) {const result=removePairs(hands[p]);hands[p]=result.hand;discarded.push(...result.removed);}
  const state = {hands,discarded,turn:0,ranking:[],over:false,loser:null,moves:0,last:null};
  finish(state);
  if(!hands[0].length && !state.over)state.turn=nextPlayer(state,0);
  return state;
}
export function draw(state, index, random = Math.random) {
  if(state.over)throw new Error('対局は終了しています');
  const from=sourcePlayer(state), player=state.turn;
  if(!Number.isInteger(index)||index<0||index>=state.hands[from].length)throw new Error('カードを選んでください');
  const card=state.hands[from].splice(index,1)[0];
  const result=removePairs([...state.hands[player],card]);
  state.hands[player]=player===0 ? result.hand : shuffle(result.hand,random);
  state.discarded.push(...result.removed);
  state.moves++;
  state.last={player,from,card,paired:result.removed.length>0};
  // If both players finish on one draw, the donor empties their hand first.
  for (const p of [from,player]) if(!state.hands[p].length&&!state.ranking.includes(p))state.ranking.push(p);
  finish(state);
  if(!state.over)state.turn=nextPlayer(state,player);
  return state.last;
}
