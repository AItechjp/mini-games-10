import {LANES,TRACKS,DIFFICULTIES,SECTIONS,makeChart,trackDuration,sectionAt,timingGrade,WEIGHTS,rankFor,analyzeAudio,localChart,AudioEngine} from './music.mjs?v=20260915-1';
import {PLAYERS,cooperativeChart,createPlayerStats,recordPlayer,playerAccuracy,synchronizedPair} from './coop.mjs?v=20260915-coop1';

const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const audio=new AudioEngine(),reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const STORE='aitech-pulse-drums-v1';
const readSaved=()=>{try{return JSON.parse(localStorage.getItem(STORE)||'{}')||{};}catch{return{};}};
let saved=readSaved();
const requestedMode=new URL(location.href).searchParams.get('mode');
let mode=requestedMode==='duo'?'duo':requestedMode==='solo'?'solo':saved.mode==='duo'?'duo':'solo';
const COOP_LANES=LANES.map((meta,lane)=>({...meta,short:`PAD ${lane%3+1}`,ja:`${Math.floor(lane/3)+1}P パッド${lane%3+1}`,color:LANES[lane%3].color}));
const laneMeta=()=>mode==='duo'?COOP_LANES:LANES;
const bound=(n,min,max,fallback)=>Number.isFinite(Number(n))?Math.min(max,Math.max(min,Number(n))):fallback;
let selected=TRACKS[0],difficulty=bound(saved.difficulty,0,2,0),screen='select',chart=[],run=null,loaded=null,loading=false;
let previewing=false,previewPending=false,previewTimer=null,previewOrigin=performance.now()/1000,launch=0,noticeTimer,lastUI=0;
let calibration=null,wakeLock=null,fileGeneration=0;
const flashes=Array(6).fill(0),particles=[],padTimers=Array(6),lastStrike=Array(6).fill(-10);
const prefs={speed:bound(saved.speed,.75,1.6,1),volume:bound(saved.volume,0,1,.7),offset:bound(saved.offset,-250,250,0)};
const safeBests=saved.bests&&typeof saved.bests==='object'?saved.bests:{};saved={bests:safeBests};
const persist=()=>{try{localStorage.setItem(STORE,JSON.stringify({...prefs,difficulty,mode,bests:saved.bests}));}catch{}};
const lengthLabel=t=>`${Math.floor(Math.max(0,t)/60)}:${String(Math.floor(Math.max(0,t)%60)).padStart(2,'0')}`;
const level=()=>selected.local?'AUTO':selected.levels[difficulty].toFixed(1);
const duration=()=>selected.local?(loaded?.buffer.duration||0):trackDuration(selected);
const activeChart=()=>{const notes=selected.local?(loaded?localChart(loaded.analysis,difficulty,Number($('#local-shift').value)):[]):makeChart(selected,difficulty);return mode==='duo'?cooperativeChart(notes):notes;};
function notice(message){$('#notice').textContent=message;clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>$('#notice').textContent='',6500);}
function switchScreen(next){
  screen=next;for(const name of ['select','play','result'])$(`#${name}-screen`).hidden=name!==next;
  document.body.classList.toggle('playing',next==='play');
  $('#fullscreen-btn').disabled=false;
  requestAnimationFrame(resizeCanvases);
}
function bestKey(){return selected.id+':'+difficulty+(mode==='duo'?':duo':'');}
function paintBest(){
  const best=saved.bests[bestKey()];
  const prefix=mode==='duo'?'DUO BEST':'BEST';
  $('#best-label').textContent=best?`${prefix} ${best.rank} · ${Math.round(best.score).toLocaleString()}`:`${prefix} —`;
  if(selected.local)$('#best-label').textContent='LOCAL PRACTICE';
}
function makeSongList(){
  for(const track of [TRACKS.at(-1),...TRACKS.slice(0,-1)]){
    const i=TRACKS.indexOf(track);
    const button=document.createElement('button');button.type='button';button.className='song-item'+(track.local?' local':'');button.dataset.track=track.id;
    button.style.setProperty('--song-color',track.color);button.setAttribute('aria-pressed',String(track.id===selected.id));
    button.innerHTML=`<span class="track-num">${track.local?'+':String(i+1).padStart(2,'0')}</span><span><span class="track-name"></span><span class="track-genre"></span></span><span class="bpm-cell">${track.local?'↗':track.bpm}<small>${track.local?'LOCAL':'BPM'}</small></span>`;
    button.querySelector('.track-name').textContent=track.title;button.querySelector('.track-genre').textContent=track.local?'TAG · 手持ち音源を読み込む':track.genre;
    button.addEventListener('click',()=>selectTrack(track));$('#song-list').append(button);
  }
  $('#song-list').addEventListener('keydown',event=>{
    if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
    event.preventDefault();const list=$$('.song-item'),index=list.indexOf(document.activeElement),next=event.key==='Home'?0:event.key==='End'?list.length-1:Math.min(list.length-1,Math.max(0,index+(event.key==='ArrowDown'?1:-1)));
    list[next].focus();selectTrack(TRACKS.find(track=>track.id===list[next].dataset.track));
  });
}
function stopPreview(){clearTimeout(previewTimer);previewTimer=null;if(previewing||previewPending){previewing=false;previewPending=false;audio.stop();}$('#preview-button').textContent='♪ 15秒試聴';}
function selectTrack(track){
  launch++;stopPreview();selected=track;previewOrigin=performance.now()/1000;document.documentElement.style.setProperty('--accent',track.color);
  $$('.song-item').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.track===track.id)));
  $('#selected-title').textContent=track.title;$('#selected-sub').textContent=track.local?'手持ち音源から作る練習譜面':track.jp;
  $('#selected-genre').textContent=track.genre;$('#disc-label').textContent=track.local?'LOCAL AUDIO':`ORIGINAL ${String(TRACKS.indexOf(track)+1).padStart(2,'0')} / 10`;
  $('#preview-wrap').hidden=!!track.local;$('#local-panel').hidden=!track.local;
  updateDifficulty();requestAnimationFrame(resizeCanvases);
}
function updateDifficulty(){
  chart=activeChart();$('#difficulties').replaceChildren();
  for(let i=0;i<3;i++){
    const button=document.createElement('button');button.type='button';button.className='difficulty';button.dataset.difficulty=i;button.setAttribute('aria-pressed',String(i===difficulty));
    button.innerHTML=`<span>${DIFFICULTIES[i]}</span><b>${selected.local?'AUTO':selected.levels[i].toFixed(1)}</b>`;
    button.addEventListener('click',()=>{difficulty=i;persist();updateDifficulty();});$('#difficulties').append(button);
  }
  $('#selected-bpm').innerHTML=`<b>${selected.bpm||loaded?.analysis.bpm||'—'}</b> BPM`;
  $('#selected-duration').innerHTML=`<b>${lengthLabel(duration())}</b>`;
  $('#selected-notes').innerHTML=`<b>${chart.length}</b> NOTES`;
  $('#start-button').disabled=loading||(selected.local&&(!loaded||chart.length<8));
  $('#start-button').firstChild.textContent=selected.local&&!loaded?'音源を選んでください ':$('#autoplay').checked?'お手本を見る ':mode==='duo'?'2人で演奏する ':'演奏する ';
  if(loaded)$('#local-analysis').textContent=`${lengthLabel(loaded.buffer.duration)} · ${chart.length} NOTES`;
  paintBest();
}
function setPlayMode(value,save=true){
  if(screen==='play')return;
  mode=value==='duo'?'duo':'solo';document.body.classList.toggle('coop-mode',mode==='duo');
  $('#solo-mode').setAttribute('aria-pressed',String(mode==='solo'));$('#duo-mode').setAttribute('aria-pressed',String(mode==='duo'));
  $('#controls-hint').innerHTML=mode==='duo'?'1P：D・F・Space <span>2P：J・K・L / 同じ画面で協力</span>':'PC：D・F・Space・J・K・L <span>スマホ：パッドをタップ / 横画面</span>';
  makePads();updateDifficulty();if(save)persist();
}
function makePads(){
  $('#pads').replaceChildren();$('#help-keys').replaceChildren();
  for(const [lane,meta] of laneMeta().entries()){
  const button=document.createElement('button');button.type='button';button.className='pad';button.dataset.lane=lane;button.style.setProperty('--pad',meta.color);button.setAttribute('aria-label',`${meta.ja} ${meta.key}`);button.innerHTML=`<b>${meta.short}</b><small>${meta.key}</small>`;
  button.addEventListener('pointerdown',e=>{e.preventDefault();try{button.setPointerCapture(e.pointerId);}catch{}strike(lane);});
  button.addEventListener('click',e=>{if(e.detail===0)strike(lane);});
  $('#pads').append(button);
  const key=document.createElement('div');key.style.color=meta.color;key.textContent=meta.ja;const b=document.createElement('b');b.textContent=meta.key;key.append(b);$('#help-keys').append(key);
}}
async function fullScreen(){
  try{
    if(document.fullscreenElement){await document.exitFullscreen();return;}
    const fn=document.documentElement.requestFullscreen||document.documentElement.webkitRequestFullscreen;
    if(fn)await fn.call(document.documentElement);
    else notice('画面いっぱいに表示中です。端末を横向きにするとさらに見やすくなります。');
    if(screen==='play')try{await globalThis.screen.orientation?.lock('landscape');}catch{}
  }catch{notice('画面内を最大表示しています。横向きにして演奏できます。');}
}
async function keepAwake(){try{wakeLock=await navigator.wakeLock?.request('screen');}catch{}}
function releaseAwake(){wakeLock?.release().catch(()=>{});wakeLock=null;}
async function startGame(){
  if(loading||selected.local&&!loaded)return;
  const id=++launch;stopPreview();audio.stop();$('#start-button').disabled=true;
  try{
    // Unlock audio directly from the user's gesture; fullscreen failure is non-blocking.
    await audio.unlock();if(id!==launch)return;
    chart=activeChart();if(!chart.length)throw new Error('譜面がありません。別の音源を選んでください。');
    $('#pause-dialog').close();switchScreen('play');
    const nodes=chart.map((n,i)=>({...n,id:i,status:null}));
    run={nodes,total:nodes.length,byLane:LANES.map((_,i)=>nodes.filter(n=>n.lane===i)),cursors:Array(6).fill(0),missCursor:0,autoCursor:0,
      combo:0,maxCombo:0,counts:{perfect:0,great:0,good:0,miss:0},empty:0,weight:0,energy:50,paused:false,starting:true,
      demo:$('#autoplay').checked,ended:false,track:selected,started:0,duration:duration(),timings:[],judgedAt:-10,t:-2.5,
      coop:mode==='duo',players:createPlayerStats(nodes),pairs:new Map(),sync:0,syncTotal:0};
    if(run.coop){for(const n of nodes)if(n.pair!==null){if(!run.pairs.has(n.pair))run.pairs.set(n.pair,[]);run.pairs.get(n.pair).push(n);}run.syncTotal=run.pairs.size;}
    $('#duo-hud').hidden=!run.coop;$('#sync-label').hidden=!run.coop;$('#combo-label').textContent=run.coop?'TEAM COMBO':'COMBO';
    $('#game-canvas').setAttribute('aria-label',run.coop?'2人協力。左3レーンを1P、右3レーンを2Pが担当します。白い線でパッドを叩いてください。':'上から流れるノーツが判定線に来たら対応するパッドを叩いてください');
    flashes.fill(0);lastStrike.fill(-10);particles.length=0;
    $('#play-title').textContent=selected.title;$('#play-difficulty').textContent=`${run.coop?'2人協力 · ':''}${DIFFICULTIES[difficulty]} · ${level()} · ${nodes.length} NOTES`;
    $('#demo-indicator').hidden=!run.demo;$('#judgment').style.opacity='0';$('#countdown').textContent='READY';$('#combo-number').textContent='0';
    audio.setVolume(prefs.volume);const started=await audio.play(selected,{buffer:selected.local?loaded.buffer:null});
    if(id!==launch||!started)return;run.starting=false;run.started=performance.now();
    if(innerWidth<1000&&!document.fullscreenElement){fullScreen();}
    keepAwake();resizeCanvases();refreshStats();$('#pause-button').focus({preventScroll:true});
  }catch(error){audio.stop();switchScreen('select');notice(error.message||'音声を準備できませんでした。もう一度お試しください。');}
  finally{updateDifficulty();}
}
function position(){return audio.position()-prefs.offset/1000;}
function flashPad(lane){
  const pad=$(`.pad[data-lane="${lane}"]`);pad.classList.add('active');clearTimeout(padTimers[lane]);padTimers[lane]=setTimeout(()=>pad.classList.remove('active'),80);flashes[lane]=performance.now();
}
function strike(lane){
  if(screen!=='play'||!run||run.paused||run.ended||run.starting)return;
  const t=position();if(t-lastStrike[lane]<.035)return;lastStrike[lane]=t;
  flashPad(lane);
  if(run.demo||t<-.14){if(audio.ctx?.state==='running')audio.drum(run.coop?lane%3:lane,audio.ctx.currentTime,.6);return;}
  const laneNotes=run.byLane[lane];let cursor=run.cursors[lane];
  while(cursor<laneNotes.length&&laneNotes[cursor].status)cursor++;
  run.cursors[lane]=cursor;let target=null,dist=Infinity;
  for(let i=cursor;i<Math.min(cursor+6,laneNotes.length);i++){
    const n=laneNotes[i];if(n.t>t+.14)break;const d=Math.abs(t-n.t);if(!n.status&&d<=.14&&d<dist){target=n;dist=d;}
  }
  if(audio.ctx?.state==='running')audio.drum(target?.sourceLane??(run.coop?lane%3:lane),audio.ctx.currentTime,.6);
  if(target){const grade=timingGrade(t-target.t);if(grade)judge(target,grade,t-target.t);}
  else if(t>0&&t<run.duration-.4){run.empty++;run.energy=Math.max(0,run.energy-.7);run.combo=0;if(run.coop)recordPlayer(run.players[Math.floor(lane/3)],'empty',0);showJudgment('EMPTY',null,run.coop?`${Math.floor(lane/3)+1}P 空打ち`:'空打ち');refreshStats();}
}
function judge(note,grade,delta=0){
  if(note.status)return;note.status=grade;note.delta=delta;run.counts[grade]++;run.weight+=WEIGHTS[grade];
  if(run.coop)recordPlayer(run.players[note.player],grade,WEIGHTS[grade]);
  if(grade==='miss'){run.combo=0;run.energy=Math.max(0,run.energy-2);}
  else{
    run.combo++;run.maxCombo=Math.max(run.maxCombo,run.combo);run.energy=Math.min(100,run.energy+(grade==='perfect'?.6:grade==='great'?.35:.1));
    if(!run.demo)run.timings.push(delta*1000);flashes[note.lane]=performance.now();
    if(!reduceMotion)for(let i=0;i<7;i++)particles.push({lane:note.lane,at:performance.now(),vx:(Math.random()-.5)*70,vy:Math.random()*-90-20,color:laneMeta()[note.lane].color});
  }
  let linked=false;
  if(run.coop&&note.pair!==null){const pair=run.pairs.get(note.pair);if(pair&&!pair.linked&&synchronizedPair(pair[0],pair[1])){pair.linked=true;run.sync++;run.energy=Math.min(100,run.energy+1);linked=true;}}
  showJudgment(linked?'SYNC!':grade.toUpperCase(),grade,linked?'2人のリズムが一致':(run.coop?`${note.player+1}P · `:'')+(grade==='miss'?'MISS':Math.abs(delta)<.013?'JUST':delta<0?'FAST':'SLOW'));
}
function showJudgment(text,grade,detail){
  const el=$('#judgment');el.querySelector('strong').textContent=text;el.querySelector('span').textContent=detail;
  el.style.color=grade==='perfect'?'#f4e87b':grade==='great'?'#56e5c2':grade==='good'?'#5db8ff':'#ff668b';el.style.opacity='1';run.judgedAt=performance.now();
}
function accuracy(){const hits=Object.values(run.counts).reduce((a,b)=>a+b,0);return hits?Math.max(0,(run.weight-run.empty*.18)/hits*100):0;}
function score(){return Math.round(Math.max(0,run.weight-run.empty*.18)/run.total*1000000);}
function refreshStats(){
  if(!run)return;$('#score-number').textContent=String(score()).padStart(7,'0');
  $('#accuracy-number').textContent=Object.values(run.counts).some(Boolean)?accuracy().toFixed(2)+'%':'—';
  $('#combo-number').textContent=run.combo;$('#groove-number').textContent=Math.round(run.energy)+'%';$('#groove-fill').style.height=run.energy+'%';
  for(const kind of Object.keys(run.counts))$(`#${kind}-count`).textContent=run.counts[kind];
  const t=Math.max(0,run.t);$('#play-clock').textContent=lengthLabel(t)+' / '+lengthLabel(run.duration);$('#song-progress-fill').style.width=Math.min(100,t/run.duration*100)+'%';
  $('#section-name').textContent=run.track.local?'LOCAL':SECTIONS[sectionAt(t*(run.track.bpm||120)/240,run.track.bars)];
  $('#timing-indicator').textContent=run.demo?'成績は記録されません':`空打ち ${run.empty}`;
  if(run.coop){$('#sync-label').textContent=`SYNC ${run.sync}`;for(let i=0;i<2;i++){const player=run.players[i],played=Object.values(player.counts).some(Boolean);$(`#p${i+1}-accuracy`).textContent=played?playerAccuracy(player).toFixed(1)+'%':'—';$(`#p${i+1}-combo`).textContent=`${player.combo} COMBO`;}}
}
async function pauseGame(){
  if(screen!=='play'||!run||run.paused||run.ended)return;
  run.paused=true;await audio.pause();if(screen==='play'&&!$('#pause-dialog').open)$('#pause-dialog').showModal();releaseAwake();
}
async function resumeGame(){
  if(!run||!run.paused)return;
  try{await audio.resume();run.paused=false;$('#pause-dialog').close();keepAwake();$('#pause-button').focus({preventScroll:true});}
  catch{notice('再開できませんでした。もう一度お試しください。');}
}
function returnToList(){launch++;audio.stop();stopPreview();run=null;$('#pause-dialog').close();switchScreen('select');releaseAwake();globalThis.screen.orientation?.unlock?.();updateDifficulty();$('#start-button').focus({preventScroll:true});}
function finishGame(){
  if(!run||run.ended)return;run.ended=true;
  for(const n of run.nodes)if(!n.status)judge(n,'miss');
  audio.stop();releaseAwake();globalThis.screen.orientation?.unlock?.();
  const acc=Math.max(0,(run.weight-run.empty*.18)/run.total*100),rank=rankFor(acc),points=score(),fc=run.counts.miss===0&&run.empty===0;
  const old=saved.bests[bestKey()],isBest=!run.demo&&!run.track.local&&(!old||points>old.score);
  if(isBest){saved.bests[bestKey()]={score:points,rank,accuracy:acc,maxCombo:run.maxCombo};persist();}
  $('#result-title').textContent=run.track.title;$('#result-subtitle').textContent=`${run.coop?'2人協力 · ':''}${DIFFICULTIES[difficulty]} · ${level()} · ${run.total} NOTES`;
  $('#result-label').textContent=run.demo?'DEMONSTRATION':run.coop?'DUO STAGE RESULT':run.track.local?'LOCAL PRACTICE RESULT':'STAGE RESULT';
  $('#result-rank').textContent=rank;$('#result-score').textContent=String(points).padStart(7,'0');$('#result-accuracy').textContent=acc.toFixed(2)+'%';$('#result-combo').textContent=run.maxCombo;$('#result-empty').textContent=run.empty;
  $('#result-clear').textContent=run.demo?'お手本・記録なし':fc?'FULL COMBO!':run.energy>=60?'STAGE CLEAR':'STAGE COMPLETE';
  $('#new-best').hidden=!isBest;$('#result-counts').replaceChildren();
  for(const [kind,value] of Object.entries(run.counts)){const d=document.createElement('div');d.innerHTML=`<span>${kind.toUpperCase()}</span><b>${value}</b>`;$('#result-counts').append(d);}
  $('#duo-results').replaceChildren();$('#duo-results').hidden=!run.coop;
  if(run.coop)for(let i=0;i<2;i++){const p=run.players[i],card=document.createElement('section');card.className=`player-result p${i+1}`;card.setAttribute('aria-label',`${i+1}Pの成績`);card.innerHTML=`<h2>${PLAYERS[i].label}<span>${p.total} NOTES</span></h2><dl><div><dt>精度</dt><dd>${playerAccuracy(p,true).toFixed(2)}%</dd></div><div><dt>最大コンボ</dt><dd>${p.maxCombo}</dd></div><div><dt>MISS / 空打ち</dt><dd>${p.counts.miss} / ${p.empty}</dd></div></dl>`;$('#duo-results').append(card);}
  const avg=run.timings.length?run.timings.reduce((a,b)=>a+b,0)/run.timings.length:0;
  $('#result-tip').textContent=run.demo?'お手本の演奏が終わりました。お手本をOFFにして自分で挑戦してみましょう。':fc?'全ノーツをつなぎました。次の難易度にも挑戦してみましょう。':run.timings.length>15&&Math.abs(avg)>30?`叩くタイミングは平均${Math.abs(Math.round(avg))} ms${avg>0?'遅め':'早め'}でした。音量・タイミング調整で合わせられます。`:acc>=85?'いいグルーヴです。連続コンボとシンバルの同時押しを磨こう。':'まずはスネアとバスドラムのリズムから。BASICとお手本で流れをつかもう。';
  if(run.coop&&!run.demo)$('#result-tip').textContent=`SYNC ${run.sync} / ${run.syncTotal} 回。`+(fc?'2人で全ノーツをつなぎました！':run.energy>=60?'力を合わせてステージクリア！':'同時押しを2人で合わせて、共有GROOVE 60%以上を目指そう。');
  switchScreen('result');$('#retry-button').focus({preventScroll:true});
}

const gameCanvas=$('#game-canvas'),previewCanvas=$('#preview-canvas');
const gameCtx=gameCanvas.getContext('2d'),previewCtx=previewCanvas.getContext('2d');
function resizeCanvas(canvas){const w=canvas.clientWidth,h=canvas.clientHeight,dpr=Math.min(devicePixelRatio||1,2);if(w<1||h<1)return;canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);canvas.getContext('2d').setTransform(dpr,0,0,dpr,0,0);}
function resizeCanvases(){resizeCanvas(gameCanvas);resizeCanvas(previewCanvas);}
function highway(ctx,canvas,notes,t,preview=false){
  const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return;const visualLanes=laneMeta();
  ctx.clearRect(0,0,w,h);ctx.fillStyle='#101218';ctx.fillRect(0,0,w,h);
  const top=preview?10:0,hitY=h*(preview?.84:.9),nearW=w*(preview?.9:.98),farW=w*(preview?.46:.76),travel=2.3/prefs.speed;
  const edge=(p,lane)=>{const width=farW+(nearW-farW)*p;return w/2-width/2+width*lane/6;};
  for(let i=0;i<6;i++){
    ctx.beginPath();ctx.moveTo(edge(0,i),top);ctx.lineTo(edge(0,i+1),top);ctx.lineTo(edge(1,i+1),h);ctx.lineTo(edge(1,i),h);ctx.closePath();ctx.fillStyle=i%2?'#161921':'#11151c';ctx.fill();
    ctx.beginPath();ctx.moveTo(edge(0,i),top);ctx.lineTo(edge(1,i),h);ctx.strokeStyle='#ffffff0d';ctx.lineWidth=1;ctx.stroke();
    if(!preview){const elapsed=(performance.now()-flashes[i])/1000;if(elapsed<.18){const gradient=ctx.createLinearGradient(0,h,0,h*.42);gradient.addColorStop(0,visualLanes[i].color+Math.round((1-elapsed/.18)*110).toString(16).padStart(2,'0'));gradient.addColorStop(1,visualLanes[i].color+'00');ctx.fillStyle=gradient;ctx.beginPath();ctx.moveTo(edge(0,i),top);ctx.lineTo(edge(0,i+1),top);ctx.lineTo(edge(1,i+1),h);ctx.lineTo(edge(1,i),h);ctx.closePath();ctx.fill();}}
  }
  if(mode==='duo'){ctx.beginPath();ctx.moveTo(w/2,top);ctx.lineTo(w/2,h);ctx.strokeStyle='#c7ddd0';ctx.lineWidth=2;ctx.stroke();if(preview){ctx.font='bold 12px monospace';ctx.textAlign='center';ctx.fillStyle=PLAYERS[0].color;ctx.fillText('1P',w*.28,28);ctx.fillStyle=PLAYERS[1].color;ctx.fillText('2P',w*.72,28);}}
  const bpm=selected.bpm||loaded?.analysis.bpm||120,beat=60/bpm;
  for(let b=Math.floor(t/beat);b*beat<t+travel;b++){
    const dt=b*beat-t;if(dt<-.03)continue;const p=1-dt/travel,y=top+(hitY-top)*p;
    ctx.beginPath();ctx.moveTo(edge(p,0),y);ctx.lineTo(edge(p,6),y);ctx.strokeStyle=b%4===0?'#ffffff1c':'#ffffff09';ctx.lineWidth=b%4===0?1.5:1;ctx.stroke();
  }
  const start=preview?0:Math.max(0,run.missCursor-5);
  for(let i=start;i<notes.length;i++){
    const note=notes[i];if(note.t>t+travel)break;if(note.status||note.t<t-.18)continue;
    const p=1-(note.t-t)/travel,y=top+(hitY-top)*p;if(y<-10||y>h)continue;
    const left=edge(p,note.lane)+3,right=edge(p,note.lane+1)-3,noteH=preview?5:Math.max(7,Math.min(12,h*.025));
    ctx.fillStyle=visualLanes[note.lane].color;ctx.shadowBlur=reduceMotion?0:9;ctx.shadowColor=visualLanes[note.lane].color;ctx.fillRect(left,y-noteH/2,Math.max(1,right-left),noteH);ctx.shadowBlur=0;
    ctx.fillStyle='#ffffff88';ctx.fillRect(left+1,y-noteH/2,Math.max(1,right-left-2),2);
  }
  ctx.fillStyle='#f6f3e8';ctx.shadowColor='#fff';ctx.shadowBlur=preview?0:8;ctx.fillRect(edge(1,0),hitY,nearW,2);ctx.shadowBlur=0;
  for(let i=0;i<6;i++){const x=edge(1,i),width=nearW/6;ctx.fillStyle=visualLanes[i].color;ctx.globalAlpha=.7;ctx.fillRect(x+3,hitY+4,width-6,3);ctx.globalAlpha=1;
    if(!preview){ctx.fillStyle='#a4acbb';ctx.font=`600 ${Math.max(9,Math.min(12,h*.037))}px monospace`;ctx.textAlign='center';ctx.fillText(visualLanes[i].short,x+width/2,Math.min(h-3,hitY+20));}
  }
  if(!preview&&!reduceMotion){for(let i=particles.length-1;i>=0;i--){const p=particles[i],age=(performance.now()-p.at)/1000;if(age>.48){particles.splice(i,1);continue;}const x=edge(1,p.lane+.5)+p.vx*age,y=hitY+p.vy*age+90*age*age;ctx.globalAlpha=1-age/.48;ctx.fillStyle=p.color;ctx.fillRect(x,y,3,3);}ctx.globalAlpha=1;}
  const fog=ctx.createLinearGradient(0,0,0,h*.25);fog.addColorStop(0,'#101218');fog.addColorStop(1,'#10121800');ctx.fillStyle=fog;ctx.fillRect(0,0,w,h*.25);
}
function frame(now){
  requestAnimationFrame(frame);
  if(document.hidden)return;
  if(screen==='select'&&!selected.local){
    const t=previewing?Math.max(0,audio.position()):((now/1000-previewOrigin)%Math.max(1,duration()-2));
    highway(previewCtx,previewCanvas,chart,t,true);return;
  }
  if(screen!=='play'||!run||run.paused||run.starting||run.ended)return;
  if(audio.ctx?.state!=='running'){pauseGame();return;}
  const t=position();run.t=t;
  if(t<0){const n=Math.ceil(-t);$('#countdown').textContent=n>3?'READY':String(Math.max(1,n));}
  else if(t<.45)$('#countdown').textContent='GO';else if($('#countdown').textContent)$('#countdown').textContent='';
  if(run.demo){while(run.autoCursor<run.nodes.length&&run.nodes[run.autoCursor].t<=t){const n=run.nodes[run.autoCursor++];judge(n,'perfect');flashPad(n.lane);if(audio.ctx)audio.drum(n.sourceLane??n.lane,audio.ctx.currentTime,.28);}}
  while(run.missCursor<run.nodes.length&&run.nodes[run.missCursor].t<t-.14){const n=run.nodes[run.missCursor++];if(!n.status)judge(n,'miss');}
  highway(gameCtx,gameCanvas,run.nodes,t);
  if(now-run.judgedAt>450)$('#judgment').style.opacity='0';
  if(now-lastUI>60){refreshStats();lastUI=now;}
  if(t>=run.duration+.3)finishGame();
}

async function loadAudio(event){
  const file=event.target.files?.[0];if(!file)return;const generation=++fileGeneration;launch++;stopPreview();
  loaded=null;loading=true;$('#local-options').hidden=true;$('#file-status').textContent='音源を読み込み、アタックを解析中…';updateDifficulty();
  try{
    if(file.size>40*1024*1024)throw new Error('40MB以下の音源を選んでください。');
    await audio.unlock();const buffer=await audio.ctx.decodeAudioData(await file.arrayBuffer());
    if(buffer.duration<10||buffer.duration>480)throw new Error('10秒〜8分の音源を選んでください。');
    // Let the loading message paint before bounded local analysis.
    await new Promise(resolve=>requestAnimationFrame(resolve));const analysis=analyzeAudio(buffer);
    if(analysis.peaks.length<10)throw new Error('リズムを検出できませんでした。音量のある別の音源をお試しください。');
    if(generation!==fileGeneration)return;loaded={buffer,analysis,name:file.name};
    $('#file-status').textContent=`読み込み完了：${file.name}`;$('#local-options').hidden=false;
  }catch(error){if(generation===fileGeneration){loaded=null;$('#file-status').textContent=error.message||'音源を読み込めませんでした。MP3またはWAVをお試しください。';}}
  finally{if(generation===fileGeneration){loading=false;updateDifficulty();}}
}
function stopCalibration(){
  if(calibration){audio.stop();calibration=null;}$('#calibrate-tap').hidden=true;$('#calibrate-button').disabled=false;
}
async function startCalibration(){
  stopPreview();stopCalibration();$('#calibrate-status').textContent='4拍聴いてから、同じリズムで8回タップしてください。';
  try{
    audio.stop();await audio.unlock();audio.bus=audio.ctx.createGain();audio.bus.connect(audio.master);audio.origin=0;audio.running=true;
    const first=audio.ctx.currentTime+.8;
    calibration={first,beats:Array.from({length:16},(_,i)=>first+i*.6),deltas:[],last:-10};
    for(let i=0;i<16;i++)audio.tone(i%4===0?84:76,first+i*.6,.045,.18,'sine','bell');
    $('#calibrate-tap').hidden=false;$('#calibrate-button').disabled=true;$('#calibrate-tap').focus();
  }catch(error){notice(error.message);stopCalibration();}
}
function calibrationTap(){
  if(!calibration)return;const now=audio.position()+audio.origin,index=Math.round((now-calibration.first)/.6);
  if(index<4){$('#calibrate-status').textContent='最初の4拍は聴いてください。';return;}
  if(index>=16){stopCalibration();$('#calibrate-status').textContent='時間が終了しました。もう一度始めてください。';return;}
  if(index<=calibration.last)return;calibration.last=index;calibration.deltas.push((now-calibration.beats[index])*1000);
  $('#calibrate-status').textContent=`${calibration.deltas.length} / 8 回`;
  if(calibration.deltas.length>=8){const a=calibration.deltas.sort((x,y)=>x-y);const value=Math.round(((a[3]+a[4])/2)/5)*5;
    prefs.offset=Math.max(-250,Math.min(250,value));$('#offset').value=prefs.offset;$('#offset-value').textContent=`${prefs.offset>0?'+':''}${prefs.offset} ms`;
    stopCalibration();persist();$('#calibrate-status').textContent=`判定を${prefs.offset>0?'+':''}${prefs.offset} msに合わせました。演奏して微調整してください。`;}
}

makeSongList();setPlayMode(mode,false);
$('#scroll-speed').value=String(prefs.speed);$('#volume').value=Math.round(prefs.volume*100);$('#volume-value').textContent=Math.round(prefs.volume*100)+'%';$('#offset').value=prefs.offset;$('#offset-value').textContent=`${prefs.offset>0?'+':''}${prefs.offset} ms`;
audio.setVolume(prefs.volume);selectTrack(selected);
$('#preview-button').addEventListener('click',async()=>{
  if(previewing||previewPending){launch++;stopPreview();return;}const id=++launch;previewPending=true;
  try{const started=await audio.play(selected,{lead:.1});if(id!==launch||!started)return;previewPending=false;previewing=true;$('#preview-button').textContent='■ 試聴を停止';previewTimer=setTimeout(stopPreview,15000);}
  catch(error){previewPending=false;notice(error.message);}
});
$('#solo-mode').addEventListener('click',()=>setPlayMode('solo'));$('#duo-mode').addEventListener('click',()=>setPlayMode('duo'));
$('#start-button').addEventListener('click',startGame);$('#retry-button').addEventListener('click',startGame);
$('#back-to-list').addEventListener('click',returnToList);$('#quit-button').addEventListener('click',returnToList);
$('#pause-button').addEventListener('click',pauseGame);$('#resume-button').addEventListener('click',resumeGame);$('#restart-button').addEventListener('click',startGame);
$('#pause-dialog').addEventListener('cancel',e=>{e.preventDefault();resumeGame();});
$('#fullscreen-btn').addEventListener('click',fullScreen);
$('#help-button').addEventListener('click',()=>{stopPreview();$('#help-dialog').showModal();});$('#help-close').addEventListener('click',()=>$('#help-dialog').close());
$('#settings-button').addEventListener('click',()=>{stopPreview();$('#calibrate-status').textContent='';$('#settings-dialog').showModal();});
$('#settings-close').addEventListener('click',()=>{stopCalibration();persist();$('#settings-dialog').close();});
$('#settings-dialog').addEventListener('close',stopCalibration);
$('#volume').addEventListener('input',e=>{prefs.volume=Number(e.target.value)/100;audio.setVolume(prefs.volume);$('#volume-value').textContent=e.target.value+'%';persist();});
$('#offset').addEventListener('input',e=>{prefs.offset=Number(e.target.value);$('#offset-value').textContent=`${prefs.offset>0?'+':''}${prefs.offset} ms`;persist();});
$('#scroll-speed').addEventListener('change',e=>{prefs.speed=Number(e.target.value);persist();});
$('#autoplay').addEventListener('change',updateDifficulty);$('#audio-file').addEventListener('change',loadAudio);$('#local-shift').addEventListener('change',updateDifficulty);
$('#calibrate-button').addEventListener('click',startCalibration);$('#calibrate-tap').addEventListener('pointerdown',e=>{e.preventDefault();calibrationTap();});
$('#calibrate-tap').addEventListener('click',e=>{if(e.detail===0)calibrationTap();});
window.addEventListener('keydown',event=>{
  if(event.repeat)return;
  if(calibration&&event.code==='Space'){event.preventDefault();calibrationTap();return;}
  if(screen!=='play'||!run)return;
  if(event.code==='Escape'||event.code==='KeyP'){event.preventDefault();run.paused?resumeGame():pauseGame();return;}
  if(run.paused)return;
  const lane=LANES.findIndex(l=>l.code===event.code);if(lane>=0){event.preventDefault();strike(lane);}
});
document.addEventListener('visibilitychange',()=>{if(document.hidden){stopPreview();stopCalibration();if(screen==='play')pauseGame();}});
window.addEventListener('blur',()=>{if(screen==='play')pauseGame();});
document.addEventListener('fullscreenchange',()=>{$('#fullscreen-btn').setAttribute('aria-pressed',String(!!document.fullscreenElement));$('#fullscreen-btn').textContent=document.fullscreenElement?'全画面を終了':'全画面 ⛶';resizeCanvases();});
window.addEventListener('resize',resizeCanvases);new ResizeObserver(resizeCanvases).observe($('#app'));window.addEventListener('pagehide',()=>{audio.stop();releaseAwake();});
resizeCanvases();requestAnimationFrame(frame);
