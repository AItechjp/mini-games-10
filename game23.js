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
const goalArrow = $('#goal-arrow');
const goalDirection = $('#goal-direction');

const STAGES = [
  { name:'QUARANTINE GATE', boss:'CRIMSON WARDEN', floor:0x17120f, wall:0x2b2420, accent:0xef3150, luxury:0xe8bd65, fog:0x080707, length:720, width:86 },
  { name:'ABANDONED WARD', boss:'SIREN NURSE', floor:0x171b1c, wall:0x313a3b, accent:0x8eeaff, luxury:0xe7e2c7, fog:0x090d0e, length:740, width:82 },
  { name:'FREIGHT TUNNEL', boss:'IRON BUTCHER', floor:0x171411, wall:0x332a25, accent:0xff7a2f, luxury:0xd6a153, fog:0x090807, length:760, width:80 },
  { name:'HIVE LAB', boss:'HIVE QUEEN', floor:0x151019, wall:0x2f2438, accent:0xc05cff, luxury:0xf0c96e, fog:0x08060b, length:760, width:84 },
  { name:'ZERO SECTOR', boss:'NULL TYRANT', floor:0x0d1418, wall:0x1d2b31, accent:0x52e8ff, luxury:0xd8f6ff, fog:0x030608, length:820, width:80 }
];

const DIFF = {
  easy:      { label:'EASY',      speed:8.2, zombieSpeed:1.45, bossSpeed:1.10, count:[34,42,50,58,68], bossHp:[6,7,8,10,12], touchCd:2.15, regen:true },
  normal:    { label:'NORMAL',    speed:9.2, zombieSpeed:2.05, bossSpeed:1.55, count:[50,60,70,82,94], bossHp:[10,12,15,18,22], touchCd:1.45, regen:false },
  nightmare: { label:'NIGHTMARE', speed:10.2,zombieSpeed:3.00, bossSpeed:2.15, count:[68,82,96,110,124], bossHp:[24,28,34,40,48], touchCd:.82, regen:false }
};

const state = {
  mode:new URLSearchParams(location.search).get('mode') === 'coop' ? 'coop' : 'solo',
  difficulty:'normal', role:'host', room:'', channel:null, playerId:crypto.randomUUID().slice(0,8), hostId:'',
  connected:false, partnerReady:false, running:false, completed:false, area:0, seed:0,
  startedAt:0, areaStartedAt:0, localLives:3, players:new Map(), enemies:new Map(),
  walls:[], goal:null, bossId:'boss', lastSnapshot:0, lastPlayerSend:0, lastGoalCheck:0, toastTimer:0
};

const renderer = new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.55));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.22;
renderer.shadowMap.enabled = false;
let scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(74,16/9,.08,190);
const raycaster = new THREE.Raycaster();
raycaster.far = 105;
const clock = new THREE.Clock();
const local = {x:0,z:14,yaw:0,pitch:0};
const keys = new Set();
let remoteMeshes = new Map();
let muzzleLight = null;
let pointerLocked = false;
let leftTouch = null;
let rightTouch = null;
let touchMove = {x:0,y:0};
let lastRight = null;
let bossMesh = null;
let horde = null;
const dummy = new THREE.Object3D();

const GEO = {
  torso:new THREE.BoxGeometry(.7,1.05,.42),
  head:new THREE.SphereGeometry(.34,8,6),
  arm:new THREE.BoxGeometry(.19,.9,.18),
  leg:new THREE.BoxGeometry(.23,.9,.23),
  eye:new THREE.BoxGeometry(.34,.055,.055)
};
const MAT = {
  skin:new THREE.MeshStandardMaterial({color:0x7e8d72,roughness:.95}),
  skinDark:new THREE.MeshStandardMaterial({color:0x56614f,roughness:1}),
  cloth:new THREE.MeshStandardMaterial({color:0x30372f,roughness:.92}),
  clothBlood:new THREE.MeshStandardMaterial({color:0x3d1c20,roughness:.9}),
  eyes:new THREE.MeshStandardMaterial({color:0xff183d,emissive:0xff001f,emissiveIntensity:2.8,roughness:.3}),
  player:new THREE.MeshStandardMaterial({color:0x55d8ff,roughness:.6,metalness:.08}),
  guest:new THREE.MeshStandardMaterial({color:0xffd166,roughness:.6,metalness:.08})
};

function mat(color,emissive=0,intensity=0,roughness=.6,metalness=.08){return new THREE.MeshStandardMaterial({color,emissive,emissiveIntensity:intensity,roughness,metalness});}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function hashCode(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function roomCode(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';crypto.getRandomValues(new Uint32Array(6)).forEach(n=>s+=chars[n%chars.length]);return s;}
function fmt(sec){sec=Math.max(0,Math.floor(sec));return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;}
function toast(msg,ms=1500){clearTimeout(state.toastTimer);toastEl.textContent=msg;toastEl.classList.add('show');state.toastTimer=setTimeout(()=>toastEl.classList.remove('show'),ms);}
function setOverlay(title,text,button='開始',show=true){overlayTitle.textContent=title;overlayText.textContent=text;startBtn.textContent=button;overlay.classList.toggle('hidden',!show);}
function hearts(n){return '♥'.repeat(Math.max(0,n))+'♡'.repeat(Math.max(0,3-n));}
function difficulty(){return DIFF[state.difficulty];}
function currentStage(){return STAGES[state.area];}
function isHost(){return state.mode==='solo'||state.role==='host';}
function normAngle(a){while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a;}

function resize(){const r=frame.getBoundingClientRect();const w=Math.max(1,Math.floor(r.width)),h=Math.max(1,Math.floor(r.height));renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
addEventListener('resize',resize,{passive:true});new ResizeObserver(resize).observe(frame);resize();

function clearScene(){
  state.walls=[];state.goal=null;remoteMeshes.clear();bossMesh=null;horde=null;
  while(scene.children.length)scene.remove(scene.children[0]);
}
function addBox(x,y,z,w,h,d,color,solid=true,emissive=0,rough=.58,metal=.12){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color,emissive,emissive?1.4:0,rough,metal));
  mesh.position.set(x,y,z);scene.add(mesh);
  if(solid)state.walls.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2});
  return mesh;
}
function addCylinder(x,y,z,r,h,color,emissive=0){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,12),mat(color,emissive,emissive?1.1:0,.35,.42));m.position.set(x,y,z);scene.add(m);return m;}
function addLuxuryArch(z,width,s){
  const gold=s.luxury;
  addBox(-width/2+1.2,4,z,1.3,8,.8,gold,false,0,.25,.65);
  addBox(width/2-1.2,4,z,1.3,8,.8,gold,false,0,.25,.65);
  addBox(0,7.45,z,width-1.2,.55,.8,gold,false,0,.25,.65);
  const glow=new THREE.PointLight(s.accent,.8,28);glow.position.set(0,6.3,z);scene.add(glow);
}
function addChandelier(z,s,rand){
  const g=new THREE.Group();
  const ring=new THREE.Mesh(new THREE.TorusGeometry(2.4,.12,8,28),mat(s.luxury,0,0,.2,.8));ring.rotation.x=Math.PI/2;g.add(ring);
  const inner=new THREE.Mesh(new THREE.TorusGeometry(1.25,.08,8,24),mat(s.luxury,0,0,.2,.8));inner.rotation.x=Math.PI/2;inner.position.y=-.42;g.add(inner);
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;const c=new THREE.Mesh(new THREE.OctahedronGeometry(.16),mat(0xffffff,s.accent,1.5,.08,.05));c.position.set(Math.cos(a)*2.25,-.45-Math.abs(Math.sin(a*2))*.35,Math.sin(a)*2.25);g.add(c);}
  g.position.set(0,7.15,z);scene.add(g);
  const light=new THREE.PointLight(s.luxury,1.15+rand()*.45,34);light.position.set(0,5.8,z);scene.add(light);
}

function buildEnvironment(){
  clearScene();const s=currentStage();const rand=mulberry32(state.seed^((state.area+1)*0x9e3779b9));
  scene.background=new THREE.Color(s.fog);scene.fog=new THREE.FogExp2(s.fog,state.area===4?.012:.0095);
  scene.add(new THREE.HemisphereLight(0xe8f0e8,0x160c0a,1.35));
  const key=new THREE.DirectionalLight(0xfff3dc,1.45);key.position.set(18,30,26);scene.add(key);
  camera.clear();muzzleLight=new THREE.PointLight(0xffd8a0,0,10);camera.add(muzzleLight);scene.add(camera);

  const floor=new THREE.Mesh(new THREE.PlaneGeometry(s.width,s.length+90),new THREE.MeshStandardMaterial({color:s.floor,roughness:.18,metalness:.28}));
  floor.rotation.x=-Math.PI/2;floor.position.z=-s.length/2+18;scene.add(floor);
  const ceiling=addBox(0,8.25,-s.length/2+18,s.width+6,.45,s.length+90,0x10100f,false,0,.32,.45);
  ceiling.material.side=THREE.DoubleSide;
  addBox(-s.width/2-1,3.8,-s.length/2+18,2,7.6,s.length+90,s.wall,true,0,.48,.22);
  addBox(s.width/2+1,3.8,-s.length/2+18,2,7.6,s.length+90,s.wall,true,0,.48,.22);
  addBox(0,3.8,34,s.width+4,7.6,2,s.wall,true);
  addBox(0,3.8,-s.length-3,s.width+4,7.6,2,s.wall,true);

  for(const x of [-s.width*.27,0,s.width*.27])addBox(x,.018,-s.length/2+18,.18,.035,s.length+72,s.luxury,false,0,.22,.75);
  for(let z=-12;z>-s.length;z-=28)addBox(0,.022,z,s.width-5,.04,.13,s.luxury,false,0,.22,.7);

  for(let z=-28,i=0;z>-s.length+18;z-=42,i++){
    for(const side of [-1,1]){
      const x=side*(s.width/2-4.2);addCylinder(x,3.3,z,1.0,6.4,s.luxury);
      addCylinder(x,6.55,z,1.25,.28,s.luxury);addCylinder(x,.18,z,1.25,.34,s.luxury);
      const panel=addBox(side*(s.width/2-.9),3.8,z-18,.12,3.6,13,s.accent,false,s.accent,.35,.05);panel.material.transparent=true;panel.material.opacity=.48;
    }
    if(i%2===0)addLuxuryArch(z-18,s.width-7,s);
    if(i%3===1)addChandelier(z-8,s,rand);
  }

  for(let i=0,z=-82;z>-s.length+100;i++,z-=78+Math.floor(rand()*22)){
    const gap=18+rand()*9,edge=s.width/2-2,shift=(i%2===0?-1:1)*(8+rand()*5);
    const gapCenter=Math.max(-edge+gap/2+4,Math.min(edge-gap/2-4,shift));
    const leftW=(gapCenter-gap/2)-(-edge),rightW=edge-(gapCenter+gap/2);
    if(leftW>3)addBox(-edge+leftW/2,1.25,z,leftW,2.5,3.4,0x2d2524,true,0,.72,.12);
    if(rightW>3)addBox(gapCenter+gap/2+rightW/2,1.25,z,rightW,2.5,3.4,0x2d2524,true,0,.72,.12);
    addBox(gapCenter,2.7,z-1.8,4.2,.22,.3,s.accent,false,s.accent,.3,.12);
  }

  for(let z=-55;z>-s.length+55;z-=95){
    const side=(Math.floor(Math.abs(z)/95)%2===0?-1:1);const x=side*(s.width/2-8.5);
    addBox(x,.65,z,4,1.3,4,0x191919,false,0,.18,.45);
    const statue=new THREE.Mesh(new THREE.IcosahedronGeometry(1.45,1),mat(s.luxury,0,0,.2,.75));statue.position.set(x,2.5,z);statue.rotation.set(rand()*2,rand()*2,rand()*2);scene.add(statue);
  }

  const goalMat=new THREE.MeshStandardMaterial({color:0xb5ffd0,emissive:0x23ff74,emissiveIntensity:3,transparent:true,opacity:.9,roughness:.15});
  const ring=new THREE.Mesh(new THREE.TorusGeometry(6,.5,12,48),goalMat);ring.rotation.x=Math.PI/2;ring.position.set(0,.6,-s.length+18);scene.add(ring);
  for(let i=0;i<3;i++){const halo=new THREE.Mesh(new THREE.TorusGeometry(4.2+i*.9,.09,8,36),goalMat);halo.position.set(0,2.2+i*1.65,-s.length+18);halo.rotation.y=i*.4;scene.add(halo);}
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(4.6,4.6,11,28,1,true),new THREE.MeshBasicMaterial({color:0x46ff8c,transparent:true,opacity:.12,side:THREE.DoubleSide}));beam.position.set(0,5.5,-s.length+18);scene.add(beam);
  const goalLight=new THREE.PointLight(0x5cff9b,3.4,55);goalLight.position.set(0,4,-s.length+18);scene.add(goalLight);
  state.goal=new THREE.Vector3(0,0,-s.length+18);

  local.x=0;local.z=14;local.yaw=0;local.pitch=0;updateCamera();
  state.players.set(state.playerId,{id:state.playerId,x:0,z:14,yaw:0,lives:state.localLives,role:state.role});
}

function makeHorde(capacity){
  const meshes={
    body:new THREE.InstancedMesh(GEO.torso,MAT.cloth,capacity),head:new THREE.InstancedMesh(GEO.head,MAT.skin,capacity),
    lArm:new THREE.InstancedMesh(GEO.arm,MAT.skinDark,capacity),rArm:new THREE.InstancedMesh(GEO.arm,MAT.skinDark,capacity),
    lLeg:new THREE.InstancedMesh(GEO.leg,MAT.clothBlood,capacity),rLeg:new THREE.InstancedMesh(GEO.leg,MAT.clothBlood,capacity),
    eyes:new THREE.InstancedMesh(GEO.eye,MAT.eyes,capacity)
  };
  for(const m of Object.values(meshes)){m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.frustumCulled=false;m.userData.hordePart=true;scene.add(m);}
  horde={...meshes,capacity};
}
function setInstance(mesh,index,e,ox,oy,oz,rx,ry,rz,sx=1,sy=1,sz=1){
  const c=Math.cos(e.visualYaw||0),s=Math.sin(e.visualYaw||0);
  dummy.position.set(e.x+ox*c+oz*s,oy,e.z-ox*s+oz*c);dummy.rotation.set(rx,(e.visualYaw||0)+ry,rz);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);
}
function hideInstance(mesh,index){dummy.position.set(0,-1000,0);dummy.rotation.set(0,0,0);dummy.scale.set(.001,.001,.001);dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);}
function updateHordeVisuals(now){
  if(!horde){animateBoss(now);return;}const t=now*.001;
  for(const e of state.enemies.values()){
    if(e.boss)continue;const i=e.index;if(i<0||i>=horde.capacity)continue;
    if(e.dead){for(const k of ['body','head','lArm','rArm','lLeg','rLeg','eyes'])hideInstance(horde[k],i);continue;}
    const gait=Math.sin(t*(5.4+e.speed*.95)+e.phase),bob=Math.abs(Math.sin(t*5.1+e.phase))*.11;
    const lean=.24+e.lean,twist=Math.sin(t*2.2+e.phase)*.06;
    setInstance(horde.body,i,e,0,1.32+bob,0,lean,0,twist);
    setInstance(horde.head,i,e,0,2.08+bob,-.14,lean*.55,0,Math.sin(t*3+e.phase)*.08,e.headScale,e.headScale,e.headScale);
    setInstance(horde.lArm,i,e,-.48,1.35+bob,-.18,-1.18+gait*.42,0,-.18,1,1.08,1);
    setInstance(horde.rArm,i,e,.48,1.35+bob,-.18,-1.14-gait*.42,0,.18,1,1.08,1);
    setInstance(horde.lLeg,i,e,-.22,.48,0,gait*.55,0,0);
    setInstance(horde.rLeg,i,e,.22,.48,0,-gait*.55,0,0);
    setInstance(horde.eyes,i,e,0,2.12+bob,-.315,lean*.45,0,0);
  }
  for(const m of Object.values(horde))if(m?.instanceMatrix)m.instanceMatrix.needsUpdate=true;
  animateBoss(now);
}

function humanoid(material,boss=false,variant=0){
  const g=new THREE.Group();
  const body=new THREE.Mesh(GEO.torso,material);body.position.y=1.32;body.name='body';g.add(body);
  const head=new THREE.Mesh(GEO.head,variant===1?mat(0xe8ddd5):material);head.position.y=2.18;head.name='head';g.add(head);
  for(const [name,x,y] of [['lArm',-.48,1.3],['rArm',.48,1.3],['lLeg',-.22,.45],['rLeg',.22,.45]]){const limb=new THREE.Mesh(name.includes('Arm')?GEO.arm:GEO.leg,material);limb.position.set(x,y,0);limb.name=name;g.add(limb);}
  if(boss)g.scale.setScalar(variant===4?2.35:variant===1?1.85:2.05);return g;
}
function bossMaterial(area){if(area===0)return mat(0x7d1527,0xff2348,.8);if(area===1)return mat(0xe6e7df,0x68dfff,.35);if(area===2)return mat(0x4a4d54,0xff6a2e,.5);if(area===3)return mat(0x542869,0xc05cff,.75);return mat(0x101820,0x48eaff,1.0);}
function addDecoration(group,geo,material,x,y,z){const m=new THREE.Mesh(geo,material);m.position.set(x,y,z);group.add(m);return m;}
function createBossMesh(e){
  const g=humanoid(bossMaterial(state.area),true,state.area);g.userData.enemyId=e.id;g.traverse(o=>o.userData.enemyId=e.id);
  if(state.area===0){const h=addDecoration(g,new THREE.ConeGeometry(.2,.8,8),mat(0x250006),-.4,2.8,0);h.rotation.z=-.25;const h2=h.clone();h2.position.x=.4;h2.rotation.z=.25;g.add(h2);}
  if(state.area===1){const halo=addDecoration(g,new THREE.TorusGeometry(.55,.07,8,24),mat(0xffffff,0x66eaff,1.8),0,2.95,0);halo.rotation.x=Math.PI/2;}
  if(state.area===2)addDecoration(g,new THREE.BoxGeometry(1,.36,.75),mat(0x20242a),0,1.7,0);
  if(state.area===3)for(let i=0;i<3;i++){const arm=addDecoration(g,new THREE.BoxGeometry(.18,1.25,.18),mat(0x5d2b73,0xb951ff,.5),(i-1)*.45,1.55,-.15);arm.rotation.z=(i-1)*.55;}
  if(state.area===4)addDecoration(g,new THREE.OctahedronGeometry(.42),mat(0x0d1820,0x4beaff,2.2),0,2.2,.35);
  g.position.set(e.x,0,e.z);scene.add(g);bossMesh=g;return g;
}
function animateBoss(now){if(!bossMesh)return;const e=state.enemies.get('boss');if(!e||e.dead){bossMesh.visible=false;return;}bossMesh.visible=true;const t=now*.001;bossMesh.position.set(e.x,Math.abs(Math.sin(t*4.5))*.06,e.z);bossMesh.rotation.y=e.visualYaw||0;bossMesh.rotation.z=Math.sin(t*2.3)*.035;for(const o of bossMesh.children){if(o.name==='lArm')o.rotation.x=-.85+Math.sin(t*5)*.45;if(o.name==='rArm')o.rotation.x=-.85-Math.sin(t*5)*.45;if(o.name==='head')o.rotation.y=Math.sin(t*3.2)*.14;}}

function createRemoteMesh(id){const g=humanoid(id===state.hostId?MAT.player:MAT.guest,false,0);g.userData.playerId=id;scene.add(g);remoteMeshes.set(id,g);return g;}
function syncRemotePlayers(players){for(const p of players){const[id,x,z,yaw,lives]=p;if(id===state.playerId)continue;state.players.set(id,{id,x,z,yaw,lives});const mesh=remoteMeshes.get(id)||createRemoteMesh(id);mesh.position.set(x,0,z);mesh.rotation.y=yaw;}}

function spawnHostWorld(){
  state.enemies.clear();const s=currentStage(),d=difficulty(),rand=mulberry32(state.seed^0x51f15e),count=d.count[state.area];
  makeHorde(count);
  for(let i=0;i<count;i++){
    const band=i%5,baseZ=-48-rand()*(s.length-125),cluster=(band-2)*7;
    const z=Math.max(-s.length+55,baseZ+cluster+(rand()-.5)*10),x=(rand()-.5)*(s.width-15);
    state.enemies.set(`z${i}`,{id:`z${i}`,index:i,x,z,hp:1,maxHp:1,boss:false,dead:false,speed:d.zombieSpeed*(.82+rand()*.42),phase:rand()*Math.PI*2,lean:.03+rand()*.14,headScale:.88+rand()*.2,visualYaw:0,weave:(rand()-.5)*1.1});
  }
  const hp=d.bossHp[state.area],boss={id:'boss',index:-1,x:0,z:-s.length*.76,hp,maxHp:hp,boss:true,dead:false,speed:d.bossSpeed,phase:0,lean:0,headScale:1,visualYaw:0};state.enemies.set('boss',boss);createBossMesh(boss);updateHordeVisuals(performance.now());updateBossHud();
}

function blocked(x,z){const r=.72,s=currentStage();if(x<-s.width/2+r||x>s.width/2-r||z>31||z<-s.length+4)return true;for(const w of state.walls)if(x+r>w.minX&&x-r<w.maxX&&z+r>w.minZ&&z-r<w.maxZ)return true;return false;}
function updateCamera(){camera.position.set(local.x,1.72,local.z);camera.rotation.order='YXZ';camera.rotation.y=local.yaw;camera.rotation.x=local.pitch;}
function updateLocal(dt){
  if(!state.running||state.localLives<=0)return;
  let forward=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0)-touchMove.y,strafe=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+touchMove.x;
  const mag=Math.hypot(forward,strafe);if(mag>1){forward/=mag;strafe/=mag;}
  const sp=difficulty().speed,sx=Math.sin(local.yaw),cz=Math.cos(local.yaw),dx=(sx*forward+cz*strafe)*sp*dt,dz=(-cz*forward+sx*strafe)*sp*dt;
  if(!blocked(local.x+dx,local.z))local.x+=dx;if(!blocked(local.x,local.z+dz))local.z+=dz;updateCamera();
  const me=state.players.get(state.playerId)||{};Object.assign(me,{id:state.playerId,x:local.x,z:local.z,yaw:local.yaw,lives:state.localLives});state.players.set(state.playerId,me);
}
function nearestLivingPlayer(e){let best=null,bd=Infinity;for(const p of state.players.values()){if((p.lives??0)<=0)continue;const d=Math.hypot(p.x-e.x,p.z-e.z);if(d<bd){bd=d;best=p;}}return best?{p:best,d:bd}:null;}
const damageCooldown=new Map();
function hostWorldStep(dt,now){
  if(!isHost()||!state.running)return;const t=now*.001;
  for(const e of state.enemies.values()){
    if(e.dead)continue;const n=nearestLivingPlayer(e);if(!n)continue;const dx=n.p.x-e.x,dz=n.p.z-e.z,len=Math.hypot(dx,dz)||1;
    const sideX=-dz/len,sideZ=dx/len,weave=e.boss?0:Math.sin(t*2.2+e.phase)*e.weave;
    const step=e.speed*dt,nx=e.x+(dx/len+sideX*weave*.12)*step,nz=e.z+(dz/len+sideZ*weave*.12)*step;
    if(!blocked(nx,nz)){e.x=nx;e.z=nz;}else if(!blocked(nx,e.z))e.x=nx;else if(!blocked(e.x,nz))e.z=nz;
    e.visualYaw=Math.atan2(dx,dz);
    const hitRadius=e.boss?2.1:.96;if(n.d<hitRadius){const last=damageCooldown.get(n.p.id)||0;if(now-last>difficulty().touchCd*1000){damageCooldown.set(n.p.id,now);damagePlayer(n.p.id);}}
  }
}
function damagePlayer(id){const p=state.players.get(id);if(!p||p.lives<=0)return;p.lives=Math.max(0,p.lives-1);state.players.set(id,p);if(id===state.playerId){state.localLives=p.lives;flashDamage();}send('damage',{target:id,lives:p.lives,area:state.area});updateHud();if(p.lives<=0)failMission('ライフが0になった。ゾンビの群れに飲み込まれた。');}
function flashDamage(){damageFlash.classList.add('on');setTimeout(()=>damageFlash.classList.remove('on'),145);toast(`DAMAGE - LIFE ${state.localLives}`);}

function shoot(){
  if(!state.running||state.localLives<=0)return;muzzleLight.intensity=5;setTimeout(()=>{if(muzzleLight)muzzleLight.intensity=0;},45);raycaster.setFromCamera(new THREE.Vector2(0,0),camera);
  const targets=[];if(horde)targets.push(horde.body,horde.head,horde.lArm,horde.rArm);if(bossMesh?.visible)targets.push(bossMesh);
  const hits=raycaster.intersectObjects(targets,true);if(!hits.length){toast('MISS',260);return;}const hit=hits[0];
  let id='';if(hit.object.userData?.hordePart&&Number.isInteger(hit.instanceId))id=`z${hit.instanceId}`;else{let obj=hit.object;while(obj&&!id){id=obj.userData?.enemyId||'';obj=obj.parent;}}
  if(!id)return;if(isHost())hostHit(id,state.playerId);else send('hit',{enemyId:id,playerId:state.playerId,area:state.area});
}
function hostHit(id,playerId){const e=state.enemies.get(id);if(!e||e.dead)return;e.hp=Math.max(0,e.hp-1);if(e.hp<=0){e.dead=true;if(e.boss&&bossMesh)bossMesh.visible=false;send('enemy',{id,hp:0,dead:true,area:state.area});toast(e.boss?`${currentStage().boss} DOWN`:'ONE SHOT',520);}else{send('enemy',{id,hp:e.hp,dead:false,area:state.area});if(e.boss)toast(`${currentStage().boss} ${e.hp}/${e.maxHp}`,650);}updateBossHud();}
function updateBossHud(){const e=state.enemies.get('boss');$('#hud-boss').textContent=!e?'---':e.dead?'DOWN':`${currentStage().boss} ${e.hp}/${e.maxHp}`;if(e&&!e.dead&&local.z<e.z+95){bossNameEl.textContent=currentStage().boss;bossBanner.classList.remove('hidden');}else bossBanner.classList.add('hidden');}

function goalCheck(now){if(!isHost()||!state.running||now-state.lastGoalCheck<160)return;state.lastGoalCheck=now;const active=[...state.players.values()].filter(p=>(p.lives??0)>0);const needed=state.mode==='coop'?2:1;if(active.length<needed)return;const all=active.every(p=>Math.hypot(p.x-state.goal.x,p.z-state.goal.z)<7.5);if(all)clearArea();}
function clearArea(){if(!isHost()||!state.running)return;state.running=false;send('area_clear',{area:state.area});const last=state.area===STAGES.length-1;if(last){completeMission();return;}toast(`AREA ${state.area+1} CLEAR`,2000);setTimeout(()=>{if(difficulty().regen){for(const p of state.players.values())p.lives=Math.min(3,(p.lives||0)+1);state.localLives=state.players.get(state.playerId)?.lives||state.localLives;}state.area++;state.seed=(state.seed+0x9e3779b9)>>>0;send('area_start',{area:state.area,seed:state.seed,difficulty:state.difficulty,lives:[...state.players.values()].map(p=>[p.id,p.lives])});beginArea(false);},2050);}
function completeMission(){state.running=false;state.completed=true;const elapsed=(performance.now()-state.startedAt)/1000;send('complete',{elapsed,area:state.area});setOverlay('BLACK SITE ESCAPED',`5区域を突破。総時間 ${fmt(elapsed)} / 残りライフ ${state.localLives}。${state.mode==='coop'?'2人協力ミッション完了。':'単独生還。'}`,'最初から再挑戦',true);startBtn.disabled=false;recordResult(elapsed).catch(()=>{});}
async function recordResult(elapsed){const gb=window.GameBackend;if(!gb?.ready)return;const mult=state.difficulty==='nightmare'?3:state.difficulty==='normal'?2:1,score=Math.max(1,Math.round(mult*100000-elapsed*80+state.localLives*3000));await gb.recordScore({gameId:'outbreak23',mode:state.mode==='coop'?'online':'solo',score,durationMs:Math.round(elapsed*1000),roomCode:state.room||null,extra:{difficulty:state.difficulty,areas:5}});}
function failMission(reason){if(!isHost())return;state.running=false;send('fail',{reason,area:state.area});setOverlay('MISSION FAILED',reason,'エリア1から再挑戦',true);startBtn.disabled=false;}
function beginArea(fromStart=true){state.running=false;buildEnvironment();if(isHost())spawnHostWorld();state.areaStartedAt=performance.now();if(fromStart)state.startedAt=state.areaStartedAt;updateHud();setTimeout(()=>{state.running=true;overlay.classList.add('hidden');if(isHost())sendWorld(true);toast(`AREA ${state.area+1} / ${currentStage().name}`,1800);},600);}
function resetMission(){state.completed=false;state.area=0;state.seed=state.mode==='coop'?(hashCode(state.room||'BLACKSITE')^Date.now())>>>0:(Date.now()>>>0);state.localLives=3;for(const p of state.players.values())p.lives=3;state.players.set(state.playerId,{id:state.playerId,x:0,z:14,yaw:0,lives:3,role:state.role});if(state.mode==='coop'&&!isHost()){toast('ホストの開始を待っています');return;}if(state.mode==='coop'&&!state.partnerReady){toast('パートナーの接続を待っています');return;}send('start',{area:0,seed:state.seed,difficulty:state.difficulty,lives:[...state.players.values()].map(p=>[p.id,3]),hostId:state.playerId});beginArea(true);}

function updateHud(){
  $('#hud-area').textContent=`${state.area+1} / 5`;$('#hud-life').textContent=hearts(state.localLives);frame.dataset.nightmare=state.difficulty==='nightmare'?'1':'0';
  const partner=[...state.players.values()].find(p=>p.id!==state.playerId),mate=$('#mate-hud');mate.classList.toggle('hidden',state.mode!=='coop');$('#hud-mate').textContent=partner?hearts(partner.lives??3):(state.connected?'WAIT':'---');
}
function updateGoalHud(){
  if(!state.goal)return;const dx=state.goal.x-local.x,dz=state.goal.z-local.z,dist=Math.hypot(dx,dz);$('#hud-goal').textContent=`${Math.round(dist)}m`;
  const targetYaw=Math.atan2(dx,-dz),relative=normAngle(targetYaw-local.yaw);if(goalArrow)goalArrow.style.transform=`rotate(${relative}rad)`;if(goalDirection)goalDirection.textContent=`GOAL ${Math.round(dist)}m`;
}
function updateTimer(){const base=state.startedAt||performance.now();$('#hud-time').textContent=fmt((performance.now()-base)/1000);}

function send(kind,payload={}){if(!state.channel||!state.connected)return Promise.resolve();return state.channel.send({type:'broadcast',event:'game',payload:{kind,from:state.playerId,...payload}}).catch(()=>{});}
function client(){return window.GameBackend?.client||null;}
async function connect(role,code){
  if(!client()){ $('#coop-status').textContent='Supabase未接続';toast('リアルタイム接続を利用できません');return;}if(state.channel){try{await state.channel.unsubscribe();}catch{}}
  state.role=role;state.room=code;state.hostId=role==='host'?state.playerId:'';state.connected=false;state.partnerReady=false;
  const ch=client().channel(`outbreak23:${code}`,{config:{broadcast:{self:false,ack:false},presence:{key:state.playerId}}});state.channel=ch;
  ch.on('broadcast',{event:'game'},({payload})=>onNetwork(payload));
  ch.on('presence',{event:'sync'},()=>{const ids=Object.keys(ch.presenceState());state.partnerReady=ids.some(id=>id!==state.playerId);updateLobby();if(role==='host'&&state.partnerReady)send('settings',{difficulty:state.difficulty,hostId:state.playerId});});
  ch.subscribe(async status=>{if(status==='SUBSCRIBED'){state.connected=true;await ch.track({role,id:state.playerId,joinedAt:Date.now()});updateLobby();send('hello',{role});}else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)){state.connected=false;updateLobby(status);}});
}
function updateLobby(extra=''){const s=$('#coop-status'),d=$('#coop-detail');if(!state.connected){s.textContent='接続中…';d.textContent=extra||'Realtime channel';return;}if(state.role==='host'){s.textContent=state.partnerReady?'パートナー接続済み':'部屋を公開中';d.textContent=`ROOM ${state.room} / ${state.partnerReady?'START OK':'相手を待っています'}`;}else{s.textContent=state.partnerReady?'ホスト接続済み':'部屋に参加済み';d.textContent=`ROOM ${state.room} / ホストの開始を待つ`;}startBtn.disabled=state.role==='guest'||!state.partnerReady;}

function applyWorldEnemy(a){
  const[id,index,x,z,hp,dead,boss,maxHp,speed,phase,lean,headScale,visualYaw]=a;let e=state.enemies.get(id);
  if(!e){e={id,index,x,z,hp,dead:!!dead,boss:!!boss,maxHp:maxHp||hp,speed:speed||2,phase:phase||0,lean:lean||.08,headScale:headScale||1,visualYaw:visualYaw||0,weave:0};state.enemies.set(id,e);}else Object.assign(e,{index,x,z,hp,dead:!!dead,boss:!!boss,maxHp:maxHp||e.maxHp,speed:speed||e.speed,phase:phase??e.phase,lean:lean??e.lean,headScale:headScale??e.headScale,visualYaw:visualYaw??e.visualYaw});
  if(e.boss&&!bossMesh)createBossMesh(e);
}
function onNetwork(m){
  if(!m||m.from===state.playerId)return;
  switch(m.kind){
    case 'hello':if(state.role==='host'){state.partnerReady=true;state.players.set(m.from,{id:m.from,x:0,z:14,yaw:0,lives:3});send('settings',{difficulty:state.difficulty,hostId:state.playerId});updateLobby();}else if(m.role==='host'){state.hostId=m.from;state.partnerReady=true;updateLobby();}break;
    case 'settings':if(state.role==='guest'){state.difficulty=m.difficulty||state.difficulty;state.hostId=m.hostId||m.from;syncDifficultyUI();state.partnerReady=true;updateLobby();}break;
    case 'start':if(state.role==='guest'){state.area=m.area||0;state.seed=m.seed>>>0;state.difficulty=m.difficulty||'normal';state.hostId=m.hostId||m.from;state.localLives=3;state.players.clear();for(const[id,lives]of m.lives||[])state.players.set(id,{id,x:0,z:14,yaw:0,lives});if(!state.players.has(state.playerId))state.players.set(state.playerId,{id:state.playerId,x:0,z:14,yaw:0,lives:3});syncDifficultyUI();state.startedAt=performance.now();beginArea(false);}break;
    case 'player':if(state.role==='host'&&m.area===state.area){const p=state.players.get(m.from)||{id:m.from,lives:3};Object.assign(p,{x:m.x,z:m.z,yaw:m.yaw});state.players.set(m.from,p);}break;
    case 'world':if(state.role==='guest'&&m.area===state.area)syncWorld(m);break;
    case 'hit':if(state.role==='host'&&m.area===state.area)hostHit(m.enemyId,m.playerId||m.from);break;
    case 'enemy':if(state.role==='guest'&&m.area===state.area){const e=state.enemies.get(m.id);if(e){e.hp=m.hp;e.dead=m.dead;}if(m.id==='boss'&&bossMesh)bossMesh.visible=!m.dead;updateBossHud();}break;
    case 'damage':if(m.target===state.playerId&&m.area===state.area){state.localLives=m.lives;const p=state.players.get(state.playerId)||{id:state.playerId};p.lives=m.lives;state.players.set(state.playerId,p);flashDamage();updateHud();}break;
    case 'area_clear':if(state.role==='guest'&&m.area===state.area){state.running=false;toast(`AREA ${state.area+1} CLEAR`,2000);}break;
    case 'area_start':if(state.role==='guest'){state.area=m.area;state.seed=m.seed>>>0;state.difficulty=m.difficulty||state.difficulty;for(const[id,lives]of m.lives||[]){const p=state.players.get(id)||{id,x:0,z:14,yaw:0};p.lives=lives;state.players.set(id,p);if(id===state.playerId)state.localLives=lives;}beginArea(false);}break;
    case 'fail':if(state.role==='guest'){state.running=false;setOverlay('MISSION FAILED',m.reason||'チームが倒れた。','ホストの再開を待つ',true);startBtn.disabled=true;}break;
    case 'complete':if(state.role==='guest'){state.running=false;state.completed=true;setOverlay('BLACK SITE ESCAPED',`5区域を協力で突破。総時間 ${fmt(m.elapsed||0)}。`,'完了',true);startBtn.disabled=true;}break;
  }
}
function sendWorld(force=false){
  if(!isHost()||state.mode!=='coop'||!state.connected||!state.running)return;const now=performance.now();if(!force&&now-state.lastSnapshot<165)return;state.lastSnapshot=now;
  send('world',{area:state.area,enemies:[...state.enemies.values()].map(e=>[e.id,e.index??-1,+e.x.toFixed(2),+e.z.toFixed(2),e.hp,e.dead?1:0,e.boss?1:0,e.maxHp,+e.speed.toFixed(2),+((e.phase||0).toFixed(2)),+((e.lean||0).toFixed(2)),+((e.headScale||1).toFixed(2)),+((e.visualYaw||0).toFixed(2))]),players:[...state.players.values()].map(p=>[p.id,+p.x.toFixed(2),+p.z.toFixed(2),+p.yaw.toFixed(3),p.lives])});
}
function syncWorld(m){
  const normal=(m.enemies||[]).filter(a=>!a[6]);if(!horde&&normal.length)makeHorde(Math.max(normal.length,difficulty().count[state.area]));for(const a of m.enemies||[])applyWorldEnemy(a);
  syncRemotePlayers(m.players||[]);for(const p of m.players||[])if(p[0]===state.playerId){const me=state.players.get(state.playerId)||{id:state.playerId};me.lives=p[4];state.players.set(state.playerId,me);state.localLives=p[4];}updateBossHud();updateHud();
}
function networkTick(now){if(state.mode!=='coop'||!state.connected||!state.running)return;if(!isHost()&&now-state.lastPlayerSend>75){state.lastPlayerSend=now;send('player',{area:state.area,x:+local.x.toFixed(2),z:+local.z.toFixed(2),yaw:+local.yaw.toFixed(3)});}if(isHost())sendWorld(false);}

function animate(){requestAnimationFrame(animate);const dt=Math.min(.04,clock.getDelta()),now=performance.now();updateLocal(dt);if(isHost()){const me=state.players.get(state.playerId);if(me)Object.assign(me,{x:local.x,z:local.z,yaw:local.yaw,lives:state.localLives});hostWorldStep(dt,now);goalCheck(now);}networkTick(now);updateHordeVisuals(now);updateGoalHud();updateTimer();updateBossHud();renderer.render(scene,camera);}
animate();

function syncModeUI(){$('#mode-solo').classList.toggle('active',state.mode==='solo');$('#mode-coop').classList.toggle('active',state.mode==='coop');$('#coop-lobby').classList.toggle('hidden',state.mode!=='coop');if(state.mode==='coop'){setOverlay('CO-OP BLACK SITE','部屋を作るか6桁コードで参加。大量のゾンビを2人でかいくぐり、画面上部の矢印が示すゴールへ向かってください。','パートナー待ち',true);startBtn.disabled=true;}else{state.role='host';setOverlay('感染区域へ侵入','上部の矢印が常にゴール方向を表示。WASD / マウス、スマホは左右ドラッグ＋FIRE。大量のゾンビを撃ち抜くか走り抜けろ。','ミッション開始',true);startBtn.disabled=false;}}
function syncDifficultyUI(){document.querySelectorAll('.difficulty-btn').forEach(b=>b.classList.toggle('active',b.dataset.difficulty===state.difficulty));frame.dataset.nightmare=state.difficulty==='nightmare'?'1':'0';}
$('#mode-solo').addEventListener('click',()=>{if(state.running)return;state.mode='solo';syncModeUI();});
$('#mode-coop').addEventListener('click',()=>{if(state.running)return;state.mode='coop';syncModeUI();});
document.querySelectorAll('.difficulty-btn').forEach(b=>b.addEventListener('click',()=>{if(state.running||state.role==='guest')return;state.difficulty=b.dataset.difficulty;syncDifficultyUI();if(state.mode==='coop'&&state.connected)send('settings',{difficulty:state.difficulty,hostId:state.playerId});}));
startBtn.addEventListener('click',()=>{if(state.completed||!state.running)resetMission();});
$('#coop-create').addEventListener('click',async()=>{const c=roomCode();$('#coop-room-code').textContent=c;$('#coop-created').classList.remove('hidden');await connect('host',c);});
$('#coop-copy').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(state.room);toast('部屋コードをコピーしました');}catch{}});
$('#coop-join').addEventListener('click',async()=>{const c=$('#coop-join-code').value.trim().toUpperCase();if(!/^[A-Z0-9]{6}$/.test(c)){toast('6桁コードを入力');return;}await connect('guest',c);});
$('#coop-join-code').addEventListener('input',e=>e.target.value=e.target.value.toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,6));
$('#outbreak-fullscreen').addEventListener('click',()=>{if(!document.fullscreenElement)frame.requestFullscreen?.();else document.exitFullscreen?.();});

addEventListener('keydown',e=>{keys.add(e.code);if(e.code==='Space'){e.preventDefault();shoot();}});addEventListener('keyup',e=>keys.delete(e.code));
canvas.addEventListener('click',()=>{if(matchMedia('(pointer:fine)').matches){if(document.pointerLockElement!==canvas)canvas.requestPointerLock?.();else shoot();}});
document.addEventListener('pointerlockchange',()=>pointerLocked=document.pointerLockElement===canvas);
document.addEventListener('mousemove',e=>{if(!pointerLocked||!state.running)return;local.yaw-=e.movementX*.00225;local.pitch=Math.max(-1.1,Math.min(1.05,local.pitch-e.movementY*.0018));});
function touchPoint(e){return{x:e.clientX,y:e.clientY};}
touchLeft.addEventListener('pointerdown',e=>{leftTouch=e.pointerId;touchLeft.setPointerCapture(e.pointerId);const r=touchLeft.getBoundingClientRect();touchStick.style.left=`${e.clientX-r.left}px`;touchStick.style.top=`${e.clientY-r.top}px`;});
touchLeft.addEventListener('pointermove',e=>{if(e.pointerId!==leftTouch)return;const r=touchLeft.getBoundingClientRect(),cx=parseFloat(touchStick.style.left)||r.width*.35,cy=parseFloat(touchStick.style.top)||r.height*.6;touchMove.x=Math.max(-1,Math.min(1,(e.clientX-r.left-cx)/46));touchMove.y=Math.max(-1,Math.min(1,(e.clientY-r.top-cy)/46));touchStick.style.transform=`translate(-50%,-50%) translate(${touchMove.x*22}px,${touchMove.y*22}px)`;});
function endLeft(e){if(e.pointerId!==leftTouch)return;leftTouch=null;touchMove.x=touchMove.y=0;touchStick.style.transform='translate(-50%,-50%)';}touchLeft.addEventListener('pointerup',endLeft);touchLeft.addEventListener('pointercancel',endLeft);
touchRight.addEventListener('pointerdown',e=>{rightTouch=e.pointerId;lastRight=touchPoint(e);touchRight.setPointerCapture(e.pointerId);});
touchRight.addEventListener('pointermove',e=>{if(e.pointerId!==rightTouch||!lastRight)return;const p=touchPoint(e);local.yaw-=(p.x-lastRight.x)*.006;local.pitch=Math.max(-1.05,Math.min(1,local.pitch-(p.y-lastRight.y)*.0046));lastRight=p;});
function endRight(e){if(e.pointerId!==rightTouch)return;rightTouch=null;lastRight=null;}touchRight.addEventListener('pointerup',endRight);touchRight.addEventListener('pointercancel',endRight);
$('#touch-fire').addEventListener('pointerdown',e=>{e.preventDefault();shoot();});

syncModeUI();syncDifficultyUI();updateHud();
