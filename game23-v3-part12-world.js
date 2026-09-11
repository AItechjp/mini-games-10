/* GAME 23 WORLD REBUILD — winding survival-horror routes, 10 infected classes, dense low-cost scenery. */
const V5_TYPES=['walker','runner','crawler','hound','stalker','brute','spitter','leaper','armored','bloater'];
const V5_LABELS={walker:'WALKER',runner:'RUNNER',crawler:'CRAWLER',hound:'HOUND',stalker:'STALKER',brute:'BRUTE',spitter:'SPITTER',leaper:'LEAPER',armored:'ARMORED',bloater:'BLOATER'};
const V5_COLORS={walker:0x78806c,runner:0x9a6c5d,crawler:0x73564e,hound:0x70443e,stalker:0xa74750,brute:0x9a9476,spitter:0x6e9a62,leaper:0x8f5b72,armored:0x626b70,bloater:0x8e7756};
const V5_GEO={
  road:new THREE.BoxGeometry(1,.055,1),
  rock:new THREE.DodecahedronGeometry(1,0),
  crate:new THREE.BoxGeometry(1.25,1.25,1.25),
  barrel:new THREE.CylinderGeometry(.48,.52,1.35,9),
  tomb:new THREE.BoxGeometry(.75,1.4,.24),
  trunk:new THREE.CylinderGeometry(.18,.32,3.7,7),
  branch:new THREE.CylinderGeometry(.08,.14,2.1,6),
  fence:new THREE.BoxGeometry(2.8,.16,.12),
  car:new THREE.BoxGeometry(2.3,.62,4.3),
  cabin:new THREE.BoxGeometry(1.75,.58,2.05),
  armor:new THREE.BoxGeometry(.88,.72,.18),
  sac:new THREE.SphereGeometry(.48,8,6),
  spike:new THREE.ConeGeometry(.16,.72,6)
};
const V5_MAT={
  road:mat(0x28292a,0,0,.95,.04),rock:mat(0x51504b,0,0,1,0),wood:mat(0x46352d,0,0,.96,.01),
  rust:mat(0x5b3b30,0,0,.82,.24),stone:mat(0x69645d,0,0,.97,.01),metal:mat(0x353b3e,0,0,.62,.42),
  armor:mat(0x414b50,0,0,.48,.58),sac:mat(0x779a4a,0x355617,.7,.75,.02),spike:mat(0xbaa89a,0,0,.82,.05)
};
let v5Route=[];
let v5PropPools=null;
let v5AssetToken=0;

const v5Css=document.createElement('style');
v5Css.textContent=`
.v5-vignette{position:absolute;inset:0;z-index:18;pointer-events:none;background:radial-gradient(circle at 50% 44%,transparent 38%,rgba(0,0,0,.18) 73%,rgba(0,0,0,.52) 100%),linear-gradient(180deg,rgba(9,13,14,.06),rgba(30,0,5,.09));mix-blend-mode:multiply}
.v5-enemy-roster{position:absolute;z-index:23;left:50%;top:92px;transform:translateX(-50%);max-width:78%;padding:5px 9px;border:1px solid rgba(255,255,255,.12);border-radius:999px;background:rgba(5,9,10,.66);color:#d9e0dc;font:800 .49rem/1.25 system-ui,-apple-system,"Noto Sans JP",sans-serif;letter-spacing:.055em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;pointer-events:none}
@media(max-width:820px){.v5-enemy-roster{top:76px;max-width:62%;font-size:.43rem;padding:4px 7px}}
.game23-frame.performance-mode .v5-enemy-roster{backdrop-filter:none;-webkit-backdrop-filter:none}
`;
document.head.appendChild(v5Css);
const v5Vignette=document.createElement('div');v5Vignette.className='v5-vignette';frame.appendChild(v5Vignette);
const v5Roster=document.createElement('div');v5Roster.className='v5-enemy-roster';v5Roster.textContent='感染体10種 / WALKER・RUNNER・CRAWLER・HOUND・STALKER・BRUTE・SPITTER・LEAPER・ARMORED・BLOATER';frame.appendChild(v5Roster);

function v5RouteAt(t){
  const m=state.maze,amp=Math.min(20,m.cols*m.cell*.23),edge=Math.sin(Math.PI*clamp(t,0,1));
  const x=(Math.sin(t*Math.PI*5.15+state.area*.72)*amp*.72+Math.sin(t*Math.PI*9.4+1.2)*amp*.20)*edge;
  const z=m.z0-8-t*((m.rows-9)*m.cell);
  return{x,z};
}
function v5BuildRoute(){v5Route=[];for(let i=0;i<=38;i++)v5Route.push(v5RouteAt(i/38));return v5Route;}
function v5Road(stage){
  const width=stage.key==='city'?13:stage.key==='sea'?11:9.5;
  for(let i=0;i<v5Route.length-1;i++){
    const a=v5Route[i],b=v5Route[i+1],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz),road=new THREE.Mesh(V5_GEO.road,V5_MAT.road);
    road.position.set((a.x+b.x)/2,.012,(a.z+b.z)/2);road.scale.set(width,1,len*1.05);road.rotation.y=Math.atan2(dx,dz);scene.add(road);
    if(stage.key==='city'&&i%2===0){const stripe=new THREE.Mesh(V5_GEO.road,mat(0xa88d4d,0,0,.9,.02));stripe.position.set(road.position.x,.046,road.position.z);stripe.scale.set(.12,1,len*.72);stripe.rotation.y=road.rotation.y;scene.add(stripe);}
  }
}
function v5Pools(cap=180){
  const make=(geo,material)=>{const m=new THREE.InstancedMesh(geo,material,cap);m.instanceMatrix.setUsage(THREE.StaticDrawUsage);m.frustumCulled=true;m.count=0;scene.add(m);return m;};
  v5PropPools={rock:make(V5_GEO.rock,V5_MAT.rock),crate:make(V5_GEO.crate,V5_MAT.wood),barrel:make(V5_GEO.barrel,V5_MAT.rust),tomb:make(V5_GEO.tomb,V5_MAT.stone),trunk:make(V5_GEO.trunk,V5_MAT.wood),branch:make(V5_GEO.branch,V5_MAT.wood),fence:make(V5_GEO.fence,V5_MAT.metal),car:make(V5_GEO.car,V5_MAT.rust),cabin:make(V5_GEO.cabin,V5_MAT.metal)};
}
function v5Inst(name,x,y,z,sx=1,sy=1,sz=1,ry=0,rx=0,rz=0){const m=v5PropPools?.[name];if(!m||m.count>=m.instanceMatrix.count)return;dummy.position.set(x,y,z);dummy.rotation.set(rx,ry,rz);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();m.setMatrixAt(m.count++,dummy.matrix);m.instanceMatrix.needsUpdate=true;}
function v5Solid(x,z,r=1.1){state.walls.push({minX:x-r,maxX:x+r,minZ:z-r,maxZ:z+r,mesh:null,v5:true});}
function v5SidePoint(p,next,side,dist){const dx=next.x-p.x,dz=next.z-p.z,l=Math.hypot(dx,dz)||1;return{x:p.x+(-dz/l)*dist*side,z:p.z+(dx/l)*dist*side,ry:Math.atan2(dx,dz)};}
function v5DeadTree(x,z,s=1,ry=0){v5Inst('trunk',x,1.8*s,z,s,s,s,ry,0,.08);v5Inst('branch',x+.55*s,2.8*s,z,.75*s,.85*s,.75*s,ry,0,1.02);v5Inst('branch',x-.48*s,2.25*s,z,.6*s,.72*s,.6*s,ry,0,-.95);}
function v5Wreck(x,z,ry=0,s=1){v5Inst('car',x,.42*s,z,s,.82*s,s,ry,0,(Math.sin(x+z)*.04));v5Inst('cabin',x,.96*s,z-.2*s,s*.9,s*.9,s*.82,ry);v5Solid(x,z,1.65*s);}
function v5Barricade(x,z,ry=0,s=1){for(let j=-1;j<=1;j++)v5Inst('fence',x+Math.cos(ry)*j*1.8*s,.55,z-Math.sin(ry)*j*1.8*s,s,1,s,ry,0,(j*.06));v5Inst('barrel',x+Math.cos(ry)*2.4*s,.67,z-Math.sin(ry)*2.4*s,s,s,s,ry);v5Solid(x,z,1.45*s);}
function v5RuinedArch(x,z,ry,accent){
  const g=new THREE.Group(),stone=mat(0x4d4a45,0,0,.96,.02);for(const sx of [-1,1]){const p=new THREE.Mesh(new THREE.BoxGeometry(1.05,5.2,1.05),stone);p.position.set(sx*2.25,2.6,0);p.rotation.z=sx*.035;g.add(p);}const top=new THREE.Mesh(new THREE.BoxGeometry(5.6,.85,1.15),stone);top.position.y=5.15;top.rotation.z=.035;g.add(top);const seal=new THREE.Mesh(new THREE.TorusGeometry(1.05,.08,7,20),mat(accent,accent,.7,.45,.08));seal.position.set(0,3.15,-.62);g.add(seal);g.position.set(x,0,z);g.rotation.y=ry;scene.add(g);
}
function v5Checkpoint(stage,p,next,i){
  const side=i%2?1:-1,a=v5SidePoint(p,next,side,5.4),b=v5SidePoint(p,next,-side,6.4);
  if(i%3===0){v5Barricade(a.x,a.z,a.ry+(side>0?.42:-.42),.78);v5Inst('crate',b.x,.62,b.z,1,1,1,b.ry);v5Inst('barrel',b.x+1.1,.68,b.z+.4,1,1,1,b.ry);v5Solid(b.x,b.z,1.05);}
  else if(i%3===1){v5Wreck(a.x,a.z,a.ry+.35,.88);v5Inst('crate',b.x,.62,b.z,.9,.9,.9,b.ry);}
  else {for(let k=0;k<3;k++){v5Inst('rock',a.x+(k-1)*1.3,.55,a.z+(k%2)*.7,.9+k*.18,.65+k*.1,1.0,a.ry+k*.5);v5Solid(a.x+(k-1)*1.3,a.z+(k%2)*.7,.75);}}
  if(i%5===0)v5RuinedArch(p.x,p.z,p.ry||Math.atan2(next.x-p.x,next.z-p.z),stage.accent);
}
function v5Scenery(stage,rand){
  v5BuildRoute();v5Road(stage);v5Pools(liteMobile?120:180);const m=state.maze;
  scene.fog=new THREE.FogExp2(stage.fog,liteMobile?.0033:.00265);
  const hemi=new THREE.HemisphereLight(stage.key==='castle'?0x8e6ba8:stage.key==='sea'?0x789bb0:0x9aa6a4,0x11100f,.28);scene.add(hemi);
  const moon=new THREE.DirectionalLight(stage.key==='mansion'?0xa6b2c8:0xb7c9d4,.36);moon.position.set(-18,36,12);scene.add(moon);
  const stride=liteMobile?3:2;
  for(let i=1;i<v5Route.length-2;i+=stride){const p=v5Route[i],n=v5Route[Math.min(i+1,v5Route.length-1)];for(const side of [-1,1]){const d=7.2+rand()*9.5,a=v5SidePoint(p,n,side,d);const r=rand();if(stage.key==='city'){if(r<.38)v5Wreck(a.x,a.z,a.ry+(rand()-.5)*.6,.72+rand()*.3);else if(r<.72)v5Barricade(a.x,a.z,a.ry,.65+rand()*.25);else{v5Inst('crate',a.x,.62,a.z,1,1,1,a.ry);v5Inst('barrel',a.x+1.1,.68,a.z+.5,1,1,1,a.ry);v5Solid(a.x,a.z,.9);}}
      else if(stage.key==='sea'){if(r<.42)v5Barricade(a.x,a.z,a.ry,.62+rand()*.3);else if(r<.7){v5Inst('crate',a.x,.62,a.z,1.1,1,1.2,a.ry);v5Solid(a.x,a.z,.9);}else v5Wreck(a.x,a.z,a.ry,.65);}
      else if(stage.key==='mansion'||stage.key==='castle'){if(r<.38){v5Inst('tomb',a.x,.7,a.z,1,1+rand()*.5,1,a.ry);v5Solid(a.x,a.z,.55);}else if(r<.7)v5DeadTree(a.x,a.z,.8+rand()*.65,a.ry);else{v5Inst('rock',a.x,.6,a.z,1+rand(),.7+rand()*.5,1,a.ry);v5Solid(a.x,a.z,.7);}}
      else {if(r<.48)v5DeadTree(a.x,a.z,.8+rand()*.7,a.ry);else{v5Inst('rock',a.x,.6,a.z,.8+rand()*1.3,.6+rand()*.55,.9+rand(),a.ry);v5Solid(a.x,a.z,.7);}}
    }
    if(i%5===0)v5Checkpoint(stage,p,n,i);
  }
  /* Chicanes force lateral movement without closing the route. */
  for(let k=5;k<v5Route.length-5;k+=7){const p=v5Route[k],n=v5Route[k+1],side=(k/7|0)%2?1:-1,a=v5SidePoint(p,n,side,2.9);if(k%2)v5Wreck(a.x,a.z,a.ry+.35,.72);else v5Barricade(a.x,a.z,a.ry+.2,.64);}
  /* Four memorable encounter spaces with cheap emissive practical lights. */
  for(const t of [.20,.42,.64,.82]){const p=v5RouteAt(t),q=v5RouteAt(Math.min(.98,t+.02));v5RuinedArch(p.x,p.z,Math.atan2(q.x-p.x,q.z-p.z),stage.accent);const lamp=new THREE.PointLight(stage.key==='castle'?0xff4a31:0xffc277,liteMobile?.55:.82,liteMobile?13:17,2);lamp.position.set(p.x,3.2,p.z);scene.add(lamp);}
  v5LoadSceneAssets(stage).catch(()=>{});
}

const v5BaseDecorators={mansion:decorateMansion,mountain:decorateMountain,river:decorateRiver,sea:decorateSea,city:decorateCity,castle:decorateCastle};
function v5Decorate(stage,rand){v5BaseDecorators[stage.key](stage,rand);v5Scenery(stage,rand);if(owNote)owNote.textContent=`${stage.jp} / 蛇行探索路・感染体10種`;}
decorateMansion=(stage,rand)=>v5Decorate(stage,rand);decorateMountain=(stage,rand)=>v5Decorate(stage,rand);decorateRiver=(stage,rand)=>v5Decorate(stage,rand);decorateSea=(stage,rand)=>v5Decorate(stage,rand);decorateCity=(stage,rand)=>v5Decorate(stage,rand);decorateCastle=(stage,rand)=>v5Decorate(stage,rand);

function v5TuneEnemy(e,type,d,seed){
  const r=mulberry32(seed);e.type=type;e.runner=false;e.crawler=false;e.v5BaseSpeed=d.zombieSpeed*(.86+r()*.2);e.headScale=.88+r()*.18;e.lean=(r()-.5)*.18;
  if(type==='walker'){e.hp=e.maxHp=2;e.speed=e.v5BaseSpeed;}
  if(type==='runner'){e.runner=true;e.hp=e.maxHp=1;e.v5BaseSpeed=d.runnerSpeed*1.08;e.speed=e.v5BaseSpeed;}
  if(type==='crawler'){e.crawler=true;e.hp=e.maxHp=2;e.v5BaseSpeed=d.zombieSpeed*.88;e.speed=e.v5BaseSpeed;}
  if(type==='hound'){e.runner=true;e.hp=e.maxHp=2;e.v5BaseSpeed=d.runnerSpeed*1.38;e.speed=e.v5BaseSpeed;e.headScale=.72;}
  if(type==='stalker'){e.crawler=true;e.hp=e.maxHp=3;e.v5BaseSpeed=d.runnerSpeed*.98;e.speed=e.v5BaseSpeed;e.headScale=1.08;}
  if(type==='brute'){e.hp=e.maxHp=state.difficulty==='nightmare'?11:8;e.v5BaseSpeed=d.zombieSpeed*.62;e.speed=e.v5BaseSpeed;e.headScale=1.22;}
  if(type==='spitter'){e.hp=e.maxHp=3;e.v5BaseSpeed=d.zombieSpeed*.72;e.speed=e.v5BaseSpeed;e.v5AttackAt=performance.now()+1200+r()*2300;}
  if(type==='leaper'){e.runner=true;e.hp=e.maxHp=2;e.v5BaseSpeed=d.runnerSpeed*1.02;e.speed=e.v5BaseSpeed;e.v5LeapAt=performance.now()+900+r()*2200;e.v5LeapUntil=0;}
  if(type==='armored'){e.hp=e.maxHp=6;e.v5BaseSpeed=d.zombieSpeed*.76;e.speed=e.v5BaseSpeed;e.headScale=.93;}
  if(type==='bloater'){e.hp=e.maxHp=5;e.v5BaseSpeed=d.zombieSpeed*.66;e.speed=e.v5BaseSpeed;e.headScale=1.05;}
  e.hp=e.maxHp=BlacksiteRules.health(type,state.difficulty);
}
function v5RepositionEnemies(){
  if(!v5Route.length)return;const d=difficulty(),arr=[...state.enemies.values()].filter(e=>!e.boss).sort((a,b)=>(a.index??0)-(b.index??0));
  arr.forEach((e,i)=>{const forced=i<V5_TYPES.length?i:Math.floor(mulberry32(hashCode(e.id)^state.seed^0x51aa)()*V5_TYPES.length),type=V5_TYPES[forced],rand=mulberry32(hashCode(e.id)^state.seed^0x992d);v5TuneEnemy(e,type,d,hashCode(e.id)^state.seed);const t=.06+(i/Math.max(1,arr.length-1))*.76,p=v5RouteAt(clamp(t+(rand()-.5)*.035,.04,.86)),q=v5RouteAt(clamp(t+.02,.05,.88)),side=rand()<.5?-1:1,off=2.0+rand()*6.0,a=v5SidePoint(p,q,side,off);e.x=a.x;e.z=a.z;});
}

const v5BaseMakeHorde=makeHorde;
makeHorde=function(capacity){
  v5BaseMakeHorde(capacity);const make=(geo,material)=>{const m=new THREE.InstancedMesh(geo,material,capacity);m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);m.frustumCulled=false;m.count=capacity;scene.add(m);return m;};
  horde.v5Armor=make(V5_GEO.armor,V5_MAT.armor);horde.v5Sac=make(V5_GEO.sac,V5_MAT.sac);horde.v5Spike=make(V5_GEO.spike,V5_MAT.spike);
};
function v5HideExtras(i){for(const k of ['v5Armor','v5Sac','v5Spike'])if(horde?.[k])hideInst(horde[k],i);}
function v5TintEnemies(){
  if(!horde)return;for(const e of state.enemies.values()){if(e.boss||e.index<0||e.index>=horde.capacity)continue;const c=new THREE.Color(V5_COLORS[e.type]||V5_COLORS.walker);for(const p of ['body','head','lArm','rArm','lLeg','rLeg'])horde[p]?.setColorAt?.(e.index,c);}
  for(const p of ['body','head','lArm','rArm','lLeg','rLeg'])if(horde[p]?.instanceColor)horde[p].instanceColor.needsUpdate=true;
}
const v5BaseVisuals=updateHordeVisuals;
updateHordeVisuals=function(now){
  v5BaseVisuals(now);if(!horde)return;const t=now*.001;
  for(const e of state.enemies.values()){if(e.boss||e.index<0||e.index>=horde.capacity)continue;const i=e.index;v5HideExtras(i);if(e.dead)continue;const g=Math.sin(t*(6+e.speed)+e.phase),type=e.type||'walker';
    if(type==='hound'){setInst(horde.body,i,e,0,.56,0,1.38,0,0,1.42,.58,1.65);setInst(horde.head,i,e,0,.70,-.83,.60,0,0,.78,.72,.92);setInst(horde.bone,i,e,0,.56,.92,-1.25,0,0,.48,1.85,.48);}
    else if(type==='stalker'){setInst(horde.body,i,e,0,.66,0,1.10,0,g*.05,1.38,.62,1.48);setInst(horde.head,i,e,0,.82,-.75,.72,0,g*.05,1.12,1.02,1.12);setInst(horde.v5Spike,i,e,0,1.22,.18,-1.25,0,0,1,1.7,1);}
    else if(type==='brute'){setInst(horde.body,i,e,0,1.48,0,.12,0,g*.025,1.9,1.62,1.58);setInst(horde.head,i,e,0,2.54,-.12,.08,0,0,1.28,1.2,1.25);setInst(horde.v5Armor,i,e,0,1.62,-.28,.08,0,0,1.55,1.2,1);}
    else if(type==='spitter'){setInst(horde.body,i,e,0,1.32,0,.38,0,g*.02,1.05,1.05,1);setInst(horde.v5Sac,i,e,0,1.68,.35,.2,0,0,1.15,1.35,1.0);setInst(horde.mouth,i,e,0,1.88,-.38,.25,0,0,1.3,1.2,1.15);}
    else if(type==='leaper'){setInst(horde.body,i,e,0,.98,0,.9,0,g*.04,1.02,.82,1.15);setInst(horde.lArm,i,e,-.52,.86,-.42,-.82+g*.5,0,-.18,1,1.48,1);setInst(horde.rArm,i,e,.52,.86,-.42,-.82-g*.5,0,.18,1,1.48,1);setInst(horde.lLeg,i,e,-.27,.34,.34,.82-g*.45,0,0,1,1.45,1);setInst(horde.rLeg,i,e,.27,.34,.34,.82+g*.45,0,0,1,1.45,1);}
    else if(type==='armored'){setInst(horde.v5Armor,i,e,0,1.55,-.25,.24,0,0,1.28,1.35,1.15);setInst(horde.v5Armor,i,e,0,2.16,-.18,.15,0,0,.78,.62,.72);}
    else if(type==='bloater'){setInst(horde.body,i,e,0,1.38,0,.12,0,g*.018,1.58,1.46,1.46);setInst(horde.v5Sac,i,e,0,1.28,-.23,.12,0,0,1.58,1.52,1.4);setInst(horde.head,i,e,0,2.43,-.08,.08,0,g*.02,1.06,1.02,1.08);}
    else if(type==='runner'){setInst(horde.body,i,e,0,1.25,0,.54,0,g*.035,.92,1.06,.9);}
    else if(type==='crawler'){setInst(horde.v5Spike,i,e,0,.98,.18,-1.25,0,0,.75,1.25,.75);}
  }
  for(const k of ['v5Armor','v5Sac','v5Spike'])if(horde[k]?.instanceMatrix)horde[k].instanceMatrix.needsUpdate=true;
};

const v5BaseSpawn=spawnHostWorld;
spawnHostWorld=function(arenaZ){const r=v5BaseSpawn(arenaZ);v5RepositionEnemies();v5TintEnemies();updateHordeVisuals(performance.now());return r;};
const v5BaseSync=syncWorld;
syncWorld=function(m){const r=v5BaseSync(m);v5TintEnemies();return r;};

const v5BaseHostStep=hostWorldStep;
hostWorldStep=function(dt,now){
  for(const e of state.enemies.values())if(!e.boss&&!e.dead){
    if(e.type==='leaper'){if(now>(e.v5LeapAt||0)){e.v5LeapAt=now+3000+Math.random()*1800;e.v5LeapUntil=now+520;}e.speed=(e.v5BaseSpeed||e.speed)*(now<(e.v5LeapUntil||0)?2.35:1);}
    else if(e.v5BaseSpeed)e.speed=e.v5BaseSpeed;
  }
  v5BaseHostStep(dt,now);
  if(!isHost()||!state.running)return;
  for(const e of state.enemies.values())if(!e.boss&&!e.dead&&e.type==='spitter'&&now>(e.v5AttackAt||0)){
    const n=nearestLivingPlayer(e);if(n&&n.d>4.2&&n.d<15.5){e.v5AttackAt=now+3300+Math.random()*1700;const orb=new THREE.Mesh(new THREE.SphereGeometry(.12,6,5),mat(0x8dff58,0x50dd28,1.8,.2));orb.position.set(e.x,1.55,e.z);scene.add(orb);const target=new THREE.Vector3(n.p.x,1.15,n.p.z),start=orb.position.clone(),born=now;state.stageVisuals.push({type:'v5Acid',mesh:orb,start,target,born,life:430});setTimeout(()=>{if(state.running&&(state.players.get(n.p.id)?.lives??0)>0)damagePlayer(n.p.id,'ACID SPIT');},390);}else e.v5AttackAt=now+900;
  }
};
const v5BaseStage=updateStageVisuals;
updateStageVisuals=function(now){v5BaseStage(now);const next=[];for(const v of state.stageVisuals){if(v.type==='v5Acid'){const p=(now-v.born)/v.life;if(p<1){v.mesh.position.lerpVectors(v.start,v.target,p);v.mesh.position.y+=Math.sin(p*Math.PI)*1.7;next.push(v);}else scene.remove(v.mesh);}else next.push(v);}state.stageVisuals=next;};

const v5BaseHostHit=hostHit;
hostHit=function(id,playerId,weak=false){const e=state.enemies.get(id);const wasAlive=!!e&&!e.dead;v5BaseHostHit(id,playerId,weak);if(wasAlive&&e?.dead&&e.type==='bloater'){const ring=new THREE.Mesh(new THREE.RingGeometry(.4,.72,24),new THREE.MeshBasicMaterial({color:0x9ed35b,transparent:true,opacity:.65,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.set(e.x,.16,e.z);scene.add(ring);state.stageVisuals.push({type:'shockwave',mesh:ring,born:performance.now(),life:650,max:5.5});for(const p of state.players.values())if((p.lives??0)>0&&Math.hypot(p.x-e.x,p.z-e.z)<4.1)damagePlayer(p.id,'BLOATER BURST');}};

/* Tiny OBJ loader for original local models. Failure never blocks gameplay. */
const v5ObjCache=new Map();
function v5ParseObj(text){const vs=[],out=[];for(const raw of text.split(/\r?\n/)){const line=raw.trim();if(line.startsWith('v ')){const a=line.split(/\s+/);vs.push([+a[1],+a[2],+a[3]]);}else if(line.startsWith('f ')){const f=line.slice(2).trim().split(/\s+/).map(s=>parseInt(s,10)-1);for(let i=1;i<f.length-1;i++)for(const ix of [f[0],f[i],f[i+1]])out.push(...vs[ix]);}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(out,3));g.computeVertexNormals();g.computeBoundingSphere();return g;}
async function v5Obj(path){if(v5ObjCache.has(path))return v5ObjCache.get(path);const r=await fetch(path,{cache:'force-cache'});if(!r.ok)throw new Error(`asset ${r.status}`);const g=v5ParseObj(await r.text());v5ObjCache.set(path,g);return g;}
async function v5LoadSceneAssets(stage){const token=++v5AssetToken,pts=[v5RouteAt(.28),v5RouteAt(.55),v5RouteAt(.75)];try{const [gate,shrine]=await Promise.all([v5Obj('assets/game23/quarantine-gate.obj?v=1'),v5Obj('assets/game23/ruined-shrine.obj?v=1')]);if(token!==v5AssetToken||!state.maze)return;pts.forEach((p,i)=>{const q=v5RouteAt(Math.min(.98,[.30,.57,.77][i])),mesh=new THREE.Mesh(i===1?shrine:gate,i===1?V5_MAT.stone:V5_MAT.rust);mesh.position.set(p.x,0,p.z);mesh.rotation.y=Math.atan2(q.x-p.x,q.z-p.z);mesh.scale.setScalar(i===1?1.25:.95);scene.add(mesh);});}catch{}}

const miniLegendV5=document.querySelector('.minimap-panel small');if(miniLegendV5)miniLegendV5.innerHTML='白=自分 / 黄=相方 / 緑=GOAL<br>感染体10種 + 巨大ボス / 障害物は遮蔽に利用可能';
const v5OverlayText=document.querySelector('#overlay-text');if(v5OverlayText)v5OverlayText.textContent='蛇行する探索路、廃車・倒木・墓石・検疫バリケード。特性の異なる感染体10種を突破し、各区域の巨大ボスを倒せ。';
