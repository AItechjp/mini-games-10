import {rank,newMemory,flipMemory,resolveMemory,memoryChoice,newSpeed,speedMoves,playSpeed,dealSpeed,validState} from './rules.mjs';
const $ = id => document.getElementById(id);
const game = new URLSearchParams(location.search).get('game') === 'speed' ? 'speed' : 'memory';
const isMemory = game === 'memory', title = isMemory ? '神経衰弱' : 'スピード';
const key = `aitech.trump.${game}.v1`;
let state, paused = false, timer, selected = -1, conflict = false;
try { const saved=JSON.parse(localStorage.getItem(key) || 'null'); if(validState(saved,game)){state=saved;paused=!saved.over;} }
catch { $('save-status').textContent='保存した対局を読み込めませんでした。新しい対局で遊べます。'; }
state ||= isMemory ? newMemory() : newSpeed();
const blocked = () => paused || document.hidden || $('rules').open || $('confirm').open || $('aitech-assist-dialog')?.open;
function save() {
  if(conflict)return;
  try { localStorage.setItem(key,JSON.stringify(state)); $('save-status').textContent='この端末に対局を保存しました。'; }
  catch { $('save-status').textContent='この端末に保存できません。この画面では続けて遊べます。'; }
}
function card(number, {back=false,index,disabled=false,pressed=false} = {}) {
  const button=document.createElement('button'); button.type='button'; button.className='card';
  if(back){button.classList.add('back-card');button.textContent='♠';button.setAttribute('aria-label',`${index+1}枚目の裏向きのカード`);}
  else {
    const suit=['♠','♥','♣','♦'][Math.floor(number/13)],value=rank(number);
    const name=({1:'A',11:'J',12:'Q',13:'K'})[value]||value;
    button.classList.toggle('red',suit==='♥'||suit==='♦');
    const rankLabel=document.createElement('span'),symbol=document.createElement('span');
    rankLabel.textContent=name; symbol.textContent=suit; symbol.setAttribute('aria-hidden','true');
    button.append(rankLabel,symbol);button.setAttribute('aria-label',suit+' '+name);
  }
  button.disabled=disabled; if(index!==undefined)button.dataset.index=index;
  if(pressed)button.setAttribute('aria-pressed','true');
  return button;
}
function mutate(fn) {
  if(blocked()||state.over)return;
  if(!fn())return;
  selected=-1; save(); render(); schedule();
}
function render() {
  $('pause').textContent=paused?'再開する':'一時停止'; $('pause').disabled=state.over;
  $('turn-label').textContent=state.over?'ROUND COMPLETE':blocked()?'PAUSED':isMemory?(state.turn===0?'YOUR TURN':'CPU TURN'):'SPEED';
  if(state.over)$('instruction').textContent=state.winner===-1?'引き分け！':state.winner===0?'あなたの勝ち！':'CPUの勝ち。もう一度、挑戦！';
  else if(blocked())$('instruction').textContent='一時停止中 —「再開する」で続けよう';
  else if(isMemory)$('instruction').textContent=state.open.length===2?'数字を覚えよう':state.turn===0?'同じ数字のカードを2枚見つけよう':'CPUがカードを選んでいます';
  else $('instruction').textContent=selected>=0?'出したい場札を選ぼう':!speedMoves(state,0).length&&!speedMoves(state,1).length?'お互い出せません。場札を入れ替えよう':'場札の前後の数字を出そう';
  $('moves').textContent=state.moves+(isMemory?' 回めくりました':' 枚出しました');
  $('score-you').textContent=isMemory?state.scores[0]:state.hands[0].length+state.stocks[0].length;
  $('score-cpu').textContent=isMemory?state.scores[1]:state.hands[1].length+state.stocks[1].length;
  if(isMemory){
    const focused=document.activeElement?.dataset.index;
    $('memory-board').replaceChildren(...state.cards.map((number,index)=>{
      const matched=state.matched[index],open=state.open.includes(index);
      const button=card(number,{index,back:!matched&&!open,disabled:blocked()||state.over||state.turn!==0||matched||open||state.open.length===2});
      button.classList.toggle('matched',matched);
      if(matched)button.setAttribute('aria-label',button.getAttribute('aria-label')+' 獲得済み');
      button.addEventListener('click',()=>mutate(()=>flipMemory(state,index,0)));
      return button;
    }));
    if(focused!==undefined){const next=$('memory-board').querySelector(`[data-index="${focused}"]:not(:disabled)`)||$('memory-board').querySelector('button:not(:disabled)');if(next)next.focus({preventScroll:true});else $('table').focus({preventScroll:true});}
  } else {
    const focusZone=document.activeElement?.parentElement?.id, focusIndex=document.activeElement?.dataset.index;
    $('cpu-hand').replaceChildren(...state.hands[1].map((_,index)=>card(0,{index,back:true,disabled:true})));
    $('piles').replaceChildren(...state.piles.map((pile,p)=>{
      const allowed=selected>=0&&speedMoves(state,0).some(m=>m.index===selected&&m.pile===p);
      const button=card(pile.at(-1),{index:p,disabled:blocked()||state.over||!allowed});
      button.setAttribute('aria-label',`${p===0?'左':'右'}の場札 ${button.getAttribute('aria-label')}`);
      button.classList.toggle('playable',allowed);
      button.addEventListener('click',()=>mutate(()=>playSpeed(state,0,selected,p)));
      return button;
    }));
    $('hand').replaceChildren(...state.hands[0].map((number,index)=>{
      const moves=speedMoves(state,0).filter(m=>m.index===index);
      const button=card(number,{index,disabled:blocked()||state.over,pressed:selected===index});
      button.classList.toggle('playable',!!moves.length);button.classList.toggle('selected',selected===index);
      button.addEventListener('click',()=>{
        if(blocked()||state.over)return;
        if(moves.length===1)mutate(()=>playSpeed(state,0,index,moves[0].pile));
        else if(moves.length===2){selected=selected===index?-1:index;render();}
        else $('instruction').textContent='このカードは出せません。場札の前後の数字を選ぼう';
      });return button;
    }));
    $('deal').hidden=state.over||!!speedMoves(state,0).length||!!speedMoves(state,1).length;
    $('deal').disabled=blocked();
    if(focusZone==='hand'||focusZone==='piles'){
      const next=$(focusZone).querySelector(`[data-index="${focusIndex}"]:not(:disabled)`)||$('piles').querySelector('button:not(:disabled)')||$('hand').querySelector('button:not(:disabled)');
      (next||$('table')).focus({preventScroll:true});
    }
  }
}
function schedule() {
  clearTimeout(timer);
  if(blocked()||state.over)return;
  if(isMemory&&state.open.length===2){timer=setTimeout(()=>mutate(()=>resolveMemory(state)),1100);return;}
  if(isMemory&&state.turn===1){timer=setTimeout(()=>mutate(()=>flipMemory(state,memoryChoice(state),1)),750);return;}
  if(!isMemory){const moves=speedMoves(state,1);if(moves.length)timer=setTimeout(()=>{const current=speedMoves(state,1);if(current.length)mutate(()=>playSpeed(state,1,current[0].index,current[0].pile));},1000);}
}
function reset() {
  clearTimeout(timer); state=isMemory?newMemory():newSpeed();selected=-1;paused=false;
  save();render();schedule();$('table').focus({preventScroll:true});
}
$('title').textContent=title; document.title=title+' | AITECH GAMES';
$('edition').textContent=isMemory?'MEMORY':'SPEED';
$('nav-'+game).setAttribute('aria-current','page');
$('table').classList.toggle('speed-table',!isMemory);
$('memory-board').hidden=!isMemory;$('piles').hidden=isMemory;$('hand').hidden=isMemory;$('cpu-hand').hidden=isMemory;
$('round-label').textContent=isMemory?'獲得したペア':'残りカード';
$('subtitle').textContent=isMemory?'見つけたペアを、記憶に残そう。':'1枚先を読む、スピード勝負。';
$('hint').textContent=isMemory?'24枚 / 12組のペア':'光るカードは場に出せます';
$('tips').textContent=isMemory?'カードを2枚めくり、同じ数字なら獲得。ペアがそろうと続けてめくれます。':'手札を選ぶと場に出せます。左右どちらにも出せるカードは、続けて場札を選びましょう。AとKもつながります。';
$('rules-title').textContent=title+'の遊び方';
const rules=isMemory?['24枚のカードから同じ数字のペアを探します。順番に2枚ずつめくり、ペアなら続けてめくれます。','違う数字なら相手の番。最後に多くのペアを集めた方が勝ち、同数なら引き分けです。','CPUは一度表になったカードだけを覚えます。裏向きのカードを見抜くことはありません。']:['52枚をあなたとCPUに分け、4枚の手札と山札で対戦します。中央の場札より1つ大きいか小さい数字を出します。AとKもつながります。','あなたとCPUは順番を待たずに出せます。手札を出すと山札から補充され、先に自分のカードがなくなれば勝ちです。','お互い出せないときは「場札を入れ替える」。山札がなくなった場合は、場札の上2枚を残して使用済みカードを混ぜ、山札を補充します。'];
$('rules-copy').replaceChildren(...rules.map(text=>{const p=document.createElement('p');p.textContent=text;return p;}));
$('pause').addEventListener('click',()=>{paused=!paused;render();schedule();});
$('deal').addEventListener('click',()=>mutate(()=>dealSpeed(state)));
$('restart').addEventListener('click',()=>{if(state.over)reset();else{$('confirm').showModal();clearTimeout(timer);}});
$('cancel-restart').addEventListener('click',()=>$('confirm').close());
$('confirm-restart').addEventListener('click',()=>{$('confirm').close();reset();});
$('rules-button').addEventListener('click',()=>{$('rules').showModal();clearTimeout(timer);});
$('close-rules').addEventListener('click',()=>$('rules').close());
for(const id of ['confirm','rules'])$(id).addEventListener('close',()=>{render();schedule();});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&!state.over){paused=true;clearTimeout(timer);}render();schedule();});
document.addEventListener('aitech:assist',()=>{clearTimeout(timer);render();schedule();});
window.addEventListener('storage',event=>{if(event.key===key){conflict=true;paused=true;clearTimeout(timer);$('save-status').textContent='別のタブで対局が更新されました。このタブの進行は保存しません。読み込み直すと最新の対局へ戻れます。';render();}});
render();schedule();
