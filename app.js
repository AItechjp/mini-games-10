(() => {
  const $ = (s, root=document) => root.querySelector(s);
  const grid = $('#game-grid');
  const play = $('#play');
  const stage = $('#game-stage');
  const timeEl = $('#time-value');
  const scoreEl = $('#score-value');
  const bestEl = $('#best-value');
  const msgEl = $('#game-message');
  const titleEl = $('#play-title');
  const numberEl = $('#play-number');
  let cleanup = () => {};
  let activeId = null;

  const games = [
    {id:'target', title:'ターゲットラッシュ', desc:'次々に現れるターゲットをタップ。反射神経で勝負。'},
    {id:'tap', title:'60秒連打', desc:'ひたすらボタンを連打。シンプルだからこそ熱い。'},
    {id:'numbers', title:'ナンバーハント', desc:'1から25まで順番に探してタップ。何周できる？'},
    {id:'stroop', title:'カラー判断', desc:'文字の意味ではなく、表示されている色を答える判断ゲーム。'},
    {id:'memory', title:'メモリーフラッシュ', desc:'光った順番を覚えて再現。成功するほど長くなる。'},
    {id:'math', title:'計算ブリッツ', desc:'四則演算を高速で解く。正解数を伸ばそう。'},
    {id:'catch', title:'スターキャッチ', desc:'星をタップ、爆弾は避ける。ミスは減点。'},
    {id:'reaction', title:'リアクション', desc:'GOになった瞬間にタップ。平均反応速度でスコアを稼ぐ。'},
    {id:'typing', title:'タイピングスプリント', desc:'表示された英単語を60秒で何語打てるか挑戦。'},
    {id:'higher', title:'HIGH or LOW', desc:'次の数字が高いか低いか予想。連続正解でボーナス。'}
  ];

  const bestKey = id => `mini60-best-${id}`;
  const getBest = id => Number(localStorage.getItem(bestKey(id)) || 0);
  const setBest = (id, score) => { if (score > getBest(id)) localStorage.setItem(bestKey(id), String(score)); };

  function renderCards(){
    grid.innerHTML = games.map((g,i)=>`<article class="game-card"><span class="num">GAME ${String(i+1).padStart(2,'0')}</span><h3>${g.title}</h3><p>${g.desc}</p><div class="best">BEST: <strong data-best="${g.id}">${getBest(g.id)}</strong></div><button type="button" data-play="${g.id}">プレイする</button></article>`).join('');
    grid.querySelectorAll('[data-play]').forEach(b=>b.addEventListener('click',()=>openGame(b.dataset.play)));
  }

  function updateBestDisplays(){
    document.querySelectorAll('[data-best]').forEach(el=>el.textContent=getBest(el.dataset.best));
  }

  function openGame(id){
    cleanup(); cleanup=()=>{}; activeId=id;
    const idx=games.findIndex(g=>g.id===id), g=games[idx];
    titleEl.textContent=g.title; numberEl.textContent=`GAME ${String(idx+1).padStart(2,'0')}`;
    scoreEl.textContent='0'; timeEl.textContent='60.0'; bestEl.textContent=getBest(id); msgEl.textContent=g.desc;
    play.classList.remove('hidden');
    play.scrollIntoView({behavior:'smooth', block:'start'});
    runners[id]();
  }

  function startOverlay(title, text, onStart){
    stage.innerHTML=`<div class="start-screen"><div class="start-box"><h3>${title}</h3><p>${text}</p><button class="big-action" type="button">60秒スタート</button></div></div>`;
    $('.big-action',stage).addEventListener('click',onStart,{once:true});
  }

  function makeTimer(onTick,onEnd,duration=60000){
    const end=performance.now()+duration;
    let raf=0, stopped=false;
    const loop=()=>{ if(stopped)return; const left=Math.max(0,end-performance.now()); timeEl.textContent=(left/1000).toFixed(1); onTick?.(left); if(left<=0){stopped=true;onEnd();return;} raf=requestAnimationFrame(loop);};
    raf=requestAnimationFrame(loop);
    return ()=>{stopped=true;cancelAnimationFrame(raf)};
  }

  function finish(id, score, extra=''){
    setBest(id,score); bestEl.textContent=getBest(id); updateBestDisplays();
    stage.innerHTML=`<div class="end-screen"><div class="end-box"><h3>FINISH!</h3><p>スコア <strong>${score}</strong>${extra?`<br>${extra}`:''}</p><button class="big-action" type="button">もう一回</button></div></div>`;
    $('.big-action',stage).addEventListener('click',()=>openGame(id),{once:true});
  }

  const runners = {
    target(){
      startOverlay('ターゲットラッシュ','出現する丸をタップ。空振りはコンボリセット。',()=>{
        stage.innerHTML=''; let score=0, combo=0, moveTimer=0;
        const target=document.createElement('button'); target.className='target'; target.textContent='+1'; stage.appendChild(target);
        const place=()=>{const maxX=Math.max(0,stage.clientWidth-76),maxY=Math.max(0,stage.clientHeight-76);target.style.left=(8+Math.random()*maxX)+'px';target.style.top=(8+Math.random()*maxY)+'px';};
        const hit=e=>{e.stopPropagation();combo++;score+=1+(combo%5===0?2:0);scoreEl.textContent=score;place();}; target.addEventListener('pointerdown',hit);
        const miss=e=>{if(e.target!==target)combo=0}; stage.addEventListener('pointerdown',miss); place(); moveTimer=setInterval(place,900);
        const stop=makeTimer(null,()=>{clearInterval(moveTimer);finish('target',score,`最大コンボ ${combo}`)}); cleanup=()=>{stop();clearInterval(moveTimer)};
      });
    },
    tap(){
      startOverlay('60秒連打','中央のボタンをできるだけ多く押してください。',()=>{
        let score=0; stage.innerHTML='<div class="tap-wrap"><button class="tap-button" type="button">TAP!</button></div>'; const b=$('.tap-button',stage);
        b.addEventListener('pointerdown',()=>{score++;scoreEl.textContent=score;b.style.transform='scale(.97)';setTimeout(()=>b.style.transform='',50)});
        const stop=makeTimer(null,()=>finish('tap',score)); cleanup=stop;
      });
    },
    numbers(){
      startOverlay('ナンバーハント','1→25の順番でタップ。25まで行くとシャッフルして次の周へ。',()=>{
        let score=0,next=1,round=1; const draw=()=>{let nums=Array.from({length:25},(_,i)=>i+1).sort(()=>Math.random()-.5);stage.innerHTML='<div class="number-grid">'+nums.map(n=>`<button type="button" data-n="${n}">${n}</button>`).join('')+'</div>';stage.querySelectorAll('[data-n]').forEach(b=>b.addEventListener('click',()=>{if(Number(b.dataset.n)===next){b.classList.add('done');score++;next++;scoreEl.textContent=score;if(next===26){round++;next=1;draw();}}else{score=Math.max(0,score-1);scoreEl.textContent=score;}}));}; draw();
        const stop=makeTimer(null,()=>finish('numbers',score,`${round-1}周クリア`)); cleanup=stop;
      });
    },
    stroop(){
      startOverlay('カラー判断','大きな文字が「何色で表示されているか」を答えてください。',()=>{
        const defs=[['赤','#f87171'],['青','#60a5fa'],['緑','#4ade80'],['黄','#facc15']]; let score=0;
        const next=()=>{const ink=defs[Math.floor(Math.random()*4)],word=defs[Math.floor(Math.random()*4)];stage.innerHTML=`<div class="center-game"><div><div class="prompt" style="color:${ink[1]}">${word[0]}</div><div class="subprompt">表示色は？</div><div class="choices">${defs.map(d=>`<button class="choice-btn" type="button" data-c="${d[0]}">${d[0]}</button>`).join('')}</div></div></div>`;stage.querySelectorAll('[data-c]').forEach(b=>b.addEventListener('click',()=>{score += b.dataset.c===ink[0]?1:-1; score=Math.max(0,score);scoreEl.textContent=score;next();}));};next();
        const stop=makeTimer(null,()=>finish('stroop',score)); cleanup=stop;
      });
    },
    memory(){
      startOverlay('メモリーフラッシュ','光る順番を覚えて同じ順番でタップ。',()=>{
        let score=0,seq=[],input=[],locked=true,round=0,alive=true; stage.innerHTML='<div class="center-game"><div><div id="mem-status" class="subprompt">準備中…</div><div class="memory-board"></div></div></div>';const board=$('.memory-board',stage),status=$('#mem-status',stage); for(let i=0;i<9;i++){const b=document.createElement('button');b.className='memory-tile';b.type='button';b.dataset.i=i;board.appendChild(b)}
        const flash=async()=>{locked=true;input=[];seq.push(Math.floor(Math.random()*9));status.textContent=`ROUND ${++round} 覚えて…`;for(const n of seq){if(!alive)return;await new Promise(r=>setTimeout(r,260));const b=board.children[n];b.classList.add('lit');await new Promise(r=>setTimeout(r,300));b.classList.remove('lit')}if(alive){locked=false;status.textContent='同じ順番でタップ';}};
        board.addEventListener('click',e=>{const b=e.target.closest('.memory-tile');if(!b||locked)return;const n=Number(b.dataset.i),pos=input.length;input.push(n);if(n!==seq[pos]){score=Math.max(0,score-2);scoreEl.textContent=score;seq=[];round=0;locked=true;setTimeout(flash,400);return;} if(input.length===seq.length){score+=seq.length;scoreEl.textContent=score;locked=true;setTimeout(flash,450)}}); flash();
        const stop=makeTimer(null,()=>{alive=false;finish('memory',score,`到達ラウンド ${round}`)}); cleanup=()=>{alive=false;stop()};
      });
    },
    math(){
      startOverlay('計算ブリッツ','表示された計算の答えを選択してください。',()=>{
        let score=0; const next=()=>{const a=1+Math.floor(Math.random()*20),b=1+Math.floor(Math.random()*20),plus=Math.random()<.65,ans=plus?a+b:a-b;let opts=[ans];while(opts.length<4){const x=ans+(Math.floor(Math.random()*13)-6);if(!opts.includes(x))opts.push(x)}opts.sort(()=>Math.random()-.5);stage.innerHTML=`<div class="center-game"><div><div class="prompt">${a} ${plus?'+':'−'} ${b}</div><div class="choices">${opts.map(x=>`<button class="choice-btn" data-a="${x}" type="button">${x}</button>`).join('')}</div></div></div>`;stage.querySelectorAll('[data-a]').forEach(btn=>btn.addEventListener('click',()=>{score += Number(btn.dataset.a)===ans?1:-1;score=Math.max(0,score);scoreEl.textContent=score;next();}));};next(); const stop=makeTimer(null,()=>finish('math',score));cleanup=stop;
      });
    },
    catch(){
      startOverlay('スターキャッチ','★は+1点、💣は-3点。落ちる前にタップ。',()=>{
        let score=0,spawner=0,alive=true;stage.innerHTML='';const spawn=()=>{if(!alive)return;const good=Math.random()>.25,b=document.createElement('button');b.type='button';b.className=`fall-item ${good?'fall-good':'fall-bad'}`;b.textContent=good?'★':'💣';b.style.left=(Math.random()*Math.max(1,stage.clientWidth-60)+3)+'px';b.style.top='-58px';stage.appendChild(b);const dur=1600+Math.random()*900,start=performance.now();let raf=0;const anim=t=>{const p=Math.min(1,(t-start)/dur);b.style.top=(-58+p*(stage.clientHeight+70))+'px';if(p<1&&b.isConnected&&alive)raf=requestAnimationFrame(anim);else b.remove()};raf=requestAnimationFrame(anim);b.addEventListener('pointerdown',e=>{e.stopPropagation();cancelAnimationFrame(raf);score += good?1:-3;score=Math.max(0,score);scoreEl.textContent=score;b.remove()});};spawner=setInterval(spawn,420);spawn();const stop=makeTimer(null,()=>{alive=false;clearInterval(spawner);finish('catch',score)});cleanup=()=>{alive=false;clearInterval(spawner);stop()};
      });
    },
    reaction(){
      startOverlay('リアクション','灰色の間は待つ。緑になった瞬間にタップ。フライングは減点。',()=>{
        let score=0,rounds=0,total=0,state='waiting',goAt=0,timeout=0,alive=true;stage.innerHTML='<div class="center-game"><div class="reaction-pad reaction-wait">WAIT…</div></div>';const pad=$('.reaction-pad',stage);
        const schedule=()=>{if(!alive)return;state='waiting';pad.className='reaction-pad reaction-wait';pad.textContent='WAIT…';timeout=setTimeout(()=>{if(!alive)return;state='go';goAt=performance.now();pad.className='reaction-pad reaction-go';pad.textContent='GO!';},1000+Math.random()*2500)};pad.addEventListener('pointerdown',()=>{if(state==='waiting'){score=Math.max(0,score-2);scoreEl.textContent=score;clearTimeout(timeout);pad.textContent='TOO EARLY';setTimeout(schedule,500)}else if(state==='go'){const ms=Math.round(performance.now()-goAt);rounds++;total+=ms;score+=Math.max(1,Math.round((700-ms)/50));scoreEl.textContent=score;state='done';pad.textContent=`${ms} ms`;setTimeout(schedule,600)}});schedule();const stop=makeTimer(null,()=>{alive=false;clearTimeout(timeout);finish('reaction',score,rounds?`平均 ${Math.round(total/rounds)} ms / ${rounds}回`:'記録なし')});cleanup=()=>{alive=false;clearTimeout(timeout);stop()};
      });
    },
    typing(){
      startOverlay('タイピングスプリント','表示された英単語を入力してEnter。スマホでも遊べます。',()=>{
        const words=['apple','river','space','light','green','music','dream','quick','tiger','ocean','stone','happy','cloud','night','power','game','mouse','train','glass','world','magic','brave','smart','speed'];let score=0,current='';const next=()=>{current=words[Math.floor(Math.random()*words.length)];$('#type-word',stage).textContent=current;const inp=$('#type-input',stage);inp.value='';inp.focus()};stage.innerHTML='<div class="center-game"><div><div id="type-word" class="prompt"></div><div class="subprompt">入力して Enter</div><div style="margin-top:20px"><input id="type-input" class="typing-input" autocomplete="off" autocapitalize="none" spellcheck="false" aria-label="英単語入力"></div></div></div>';const inp=$('#type-input',stage);inp.addEventListener('keydown',e=>{if(e.key==='Enter'){if(inp.value.trim().toLowerCase()===current){score++;scoreEl.textContent=score;next()}else{score=Math.max(0,score-1);scoreEl.textContent=score;inp.select()}}});next();const stop=makeTimer(null,()=>finish('typing',score,`${score} words / min`));cleanup=stop;
      });
    },
    higher(){
      startOverlay('HIGH or LOW','次の数字（1〜99）が今より高いか低いか予想。',()=>{
        let current=1+Math.floor(Math.random()*99),score=0,streak=0;const draw=()=>{stage.innerHTML=`<div class="center-game"><div><div class="higher-number">${current}</div><div class="subprompt">次の数字は？</div><div class="choices"><button class="choice-btn" data-hl="low" type="button">LOW</button><button class="choice-btn" data-hl="high" type="button">HIGH</button></div></div></div>`;stage.querySelectorAll('[data-hl]').forEach(b=>b.addEventListener('click',()=>{let next=1+Math.floor(Math.random()*99);while(next===current)next=1+Math.floor(Math.random()*99);const correct=(b.dataset.hl==='high'&&next>current)||(b.dataset.hl==='low'&&next<current);if(correct){streak++;score+=1+(streak%5===0?2:0)}else{streak=0;score=Math.max(0,score-1)}current=next;scoreEl.textContent=score;draw();}));};draw();const stop=makeTimer(null,()=>finish('higher',score,`最終ストリーク ${streak}`));cleanup=stop;
      });
    }
  };

  $('#back-btn').addEventListener('click',()=>{cleanup();cleanup=()=>{};play.classList.add('hidden');document.querySelector('#games').scrollIntoView({behavior:'smooth'});});
  $('#restart-btn').addEventListener('click',()=>{if(activeId)openGame(activeId)});
  renderCards();
})();
