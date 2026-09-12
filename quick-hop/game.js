(()=>{
  'use strict';
  const {Game,platforms,coins,goal}=window.QuickHopRules;
  const $=id=>document.getElementById(id),canvas=$('game'),ctx=canvas.getContext('2d');
  let game=new Game(),last=0,acc=0,noticeUntil=0,frameTime=0,best=0,sound=false,audio;
  const keys=new Set(),pointers=new Map(),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  try{best=Number(localStorage.getItem('aitech-quickhop-best'))||0;}catch{}
  if(best)$('best').textContent=`自己ベスト ${best.toFixed(1)} 秒`;
  function clearInput(){keys.clear();pointers.clear();document.querySelectorAll('[data-control]').forEach(b=>b.classList.remove('held'));}
  function tone(freq,duration=.09){if(!sound)return;try{audio=audio||new (window.AudioContext||window.webkitAudioContext)();audio.resume().catch(()=>{});const o=audio.createOscillator(),v=audio.createGain();o.type='sine';o.frequency.setValueAtTime(freq,audio.currentTime);v.gain.setValueAtTime(.06,audio.currentTime);v.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(v);v.connect(audio.destination);o.start();o.stop(audio.currentTime+duration);}catch{}}
  function start(){if(game.state==='paused'){game.state='playing';}else{game=new Game();game.state='playing';}$('overlay').hidden=true;$('pause').disabled=false;$('pause').textContent='一時停止';clearInput();acc=0;last=performance.now();canvas.focus({preventScroll:true});tone(660);}
  function pause(){if(game.state==='playing'){game.state='paused';clearInput();show('ひと休み。','続きは、いつでも。','つづける','PAUSED');$('pause').textContent='再開';}else if(game.state==='paused')start();}
  function show(title,message,button,tag){$('title').textContent=title;$('message').textContent=message;$('start').textContent=button;$('tag').textContent=tag;$('overlay').hidden=false;}
  function notify(text){$('notice').textContent=text;$('notice').classList.add('show');noticeUntil=performance.now()+2200;}
  function win(){if(!best||game.time<best){best=game.time;try{localStorage.setItem('aitech-quickhop-best',String(best));}catch{}}$('best').textContent=`自己ベスト ${best.toFixed(1)} 秒`;$('pause').disabled=true;show('ゴール、おめでとう！',`${game.time.toFixed(1)} 秒 / コイン ${game.taken.size} / 22 枚 / 落下 ${game.falls} 回`,'もう一度跳ぶ','COURSE CLEAR');clearInput();$('start').focus({preventScroll:true});}
  $('start').addEventListener('click',start);$('restart').addEventListener('click',()=>{game.state='title';start();});$('pause').addEventListener('click',pause);
  $('sound').addEventListener('click',()=>{sound=!sound;$('sound').textContent=`音：${sound?'オン':'オフ'}`;$('sound').setAttribute('aria-pressed',String(sound));if(sound)tone(880);});
  const allowed=new Set(['ArrowLeft','ArrowRight','ArrowUp','KeyA','KeyD','KeyW','Space']);
  window.addEventListener('keydown',e=>{if(e.ctrlKey||e.metaKey||e.altKey)return;if(allowed.has(e.code)&&game.state==='playing'){e.preventDefault();keys.add(e.code);}if(e.repeat)return;if(e.code==='KeyP'||e.code==='Escape'){e.preventDefault();pause();}if(e.code==='KeyR'){game.state='title';start();}if(e.code==='Enter'&&e.target===canvas&&game.state!=='playing')start();});
  window.addEventListener('keyup',e=>keys.delete(e.code));window.addEventListener('blur',()=>{clearInput();if(game.state==='playing')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden){clearInput();if(game.state==='playing')pause();}});
  document.querySelectorAll('[data-control]').forEach(b=>{
    b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);pointers.set(e.pointerId,b.dataset.control);b.classList.add('held');});
    const release=e=>{pointers.delete(e.pointerId);if(![...pointers.values()].includes(b.dataset.control))b.classList.remove('held');};
    b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('lostpointercapture',release);
    b.addEventListener('contextmenu',e=>e.preventDefault());
  });
  function input(){const p=[...pointers.values()];return [Number(keys.has('KeyD')||keys.has('ArrowRight')||p.includes('right'))-Number(keys.has('KeyA')||keys.has('ArrowLeft')||p.includes('left')),keys.has('Space')||keys.has('KeyW')||keys.has('ArrowUp')||p.includes('jump')];}
  function rect(x,y,w,h,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),Math.ceil(w),Math.ceil(h));}
  function cat(x,y){ctx.save();ctx.translate(Math.round(x),Math.round(y));ctx.scale(game.facing*2,2);const bob=game.grounded&&Math.abs(game.vx)>30&&!reduced?Math.sin(frameTime*16):0;ctx.translate(-10,-24+bob);rect(2,5,16,17,'#253343');rect(3,6,14,14,'#f8b16f');rect(2,1,5,8,'#253343');rect(13,1,5,8,'#253343');rect(3,3,3,5,'#f8b16f');rect(14,3,3,5,'#f8b16f');rect(5,9,3,4,'#253343');rect(13,9,3,4,'#253343');rect(7,15,7,3,'#ffe8b3');rect(3,21,5,3,'#253343');rect(12,21,5,3,'#253343');rect(0,17,4,3,'#f8b16f');rect(2,19,16,2,'#a8dcb6');ctx.restore();}
  function draw(){
    const cam=Math.max(0,Math.min(goal-680,game.x-260)),floor=420;
    rect(0,0,960,540,'#284d58');
    for(let i=0;i<15;i++){
      const x=((i*170-cam*.18)%1200+1200)%1200-180,h=130+(i%4)*38;
      rect(x,290-h,200,h+250,'#396773');rect(x+45,255-h,95,45,'#396773');
      const cloud=((i*260-cam*.10)%1600+1600)%1600-200;
      rect(cloud,65+(i%3)*37,88,17,'#90b6b8');rect(cloud+17,54+(i%3)*37,47,22,'#90b6b8');
    }
    for(const [x,z,w] of platforms){const sx=x-cam,sy=floor-z;if(sx+w<0||sx>960)continue;rect(sx,sy,w,220,'#203e43');rect(sx,sy,w,10,'#b0dfae');rect(sx,sy+10,w,8,'#649b80');for(let j=0;j<w/60;j++)rect(sx+j*60+20,sy+43+(j%3)*24,17,6,'#34595a');}
    coins.forEach(([x,z],i)=>{if(game.taken.has(i)||x<cam-30||x>cam+990)return;const y=floor-z+(reduced?0:Math.sin(frameTime*3+i)*3);rect(x-cam-7,y-12,14,24,'#bc853c');rect(x-cam-10,y-8,20,16,'#bc853c');rect(x-cam-6,y-10,12,20,'#ffd685');rect(x-cam-3,y-7,3,13,'#fff0bd');});
    function flag(x,z,c,label){x-=cam;if(x<-100||x>1060)return;rect(x,floor-z-115,5,115,'#d6e6ca');rect(x+5,floor-z-114,54,28,c);ctx.fillStyle='#e4efe5';ctx.font='11px system-ui';ctx.fillText(label,x-10,floor-z+23);}
    flag(3120,0,'#b0dfae','CAMP');flag(goal,0,'#f8b16f','GOAL');
    cat(game.x-cam,floor-game.z);
    const progress=Math.min(1,game.x/goal);rect(0,537,960,3,'#193438');rect(0,537,960*progress,3,'#b0dfae');
  }
  function frame(now){const elapsed=Math.min(.1,(now-(last||now))/1000);last=now;frameTime=now/1000;if(game.state==='playing'){acc+=elapsed;const [move,jump]=input();while(acc>=1/120&&game.state==='playing'){game.step(1/120,move,jump);acc-=1/120;for(const event of game.events){if(event==='coin')tone(1100);if(event==='jump')tone(440,.07);if(event==='fall'){tone(150,.16);notify('もう一度！ 中間地点から再開できます');}if(event==='camp'){tone(880,.18);notify('中間地点を保存しました');}if(event==='win'){tone(1320,.3);win();}}}}else acc=0;
    $('coins').textContent=String(game.taken.size).padStart(2,'0');$('time').textContent=game.time.toFixed(1);$('falls').textContent=`落下 ${game.falls} 回`;$('camp').textContent=game.checkpoint>100?'中間地点を保存済み':'スタート地点';if(now>noticeUntil)$('notice').classList.remove('show');draw();requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
