/* MEGA ARCADE FINAL PASS: unique profiles + specialist engines */
(() => {
  const buildStamp = "2026.09.09-final";
  const categoryLead = {
    mobile: "スマホ操作に合わせ、",
    card: "手札と読み合いを中心に、",
    board: "盤面判断を中心に、",
    playing: "標準トランプを使い、"
  };
  const twists = [
    "短いラウンドで判断を積み重ねる。",
    "難易度に応じて目標値とCPU速度が変化する。",
    "連続成功で有利になり、ミスで流れが切れる。",
    "終盤ほど要求精度が上がる。",
    "安全策と高得点狙いの選択が勝敗を分ける。",
    "毎回初期配置が変わるため同じ攻略にならない。",
    "タッチ操作だけで最後まで遊べる。"
  ];
  catalog.forEach((item, n) => {
    const base = ENGINE_META[item.engine] || [item.mechanic || "PLAY", "短時間で遊べるルール。"]; 
    item.variantKey = `${item.category}-${String(item.index).padStart(3,"0")}-${(n * 37 + item.index * 11) % 997}`;
    item.goal = `${item.title}：${base[1]}`;
    item.twist = twists[(item.index + n + item.difficulty) % twists.length];
    if (item.category !== "playing") item.description = `${categoryLead[item.category]}${item.goal} ${item.twist}`;
  });
  window.MEGA_ARCADE_BUILD = buildStamp;
  window.MEGA_ARCADE_STATS = {
    mobile: catalog.filter(x=>x.category==="mobile").length,
    card: catalog.filter(x=>x.category==="card").length,
    board: catalog.filter(x=>x.category==="board").length,
    playing: catalog.filter(x=>x.category==="playing").length,
    total: catalog.length,
    uniqueProfiles: new Set(catalog.map(x=>x.variantKey)).size
  };

  const oldMountMobile = mountMobile;
  mountMobile = function(item) {
    if (item.index >= 61 && item.index <= 73) return finalSport(item);
    if (item.index === 75 || item.index === 76) return finalRhythm(item);
    if (item.index === 77) return finalTyping(item);
    if (item.index === 78 || item.index === 79) return finalQuiz(item);
    if (item.index === 83) return finalMatch3(item);
    if (item.index === 84) return finalBlockDrop(item);
    if (item.index === 88) return finalPipe(item);
    if (item.index === 89) return finalMerge(item);
    if (item.index >= 97 && item.index <= 99) return finalCare(item);
    return oldMountMobile(item);
  };

  const sportCfg = {
    61:["⚽","SHOOT","ゴール中央",52], 62:["⚾","SWING","芯",48], 63:["🏀","RELEASE","リング",55],
    64:["🎾","RETURN","ライン",45], 65:["🏓","SMASH","コーナー",58], 66:["⛳","PUTT","カップ",50],
    67:["🎳","THROW","ポケット",54], 68:["🎱","STRIKE","狙点",47], 69:["🎯","THROW","BULL",50],
    70:["🥊","PUNCH","ガードの隙",57], 71:["🤼","PUSH","土俵際",44], 72:["🏇","BOOST","直線",53], 73:["🎣","REEL","食いつき",49]
  };
  function finalSport(item) {
    const [icon, action, targetName, target] = sportCfg[item.index];
    let pos=0, dir=1, shots=0, score=0, stamina=100, raf=0, last=performance.now();
    const rounds=6+item.difficulty;
    els.stage.innerHTML = hud(`SCORE <b id="fs-score">0</b>`,`STAMINA <b id="fs-st">100</b>`) +
      `<div class="g-center"><h3>${icon} ${item.title}</h3><p>${targetName}にゲージを合わせて ${action}</p>`+
      `<div class="timing-meter" style="position:relative"><div style="position:absolute;left:${target-6}%;width:12%;top:0;bottom:0;background:rgba(85,230,156,.25);border:1px solid rgba(85,230,156,.75);border-radius:10px"></div><div id="fs-needle" class="timing-needle"></div></div>`+
      `<button id="fs-act" class="g-primary" type="button" style="margin-top:24px">${action}</button><p id="fs-msg">ROUND 1 / ${rounds}</p></div>`;
    const needle=$("#fs-needle"), ss=$("#fs-score"), st=$("#fs-st"), msg=$("#fs-msg");
    function loop(now){const dt=Math.min(.04,(now-last)/1000);last=now;pos+=dir*dt*(68+item.difficulty*18);if(pos>=100){pos=100;dir=-1}if(pos<=0){pos=0;dir=1}needle.style.left=`calc(${pos}% - 3px)`;raf=requestAnimationFrame(loop)}
    raf=requestAnimationFrame(loop); onCleanup(()=>cancelAnimationFrame(raf));
    $("#fs-act").onclick=()=>{if(shots>=rounds)return;shots++;const d=Math.abs(pos-target);let pts=Math.max(0,Math.round(100-d*3.2));if(item.index===72)pts=Math.round(pts*(stamina/100+.35));score+=pts;stamina=Math.max(0,stamina-(7+item.difficulty*2));if(pts>=88)stamina=Math.min(100,stamina+5);ss.textContent=score;st.textContent=stamina;msg.textContent=`${pts>=90?"PERFECT":pts>=65?"GREAT":pts>=35?"GOOD":"MISS"} +${pts} · ROUND ${Math.min(shots+1,rounds)} / ${rounds}`;navigator.vibrate?.(pts>=90?25:8);if(shots>=rounds)setTimeout(()=>finish(score>=rounds*58?"VICTORY":"TRY AGAIN",`${score} POINTS`,score>=rounds*58),260)};
  }

  function finalRhythm(item) {
    let seq=[], step=0, score=0, combo=0, started=false, timer=0;
    const goal=12+item.difficulty*4, labels=["◀","▲","●","▶"];
    els.stage.innerHTML=hud(`SCORE <b id="fr-score">0</b>`,`COMBO <b id="fr-combo">0</b>`)+`<div class="g-center"><h3>🎵 ${item.title}</h3><p>光ったレーンをテンポよくタップ</p><div id="fr-pads" class="pad-grid">${labels.map((x,i)=>`<button class="memory-pad" data-i="${i}" type="button">${x}</button>`).join("")}</div><button id="fr-start" class="g-primary" type="button" style="margin-top:22px">START</button><p id="fr-msg">${goal} BEATS</p></div>`;
    const pads=[...els.stage.querySelectorAll("#fr-pads button")], s=$("#fr-score"), c=$("#fr-combo"), msg=$("#fr-msg");
    function cue(){if(step>=goal){finish(score>=goal*70?"RHYTHM CLEAR":"KEEP PRACTICING",`${score} POINTS · MAX COMBO ${combo}`,score>=goal*70);return}const n=rand(4);seq.push(n);pads.forEach(x=>x.classList.remove("lit"));pads[n].classList.add("lit");setTimeout(()=>pads[n]?.classList.remove("lit"),240);msg.dataset.expect=String(n);msg.dataset.open="1";timer=setTimeout(()=>{if(msg.dataset.open==="1"){combo=0;c.textContent=0;msg.dataset.open="";step++;cue()}},Math.max(430,720-item.difficulty*80));onCleanup(()=>clearTimeout(timer))}
    pads.forEach((p,i)=>p.onclick=()=>{if(!started||msg.dataset.open!=="1")return;clearTimeout(timer);const ok=String(i)===msg.dataset.expect;msg.dataset.open="";if(ok){combo++;score+=100+combo*5;p.classList.add("lit");setTimeout(()=>p.classList.remove("lit"),100)}else combo=0;s.textContent=score;c.textContent=combo;step++;cue()});
    $("#fr-start").onclick=()=>{if(started)return;started=true;$("#fr-start").disabled=true;cue()};
  }

  function finalTyping(item) {
    const words=["げーむ","すまほ","たいぴんぐ","すぴーど","ゆうしゃ","ぞんび","ぼうけん","ぱずる","しょうり","れんぞく","あくしょん","らんきんぐ"];
    let target=words[rand(words.length)], score=0, left=30, stop;
    els.stage.innerHTML=hud(`SCORE <b id="ft-score">0</b>`,`TIME <b id="ft-time">30.0</b>`)+`<div class="g-center"><h3>⌨️ ${item.title}</h3><p>表示されたひらがなをそのまま入力</p><div class="big-total" id="ft-word">${target}</div><input id="ft-input" inputmode="text" autocomplete="off" autocapitalize="off" style="font-size:22px;padding:14px 18px;border-radius:14px;border:1px solid rgba(255,255,255,.2);background:#11182a;color:white;width:min(90%,360px)" placeholder="ここに入力"><p id="ft-msg">正解 +100</p></div>`;
    const input=$("#ft-input"), sw=$("#ft-word"), ss=$("#ft-score"), tt=$("#ft-time");
    input.addEventListener("input",()=>{if(input.value===target){score+=100;ss.textContent=score;input.value="";let next=target;while(next===target)next=words[rand(words.length)];target=next;sw.textContent=target;navigator.vibrate?.(8)}});input.focus();
    stop=countdown(left,x=>tt.textContent=x.toFixed(1),()=>finish(score>=700?"TYPE MASTER":"TIME UP",`${score} POINTS`,score>=700));
  }

  function finalQuiz(item) {
    let q=0,score=0,locked=false,total=10+item.difficulty*2;
    els.stage.innerHTML=hud(`SCORE <b id="fq-score">0</b>`,`Q <b id="fq-q">1/${total}</b>`)+`<div class="g-center"><h3>❓ ${item.title}</h3><div class="big-total" id="fq-text"></div><div id="fq-answers" class="g-button-row" style="flex-wrap:wrap"></div><p id="fq-msg">正解をタップ</p></div>`;
    const qt=$("#fq-text"), ans=$("#fq-answers"), ss=$("#fq-score"), qq=$("#fq-q"), msg=$("#fq-msg");
    function next(){if(q>=total){finish(score>=total*70?"QUIZ CLEAR":"RESULT",`${score}/${total*100} POINTS`,score>=total*70);return}locked=false;qq.textContent=`${q+1}/${total}`;let correct, text, opts=[];if(item.index===78){const a=2+rand(15),b=2+rand(12),op=rand(2);correct=op?a*b:a+b;text=op?`${a} × ${b} = ?`:`${a} + ${b} = ?`;opts=[correct,correct+1+rand(4),Math.max(0,correct-1-rand(4)),correct+5+rand(6)]}else{const bank=[["日本の首都は？","東京","大阪","京都","札幌"],["1週間は何日？","7","5","6","8"],["水が凍る温度は？","0℃","10℃","-10℃","100℃"],["地球の衛星は？","月","火星","太陽","金星"],["赤と青を混ぜると？","紫","緑","橙","白"]],row=bank[rand(bank.length)];text=row[0];correct=row[1];opts=row.slice(1)}qt.textContent=text;opts=shuffle(opts);ans.innerHTML=opts.map(v=>`<button class="g-secondary" data-v="${String(v).replace(/"/g,'&quot;')}" type="button">${v}</button>`).join("");[...ans.querySelectorAll("button")].forEach(b=>b.onclick=()=>{if(locked)return;locked=true;const ok=String(b.dataset.v)===String(correct);if(ok)score+=100;ss.textContent=score;msg.textContent=ok?"CORRECT +100":"MISS";q++;setTimeout(next,260)})}
    next();
  }

  function finalMatch3(item){
    const N=6, colors=["🔴","🟡","🟢","🔵","🟣"];let board=Array.from({length:N*N},()=>rand(colors.length)),score=0,moves=18,selected=-1;
    els.stage.innerHTML=hud(`SCORE <b id="m3-score">0</b>`,`MOVE <b id="m3-moves">${moves}</b>`)+`<div class="g-center"><h3>💎 ${item.title}</h3><p>隣り合う2マスを交換。3個以上そろえる</p><div id="m3-grid" class="number-grid" style="grid-template-columns:repeat(${N},46px)"></div><p id="m3-msg">1つ目を選択</p></div>`;
    const grid=$("#m3-grid"),ss=$("#m3-score"),mm=$("#m3-moves"),msg=$("#m3-msg");
    const adj=(a,b)=>Math.abs(a%N-b%N)+Math.abs(Math.floor(a/N)-Math.floor(b/N))===1;
    function matches(){const hit=new Set();for(let y=0;y<N;y++)for(let x=0;x<N-2;x++){let i=y*N+x;if(board[i]===board[i+1]&&board[i]===board[i+2]){hit.add(i);hit.add(i+1);hit.add(i+2)}}for(let x=0;x<N;x++)for(let y=0;y<N-2;y++){let i=y*N+x;if(board[i]===board[i+N]&&board[i]===board[i+2*N]){hit.add(i);hit.add(i+N);hit.add(i+2*N)}}return hit}
    function settle(){let hit=matches(),chain=0;while(hit.size&&chain<8){score+=hit.size*20*(chain+1);hit.forEach(i=>board[i]=rand(colors.length));chain++;hit=matches()}ss.textContent=score;render();if(moves<=0)finish(score>=700?"MATCH CLEAR":"OUT OF MOVES",`${score} POINTS`,score>=700)}
    function render(){grid.innerHTML=board.map((v,i)=>`<button class="number-tile ${i===selected?"done":""}" data-i="${i}" type="button" style="font-size:22px">${colors[v]}</button>`).join("")}
    grid.onclick=e=>{const b=e.target.closest("[data-i]");if(!b||moves<=0)return;const i=+b.dataset.i;if(selected<0){selected=i;msg.textContent="隣のマスを選択";render();return}if(!adj(selected,i)){selected=i;render();return}[board[selected],board[i]]=[board[i],board[selected]];moves--;mm.textContent=moves;selected=-1;settle()};render();
  }

  function finalBlockDrop(item){
    const W=7,H=10;let rows=Array.from({length:H},()=>Array(W).fill(0)),col=3,score=0,over=false;
    els.stage.innerHTML=hud(`SCORE <b id="bd-score">0</b>`,`BLOCK <b>■</b>`)+`<div class="g-center"><h3>🧱 ${item.title}</h3><p>列を選んでブロックを落とし、横一列を埋める</p><div id="bd-grid" style="display:grid;grid-template-columns:repeat(${W},34px);gap:3px"></div><div class="g-button-row"><button id="bd-left" class="g-secondary">←</button><button id="bd-drop" class="g-primary">DROP</button><button id="bd-right" class="g-secondary">→</button></div></div>`;
    const g=$("#bd-grid"),ss=$("#bd-score");
    function render(){g.innerHTML=rows.flatMap((r,y)=>r.map((v,x)=>`<div style="width:34px;height:30px;border-radius:5px;border:1px solid rgba(255,255,255,.15);background:${v?'rgba(124,92,255,.85)':x===col?'rgba(255,255,255,.08)':'rgba(255,255,255,.025)'}"></div>`)).join("")}
    function drop(){if(over)return;let y=H-1;while(y>=0&&rows[y][col])y--;if(y<0){over=true;finish("STACK OVER",`${score} POINTS`,false);return}rows[y][col]=1;const full=[];rows.forEach((r,i)=>{if(r.every(Boolean))full.push(i)});full.forEach(i=>{rows.splice(i,1);rows.unshift(Array(W).fill(0));score+=100});score+=10;ss.textContent=score;render();if(score>=650){over=true;finish("BLOCK MASTER",`${score} POINTS`,true)}}
    $("#bd-left").onclick=()=>{col=(col+W-1)%W;render()};$("#bd-right").onclick=()=>{col=(col+1)%W;render()};$("#bd-drop").onclick=drop;render();
  }

  function finalPipe(item){
    const N=5;let rot=Array.from({length:N*N},()=>rand(4)),moves=0;
    const path=[];let x=0,y=0;while(x<N-1||y<N-1){path.push(y*N+x);if(x<N-1&&(y===N-1||Math.random()<.55))x++;else y++}path.push(N*N-1);
    const need={};for(let i=0;i<path.length-1;i++){const a=path[i],b=path[i+1],ax=a%N,ay=Math.floor(a/N),bx=b%N,by=Math.floor(b/N);need[a]=bx>ax?0:by>ay?1:bx<ax?2:3}need[path.at(-1)]=need[path.at(-2)]??0;
    els.stage.innerHTML=hud(`MOVE <b id="fp-move">0</b>`,`GOAL <b>🔌</b>`)+`<div class="g-center"><h3>🔧 ${item.title}</h3><p>経路上のパイプを出口方向へ回転</p><div id="fp-grid" class="number-grid" style="grid-template-columns:repeat(${N},48px)"></div><p id="fp-msg">START → GOAL</p></div>`;
    const g=$("#fp-grid"),mm=$("#fp-move");const arrows=["→","↓","←","↑"];
    function check(){return path.every(i=>rot[i]===need[i])}
    function render(){g.innerHTML=rot.map((r,i)=>`<button class="number-tile ${path.includes(i)?"":"disabled"}" data-i="${i}" type="button" style="font-size:24px">${path.includes(i)?arrows[r]:"·"}</button>`).join("")}
    g.onclick=e=>{const b=e.target.closest("[data-i]");if(!b)return;const i=+b.dataset.i;if(!path.includes(i))return;rot[i]=(rot[i]+1)%4;moves++;mm.textContent=moves;render();if(check())finish("PIPE CONNECTED",`${moves} moves`,true)};render();
  }

  function finalMerge(item){
    const N=4;let board=Array(N*N).fill(0),score=0,ended=false;function add(){const free=board.map((v,i)=>v?null:i).filter(v=>v!==null);if(free.length)board[free[rand(free.length)]]=Math.random()<.9?2:4}add();add();
    els.stage.innerHTML=hud(`SCORE <b id="mg-score">0</b>`,`GOAL <b>256</b>`)+`<div class="g-center"><h3>➕ ${item.title}</h3><p>同じ数字を合体。256を作る</p><div id="mg-grid" class="number-grid" style="grid-template-columns:repeat(4,58px)"></div><div class="dpad"><button class="up" data-d="u">↑</button><button class="left" data-d="l">←</button><button class="down" data-d="d">↓</button><button class="right" data-d="r">→</button></div></div>`;
    const g=$("#mg-grid"),ss=$("#mg-score");
    function line(arr){let a=arr.filter(Boolean);for(let i=0;i<a.length-1;i++)if(a[i]===a[i+1]){a[i]*=2;score+=a[i];a.splice(i+1,1)}while(a.length<N)a.push(0);return a}
    function move(d){if(ended)return;const before=board.join(","),next=Array(N*N).fill(0);for(let k=0;k<N;k++){let idx=[];if(d==="l"||d==="r")for(let x=0;x<N;x++)idx.push(k*N+(d==="l"?x:N-1-x));else for(let y=0;y<N;y++)idx.push((d==="u"?y:N-1-y)*N+k);const vals=line(idx.map(i=>board[i]));idx.forEach((i,j)=>next[i]=vals[j])}board=next;if(board.join(",")!==before)add();ss.textContent=score;render();if(board.some(v=>v>=256)){ended=true;finish("256!","MERGE CLEAR",true)}else if(board.every(Boolean)){ended=true;finish("NO SPACE",`${score} POINTS`,false)}}
    function render(){g.innerHTML=board.map(v=>`<div class="number-tile" style="display:grid;place-items:center;font-size:18px">${v||""}</div>`).join("")}
    els.stage.querySelectorAll("[data-d]").forEach(b=>b.onclick=()=>move(b.dataset.d));render();
  }

  function finalCare(item){
    let energy=55,happy=50,growth=0,turn=0;const goal=100+item.difficulty*20;const labels=item.index===97?["🍚 ごはん","🎾 あそぶ","💤 ねる"]:item.index===98?["🥩 えさ","⚔️ とっくん","✨ 進化"]:["🧭 仕事","❤️ 交流","📚 学ぶ"];
    els.stage.innerHTML=hud(`GROW <b id="care-grow">0</b>`,`ENERGY <b id="care-en">55</b>`)+`<div class="g-center"><h3>${iconFor(item)} ${item.title}</h3><p>状態を見ながら育成。成長 ${goal} でクリア</p><div class="big-total" id="care-face">🙂</div><div id="care-actions" class="g-button-row">${labels.map((x,i)=>`<button class="g-secondary" data-a="${i}">${x}</button>`).join("")}</div><p id="care-msg">HAPPY 50 · TURN 0/18</p></div>`;
    const gg=$("#care-grow"),ee=$("#care-en"),face=$("#care-face"),msg=$("#care-msg");
    els.stage.querySelectorAll("#care-actions button").forEach(b=>b.onclick=()=>{if(turn>=18)return;const a=+b.dataset.a;turn++;if(a===0){energy=Math.min(100,energy+25);happy=Math.min(100,happy+4);growth+=8}else if(a===1){if(energy<12){msg.textContent="ENERGY不足";return}energy-=12;happy=Math.min(100,happy+18);growth+=16+item.difficulty*2}else{energy=Math.max(0,energy-7);growth+=22;happy=Math.max(0,happy-4)}energy=Math.max(0,energy-3);gg.textContent=growth;ee.textContent=energy;face.textContent=happy>70?"😄":energy<20?"😴":happy<30?"😟":"🙂";msg.textContent=`HAPPY ${happy} · TURN ${turn}/18`;if(growth>=goal)finish("GROWTH COMPLETE",`成長 ${growth}`,true);else if(turn>=18)finish("育成終了",`成長 ${growth}/${goal}`,growth>=goal*.8)})
  }

  const oldMountCard = mountCardGame;
  mountCardGame = function(item){
    if(item.index>=58&&item.index<=60)return finalCardMath(item);
    if(item.index===92)return finalCardJanken(item);
    if(item.index===93||item.index===94)return finalCardMind(item);
    return oldMountCard(item);
  };

  function finalCardMath(item){
    let deck=makeDeck(),score=0,round=0,total=8+item.difficulty*2;
    els.stage.innerHTML=hud(`SCORE <b id="cm-score">0</b>`,`ROUND <b id="cm-round">1/${total}</b>`)+`<div class="g-center"><h3>🧮 ${item.title}</h3><div id="cm-hand" class="card-zone"></div><div id="cm-opts" class="g-button-row"></div><p id="cm-msg">答えを選ぶ</p></div>`;
    const hand=$("#cm-hand"),opts=$("#cm-opts"),ss=$("#cm-score"),rr=$("#cm-round"),msg=$("#cm-msg");
    function next(){if(round>=total){finish(score>=total*70?"MATH CARD WIN":"RESULT",`${score} POINTS`,score>=total*70);return}if(deck.length<10)deck=makeDeck();const a=deck.pop(),b=deck.pop();let answer,q;if(item.index===58){answer=a.r+b.r;q=`${a.r} + ${b.r} = ?`}else if(item.index===59){answer=[a.r,b.r].filter(v=>[2,3,5,7,11,13].includes(v)).length;q=`素数カードは何枚？`}else{answer=a.r*b.r;q=`${a.r} × ${b.r} = ?`}hand.innerHTML=chtml(a)+chtml(b);const choices=shuffle([answer,answer+1,Math.max(0,answer-1),answer+2+rand(4)]);opts.innerHTML=choices.map(v=>`<button class="g-secondary" data-v="${v}">${v}</button>`).join("");rr.textContent=`${round+1}/${total}`;msg.textContent=q;[...opts.querySelectorAll("button")].forEach(x=>x.onclick=()=>{const ok=+x.dataset.v===answer;if(ok)score+=100;ss.textContent=score;round++;msg.textContent=ok?"CORRECT":"MISS";setTimeout(next,240)})}next();
  }
  function finalCardJanken(item){let you=0,cpu=0,round=0;const names=["⚔️ ATTACK","🛡️ GUARD","✨ MAGIC"];els.stage.innerHTML=hud(`YOU <b id="cj-y">0</b>`,`CPU <b id="cj-c">0</b>`)+`<div class="g-center"><h3>🃏 ${item.title}</h3><p>ATTACK > MAGIC > GUARD > ATTACK</p><div id="cj-btns" class="action-cards">${names.map((n,i)=>`<button class="action-card" data-v="${i}"><b>${n}</b></button>`).join("")}</div><p id="cj-msg">BEST OF 9</p></div>`;const yy=$("#cj-y"),cc=$("#cj-c"),msg=$("#cj-msg");els.stage.querySelectorAll("#cj-btns button").forEach(b=>b.onclick=()=>{if(round>=9)return;const a=+b.dataset.v,c=rand(3);round++;if(a!==c){if((a-c+3)%3===1)you++;else cpu++}yy.textContent=you;cc.textContent=cpu;msg.textContent=`YOU ${names[a]} / CPU ${names[c]} · ${round}/9`;if(round>=9)setTimeout(()=>finish(you>=cpu?"MIND WIN":"CPU WIN",`${you}-${cpu}`,you>=cpu),300)})}
  function finalCardMind(item){let score=0,round=0,total=8,deadline=0;els.stage.innerHTML=hud(`SCORE <b id="mind-score">0</b>`,`ROUND <b id="mind-round">1/${total}</b>`)+`<div class="g-center"><h3>🎭 ${item.title}</h3><div id="mind-card" class="card-zone"></div><div id="mind-btns" class="g-button-row"><button class="g-secondary" data-v="0">SAFE</button><button class="g-primary" data-v="1">RISK</button></div><p id="mind-msg">5秒以内に選択</p></div>`;const zone=$("#mind-card"),ss=$("#mind-score"),rr=$("#mind-round"),msg=$("#mind-msg");function next(){if(round>=total){finish(score>=350?"PSYCHOLOGY WIN":"RESULT",`${score} POINTS`,score>=350);return}const c=makeDeck().pop();zone.innerHTML=chtml(c);deadline=performance.now()+(item.index===94?5000:3500);rr.textContent=`${round+1}/${total}`;msg.textContent=item.index===94?"5秒以内に選択":"CPUの裏を読め";msg.dataset.rank=c.r}[...els.stage.querySelectorAll("#mind-btns button")].forEach(b=>b.onclick=()=>{if(performance.now()>deadline){score=Math.max(0,score-30)}else{const risk=+b.dataset.v,rank=+msg.dataset.rank;score+=risk?(rank>=8?100:-40):40}ss.textContent=score;round++;next()});next()}

  const oldMountBoard = mountBoardGame;
  mountBoardGame = function(item){
    if(item.index>=85&&item.index<=87)return finalAuction(item);
    if(item.index>=92&&item.index<=96)return finalContest(item);
    if(item.index>=99)return finalRapidBoard(item);
    return oldMountBoard(item);
  };
  function finalAuction(item){let cash=100,you=0,cpu=0,round=0,total=8;els.stage.innerHTML=hud(`CASH <b id="auc-cash">100</b>`,`VALUE <b id="auc-value">0</b>`)+`<div class="g-center"><h3>🔨 ${item.title}</h3><p>価値を読み、CPUより高く買いすぎない</p><div class="big-total" id="auc-lot"></div><div class="g-button-row"><button class="g-secondary" data-b="0">PASS</button><button class="g-secondary" data-b="15">15</button><button class="g-primary" data-b="30">30</button><button class="g-primary" data-b="45">45</button></div><p id="auc-msg">ROUND 1/${total}</p></div>`;const ca=$("#auc-cash"),va=$("#auc-value"),lot=$("#auc-lot"),msg=$("#auc-msg");let value=0;function next(){if(round>=total){finish(you>=cpu?"AUCTION WIN":"CPU WIN",`資産価値 YOU ${you} - ${cpu} CPU`,you>=cpu);return}value=10+rand(55);lot.textContent=`推定価値 ${Math.max(5,value-10)}〜${value+10}`;msg.textContent=`ROUND ${round+1}/${total}`}[...els.stage.querySelectorAll("[data-b]")].forEach(b=>b.onclick=()=>{const bid=+b.dataset.b,cpuBid=[0,15,30,45][rand(4)];if(bid>cash){msg.textContent="資金不足";return}if(bid>cpuBid){cash-=bid;you+=value}else if(cpuBid>bid)cpu+=value;else if(bid>0&&Math.random()<.5){cash-=bid;you+=value}else cpu+=value;round++;ca.textContent=cash;va.textContent=you;next()});next()}
  function finalContest(item){let you=0,cpu=0,round=0,total=7+item.difficulty;const verbs={92:"COOK",93:"ROLL",94:"SERVE",95:"CAST",96:"CLIMB"};els.stage.innerHTML=hud(`YOU <b id="ct-y">0</b>`,`CPU <b id="ct-c">0</b>`)+`<div class="g-center"><h3>🏆 ${item.title}</h3><p>中央ゾーンを狙って ${verbs[item.index]}</p><div class="timing-meter"><div id="ct-needle" class="timing-needle"></div></div><button id="ct-go" class="g-primary" style="margin-top:24px">${verbs[item.index]}</button><p id="ct-msg">ROUND 1/${total}</p></div>`;let pos=0,dir=1,last=performance.now(),raf;const needle=$("#ct-needle"),yy=$("#ct-y"),cc=$("#ct-c"),msg=$("#ct-msg");function loop(now){const dt=Math.min(.04,(now-last)/1000);last=now;pos+=dir*dt*(70+item.difficulty*15);if(pos>=100){pos=100;dir=-1}if(pos<=0){pos=0;dir=1}needle.style.left=`calc(${pos}% - 3px)`;raf=requestAnimationFrame(loop)}raf=requestAnimationFrame(loop);onCleanup(()=>cancelAnimationFrame(raf));$("#ct-go").onclick=()=>{if(round>=total)return;const p=Math.max(0,100-Math.abs(50-pos)*3),c=35+rand(65);you+=Math.round(p);cpu+=c;round++;yy.textContent=you;cc.textContent=cpu;msg.textContent=`${p>c?"WIN ROUND":"CPU ROUND"} · ${round}/${total}`;if(round>=total)setTimeout(()=>finish(you>=cpu?"CONTEST WIN":"CPU WIN",`${you}-${cpu}`,you>=cpu),260)}}
  function finalRapidBoard(item){const N=6;let you=0,cpu=0,time=25,ended=false;els.stage.innerHTML=hud(`YOU <b id="rb-y">0</b>`,`TIME <b id="rb-t">25.0</b>`)+`<div class="g-center"><h3>⚡ ${item.title}</h3><p>空きマスを連続確保。隣接ボーナスあり</p><div id="rb-grid" class="territory-grid" style="grid-template-columns:repeat(${N},44px)"></div><p id="rb-msg">REAL TIME</p></div>`;const g=$("#rb-grid"),yy=$("#rb-y"),tt=$("#rb-t");let cells=Array.from({length:N*N},(_,i)=>{const b=document.createElement("button");b.className="territory-cell";b.dataset.i=i;g.appendChild(b);return b});function claim(i,who){const c=cells[i];if(c.dataset.owner)return false;c.dataset.owner=who;c.classList.add(who);if(who==="you"){you++;yy.textContent=you}else cpu++;return true}g.onclick=e=>{const b=e.target.closest("[data-i]");if(b&&!ended)claim(+b.dataset.i,"you")};const ai=setInterval(()=>{if(ended)return;const free=cells.map((c,i)=>c.dataset.owner?null:i).filter(v=>v!==null);if(free.length)claim(free[rand(free.length)],"cpu")},Math.max(260,650-item.difficulty*120));onCleanup(()=>clearInterval(ai));countdown(time,x=>tt.textContent=x.toFixed(1),()=>{ended=true;finish(you>=cpu?"RAPID WIN":"CPU WIN",`YOU ${you} - ${cpu} CPU`,you>=cpu)})}
})();