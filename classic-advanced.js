(() => {
'use strict';
const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>Array.from(r.querySelectorAll(s));
const META={
  daifugo:{title:'大富豪',kicker:'GAME 18 / DAIFUGO',summary:'特殊効果全部入り。ジョーカー、スペ3返し、階段、縛り、5飛び、7渡し、8切り、9リバース、10捨て、11バック、革命を実装。',rules:'<ul><li>通常の強さは 3→4→…→K→A→2。革命中は逆転します。</li><li><b>ジョーカー</b>：単体では最強。同じ数字の組ではワイルドとして使えます。単体ジョーカーは♠3で返せます。</li><li><b>階段</b>：同じスートの連番を3枚以上まとめて出せます。同じ枚数のより強い階段で返します。</li><li><b>スート縛り</b>：同じスート構成が2回続くと縛りが発生し、場が流れるまで同じスート構成だけ出せます。</li><li><b>5飛び</b>：次の人を飛ばします。2人戦では自分が続けて出します。</li><li><b>7渡し</b>：7を出した枚数ぶん、自分の手札からカードを選んで相手に渡します。</li><li><b>8切り</b>：場を即座に流し、出した人が続けて出します。</li><li><b>9リバース</b>：進行方向を反転します。2人戦では手番順自体は変わりません。</li><li><b>10捨て</b>：10を出した枚数ぶん、自分の手札から好きなカードを捨てます。</li><li><b>11バック</b>：場が流れるまで一時的にカードの強弱を反転します。</li><li><b>革命</b>：4枚組、または5枚以上の階段で革命。もう一度革命条件が成立すると元に戻ります。</li><li>出せない時はパス。2人戦ではパスすると場が流れます。</li></ul>'},
  oldmaid:{title:'ババ抜き',kicker:'GAME 19 / OLD MAID',summary:'相手の裏向きカードから1枚選び、同じ数字のペアを捨てます。最後にジョーカーを持った側が負け。',rules:'<ul><li>ジョーカー1枚入りの53枚を配り、同じ数字のペアは自動で捨てます。</li><li>自分の番に相手の裏向きカードを1枚選びます。</li><li>引いたカードでペアができたら自動で場から消えます。</li><li>先に手札が0枚になった人が勝ち。最後のジョーカーを持った人が負けです。</li></ul>'},
  uno:{title:'COLOR UNO',kicker:'GAME 20 / UNO',summary:'色か数字・記号を合わせてカードを出すUNOルールの対戦。独自デザインの108枚デッキ。',rules:'<ul><li>同じ色、同じ数字・記号、またはワイルドを出せます。</li><li>SKIP / REVERSE は2人戦では相手を1回休ませます。</li><li>+2 は相手が2枚、W+4 は相手が4枚引いて休みます。</li><li>ワイルドを出した時は次の色を選びます。</li><li>出せない時は山札から1枚引いてターン終了。先に手札0枚で勝ちです。</li></ul>'},
  othello:{title:'オセロ',kicker:'GAME 21 / OTHELLO',summary:'8×8の定番リバーシ。挟んだ石を返し、最後に多く残した方が勝ち。',rules:'<ul><li>黒が先手です。相手の石を自分の石で挟めるマスに置きます。</li><li>縦・横・斜めで挟んだ石はすべて自分の色になります。</li><li>置ける場所がない時は自動でパスします。</li><li>両者とも置けない、または盤面が埋まると終了。石が多い方が勝ちです。</li></ul>'},
  ttt:{title:'マルバツゲーム',kicker:'GAME 22 / TIC TAC TOE',summary:'3×3の盤面で○×を3つ揃えるシンプル対戦。CPUはミニマックスで手強くしました。',rules:'<ul><li>先手は×、後手は○です。</li><li>空いているマスを交互に1つずつ選びます。</li><li>縦・横・斜めのどれか1列に3つ揃えた方が勝ち。</li><li>9マス埋まって揃わなければ引き分けです。</li></ul>'}
};
const params=new URLSearchParams(location.search); let game=params.get('game'); if(!META[game]) game='daifugo'; let mode=params.get('mode')==='online'?'online':'solo';
const el={title:$('#game-title'),kicker:$('#game-kicker'),summary:$('#game-summary'),solo:$('#solo-mode-btn'),online:$('#online-mode-btn'),lobby:$('#lobby'),badge:$('#connection-badge'),create:$('#create-room-btn'),roomCreated:$('#room-created'),roomCode:$('#room-code-display'),copy:$('#copy-room-btn'),join:$('#join-form'),roomInput:$('#room-code-input'),connStatus:$('#connection-status'),connDetail:$('#connection-detail'),stage:$('#game-stage'),turn:$('#turn-label'),status:$('#status-label'),you:$('#you-label'),youSub:$('#you-sub'),rival:$('#rival-label'),rivalSub:$('#rival-sub'),pass:$('#pass-btn'),draw:$('#draw-btn'),newGame:$('#new-game-btn'),msg:$('#game-message'),rules:$('#rules-dialog'),rulesTitle:$('#rules-title'),rulesBody:$('#rules-body')};
const meta=META[game]; document.title=`${meta.title} - 20秒ミニゲームズ`; el.title.textContent=meta.title; el.kicker.textContent=meta.kicker; el.summary.textContent=meta.summary; el.rulesTitle.textContent=`${meta.title} のルール`; el.rulesBody.innerHTML=meta.rules;
function gotoMode(m){location.href=`classic.html?game=${encodeURIComponent(game)}&mode=${m}`}
el.solo.onclick=()=>gotoMode('solo'); el.online.onclick=()=>gotoMode('online'); el.solo.setAttribute('aria-pressed',mode==='solo'); el.online.setAttribute('aria-pressed',mode==='online'); el.lobby.classList.toggle('hidden',mode!=='online');
$('#rules-btn').onclick=()=>el.rules.showModal(); $('#rules-close').onclick=()=>el.rules.close(); el.rules.addEventListener('click',e=>{if(e.target===el.rules)el.rules.close()}); $('#fullscreen-btn').onclick=async()=>{try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen();else await document.exitFullscreen()}catch(_){}};
const ROOM_PREFIX='mg20-', ROOM_CHARS='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let peer=null,conn=null,role=null,roomCode='',connected=false,state=null,cpuTimer=0,selected=new Set(),pendingWild='';
const localIndex=()=>mode==='solo'?0:(role==='guest'?1:0); const canAct=()=>state&&state.winner==null&&state.turn===localIndex()&&(mode==='solo'||connected);
function roomCodeMake(){let s='';for(let i=0;i<6;i++)s+=ROOM_CHARS[Math.floor(Math.random()*ROOM_CHARS.length)];return s} function normalizeCode(v){return String(v||'').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6)}
function setConn(a,b='',st='idle'){el.connStatus.textContent=a;el.connDetail.textContent=b;el.badge.textContent=st==='connected'?'接続中':st==='waiting'?'待機中':st==='error'?'エラー':'未接続';el.badge.dataset.state=st}
function destroyPeer(){if(conn)try{conn.close()}catch(_){};if(peer)try{peer.destroy()}catch(_){};peer=conn=null;role=null;roomCode='';connected=false;clearTimeout(cpuTimer)}
function peerErr(err){const t=err?.type||'';if(t==='peer-unavailable')return'部屋が見つかりません。コードを確認してください。';if(t==='unavailable-id')return'同じ部屋コードが使われています。';return'通信に失敗しました。再読み込みしてもう一度お試しください。'}
function createRoom(){if(!window.SupabasePeer){setConn('Supabase通信を読み込めません','ページを再読み込みしてください。','error');return}destroyPeer();role='host';roomCode=roomCodeMake();el.roomCreated.classList.remove('hidden');el.roomCode.textContent=roomCode;setConn('部屋を作成しています…','Supabase Realtimeに接続中','waiting');peer=new SupabasePeer(ROOM_PREFIX+roomCode.toLowerCase());peer.on('open',()=>setConn('相手の参加を待っています',`部屋コード ${roomCode} を共有してください。`,'waiting'));peer.on('connection',c=>{if(conn?.open){c.close();return}attach(c)});peer.on('error',err=>{if(err?.type==='unavailable-id'){setTimeout(createRoom,100);return}setConn('接続エラー',peerErr(err),'error')})}
function joinRoom(code){const c=normalizeCode(code);if(c.length!==6){setConn('6桁のコードを入力してください','','error');return}destroyPeer();role='guest';roomCode=c;el.roomCreated.classList.add('hidden');setConn('部屋に接続しています…',`ROOM ${c}`,'waiting');peer=new SupabasePeer();peer.on('open',()=>attach(peer.connect(ROOM_PREFIX+c.toLowerCase())));peer.on('error',err=>setConn('接続エラー',peerErr(err),'error'))}
function attach(c){conn=c;c.on('open',()=>{connected=true;setConn('対戦相手と接続しました',`${role==='host'?'PLAYER 1 / HOST':'PLAYER 2 / GUEST'} / ${roomCode}`,'connected');if(role==='host')startGame();safeSend({type:'hello',game});render()});c.on('data',handleNet);c.on('close',()=>{connected=false;setConn('接続が切れました','もう一度部屋を作成・参加してください。','error');el.msg.textContent='対戦相手との接続が切れました。';render()});c.on('error',()=>setConn('通信エラー','再接続してください。','error'))}
function safeSend(x){if(conn?.open)try{conn.send(x)}catch(_){}}
function handleNet(d){if(!d||d.game&&d.game!==game)return;if(d.type==='state'&&role==='guest'){state=d.state;selected.clear();pendingWild='';render();return}if(d.type==='hello'&&role==='host'){sendState();return}if(d.type==='action'&&role==='host'){applyAction(d.action,1);return}if(d.type==='reset-request'&&role==='host'){startGame();return}}
el.create.onclick=createRoom; el.join.addEventListener('submit',e=>{e.preventDefault();joinRoom(el.roomInput.value)}); el.roomInput.addEventListener('input',()=>el.roomInput.value=normalizeCode(el.roomInput.value)); el.copy.onclick=async()=>{try{await navigator.clipboard.writeText(roomCode);el.copy.textContent='コピー済み';setTimeout(()=>el.copy.textContent='コピー',1200)}catch(_){}};
function sendState(){if(mode==='online'&&role==='host')safeSend({type:'state',game,state})}
function submit(action){if(mode==='online'){if(!connected){el.msg.textContent='先に部屋へ接続してください。';return}if(role==='guest'){safeSend({type:'action',game,action});return}}applyAction(action,0)}
function startGame(){selected.clear();pendingWild='';state=game==='daifugo'?initDaifugo():game==='oldmaid'?initOldMaid():game==='uno'?initUno():game==='othello'?initOthello():initTtt();commit('ゲーム開始！')}
function commit(message=''){selected.clear();pendingWild='';if(message)el.msg.textContent=message;render();sendState();scheduleCpu()}
function scheduleCpu(){clearTimeout(cpuTimer);if(mode!=='solo'||!state||state.winner!=null||state.turn!==1)return;cpuTimer=setTimeout(cpuMove,480)}
el.newGame.onclick=()=>{if(mode==='online'&&role==='guest'){safeSend({type:'reset-request',game});el.msg.textContent='再戦をリクエストしました。'}else startGame()};
const SUITS=[['♠','black'],['♥','red'],['♦','red'],['♣','black']], RL={11:'J',12:'Q',13:'K',14:'A',15:'2'}; function rankLabel(r){return RL[r]||String(r)} function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function standardDeck(joker=false){const d=[];for(const[suit,color]of SUITS)for(let r=3;r<=15;r++)d.push({id:`${suit}${r}`,suit,color,rank:r,label:rankLabel(r)});if(joker)d.push({id:'JOKER',suit:'★',color:'red',rank:99,label:'JOKER',joker:true});return shuffle(d)}
function sortHand(h){h.sort((a,b)=>(a.joker?1:0)-(b.joker?1:0)||a.rank-b.rank||a.suit.localeCompare(b.suit));return h}
function cardHtml(c,opts={}){if(opts.back)return'<div class="playing-card back" aria-label="裏向きカード"></div>';const tag=opts.static?'div':'button',attrs=opts.static?'':`type="button" data-card="${c.id}"`;return`<${tag} class="playing-card ${c.color||''} ${c.joker?'joker':''} ${opts.selected?'selected':''} ${opts.playable?'playable':''}" ${attrs}><span class="rank">${c.joker?'JK':c.label}</span><span class="suit">${c.suit}</span></${tag}>`}

// DAIFUGO — advanced special-rule set
function initDaifugo(){const d=standardDeck(true),h=[[],[]];d.forEach((c,i)=>h[i%2].push(c));h.forEach(sortHand);return{kind:'daifugo',hands:h,turn:0,pile:null,revolution:false,elevenBack:false,suitLock:null,direction:1,pending:null,pendingQueue:[],afterTurn:0,lastEffect:'',winner:null}}
function daiReverse(){return !!(state.revolution!==state.elevenBack)}
function daiClearTrick(){state.pile=null;state.elevenBack=false;state.suitLock=null}
function daiAnalyze(cards){
  if(!cards.length)return null;
  const jokers=cards.filter(c=>c.joker), non=cards.filter(c=>!c.joker), count=cards.length;
  if(jokers.length>1)return null;
  if(jokers.length===1&&non.length===0)return{type:'group',count:1,rank:99,jokerOnly:true,jokerCount:1,suits:[],suitKey:'',cards};
  const sameRank=non.length&&non.every(c=>c.rank===non[0].rank);
  if(sameRank&&count<=4){const suits=non.map(c=>c.suit).sort();return{type:'group',count,rank:non[0].rank,jokerOnly:false,jokerCount:jokers.length,suits,suitKey:suits.join('|'),cards};}
  if(count>=3&&jokers.length===0&&non.every(c=>c.suit===non[0].suit)){
    const ranks=non.map(c=>c.rank).sort((a,b)=>a-b); if(new Set(ranks).size!==ranks.length)return null;
    if(ranks.every((r,i)=>i===0||r===ranks[i-1]+1))return{type:'sequence',count,low:ranks[0],high:ranks[ranks.length-1],rank:ranks[ranks.length-1],jokerOnly:false,jokerCount:0,suits:[non[0].suit],suitKey:non[0].suit,cards};
  }
  return null;
}
function daiSuitAllowed(a){
  if(!state.suitLock)return true;
  if(a.jokerOnly)return false;
  const lock=state.suitLock.split('|').filter(Boolean);
  if(a.type==='sequence')return a.suitKey===state.suitLock;
  if(a.count!==lock.length)return false;
  return a.suits.every(s=>lock.includes(s))&&a.suits.length+a.jokerCount===lock.length;
}
function daiCanPlay(cards,p){
  if(state.kind!=='daifugo'||state.turn!==p||state.pending||!cards.length)return{ok:false,reason:'今は出せません。'};
  const a=daiAnalyze(cards); if(!a)return{ok:false,reason:'同じ数字の組、または同スート3枚以上の階段を選んでください。'};
  if(!state.pile)return{ok:true,a};
  const pile=state.pile;
  if(pile.jokerOnly&&a.type==='group'&&a.count===1&&!a.jokerOnly&&a.rank===3&&a.suits[0]==='♠')return{ok:true,a,spade3:true};
  if(a.jokerOnly){if(pile.count!==1)return{ok:false,reason:'単体ジョーカーは1枚出しにだけ使えます。'};return{ok:true,a};}
  if(a.type!==pile.type||a.count!==pile.count)return{ok:false,reason:`場と同じ種類・${pile.count}枚で出してください。`};
  if(!daiSuitAllowed(a))return{ok:false,reason:`スート縛り中：${state.suitLock.replaceAll('|','・')}だけ出せます。`};
  const av=a.type==='sequence'?a.high:a.rank, pv=pile.type==='sequence'?pile.high:pile.rank;
  const stronger=daiReverse()?av<pv:av>pv;
  return stronger?{ok:true,a}:{ok:false,reason:daiReverse()?'今はより小さい数字が強い状態です。':'場より強いカードを出してください。'};
}
function daiWinner(p,msg){state.winner=p;state.pending=null;state.pendingQueue=[];commit(msg|| (p===localIndex()?'あなたの勝ち！':'相手の勝ち。'))}
function daiStartPending(p,queue,afterTurn,message){
  state.pendingQueue=queue.filter(x=>x.count>0); state.afterTurn=afterTurn;
  if(!state.pendingQueue.length){state.turn=afterTurn;return commit(message)}
  state.pending=state.pendingQueue.shift(); state.turn=p; commit(message+` ${state.pending.type==='give'?'7渡し':'10捨て'}を選択してください。`);
}
function daiResolveSpecial(p,ids){
  if(state.kind!=='daifugo'||!state.pending||state.turn!==p)return;
  const unique=[...new Set(ids||[])], hand=state.hands[p], need=Math.min(state.pending.count,hand.length);
  if(unique.length!==need||unique.some(id=>!hand.some(c=>c.id===id)))return commit(`${need}枚選んでください。`);
  const chosen=unique.map(id=>hand.find(c=>c.id===id)); state.hands[p]=hand.filter(c=>!unique.includes(c.id));
  let msg='';
  if(state.pending.type==='give'){state.hands[1-p].push(...chosen);sortHand(state.hands[1-p]);msg=`7渡し！ ${chosen.length}枚を相手へ渡しました。`;}
  else{msg=`10捨て！ ${chosen.length}枚を捨てました。`;}
  sortHand(state.hands[p]);
  if(state.hands[p].length===0)return daiWinner(p,msg+' 手札0枚で上がり！');
  if(state.pendingQueue.length){state.pending=state.pendingQueue.shift();state.turn=p;return commit(msg+` 続けて${state.pending.type==='give'?'7渡し':'10捨て'}を選択。`)}
  state.pending=null;state.turn=state.afterTurn;commit(msg);
}
function daiPlay(p,ids){
  const hand=state.hands[p], cards=ids.map(id=>hand.find(c=>c.id===id)).filter(Boolean), check=daiCanPlay(cards,p);
  if(!check.ok)return commit(check.reason); const a=check.a, prev=state.pile;
  state.hands[p]=hand.filter(c=>!ids.includes(c.id)); sortHand(state.hands[p]);
  const ranks=cards.filter(c=>!c.joker).map(c=>c.rank), effects=[];
  if(check.spade3)effects.push('スペ3返し');
  const revolution=(a.type==='group'&&a.count===4)||(a.type==='sequence'&&a.count>=5);
  if(revolution){state.revolution=!state.revolution;effects.push(state.revolution?'革命':'革命返し');}
  if(ranks.includes(11)){state.elevenBack=true;effects.push('11バック');}
  if(!state.suitLock&&prev&&prev.type===a.type&&prev.count===a.count&&!prev.jokerCount&&!a.jokerCount&&prev.suitKey&&prev.suitKey===a.suitKey){state.suitLock=a.suitKey;effects.push('スート縛り');}
  if(ranks.includes(9)){state.direction*=-1;effects.push('9リバース');}
  const cut8=ranks.includes(8), skip5=ranks.includes(5);
  if(skip5)effects.push('5飛び'); if(cut8)effects.push('8切り'); if(a.jokerOnly)effects.push('ジョーカー');
  if(check.spade3)effects.push('JOKER撃破');
  let afterTurn=(cut8||skip5)?p:1-p;
  if(cut8)daiClearTrick(); else state.pile={...a,cards,lastPlayer:p};
  const q=[]; const sevens=ranks.filter(r=>r===7).length, tens=ranks.filter(r=>r===10).length;
  if(sevens&&state.hands[p].length){q.push({type:'give',count:Math.min(sevens,state.hands[p].length)});effects.push('7渡し');}
  if(tens&&state.hands[p].length){q.push({type:'discard',count:Math.min(tens,state.hands[p].length)});effects.push('10捨て');}
  state.lastEffect=effects.join(' / ')||'通常';
  if(state.hands[p].length===0)return daiWinner(p,(effects.length?effects.join('！ ')+'！ ':'')+(p===localIndex()?'あなたの勝ち！':'相手の勝ち。'));
  const msg=effects.length?effects.join('！ ')+'！':'カードを出しました。';
  if(q.length)return daiStartPending(p,q,afterTurn,msg);
  state.turn=afterTurn;commit(msg);
}
function daiPass(p){if(state.kind!=='daifugo'||state.turn!==p||state.pending||!state.pile)return;const lead=state.pile.lastPlayer;daiClearTrick();state.turn=lead;state.lastEffect='場流れ';commit('パス。場が流れ、11バック・縛りも解除されました。')}
function daiCandidateSets(hand){
  const out=[], joker=hand.find(c=>c.joker), pile=state.pile;
  if(!pile){for(const c of hand.filter(c=>!c.joker))out.push([c]);if(joker)out.push([joker]);return out;}
  const k=pile.count;
  if(pile.type==='group'){
    const groups={};hand.filter(c=>!c.joker).forEach(c=>(groups[c.rank]??=[]).push(c));
    for(const g of Object.values(groups)){if(g.length>=k)out.push(g.slice(0,k));else if(joker&&g.length>=k-1&&k>1)out.push([...g.slice(0,k-1),joker]);}
    if(k===1&&joker)out.push([joker]);
  }else{
    for(const [suit] of SUITS){const s=hand.filter(c=>!c.joker&&c.suit===suit).sort((a,b)=>a.rank-b.rank);for(let i=0;i<=s.length-k;i++){const seq=s.slice(i,i+k);if(seq.every((c,j)=>j===0||c.rank===seq[j-1].rank+1))out.push(seq)}}
  }
  return out;
}
function daiCpu(){
  const p=1,h=state.hands[p];
  if(state.pending){const n=Math.min(state.pending.count,h.length),pick=[...h].sort((a,b)=>(a.joker?1:0)-(b.joker?1:0)||a.rank-b.rank).slice(0,n);return daiResolveSpecial(p,pick.map(c=>c.id));}
  let choices=daiCandidateSets(h).filter(cs=>daiCanPlay(cs,p).ok);
  if(!choices.length)return state.pile?daiPass(p):undefined;
  const rev=daiReverse();choices.sort((x,y)=>{const a=daiAnalyze(x),b=daiAnalyze(y),av=a.jokerOnly?999:(a.type==='sequence'?a.high:a.rank),bv=b.jokerOnly?999:(b.type==='sequence'?b.high:b.rank);if(a.jokerOnly!==b.jokerOnly)return a.jokerOnly?1:-1;return rev?bv-av:av-bv});
  daiPlay(p,choices[0].map(c=>c.id));
}
function daiChips(){const c=[];if(state.revolution)c.push('革命');if(state.elevenBack)c.push('11バック');if(state.suitLock)c.push(`縛り ${state.suitLock.replaceAll('|','・')}`);if(state.direction<0)c.push('9リバース');if(state.lastEffect&&state.lastEffect!=='通常')c.push(state.lastEffect);return c}

// OLD MAID
function removePairs(hand){const by={};hand.forEach(c=>{if(!c.joker)(by[c.rank]??=[]).push(c)});const remove=new Set();Object.values(by).forEach(g=>{for(let i=0;i+1<g.length;i+=2){remove.add(g[i].id);remove.add(g[i+1].id)}});return hand.filter(c=>!remove.has(c.id))}
function initOldMaid(){const d=standardDeck(true),h=[[],[]];d.forEach((c,i)=>h[i%2].push(c));h[0]=removePairs(h[0]);h[1]=removePairs(h[1]);return{kind:'oldmaid',hands:h,turn:0,winner:null}}
function oldDraw(p,index){if(state.kind!=='oldmaid'||state.turn!==p)return;const opp=1-p;if(index<0||index>=state.hands[opp].length)return;const [c]=state.hands[opp].splice(index,1);state.hands[p].push(c);state.hands[p]=removePairs(state.hands[p]);if(state.hands[opp].length===0){state.winner=opp;return commit(opp===localIndex()?'あなたの勝ち！':'相手の勝ち。')}if(state.hands[p].length===0){state.winner=p;return commit(p===localIndex()?'あなたの勝ち！':'相手の勝ち。')}state.turn=opp;commit('1枚引きました。ペアは自動で捨てます。')}
function oldCpu(){oldDraw(1,Math.floor(Math.random()*state.hands[0].length))}

// UNO
const UCOLORS=['red','yellow','green','blue'];
function unoDeck(){const d=[];let n=0;for(const color of UCOLORS){d.push({id:`u${n++}`,color,value:'0',label:'0'});for(let v=1;v<=9;v++)for(let k=0;k<2;k++)d.push({id:`u${n++}`,color,value:String(v),label:String(v)});for(const v of ['SKIP','REV','+2'])for(let k=0;k<2;k++)d.push({id:`u${n++}`,color,value:v,label:v})}for(let k=0;k<4;k++){d.push({id:`u${n++}`,color:'wild',value:'WILD',label:'W'});d.push({id:`u${n++}`,color:'wild',value:'W+4',label:'W+4'})}return shuffle(d)}
function initUno(){let d=unoDeck(),h=[d.splice(0,7),d.splice(0,7)],topIndex=d.findIndex(c=>c.color!=='wild'&&!['SKIP','REV','+2'].includes(c.value));if(topIndex<0)topIndex=0;const[top]=d.splice(topIndex,1);return{kind:'uno',hands:h,draw:d,discard:[top],currentColor:top.color,turn:0,winner:null}}
function unoTop(){return state.discard[state.discard.length-1]} function unoValid(c){const t=unoTop();return c.color==='wild'||c.color===state.currentColor||c.value===t.value}
function unoRefill(){if(state.draw.length)return;if(state.discard.length<=1)return;const top=state.discard.pop();state.draw=shuffle(state.discard.splice(0));state.discard=[top]}
function unoDrawCards(p,n){for(let i=0;i<n;i++){unoRefill();if(state.draw.length)state.hands[p].push(state.draw.pop())}}
function bestColor(hand){const counts={red:0,yellow:0,green:0,blue:0};hand.forEach(c=>{if(counts[c.color]!=null)counts[c.color]++});return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0]}
function unoPlay(p,id,color){if(state.kind!=='uno'||state.turn!==p)return;const i=state.hands[p].findIndex(c=>c.id===id);if(i<0)return;const c=state.hands[p][i];if(!unoValid(c))return commit('そのカードは出せません。');if(c.color==='wild'&&!UCOLORS.includes(color))return;state.hands[p].splice(i,1);state.discard.push(c);state.currentColor=c.color==='wild'?color:c.color;if(state.hands[p].length===0){state.winner=p;return commit(p===localIndex()?'あなたの勝ち！':'相手の勝ち。')}const opp=1-p;if(c.value==='+2'){unoDrawCards(opp,2);state.turn=p;return commit('+2！ 相手が2枚引いてスキップ。')}if(c.value==='W+4'){unoDrawCards(opp,4);state.turn=p;return commit('W+4！ 相手が4枚引いてスキップ。')}if(c.value==='SKIP'||c.value==='REV'){state.turn=p;return commit(`${c.value}！ もう一度あなたの番です。`)}state.turn=opp;commit(state.hands[p].length===1?'UNO! 残り1枚！':'カードを出しました。')}
function unoDrawOne(p){if(state.kind!=='uno'||state.turn!==p)return;unoDrawCards(p,1);state.turn=1-p;commit('山札から1枚引きました。')}
function unoCpu(){const h=state.hands[1],valid=h.filter(unoValid);if(!valid.length)return unoDrawOne(1);const c=valid.find(x=>x.color!=='wild')||valid[0];unoPlay(1,c.id,c.color==='wild'?bestColor(h):c.color)}
function unoHtml(c,back=false){if(back)return'<div class="uno-card" style="background:#1d2740;border-color:#66779d;cursor:default"><span>◆</span></div>';const cl=c.color==='wild'?'uno-wild':`uno-${c.color}`;return`<button class="uno-card ${cl}" type="button" data-uno="${c.id}"><span>${c.label}</span></button>`}

// OTHELLO
const DIRS=[[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]; function initOthello(){const b=Array(64).fill(0);b[27]=2;b[28]=1;b[35]=1;b[36]=2;return{kind:'othello',board:b,turn:0,winner:null}}
function othColor(p){return p===0?1:2} function othFlips(board,idx,p){if(board[idx])return[];const c=othColor(p),o=c===1?2:1,r=Math.floor(idx/8),col=idx%8,res=[];for(const[dr,dc]of DIRS){let rr=r+dr,cc=col+dc,tmp=[];while(rr>=0&&rr<8&&cc>=0&&cc<8&&board[rr*8+cc]===o){tmp.push(rr*8+cc);rr+=dr;cc+=dc}if(tmp.length&&rr>=0&&rr<8&&cc>=0&&cc<8&&board[rr*8+cc]===c)res.push(...tmp)}return res}
function othMoves(board,p){const m=[];for(let i=0;i<64;i++){const f=othFlips(board,i,p);if(f.length)m.push([i,f])}return m}
function othEnd(){const c1=state.board.filter(x=>x===1).length,c2=state.board.filter(x=>x===2).length;state.winner=c1===c2?'draw':(c1>c2?0:1);commit(c1===c2?`引き分け ${c1}-${c2}`:`${state.winner===localIndex()?'あなた':'相手'}の勝ち！ ${c1}-${c2}`)}
function othMove(p,idx){if(state.kind!=='othello'||state.turn!==p)return;const f=othFlips(state.board,idx,p);if(!f.length)return;const c=othColor(p);state.board[idx]=c;f.forEach(i=>state.board[i]=c);const opp=1-p,oppMoves=othMoves(state.board,opp),ownMoves=othMoves(state.board,p);if(!oppMoves.length&&!ownMoves.length)return othEnd();state.turn=oppMoves.length?opp:p;commit(oppMoves.length?'石を置きました。':'相手は置ける場所がないためパス。')}
function othCpu(){const moves=othMoves(state.board,1);if(!moves.length){state.turn=0;return commit('CPUはパスしました。')}const corners=new Set([0,7,56,63]);moves.sort((a,b)=>(corners.has(b[0])-corners.has(a[0]))||(b[1].length-a[1].length));othMove(1,moves[0][0])}

// TIC TAC TOE
const WIN=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]; function initTtt(){return{kind:'ttt',board:Array(9).fill(0),turn:0,winner:null}}
function tttResult(b){for(const w of WIN){const v=b[w[0]];if(v&&w.every(i=>b[i]===v))return v===1?0:1}return b.every(Boolean)?'draw':null}
function tttMove(p,idx){if(state.kind!=='ttt'||state.turn!==p||state.board[idx])return;state.board[idx]=p===0?1:2;const r=tttResult(state.board);if(r!=null){state.winner=r;return commit(r==='draw'?'引き分け！':r===localIndex()?'あなたの勝ち！':'相手の勝ち。')}state.turn=1-p;commit('マスを選びました。')}
function tttScore(b,depth){const r=tttResult(b);if(r===1)return 10-depth;if(r===0)return depth-10;if(r==='draw')return 0;let best=-99;for(let i=0;i<9;i++)if(!b[i]){b[i]=2;let min=99;for(let j=0;j<9;j++)if(!b[j]){b[j]=1;min=Math.min(min,tttScore(b,depth+2));b[j]=0}if(min===99)min=tttScore(b,depth+1);best=Math.max(best,min);b[i]=0}return best}
function tttCpu(){let best=-999,idx=-1;for(let i=0;i<9;i++)if(!state.board[i]){state.board[i]=2;const s=tttScore(state.board,0);state.board[i]=0;if(s>best){best=s;idx=i}}if(idx>=0)tttMove(1,idx)}

function applyAction(a,p){if(!state||state.winner!=null||state.turn!==p||!a)return;if(game==='daifugo'){if(a.type==='play')daiPlay(p,a.ids||[]);else if(a.type==='pass')daiPass(p);else if(a.type==='special')daiResolveSpecial(p,a.ids||[])}else if(game==='oldmaid'&&a.type==='draw')oldDraw(p,Number(a.index));else if(game==='uno'){if(a.type==='play')unoPlay(p,a.id,a.color);else if(a.type==='draw')unoDrawOne(p)}else if(game==='othello'&&a.type==='move')othMove(p,Number(a.index));else if(game==='ttt'&&a.type==='move')tttMove(p,Number(a.index))}
function cpuMove(){if(!state||state.winner!=null||state.turn!==1)return;if(game==='daifugo')daiCpu();else if(game==='oldmaid')oldCpu();else if(game==='uno')unoCpu();else if(game==='othello')othCpu();else tttCpu()}
function commonLabels(){const li=localIndex(),ri=1-li;el.you.textContent=mode==='solo'?'YOU':role==='guest'?'PLAYER 2':'PLAYER 1';el.rival.textContent=mode==='solo'?'CPU':role==='guest'?'PLAYER 1':'PLAYER 2';if(!state){el.youSub.textContent='準備中';el.rivalSub.textContent='準備中';return}if(state.hands){el.youSub.textContent=`手札 ${state.hands[li].length}枚`;el.rivalSub.textContent=`手札 ${state.hands[ri].length}枚`}else if(state.board&&game==='othello'){el.youSub.textContent=`${li===0?'黒':'白'} ${state.board.filter(x=>x===othColor(li)).length}石`;el.rivalSub.textContent=`${ri===0?'黒':'白'} ${state.board.filter(x=>x===othColor(ri)).length}石`}else if(game==='ttt'){el.youSub.textContent=li===0?'×':'○';el.rivalSub.textContent=ri===0?'×':'○'}}
function render(){commonLabels();el.pass.classList.add('hidden');el.draw.classList.add('hidden');el.newGame.textContent=mode==='online'&&role==='guest'?'再戦リクエスト':'新しいゲーム';if(mode==='online'&&!connected){el.stage.innerHTML='<div class="board-wrap"><div class="pile-note">部屋を作るか、相手の部屋に参加するとゲームが始まります。</div></div>';el.status.textContent='接続待ち';return}if(!state){el.stage.innerHTML='<div class="board-wrap"><div class="pile-note">対戦相手からゲーム状態を受信しています…</div></div>';el.status.textContent='同期中';return}const li=localIndex();el.turn.textContent=state.winner!=null?'RESULT':'TURN';el.status.textContent=state.winner!=null?(state.winner==='draw'?'DRAW':state.winner===li?'YOU WIN':'RIVAL WIN'):(state.turn===li?'あなたの番':'相手の番');if(game==='daifugo')renderDai();else if(game==='oldmaid')renderOld();else if(game==='uno')renderUno();else if(game==='othello')renderOth();else renderTtt()}
function renderDai(){
  const li=localIndex(),ri=1-li,hand=state.hands[li],active=canAct(),special=active&&state.pending;
  const rival=state.hands[ri].map(()=>cardHtml(null,{back:true})).join(''); const pile=state.pile?state.pile.cards.map(c=>cardHtml(c,{static:true})).join(''):'<span class="pile-note">場は空です。好きな組・階段を出せます。</span>';
  const chips=daiChips(), need=special?Math.min(state.pending.count,hand.length):0, specialLabel=special?(state.pending.type==='give'?`7渡し：${need}枚を相手に渡す`:`10捨て：${need}枚を捨てる`):'';
  el.stage.innerHTML=`<div class="table-zone daifugo-zone">${chips.length?`<div class="dai-effects">${chips.map(x=>`<span class="dai-chip">${x}</span>`).join('')}</div>`:''}<section class="rival-area"><div class="area-head"><h3>RIVAL HAND</h3><span>${state.hands[ri].length}枚</span></div><div class="hand">${rival}</div></section><section class="center-area"><div class="area-head"><h3>FIELD</h3><span>${daiReverse()?'強さ反転中':'通常の強さ'}</span></div><div class="pile">${pile}</div>${special?`<div class="dai-special-banner">${specialLabel}</div>`:''}<div class="action-row"><button id="play-selected" class="choice-btn primary" type="button" ${active?'':'disabled'}>${special?specialLabel:'選択したカードを出す'}</button></div></section><section class="you-area"><div class="area-head"><h3>YOUR HAND</h3><span>${special?`${need}枚選択`:'組 / 階段 / ジョーカー対応'}</span></div><div class="hand">${hand.map(c=>cardHtml(c,{selected:selected.has(c.id),playable:active})).join('')}</div></section></div>`;
  $$('[data-card]',el.stage).forEach(b=>b.onclick=()=>{if(!active)return;const id=b.dataset.card;if(selected.has(id))selected.delete(id);else{if(special&&selected.size>=need)return;selected.add(id)}renderDai()});
  $('#play-selected',el.stage).onclick=()=>{if(!active)return;if(special){if(selected.size===need)submit({type:'special',ids:[...selected]});else el.msg.textContent=`${need}枚選んでください。`}else if(selected.size)submit({type:'play',ids:[...selected]})};
  if(active&&state.pile&&!state.pending){el.pass.classList.remove('hidden');el.pass.onclick=()=>submit({type:'pass'})}
}
function renderOld(){const li=localIndex(),ri=1-li,active=canAct();el.stage.innerHTML=`<div class="table-zone"><section class="rival-area"><div class="area-head"><h3>相手の手札から1枚選ぶ</h3><span>${state.hands[ri].length}枚</span></div><div class="hand">${state.hands[ri].map((_,i)=>`<button class="playing-card back" type="button" data-old="${i}" ${active?'':'disabled'} aria-label="相手のカード ${i+1}"></button>`).join('')}</div></section><section class="center-area"><div class="pile"><span class="pile-note">ペアは自動で捨てられます。最後にJOKERを持っていたら負け。</span></div></section><section class="you-area"><div class="area-head"><h3>YOUR HAND</h3><span>${state.hands[li].length}枚</span></div><div class="hand">${state.hands[li].map(c=>cardHtml(c,{static:true})).join('')}</div></section></div>`;$$('[data-old]',el.stage).forEach(b=>b.onclick=()=>submit({type:'draw',index:Number(b.dataset.old)}))}
function renderUno(){const li=localIndex(),ri=1-li,active=canAct(),top=unoTop();el.draw.classList.toggle('hidden',!active);el.draw.onclick=()=>submit({type:'draw'});const wildPick=pendingWild?`<div class="color-pick"><span class="pile-note">次の色：</span>${UCOLORS.map(c=>`<button class="color-dot" data-color="${c}" type="button" aria-label="${c}"></button>`).join('')}</div>`:'';el.stage.innerHTML=`<div class="table-zone"><section class="rival-area"><div class="area-head"><h3>RIVAL HAND</h3><span>${state.hands[ri].length}枚</span></div><div class="hand">${state.hands[ri].map(()=>unoHtml(null,true)).join('')}</div></section><section class="center-area"><div class="area-head"><h3>DISCARD</h3><span>現在色: ${state.currentColor.toUpperCase()}</span></div><div class="pile">${unoHtml(top)}</div>${wildPick}</section><section class="you-area"><div class="area-head"><h3>YOUR HAND</h3><span>${state.hands[li].length===1?'UNO!':''}</span></div><div class="hand">${state.hands[li].map(c=>unoHtml(c)).join('')}</div></section></div>`;$$('[data-uno]',el.stage).forEach(b=>b.onclick=()=>{if(!active)return;const c=state.hands[li].find(x=>x.id===b.dataset.uno);if(!c||!unoValid(c)){el.msg.textContent='そのカードは今は出せません。';return}if(c.color==='wild'){pendingWild=c.id;renderUno()}else submit({type:'play',id:c.id,color:c.color})});$$('[data-color]',el.stage).forEach(b=>b.onclick=()=>{if(pendingWild)submit({type:'play',id:pendingWild,color:b.dataset.color})})}
function renderOth(){const li=localIndex(),active=canAct(),valid=new Set(active?othMoves(state.board,li).map(x=>x[0]):[]);el.stage.innerHTML=`<div class="board-wrap"><div class="othello-board">${state.board.map((v,i)=>`<button class="othello-cell ${valid.has(i)?'valid':''}" type="button" data-oth="${i}" ${valid.has(i)?'':'disabled'}>${v?`<span class="disc ${v===1?'black':'white'}"></span>`:''}</button>`).join('')}</div></div>`;$$('[data-oth]',el.stage).forEach(b=>b.onclick=()=>submit({type:'move',index:Number(b.dataset.oth)}))}
function renderTtt(){const li=localIndex(),active=canAct();el.stage.innerHTML=`<div class="board-wrap"><div class="ttt-board">${state.board.map((v,i)=>`<button class="ttt-cell ${v===1?'x':v===2?'o':''}" type="button" data-ttt="${i}" ${active&&!v?'':'disabled'}>${v===1?'×':v===2?'○':''}</button>`).join('')}</div></div>`;$$('[data-ttt]',el.stage).forEach(b=>b.onclick=()=>submit({type:'move',index:Number(b.dataset.ttt)}))}
window.addEventListener('beforeunload',destroyPeer); if(mode==='solo')startGame(); else render();
})();
