(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));
  const grid = $('#game-grid');
  const play = $('#play');
  const stage = $('#game-stage');
  const timeEl = $('#time-value');
  const scoreEl = $('#score-value');
  const bestEl = $('#best-value');
  const msgEl = $('#game-message');
  const titleEl = $('#play-title');
  const numberEl = $('#play-number');
  const backBtn = $('#back-btn');
  const restartBtn = $('#restart-btn');
  const ROUND_MS = 20000;
  let cleanup = () => {};
  let activeId = null;

  const games = [
    {id:'target', title:'ターゲットラッシュ', desc:'現れるターゲットを素早くタップ。反射神経で勝負。'},
    {id:'tap', title:'20秒連打', desc:'20秒間ひたすら連打。純粋なスピード勝負。'},
    {id:'numbers', title:'ナンバーハント', desc:'1から25まで順番に探してタップ。正確さと速さを競う。'},
    {id:'stroop', title:'カラー判断', desc:'文字の意味ではなく表示色を答える判断ゲーム。'},
    {id:'memory', title:'メモリーフラッシュ', desc:'光った順番を記憶して再現。成功するほど高得点。'},
    {id:'math', title:'計算ブリッツ', desc:'20秒で計算問題をどこまで解けるか。'},
    {id:'catch', title:'スターキャッチ', desc:'星を取って爆弾を避ける。ミスは減点。'},
    {id:'reaction', title:'リアクション', desc:'GOになった瞬間にタップ。反応速度で得点。'},
    {id:'typing', title:'タイピングスプリント', desc:'表示された英単語を20秒で何語入力できるか。'},
    {id:'higher', title:'HIGH or LOW', desc:'次の数字が高いか低いかを予想。連続正解で加点。'}
  ];

  const bestKey = id => `mini20-best-${id}`;
  const getBest = id => Number(localStorage.getItem(bestKey(id)) || 0);
  const setBest = (id, score) => {
    if (score > getBest(id)) localStorage.setItem(bestKey(id), String(score));
  };

  function renderCards() {
    grid.innerHTML = games.map((g, i) => `<article class="game-card">
      <span class="num">GAME ${String(i + 1).padStart(2, '0')}</span>
      <h3>${g.title}</h3>
      <p>${g.desc}</p>
      <div class="best">BEST: <strong data-best="${g.id}">${getBest(g.id)}</strong></div>
      <button type="button" data-play="${g.id}">1人でプレイ</button>
    </article>`).join('');
    $$('[data-play]', grid).forEach(btn => btn.addEventListener('click', () => openGame(btn.dataset.play)));
  }

  function refreshBest() {
    $$('[data-best]').forEach(el => { el.textContent = getBest(el.dataset.best); });
  }

  function openGame(id) {
    const game = games.find(g => g.id === id);
    if (!game) return;
    cleanup();
    cleanup = () => {};
    activeId = id;
    const idx = games.findIndex(g => g.id === id);
    titleEl.textContent = game.title;
    numberEl.textContent = `GAME ${String(idx + 1).padStart(2, '0')}`;
    scoreEl.textContent = '0';
    timeEl.textContent = '20.0';
    bestEl.textContent = getBest(id);
    msgEl.textContent = game.desc;
    play.classList.remove('hidden');
    play.scrollIntoView({behavior:'smooth', block:'start'});
    stage.innerHTML = `<div class="start-screen"><div class="start-box">
      <h3>${game.title}</h3><p>${game.desc}<br>制限時間は20秒です。</p>
      <button id="solo-start" class="big-action" type="button">20秒スタート</button>
    </div></div>`;
    $('#solo-start', stage).addEventListener('click', () => startCountdown(id), {once:true});
  }

  function startCountdown(id) {
    let n = 3;
    stage.innerHTML = `<div class="start-screen"><div class="countdown-number">${n}</div></div>`;
    const timer = setInterval(() => {
      n--;
      if (n <= 0) {
        clearInterval(timer);
        runners[id]();
      } else {
        $('.countdown-number', stage).textContent = n;
      }
    }, 500);
    cleanup = () => clearInterval(timer);
  }

  function makeTimer(onEnd) {
    const end = performance.now() + ROUND_MS;
    let raf = 0;
    let stopped = false;
    const loop = () => {
      if (stopped) return;
      const left = Math.max(0, end - performance.now());
      timeEl.textContent = (left / 1000).toFixed(1);
      if (left <= 0) {
        stopped = true;
        onEnd();
        return;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => { stopped = true; cancelAnimationFrame(raf); };
  }

  function setScore(score) {
    scoreEl.textContent = String(Math.max(0, Number(score) || 0));
  }

  function finish(score, extra = '') {
    const id = activeId;
    if (!id) return;
    const safe = Math.max(0, Number(score) || 0);
    setBest(id, safe);
    refreshBest();
    bestEl.textContent = getBest(id);
    timeEl.textContent = '0.0';
    stage.innerHTML = `<div class="end-screen"><div class="end-box">
      <h3>FINISH!</h3>
      <p>スコア <strong>${safe}</strong>${extra ? `<br>${extra}` : ''}<br>BEST ${getBest(id)}</p>
      <button id="again-btn" class="big-action" type="button">もう一回</button>
    </div></div>`;
    $('#again-btn', stage).addEventListener('click', () => openGame(id), {once:true});
  }

  const runners = {
    target() {
      stage.innerHTML = '';
      let score = 0, combo = 0, bestCombo = 0;
      const target = document.createElement('button');
      target.className = 'target'; target.type = 'button'; target.textContent = '+1';
      stage.appendChild(target);
      const place = () => {
        const maxX = Math.max(0, stage.clientWidth - 84);
        const maxY = Math.max(0, stage.clientHeight - 84);
        target.style.left = `${8 + Math.random() * maxX}px`;
        target.style.top = `${8 + Math.random() * maxY}px`;
      };
      const hit = e => { e.stopPropagation(); combo++; bestCombo = Math.max(bestCombo, combo); score += 1 + (combo % 5 === 0 ? 2 : 0); setScore(score); place(); };
      const miss = e => { if (e.target !== target) combo = 0; };
      target.addEventListener('pointerdown', hit);
      stage.addEventListener('pointerdown', miss);
      place();
      const mover = setInterval(place, 850);
      const stop = makeTimer(() => { clearInterval(mover); finish(score, `最大コンボ ${bestCombo}`); });
      cleanup = () => { clearInterval(mover); stop(); stage.removeEventListener('pointerdown', miss); };
    },

    tap() {
      let score = 0;
      stage.innerHTML = '<div class="tap-wrap"><button class="tap-button" type="button">TAP!</button></div>';
      const btn = $('.tap-button', stage);
      btn.addEventListener('pointerdown', () => { score++; setScore(score); btn.style.transform='scale(.965)'; setTimeout(() => btn.style.transform='', 45); });
      const stop = makeTimer(() => finish(score));
      cleanup = stop;
    },

    numbers() {
      let score = 0, next = 1, rounds = 0, alive = true;
      const draw = () => {
        const nums = Array.from({length:25}, (_,i)=>i+1).sort(()=>Math.random()-.5);
        stage.innerHTML = `<div class="number-grid">${nums.map(n=>`<button type="button" data-n="${n}">${n}</button>`).join('')}</div>`;
        $$('[data-n]', stage).forEach(btn => btn.addEventListener('click', () => {
          if (!alive) return;
          if (Number(btn.dataset.n) === next) {
            btn.classList.add('done'); score++; next++; setScore(score);
            if (next === 26) { rounds++; next = 1; draw(); }
          } else { score = Math.max(0, score - 1); setScore(score); }
        }));
      };
      draw();
      const stop = makeTimer(() => { alive = false; finish(score, `${rounds}周クリア`); });
      cleanup = () => { alive = false; stop(); };
    },

    stroop() {
      const defs = [['赤','#f87171'],['青','#60a5fa'],['緑','#4ade80'],['黄','#facc15']];
      let score = 0, alive = true;
      const next = () => {
        if (!alive) return;
        const ink = defs[Math.floor(Math.random()*defs.length)];
        const word = defs[Math.floor(Math.random()*defs.length)];
        stage.innerHTML = `<div class="center-game"><div><div class="prompt" style="color:${ink[1]}">${word[0]}</div><div class="subprompt">表示色は？</div><div class="choices">${defs.map(d=>`<button class="choice-btn" type="button" data-c="${d[0]}">${d[0]}</button>`).join('')}</div></div></div>`;
        $$('[data-c]', stage).forEach(btn => btn.addEventListener('click', () => { score += btn.dataset.c === ink[0] ? 1 : -1; score = Math.max(0,score); setScore(score); next(); }));
      };
      next();
      const stop = makeTimer(() => { alive = false; finish(score); });
      cleanup = () => { alive = false; stop(); };
    },

    memory() {
      let score = 0, sequence = [], input = [], locked = true, round = 0, alive = true;
      const timers = new Set();
      stage.innerHTML = '<div class="center-game"><div><div id="mem-status" class="subprompt">準備中…</div><div class="memory-board"></div></div></div>';
      const board = $('.memory-board', stage), status = $('#mem-status', stage);
      for (let i=0;i<9;i++) { const b=document.createElement('button'); b.className='memory-tile'; b.type='button'; b.dataset.i=i; board.appendChild(b); }
      const wait = ms => new Promise(resolve => { const id=setTimeout(()=>{timers.delete(id);resolve();},ms); timers.add(id); });
      const flash = async () => {
        if (!alive) return;
        locked = true; input = []; sequence.push(Math.floor(Math.random()*9)); round++; status.textContent=`ROUND ${round} 覚えて…`;
        for (const n of sequence) { if(!alive)return; await wait(180); if(!alive)return; board.children[n].classList.add('lit'); await wait(230); board.children[n].classList.remove('lit'); }
        if (alive) { locked=false; status.textContent='同じ順番でタップ'; }
      };
      board.addEventListener('click', e => {
        const b=e.target.closest('.memory-tile'); if(!b||locked||!alive)return;
        const n=Number(b.dataset.i), pos=input.length; input.push(n);
        if(n!==sequence[pos]) { score=Math.max(0,score-2); setScore(score); sequence=[]; round=0; locked=true; const id=setTimeout(()=>{timers.delete(id);flash();},280); timers.add(id); return; }
        if(input.length===sequence.length) { score+=sequence.length; setScore(score); locked=true; const id=setTimeout(()=>{timers.delete(id);flash();},300); timers.add(id); }
      });
      flash();
      const stop=makeTimer(()=>{alive=false;timers.forEach(clearTimeout);finish(score,`到達ラウンド ${round}`);});
      cleanup=()=>{alive=false;timers.forEach(clearTimeout);stop();};
    },

    math() {
      let score=0, alive=true;
      const next=()=>{
        if(!alive)return;
        const a=1+Math.floor(Math.random()*20), b=1+Math.floor(Math.random()*20), plus=Math.random()<.65, ans=plus?a+b:a-b;
        const opts=[ans]; while(opts.length<4){const x=ans+Math.floor(Math.random()*13)-6;if(!opts.includes(x))opts.push(x);} opts.sort(()=>Math.random()-.5);
        stage.innerHTML=`<div class="center-game"><div><div class="prompt">${a} ${plus?'+':'−'} ${b}</div><div class="choices">${opts.map(x=>`<button class="choice-btn" type="button" data-a="${x}">${x}</button>`).join('')}</div></div></div>`;
        $$('[data-a]',stage).forEach(btn=>btn.addEventListener('click',()=>{score += Number(btn.dataset.a)===ans?1:-1;score=Math.max(0,score);setScore(score);next();}));
      };
      next(); const stop=makeTimer(()=>{alive=false;finish(score);}); cleanup=()=>{alive=false;stop();};
    },

    catch() {
      let score=0, alive=true; const rafs=new Set(); stage.innerHTML='';
      const spawn=()=>{
        if(!alive)return;
        const good=Math.random()>.25, b=document.createElement('button'); b.type='button'; b.className=`fall-item ${good?'fall-good':'fall-bad'}`; b.textContent=good?'★':'💣'; b.style.left=`${Math.random()*Math.max(1,stage.clientWidth-60)+3}px`; b.style.top='-58px'; stage.appendChild(b);
        const duration=1300+Math.random()*850,start=performance.now(); let raf=0;
        const animate=t=>{const p=Math.min(1,(t-start)/duration);b.style.top=`${-58+p*(stage.clientHeight+70)}px`;if(p<1&&b.isConnected&&alive){raf=requestAnimationFrame(animate);rafs.add(raf);}else b.remove();};
        raf=requestAnimationFrame(animate);rafs.add(raf);
        b.addEventListener('pointerdown',e=>{e.stopPropagation();cancelAnimationFrame(raf);score+=good?1:-3;score=Math.max(0,score);setScore(score);b.remove();});
      };
      const spawner=setInterval(spawn,360);spawn();
      const stop=makeTimer(()=>{alive=false;clearInterval(spawner);rafs.forEach(cancelAnimationFrame);finish(score);});
      cleanup=()=>{alive=false;clearInterval(spawner);rafs.forEach(cancelAnimationFrame);stop();};
    },

    reaction() {
      let score=0,rounds=0,total=0,state='waiting',goAt=0,timeout=0,alive=true;
      stage.innerHTML='<div class="center-game"><div class="reaction-pad reaction-wait">WAIT…</div></div>'; const pad=$('.reaction-pad',stage);
      const schedule=()=>{if(!alive)return;state='waiting';pad.className='reaction-pad reaction-wait';pad.textContent='WAIT…';timeout=setTimeout(()=>{if(!alive)return;state='go';goAt=performance.now();pad.className='reaction-pad reaction-go';pad.textContent='GO!';},650+Math.random()*1500);};
      pad.addEventListener('pointerdown',()=>{if(!alive)return;if(state==='waiting'){score=Math.max(0,score-2);setScore(score);clearTimeout(timeout);pad.textContent='TOO EARLY';state='cooldown';timeout=setTimeout(schedule,350);}else if(state==='go'){const ms=Math.round(performance.now()-goAt);rounds++;total+=ms;score+=Math.max(1,Math.round((700-ms)/50));setScore(score);state='cooldown';pad.textContent=`${ms} ms`;timeout=setTimeout(schedule,380);}});
      schedule();
      const stop=makeTimer(()=>{alive=false;clearTimeout(timeout);finish(score,rounds?`平均 ${Math.round(total/rounds)} ms / ${rounds}回`:'記録なし');});
      cleanup=()=>{alive=false;clearTimeout(timeout);stop();};
    },

    typing() {
      const words=['apple','river','space','light','green','music','dream','quick','tiger','ocean','stone','happy','cloud','night','power','game','mouse','train','glass','world','magic','brave','smart','speed'];
      let score=0,current='',alive=true;
      stage.innerHTML='<div class="center-game"><div><div id="type-word" class="prompt"></div><div class="subprompt">入力して Enter</div><div style="margin-top:20px"><input id="type-input" class="typing-input" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="英単語入力"></div></div></div>';
      const input=$('#type-input',stage), wordEl=$('#type-word',stage);
      const next=()=>{current=words[Math.floor(Math.random()*words.length)];wordEl.textContent=current;input.value='';input.focus();};
      input.addEventListener('keydown',e=>{if(e.key!=='Enter'||!alive)return;e.preventDefault();if(input.value.trim().toLowerCase()===current)score++;else score=Math.max(0,score-1);setScore(score);next();});
      next(); const stop=makeTimer(()=>{alive=false;input.blur();finish(score);}); cleanup=()=>{alive=false;stop();};
    },

    higher() {
      let score=0,streak=0,current=1+Math.floor(Math.random()*13),alive=true;
      const nextRound=()=>{
        if(!alive)return;
        stage.innerHTML=`<div class="center-game"><div><div class="higher-number">${current}</div><div class="subprompt">次の数字は？（1〜13）</div><div class="choices"><button class="choice-btn" type="button" data-h="high">HIGH</button><button class="choice-btn" type="button" data-h="low">LOW</button></div></div></div>`;
        $$('[data-h]',stage).forEach(btn=>btn.addEventListener('click',()=>{let next=1+Math.floor(Math.random()*13);while(next===current)next=1+Math.floor(Math.random()*13);const correct=btn.dataset.h===(next>current?'high':'low');if(correct){streak++;score+=1+Math.floor(streak/4);}else{streak=0;score=Math.max(0,score-1);}current=next;setScore(score);nextRound();}));
      };
      nextRound(); const stop=makeTimer(()=>{alive=false;finish(score,`最終連勝 ${streak}`);}); cleanup=()=>{alive=false;stop();};
    }
  };

  backBtn.addEventListener('click',()=>{cleanup();cleanup=()=>{};activeId=null;play.classList.add('hidden');$('#games').scrollIntoView({behavior:'smooth',block:'start'});});
  restartBtn.addEventListener('click',()=>{if(activeId)openGame(activeId);});
  renderCards();
})();
