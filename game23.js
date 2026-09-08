import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const $ = (s) => document.querySelector(s);
const canvas = $('#game23-canvas');
const frame = $('#game23-frame');
const overlay = $('#game23-overlay');
const overlayTitle = $('#overlay-title');
const overlayText = $('#overlay-text');
const startBtn = $('#game23-start');
const bossBanner = $('#boss-banner');
const bossNameEl = $('#boss-name');
const toastEl = $('#mission-toast');
const damageFlash = $('#damage-flash');
const touchLeft = $('#touch-left');
const touchRight = $('#touch-right');
const touchStick = $('#touch-stick');

const STAGES = [
  { name:'QUARANTINE GATE', boss:'CRIMSON WARDEN', floor:0x17201d, wall:0x27332f, accent:0xd92f47, fog:0x0a1010, length:720, width:82 },
  { name:'ABANDONED WARD', boss:'SIREN NURSE', floor:0x242822, wall:0x4a5048, accent:0xdce8d9, fog:0x111510, length:740, width:76 },
  { name:'FREIGHT TUNNEL', boss:'IRON BUTCHER', floor:0x1d1d20, wall:0x32353b, accent:0xff7a2f, fog:0x0b0b0d, length:760, width:70 },
  { name:'HIVE LAB', boss:'HIVE QUEEN', floor:0x17151d, wall:0x342942, accent:0xae55ff, fog:0x0c0812, length:740, width:78 },
  { name:'ZERO SECTOR', boss:'NULL TYRANT', floor:0x121416, wall:0x24282c, accent:0x52e8ff, fog:0x050708, length:800, width:72 }
];

const DIFF = {
  easy:      { label:'EASY',      speed:5.9, zombieSpeed:.72, bossSpeed:.64, count:[12,15,18,21,24], bossHp:[5,6,7,8,10], touchCd:2.2, regen:true },
  normal:    { label:'NORMAL',    speed:5.0, zombieSpeed:1.00, bossSpeed:.86, count:[18,22,26,30,34], bossHp:[9,11,13,15,18], touchCd:1.55, regen:false },
  nightmare: { label:'NIGHTMARE', speed:4.7, zombieSpeed:1.62, bossSpeed:1.28, count:[28,32,36,40,46], bossHp:[22,26,30,34,40], touchCd:.9, regen:false }
};

const state = {
  mode: new URLSearchParams(location.search).get('mode') === 'coop' ? 'coop' : 'solo',
  difficulty:'normal', role:'host', room:'', channel:null, playerId:crypto.randomUUID().slice(0,8), hostId:'',
  connected:false, partnerReady:false, running:false, completed:false, area:0, seed:0,
  startedAt:0, areaStartedAt:0, localLives:3, players:new Map(), enemies:new Map(), enemyMeshes:new Map(),
  walls:[], goal:null, bossId:'', lastSnapshot:0, lastPlayerSend:0, lastGoalCheck:0, toastTimer:0
};

const renderer = new THREE.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.7));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = false;
let scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, 16/9, .08, 180);
const raycaster = new THREE.Raycaster();
raycaster.far = 95;
const clock = new THREE.Clock();
const local = { x:0, z:10, yaw:Math.PI, pitch:0, vx:0, vz:0 };
const keys = new Set();
let remoteMeshes = new Map();
let muzzleLight = null;
let pointerLocked = false;
let leftTouch = null;
let rightTouch = null;
let touchMove = {x:0,y:0};
let lastRight = null;

const shared = {
  bodyGeo:new THREE.BoxGeometry(.62,1.15,.38), headGeo:new THREE.SphereGeometry(.34,12,8), limbGeo:new THREE.BoxGeometry(.2,.82,.2),
  zombieMat:new THREE.MeshStandardMaterial({color:0x71806f,roughness:.9}), zombieDark:new THREE.MeshStandardMaterial({color:0x273027,roughness:1}),
  playerMat:new THREE.MeshStandardMaterial({color:0x55d8ff,roughness:.7,metalness:.05}), guestMat:new THREE.MeshStandardMaterial({color:0xffd166,roughness:.7})
};

function mat(color, emissive=0x000000, intensity=0){ return new THREE.MeshStandardMaterial({color,emissive,emissiveIntensity:intensity,roughness:.72,metalness:.12}); }
function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function hashCode(s){ let h=2166136261; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); } return h>>>0; }
function roomCode(){ const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s=''; crypto.getRandomValues(new Uint32Array(6)).forEach(n=>s+=chars[n%chars.length]); return s; }
function fmt(sec){ sec=Math.max(0,Math.floor(sec)); return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`; }
function toast(msg,ms=1700){ clearTimeout(state.toastTimer); toastEl.textContent=msg; toastEl.classList.add('show'); state.toastTimer=setTimeout(()=>toastEl.classList.remove('show'),ms); }
function setOverlay(title,text,button='開始',show=true){ overlayTitle.textContent=title; overlayText.textContent=text; startBtn.textContent=button; overlay.classList.toggle('hidden',!show); }
function hearts(n){ return '♥'.repeat(Math.max(0,n))+'♡'.repeat(Math.max(0,3-n)); }
function difficulty(){ return DIFF[state.difficulty]; }
function currentStage(){ return STAGES[state.area]; }
function isHost(){ return state.mode==='solo' || state.role==='host'; }

function resize(){ const r=frame.getBoundingClientRect(); const w=Math.max(1,Math.floor(r.width)); const h=Math.max(1,Math.floor(r.height)); renderer.setSize(w,h,false); camera.aspect=w/h; camera.updateProjectionMatrix(); }
addEventListener('resize',resize,{passive:true}); new ResizeObserver(resize).observe(frame); resize();

function clearScene(){
  state.enemyMeshes.clear(); remoteMeshes.clear(); state.walls=[]; state.goal=null;
  while(scene.children.length) scene.remove(scene.children[0]);
}

function addBox(x,y,z,w,h,d,color,solid=true,emissive=0){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color,emissive,emissive?1.3:0));
  mesh.position.set(x,y,z); scene.add(mesh);
  if(solid) state.walls.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2});
  return mesh;
}

function buildEnvironment(){
  clearScene(); const s=currentStage();
  scene.background=new THREE.Color(s.fog); scene.fog=new THREE.FogExp2(s.fog, state.area===4?.018:.0135);
  scene.add(new THREE.HemisphereLight(0xcfe2dc,0x14110e,1.25));
  const sun=new THREE.DirectionalLight(0xffffff,1.35); sun.position.set(20,35,30); scene.add(sun);
  muzzleLight=new THREE.PointLight(0xffd4a1,0,9); camera.add(muzzleLight); scene.add(camera);

  const floor=new THREE.Mesh(new THREE.PlaneGeometry(s.width,s.length+80,18,70),new THREE.MeshStandardMaterial({color:s.floor,roughness:1,metalness:.05}));
  floor.rotation.x=-Math.PI/2; floor.position.z=-s.length/2+20; scene.add(floor);
  addBox(-s.width/2-1,2.3,-s.length/2+20,2,4.6,s.length+90,s.wall,true);
  addBox(s.width/2+1,2.3,-s.length/2+20,2,4.6,s.length+90,s.wall,true);
  addBox(0,2.3,32,s.width+4,4.6,2,s.wall,true);
  addBox(0,2.3,-s.length-3,s.width+4,4.6,2,s.wall,true);

  const rand=mulberry32(state.seed ^ ((state.area+1)*0x9e3779b9));
  for(let i=0,z=-70; z>-s.length+95; i++,z-=72+Math.floor(rand()*28)){
    const gap=14+(rand()*7); const side=i%2===0?-1:1; const edge=s.width/2;
    if(side<0){
      const leftW=edge-gap*.5-3; addBox(-edge+leftW/2,1.7,z,leftW,3.4,3.8,s.wall,true);
      const rightStart=-gap*.5+3; const rightW=edge-rightStart; addBox(rightStart+rightW/2,1.7,z,rightW,3.4,3.8,s.wall,true);
    } else {
      const leftEnd=gap*.5-3; const leftW=edge+leftEnd; addBox(-edge+leftW/2,1.7,z,leftW,3.4,3.8,s.wall,true);
      const rightStart=gap*.5+3; const rightW=edge-rightStart; addBox(rightStart+rightW/2,1.7,z,rightW,3.4,3.8,s.wall,true);
    }
    if(i%3===1){ const x=(rand()-.5)*(s.width-24); addBox(x,.65,z-25,5+rand()*7,1.3,4+rand()*5,s.accent,false,s.accent); }
  }

  for(let i=0;i<26;i++){
    const z=-25-rand()*(s.length-80), x=(rand()-.5)*(s.width-18);
    const light=new THREE.PointLight(s.accent,.45+rand()*.35,18); light.position.set(x,2.8,z); scene.add(light);
    if(i%2===0) addBox(x,2.2,z,.35,2.8,.35,s.accent,false,s.accent);
  }

  const goalMat=new THREE.MeshStandardMaterial({color:0x8bffb2,emissive:0x29ff79,emissiveIntensity:2,transparent:true,opacity:.85});
  const ring=new THREE.Mesh(new THREE.TorusGeometry(5,.45,12,42),goalMat); ring.rotation.x=Math.PI/2; ring.position.set(0,.55,-s.length+18); scene.add(ring);
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(3.6,3.6,8,24,1,true),new THREE.MeshBasicMaterial({color:0x51ff94,transparent:true,opacity:.10,side:THREE.DoubleSide}));
  beam.position.set(0,4,-s.length+18); scene.add(beam);
  state.goal=new THREE.Vector3(0,0,-s.length+18);

  local.x=0; local.z=14; local.yaw=Math.PI; local.pitch=0; updateCamera();
  state.players.set(state.playerId,{id:state.playerId,x:local.x,z:local.z,yaw:local.yaw,lives:state.localLives,role:state.role});
}

function humanoid(material,boss=false,variant=0){
  const g=new THREE.Group();
  const body=new THREE.Mesh(shared.bodyGeo,material); body.position.y=1.32; g.add(body);
  const head=new THREE.Mesh(shared.headGeo,variant===1?mat(0xe8ddd5):material); head.position.y=2.18; g.add(head);
  for(const [x,y] of [[-.48,1.3],[.48,1.3],[-.22,.45],[.22,.45]]){ const limb=new THREE.Mesh(shared.limbGeo,material); limb.position.set(x,y,0); g.add(limb); }
  if(boss){ g.scale.setScalar(variant===4?2.25:variant===1?1.75:1.95); }
  return g;
}

function bossMaterial(area){
  if(area===0) return mat(0x781727,0xff2348,.7);
  if(area===1) return mat(0xe6e7df,0x68dfff,.28);
  if(area===2) return mat(0x4a4d54,0xff6a2e,.45);
  if(area===3) return mat(0x542869,0xc05cff,.65);
  return mat(0x101820,0x48eaff,.9);
}

function createEnemyMesh(e){
  const material=e.boss?bossMaterial(state.area):shared.zombieMat;
  const g=humanoid(material,e.boss,state.area);
  if(!e.boss){ g.rotation.z=(e.id.charCodeAt(e.id.length-1)%7-3)*.025; }
  if(e.boss && state.area===0){ const horn=addDecoration(g,new THREE.ConeGeometry(.2,.8,8),mat(0x260006),-.4,2.8,0); horn.rotation.z=-.25; const h2=horn.clone(); h2.position.x=.4; h2.rotation.z=.25; g.add(h2); }
  if(e.boss && state.area===1){ const halo=addDecoration(g,new THREE.TorusGeometry(.55,.07,8,24),mat(0xffffff,0x66eaff,1.6),0,2.95,0); halo.rotation.x=Math.PI/2; }
  if(e.boss && state.area===2){ addDecoration(g,new THREE.BoxGeometry(1.0,.36,.75),mat(0x20242a),0,1.7,0); }
  if(e.boss && state.area===3){ for(let i=0;i<3;i++){ const arm=addDecoration(g,new THREE.BoxGeometry(.18,1.2,.18),mat(0x5d2b73,0xb951ff,.4),(i-1)*.45,1.55,-.15); arm.rotation.z=(i-1)*.55; } }
  if(e.boss && state.area===4){ addDecoration(g,new THREE.OctahedronGeometry(.42),mat(0x0d1820,0x4beaff,2),0,2.2,.35); }
  g.position.set(e.x,0,e.z); g.userData.enemyId=e.id;
  g.traverse(o=>o.userData.enemyId=e.id); scene.add(g); state.enemyMeshes.set(e.id,g); return g;
}
function addDecoration(group,geo,material,x,y,z){ const m=new THREE.Mesh(geo,material); m.position.set(x,y,z); group.add(m); return m; }

function createRemoteMesh(id){
  const material=id===state.hostId?shared.playerMat:shared.guestMat; const g=humanoid(material,false,0); g.userData.playerId=id; scene.add(g); remoteMeshes.set(id,g); return g;
}
function syncRemotePlayers(players){
  for(const p of players){
    const [id,x,z,yaw,lives]=p; if(id===state.playerId) continue;
    state.players.set(id,{id,x,z,yaw,lives});
    let mesh=remoteMeshes.get(id) || createRemoteMesh(id); mesh.position.set(x,0,z); mesh.rotation.y=-yaw+Math.PI;
  }
}

function spawnHostWorld(){
  state.enemies.clear(); const s=currentStage(), d=difficulty(), rand=mulberry32(state.seed^0x51f15e);
  const count=d.count[state.area];
  for(let i=0;i<count;i++){
    const z=-55-rand()*(s.length-135), x=(rand()-.5)*(s.width-16);
    state.enemies.set(`z${i}`,{id:`z${i}`,x,z,hp:1,maxHp:1,boss:false,dead:false,speed:d.zombieSpeed*(.82+rand()*.4)});
  }
  const hp=d.bossHp[state.area]; state.bossId='boss';
  state.enemies.set('boss',{id:'boss',x:0,z:-s.length*.76,hp,maxHp:hp,boss:true,dead:false,speed:d.bossSpeed});
  for(const e of state.enemies.values()) createEnemyMesh(e);
  updateBossHud();
}

function blocked(x,z){
  const r=.72, s=currentStage(); if(x<-s.width/2+r || x>s.width/2-r || z>30 || z<-s.length+4) return true;
  for(const w of state.walls){ if(x+r>w.minX&&x-r<w.maxX&&z+r>w.minZ&&z-r<w.maxZ) return true; }
  return false;
}

function updateCamera(){ camera.position.set(local.x,1.72,local.z); camera.rotation.order='YXZ'; camera.rotation.y=local.yaw; camera.rotation.x=local.pitch; }
function updateLocal(dt){
  if(!state.running || state.localLives<=0) return;
  let forward=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0)-touchMove.y;
  let strafe=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+touchMove.x;
  const mag=Math.hypot(forward,strafe); if(mag>1){ forward/=mag; strafe/=mag; }
  const sp=difficulty().speed; const sx=Math.sin(local.yaw), cz=Math.cos(local.yaw);
  const dx=(sx*forward+cz*strafe)*sp*dt, dz=(-cz*forward+sx*strafe)*sp*dt;
  if(!blocked(local.x+dx,local.z)) local.x+=dx;
  if(!blocked(local.x,local.z+dz)) local.z+=dz;
  updateCamera();
  const me=state.players.get(state.playerId)||{}; Object.assign(me,{id:state.playerId,x:local.x,z:local.z,yaw:local.yaw,lives:state.localLives}); state.players.set(state.playerId,me);
}

function nearestLivingPlayer(e){
  let best=null, bd=Infinity;
  for(const p of state.players.values()){
    if((p.lives??0)<=0) continue; const d=Math.hypot(p.x-e.x,p.z-e.z); if(d<bd){bd=d;best=p;}
  }
  return best?{p:best,d:bd}:null;
}

const damageCooldown=new Map();
function hostWorldStep(dt,now){
  if(!isHost() || !state.running) return;
  for(const e of state.enemies.values()){
    if(e.dead) continue; const n=nearestLivingPlayer(e); if(!n) continue;
    const dx=n.p.x-e.x,dz=n.p.z-e.z,len=Math.hypot(dx,dz)||1;
    const mult=e.boss?1:1; const step=e.speed*mult*dt;
    const nx=e.x+dx/len*step,nz=e.z+dz/len*step;
    if(!blocked(nx,nz)){e.x=nx;e.z=nz;} else if(!blocked(nx,e.z)) e.x=nx; else if(!blocked(e.x,nz)) e.z=nz;
    const mesh=state.enemyMeshes.get(e.id); if(mesh){ mesh.position.set(e.x,0,e.z); mesh.rotation.y=Math.atan2(dx,dz); }
    const hitRadius=e.boss?2.0:1.0;
    if(n.d<hitRadius){
      const last=damageCooldown.get(n.p.id)||0; if(now-last>difficulty().touchCd*1000){ damageCooldown.set(n.p.id,now); damagePlayer(n.p.id); }
    }
  }
}

function damagePlayer(id){
  const p=state.players.get(id); if(!p || p.lives<=0) return; p.lives=Math.max(0,p.lives-1); state.players.set(id,p);
  if(id===state.playerId){ state.localLives=p.lives; flashDamage(); }
  send('damage',{target:id,lives:p.lives,area:state.area}); updateHud();
  if(p.lives<=0) failMission('ライフが0になった。感染区域に飲み込まれた。');
}
function flashDamage(){ damageFlash.classList.add('on'); setTimeout(()=>damageFlash.classList.remove('on'),150); toast(`DAMAGE - LIFE ${state.localLives}`); }

function shoot(){
  if(!state.running || state.localLives<=0) return;
  muzzleLight.intensity=4; setTimeout(()=>{if(muzzleLight)muzzleLight.intensity=0;},45);
  raycaster.setFromCamera(new THREE.Vector2(0,0),camera);
  const targets=[...state.enemyMeshes.values()].filter(m=>m.visible!==false);
  const hits=raycaster.intersectObjects(targets,true);
  if(!hits.length){ toast('MISS',360); return; }
  let obj=hits[0].object,id=''; while(obj&&!id){id=obj.userData?.enemyId||'';obj=obj.parent;}
  if(!id) return;
  if(isHost()) hostHit(id,state.playerId); else send('hit',{enemyId:id,playerId:state.playerId,area:state.area});
}
function hostHit(id,playerId){
  const e=state.enemies.get(id); if(!e||e.dead) return;
  e.hp=Math.max(0,e.hp-1); if(e.hp<=0){ e.dead=true; const mesh=state.enemyMeshes.get(id); if(mesh) mesh.visible=false; send('enemy',{id,hp:0,dead:true,area:state.area}); toast(e.boss?`${currentStage().boss} DOWN`:'ONE SHOT'); }
  else { send('enemy',{id,hp:e.hp,dead:false,area:state.area}); if(e.boss) toast(`${currentStage().boss} ${e.hp}/${e.maxHp}`); }
  updateBossHud();
}

function updateBossHud(){
  const e=state.enemies.get(state.bossId); $('#hud-boss').textContent=!e?'---':e.dead?'DOWN':`${currentStage().boss} ${e.hp}/${e.maxHp}`;
  if(e&&!e.dead && local.z<e.z+85){ bossNameEl.textContent=currentStage().boss; bossBanner.classList.remove('hidden'); } else bossBanner.classList.add('hidden');
}

function goalCheck(now){
  if(!isHost()||!state.running||now-state.lastGoalCheck<180) return; state.lastGoalCheck=now;
  const active=[...state.players.values()].filter(p=>(p.lives??0)>0 && (state.mode==='solo'||p.id===state.playerId||state.partnerReady));
  const needed=state.mode==='coop'?2:1; if(active.length<needed) return;
  const all=active.every(p=>Math.hypot(p.x-state.goal.x,p.z-state.goal.z)<7.3);
  if(all) clearArea();
}

function clearArea(){
  if(!isHost()||!state.running) return; state.running=false; send('area_clear',{area:state.area});
  const last=state.area===STAGES.length-1;
  if(last){ completeMission(); return; }
  toast(`AREA ${state.area+1} CLEAR`,2200);
  setTimeout(()=>{
    if(difficulty().regen){ for(const p of state.players.values()) p.lives=Math.min(3,(p.lives||0)+1); state.localLives=state.players.get(state.playerId)?.lives||state.localLives; }
    state.area++; state.seed=(state.seed+0x9e3779b9)>>>0; send('area_start',{area:state.area,seed:state.seed,difficulty:state.difficulty,lives:[...state.players.values()].map(p=>[p.id,p.lives])}); beginArea(false);
  },2300);
}

function completeMission(){
  state.running=false; state.completed=true; const elapsed=(performance.now()-state.startedAt)/1000;
  send('complete',{elapsed,area:state.area});
  setOverlay('BLACK SITE ESCAPED',`5区域を突破。総時間 ${fmt(elapsed)} / 残りライフ ${state.localLives}。${state.mode==='coop'?'2人協力ミッション完了。':'単独生還。'}`,'最初から再挑戦',true);
  startBtn.disabled=false; recordResult(elapsed).catch(()=>{});
}
async function recordResult(elapsed){
  const gb=window.GameBackend; if(!gb?.ready) return;
  const mult=state.difficulty==='nightmare'?3:state.difficulty==='normal'?2:1;
  const score=Math.max(1,Math.round(mult*100000-elapsed*80+state.localLives*3000));
  await gb.recordScore({gameId:'outbreak23',mode:state.mode==='coop'?'online':'solo',score,durationMs:Math.round(elapsed*1000),roomCode:state.room||null,extra:{difficulty:state.difficulty,areas:5}});
}
function failMission(reason){
  if(!isHost()) return; state.running=false; send('fail',{reason,area:state.area});
  setOverlay('MISSION FAILED',reason,'エリア1から再挑戦',true); startBtn.disabled=false;
}

function beginArea(fromStart=true){
  state.running=false; buildEnvironment(); if(isHost()) spawnHostWorld();
  state.areaStartedAt=performance.now();
  if(fromStart){ state.startedAt=state.areaStartedAt; }
  updateHud();
  setTimeout(()=>{ state.running=true; overlay.classList.add('hidden'); if(isHost()) sendWorld(true); toast(`AREA ${state.area+1} / ${currentStage().name}`,1900); },650);
}

function resetMission(){
  state.completed=false; state.area=0; state.seed=state.mode==='coop'?(hashCode(state.room||'BLACKSITE')^Date.now())>>>0:(Date.now()>>>0); state.localLives=3;
  for(const p of state.players.values()) p.lives=3;
  state.players.set(state.playerId,{id:state.playerId,x:0,z:14,yaw:Math.PI,lives:3,role:state.role});
  if(state.mode==='coop' && !isHost()){ toast('ホストの開始を待っています'); return; }
  if(state.mode==='coop' && !state.partnerReady){ toast('パートナーの接続を待っています'); return; }
  send('start',{area:0,seed:state.seed,difficulty:state.difficulty,lives:[...state.players.values()].map(p=>[p.id,3]),hostId:state.playerId});
  beginArea(true);
}

function updateHud(){
  $('#hud-area').textContent=`${state.area+1} / 5`; $('#hud-life').textContent=hearts(state.localLives);
  frame.dataset.nightmare=state.difficulty==='nightmare'?'1':'0';
  const partner=[...state.players.values()].find(p=>p.id!==state.playerId); const mate=$('#mate-hud');
  mate.classList.toggle('hidden',state.mode!=='coop'); $('#hud-mate').textContent=partner?`${hearts(partner.lives??3)}`:(state.connected?'WAIT':'---');
}

function updateGoalHud(){ if(!state.goal)return; $('#hud-goal').textContent=`${Math.max(0,Math.round(Math.hypot(local.x-state.goal.x,local.z-state.goal.z)))}m`; }
function updateTimer(){ const base=state.startedAt||performance.now(); $('#hud-time').textContent=fmt((performance.now()-base)/1000); }

function send(kind,payload={}){
  if(!state.channel||!state.connected) return Promise.resolve();
  return state.channel.send({type:'broadcast',event:'game',payload:{kind,from:state.playerId,...payload}}).catch(()=>{});
}

function client(){ return window.GameBackend?.client || null; }
async function connect(role,code){
  if(!client()){ $('#coop-status').textContent='Supabase未接続'; toast('リアルタイム接続を利用できません'); return; }
  if(state.channel){ try{await state.channel.unsubscribe();}catch{} }
  state.role=role; state.room=code; state.hostId=role==='host'?state.playerId:''; state.connected=false; state.partnerReady=false;
  const ch=client().channel(`outbreak23:${code}`,{config:{broadcast:{self:false,ack:false},presence:{key:state.playerId}}}); state.channel=ch;
  ch.on('broadcast',{event:'game'},({payload})=>onNetwork(payload));
  ch.on('presence',{event:'sync'},()=>{
    const ps=ch.presenceState(); const ids=Object.keys(ps); state.partnerReady=ids.some(id=>id!==state.playerId); updateLobby();
    if(role==='host'&&state.partnerReady) send('settings',{difficulty:state.difficulty,hostId:state.playerId});
  });
  ch.subscribe(async status=>{
    if(status==='SUBSCRIBED'){
      state.connected=true; await ch.track({role,id:state.playerId,joinedAt:Date.now()}); updateLobby();
      send('hello',{role});
    } else if(status==='CHANNEL_ERROR'||status==='TIMED_OUT'||status==='CLOSED'){ state.connected=false; updateLobby(status); }
  });
}

function updateLobby(extra=''){
  const s=$('#coop-status'),d=$('#coop-detail');
  if(!state.connected){s.textContent='接続中…';d.textContent=extra||'Realtime channel';return;}
  if(state.role==='host'){ s.textContent=state.partnerReady?'パートナー接続済み':'部屋を公開中'; d.textContent=`ROOM ${state.room} / ${state.partnerReady?'START OK':'相手を待っています'}`; }
  else { s.textContent=state.partnerReady?'ホスト接続済み':'部屋に参加済み'; d.textContent=`ROOM ${state.room} / ホストの開始を待つ`; }
  startBtn.disabled=state.role==='guest'||!state.partnerReady;
}

function onNetwork(m){
  if(!m||m.from===state.playerId)return;
  switch(m.kind){
    case 'hello':
      if(state.role==='host'){ state.partnerReady=true; state.players.set(m.from,{id:m.from,x:0,z:14,yaw:Math.PI,lives:3}); send('settings',{difficulty:state.difficulty,hostId:state.playerId}); updateLobby(); }
      else if(m.role==='host'){ state.hostId=m.from; state.partnerReady=true; updateLobby(); }
      break;
    case 'settings':
      if(state.role==='guest'){ state.difficulty=m.difficulty||state.difficulty; state.hostId=m.hostId||m.from; syncDifficultyUI(); state.partnerReady=true; updateLobby(); }
      break;
    case 'start':
      if(state.role==='guest'){ state.area=m.area||0; state.seed=m.seed>>>0; state.difficulty=m.difficulty||'normal'; state.hostId=m.hostId||m.from; state.localLives=3; state.players.clear(); for(const [id,lives] of m.lives||[]) state.players.set(id,{id,x:0,z:14,yaw:Math.PI,lives}); if(!state.players.has(state.playerId))state.players.set(state.playerId,{id:state.playerId,x:0,z:14,yaw:Math.PI,lives:3}); syncDifficultyUI(); state.startedAt=performance.now(); beginArea(false); }
      break;
    case 'player':
      if(state.role==='host'&&m.area===state.area){ const p=state.players.get(m.from)||{id:m.from,lives:3}; Object.assign(p,{x:m.x,z:m.z,yaw:m.yaw}); state.players.set(m.from,p); }
      break;
    case 'world':
      if(state.role==='guest'&&m.area===state.area){ syncWorld(m); }
      break;
    case 'hit':
      if(state.role==='host'&&m.area===state.area) hostHit(m.enemyId,m.playerId||m.from);
      break;
    case 'enemy':
      if(state.role==='guest'&&m.area===state.area){ const e=state.enemies.get(m.id); if(e){e.hp=m.hp;e.dead=m.dead;const mesh=state.enemyMeshes.get(m.id);if(mesh)mesh.visible=!m.dead;} updateBossHud(); }
      break;
    case 'damage':
      if(m.target===state.playerId&&m.area===state.area){ state.localLives=m.lives; const p=state.players.get(state.playerId)||{id:state.playerId};p.lives=m.lives;state.players.set(state.playerId,p);flashDamage();updateHud(); }
      break;
    case 'area_clear':
      if(state.role==='guest'&&m.area===state.area){ state.running=false; toast(`AREA ${state.area+1} CLEAR`,2200); }
      break;
    case 'area_start':
      if(state.role==='guest'){ state.area=m.area;state.seed=m.seed>>>0;state.difficulty=m.difficulty||state.difficulty;for(const [id,lives] of m.lives||[]){const p=state.players.get(id)||{id,x:0,z:14,yaw:Math.PI};p.lives=lives;state.players.set(id,p);if(id===state.playerId)state.localLives=lives;}beginArea(false); }
      break;
    case 'fail':
      if(state.role==='guest'){state.running=false;setOverlay('MISSION FAILED',m.reason||'チームが倒れた。','ホストの再開を待つ',true);startBtn.disabled=true;}
      break;
    case 'complete':
      if(state.role==='guest'){state.running=false;state.completed=true;setOverlay('BLACK SITE ESCAPED',`5区域を協力で突破。総時間 ${fmt(m.elapsed||0)}。`,'完了',true);startBtn.disabled=true;}
      break;
  }
}

function sendWorld(force=false){
  if(!isHost()||state.mode!=='coop'||!state.connected||!state.running)return;
  const now=performance.now(); if(!force&&now-state.lastSnapshot<125)return;state.lastSnapshot=now;
  send('world',{area:state.area,enemies:[...state.enemies.values()].map(e=>[e.id,+e.x.toFixed(2),+e.z.toFixed(2),e.hp,e.dead?1:0,e.boss?1:0,e.maxHp]),players:[...state.players.values()].map(p=>[p.id,+p.x.toFixed(2),+p.z.toFixed(2),+p.yaw.toFixed(3),p.lives])});
}
function syncWorld(m){
  for(const a of m.enemies||[]){ const [id,x,z,hp,dead,boss,maxHp]=a; let e=state.enemies.get(id); if(!e){e={id,x,z,hp,dead:!!dead,boss:!!boss,maxHp:maxHp||hp,speed:0};state.enemies.set(id,e);if(e.boss)state.bossId=id;createEnemyMesh(e);} else Object.assign(e,{x,z,hp,dead:!!dead,boss:!!boss,maxHp:maxHp||e.maxHp}); const mesh=state.enemyMeshes.get(id); if(mesh){mesh.position.set(x,0,z);mesh.visible=!dead;} }
  syncRemotePlayers(m.players||[]); for(const p of m.players||[]){if(p[0]===state.playerId){const me=state.players.get(state.playerId)||{id:state.playerId};me.lives=p[4];state.players.set(state.playerId,me);state.localLives=p[4];}}
  updateBossHud();updateHud();
}

function networkTick(now){
  if(state.mode!=='coop'||!state.connected||!state.running)return;
  if(!isHost()&&now-state.lastPlayerSend>80){state.lastPlayerSend=now;send('player',{area:state.area,x:+local.x.toFixed(2),z:+local.z.toFixed(2),yaw:+local.yaw.toFixed(3)});}
  if(isHost())sendWorld(false);
}

function animate(){
  requestAnimationFrame(animate); const dt=Math.min(.04,clock.getDelta()); const now=performance.now();
  updateLocal(dt); if(isHost()){const me=state.players.get(state.playerId);if(me)Object.assign(me,{x:local.x,z:local.z,yaw:local.yaw,lives:state.localLives});hostWorldStep(dt,now);goalCheck(now);} networkTick(now);
  updateGoalHud();updateTimer();updateBossHud(); renderer.render(scene,camera);
}
animate();

function syncModeUI(){
  $('#mode-solo').classList.toggle('active',state.mode==='solo'); $('#mode-coop').classList.toggle('active',state.mode==='coop'); $('#coop-lobby').classList.toggle('hidden',state.mode!=='coop');
  if(state.mode==='coop'){setOverlay('CO-OP BLACK SITE','部屋を作るか6桁コードで参加してください。ホストが開始すると5区域ミッションが同期します。','パートナー待ち',true);startBtn.disabled=true;} else {state.role='host';setOverlay('感染区域へ侵入','WASD / マウス、スマホは左右ドラッグ＋FIRE。通常ゾンビは一撃、ボスだけ複数発。ゴール到達で次エリアへ。','ミッション開始',true);startBtn.disabled=false;}
}
function syncDifficultyUI(){ document.querySelectorAll('.difficulty-btn').forEach(b=>b.classList.toggle('active',b.dataset.difficulty===state.difficulty)); frame.dataset.nightmare=state.difficulty==='nightmare'?'1':'0'; }

$('#mode-solo').addEventListener('click',()=>{if(state.running)return;state.mode='solo';syncModeUI();});
$('#mode-coop').addEventListener('click',()=>{if(state.running)return;state.mode='coop';syncModeUI();});
document.querySelectorAll('.difficulty-btn').forEach(b=>b.addEventListener('click',()=>{if(state.running||state.role==='guest')return;state.difficulty=b.dataset.difficulty;syncDifficultyUI();if(state.mode==='coop'&&state.connected)send('settings',{difficulty:state.difficulty,hostId:state.playerId});}));
startBtn.addEventListener('click',()=>{ if(state.completed||!state.running) resetMission(); });
$('#coop-create').addEventListener('click',async()=>{const c=roomCode();$('#coop-room-code').textContent=c;$('#coop-created').classList.remove('hidden');await connect('host',c);});
$('#coop-copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(state.room);toast('部屋コードをコピーしました');}catch{}});
$('#coop-join').addEventListener('click',async()=>{const c=$('#coop-join-code').value.trim().toUpperCase();if(!/^[A-Z0-9]{6}$/.test(c)){toast('6桁コードを入力');return;}await connect('guest',c);});
$('#coop-join-code').addEventListener('input',e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6));
$('#outbreak-fullscreen').addEventListener('click',()=>{ if(!document.fullscreenElement) frame.requestFullscreen?.(); else document.exitFullscreen?.(); });

addEventListener('keydown',e=>{keys.add(e.code);if(e.code==='Space'){e.preventDefault();shoot();}});
addEventListener('keyup',e=>keys.delete(e.code));
canvas.addEventListener('click',()=>{ if(matchMedia('(pointer:fine)').matches){if(document.pointerLockElement!==canvas)canvas.requestPointerLock?.();else shoot();} });
document.addEventListener('pointerlockchange',()=>pointerLocked=document.pointerLockElement===canvas);
document.addEventListener('mousemove',e=>{if(!pointerLocked||!state.running)return;local.yaw-=e.movementX*.00225;local.pitch=Math.max(-1.1,Math.min(1.05,local.pitch-e.movementY*.0018));});

function touchPoint(e){return {x:e.clientX,y:e.clientY};}
touchLeft.addEventListener('pointerdown',e=>{leftTouch=e.pointerId;touchLeft.setPointerCapture(e.pointerId);const r=touchLeft.getBoundingClientRect();touchStick.style.left=`${e.clientX-r.left}px`;touchStick.style.top=`${e.clientY-r.top}px`;});
touchLeft.addEventListener('pointermove',e=>{if(e.pointerId!==leftTouch)return;const r=touchLeft.getBoundingClientRect(),cx=parseFloat(touchStick.style.left)||r.width*.35,cy=parseFloat(touchStick.style.top)||r.height*.6;touchMove.x=Math.max(-1,Math.min(1,(e.clientX-r.left-cx)/46));touchMove.y=Math.max(-1,Math.min(1,(e.clientY-r.top-cy)/46));touchStick.style.transform=`translate(-50%,-50%) translate(${touchMove.x*22}px,${touchMove.y*22}px)`;});
function endLeft(e){if(e.pointerId!==leftTouch)return;leftTouch=null;touchMove.x=touchMove.y=0;touchStick.style.transform='translate(-50%,-50%)';}
touchLeft.addEventListener('pointerup',endLeft);touchLeft.addEventListener('pointercancel',endLeft);
touchRight.addEventListener('pointerdown',e=>{rightTouch=e.pointerId;lastRight=touchPoint(e);touchRight.setPointerCapture(e.pointerId);});
touchRight.addEventListener('pointermove',e=>{if(e.pointerId!==rightTouch||!lastRight)return;const p=touchPoint(e);local.yaw-=(p.x-lastRight.x)*.006;local.pitch=Math.max(-1.05,Math.min(1.0,local.pitch-(p.y-lastRight.y)*.0046));lastRight=p;});
function endRight(e){if(e.pointerId!==rightTouch)return;rightTouch=null;lastRight=null;}
touchRight.addEventListener('pointerup',endRight);touchRight.addEventListener('pointercancel',endRight);
$('#touch-fire').addEventListener('pointerdown',e=>{e.preventDefault();shoot();});

syncModeUI();syncDifficultyUI();updateHud();
