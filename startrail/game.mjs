import {Game, ZONE_WIDTH, FINISH, ZONES, clamp} from './engine.mjs';

const $ = id => document.getElementById(id);
const canvas = $('game'), ctx = canvas.getContext('2d'), field = $('playfield');
const images = {}, keys = new Set(), pointers = new Map();
let game = new Game(), ready = false, paused = false, muted = false, autoRun = true;
let audio, accumulator = 0, previous = 0, camera = 460, viewW = 1280, viewH = 640;
let jumpQueued = false, uiStamp = 0, uiState = '', restartPrompt = false;
const palette = [
  ['#d6efdf','#9fcbc1','#6aa99e','#354e64','#745e69','#8ae0a6'],
  ['#f5dfba','#d4b697','#b18788','#554c6b','#806074','#edbf78'],
  ['#d4e8ed','#a2c2d3','#7b9eb9','#434d72','#69728c','#a8dfdc'],
  ['#c8b9dc','#a094c3','#807aa9','#3f4165','#5c587b','#b9a9dc'],
  ['#303853','#434c73','#565e87','#242b49','#4d5274','#a8b8db']
];
const tones = {coin:[1046,1568],jump:[330,440,660],hurt:[196,147,98],stomp:[220,440],checkpoint:[523,659,784,1046],win:[523,659,784,1046,784,1046,1318]};
const formatTime = seconds => `${Math.floor(seconds/60).toString().padStart(2,'0')}:${Math.floor(seconds%60).toString().padStart(2,'0')}`;

function unlockSound() {
  try { audio ??= new (window.AudioContext || window.webkitAudioContext)(); if(audio.state === 'suspended') audio.resume().catch(()=>{}); } catch {}
}
function sound(name) {
  if(muted || !audio || audio.state !== 'running') return;
  const notes = tones[name]; if(!notes) return;
  const duration = name === 'win' ? .16 : name === 'checkpoint' ? .1 : .06;
  notes.forEach((frequency,i) => {
    const osc = audio.createOscillator(), gain = audio.createGain(), start = audio.currentTime+i*duration;
    osc.type = 'triangle'; osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0,start); gain.gain.linearRampToValueAtTime(name==='jump'?.035:.075,start+.008);
    gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    osc.connect(gain); gain.connect(audio.destination); osc.start(start); osc.stop(start+duration+.01);
  });
}
function clearInput() {
  keys.clear(); pointers.clear(); jumpQueued=false;
  document.querySelectorAll('[data-action]').forEach(b=>b.classList.remove('held'));
}
function start() {
  if(!ready) return;
  unlockSound(); clearInput(); accumulator=0; restartPrompt=false;
  if(paused && game.state==='playing') paused=false;
  else { game=new Game(); game.start(); paused=false; camera=Math.max(viewW/2-180,game.x+viewW*.18); }
  uiState=''; updateUI(); field.focus({preventScroll:true});
}
function togglePause() {
  if(!ready || game.state!=='playing') return;
  paused=!paused; restartPrompt=false; clearInput(); accumulator=0; uiState=''; updateUI();
  if(!paused) field.focus({preventScroll:true}); else $('start').focus({preventScroll:true});
}
function askRestart() {
  if(!ready || game.state==='title') return;
  if(game.state!=='playing') { start(); return; }
  paused=true; restartPrompt=true; clearInput(); uiState=''; updateUI(); $('start').focus({preventScroll:true});
}
$('start').addEventListener('click',()=>{
  if($('start').dataset.retry==='true') { location.reload(); return; }
  if(restartPrompt) { paused=false; game.state='title'; }
  start();
});
$('pause').addEventListener('click',togglePause);
$('restart').addEventListener('click',askRestart);
$('sound').addEventListener('click',()=>{
  unlockSound(); muted=!muted; $('sound').textContent=muted?'音 OFF':'音 ON';
  $('sound').setAttribute('aria-pressed',String(muted)); $('sound').setAttribute('aria-label',muted?'音をオンにする':'音をミュート');
});
$('auto-run').addEventListener('click',()=>{
  autoRun=!autoRun; $('auto-run').textContent=`ダッシュ ${autoRun?'ON':'OFF'}`; $('auto-run').setAttribute('aria-pressed',String(autoRun));
});
const mapped = new Set(['ArrowLeft','ArrowRight','ArrowUp','Space','KeyA','KeyD','KeyW','ShiftLeft','ShiftRight','KeyP','Escape','KeyR','Enter']);
window.addEventListener('keydown',e=>{
  if(!mapped.has(e.code) || e.altKey || e.ctrlKey || e.metaKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if((e.code==='Space'||e.code==='Enter') && e.target.closest('button,a,summary')) return;
  e.preventDefault(); if(!ready) return;
  if(!e.repeat && (e.code==='Enter'||e.code==='Space') && game.state!=='playing') { start(); return; }
  if(!e.repeat && (e.code==='KeyP'||e.code==='Escape')) { togglePause(); return; }
  if(!e.repeat && e.code==='KeyR') { askRestart(); return; }
  keys.add(e.code);
  if(!e.repeat && ['Space','ArrowUp','KeyW'].includes(e.code)) jumpQueued=true;
  field.dataset.lastAction=e.code;
});
window.addEventListener('keyup',e=>{ keys.delete(e.code); });
window.addEventListener('blur',()=>{ clearInput(); if(game.state==='playing'&&!paused) togglePause(); });
document.addEventListener('visibilitychange',()=>{ if(document.hidden){clearInput(); if(game.state==='playing'&&!paused) togglePause();} });
document.querySelectorAll('[data-action]').forEach(button=>{
  button.addEventListener('pointerdown',e=>{
    e.preventDefault(); if(!ready||paused||game.state!=='playing') return;
    unlockSound(); button.setPointerCapture(e.pointerId); pointers.set(e.pointerId,button.dataset.action);
    button.classList.add('held'); if(button.dataset.action==='jump') jumpQueued=true;
    field.dataset.lastAction=button.dataset.action;
  });
  const release=e=>{pointers.delete(e.pointerId); if(![...pointers.values()].includes(button.dataset.action))button.classList.remove('held');};
  button.addEventListener('pointerup',release); button.addEventListener('pointercancel',release); button.addEventListener('lostpointercapture',release);
  button.addEventListener('contextmenu',e=>e.preventDefault());
});

function input() {
  const touch=new Set(pointers.values());
  const right=keys.has('KeyD')||keys.has('ArrowRight')||touch.has('right');
  const left=keys.has('KeyA')||keys.has('ArrowLeft')||touch.has('left');
  const data={move:Number(right)-Number(left),jump:jumpQueued||keys.has('Space')||keys.has('KeyW')||keys.has('ArrowUp')||touch.has('jump'),
    sprint:keys.has('ShiftLeft')||keys.has('ShiftRight')||(autoRun&&(touch.has('left')||touch.has('right')))};
  jumpQueued=false; return data;
}

function updateUI() {
  const zone=Math.min(4,Math.floor(game.x/ZONE_WIDTH)), time=Math.ceil(game.time);
  $('health').innerHTML=Array.from({length:3},(_,i)=>`<span${i>=game.health?' class="empty"':''}>♥</span>`).join(' ');
  $('health').setAttribute('aria-label',`体力 ${game.health} / 3`);
  $('score').textContent=String(game.score).padStart(3,'0'); $('timer').textContent=formatTime(time);
  $('zone').textContent=`0${zone+1} / ${ZONES[zone]}`;
  const progress=Math.min(100,Math.round(game.x/FINISH*100));
  $('progress').setAttribute('aria-valuenow',String(progress)); $('progress').firstElementChild.style.width=`${progress}%`;
  $('banner').textContent=game.bannerTime>0 && game.state==='playing'&&!paused?game.banner:'';
  $('pause').disabled=game.state!=='playing'; $('pause').textContent=paused?'再開':'一時停止';
  $('restart').disabled=!ready||game.state==='title';
  field.dataset.state=paused?'paused':game.state; field.dataset.x=game.x.toFixed(2); field.dataset.z=game.z.toFixed(2);
  field.dataset.grounded=String(game.grounded); field.dataset.score=String(game.score);
  const state=restartPrompt?'restart':paused?'paused':game.state;
  if(state===uiState)return; uiState=state;
  $('overlay').hidden=state==='playing'; $('result').hidden=true;
  if(state==='playing')return;
  if(state==='title') {
    $('overlay-label').textContent='5分間の、小さな冒険。'; $('overlay-title').textContent='STARTRAIL';
    $('overlay-copy').innerHTML='コインを集め、穴を跳び越え、敵を上から踏もう。<br>小さな光を、5つの景色の向こうへ。';
    $('start').textContent='冒険をはじめる →'; $('start-hint').textContent='Enterでも開始 ／ 登録・インストール不要';
  } else if(state==='paused'||state==='restart') {
    $('overlay-label').textContent='時計を止めて、ひと休み。'; $('overlay-title').textContent=state==='restart'?'最初からやり直す？':'PAUSED';
    $('overlay-copy').textContent=state==='restart'?'進行とコインをリセットして、草原から再出発します。':'現在の進行と残り時間を、そのまま保っています。';
    $('start').textContent=state==='restart'?'最初からはじめる':'冒険をつづける →'; $('start-hint').textContent=state==='restart'?'続ける場合は上の「再開」またはP':'Pキーでも再開';
  } else if(state==='won') {
    let best=''; try {
      const old=JSON.parse(localStorage.getItem('aitech.startrail.best')||'null');
      if(!old||game.score>old.score){localStorage.setItem('aitech.startrail.best',JSON.stringify({score:game.score,time:game.elapsed}));best=' 自己ベスト更新！';}
    } catch {}
    $('overlay-label').textContent='星明かりの門が、開いた。'; $('overlay-title').textContent='YOU MADE IT!';
    $('overlay-copy').textContent='5つの景色を越えて、小さな光が帰ってきました。';
    $('result').hidden=false; $('result').textContent=`コイン ${game.score} ／ ${formatTime(game.elapsed)} ／ 復帰 ${game.deaths}回${best}`;
    $('start').textContent='もう一度遊ぶ →'; $('start-hint').textContent='Enterでも再挑戦'; $('start').focus({preventScroll:true});
  } else {
    $('overlay-label').textContent='今夜はここまで。また星を追いかけよう。'; $('overlay-title').textContent='ONE MORE TRY?';
    $('overlay-copy').textContent=`区間 ${game.checkpoint+1} まで到達。コインを ${game.score} 枚集めました。`;
    $('start').textContent='もう一度挑戦する →'; $('start-hint').textContent='Enterでも再挑戦'; $('start').focus({preventScroll:true});
  }
}

function resize() {
  const rect=canvas.getBoundingClientRect(), ratio=Math.min(2,window.devicePixelRatio||1);
  canvas.width=Math.max(1,Math.round(rect.width*ratio));canvas.height=Math.max(1,Math.round(rect.height*ratio));
  viewH=640; viewW=viewH*rect.width/Math.max(1,rect.height);
}
new ResizeObserver(resize).observe(field);
const noise=n=>{const x=Math.sin(n*127.1+311.7)*43758.5453;return x-Math.floor(x);};
function sprite(name,x,z,w,h,flip=false,alpha=1) {
  const img=images[name]; if(!img)return;
  ctx.save();ctx.globalAlpha=alpha;ctx.translate(Math.round(x-camera+viewW/2),Math.round(viewH-80-z));
  if(flip)ctx.scale(-1,1);ctx.drawImage(img,-w/2,-h,w,h);ctx.restore();
}
function rect(x,z,w,h,color) {ctx.fillStyle=color;ctx.fillRect(Math.round(x-camera+viewW/2),Math.round(viewH-80-z-h),Math.ceil(w),Math.ceil(h));}
function draw() {
  ctx.setTransform(canvas.width/viewW,0,0,canvas.height/viewH,0,0);ctx.imageSmoothingEnabled=false;
  const zone=clamp(Math.floor(game.x/ZONE_WIDTH),0,4),p=palette[zone],baseY=viewH-80;
  ctx.fillStyle=p[0];ctx.fillRect(0,0,viewW,viewH);
  for(let layer=0;layer<2;layer++){
    const spacing=650, offset=camera*(layer?.33:.13), start=Math.floor((offset-viewW)/spacing);
    ctx.fillStyle=p[layer+1];
    for(let j=start;j<start+Math.ceil(viewW/spacing)+4;j++){
      const x=j*spacing-offset+viewW/2, width=layer?780:1120, height=layer?220+noise(j+41)*90:340+noise(j+3)*120;
      ctx.beginPath();ctx.moveTo(x-width/2,baseY+70);ctx.lineTo(x,baseY-height);ctx.lineTo(x+width/2,baseY+70);ctx.fill();
    }
  }
  const cloudOffset=camera*.18;
  for(let j=Math.floor(cloudOffset/550)-2;j<Math.floor(cloudOffset/550)+5;j++){
    const x=j*550-cloudOffset+viewW/2,y=35+noise(j+100)*110;
    if(zone<4)ctx.drawImage(images.cloud,Math.round(x),Math.round(y),220,80);
    else {for(let k=0;k<4;k++)ctx.drawImage(images.star,x+k*120,y+noise(j+k)*90,8,8);}
  }
  const left=camera-viewW/2-250,right=camera+viewW/2+250;
  for(let j=Math.max(0,Math.floor(left/700));j<=Math.min(59,Math.ceil(right/700));j++){
    const local=j%12, top=[0,1,10,11].includes(local)?0:[0,40,80,40][local%4];
    sprite('tree',j*700+480,top,170,170);
    sprite('flower',j*700+95,top,28,28);
  }
  for(const platform of game.platforms) {
    if(platform.x+platform.w<left||platform.x>right)continue;
    const q=palette[platform.zone];
    rect(platform.x,platform.z,platform.w,platform.h,q[3]);
    rect(platform.x+4,platform.z+4,platform.w-8,Math.max(4,platform.h-15),q[4]);
    rect(platform.x,platform.z+platform.h-8,platform.w,8,q[5]);
    if(!platform.floating)for(let j=0;j<Math.floor(platform.w/80);j++)rect(platform.x+j*80+20,platform.z+platform.h-45-(j%3)*23,18,5,q[3]);
  }
  for(let i=0;i<game.coins.length;i++){const c=game.coins[i];if(!c.taken&&c.x>left&&c.x<right)sprite('coin',c.x,c.z-13+Math.sin(game.elapsed*3+i)*4,27,27);}
  for(const e of game.enemies)if(e.alive&&e.x>left&&e.x<right)sprite('bug'+Math.floor(game.elapsed*5)%2,e.x,e.z,50,44,e.direction<0);
  for(const s of game.spikes)if(s.x>left&&s.x<right)sprite('spike',s.x+24,s.z,48,26);
  for(let i=0;i<game.checkpoints.length;i++){
    const camp=game.checkpoints[i];if(camp.x<left||camp.x>right)continue;
    sprite('lantern',camp.x-55,0,64,88); ctx.fillStyle=p[3];ctx.font='bold 19px system-ui';
    ctx.fillText(`0${i+1} / ${ZONES[i]}`,camp.x-60-camera+viewW/2,baseY-118);
  }
  if(FINISH>left-200&&FINISH<right+200)sprite('gate',FINISH+30,0,240,320);
  const frame=game.grounded&&Math.abs(game.vx)>30?Math.floor(game.elapsed*11)%4:0;
  sprite('hero'+frame,game.x,game.z,48,64,game.facing<0,game.invulnerable>0&&Math.floor(game.elapsed*12)%2===0?.35:1);
  if(game.x<1100&&game.state==='playing'){
    ctx.fillStyle='#354e64';ctx.font='600 19px system-ui';ctx.fillText('→ コインを追いかけて、右へ進もう',50-camera+viewW/2,baseY-200);
  }
}
function frame(timestamp) {
  const dt=previous?clamp((timestamp-previous)/1000,0,.1):0;previous=timestamp;
  if(ready && game.state==='playing'&&!paused){
    accumulator+=dt;const events=new Set();
    while(accumulator>=1/120){game.step(1/120,input());for(const e of game.events)events.add(e);accumulator-=1/120;}
    for(const e of events)sound(e);
  }
  const target=clamp(game.x+viewW*.18,viewW/2-180,FINISH-viewW*.22);
  camera+=(target-camera)*(1-Math.exp(-9*dt));
  if(ready)draw();
  uiStamp+=dt;if(uiStamp>.08||game.state!==uiState){updateUI();uiStamp=0;}
  requestAnimationFrame(frame);
}

async function load() {
  try {
    if(!ctx)throw new Error('Canvas 2D is unavailable');
    const response=await fetch(new URL('./assets.json',import.meta.url));if(!response.ok)throw new Error('Images could not be loaded');
    const source=await response.json();
    await Promise.all(Object.entries(source).map(([name,src])=>new Promise((resolve,reject)=>{
      const img=new Image();img.onload=()=>{images[name]=img;resolve();};img.onerror=reject;img.src=src;
    })));
    resize();ready=true;$('start').disabled=false;uiState='';updateUI();draw();requestAnimationFrame(frame);
  } catch(error) {
    console.error('STARTRAIL could not start:',error);
    $('overlay-title').textContent='読み込めませんでした';$('overlay-copy').textContent='通信状態を確認して、もう一度読み込んでください。';
    $('start').textContent='再読み込み';$('start').disabled=false;$('start').dataset.retry='true';
  }
}
load();
