/* GAME 23 ULTIMATE — cinematic scenery, power drops and special infected */
const EXP_POWER_DURATION=30000;
const EXP_DROP_EVERY=20;
const EXP_LAUNCHER_SHOTS=10;
const EXP_LAUNCHER_RADIUS=9.5;
const EXP_LAUNCHER_DAMAGE=3;
let expansionKillCount=0,expansionDropSeq=0;
let expansionInfiniteUntil=0,expansionInvincibleUntil=0,expansionLauncherUntil=0,expansionLauncherShots=0,expansionLauncherNextShot=0;
let expansionSkyTexture=null;

const expansionStyle=document.createElement('style');
expansionStyle.textContent=`
.ux-power-panel{position:absolute;z-index:30;left:14px;bottom:56px;min-width:190px;max-width:42vw;padding:9px 11px;border:1px solid rgba(255,255,255,.16);border-radius:13px;background:rgba(4,8,10,.76);backdrop-filter:blur(8px);box-shadow:0 10px 30px rgba(0,0,0,.32);pointer-events:none}.ux-power-panel strong{display:block;color:#fff;font-size:.72rem;letter-spacing:.08em}.ux-power-panel span{display:block;margin-top:3px;color:#9fb2ab;font-size:.58rem;line-height:1.35}.ux-power-panel b{color:#6effa9}.ux-power-panel.hot{border-color:rgba(255,181,72,.55);box-shadow:0 0 26px rgba(255,130,45,.16),0 10px 30px rgba(0,0,0,.32)}
.game23-frame.exp-invincible{box-shadow:inset 0 0 52px rgba(80,215,255,.32)!important}.game23-frame.exp-launcher{box-shadow:inset 0 0 58px rgba(255,121,39,.23)!important}.game23-frame.exp-infinite{box-shadow:inset 0 0 48px rgba(255,222,75,.20)!important}
.item-legend{grid-template-columns:repeat(4,1fr)!important}.item-dot.life{background:#ff4f70;color:#ff4f70}.item-dot.infinite{background:#ffd84b;color:#ffd84b}.item-dot.invincible{background:#52dbff;color:#52dbff}.item-dot.launcher{background:#ff8739;color:#ff8739}
.exp-drop-label{font-family:system-ui,sans-serif;font-weight:1000}
@media(max-width:820px){.item-legend{grid-template-columns:1fr 1fr!important}.ux-power-panel{left:8px;bottom:8px;min-width:160px;max-width:44vw;padding:7px 9px}.ux-power-panel strong{font-size:.64rem}.ux-power-panel span{font-size:.53rem}}
@media(pointer:coarse){body.game23-focus-mode .ux-power-panel,.outbreak-shell:fullscreen .ux-power-panel{left:max(10px,calc(env(safe-area-inset-left) + 8px));bottom:max(8px,calc(env(safe-area-inset-bottom) + 6px));max-width:35vw}}
`;
document.head.appendChild(expansionStyle);

const expansionPowerPanel=document.createElement('div');
expansionPowerPanel.className='ux-power-panel';
expansionPowerPanel.innerHTML='<strong>DROP 0 / 20</strong><span>20体撃破ごとに強化アイテム</span>';
frame.appendChild(expansionPowerPanel);
const expansionLegend=document.querySelector('.item-legend');
if(expansionLegend)expansionLegend.innerHTML=`<div><b class="item-dot life"></b><strong>LIFE UP</strong><span>ライフ+1</span></div><div><b class="item-dot infinite"></b><strong>∞ AMMO</strong><span>30秒 弾数無限</span></div><div><b class="item-dot invincible"></b><strong>INVINCIBLE</strong><span>30秒 完全無敵</span></div><div><b class="item-dot launcher"></b><strong>LAUNCHER</strong><span>30秒 / 10発 / 広範囲×3</span></div>`;

const EXP_ITEMS={
  life:{label:'LIFE UP',short:'LIFE +1',color:0xff4f70,glyph:'♥'},
  infinite:{label:'INFINITE AMMO',short:'∞ AMMO 30s',color:0xffd84b,glyph:'∞'},
  invincible:{label:'INVINCIBLE',short:'INVINCIBLE 30s',color:0x52dbff,glyph:'◆'},
  launcher:{label:'LAUNCHER',short:'LAUNCHER 10',color:0xff8739,glyph:'RPG'}
};

function expansionTextSprite(text,color){
  const c=document.createElement('canvas');c.width=256;c.height=96;const x=c.getContext('2d');
  x.clearRect(0,0,c.width,c.height);x.fillStyle='rgba(0,0,0,.58)';x.roundRect?.(8,12,240,68,20);if(x.roundRect)x.fill();else{x.fillRect(8,12,240,68);}
  x.strokeStyle=`#${color.toString(16).padStart(6,'0')}`;x.lineWidth=4;x.strokeRect(10,14,236,64);
  x.fillStyle='#fff';x.font='900 27px system-ui,sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(text,128,47);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthWrite:false}));s.scale.set(2.8,1.05,1);s.position.y=1.72;return s;
}
function expansionItemMesh(type,x,z){
  const info=EXP_ITEMS[type]||EXP_ITEMS.life,g=new THREE.Group();
  const base=new THREE.Mesh(new THREE.CylinderGeometry(.56,.68,.20,16),mat(0x161d20,0,0,.3,.35));base.position.y=.10;g.add(base);
  const ring1=new THREE.Mesh(new THREE.TorusGeometry(.62,.06,9,28),mat(info.color,info.color,2.2,.18,.12));ring1.rotation.x=Math.PI/2;ring1.position.y=.55;g.add(ring1);
  const ring2=new THREE.Mesh(new THREE.TorusGeometry(.42,.045,8,24),mat(0xffffff,info.color,1.4,.18,.08));ring2.rotation.y=Math.PI/2;ring2.position.y=.72;g.add(ring2);
  const coreGeo=type==='launcher'?new THREE.BoxGeometry(.52,.42,.84):type==='life'?new THREE.OctahedronGeometry(.42):new THREE.IcosahedronGeometry(.40,0);
  const core=new THREE.Mesh(coreGeo,mat(info.color,info.color,3.4,.15,.08));core.position.y=.78;g.add(core);
  g.add(expansionTextSprite(info.label,info.color));g.position.set(x,.02,z);scene.add(g);return g;
}
createSyncedItem=function(a){const[id,type,x,z,taken]=a,g=expansionItemMesh(type,x,z),item={id,type,x,z,taken:!!taken,mesh:g};g.visible=!taken;state.items.set(id,item);return item;};
spawnItems=function(){};

function expansionMakeSkyTexture(stage){
  if(expansionSkyTexture){try{expansionSkyTexture.dispose();}catch{}}
  const c=document.createElement('canvas');c.width=1536;c.height=768;const x=c.getContext('2d');
  const palettes={
    mansion:['#07040a','#301024','#a52b45','#ef876d'],
    mountain:['#06101d','#173a58','#6b9fc1','#d9e7ee'],
    river:['#071820','#1c5966','#76a99a','#e6b47d'],
    sea:['#030b16','#12324f','#3e6681','#e4a063'],
    city:['#070817','#14193c','#542766','#ff6d54'],
    castle:['#050008','#1a0623','#5b1038','#b42d43']
  };
  const p=palettes[stage.key]||palettes.mansion,g=x.createLinearGradient(0,0,0,c.height);g.addColorStop(0,p[0]);g.addColorStop(.45,p[1]);g.addColorStop(.78,p[2]);g.addColorStop(1,p[3]);x.fillStyle=g;x.fillRect(0,0,c.width,c.height);
  const rand=mulberry32(hashCode(stage.key)^state.seed^0x5a71f00d);
  const night=['mansion','mountain','city','castle'].includes(stage.key);if(night){x.fillStyle='rgba(255,255,255,.9)';for(let i=0;i<240;i++){const px=rand()*c.width,py=rand()*c.height*.58,r=.45+rand()*1.45;x.globalAlpha=.24+rand()*.72;x.beginPath();x.arc(px,py,r,0,Math.PI*2);x.fill();}x.globalAlpha=1;}
  for(let i=0;i<26;i++){const px=rand()*c.width,py=70+rand()*350,w=110+rand()*330,h=18+rand()*64;x.globalAlpha=.025+rand()*.07;x.fillStyle=stage.key==='castle'?'#ee668e':stage.key==='sea'?'#c3d3e0':'#ffffff';x.beginPath();x.ellipse(px,py,w,h,rand()*.18,0,Math.PI*2);x.fill();}
  x.globalAlpha=1;
  const celestial=stage.key==='river'?{x:.78,y:.25,r:66,c:'#ffe4a8',glow:'rgba(255,190,105,.22)'}:stage.key==='sea'?{x:.72,y:.31,r:54,c:'#ffd3a0',glow:'rgba(255,150,82,.18)'}:stage.key==='castle'?{x:.20,y:.22,r:86,c:'#c62b48',glow:'rgba(255,38,76,.28)'}:stage.key==='mansion'?{x:.20,y:.20,r:72,c:'#ffe0e5',glow:'rgba(255,95,118,.22)'}:stage.key==='mountain'?{x:.78,y:.18,r:62,c:'#eaf7ff',glow:'rgba(120,200,255,.18)'}:{x:.76,y:.18,r:42,c:'#f2eaff',glow:'rgba(172,104,255,.18)'};
  const cg=x.createRadialGradient(c.width*celestial.x,c.height*celestial.y,0,c.width*celestial.x,c.height*celestial.y,celestial.r*3);cg.addColorStop(0,celestial.glow);cg.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=cg;x.beginPath();x.arc(c.width*celestial.x,c.height*celestial.y,celestial.r*3,0,Math.PI*2);x.fill();x.fillStyle=celestial.c;x.beginPath();x.arc(c.width*celestial.x,c.height*celestial.y,celestial.r,0,Math.PI*2);x.fill();
  const haze=x.createLinearGradient(0,c.height*.68,0,c.height);haze.addColorStop(0,'rgba(255,255,255,0)');haze.addColorStop(1,stage.key==='castle'?'rgba(255,50,80,.16)':'rgba(220,240,255,.12)');x.fillStyle=haze;x.fillRect(0,c.height*.64,c.width,c.height*.36);
  expansionSkyTexture=new THREE.CanvasTexture(c);expansionSkyTexture.colorSpace=THREE.SRGBColorSpace;expansionSkyTexture.magFilter=THREE.LinearFilter;return expansionSkyTexture;
}
function expansionParticles(kind,rand){
  const count=kind==='snow'?190:kind==='embers'?130:85,pos=new Float32Array(count*3),m=state.maze,width=m.cols*m.cell;
  for(let i=0;i<count;i++){pos[i*3]=(rand()-.5)*(width+45);pos[i*3+1]=1+rand()*24;pos[i*3+2]=m.z0-rand()*m.rows*m.cell;}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));const color=kind==='snow'?0xe8f7ff:kind==='embers'?0xff7a2b:0xdbefff;const pts=new THREE.Points(geo,new THREE.PointsMaterial({color,size:kind==='embers'?.13:.11,transparent:true,opacity:kind==='mist'?.25:.72,depthWrite:false}));scene.add(pts);state.stageVisuals.push({type:`exp_${kind}`,mesh:pts,speed:kind==='snow'?1.4:kind==='embers'?1.0:.18,top:26,bottom:.2,z0:m.z0,len:m.rows*m.cell});
}
function expansionFarScenery(stage,rand){
  const m=state.maze,half=m.cols*m.cell/2,mid=m.z0-m.rows*m.cell/2;
  scene.background=expansionMakeSkyTexture(stage);renderer.toneMappingExposure=stage.key==='castle'?1.28:stage.key==='city'?1.25:1.18;
  const fill=new THREE.HemisphereLight(stage.key==='castle'?0xdca7ff:stage.key==='sea'?0x99d8ff:0xddeeff,stage.key==='mansion'?0x18060b:0x0d1214,.35);scene.add(fill);
  if(stage.key==='mansion'){
    for(const side of [-1,1])for(let i=0;i<8;i++){const x=side*(half+10+rand()*20),z=m.z0-10-rand()*m.rows*m.cell,h=7+rand()*13;addBox(x,h/2,z,4+rand()*4,h,4+rand()*4,0x130d14,false);const roof=new THREE.Mesh(new THREE.ConeGeometry(3+rand()*2,5+rand()*4,5),mat(0x1f111a));roof.position.set(x,h+2,z);scene.add(roof);if(i%2===0)addGlow(x,h*.7,z,0x8f1831,.18,18);}
  }else if(stage.key==='mountain'){
    for(let layer=0;layer<2;layer++)for(let i=0;i<20;i++){const side=i%2?-1:1,x=side*(half+18+layer*18+rand()*34),z=m.z0-rand()*m.rows*m.cell,h=18+layer*9+rand()*32;const peak=new THREE.Mesh(new THREE.ConeGeometry(10+rand()*13,h,7),mat(layer?0x172632:0x29414f));peak.position.set(x,h*.43,z);peak.rotation.y=rand()*Math.PI;scene.add(peak);const cap=new THREE.Mesh(new THREE.ConeGeometry(4+rand()*5,h*.23,7),mat(0xd7e7ed));cap.position.set(x,h*.82,z);cap.rotation.y=peak.rotation.y;scene.add(cap);}expansionParticles('snow',rand);
  }else if(stage.key==='river'){
    for(const side of [-1,1])for(let i=0;i<14;i++){const x=side*(half+12+rand()*14),z=m.z0-rand()*m.rows*m.cell,h=9+rand()*18;const cliff=new THREE.Mesh(new THREE.DodecahedronGeometry(5+rand()*5,0),mat(0x334b43));cliff.scale.set(1,1.6+rand(),1);cliff.position.set(x,h*.3,z);scene.add(cliff);}for(let i=0;i<4;i++){const z=m.z0-(i+1)*m.rows*m.cell/5,side=i%2?-1:1,x=side*(half+10);const fall=addBox(x,5,z,.18,9,3.8,0xa4edff,false,0x4fbfd7,.15,.02,.28);fall.material.transparent=true;}expansionParticles('mist',rand);
  }else if(stage.key==='sea'){
    for(let i=0;i<14;i++){const side=i%2?-1:1,x=side*(half+30+rand()*45),z=m.z0-rand()*m.rows*m.cell;const island=new THREE.Mesh(new THREE.ConeGeometry(4+rand()*9,4+rand()*8,8),mat(0x1a3039));island.position.set(x,1.2,z);scene.add(island);}for(let i=0;i<7;i++){const side=i%2?-1:1,x=side*(half+20+rand()*24),z=m.z0-18-rand()*m.rows*m.cell;addBox(x,.7,z,4+rand()*4,.5,9+rand()*7,0x23333b,false);addBox(x,2.2,z,.25,3.3,.25,0xb9c7cc,false);}expansionParticles('mist',rand);
  }else if(stage.key==='city'){
    for(let i=0;i<34;i++){const side=i%2?-1:1,x=side*(half+16+rand()*38),z=m.z0-rand()*m.rows*m.cell,h=18+rand()*52,w=5+rand()*11;addBox(x,h/2,z,w,h,w*.8,0x0b1020,false);if(i%3===0){const cap=addBox(x,h+.2,z,w*.72,.22,w*.72,[0xff2d7b,0x27d9ff,0xff9b35][i%3],false,[0xff2d7b,0x27d9ff,0xff9b35][i%3],.2,.05,.8);cap.material.transparent=true;}}for(let i=0;i<20;i++){const x=(rand()-.5)*(half*1.7),z=mid+(rand()-.5)*m.rows*m.cell*.7;addGlow(x,6+rand()*8,z,[0xff2d7b,0x27d9ff,0xff9b35][i%3],.16,18);}
  }else{
    for(const side of [-1,1])for(let i=0;i<11;i++){const x=side*(half+10+rand()*25),z=m.z0-rand()*m.rows*m.cell,h=12+rand()*28;addBox(x,h/2,z,5+rand()*6,h,5+rand()*6,0x170b1e,false,0x3b0e48,.75,.1);const spire=new THREE.Mesh(new THREE.ConeGeometry(2.4+rand()*2.8,8+rand()*12,7),mat(0x24102c,stage.accent,.24));spire.position.set(x,h+4,z);scene.add(spire);}for(let i=0;i<18;i++){const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(1+rand()*2.5,0),mat(0x27152e));rock.position.set((rand()-.5)*(half*2.8),5+rand()*18,m.z0-rand()*m.rows*m.cell);scene.add(rock);}expansionParticles('embers',rand);
  }
}
const expansionMansion=decorateMansion,expansionMountain=decorateMountain,expansionRiver=decorateRiver,expansionSea=decorateSea,expansionCity=decorateCity,expansionCastle=decorateCastle;
decorateMansion=function(stage,rand){expansionMansion(stage,rand);expansionFarScenery(stage,rand);};
decorateMountain=function(stage,rand){expansionMountain(stage,rand);expansionFarScenery(stage,rand);};
decorateRiver=function(stage,rand){expansionRiver(stage,rand);expansionFarScenery(stage,rand);};
decorateSea=function(stage,rand){expansionSea(stage,rand);expansionFarScenery(stage,rand);};
decorateCity=function(stage,rand){expansionCity(stage,rand);expansionFarScenery(stage,rand);};
decorateCastle=function(stage,rand){expansionCastle(stage,rand);expansionFarScenery(stage,rand);};

const expansionBaseStageVisuals=updateStageVisuals;
updateStageVisuals=function(now){
  expansionBaseStageVisuals(now);const next=[];
  for(const v of state.stageVisuals){
    if(v.type==='expBlast'){
      const p=(now-v.born)/v.life;if(p<1){const s=.5+p*v.max;v.mesh.scale.setScalar(s);v.mesh.material.opacity=.52*(1-p);next.push(v);}else scene.remove(v.mesh);
    }else if(v.type==='exp_snow'||v.type==='exp_embers'||v.type==='exp_mist'){
      const a=v.mesh.geometry.attributes.position,arr=a.array,dt=.016;
      for(let i=0;i<arr.length;i+=3){if(v.type==='exp_snow'){arr[i+1]-=v.speed*dt;arr[i]+=.08*Math.sin(now*.001+i);if(arr[i+1]<v.bottom)arr[i+1]=v.top;}else if(v.type==='exp_embers'){arr[i+1]+=v.speed*dt;arr[i]+=.06*Math.sin(now*.0014+i);if(arr[i+1]>v.top)arr[i+1]=v.bottom;}else{arr[i]+=.03*Math.sin(now*.0007+i);}}
      a.needsUpdate=true;next.push(v);
    }else next.push(v);
  }
  state.stageVisuals=next;
};

function expansionPowerReset(){expansionInfiniteUntil=0;expansionInvincibleUntil=0;expansionLauncherUntil=0;expansionLauncherShots=0;expansionLauncherNextShot=0;frame.classList.remove('exp-infinite','exp-invincible','exp-launcher');}
function expansionApplyLocalPower(type,duration=EXP_POWER_DURATION,shots=EXP_LAUNCHER_SHOTS,lives=null){
  const now=performance.now();if(type==='life'){if(lives!=null){state.localLives=lives;const p=state.players.get(state.playerId)||{id:state.playerId};p.lives=lives;state.players.set(state.playerId,p);}toast('LIFE UP +1',1100);updateHud();}
  if(type==='infinite'){expansionInfiniteUntil=Math.max(expansionInfiniteUntil,now+duration);toast('∞ AMMO — 30 SEC',1300);}
  if(type==='invincible'){expansionInvincibleUntil=Math.max(expansionInvincibleUntil,now+duration);toast('INVINCIBLE — 30 SEC',1300);}
  if(type==='launcher'){expansionLauncherUntil=now+duration;expansionLauncherShots=shots;expansionLauncherNextShot=0;toast('LAUNCHER — 10 SHOTS / 30 SEC',1500);}
}
function expansionSpawnDrop(e){
  const types=['life','infinite','invincible','launcher'],type=types[(Math.floor(expansionKillCount/EXP_DROP_EVERY)-1)%types.length],id=`drop${expansionKillCount}_${expansionDropSeq++}`,x=e.x,z=e.z,mesh=expansionItemMesh(type,x,z);state.items.set(id,{id,type,x,z,taken:false,mesh});toast(`${EXP_ITEMS[type].label} DROPPED!`,1250);sendWorld(true);
}
function expansionRegisterKill(e){
  if(!e||e.boss||e._expCounted)return;e._expCounted=true;expansionKillCount++;
  if(e.type==='dog')toast('INFECTED HOUND DOWN',360);else if(e.type==='licker')toast('LICKER DOWN',360);else if(e.type==='fat')toast('BRUTE ZOMBIE DOWN',420);
  if(expansionKillCount%EXP_DROP_EVERY===0)expansionSpawnDrop(e);
}
applyItemToPlayer=function(item,p){
  if(item.taken)return;item.taken=true;if(item.mesh)item.mesh.visible=false;const now=performance.now(),type=item.type;
  if(type==='life')p.lives=Math.min(3,(p.lives||0)+1);if(type==='invincible')p.inv=now+EXP_POWER_DURATION;
  if(p.id===state.playerId)expansionApplyLocalPower(type,EXP_POWER_DURATION,EXP_LAUNCHER_SHOTS,p.lives);
  send('power_item',{id:item.id,type,target:p.id,duration:EXP_POWER_DURATION,shots:EXP_LAUNCHER_SHOTS,lives:p.lives,area:state.area});
};

const expansionBaseSpawnHostWorld=spawnHostWorld;
spawnHostWorld=function(arenaZ){
  expansionBaseSpawnHostWorld(arenaZ);const rand=mulberry32(state.seed^0x0d06f00d^(state.area*971));const d=difficulty();
  for(const e of state.enemies.values()){
    if(e.boss)continue;const r=rand();e.type=e.runner?'runner':e.crawler?'crawler':'zombie';
    if(r<.095){e.type='dog';e.runner=true;e.crawler=false;e.hp=e.maxHp=1;e.speed=d.runnerSpeed*1.48;e.headScale=.78;e.lean=.28;}
    else if(r<.165){e.type='licker';e.runner=false;e.crawler=true;e.hp=e.maxHp=3;e.speed=d.runnerSpeed*1.12;e.headScale=1.05;e.lean=.34;}
    else if(r<.265){e.type='fat';e.runner=false;e.crawler=false;e.hp=e.maxHp=state.difficulty==='nightmare'?10:state.difficulty==='easy'?6:8;e.speed=d.zombieSpeed*.68;e.headScale=1.22;e.lean=.04;}
  }
  updateHordeVisuals(performance.now());
};

const expansionBaseHordeVisuals=updateHordeVisuals;
updateHordeVisuals=function(now){
  expansionBaseHordeVisuals(now);if(!horde)return;const t=now*.001;
  for(const e of state.enemies.values()){
    if(e.boss||e.dead||!e.type)continue;const i=e.index;if(i<0||i>=horde.capacity)continue;const gait=Math.sin(t*(8+e.speed)+e.phase);
    if(e.type==='dog'){
      setInst(horde.body,i,e,0,.60,0,1.28,0,0,1.35,.62,1.62);setInst(horde.head,i,e,0,.72,-.78,.55,0,0,.88,.82,1.02);
      setInst(horde.lArm,i,e,-.43,.30,-.48,.2+gait*.8,0,0,1.1,.72,1.1);setInst(horde.rArm,i,e,.43,.30,-.48,.2-gait*.8,0,0,1.1,.72,1.1);setInst(horde.lLeg,i,e,-.38,.28,.50,-.2-gait*.8,0,0,1.05,.72,1.05);setInst(horde.rLeg,i,e,.38,.28,.50,-.2+gait*.8,0,0,1.05,.72,1.05);setInst(horde.eyes,i,e,0,.78,-1.04,.52,0,0,1.15,1.2,1.2);setInst(horde.mouth,i,e,0,.61,-1.07,.52,0,0,1.2,1.35,1.2);hideInst(horde.bone,i);
    }else if(e.type==='licker'){
      setInst(horde.body,i,e,0,.68,0,1.12,0,gait*.04,1.38,.58,1.58);setInst(horde.head,i,e,0,.82,-.72,.74,0,gait*.06,1.18,1.05,1.16);setInst(horde.lArm,i,e,-.56,.32,-.72,-.45+gait*.38,0,-.30,1.12,1.55,1.12);setInst(horde.rArm,i,e,.56,.32,-.72,-.45-gait*.38,0,.30,1.12,1.55,1.12);setInst(horde.lLeg,i,e,-.34,.34,.54,.72-gait*.25,0,0,1.08,1.22,1.08);setInst(horde.rLeg,i,e,.34,.34,.54,.72+gait*.25,0,0,1.08,1.22,1.08);setInst(horde.eyes,i,e,0,.89,-1.02,.72,0,0,1.22,1.35,1.2);setInst(horde.mouth,i,e,0,.66,-1.06,.72,0,0,1.35,1.55,1.35);setInst(horde.bone,i,e,0,.63,-1.55,Math.PI/2,0,0,.55,2.9,.55);
    }else if(e.type==='fat'){
      const bob=Math.abs(gait)*.05;setInst(horde.body,i,e,0,1.43+bob,0,.12,0,gait*.035,1.82,1.55,1.52);setInst(horde.head,i,e,0,2.48+bob,-.14,.08,0,gait*.03,1.28,1.18,1.22);setInst(horde.lArm,i,e,-.82,1.45+bob,-.12,-.78+gait*.25,0,-.18,1.45,1.38,1.45);setInst(horde.rArm,i,e,.82,1.45+bob,-.12,-.78-gait*.25,0,.18,1.45,1.38,1.45);setInst(horde.lLeg,i,e,-.42,.48,0,gait*.28,0,0,1.45,1.08,1.45);setInst(horde.rLeg,i,e,.42,.48,0,-gait*.28,0,0,1.45,1.08,1.45);setInst(horde.eyes,i,e,0,2.52+bob,-.38,.08,0,0,1.25,1.3,1.2);setInst(horde.mouth,i,e,0,2.28+bob,-.40,.08,0,0,1.45,1.45,1.3);hideInst(horde.bone,i);
    }
  }
  for(const m of Object.values(horde))if(m?.instanceMatrix)m.instanceMatrix.needsUpdate=true;
};

const expansionBaseDamagePlayer=damagePlayer;
damagePlayer=function(id,reason='DAMAGE'){const p=state.players.get(id);if(p&&p.inv&&performance.now()<p.inv){if(id===state.playerId)toast('INVINCIBLE',300);return;}expansionBaseDamagePlayer(id,reason);};
const expansionBaseHostHit=hostHit;
hostHit=function(id,playerId,weak=false){const e=state.enemies.get(id),alive=!!e&&!e.dead;expansionBaseHostHit(id,playerId,weak);if(alive&&e?.dead&&!e.boss)expansionRegisterKill(e);};

function expansionBlastVisual(x,z){
  const ring=new THREE.Mesh(new THREE.RingGeometry(.7,1.15,36),new THREE.MeshBasicMaterial({color:0xff9b36,transparent:true,opacity:.72,side:THREE.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;ring.position.set(x,.16,z);scene.add(ring);state.stageVisuals.push({type:'expBlast',mesh:ring,born:performance.now(),life:520,max:9.5});
  const flash=new THREE.PointLight(0xff8b2b,4.4,26);flash.position.set(x,2,z);scene.add(flash);setTimeout(()=>scene.remove(flash),120);
  try{canvas.animate([{filter:'brightness(1)'},{filter:'brightness(1.42)'},{filter:'brightness(1)'}],{duration:130,easing:'ease-out'});}catch{}
}
function expansionKillByBlast(e,playerId){
  if(e.dead)return;const before=e.hp;e.hp=Math.max(0,e.hp-EXP_LAUNCHER_DAMAGE);if(e.hp<=0){e.dead=true;if(e.boss){if(bossMesh)bossMesh.visible=false;removeBossGate();toast(`${currentStage().boss} DESTROYED`,1600);}else expansionRegisterKill(e);}send('enemy',{id:e.id,hp:e.hp,dead:e.dead?1:0,area:state.area});if(e.boss&&before!==e.hp)updateBossHud();
}
function expansionExplosionDamage(x,z,playerId){for(const e of state.enemies.values()){if(e.dead)continue;const d=Math.hypot(e.x-x,e.z-z);if(d<=EXP_LAUNCHER_RADIUS)expansionKillByBlast(e,playerId);}}
function expansionLauncherImpact(){
  raycaster.setFromCamera(new THREE.Vector2(0,0),camera);const targets=[];if(horde)targets.push(horde.body,horde.head,horde.lArm,horde.rArm,horde.lLeg,horde.rLeg);if(bossMesh?.visible)targets.push(bossMesh);for(const w of state.walls)if(w.mesh)targets.push(w.mesh);const hits=raycaster.intersectObjects(targets,true);if(hits.length)return hits[0].point.clone();const dir=new THREE.Vector3();camera.getWorldDirection(dir);return camera.position.clone().add(dir.multiplyScalar(38));
}

const expansionAmmoShoot=shoot;
shoot=function(){
  if(!state.running||state.localLives<=0)return;const now=performance.now();
  if(expansionLauncherUntil>now&&expansionLauncherShots>0){
    if(now<expansionLauncherNextShot)return;expansionLauncherNextShot=now+520;expansionLauncherShots--;uxWeaponKick();const p=expansionLauncherImpact();expansionBlastVisual(p.x,p.z);if(isHost()){expansionExplosionDamage(p.x,p.z,state.playerId);send('launcher_fx',{x:+p.x.toFixed(2),z:+p.z.toFixed(2),shooterId:state.playerId,area:state.area});}else send('launcher',{x:+p.x.toFixed(2),z:+p.z.toFixed(2),playerId:state.playerId,area:state.area});if(expansionLauncherShots<=0){expansionLauncherUntil=0;toast('LAUNCHER EMPTY — RIFLE ONLINE',900);}return;
  }
  if(expansionInfiniteUntil>now){if(uxReloading){clearTimeout(uxReloadTimer);uxReloading=false;}uxWeaponKick();uxBaseShoot();return;}
  expansionAmmoShoot();
};

const expansionBaseApplyWorldEnemy=applyWorldEnemy;
applyWorldEnemy=function(a){expansionBaseApplyWorldEnemy(a);const e=state.enemies.get(a[0]);if(e)e.type=a[16]||e.type||(e.runner?'runner':e.crawler?'crawler':'zombie');};
const expansionBaseSyncWorld=syncWorld;
syncWorld=function(m){expansionBaseSyncWorld(m);if(Number.isFinite(m.kills))expansionKillCount=m.kills;};
sendWorld=function(force=false){if(!isHost()||state.mode!=='coop'||!state.connected||!state.running)return;const now=performance.now();if(!force&&now-state.lastSnapshot<190)return;state.lastSnapshot=now;send('world',{area:state.area,gate:state.bossGate?1:0,kills:expansionKillCount,enemies:[...state.enemies.values()].map(e=>[e.id,e.index??-1,+e.x.toFixed(2),+e.z.toFixed(2),e.hp,e.dead?1:0,e.boss?1:0,e.maxHp,+e.speed.toFixed(2),e.runner?1:0,e.crawler?1:0,e.phase||0,+((e.lean||0).toFixed(2)),+((e.headTilt||0).toFixed(2)),+((e.headScale||1).toFixed(2)),+((e.visualYaw||0).toFixed(2)),e.type||'zombie']),players:[...state.players.values()].map(p=>[p.id,+p.x.toFixed(2),+p.z.toFixed(2),+p.yaw.toFixed(3),p.lives,p.shield?1:0,p.adr||0]),items:[...state.items.values()].map(i=>[i.id,i.type,+i.x.toFixed(2),+i.z.toFixed(2),i.taken?1:0])});};
const expansionBaseOnNetwork=onNetwork;
onNetwork=function(m){
  if(!m||m.from===state.playerId)return;
  if(m.kind==='power_item'){
    if(m.area===state.area){const item=state.items.get(m.id);if(item){item.taken=true;if(item.mesh)item.mesh.visible=false;}}
    if(m.target===state.playerId&&m.area===state.area)expansionApplyLocalPower(m.type,m.duration||EXP_POWER_DURATION,m.shots||EXP_LAUNCHER_SHOTS,m.lives);return;
  }
  if(m.kind==='launcher'&&isHost()&&m.area===state.area){expansionBlastVisual(m.x,m.z);expansionExplosionDamage(m.x,m.z,m.playerId||m.from);send('launcher_fx',{x:m.x,z:m.z,shooterId:m.playerId||m.from,area:state.area});return;}
  if(m.kind==='launcher_fx'&&m.area===state.area){if(m.shooterId!==state.playerId)expansionBlastVisual(m.x,m.z);return;}
  if(m.kind==='start'&&state.role==='guest'){expansionKillCount=0;expansionPowerReset();}
  expansionBaseOnNetwork(m);
};

const expansionBaseBeginArea=beginArea;
beginArea=function(fromStart=true){state.items.clear();return expansionBaseBeginArea(fromStart);};
const expansionBaseResetMission=resetMission;
resetMission=function(){expansionKillCount=0;expansionDropSeq=0;expansionPowerReset();return expansionBaseResetMission();};

function expansionPowerHud(){
  const now=performance.now(),inf=Math.max(0,Math.ceil((expansionInfiniteUntil-now)/1000)),inv=Math.max(0,Math.ceil((expansionInvincibleUntil-now)/1000)),lan=Math.max(0,Math.ceil((expansionLauncherUntil-now)/1000)),toDrop=EXP_DROP_EVERY-(expansionKillCount%EXP_DROP_EVERY||0);let active=[];
  if(inf)active.push(`∞ AMMO ${inf}s`);if(inv)active.push(`INVINCIBLE ${inv}s`);if(lan&&expansionLauncherShots>0)active.push(`LAUNCHER ${expansionLauncherShots}発 / ${lan}s`);
  expansionPowerPanel.innerHTML=`<strong>DROP ${expansionKillCount%EXP_DROP_EVERY} / ${EXP_DROP_EVERY} <b>あと${toDrop}体</b></strong><span>${active.length?active.join('  •  '):'20体撃破ごとに強化アイテム'}</span>`;expansionPowerPanel.classList.toggle('hot',active.length>0);
  frame.classList.toggle('exp-infinite',inf>0);frame.classList.toggle('exp-invincible',inv>0);frame.classList.toggle('exp-launcher',lan>0&&expansionLauncherShots>0);
  const me=state.players.get(state.playerId);if(me&&inv)me.inv=performance.now()+Math.min(250,inv*1000);
  if(lan&&expansionLauncherShots>0){uxAmmoCount.innerHTML=`<b>RPG ${expansionLauncherShots}</b> / 10`;uxReloadBtn.disabled=true;}else if(inf){uxAmmoCount.innerHTML='<b>∞</b> / ∞';uxReloadBtn.disabled=true;}else uxUpdateAmmo();
  if(!inf&&expansionInfiniteUntil&&now>=expansionInfiniteUntil){expansionInfiniteUntil=0;toast('∞ AMMO ENDED',500);}if(!inv&&expansionInvincibleUntil&&now>=expansionInvincibleUntil){expansionInvincibleUntil=0;toast('INVINCIBLE ENDED',500);}if(!lan&&expansionLauncherUntil&&now>=expansionLauncherUntil){expansionLauncherUntil=0;expansionLauncherShots=0;toast('LAUNCHER ENDED',500);}
  const powerText=active.length?active.join(' / '):'NO POWER';itemStatus.textContent=powerText;
}
setInterval(()=>expansionPowerHud(),140);expansionPowerHud();
