/* Operations campaign and authoritative two-player co-op. Graphics stay in the cinematic renderer. */
const OPS = globalThis.BlacksiteRules;
const opsEmptyStats = () => ({kills:0, shots:0, hits:0, objectives:0, intel:0, bosses:0, revives:0, downs:0});
const ops = {
  run:'', incarnation:crypto.randomUUID(), epoch:0, time:0, elapsed:0, playlist:'campaign', weapon:'rifle', wave:1,
  paused:false, lost:false, action:'new', objectives:[], discoveries:[], markers:new Map(),
  stats:opsEmptyStats(), perks:{ammo:0,mobility:0,armor:0}, secondWind:false, pending:null,
  lastShot:0, inputSeq:0, packetSeq:0, gate:OPS.sequenceGate(), shotGate:OPS.sequenceGate(),
  peerId:'', ready:false, peerReady:false, lastPeerAt:0, lastHello:0, lastHeartbeat:0,
  lastHud:0, lastWorld:0, lastPacketAt:0, joinedAt:0, generation:0, waveAt:0,
  present:new Map(), rejected:false, interact:false, checkpoint:null, profile:{unlocked:0,intel:[],best:0},
  netMessage:'', ping:null, reloadingUntil:0, hazards:[], nextWave:0, nextThreat:0
};
try {
  const identity=sessionStorage.getItem('blacksite-player');
  if(identity&&/^[a-zA-Z0-9-]{8,48}$/.test(identity))state.playerId=identity;
  else sessionStorage.setItem('blacksite-player',state.playerId);
  const saved=JSON.parse(localStorage.getItem('blacksite-checkpoint')||'null');
  if(OPS.validCheckpoint(saved))ops.checkpoint=saved;
  const profile=JSON.parse(localStorage.getItem('blacksite-profile')||'null');
  if(profile)ops.profile={unlocked:OPS.clamp(profile.unlocked,0,5),intel:Array.isArray(profile.intel)?profile.intel.filter(x=>/^a[0-5]-intel[0-2]$/.test(x)):[],best:OPS.clamp(profile.best,0,1e9)};
} catch {}

// Same gameplay population at every visual quality; reinforce gradually and reuse dead slots.
DIFF.easy.count=[32,36,40,44,48,52];
DIFF.normal.count=[42,48,54,60,66,72];
DIFF.nightmare.count=[48,54,60,66,72,80];
const OPS_CAPACITY=112;
const OPS_PACKET_KINDS=new Set(['hello','heartbeat','ready','settings','welcome','reject','resync','snapshot','leave','away','pause_request','ping','notice','intel','hurt','hit_ack','hazard','blast','player','shot','reload']);
const opsBaseSpawn=spawnHostWorld;
spawnHostWorld=function(arenaZ){
  opsBaseSpawn(arenaZ);
  const boss=state.enemies.get('boss');
  if(boss){boss.opsHome={x:boss.x,z:boss.z};boss.opsAwake=false;}
  for(const e of state.enemies.values())if(!e.boss)e.hp=e.maxHp=OPS.health(e.type,state.difficulty);
};
const opsBaseHorde=makeHorde;
makeHorde=function(){return opsBaseHorde(OPS_CAPACITY);};

function opsSaveProfile(){try{localStorage.setItem('blacksite-profile',JSON.stringify(ops.profile));}catch{ops.netMessage='この端末では進行状況を保存できません';}}
function opsSaveCheckpoint(){
  if(!isHost()||ops.playlist!=='campaign')return;
  ops.checkpoint={version:OPS.VERSION,area:state.area,seed:state.seed,difficulty:state.difficulty,playlist:ops.playlist,perks:{...ops.perks},stats:{...ops.stats},elapsed:ops.elapsed};
  try{localStorage.setItem('blacksite-checkpoint',JSON.stringify(ops.checkpoint));}catch{ops.netMessage='この端末では途中再開を保存できません';}
}
function opsKnownWeapon(id){return typeof id==='string'&&Object.hasOwn(OPS.WEAPONS,id);}
function opsWeapon(p){return opsKnownWeapon(p?.weapon)?OPS.WEAPONS[p.weapon]:OPS.WEAPONS.rifle;}
function opsCapacity(p){return opsWeapon(p).magazine+ops.perks.ammo*10;}
function opsPlayer(id,weapon='rifle'){
  return {id,x:local.x,z:local.z,yaw:0,pitch:0,lives:3,shield:false,adr:0,weapon:opsKnownWeapon(weapon)?weapon:'rifle',ammo:0,reloadAt:0,fireAt:-1000,invUntil:0,infUntil:0,rpgUntil:0,rpgShots:0,guardUntil:0,downUntil:0,revive:0,interact:false,lastMoveAt:0,lastInput:0,stats:opsEmptyStats()};
}
function opsSafePoint(x,z,r=.85){
  if(!blocked(x,z,r))return {x,z};
  for(let ring=1;ring<=12;ring++)for(let i=0;i<12;i++){const a=i*Math.PI/6,px=x+Math.cos(a)*ring,pz=z+Math.sin(a)*ring;if(!blocked(px,pz,r))return{x:px,z:pz};}
  return cellCenter(Math.floor(state.maze.cols/2),0);
}
function opsPoint(t,side=0){const a=v5RouteAt(t),b=v5RouteAt(Math.min(.97,t+.015));const p=side?v5SidePoint(a,b,side<0?-1:1,Math.abs(side)):a;return opsSafePoint(p.x,p.z);}
function opsClearInputs(){
  keys.clear();touchMove.x=touchMove.y=0;leftTouch=rightTouch=null;lastRight=null;ops.interact=false;
  uxFireStop();uxJoyReset();touchRight.classList.remove('active');
  clearInterval(ops.pcFire);ops.pcFire=0;
}
function opsCanPlay(){return state.running&&!ops.paused&&!ops.lost&&!document.hidden&&state.localLives>0;}
function opsNowPlayer(){return state.players.get(state.playerId);}

// Compact, game-native controls and mission information.
const opsMenu=document.createElement('div');opsMenu.className='ops-menu';
opsMenu.innerHTML='<label>作戦<select id="ops-playlist"><option value="campaign">キャンペーン / 6章</option><option value="survival">サバイバル / 無限ウェーブ</option></select></label><label>装備<select id="ops-weapon"><option value="rifle">アサルト / バランス</option><option value="smg">SMG / 連射</option><option value="marksman">マークスマン / 高威力</option></select></label><label>開始章<select id="ops-chapter"></select></label><label class="ops-upgrade hidden">チーム強化<select id="ops-upgrade"><option value="ammo">拡張マガジン +10</option><option value="mobility">移動速度 +6%</option><option value="armor">被弾後の無敵時間 +0.25秒</option></select></label><button id="ops-resume" type="button">前回の章から再開</button>';
overlay.querySelector('.overlay-card').insertBefore(opsMenu,startBtn);
const opsExitActions=document.createElement('div');opsExitActions.className='ops-exit-actions';
opsExitActions.innerHTML='<button type="button" id="ops-return">ロビーへ戻る</button><button type="button" id="ops-continue-solo" hidden>一人で続行</button>';
overlay.querySelector('.overlay-card').append(opsExitActions);
$('#ops-return').addEventListener('click',async()=>{await send('leave',{});await opsDisconnect();state.mode='solo';syncModeUI();uxLeave();});
$('#ops-continue-solo').addEventListener('click',async()=>{
  if(!ops.lost||!state.running)return;
  await send('leave',{});
  const channel=state.channel;state.channel=null;state.connected=false;state.partnerReady=false;state.mode='solo';state.role='host';
  if(channel)try{await client()?.removeChannel(channel);}catch{}
  for(const id of state.players.keys())if(id!==state.playerId)state.players.delete(id);
  for(const mesh of remoteMeshes.values())scene.remove(mesh);remoteMeshes.clear();
  ops.peerId='';ops.lost=false;ops.paused=false;if(state.localLives<=0)opsRevive(opsNowPlayer());opsShowState();
});
const opsObjective=document.createElement('section');opsObjective.className='ops-objective';opsObjective.setAttribute('aria-label','現在の任務');
opsObjective.innerHTML='<small id="ops-chapter-label">OPERATION</small><strong id="ops-objective-title">通常敵は1発 / デブ・ボスは高耐久</strong><span id="ops-objective-detail"></span><progress id="ops-objective-progress" value="0" max="1"></progress>';
frame.append(opsObjective);
const opsControls=document.createElement('div');opsControls.className='ops-controls';
opsControls.innerHTML='<button type="button" id="ops-pause" aria-label="一時停止">PAUSE</button><button type="button" id="ops-ping" aria-label="仲間に位置を知らせる">PING</button><button type="button" id="ops-interact" aria-label="操作・蘇生を長押し">操作 / 蘇生</button>';
frame.append(opsControls);
const opsConnection=document.createElement('div');opsConnection.className='ops-connection';opsConnection.setAttribute('role','status');frame.append(opsConnection);
const opsHit=document.createElement('div');opsHit.className='ops-hit';opsHit.setAttribute('aria-hidden','true');frame.append(opsHit);
const opsReady=document.createElement('button');opsReady.id='ops-ready';opsReady.type='button';opsReady.textContent='準備完了';
const opsLeave=document.createElement('button');opsLeave.id='ops-leave';opsLeave.type='button';opsLeave.textContent='退出';
const opsShare=document.createElement('button');opsShare.id='ops-share';opsShare.type='button';opsShare.textContent='招待リンクをコピー';
$('#coop-lobby').append(opsReady,opsShare,opsLeave);
const opsJournal=document.createElement('details');opsJournal.className='ops-journal';
opsJournal.innerHTML='<summary>作戦記録・収集した情報</summary><div id="ops-records"></div>';
frame.closest('.outbreak-shell').append(opsJournal);
const opsChooseChapter=$('#ops-chapter'),opsPlaylist=$('#ops-playlist'),opsChooseWeapon=$('#ops-weapon');
function opsMenuUpdate(){
  opsChooseChapter.replaceChildren(...STAGES.map((s,i)=>{const o=document.createElement('option');o.value=String(i);o.textContent=`${i+1} / ${s.jp}${i>ops.profile.unlocked?' — 未解除':''}`;o.disabled=i>ops.profile.unlocked;return o;}));
  opsChooseChapter.disabled=state.role==='guest'||opsPlaylist.value==='survival';
  $('#ops-resume').hidden=!ops.checkpoint||state.role==='guest';
  const records=$('#ops-records');records.replaceChildren();
  const head=document.createElement('p');head.textContent=`記録 ${ops.profile.intel.length} / 18　最高スコア ${ops.profile.best.toLocaleString()}`;records.append(head);
  OPS.CHAPTERS.forEach((c,i)=>{const title=document.createElement('h3');title.textContent=`${i+1}. ${STAGES[i].jp} — ${c.title}`;records.append(title);const text=document.createElement('p');text.textContent=c.brief;records.append(text);c.intel.forEach((s,j)=>{const p=document.createElement('p');p.textContent=ops.profile.intel.includes(`a${i}-intel${j}`)?s:'未回収の記録';records.append(p);});});
}
opsMenuUpdate();
opsPlaylist.addEventListener('change',()=>{if(state.running||state.role==='guest')return;ops.playlist=opsPlaylist.value;opsMenuUpdate();opsSendSettings();});
opsChooseWeapon.addEventListener('change',()=>{if(state.running)return;ops.weapon=opsChooseWeapon.value;ops.ready=false;send('ready',{ready:false,weapon:ops.weapon});updateLobby();});
$('#ops-resume').addEventListener('click',()=>{if(ops.checkpoint&&isHost()&&!state.running){ops.action='resume';resetMission();uxEnter(false);}});
$('#ops-interact').addEventListener('pointerdown',e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);ops.interact=true;});
for(const type of ['pointerup','pointercancel','lostpointercapture'])$('#ops-interact').addEventListener(type,()=>ops.interact=false);
$('#ops-pause').addEventListener('click',()=>opsSetPause(!ops.paused));
$('#ops-ping').addEventListener('click',()=>opsPing());
addEventListener('keydown',e=>{if(e.code==='Escape'&&!e.repeat&&state.running){e.preventDefault();opsSetPause(!ops.paused);}if(e.code==='KeyQ'&&!e.repeat)opsPing();});
addEventListener('blur',opsClearInputs);
canvas.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button===0&&pointerLocked&&opsCanPlay()){shoot();clearInterval(ops.pcFire);ops.pcFire=setInterval(()=>shoot(),25);}});
addEventListener('pointerup',e=>{if(e.pointerType==='mouse'){clearInterval(ops.pcFire);ops.pcFire=0;}});
document.addEventListener('visibilitychange',()=>{if(document.hidden){opsClearInputs();if(state.running){if(isHost())opsSetPause(true);else send('pause_request',{});}}});
startBtn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();if(state.running){opsSetPause(false);return;}resetMission();},{capture:true});

function opsSetPause(paused){
  if(!state.running)return;
  if(!isHost()){send('pause_request',{paused});toast('ホストに一時停止／再開をリクエスト');return;}
  ops.paused=paused;opsClearInputs();opsShowState();sendWorld(true);
}
function opsShowState(){
  frame.dataset.opsPlaying=state.running?'1':'0';opsMenu.classList.toggle('hidden',state.running);
  if(state.running&&(ops.paused||ops.lost)){
    setOverlay(ops.lost?'再接続を待っています':'一時停止',ops.lost?'進行状況を保持しています。接続が戻ると同じ戦闘を再開できます。':'Esc / PAUSE で再開。協力プレイでは2人の進行を同時に止めます。',isHost()?'再開':'ホストの再開を待つ',true);
    startBtn.disabled=ops.lost||!isHost();
  }else if(state.running){overlay.classList.add('hidden');startBtn.disabled=false;}
  $('#ops-continue-solo').hidden=!(state.running&&ops.lost);
}

function opsBuildObjectives(){
  ops.markers.clear();ops.hazards=[];ops.waveAt=ops.time;
  ops.objectives=OPS.CHAPTERS[state.area].objectives.map(o=>({...o,...opsPoint(o.t),progress:0,done:false,started:false,killStart:0,lastWave:0}));
  ops.discoveries=[];
  for(let i=0;i<3;i++)ops.discoveries.push({id:`a${state.area}-intel${i}`,kind:'intel',label:`記録 ${i+1}`,text:OPS.CHAPTERS[state.area].intel[i],...opsPoint([.3,.57,.82][i],i%2?11:-11),done:false});
  for(let i=0;i<2;i++)ops.discoveries.push({id:`a${state.area}-cache${i}`,kind:'cache',label:'補給拠点',...opsPoint([.35,.64][i],i%2?-9:9),done:false});
  if(ops.playlist==='survival'){ops.objectives=[];ops.discoveries=[];}
  opsRenderMarkers();
}
function opsRenderMarkers(){
  for(const o of [...ops.objectives,...ops.discoveries]){
    let g=ops.markers.get(o.id);
    if(!g){
      const color=o.kind==='intel'?0x82dfff:o.kind==='cache'?0x89ffa7:0xffcd70;
      g=new THREE.Group();const ring=new THREE.Mesh(new THREE.RingGeometry(1.8,2,32),new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide,transparent:true,opacity:.65,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.y=.09;g.add(ring);
      g.add(expansionTextSprite(o.label,color));
      if(o.kind==='escort'){const npc=humanoid(CM.amber);g.add(npc);}
      scene.add(g);ops.markers.set(o.id,g);
    }
    g.position.set(o.x,0,o.z);g.visible=!o.done&&(o.kind==='intel'||o.kind==='cache'||o===ops.objectives.find(x=>!x.done));
  }
}
function opsDisposePickup(item){if(!item?.mesh)return;scene.remove(item.mesh);item.mesh.traverse?.(o=>{o.geometry?.dispose?.();if(o.material){o.material.map?.dispose?.();o.material.dispose?.();}});}
const opsSpawnDrop=expansionSpawnDrop;
expansionSpawnDrop=function(e){
  // Long survival runs cannot accumulate an unbounded list of GPU pickup objects.
  while(state.items.size>=16){const [id,item]=state.items.entries().next().value;opsDisposePickup(item);state.items.delete(id);}
  return opsSpawnDrop(e);
};
checkItems=function(){
  if(!isHost()||!state.running||ops.paused||ops.lost)return;
  for(const item of state.items.values())if(!item.taken){const p=[...state.players.values()].find(p=>p.lives>0&&(item.type!=='life'||p.lives<3)&&Math.hypot(p.x-item.x,p.z-item.z)<1.4);if(p)applyItemToPlayer(item,p);}
  for(const [id,item]of state.items)if(item.taken){opsDisposePickup(item);state.items.delete(id);}
};
function opsNewArea(){
  ops.epoch++;ops.pending=null;ops.nextWave=0;ops.paused=false;ops.secondWind=false;opsClearInputs();
  ops.lastShot=0;ops.reloadingUntil=0;
  state.running=false;state.enemies.clear();state.items.clear();damageCooldown.clear();
  const players=[...state.players.values()];state.localLives=3;state.shield=false;state.adrenalineUntil=0;
  const arenaZ=buildEnvironment();cineMakeWeapon();
  state.players.clear();
  players.forEach((old,i)=>{const p=opsPlayer(old.id,old.weapon);const start=opsSafePoint(local.x+i*2,local.z-i*2);Object.assign(p,start,{stats:old.stats||opsEmptyStats(),incarnation:old.incarnation,guardUntil:ops.time+3000});p.ammo=opsCapacity(p);state.players.set(p.id,p);});
  if(!state.players.has(state.playerId)){const p=opsPlayer(state.playerId,ops.weapon);p.ammo=opsCapacity(p);state.players.set(p.id,p);}
  const me=opsNowPlayer();local.x=me.x;local.z=me.z;state.localLives=me.lives;uxAmmo=me.ammo;uxReloading=false;clearTimeout(uxReloadTimer);
  expansionPowerReset();state.bossAbilityAt=ops.time+4000;state.bossSummonAt=ops.time+8000;
  if(isHost())spawnHostWorld(arenaZ);
  opsBuildObjectives();
  if(ops.playlist==='survival'&&isHost()){
    const arena=opsSafePoint(0,arenaZ+15);Object.assign(local,arena);for(const [i,p]of [...state.players.values()].entries())Object.assign(p,opsSafePoint(arena.x+i*2,arena.z));
    for(const e of state.enemies.values())e.dead=true;opsStartWave();
  }
  state.running=true;state.completed=false;ops.action='retry';state.areaStartedAt=performance.now();
  ops.lost=state.mode==='coop'&&(!state.connected||!state.partnerReady);
  updateCamera();updateHordeVisuals(performance.now());opsSaveCheckpoint();opsShowState();sendWorld(true);
  toast(ops.playlist==='survival'?`SURVIVAL — WAVE ${ops.wave}`:`${OPS.CHAPTERS[state.area].title} — ${OPS.CHAPTERS[state.area].brief}`,5000);
}
beginArea=function(){opsNewArea();};
resetMission=function(){
  if(!isHost()||(state.mode==='coop'&&(!state.partnerReady||(!ops.ready||!ops.peerReady)&&ops.action!=='next'&&ops.action!=='retry'))){toast('2人とも準備完了にしてください');return;}
  if(ops.action==='next'){
    const perk=$('#ops-upgrade').value;if(Object.hasOwn(ops.perks,perk))ops.perks[perk]=Math.min(3,ops.perks[perk]+1);
    state.area++;state.seed=(state.seed+0x9e3779b9)>>>0;ops.profile.unlocked=Math.max(ops.profile.unlocked,state.area);opsSaveProfile();
  }else if(ops.action!=='retry'){
    ops.run=crypto.randomUUID();ops.time=0;ops.elapsed=0;ops.stats=opsEmptyStats();ops.perks={ammo:0,mobility:0,armor:0};ops.wave=1;state.completed=false;
    ops.playlist=opsPlaylist.value;state.area=ops.playlist==='survival'?0:OPS.clamp(Number(opsChooseChapter.value),0,ops.profile.unlocked);state.seed=Date.now()>>>0;
    if(ops.action==='resume'&&ops.checkpoint){const c=ops.checkpoint;state.area=c.area;state.seed=c.seed;state.difficulty=c.difficulty;ops.playlist=c.playlist;ops.elapsed=OPS.clamp(c.elapsed,0,1e9);for(const k of Object.keys(ops.perks))ops.perks[k]=OPS.clamp(c.perks?.[k],0,3);for(const k of Object.keys(ops.stats))ops.stats[k]=OPS.clamp(c.stats?.[k],0,1e7);}
    const peer=state.players.get(ops.peerId);state.players.clear();state.players.set(state.playerId,opsPlayer(state.playerId,ops.weapon));if(state.mode==='coop'&&ops.peerId)state.players.set(ops.peerId,opsPlayer(ops.peerId,peer?.weapon));
  }
  opsNewArea();syncDifficultyUI();
};
clearArea=function(){
  if(!state.running||!isHost())return;
  state.running=false;opsClearInputs();
  if(state.area===5){completeMission();return;}
  ops.action='next';ops.profile.unlocked=Math.max(ops.profile.unlocked,state.area+1);opsSaveProfile();opsAreaResult();sendWorld(true);
};
function opsAreaResult(){
  const r=OPS.score(ops.stats,state.difficulty);opsMenu.classList.remove('hidden');opsMenu.classList.add('ops-between');$('.ops-upgrade').classList.remove('hidden');
  setOverlay(`AREA ${state.area+1} CLEAR`,`${currentStage().jp}を突破。撃破 ${ops.stats.kills} / 命中率 ${r.accuracy}% / ${r.points.toLocaleString()}点。チーム強化を選んで次の章へ。`,isHost()?'次の章へ':'ホストの出発を待つ',true);startBtn.disabled=!isHost();
}
completeMission=function(){
  state.running=false;state.completed=true;ops.action='new';opsClearInputs();const r=OPS.score(ops.stats,state.difficulty);
  ops.profile.best=Math.max(ops.profile.best,r.points);opsSaveProfile();opsMenu.classList.remove('hidden','ops-between');$('.ops-upgrade').classList.add('hidden');opsMenuUpdate();
  setOverlay(ops.playlist==='survival'?`SURVIVAL / WAVE ${ops.wave}`:'BLACK SITE — 夜明けの帰還',`RANK ${r.rank} / ${r.points.toLocaleString()}点 / 撃破 ${ops.stats.kills} / 命中率 ${r.accuracy}% / 記録 ${ops.stats.intel} / 蘇生 ${ops.stats.revives} / ${fmt(ops.elapsed/1000)}。`,isHost()?'もう一度出撃':'ホストの再出撃を待つ',true);startBtn.disabled=!isHost();
  if(isHost()){
    sendWorld(true);
    if(ops.recordedRun!==ops.run&&window.GameBackend?.ready){ops.recordedRun=ops.run;window.GameBackend.recordScore({gameId:'outbreak23',mode:state.mode==='coop'?'online':'solo',score:r.points,durationMs:Math.round(ops.elapsed),roomCode:state.room||null,extra:{version:OPS.VERSION,difficulty:state.difficulty,playlist:ops.playlist,wave:ops.wave,area:state.area+1,rank:r.rank,stats:ops.stats}}).catch(()=>toast('成績はこの端末に保存済みです。オンライン記録は送信できませんでした。',3000));}
  }
};
failMission=function(reason){if(!isHost())return;state.running=false;ops.action='retry';opsClearInputs();setOverlay('部隊壊滅',reason,'この章をやり直す',true);startBtn.disabled=false;sendWorld(true);};

function opsActiveObjective(){return ops.objectives.find(o=>!o.done);}
function opsThreatAt(x,z,r=6){return [...state.enemies.values()].some(e=>!e.dead&&(!e.boss||e.opsAwake)&&Math.hypot(e.x-x,e.z-z)<r);}
function opsReinforce(count,point){
  let spawned=0;const alive=[...state.enemies.values()].filter(e=>!e.dead&&!e.boss).length;if(alive>=84)return;
  for(let slot=0;slot<OPS_CAPACITY&&spawned<Math.min(count,84-alive);slot++){
    const id=`z${slot}`,old=state.enemies.get(id);if(old&&!old.dead)continue;
    const rand=mulberry32(state.seed^Math.floor(ops.time)^slot*919),a=rand()*Math.PI*2,dist=18+rand()*9,p=opsSafePoint(point.x+Math.cos(a)*dist,point.z+Math.sin(a)*dist);
    if([...state.players.values()].some(p2=>Math.hypot(p2.x-p.x,p2.z-p.z)<12))continue;
    const e={id,index:slot,...p,hp:1,maxHp:1,dead:false,boss:false,phase:rand()*6.28,visualYaw:0,woundSide:slot%2?1:-1,headTilt:0};
    v5TuneEnemy(e,V5_TYPES[Math.floor(rand()*V5_TYPES.length)],difficulty(),state.seed^slot);state.enemies.set(id,e);spawned++;
  }
  if(spawned)v5TintEnemies();return spawned;
}
function opsObjectiveTick(dt){
  if(ops.playlist==='survival'){opsSurvivalTick();return;}
  const o=opsActiveObjective(),living=[...state.players.values()].filter(p=>p.lives>0);
  if(o){
    const near=living.filter(p=>Math.hypot(p.x-o.x,p.z-o.z)<(o.kind==='escort'?8:5));
    if(near.length&&!o.started){o.started=true;o.killStart=ops.stats.kills;o.lastWave=ops.time;opsReinforce(o.kind==='purge'?o.target:8,o);}
    if(o.started){
      if(['defend','purge','escort'].includes(o.kind)&&ops.time-o.lastWave>10000){o.lastWave=ops.time;opsReinforce(o.kind==='purge'?8:5,o);}
      const next=OPS.objectiveStep(o,dt,{near:near.length>0,contested:opsThreatAt(o.x,o.z),interact:near.some(p=>p.interact),kills:ops.stats.kills});
      Object.assign(o,next);
      if(o.kind==='escort'){const pos=opsPoint(o.t+.15*(o.progress/o.target));o.x=pos.x;o.z=pos.z;}
      if(o.done){ops.stats.objectives++;for(const p of living)p.stats.objectives++;toast(`目標達成 — ${o.label}`,2300);send('notice',{text:`目標達成 — ${o.label}`});sendWorld(true);}
    }
  }
  for(const d of ops.discoveries)if(!d.done){const p=living.find(p=>p.interact&&Math.hypot(p.x-d.x,p.z-d.z)<3.5);if(!p)continue;d.done=true;
    if(d.kind==='intel'){ops.stats.intel++;p.stats.intel++;opsRecordIntel(d);send('intel',{id:d.id,text:d.text});}
    else{for(const mate of living){mate.lives=Math.min(3,mate.lives+1);mate.ammo=opsCapacity(mate);mate.reloadAt=0;}state.localLives=opsNowPlayer().lives;toast('補給確保 — チーム全員のライフ+1・弾倉補充',2300);send('notice',{text:'補給確保 — チーム全員のライフ+1・弾倉補充'});}
  }
  const boss=state.enemies.get('boss');if(boss&&!boss.dead&&!opsActiveObjective()&&!boss.opsAwake){boss.opsAwake=true;state.bossAbilityAt=ops.time+4000;toast(`${currentStage().boss} — ボス戦開始`,2600);}
  opsRenderMarkers();
}
function opsRecordIntel(d){if(!ops.profile.intel.includes(d.id)){ops.profile.intel.push(d.id);opsSaveProfile();}toast(d.text,5500);}
function opsStartWave(){
  ops.nextWave=0;ops.waveAt=ops.time;const boss=state.enemies.get('boss');if(boss){boss.dead=ops.wave%5!==0;boss.opsAwake=!boss.dead;if(!boss.dead){boss.hp=boss.maxHp=Math.round(difficulty().bossHp[state.area]*(1+Math.floor(ops.wave/5)*.2));Object.assign(boss,boss.opsHome);}}
  opsReinforce(Math.min(60,8+ops.wave*3),opsNowPlayer());toast(`WAVE ${ops.wave}${ops.wave%5===0?' / BOSS':''}`,2200);
}
function opsSurvivalTick(){
  if([...state.enemies.values()].some(e=>!e.dead))return;
  if(!ops.nextWave){ops.nextWave=ops.time+5000;for(const p of state.players.values()){p.lives=Math.min(3,p.lives+1);p.ammo=opsCapacity(p);}state.localLives=opsNowPlayer().lives;toast('ウェーブクリア — 5秒後に次の感染群',1800);}
  else if(ops.time>=ops.nextWave){ops.wave++;opsStartWave();}
}

// Resolve all shots on the host, against its world, including invisible collision boxes.
function opsTrace(p,aim){
  const yaw=OPS.clamp(aim.yaw,-1000,1000),pitch=OPS.clamp(aim.pitch,-1.2,1.2),c=Math.cos(pitch);
  const origin={x:p.x,y:1.72,z:p.z},direction={x:-Math.sin(yaw)*c,y:Math.sin(pitch),z:-Math.cos(yaw)*c};
  let distance=125,target=null,weak=false;
  for(const box of state.walls)distance=Math.min(distance,OPS.rayBox(origin,direction,box));
  for(const e of state.enemies.values()){
    if(e.dead||(e.boss&&!e.opsAwake))continue;
    if(e.boss){
      const scale=currentStage().bossScale,a=e.visualYaw||0;
      const core={x:e.x+Math.sin(a)*.49*scale,y:1.91*scale,z:e.z+Math.cos(a)*.49*scale};
      const cw=OPS.raySphere(origin,direction,core,.29*scale),body=OPS.raySphere(origin,direction,{x:e.x,y:1.5*scale,z:e.z},.84*scale),head=OPS.raySphere(origin,direction,{x:e.x,y:2.58*scale,z:e.z},.47*scale);
      const legs=[-1,1].map(side=>OPS.raySphere(origin,direction,{x:e.x+Math.cos(a)*side*.33*scale,y:.55*scale,z:e.z-Math.sin(a)*side*.33*scale},.4*scale));
      const d=Math.min(cw,body,head,...legs);if(d<distance){distance=d;target=e;weak=Number.isFinite(cw)&&cw<=d+scale*.7;}
    }else{
      const low=['crawler','hound','dog','stalker','licker','leaper'].includes(e.type),fat=OPS.FAT_TYPES.includes(e.type),height=low?.63:fat?1.46:1.31,headY=low?.82:fat?2.5:2.05;
      const head=OPS.raySphere(origin,direction,{x:e.x,y:headY,z:e.z},fat?.4:.32),body=OPS.raySphere(origin,direction,{x:e.x,y:height,z:e.z},fat?.78:low?.65:.59),leg=low?Infinity:OPS.raySphere(origin,direction,{x:e.x,y:.5,z:e.z},fat?.58:.36);
      const d=Math.min(head,body,leg);if(d<distance){distance=d;target=e;weak=head===d;}
    }
  }
  return {enemy:target,weak,distance,x:origin.x+direction.x*distance,z:origin.z+direction.z*distance};
}
function opsDamageEnemy(e,p,weak=false,blast=false){
  if(!e||e.dead)return;const dmg=OPS.damage(e,p.weapon,weak,blast);e.hp=Math.max(0,e.hp-dmg);
  if(e.hp===0){e.dead=true;ops.stats.kills++;p.stats.kills++;
    if(e.boss){ops.stats.bosses++;p.stats.bosses++;ops.stats.objectives++;if(bossMesh)bossMesh.visible=false;removeBossGate();}
    else expansionRegisterKill(e);
    if(e.type==='bloater')opsHazard(e.x,e.z,4.5,1000,'BURST');
  }
}
hostHit=function(id,playerId,weak=false){const p=state.players.get(playerId);if(isHost()&&p?.lives>0)opsDamageEnemy(state.enemies.get(id),p,weak);};
function opsHostShoot(p,aim,seq){
  if(!p||p.lives<=0||!state.running||ops.paused||ops.lost||!Number.isFinite(aim.yaw)||!Number.isFinite(aim.pitch)||!ops.shotGate.accept(`${p.id}:${p.incarnation||ops.incarnation}:${ops.run}`,seq))return;
  p.lastInput=seq;const w=opsWeapon(p),launcher=p.rpgUntil>ops.time&&p.rpgShots>0;
  if(p.reloadAt>ops.time||ops.time-p.fireAt<(launcher?520:w.interval)-12)return;
  if(!launcher&&p.infUntil<=ops.time&&p.ammo<=0)return;
  p.fireAt=ops.time;if(launcher)p.rpgShots--;else if(p.infUntil<=ops.time)p.ammo--;
  p.stats.shots++;ops.stats.shots++;const hit=opsTrace(p,aim);let killed=false,didHit=!!hit.enemy;
  if(launcher){for(const e of state.enemies.values())if(!e.dead&&(!e.boss||e.opsAwake)&&Math.hypot(e.x-hit.x,e.z-hit.z)<9.5){opsDamageEnemy(e,p,false,true);killed||=e.dead;didHit=true;}expansionBlastVisual(hit.x,hit.z);send('blast',{x:hit.x,z:hit.z});}
  else if(hit.enemy){opsDamageEnemy(hit.enemy,p,hit.weak);killed=hit.enemy.dead;}
  if(didHit){p.stats.hits++;ops.stats.hits++;}
  if(p.id===state.playerId)opsConfirmHit(didHit,killed,hit.weak,hit.enemy?.hp);
  else send('hit_ack',{target:p.id,hit:didHit,killed,weak:hit.weak,hp:hit.enemy?.hp||0,seq});
  sendWorld(true);
}
function opsConfirmHit(hit,killed,weak,hp){opsHit.textContent=hit?(killed?'撃破':`${weak?'弱点 / ':''}${hp} HP`):'';opsHit.classList.toggle('kill',killed);opsHit.classList.toggle('show',hit);opsHit.dataset.until=String(performance.now()+400);}
shoot=function(){
  if(!opsCanPlay())return;const now=performance.now(),p=opsNowPlayer();if(!p)return;
  if(now<ops.lastShot||p.reloadAt>ops.time||uxReloading)return;
  const rpg=p.rpgUntil>ops.time&&p.rpgShots>0;if(!rpg&&p.infUntil<=ops.time&&p.ammo<=0){uxReload();return;}
  ops.lastShot=now+(rpg?520:opsWeapon(p).interval);const seq=++ops.inputSeq;
  if(isHost())opsHostShoot(p,{yaw:local.yaw,pitch:local.pitch},seq);else{send('shot',{yaw:local.yaw,pitch:local.pitch,shotSeq:seq});if(!rpg&&p.infUntil<=ops.time)p.ammo=Math.max(0,p.ammo-1);}
  uxWeaponKick();cineKick=Math.min(.085,cineKick+.047);cineLastShot=now;
};
function opsHostReload(p){if(p&&p.lives>0&&state.running&&!ops.paused&&!ops.lost&&p.ammo<opsCapacity(p)&&!p.reloadAt){p.reloadAt=ops.time+opsWeapon(p).reload;sendWorld(true);}}
uxReload=function(){if(!opsCanPlay())return;const p=opsNowPlayer();if(!p)return;if(isHost())opsHostReload(p);else{send('reload',{});ops.reloadingUntil=performance.now()+opsWeapon(p).reload;}};
uxUpdateAmmo=function(){const p=opsNowPlayer();if(!p)return;uxAmmo=p.ammo;uxReloading=p.reloadAt>ops.time||ops.reloadingUntil>performance.now();const rpg=p.rpgUntil>ops.time&&p.rpgShots>0,inf=p.infUntil>ops.time;uxAmmoCount.textContent=rpg?`RPG ${p.rpgShots} / 10`:inf?'∞':`${p.ammo} / ${opsCapacity(p)}`;uxReloadBtn.disabled=!state.running||ops.paused||uxReloading||rpg||inf||p.ammo>=opsCapacity(p);uxReloadBtn.textContent=uxReloading?'装填中…':'RELOAD';uxAmmoPanel.classList.toggle('empty',p.ammo===0&&!uxReloading);uxAmmoPanel.classList.toggle('reloading',uxReloading);};
expansionPowerHud=function(){const p=opsNowPlayer();if(!p)return;const text=[];for(const [key,name]of [['infUntil','無限弾薬'],['invUntil','完全無敵'],['rpgUntil','ランチャー']])if(p[key]>ops.time)text.push(`${name} ${Math.ceil((p[key]-ops.time)/1000)}秒`);expansionPowerPanel.textContent=`${opsWeapon(p).name} / 撃破 ${ops.stats.kills}　${text.join(' / ')||'20体撃破ごとに強化ドロップ'}`;itemStatus.textContent=text.join(' / ')||'通常敵1発 / デブ・ボス高耐久';uxUpdateAmmo();};
applyItemToPlayer=function(item,p){
  if(item.taken||!isHost()||p.lives<=0)return;item.taken=true;if(item.mesh)item.mesh.visible=false;
  if(item.type==='life')p.lives=Math.min(3,p.lives+1);
  if(item.type==='infinite')p.infUntil=ops.time+30000;
  if(item.type==='invincible')p.invUntil=ops.time+30000;
  if(item.type==='launcher'){p.rpgUntil=ops.time+30000;p.rpgShots=10;}
  state.localLives=opsNowPlayer().lives;toast(`${EXP_ITEMS[item.type]?.label||'補給'}を確保`,1300);sendWorld(true);
};

// Telegraphs use simulation time. Spit and shockwaves damage only players still in the impact zone.
function opsHazard(x,z,radius,delay,kind){
  const h={x,z,radius,at:ops.time+delay,kind};ops.hazards.push(h);opsHazardVisual(h);send('hazard',{...h});
}
function opsHazardVisual(h){const ring=new THREE.Mesh(new THREE.RingGeometry(h.radius-.12,h.radius,36),new THREE.MeshBasicMaterial({color:h.kind==='ACID'?0xa2f36d:0xff654a,side:THREE.DoubleSide,transparent:true,opacity:.8,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.set(h.x,.12,h.z);scene.add(ring);state.stageVisuals.push({type:'opsHazard',mesh:ring,end:h.at});}
const opsStageVisuals=updateStageVisuals;
updateStageVisuals=function(now){opsStageVisuals(now);state.stageVisuals=state.stageVisuals.filter(v=>{if(v.type==='opsHazard'&&ops.time>=v.end){scene.remove(v.mesh);v.mesh.geometry.dispose();v.mesh.material.dispose();return false;}return true;});};
function opsMoveEnemy(e,dx,dz,step,radius){
  const len=Math.hypot(dx,dz)||1;dx=dx/len*step;dz=dz/len*step;
  if(!blocked(e.x+dx,e.z+dz,radius)){e.x+=dx;e.z+=dz;return;}
  if(!blocked(e.x+dx,e.z,radius))e.x+=dx;
  if(!blocked(e.x,e.z+dz,radius))e.z+=dz;
  if(blocked(e.x+dx,e.z+dz,radius)){const side=(e.index||0)%2?1:-1;if(!blocked(e.x-dz*side,e.z+dx*side,radius)){e.x-=dz*side;e.z+=dx*side;}}
}
damagePlayer=function(id,reason='感染体の攻撃'){
  const p=state.players.get(id);if(!isHost()||!p||p.lives<=0||ops.paused||ops.lost||p.invUntil>ops.time||p.guardUntil>ops.time)return;
  if(p.shield){p.shield=false;p.guardUntil=ops.time+1000;return;}
  p.lives--;p.guardUntil=ops.time+Math.max(650,difficulty().touchCd*1000)+ops.perks.armor*250;
  if(id===state.playerId){state.localLives=p.lives;flashDamage(reason);}else send('hurt',{target:id,reason});
  if(p.lives===0){p.interact=false;p.downUntil=ops.time+10000;ops.stats.downs++;p.stats.downs++;toast('味方がダウン — 近づいて操作長押しで蘇生',2200);}
  const living=[...state.players.values()].filter(p=>p.lives>0);
  if(!living.length){
    if(ops.playlist==='survival'){completeMission();return;}
    if(state.mode==='solo'&&!ops.secondWind){ops.secondWind=true;ops.pending={type:'revive',at:performance.now()+2200};state.running=false;setOverlay('SECOND WIND','一度だけ、その場で立て直せます。','復帰中…',true);startBtn.disabled=true;}
    else if(state.mode==='coop'){ops.pending={type:'retry',at:performance.now()+3000};state.running=false;setOverlay('部隊壊滅','3秒後にこの章を2人ともライフ3で再開します。','再展開中…',true);startBtn.disabled=true;}
    else failMission('ライフを失いました。この章の最初から再挑戦できます。');
  }
  sendWorld(true);
};
function opsRevive(p,helper=null){
  const mate=helper||[...state.players.values()].find(x=>x.id!==p.id&&x.lives>0)||p;Object.assign(p,opsSafePoint(mate.x+2,mate.z+2));p.lives=3;p.guardUntil=ops.time+3000;p.downUntil=0;p.revive=0;p.ammo=opsCapacity(p);p.teleport=(p.teleport||0)+1;
  if(helper){ops.stats.revives++;helper.stats.revives++;}
  if(p.id===state.playerId){Object.assign(local,{x:p.x,z:p.z});state.localLives=3;updateCamera();}
  send('notice',{text:helper?'仲間を蘇生しました':'ライフ3で戦線復帰'});sendWorld(true);
}
function opsPlayerTick(dt){
  for(const p of state.players.values()){
    if(p.reloadAt&&ops.time>=p.reloadAt){p.ammo=opsCapacity(p);p.reloadAt=0;}
    if(p.lives<=0){const helper=[...state.players.values()].find(x=>x.id!==p.id&&x.lives>0&&x.interact&&Math.hypot(x.x-p.x,x.z-p.z)<3.5);p.revive=helper?p.revive+dt:0;if(p.revive>=2||p.downUntil&&ops.time>=p.downUntil)opsRevive(p,helper);}
  }
}
hostWorldStep=function(dt){
  if(!isHost()||!state.running||ops.paused||ops.lost||document.hidden)return;
  dt=Math.min(.05,dt);ops.time+=dt*1000;ops.elapsed+=dt*1000;
  opsPlayerTick(dt);opsObjectiveTick(dt);
  const alive=[...state.enemies.values()].filter(e=>!e.dead);
  for(const e of alive){
    const n=nearestLivingPlayer(e);if(!n)continue;
    if(e.boss&&!e.opsAwake)continue;
    if(!e.boss&&n.d>90)continue;
    const dx=n.p.x-e.x,dz=n.p.z-e.z;let speed=e.v5BaseSpeed||e.speed;e.visualYaw=Math.atan2(dx,dz);
    if(e.boss){
      const phase=bossPhase(e);e.phase=phase;speed=e.speed*(1+(phase-1)*.2);
      if(!e.opsAttackAt)e.opsAttackAt=ops.time+3500;
      if(ops.time>e.opsAttackAt){e.opsAttackAt=ops.time+4500-(phase-1)*650;const type=state.area%3;
        if(type===0&&n.d>9){e.chargeStart=ops.time+900;e.chargeEnd=ops.time+1900;e.chargeX=dx/(n.d||1);e.chargeZ=dz/(n.d||1);opsHazard(n.p.x,n.p.z,3.5,1400,'CHARGE');}
        else if(type===1){opsHazard(n.p.x,n.p.z,4.5,1200,'IMPACT');}
        else opsHazard(e.x,e.z,7+phase,1150,'SHOCKWAVE');
        if(phase===3)opsReinforce(4,e);
      }
      if(e.chargeEnd>ops.time&&e.chargeStart<=ops.time){opsMoveEnemy(e,e.chargeX,e.chargeZ,speed*3.5*dt,1.25);}else opsMoveEnemy(e,dx,dz,speed*dt,1.25);
    }else{
      if(e.type==='spitter'&&n.d>5&&n.d<22){if(ops.time>(e.opsSpitAt||0)){e.opsSpitAt=ops.time+4600;opsHazard(n.p.x,n.p.z,2.5,1000,'ACID');}speed*=n.d<10?-.5:.25;}
      if(e.type==='leaper'){if(ops.time>(e.opsLeapAt||0)){e.opsLeapAt=ops.time+4400;e.leapStart=ops.time+650;e.leapEnd=ops.time+1100;}if(e.leapStart>ops.time)speed*=.1;else if(e.leapEnd>ops.time)speed*=2.3;}
      let sx=dx,sz=dz;for(const other of alive){if(other===e||other.boss)continue;const ox=e.x-other.x,oz=e.z-other.z,dist=ox*ox+oz*oz;if(dist>.001&&dist<1.5){sx+=ox/Math.max(.2,dist)*2;sz+=oz/Math.max(.2,dist)*2;}}
      opsMoveEnemy(e,sx,sz,speed*dt,OPS.FAT_TYPES.includes(e.type)?.8:.5);
    }
    const reach=e.boss?2.7:OPS.FAT_TYPES.includes(e.type)?1.6:1.15;
    if(n.d<reach){if(!e.windupAt)e.windupAt=ops.time+(e.boss?700:400);if(ops.time>=e.windupAt){if(Math.hypot(e.x-n.p.x,e.z-n.p.z)<reach+.3)damagePlayer(n.p.id,e.boss?'ボスの打撃':'感染体の攻撃');e.windupAt=ops.time+1100;}}else e.windupAt=0;
  }
  ops.hazards=ops.hazards.filter(h=>{if(ops.time<h.at)return true;for(const p of state.players.values())if(p.lives>0&&Math.hypot(p.x-h.x,p.z-h.z)<h.radius)damagePlayer(p.id,h.kind==='ACID'?'酸の着弾':'範囲攻撃');return false;});
  checkItems();
};
updateLocal=function(dt){
  if(!opsCanPlay())return;
  let f=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0)-touchMove.y,s=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+touchMove.x;
  const length=Math.max(1,Math.hypot(f,s));f/=length;s/=length;const sp=difficulty().speed*(1+ops.perks.mobility*.06),dx=(-Math.sin(local.yaw)*f+Math.cos(local.yaw)*s)*sp*dt,dz=(-Math.cos(local.yaw)*f-Math.sin(local.yaw)*s)*sp*dt;
  if(!blocked(local.x+dx,local.z,.68))local.x+=dx;if(!blocked(local.x,local.z+dz,.68))local.z+=dz;
  const p=opsNowPlayer();if(p)Object.assign(p,{x:local.x,z:local.z,yaw:local.yaw,pitch:local.pitch,interact:ops.interact||keys.has('KeyE')});updateCamera();
};
goalCheck=function(){if(!isHost()||!state.running||ops.paused||ops.lost||ops.playlist!=='campaign'||opsActiveObjective()||state.bossGate)return;const players=[...state.players.values()];if(players.length<(state.mode==='coop'?2:1)||players.some(p=>p.lives<=0))return;if(players.every(p=>Math.hypot(p.x-state.goal.x,p.z-state.goal.z)<6.2))clearArea();};

// Networking follows below. Only this protocol handles gameplay messages; legacy hit packets are ignored.
send=function(kind,payload={}){
  if(state.mode!=='coop'||!state.channel||!state.connected)return Promise.resolve('offline');
  const packet={...payload,kind,v:OPS.VERSION,from:state.playerId,inc:ops.incarnation,run:ops.run,epoch:ops.epoch,seq:++ops.packetSeq};
  if(kind==='settings')Object.assign(packet,{difficulty:state.difficulty,playlist:ops.playlist,hostId:state.playerId});
  return state.channel.send({type:'broadcast',event:'game',payload:packet}).catch(()=> 'error');
};
function opsSendSettings(){if(isHost())send('settings',{difficulty:state.difficulty,playlist:ops.playlist,hostId:state.playerId});}
function opsPresence(){
  const list=state.channel?.presenceState?.()||{};ops.present.clear();
  for(const metas of Object.values(list))for(const p of metas)if(p.v===OPS.VERSION&&typeof p.id==='string'&&['host','guest'].includes(p.role)&&(!ops.present.has(p.id)||p.joinedAt>=ops.present.get(p.id).joinedAt))ops.present.set(p.id,p);
  if(state.role==='guest'){
    const hosts=[...ops.present.values()].filter(p=>p.role==='host');
    if(hosts.length===1)state.hostId=hosts[0].id;
    state.partnerReady=!!state.hostId&&ops.present.has(state.hostId);
  }else state.partnerReady=!!ops.peerId&&ops.present.has(ops.peerId);
  if(state.running){ops.lost=!state.connected||!state.partnerReady;opsShowState();}
  send('hello',{role:state.role,weapon:ops.weapon,ready:ops.ready});updateLobby();
}
async function opsDisconnect(){
  ops.generation++;state.connected=false;state.partnerReady=false;ops.peerReady=false;ops.ready=false;ops.peerId='';ops.present.clear();
  ops.gate.clear();ops.shotGate.clear();
  const ch=state.channel;state.channel=null;if(ch){try{await client()?.removeChannel(ch);}catch{try{await ch.unsubscribe();}catch{}}}
  state.players.clear();state.running=false;state.room='';state.hostId='';ops.run='';ops.action='new';ops.pending=null;ops.paused=false;ops.lost=false;opsClearInputs();
}
connect=async function(role,code){
  if(state.running){toast('進行中の部屋からは退出してから接続してください');return;}
  if(!client()){ops.netMessage='オンライン接続を利用できません。再読み込みしてください。';updateLobby();return;}
  await opsDisconnect();state.mode='coop';state.role=role;state.room=code;state.hostId=role==='host'?state.playerId:'';ops.joinedAt=Date.now();ops.rejected=false;ops.netMessage='接続中…';
  const generation=ops.generation,ch=client().channel(`outbreak23:operations1:${code}`,{config:{broadcast:{self:false,ack:true},presence:{key:`${state.playerId}:${ops.incarnation}`}}});state.channel=ch;
  state.players.set(state.playerId,opsPlayer(state.playerId,ops.weapon));
  ch.on('broadcast',{event:'game'},({payload})=>{if(generation===ops.generation)onNetwork(payload);});
  ch.on('presence',{event:'sync'},()=>{if(generation===ops.generation)opsPresence();});
  ch.subscribe(async status=>{
    if(generation!==ops.generation)return;
    if(status==='SUBSCRIBED'){
      state.connected=true;ops.netMessage='';await ch.track({id:state.playerId,role,v:OPS.VERSION,inc:ops.incarnation,joinedAt:ops.joinedAt});
      if(generation!==ops.generation)return;
      send('hello',{role,weapon:ops.weapon,ready:ops.ready});
      if(state.running&&role==='guest')send('resync',{});
    }else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)){state.connected=false;ops.lost=state.running;ops.netMessage='通信が途切れました。再接続中…';opsShowState();}
    updateLobby();
  });
  opsMenuUpdate();updateLobby();
};
updateLobby=function(){
  const connected=state.connected&&state.partnerReady;
  $('#coop-status').textContent=ops.netMessage||(!state.connected?'未接続':!state.partnerReady?'相手を待っています':ops.ready&&ops.peerReady?'2人とも準備完了':'2人接続 / 準備完了を押してください');
  $('#coop-detail').textContent=state.room?`ROOM ${state.room} / ${state.role==='host'?'HOST':'GUEST'} / 2 PLAYERS`:'2人オンライン協力';
  opsReady.disabled=!state.connected||state.running;opsReady.textContent=ops.ready?'準備完了 ✓':'準備完了';opsReady.setAttribute('aria-pressed',String(ops.ready));
  opsLeave.disabled=!state.channel;opsShare.disabled=!state.room;
  opsPlaylist.disabled=state.role==='guest'||state.running;opsChooseWeapon.disabled=state.running;opsChooseChapter.disabled=state.role==='guest'||state.running||opsPlaylist.value==='survival';
  if(state.mode==='coop'&&!state.running&&!state.completed&&!ops.pending&&ops.action!=='next'){
    startBtn.disabled=state.role!=='host'||!connected||!ops.ready||!ops.peerReady;
    startBtn.textContent=state.role==='guest'?'ホストの出撃を待つ':connected&&ops.ready&&ops.peerReady?'協力ミッション開始':'2人の準備完了を待つ';
  }
};
syncModeUI=function(){
  $('#mode-solo').classList.toggle('active',state.mode==='solo');$('#mode-coop').classList.toggle('active',state.mode==='coop');$('#coop-lobby').classList.toggle('hidden',state.mode!=='coop');
  opsMenu.classList.remove('hidden','ops-between');$('.ops-upgrade').classList.add('hidden');
  if(state.mode==='solo'){state.role='host';setOverlay('BLACK SITE / OPERATIONS','6章・24の主目標。通常敵は1発、デブ系とボスだけ高耐久。左移動・右照準・FIRE、操作長押しで任務・蘇生。','ミッション開始',true);startBtn.disabled=false;}
  else{setOverlay('2 PLAYER CO-OP','部屋コードで合流し、2人とも準備完了を押してください。敵・目標・補給を共有。ダウンした相方は近くで蘇生できます。','パートナー待ち',true);updateLobby();}
  opsMenuUpdate();
};
$('#mode-solo').addEventListener('click',e=>{if(state.running)return;e.stopImmediatePropagation();opsDisconnect().then(()=>{state.mode='solo';syncModeUI();});},{capture:true});
$('#mode-coop').addEventListener('click',e=>{if(state.running)return;e.stopImmediatePropagation();state.mode='coop';ops.action='new';syncModeUI();},{capture:true});
opsReady.addEventListener('click',()=>{if(!state.connected||state.running)return;ops.ready=!ops.ready;send('ready',{ready:ops.ready,weapon:ops.weapon});updateLobby();});
opsLeave.addEventListener('click',async()=>{await send('leave',{});await opsDisconnect();state.mode='solo';syncModeUI();uxLeave();});
opsShare.addEventListener('click',async()=>{try{const u=new URL('game23.html',location.href);u.searchParams.set('mode','coop');u.searchParams.set('room',state.room);await navigator.clipboard.writeText(u.href);toast('招待リンクをコピーしました');}catch{toast(`部屋コード ${state.room} を相手に伝えてください`);}});
addEventListener('pagehide',()=>{if(state.connected)send('away',{});});
function opsPing(){
  if(!state.running||performance.now()<(ops.nextPing||0))return;ops.nextPing=performance.now()+800;
  ops.ping={x:local.x,z:local.z,until:performance.now()+8000,from:state.playerId};send('ping',{x:local.x,z:local.z});toast('ここに集合！',700);
}
function opsSnapshot(){
  return {area:state.area,seed:state.seed,difficulty:state.difficulty,playlist:ops.playlist,wave:ops.wave,time:ops.time,elapsed:ops.elapsed,paused:ops.paused,running:state.running,completed:state.completed,action:ops.action,perks:ops.perks,stats:ops.stats,gate:!!state.bossGate,kills:expansionKillCount,
    objectives:ops.objectives.map(o=>({...o})),discoveries:ops.discoveries.map(d=>({...d})),
    enemies:[...state.enemies.values()].map(e=>[e.id,e.index??-1,+e.x.toFixed(2),+e.z.toFixed(2),e.hp,e.dead?1:0,e.boss?1:0,e.maxHp,e.speed,e.runner?1:0,e.crawler?1:0,e.phase||0,e.lean||0,e.headTilt||0,e.headScale||1,e.visualYaw||0,e.type||'walker',e.opsAwake?1:0]),
    players:[...state.players.values()].map(p=>({id:p.id,x:p.x,z:p.z,yaw:p.yaw,pitch:p.pitch||0,lives:p.lives,weapon:p.weapon,ammo:p.ammo,reloadAt:p.reloadAt,invUntil:p.invUntil,infUntil:p.infUntil,rpgUntil:p.rpgUntil,rpgShots:p.rpgShots,guardUntil:p.guardUntil,downUntil:p.downUntil,revive:p.revive,teleport:p.teleport||0,lastInput:p.lastInput||0,stats:p.stats})),
    items:[...state.items.values()].filter(i=>!i.taken).map(i=>[i.id,i.type,i.x,i.z,0])};
}
sendWorld=function(force=false){
  if(!isHost()||state.mode!=='coop'||!state.connected||!ops.run)return;
  const now=performance.now();if(!force&&now-ops.lastWorld<200)return;
  // Forced events are coalesced to avoid exceeding Realtime message limits during rapid fire.
  if(force&&now-ops.lastWorld<75)return;
  ops.lastWorld=now;send('snapshot',opsSnapshot());
};
function opsApplySnapshot(m){
  if(!OPS.validSnapshot(m))return;
  if(!Number.isInteger(m.area)||m.area<0||m.area>=6||!Number.isSafeInteger(m.seed)||!Array.isArray(m.enemies)||m.enemies.length>OPS_CAPACITY+1||!Array.isArray(m.players)||m.players.length>2||!OPS.CHAPTERS[m.area]||!DIFF[m.difficulty]||!['campaign','survival'].includes(m.playlist))return;
  if(typeof m.run!=='string'||!m.run||!Number.isSafeInteger(m.epoch)||m.epoch<1)return;
  if(ops.run===m.run&&m.epoch<ops.epoch)return;
  const rebuild=ops.run!==m.run||ops.epoch!==m.epoch||state.area!==m.area||state.seed!==m.seed;
  if(rebuild){
    opsClearInputs();state.running=false;state.enemies.clear();state.items.clear();state.area=m.area;state.seed=m.seed;state.difficulty=m.difficulty;ops.playlist=m.playlist;
    buildEnvironment();cineMakeWeapon();makeHorde();ops.markers.clear();expansionPowerReset();
  }
  const wasRunning=state.running,wasCompleted=state.completed;
  ops.lastPacketAt=performance.now();
  ops.run=m.run;ops.epoch=m.epoch;ops.time=m.time;ops.elapsed=m.elapsed;ops.wave=m.wave;ops.paused=!!m.paused;ops.action=m.action;ops.stats={...m.stats};ops.perks={...m.perks};ops.playlist=m.playlist;
  ops.objectives=m.objectives||[];ops.discoveries=m.discoveries||[];state.running=!!m.running;state.completed=!!m.completed;expansionKillCount=m.kills||0;
  for(const d of ops.discoveries)if(d.kind==='intel'&&d.done&&!ops.profile.intel.includes(d.id)){ops.profile.intel.push(d.id);opsSaveProfile();}
  const ids=new Set();for(const a of m.enemies){if(!Array.isArray(a)||!Number.isFinite(a[2])||!Number.isFinite(a[3]))continue;applyWorldEnemy(a);const e=state.enemies.get(a[0]);e.opsAwake=!!a[17];ids.add(a[0]);}
  for(const [id,e]of state.enemies)if(!ids.has(id))e.dead=true;
  for(const data of m.players){
    if(!data||typeof data.id!=='string'||!Number.isFinite(data.x)||!Number.isFinite(data.z))continue;
    const previous=state.players.get(data.id),p={...(previous||opsPlayer(data.id)),...data};state.players.set(p.id,p);
    if(p.id===state.playerId){
      if(rebuild||(previous?.teleport||0)!==(data.teleport||0)||Math.hypot(local.x-p.x,local.z-p.z)>5){local.x=p.x;local.z=p.z;}
      else{p.x=local.x;p.z=local.z;}
      state.localLives=p.lives;if(p.reloadAt>ops.time||p.ammo>=opsCapacity(p))ops.reloadingUntil=0;
    }else{const mesh=remoteMeshes.get(p.id)||createRemoteMesh(p.id);mesh.userData.opsTarget={x:p.x,z:p.z,yaw:p.yaw};mesh.visible=true;mesh.rotation.z=p.lives>0?0:Math.PI/2;}
  }
  const liveItems=new Set((m.items||[]).map(a=>a[0]));
  for(const [id,item]of state.items)if(!liveItems.has(id)){opsDisposePickup(item);state.items.delete(id);}
  for(const a of m.items||[])if(!state.items.has(a[0]))createSyncedItem(a);
  if(!m.gate&&state.bossGate)removeBossGate();
  state.partnerReady=true;ops.lost=false;ops.lastPeerAt=performance.now();opsRenderMarkers();v5TintEnemies();syncDifficultyUI();updateCamera();
  if(state.completed&&!wasCompleted)completeMission();
  else if(!state.running&&(wasRunning||rebuild)){
    if(m.action==='next')opsAreaResult();
    else{setOverlay('部隊再展開','ホストからの再開を待っています。','ホストの再開を待つ',true);startBtn.disabled=true;}
  }else opsShowState();
}
function opsAdmitGuest(m){
  const presence=ops.present.get(m.from);if(!presence||presence.role!=='guest')return;
  if(ops.peerId&&ops.peerId!==m.from){send('reject',{target:m.from,text:'この部屋は2人で満員です'});return;}
  ops.peerId=m.from;ops.peerReady=!!m.ready;state.partnerReady=true;ops.lastPeerAt=performance.now();
  if(!state.players.has(m.from)){const p=opsPlayer(m.from,m.weapon);p.ammo=opsCapacity(p);state.players.set(m.from,p);}
  else if(!state.running)state.players.get(m.from).weapon=opsKnownWeapon(m.weapon)?m.weapon:'rifle';
  state.players.get(m.from).incarnation=m.inc;
  opsSendSettings();send('welcome',{target:m.from,ready:ops.ready});
  if(ops.run){ops.lost=false;opsShowState();ops.lastWorld=0;sendWorld(true);}updateLobby();
}
onNetwork=function(m){
  if(!m||m.v!==OPS.VERSION||m.from===state.playerId||typeof m.from!=='string'||m.from.length>64||typeof m.inc!=='string'||m.inc.length>64||!OPS_PACKET_KINDS.has(m.kind)||(ops.present.has(m.from)&&ops.present.get(m.from).inc!==m.inc)||!ops.gate.accept(`${m.from}:${m.inc}:${m.kind}`,m.seq))return;
  if(m.kind==='hello'){
    if(isHost()&&m.role==='guest')opsAdmitGuest(m);
    else if(m.role==='host'&&ops.present.get(m.from)?.role==='host'){state.hostId=m.from;ops.peerReady=!!m.ready;state.partnerReady=true;send('hello',{role:'guest',weapon:ops.weapon,ready:ops.ready});}
    return;
  }
  const fromHost=state.role==='guest'&&m.from===state.hostId,fromPeer=state.role==='host'&&m.from===ops.peerId;
  if(!fromHost&&!fromPeer)return;
  if(fromPeer&&state.players.get(m.from)?.incarnation&&state.players.get(m.from).incarnation!==m.inc)return;
  ops.lastPeerAt=performance.now();
  if(m.kind==='heartbeat'){state.partnerReady=true;if(fromPeer&&state.running&&ops.lost){ops.lost=false;opsShowState();}return;}
  if(m.kind==='ready'){ops.peerReady=!!m.ready;if(!state.running&&state.players.has(m.from)&&opsKnownWeapon(m.weapon))state.players.get(m.from).weapon=m.weapon;updateLobby();return;}
  if(m.kind==='settings'&&fromHost){if(DIFF[m.difficulty])state.difficulty=m.difficulty;if(['campaign','survival'].includes(m.playlist)){ops.playlist=m.playlist;opsPlaylist.value=m.playlist;}syncDifficultyUI();updateLobby();return;}
  if(m.kind==='welcome'&&fromHost&&m.target===state.playerId){ops.peerReady=!!m.ready;state.partnerReady=true;updateLobby();return;}
  if(m.kind==='reject'&&fromHost&&m.target===state.playerId){ops.rejected=true;opsDisconnect().then(()=>{ops.netMessage=m.text;updateLobby();});return;}
  if(m.kind==='resync'&&fromPeer){state.partnerReady=true;ops.lost=false;opsShowState();ops.lastWorld=0;sendWorld(true);return;}
  if(m.kind==='snapshot'&&fromHost){opsApplySnapshot(m);return;}
  if(m.kind==='leave'||m.kind==='away'){if(state.running){ops.lost=true;opsClearInputs();opsShowState();}else if(m.kind==='leave'){ops.peerId='';state.partnerReady=false;ops.peerReady=false;state.players.delete(m.from);updateLobby();}return;}
  if(m.run!==ops.run||m.epoch!==ops.epoch)return;
  if(m.kind==='pause_request'&&fromPeer){opsSetPause(m.paused!==false);return;}
  if(m.kind==='ping'&&Number.isFinite(m.x)&&Number.isFinite(m.z)){ops.ping={x:m.x,z:m.z,from:m.from,until:performance.now()+8000};toast('仲間が集合地点を指定しました',1200);return;}
  if(m.kind==='notice'&&fromHost&&typeof m.text==='string'){toast(m.text.slice(0,180),2200);return;}
  if(m.kind==='intel'&&fromHost&&/^a[0-5]-intel[0-2]$/.test(m.id)){opsRecordIntel(m);return;}
  if(m.kind==='hurt'&&fromHost&&m.target===state.playerId){flashDamage(m.reason);return;}
  if(m.kind==='hit_ack'&&fromHost&&m.target===state.playerId){opsConfirmHit(m.hit,m.killed,m.weak,m.hp);return;}
  if(m.kind==='hazard'&&fromHost&&[m.x,m.z,m.radius,m.at].every(Number.isFinite)){opsHazardVisual(m);return;}
  if(m.kind==='blast'&&fromHost&&Number.isFinite(m.x)&&Number.isFinite(m.z)){expansionBlastVisual(m.x,m.z);return;}
  if(!fromPeer||!state.running||ops.paused||ops.lost)return;
  const p=state.players.get(m.from);if(!p)return;
  if(m.kind==='player'&&[m.x,m.z,m.yaw,m.pitch].every(Number.isFinite)){
    if(p.lives<=0)return;
    const now=performance.now(),budget=difficulty().speed*(1+ops.perks.mobility*.06)*Math.min(.8,(now-(p.lastMoveAt||now-120))/1000)+1.4;
    if(Math.hypot(m.x-p.x,m.z-p.z)<=budget&&!blocked(m.x,m.z,.62))Object.assign(p,{x:m.x,z:m.z,yaw:OPS.clamp(m.yaw,-1000,1000),pitch:OPS.clamp(m.pitch,-1.2,1.2)});
    p.interact=!!m.interact;p.lastMoveAt=now;return;
  }
  if(m.kind==='shot'){opsHostShoot(p,m,m.shotSeq);return;}
  if(m.kind==='reload'){opsHostReload(p);return;}
};
networkTick=function(now){
  if(isHost()&&ops.pending&&now>=ops.pending.at){const pending=ops.pending;ops.pending=null;if(pending.type==='revive'){opsRevive(opsNowPlayer());state.running=true;opsShowState();}else opsNewArea();}
  if(state.mode==='coop'&&state.connected){
    if(now-ops.lastHeartbeat>1000){ops.lastHeartbeat=now;send('heartbeat',{});}
    if(now-ops.lastHello>2500){ops.lastHello=now;if(!state.partnerReady)send('hello',{role:state.role,weapon:ops.weapon,ready:ops.ready});else if(!isHost()&&state.running&&now-ops.lastPacketAt>1800)send('resync',{});}
    if(state.running&&ops.lastPeerAt&&now-ops.lastPeerAt>5500&&!ops.lost){ops.lost=true;opsClearInputs();opsShowState();}
    if(!isHost()&&state.running&&!ops.paused&&!ops.lost&&now-state.lastPlayerSend>100){state.lastPlayerSend=now;send('player',{x:local.x,z:local.z,yaw:local.yaw,pitch:local.pitch,interact:ops.interact||keys.has('KeyE')});}
    if(isHost())sendWorld(false);
  }
  if(state.running)for(const p of state.players.values())if(p.id!==state.playerId){const g=remoteMeshes.get(p.id)||createRemoteMesh(p.id);if(isHost())g.userData.opsTarget={x:p.x,z:p.z,yaw:p.yaw};g.rotation.z=p.lives>0?0:Math.PI/2;}
  for(const g of remoteMeshes.values()){const t=g.userData.opsTarget;if(!t)continue;g.position.x+=(t.x-g.position.x)*.25;g.position.z+=(t.z-g.position.z)*.25;g.rotation.y+=normAngle(t.yaw-g.rotation.y)*.3;}
  if(now>Number(opsHit.dataset.until||0))opsHit.classList.remove('show');
  if(now-ops.lastHud>160){ops.lastHud=now;opsHud();}
};
const opsOldHud=updateHud;
updateHud=function(){opsOldHud();opsHud();};
function opsHud(){
  const objective=opsActiveObjective(),me=opsNowPlayer(),boss=state.enemies.get('boss');
  $('#ops-chapter-label').textContent=ops.playlist==='survival'?`SURVIVAL / WAVE ${ops.wave}`:`CHAPTER ${state.area+1} / ${OPS.CHAPTERS[state.area].title}`;
  let title='通常敵は1発 / デブ・ボスだけ高耐久',detail='E / 操作を長押し：任務・記録・蘇生',value=0,max=1;
  if(state.running){
    if(me?.lives<=0){title='ダウン / 仲間の蘇生を待つ';detail=`近くで操作2秒 / ${Math.max(0,Math.ceil((me.downUntil-ops.time)/1000))}秒で戦線復帰`;}
    else if(ops.playlist==='survival'){const count=[...state.enemies.values()].filter(e=>!e.dead).length;title=`WAVE ${ops.wave} / 残り ${count}体`;detail=ops.nextWave?'補給中 / 次のウェーブを準備':'5ウェーブごとにボス / 生き残れ';}
    else if(objective){title=objective.label;value=objective.progress;max=objective.target;const dist=Math.round(Math.hypot(local.x-objective.x,local.z-objective.z));detail=objective.kind==='purge'?`撃破 ${Math.floor(value)} / ${max}　${dist}m`:objective.kind==='defend'?`範囲内を防衛 ${Math.floor(value)} / ${max}秒　${dist}m`:objective.kind==='escort'?`護送 ${Math.floor(value/max*100)}% / 近くの敵を排除　${dist}m`:`操作を長押し ${Math.floor(value)} / ${max}秒　${dist}m`;}
    else{title=boss&&!boss.dead?`ボス / ${currentStage().boss}`:'出口に全員集合';detail=boss&&!boss.dead?`発光する核が弱点 / ${boss.hp} HP`:'緑の出口マーカーへ。相方も同時に到達すると次の章へ。';}
  }
  $('#ops-objective-title').textContent=title;$('#ops-objective-detail').textContent=detail;const progress=$('#ops-objective-progress');progress.max=max;progress.value=value;
  if(ops.ping&&performance.now()<ops.ping.until&&ops.ping.from!==state.playerId)opsConnection.textContent=`集合ピン ${Math.round(Math.hypot(local.x-ops.ping.x,local.z-ops.ping.z))}m`;
  else opsConnection.textContent=state.mode==='coop'?(ops.lost?'接続待ち / 進行を保持':state.partnerReady?'CO-OP / 2人で進行共有':'CO-OP / パートナー待ち'):'';
  frame.dataset.opsPlaying=state.running?'1':'0';$('#ops-pause').disabled=!state.running;$('#ops-pause').textContent=ops.paused?'RESUME':'PAUSE';$('#ops-ping').hidden=state.mode!=='coop';
  uxUpdateAmmo();
}
updateTimer=function(){$('#hud-time').textContent=fmt(ops.elapsed/1000);};
updateGoalHud=function(){
  if(!state.goal)return;const objective=opsActiveObjective(),down=[...state.players.values()].find(p=>p.id!==state.playerId&&p.lives<=0),ping=ops.ping&&performance.now()<ops.ping.until&&ops.ping.from!==state.playerId?ops.ping:null;
  const target=down||ping||objective||(state.enemies.get('boss')?.dead?state.goal:state.enemies.get('boss'))||state.goal;
  const dist=Math.round(Math.hypot(target.x-local.x,target.z-local.z));goalArrow.style.transform=`rotate(${normAngle(Math.atan2(target.x-local.x,-(target.z-local.z))-local.yaw)}rad)`;
  goalDirection.textContent=`${down?'蘇生':ping?'集合':objective?'任務':state.bossGate?'BOSS':'EXIT'} ${dist}m`;$('#hud-goal').textContent=objective?`${ops.objectives.filter(o=>o.done).length} / 3`:state.bossGate?'BOSS':'OPEN';
};
const opsMap=drawMinimap;
drawMinimap=function(){opsMap();if(!state.maze||!minimapCtx)return;const m=state.maze,w=minimap.width,h=minimap.height,pad=7,x=px=>pad+(px-m.x0)*(w-pad*2)/(m.cols*m.cell),y=pz=>pad+(m.z0-pz)*(h-pad*2)/(m.rows*m.cell),ctx=minimapCtx;
  for(const d of [...ops.objectives,...ops.discoveries])if(!d.done){ctx.fillStyle=d.kind==='intel'?'#82dfff':d.kind==='cache'?'#89ffa7':'#ffcd70';ctx.fillRect(x(d.x)-2,y(d.z)-2,4,4);}
  if(ops.ping&&performance.now()<ops.ping.until){ctx.strokeStyle='#ffe189';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x(ops.ping.x),y(ops.ping.z),6,0,Math.PI*2);ctx.stroke();}
};
updateBossHud=function(){const boss=state.enemies.get('boss');$('#hud-boss').textContent=!boss?'---':boss.dead?'DOWN':!boss.opsAwake?'SEALED':`${boss.hp}/${boss.maxHp}`;bossBanner.classList.toggle('hidden',!boss||boss.dead||!boss.opsAwake);if(boss&&!boss.dead){bossNameEl.textContent=currentStage().boss;bossPhaseEl.textContent=`PHASE ${bossPhase(boss)} / 核が弱点 / ${boss.hp} HP`;}};

// Loading preview predates operations; apply the rule to those enemies as well.
for(const e of state.enemies.values())if(!e.boss)e.hp=e.maxHp=OPS.health(e.type,state.difficulty);
{const preview=opsNowPlayer();state.players.set(state.playerId,{...opsPlayer(state.playerId),x:preview?.x||local.x,z:preview?.z||local.z,ammo:OPS.WEAPONS.rifle.magazine});}
if(v5Roster)v5Roster.textContent='通常敵8種は1発 / デブ系2種・ボスは高耐久';
if(owNote)owNote.textContent='6章 / 24主目標 / 2人協力';
syncModeUI();opsHud();
const opsInvite=new URLSearchParams(location.search).get('room');
if(state.mode==='coop'&&opsInvite&&/^[A-Z0-9]{6}$/i.test(opsInvite)){$('#coop-join-code').value=opsInvite.toUpperCase();toast('参加を押すと招待された部屋へ入れます',3500);}
Object.defineProperty(window,'blacksiteSystems',{configurable:true,get:()=>({version:OPS.VERSION,mode:state.mode,role:state.role,connected:state.connected,partnerReady:state.partnerReady,ready:ops.ready,peerReady:ops.peerReady,running:state.running,paused:ops.paused,lost:ops.lost,area:state.area,epoch:ops.epoch,run:ops.run,time:Math.round(ops.time),playlist:ops.playlist,wave:ops.wave,objectives:ops.objectives.map(o=>({id:o.id,kind:o.kind,progress:o.progress,target:o.target,done:o.done,x:o.x,z:o.z})),stats:{...ops.stats},players:[...state.players.values()].map(p=>({id:p.id,x:p.x,z:p.z,lives:p.lives,ammo:p.ammo,weapon:p.weapon})),enemies:[...state.enemies.values()].map(e=>({id:e.id,type:e.type,boss:e.boss,hp:e.hp,maxHp:e.maxHp,dead:e.dead})),content:{chapters:6,mainObjectives:24,intel:18,caches:12,weapons:3},normalTypes:OPS.NORMAL_TYPES,fatTypes:OPS.FAT_TYPES})});
