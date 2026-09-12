import { NAMES, newGame, draw, sourcePlayer, shuffle } from './babanuki-engine.js';
const $ = id => document.getElementById(id);
let state = newGame(), timer, paused = false, logs = ['カードを配り、最初のペアを取り除きました。'];
let announcement = '同じ数字のペアは自動で取り除きます。';
const label = card => card.rank === 0 ? 'ジョーカー' : `${card.suit}${({1:'A',11:'J',12:'Q',13:'K'})[card.rank] || card.rank}`;
const blocked = () => paused || document.hidden || $('rules').open || $('restart-dialog').open;
function face(card) {
  const el=document.createElement('div');
  el.className=`card ${['♥','♦'].includes(card.suit)?'red':''} ${card.rank===0?'joker':''}`;
  el.setAttribute('role','img');el.setAttribute('aria-label',label(card));
  const rank=document.createElement('span'), suit=document.createElement('span');
  rank.className='rank';rank.textContent=card.rank===0?'JOKER':({1:'A',11:'J',12:'Q',13:'K'})[card.rank]||card.rank;
  suit.className='suit';suit.textContent=card.suit;
  el.append(rank,suit);return el;
}
function render() {
  $('pair-count').textContent=`${state.discarded.length/2} / 26`;
  $('move-count').textContent=state.moves;
  $('own-count').textContent=`${state.hands[0].length}枚`;
  $('pause').textContent=paused?'再開する':'一時停止';
  $('pause').disabled=state.over;
  $('shuffle').disabled=state.over || !state.hands[0].length || blocked();
  $('announcement').textContent=announcement;
  $('opponents').replaceChildren(...[1,2,3].map(p=>{
    const el=document.createElement('div');
    el.className=`opponent ${state.turn===p&&!state.over?'active':''} ${state.ranking.includes(p)?'done':''}`;
    const title=document.createElement('div'), avatar=document.createElement('span'), name=document.createElement('span'), count=document.createElement('div');
    avatar.className='avatar';avatar.textContent=NAMES[p][0];avatar.setAttribute('aria-hidden','true');name.textContent=NAMES[p];title.append(avatar,name);
    count.className='count';count.textContent=state.ranking.includes(p)?`${state.ranking.indexOf(p)+1}位 · あがり`:state.over?'ジョーカー · 負け':`${state.hands[p].length}枚${state.turn===p?' · 引く番':''}`;
    el.append(title,count);return el;
  }));
  const own=$('own-cards');own.replaceChildren(...state.hands[0].map(face));
  if(!state.hands[0].length){const text=document.createElement('p');text.className='empty-hand';text.textContent=`${state.ranking.indexOf(0)+1}位であがり！${state.over?'':'残りの対局を観戦中です。'}`;own.append(text);}
  const target=$('draw-cards');target.replaceChildren();
  if(state.over){
    $('turn-label').textContent='ROUND COMPLETE';
    $('instruction').textContent=state.loser===0?'ジョーカーが残ってしまいました！':`${state.ranking.indexOf(0)+1}位であがりました！`;
    $('draw-label').textContent='対局結果';
    const list=document.createElement('ol');list.className='ranking';
    [...state.ranking,state.loser].forEach((p,i)=>{const li=document.createElement('li');li.className=i===0?'winner':'';li.textContent=`${i+1}位 ${NAMES[p]}${i===3?' ★':''}`;list.append(li);});target.append(list);
    return;
  }
  const from=sourcePlayer(state);
  $('turn-label').textContent=paused?'PAUSED':state.turn===0?'YOUR TURN':'CPU TURN';
  $('instruction').textContent=paused?'一時停止中':state.turn===0?`${NAMES[from]}のカードを1枚引こう`:`${NAMES[state.turn]}がカードを選んでいます`;
  $('draw-label').textContent=state.turn===0?`${NAMES[from]}の手札 · 裏向きのカードを選択`:`${NAMES[state.turn]} → ${NAMES[from]}から引きます`;
  state.hands[from].forEach((_,index)=>{
    const card=document.createElement('button');card.className='card back-card';card.type='button';card.textContent='♠';
    card.setAttribute('aria-label',`${NAMES[from]}の左から${index+1}枚目を引く`);card.disabled=state.turn!==0||blocked();
    card.addEventListener('click',()=>take(index));target.append(card);
  });
}
function renderLog() {
  $('log').replaceChildren(...logs.slice(0,5).map(text=>{const li=document.createElement('li');li.textContent=text;return li;}));
}
function schedule() {
  clearTimeout(timer);
  if(state.over||blocked()||state.turn===0)return;
  timer=setTimeout(()=>take(Math.floor(Math.random()*state.hands[sourcePlayer(state)].length)),Number($('speed').value));
}
function take(index) {
  if(blocked()||state.over)return;
  const keyboardFocus=$('draw-cards').contains(document.activeElement);
  clearTimeout(timer);
  const last=draw(state,index);
  announcement=`${NAMES[last.player]}が${NAMES[last.from]}から1枚引きました。${last.paired?'ペア成立！':''}`;
  if(last.player===0)announcement=`${label(last.card)}を引きました。${last.paired?'ペアがそろいました！':'手札に加わりました。'}`;
  if(state.over)announcement=`${NAMES[state.loser]}にジョーカーが残りました。新しい対局でもう一度遊べます。`;
  logs.unshift(`${NAMES[last.player]} ← ${NAMES[last.from]}${last.paired?' · ペア成立':' · 1枚引く'}`);
  logs=logs.slice(0,5);render();renderLog();schedule();
  if(keyboardFocus){$('draw-zone').focus({preventScroll:true});}
}
function reset() {
  clearTimeout(timer);state=newGame();paused=false;logs=['カードを配り、最初のペアを取り除きました。'];
  announcement='同じ数字のペアは自動で取り除きます。';render();renderLog();schedule();
}
$('shuffle').addEventListener('click',()=>{state.hands[0]=shuffle(state.hands[0]);announcement='あなたの手札をシャッフルしました。';render();});
$('pause').addEventListener('click',()=>{paused=!paused;render();schedule();});
$('speed').addEventListener('change',schedule);
$('rules-button').addEventListener('click',()=>{$('rules').showModal();clearTimeout(timer);});
$('close-rules').addEventListener('click',()=>$('rules').close());
$('rules').addEventListener('close',()=>{render();schedule();});
$('restart').addEventListener('click',()=>{if(state.over)reset();else{$('restart-dialog').showModal();clearTimeout(timer);}});
$('cancel-restart').addEventListener('click',()=>$('restart-dialog').close());
$('confirm-restart').addEventListener('click',()=>{$('restart-dialog').close();reset();});
$('restart-dialog').addEventListener('close',()=>{render();schedule();});
document.addEventListener('visibilitychange',()=>{render();schedule();});
render();renderLog();schedule();
