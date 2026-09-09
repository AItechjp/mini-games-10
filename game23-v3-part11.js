/* GAME 23 ULTIMATE — performance pass: adaptive resolution, instanced scenery, culling */
const PERF_MOBILE = matchMedia('(pointer:coarse)').matches || Math.min(innerWidth,innerHeight) < 900;
const PERF_VISUAL_RANGE = PERF_MOBILE ? 92 : 118;
const PERF_AI_RANGE = PERF_MOBILE ? 112 : 145;
const PERF_VISUAL_INTERVAL = PERF_MOBILE ? 24 : 16;
let perfPixelRatio = Math.min(devicePixelRatio || 1, PERF_MOBILE ? 0.92 : 1.15);
let perfFrames = 0, perfWindowAt = performance.now(), perfLastFps = 60, perfHighWindows = 0;
renderer.setPixelRatio(perfPixelRatio); resize();

/* Decorative point lights were the largest shader cost. Emissive materials keep the same atmosphere. */
addGlow = function(){ return null; };

const perfBaseRender = renderer.render.bind(renderer);
renderer.render = function(s,c){
  perfFrames++;
  const now = performance.now(), span = now - perfWindowAt;
  if(span >= 1500){
    perfLastFps = perfFrames * 1000 / span;
    perfFrames = 0; perfWindowAt = now;
    let next = perfPixelRatio;
    const minRatio = PERF_MOBILE ? 0.68 : 0.80, maxRatio = PERF_MOBILE ? 1.00 : 1.20;
    if(perfLastFps < 47){ perfHighWindows = 0; next = Math.max(minRatio, perfPixelRatio - .10); }
    else if(perfLastFps < 53){ perfHighWindows = 0; next = Math.max(minRatio, perfPixelRatio - .05); }
    else if(perfLastFps > 58){ if(++perfHighWindows >= 3){ next = Math.min(maxRatio, perfPixelRatio + .05); perfHighWindows = 0; } }
    else perfHighWindows = 0;
    if(Math.abs(next - perfPixelRatio) > .001){ perfPixelRatio = next; renderer.setPixelRatio(perfPixelRatio); resize(); }
    frame.dataset.fps = String(Math.round(perfLastFps));
  }
  return perfBaseRender(s,c);
};

/* Reusable low-draw-call scenery primitives. */
const PERF_GEO = {
  box:new THREE.BoxGeometry(1,1,1),
  cone:new THREE.ConeGeometry(1,1,7),
  trunk:new THREE.CylinderGeometry(.45,.62,1,6),
  crown:new THREE.ConeGeometry(1,1,7),
  rock:new THREE.DodecahedronGeometry(1,0),
  bulb:new THREE.SphereGeometry(1,6,5)
};
const perfObj = new THREE.Object3D();
function perfBatch(geo, material, rows, colors=null){
  if(!rows.length)return null;
  const mesh = new THREE.InstancedMesh(geo, material, rows.length);
  mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  for(let i=0;i<rows.length;i++){
    const r=rows[i];
    perfObj.position.set(r[0],r[1],r[2]);
    perfObj.rotation.set(r[6]||0,r[7]||0,r[8]||0);
    perfObj.scale.set(r[3]||1,r[4]||1,r[5]||1);
    perfObj.updateMatrix(); mesh.setMatrixAt(i,perfObj.matrix);
    if(colors?.[i] != null) mesh.setColorAt(i,new THREE.Color(colors[i]));
  }
  mesh.instanceMatrix.needsUpdate=true;
  if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  mesh.computeBoundingBox(); mesh.computeBoundingSphere();
  scene.add(mesh); return mesh;
}
function perfMat(color, emissive=0, intensity=0, rough=.82, metal=.03){
  return new THREE.MeshStandardMaterial({color,emissive,emissiveIntensity:intensity,roughness:rough,metalness:metal});
}
function perfClouds(stage,rand,count=6){
  const m=state.maze;
  for(let i=0;i<count;i++){
    const sm=new THREE.SpriteMaterial({map:owCloudTex,color:stage.key==='castle'?0xc55a77:stage.key==='city'?0x9176b4:0xdde8ee,transparent:true,opacity:.12+rand()*.11,depthWrite:false});
    const s=new THREE.Sprite(sm);s.scale.set(38+rand()*54,13+rand()*20,1);s.position.set((rand()-.5)*(m.cols*m.cell+75),22+rand()*21,m.z0-rand()*m.rows*m.cell);scene.add(s);state.stageVisuals.push({type:'owCloud',mesh:s,drift:(rand()-.5)*.010});
  }
}
function perfSky(stage,rand){
  scene.background=expansionMakeSkyTexture(stage);
  scene.fog=new THREE.FogExp2(stage.fog,stage.key==='castle'?.0035:stage.key==='mansion'?.0030:.00245);
  renderer.toneMappingExposure=stage.key==='city'?1.27:stage.key==='castle'?1.26:1.20;
  perfClouds(stage,rand,PERF_MOBILE?5:7);
}
function perfGround(stage){
  const m=state.maze,w=m.cols*m.cell+22,l=m.rows*m.cell+30;
  const gm=new THREE.MeshStandardMaterial({map:owGroundTexture(stage),color:0xffffff,roughness:.94,metalness:stage.key==='city'?.08:.01});
  const g=new THREE.Mesh(new THREE.PlaneGeometry(w,l),gm);g.rotation.x=-Math.PI/2;g.position.set(0,-.05,m.z0-m.rows*m.cell/2);scene.add(g);
}
function perfRoad(stage,width){
  const m=state.maze,total=m.rows*m.cell,segments=6,seg=total/segments;
  const color=stage.key==='mansion'?0x493638:stage.key==='mountain'?0x53605d:stage.key==='river'?0x5a4b3b:stage.key==='sea'?0x384852:stage.key==='city'?0x22262b:0x402842;
  for(let i=0;i<segments;i++){
    const z=m.z0-(i+.5)*seg,x=Math.sin(i*.82+state.area)*Math.min(5,m.cols*m.cell*.035);
    const p=addPlane(x,.012,z,width+(i%3===1?2:0),seg*1.04,color,0,.98);p.rotation.z=Math.sin(i*.82+state.area)*.015;
  }
}
function perfTrees(rand,count,colorA,colorB){
  const m=state.maze,half=m.cols*m.cell/2,trunks=[],crowns=[],colors=[];
  for(let i=0;i<count;i++){
    const side=i%2?-1:1,x=side*(half*.38+rand()*half*.48),z=m.z0-rand()*m.rows*m.cell,s=.75+rand()*1.35;
    trunks.push([x,1.25*s,z,.35*s,2.5*s,.35*s,0,rand()*Math.PI,0]);
    crowns.push([x,3.0*s,z,1.25*s,2.8*s,1.25*s,0,rand()*Math.PI,0]);
    colors.push(rand()>.45?colorA:colorB);
  }
  perfBatch(PERF_GEO.trunk,perfMat(0x493527),trunks);
  perfBatch(PERF_GEO.crown,perfMat(0xffffff),crowns,colors);
}
function perfPeaks(rand,count){
  const m=state.maze,half=m.cols*m.cell/2,peaks=[],caps=[];
  for(let i=0;i<count;i++){
    const side=i%2?-1:1,x=side*(half*.68+12+rand()*35),z=m.z0-rand()*m.rows*m.cell,h=18+rand()*34,w=8+rand()*10;
    peaks.push([x,h*.47,z,w,h,w,0,rand()*Math.PI,0]);caps.push([x,h*.84,z,w*.40,h*.25,w*.40,0,rand()*Math.PI,0]);
  }
  perfBatch(PERF_GEO.cone,perfMat(0x354a54),peaks);perfBatch(PERF_GEO.cone,perfMat(0xd9e8eb),caps);
}
function perfBuildings(rand,count,stage){
  const m=state.maze,half=m.cols*m.cell/2,b=[],neon=[];
  const palette=stage.key==='city'?[0x161b24,0x1b2029,0x111722]:stage.key==='castle'?[0x1b0d22,0x22102b,0x170b1e]:[0x271b20,0x312128,0x21171b];
  const accent=[stage.accent,stage.luxury,stage.key==='city'?0x3ed8ff:stage.accent];
  for(let i=0;i<count;i++){
    const side=i%2?-1:1,x=side*(half*.60+5+rand()*19),z=m.z0-rand()*m.rows*m.cell,h=(stage.key==='city'?15:10)+rand()*(stage.key==='city'?38:27),w=7+rand()*10,d=7+rand()*10;
    b.push([x,h/2,z,w,h,d,0,0,0]);
    neon.push([x,h*.68,z-side*d*.51,w*.62,.42,.08,0,0,0]);
  }
  const bm=perfMat(0xffffff,0,0,.80,.06);perfBatch(PERF_GEO.box,bm,b,b.map((_,i)=>palette[i%palette.length]));
  const nm=perfMat(0xffffff,0xffffff,.45,.35,.08);perfBatch(PERF_GEO.box,nm,neon,neon.map((_,i)=>accent[i%accent.length]));
}
function perfRocks(rand,count,color=0x52615c){
  const m=state.maze,half=m.cols*m.cell/2,rows=[];
  for(let i=0;i<count;i++){const side=i%2?-1:1,s=.6+rand()*1.7;rows.push([side*(half*.34+rand()*half*.55),.5*s,m.z0-rand()*m.rows*m.cell,s,s*.7,s*1.15,0,rand()*Math.PI,0]);}
  perfBatch(PERF_GEO.rock,perfMat(color),rows);
}
function perfLamps(stage,count=12){
  const m=state.maze,half=m.cols*m.cell/2,posts=[],bulbs=[];
  for(let i=0;i<count;i++){const side=i%2?-1:1,z=m.z0-(i+.7)*m.rows*m.cell/count,x=side*(half*.24+2);posts.push([x,1.55,z,.12,3.1,.12]);bulbs.push([x,3.12,z,.18,.18,.18]);}
  perfBatch(PERF_GEO.box,perfMat(0x24292d),posts);perfBatch(PERF_GEO.bulb,perfMat(stage.key==='city'?stage.accent:0xffe0a0,stage.key==='city'?stage.accent:0xffcf72,2.2,.22,.02),bulbs);
}
function perfVista(stage,rand){
  const m=state.maze,half=m.cols*m.cell/2,rows=[];
  for(let k=1;k<=4;k++){const z=m.z0-k*m.rows*m.cell/5,side=k%2?-1:1;rows.push([side*half*.18,.10,z,1.25,.08,1.25,Math.PI/2,0,0]);}
  const torusGeo=new THREE.TorusGeometry(1,.06,6,18);perfBatch(torusGeo,perfMat(stage.luxury,stage.accent,.65,.35,.08),rows);
}
function perfDecorateMansion(stage,rand){perfSky(stage,rand);perfGround(stage);perfRoad(stage,12);perfTrees(rand,PERF_MOBILE?28:38,0x173624,0x3b2b2c);perfBuildings(rand,8,stage);perfLamps(stage,12);perfVista(stage,rand);}
function perfDecorateMountain(stage,rand){perfSky(stage,rand);perfGround(stage);perfRoad(stage,10);perfPeaks(rand,PERF_MOBILE?26:38);perfTrees(rand,PERF_MOBILE?30:44,0x244b3d,0x314f45);perfRocks(rand,20,0x58645f);expansionParticles('snow',rand);perfVista(stage,rand);}
function perfDecorateRiver(stage,rand){perfSky(stage,rand);perfGround(stage);perfRoad(stage,11);const m=state.maze,half=m.cols*m.cell/2;const water=addPlane(half*.37,-.09,m.z0-m.rows*m.cell/2,16,m.rows*m.cell+12,0x0b6072,0x0b5261,.78);state.stageVisuals.push({type:'water',mesh:water,baseY:-.09,phase:.4});perfTrees(rand,PERF_MOBILE?28:40,0x244e34,0x4b5630);perfRocks(rand,18,0x49594e);for(let k=1;k<=4;k++){const z=m.z0-k*m.rows*m.cell/5;addBox(half*.37,.16,z,18,.32,5.5,0x735640,false,0,.8,.02);}expansionParticles('mist',rand);perfVista(stage,rand);}
function perfDecorateSea(stage,rand){perfSky(stage,rand);perfGround(stage);perfRoad(stage,13);const m=state.maze,half=m.cols*m.cell/2;const sea=addPlane(half*.56,-.11,m.z0-m.rows*m.cell/2,half*1.10,m.rows*m.cell+20,0x073d5a,0x074a63,.80);state.stageVisuals.push({type:'water',mesh:sea,baseY:-.11,phase:.7});const containers=[];for(let i=0;i<18;i++){const z=m.z0-(i+1)*m.rows*m.cell/20,x=-half*.30+(i%3)*5;containers.push([x,.75,z,4.8,1.5,2.2,0,(i%2)*Math.PI/2,0]);}perfBatch(PERF_GEO.box,perfMat(0xffffff,0,0,.72,.12),containers,containers.map((_,i)=>[0x74433a,0x2d5064,0x696036][i%3]));perfRocks(rand,12,0x263b43);expansionParticles('mist',rand);perfVista(stage,rand);}
function perfDecorateCity(stage,rand){perfSky(stage,rand);perfGround(stage);perfRoad(stage,17);perfBuildings(rand,PERF_MOBILE?28:38,stage);perfLamps(stage,14);const m=state.maze,cars=[];for(let i=0;i<12;i++){const z=m.z0-(i+1)*m.rows*m.cell/13,x=(i%3-1)*7;cars.push([x,.55,z,3.4,1.1,1.6,0,(i%2)*Math.PI/2,0]);}perfBatch(PERF_GEO.box,perfMat(0xffffff,0,0,.52,.22),cars,cars.map((_,i)=>[0x4d5964,0x7c2831,0x334c62][i%3]));perfVista(stage,rand);}
function perfDecorateCastle(stage,rand){perfSky(stage,rand);perfGround(stage);perfRoad(stage,13);perfBuildings(rand,PERF_MOBILE?22:30,stage);const m=state.maze,half=m.cols*m.cell/2;for(const side of [-1,1]){const lava=addPlane(side*half*.40,-.10,m.z0-m.rows*m.cell/2,half*.34,m.rows*m.cell+18,0x5a0d06,0xff3c08,.90);state.stageVisuals.push({type:'lava',mesh:lava,baseY:-.10,phase:side});}perfRocks(rand,18,0x28152e);expansionParticles('embers',rand);perfVista(stage,rand);}
decorateMansion=perfDecorateMansion;decorateMountain=perfDecorateMountain;decorateRiver=perfDecorateRiver;decorateSea=perfDecorateSea;decorateCity=perfDecorateCity;decorateCastle=perfDecorateCastle;

/* Open field AI: direct chase, no BFS, far enemies sleep until the player approaches. */
updateFields = function(){};
hostWorldStep = function(dt,now){
  if(!isHost()||!state.running)return;const stage=currentStage();
  for(const e of state.enemies.values()){
    if(e.dead)continue;const n=nearestLivingPlayer(e);if(!n)continue;
    if(e.boss){
      const phase=bossPhase(e),dx=n.p.x-e.x,dz=n.p.z-e.z,len=Math.hypot(dx,dz)||1;e.phase=phase;e.visualYaw=Math.atan2(dx,dz);
      if(now>state.bossAbilityAt){state.bossAbilityAt=now+(phase===3?2500:phase===2?3300:4200);if(n.d<10)spawnShockwave(e,stage,phase);else{state.bossChargeUntil=now+(phase===3?1150:850);state.bossChargeDir={x:dx/len,z:dz/len};toast(`${stage.boss} CHARGE!`,650);}}
      if(phase===3&&now>state.bossSummonAt){state.bossSummonAt=now+8200;summonBossRunners(e,state.difficulty==='nightmare'?10:7);}
      const mul=now<state.bossChargeUntil?2.8:phase===3?1.42:phase===2?1.18:1,dir=now<state.bossChargeUntil&&state.bossChargeDir?state.bossChargeDir:{x:dx/len,z:dz/len},step=e.speed*mul*dt,nx=e.x+dir.x*step,nz=e.z+dir.z*step;
      if(!blocked(nx,nz,1.2)){e.x=nx;e.z=nz;}const radius=phase===3?2.65:phase===2?2.35:2.05;
      if(n.d<radius){const last=damageCooldown.get(n.p.id)||0;if(now-last>difficulty().touchCd*1000*(phase===3?.62:phase===2?.78:1)){damageCooldown.set(n.p.id,now);damagePlayer(n.p.id,'BOSS STRIKE');}}
      continue;
    }
    if(n.d>PERF_AI_RANGE)continue;
    const dx=n.p.x-e.x,dz=n.p.z-e.z,len=Math.hypot(dx,dz)||1,step=e.speed*dt,nx=e.x+dx/len*step,nz=e.z+dz/len*step;
    if(!blocked(nx,nz,.55)){e.x=nx;e.z=nz;}else{const sx=-dz/len*.55,sz=dx/len*.55;if(!blocked(e.x+sx*step,e.z+sz*step,.55)){e.x+=sx*step;e.z+=sz*step;}}
    e.visualYaw=Math.atan2(n.p.x-e.x,n.p.z-e.z);
    const radius=e.type==='fat'?1.20:e.type==='dog'?.92:e.crawler?.82:e.runner?1.05:.94;
    if(n.d<radius){const last=damageCooldown.get(n.p.id)||0;if(now-last>difficulty().touchCd*1000){damageCooldown.set(n.p.id,now);damagePlayer(n.p.id,e.type==='dog'?'感染犬':e.type==='licker'?'リッカー':e.type==='fat'?'デブゾンビ':e.runner?'RUNNER HIT':'ZOMBIE HIT');}}
  }
  checkItems();
};

/* Enemy visual LOD: only nearby infected receive matrix animation. Far instances are hidden once, not rewritten every frame. */
const PERF_HORDE_PARTS=['body','head','lArm','rArm','lLeg','rLeg','eyes','mouth','bone'];
let perfLastVisual=0;
function perfHideEnemy(e){
  if(e._perfVisible===false)return false;const i=e.index;
  for(const k of PERF_HORDE_PARTS)hideInst(horde[k],i);e._perfVisible=false;return true;
}
function perfNormalEnemy(e,i,t){
  const fast=e.runner?1.55:1,phase=t*(5.2+e.speed*.72)*fast+e.phase,gait=Math.sin(phase),bob=Math.abs(Math.sin(phase*.92))*(e.crawler?.035:.105),tilt=e.headTilt+Math.sin(t*2.9+e.phase)*.11;
  if(e.crawler){setInst(horde.body,i,e,0,.72+bob,0,1.18,0,e.lean*.35,1.05,.78,1);setInst(horde.head,i,e,0,.86+bob,-.54,.78,0,tilt,e.headScale,e.headScale,e.headScale);setInst(horde.lArm,i,e,-.48,.38,-.48,-.62+gait*.28,0,-.25,1,1.2,1);setInst(horde.rArm,i,e,.48,.38,-.48,-.62-gait*.28,0,.25,1,1.2,1);setInst(horde.lLeg,i,e,-.3,.38,.42,.9+gait*.2,0,0);setInst(horde.rLeg,i,e,.3,.38,.42,.9-gait*.2,0,0);setInst(horde.eyes,i,e,0,.9+bob,-.82,.78,0,tilt);setInst(horde.mouth,i,e,0,.72+bob,-.84,.78,0,tilt);setInst(horde.bone,i,e,e.woundSide*.43,.98+bob,.03,.2,0,e.woundSide*.3,.9,1,1);}
  else{const lean=.28+e.lean+(e.runner?.16:0);setInst(horde.body,i,e,0,1.32+bob,0,lean,0,gait*.025);setInst(horde.head,i,e,0,2.08+bob,-.14,lean*.48,0,tilt,e.headScale,e.headScale,e.headScale);setInst(horde.lArm,i,e,-.5,1.35+bob,-.22,-1.2+gait*.48,0,-.18,1,1.12,1);setInst(horde.rArm,i,e,.5,1.35+bob,-.22,-1.1-gait*.48,0,.18,1,1.12,1);setInst(horde.lLeg,i,e,-.23,.48,0,gait*(e.runner?.78:.55),0,0);setInst(horde.rLeg,i,e,.23,.48,0,-gait*(e.runner?.78:.55),0,0);setInst(horde.eyes,i,e,0,2.12+bob,-.32,lean*.42,0,tilt);setInst(horde.mouth,i,e,0,1.92+bob,-.34,lean*.42,0,tilt);setInst(horde.bone,i,e,e.woundSide*.43,1.25+bob,.04,.2,0,e.woundSide*.4,.9,1,1);}
}
function perfSpecialEnemy(e,i,t){
  const gait=Math.sin(t*(8+e.speed)+e.phase);
  if(e.type==='dog'){setInst(horde.body,i,e,0,.60,0,1.28,0,0,1.35,.62,1.62);setInst(horde.head,i,e,0,.72,-.78,.55,0,0,.88,.82,1.02);setInst(horde.lArm,i,e,-.43,.30,-.48,.2+gait*.8,0,0,1.1,.72,1.1);setInst(horde.rArm,i,e,.43,.30,-.48,.2-gait*.8,0,0,1.1,.72,1.1);setInst(horde.lLeg,i,e,-.38,.28,.50,-.2-gait*.8,0,0,1.05,.72,1.05);setInst(horde.rLeg,i,e,.38,.28,.50,-.2+gait*.8,0,0,1.05,.72,1.05);setInst(horde.eyes,i,e,0,.78,-1.04,.52,0,0,1.15,1.2,1.2);setInst(horde.mouth,i,e,0,.61,-1.07,.52,0,0,1.2,1.35,1.2);hideInst(horde.bone,i);}
  else if(e.type==='licker'){setInst(horde.body,i,e,0,.68,0,1.12,0,gait*.04,1.38,.58,1.58);setInst(horde.head,i,e,0,.82,-.72,.74,0,gait*.06,1.18,1.05,1.16);setInst(horde.lArm,i,e,-.56,.32,-.72,-.45+gait*.38,0,-.30,1.12,1.55,1.12);setInst(horde.rArm,i,e,.56,.32,-.72,-.45-gait*.38,0,.30,1.12,1.55,1.12);setInst(horde.lLeg,i,e,-.34,.34,.54,.72-gait*.25,0,0,1.08,1.22,1.08);setInst(horde.rLeg,i,e,.34,.34,.54,.72+gait*.25,0,0,1.08,1.22,1.08);setInst(horde.eyes,i,e,0,.89,-1.02,.72,0,0,1.22,1.35,1.2);setInst(horde.mouth,i,e,0,.66,-1.06,.72,0,0,1.35,1.55,1.35);setInst(horde.bone,i,e,0,.63,-1.55,Math.PI/2,0,0,.55,2.9,.55);}
  else if(e.type==='fat'){const bob=Math.abs(gait)*.05;setInst(horde.body,i,e,0,1.43+bob,0,.12,0,gait*.035,1.82,1.55,1.52);setInst(horde.head,i,e,0,2.48+bob,-.14,.08,0,gait*.03,1.28,1.18,1.22);setInst(horde.lArm,i,e,-.82,1.45+bob,-.12,-.78+gait*.25,0,-.18,1.45,1.38,1.45);setInst(horde.rArm,i,e,.82,1.45+bob,-.12,-.78-gait*.25,0,.18,1.45,1.38,1.45);setInst(horde.lLeg,i,e,-.42,.48,0,gait*.28,0,0,1.45,1.08,1.45);setInst(horde.rLeg,i,e,.42,.48,0,-gait*.28,0,0,1.45,1.08,1.45);setInst(horde.eyes,i,e,0,2.52+bob,-.38,.08,0,0,1.25,1.3,1.2);setInst(horde.mouth,i,e,0,2.28+bob,-.40,.08,0,0,1.45,1.45,1.3);hideInst(horde.bone,i);}
  else perfNormalEnemy(e,i,t);
}
updateHordeVisuals=function(now){
  if(!horde){animateBoss(now);return;}if(now-perfLastVisual<PERF_VISUAL_INTERVAL){animateBoss(now);return;}perfLastVisual=now;
  const t=now*.001,range2=PERF_VISUAL_RANGE*PERF_VISUAL_RANGE;let changed=false;
  for(const e of state.enemies.values()){
    if(e.boss)continue;const i=e.index;if(i<0||i>=horde.capacity)continue;
    const dx=e.x-local.x,dz=e.z-local.z,show=!e.dead&&(dx*dx+dz*dz)<=range2;
    if(!show){if(perfHideEnemy(e))changed=true;continue;}
    e._perfVisible=true;perfSpecialEnemy(e,i,t);changed=true;
  }
  if(changed)for(const k of PERF_HORDE_PARTS)horde[k].instanceMatrix.needsUpdate=true;
  animateBoss(now);
};

/* Throttle non-critical animation and DOM HUD work while keeping camera/movement/render at display refresh rate. */
const perfStageBase=updateStageVisuals;let perfStageAt=0;
updateStageVisuals=function(now){if(now-perfStageAt<(PERF_MOBILE?40:28))return;perfStageAt=now;perfStageBase(now);};
const perfGoalBase=updateGoalHud;let perfGoalAt=0;
updateGoalHud=function(){const n=performance.now();if(n-perfGoalAt<90)return;perfGoalAt=n;perfGoalBase();};
const perfTimerBase=updateTimer;let perfTimerAt=0;
updateTimer=function(){const n=performance.now();if(n-perfTimerAt<240)return;perfTimerAt=n;perfTimerBase();};
const perfBossHudBase=updateBossHud;let perfBossHudAt=0;
updateBossHud=function(){const n=performance.now();if(n-perfBossHudAt<100)return;perfBossHudAt=n;perfBossHudBase();};

function perfFreezeStaticScene(){
  const dynamicRoots=new Set([camera,bossMesh,...state.items.values()].filter(Boolean).map(v=>v?.mesh||v));
  for(const v of state.stageVisuals)if(v?.mesh)dynamicRoots.add(v.mesh);
  const isDynamic=o=>{for(let p=o;p;p=p.parent)if(dynamicRoots.has(p))return true;return false;};
  scene.traverse(o=>{if(o===scene||isDynamic(o)||o.isLight)return;if(o.matrixAutoUpdate){o.updateMatrix();o.matrixAutoUpdate=false;}});
}
const perfBeginBase=beginArea;
beginArea=function(fromStart=true){const r=perfBeginBase(fromStart);setTimeout(()=>{perfFreezeStaticScene();if(horde)for(const k of PERF_HORDE_PARTS){horde[k].frustumCulled=false;}},40);return r;};
