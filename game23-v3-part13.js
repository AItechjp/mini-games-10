/* GAME 23 ULTIMATE — route variation, infected colors, collidable obstacles, boss reveal */
const P13_BOSS_REVEAL = 55;
const P13_BOSS_WAKE = 58;

const P13_TINT = {
  zombie:{body:0x71805b,head:0x91a06f,arm:0x75825f,leg:0x515949,eyes:0xffd85a,mouth:0x8f3038,bone:0xe7ddc2},
  runner:{body:0x8a562d,head:0xa97646,arm:0x8d633b,leg:0x553a2d,eyes:0xff9b35,mouth:0xa52b2f,bone:0xe0d1ad},
  crawler:{body:0x485b75,head:0x71839b,arm:0x516983,leg:0x344256,eyes:0xa8d6ff,mouth:0x743f69,bone:0xd8d9cd},
  dog:{body:0x65372f,head:0x84483d,arm:0x5b312a,leg:0x472b27,eyes:0xff4c36,mouth:0x8e171d,bone:0xcdbba2},
  licker:{body:0x9e3548,head:0xc84b62,arm:0x9f2d42,leg:0x6d2636,eyes:0xffc5d0,mouth:0x57131d,bone:0xf0d0c4},
  fat:{body:0x6a7074,head:0x9aa1a0,arm:0x737b7b,leg:0x4d555b,eyes:0xe6f7ff,mouth:0x6f3541,bone:0xd9d6ca}
};
const P13_PART_COLOR = {body:'body',head:'head',lArm:'arm',rArm:'arm',lLeg:'leg',rLeg:'leg',eyes:'eyes',mouth:'mouth',bone:'bone'};
const p13ColorCache=new Map();
function p13Color(hex,variant=0){const key=`${hex}:${variant}`;if(p13ColorCache.has(key))return p13ColorCache.get(key);const c=new THREE.Color(hex);const f=[.86,1,1.11][variant]||1;c.multiplyScalar(f);p13ColorCache.set(key,c);return c;}
function p13TintKey(e){return e.type==='dog'?'dog':e.type==='licker'?'licker':e.type==='fat'?'fat':e.crawler?'crawler':e.runner?'runner':'zombie';}
function p13TintEnemy(e){if(!horde||e.boss||e.index<0||e.index>=horde.capacity)return false;const kind=p13TintKey(e),variant=(e.index+state.area)%3,key=`${kind}:${variant}`;if(e._p13Tint===key)return false;const pal=P13_TINT[kind];for(const [part,slot] of Object.entries(P13_PART_COLOR)){const mesh=horde[part];if(mesh?.setColorAt)mesh.setColorAt(e.index,p13Color(pal[slot],variant));}e._p13Tint=key;return true;}
function p13TintAll(){if(!horde)return;let changed=false;for(const e of state.enemies.values())if(p13TintEnemy(e))changed=true;if(changed)for(const part of Object.keys(P13_PART_COLOR)){const m=horde[part];if(m?.instanceColor)m.instanceColor.needsUpdate=true;}}
const p13SpawnHostWorldBase=spawnHostWorld;
spawnHostWorld=function(arenaZ){const r=p13SpawnHostWorldBase(arenaZ);p13TintAll();return r;};
const p13UpdateHordeBase=updateHordeVisuals;let p13TintAt=0;
updateHordeVisuals=function(now){p13UpdateHordeBase(now);if(now-p13TintAt>420){p13TintAt=now;p13TintAll();}};

function p13RegisterWalls(rows,mesh,shape='box',shrink=.82){for(const r of rows){let hx,hz;if(shape==='box'){hx=r[3]*.5*shrink;hz=r[5]*.5*shrink;}else{hx=r[3]*shrink;hz=r[5]*shrink;}state.walls.push({minX:r[0]-hx,maxX:r[0]+hx,minZ:r[2]-hz,maxZ:r[2]+hz,mesh,p13Obstacle:true});}}
function p13BatchObstacle(geo,material,rows,shape='box',colors=null,shrink=.82){const mesh=perfBatch(geo,material,rows,colors);if(mesh)p13RegisterWalls(rows,mesh,shape,shrink);return mesh;}
function p13AddCourseObstacles(){
  const stage=currentStage(),m=state.maze;if(!m)return;const rand=mulberry32(state.seed^0x13a7b51d^(state.area*0x45d9f3));
  const total=m.rows*m.cell,half=m.cols*m.cell/2,count=PERF_MOBILE?10:13,boxes=[],rocks=[],cones=[],boxColors=[];
  for(let i=0;i<count;i++){
    const progress=.14+(i/(count-1))*.66,z=m.z0-progress*total,side=i%2?-1:1,centerWave=Math.sin(i*1.28+state.area*.72)*5.5;
    const x=THREE.MathUtils.clamp(centerWave+side*(5.5+rand()*9),-half*.52,half*.52);
    if(stage.key==='mountain'){
      const s=2.6+rand()*2.2;cones.push([x,3.8+rand()*1.8,z,s,7.5+rand()*3.5,s,0,rand()*Math.PI,0]);
      if(i%3===1){const rs=1.4+rand()*1.2;rocks.push([x-side*(3.5+rand()*2),.6*rs,z+2.5,rs,rs*.75,rs*1.15,0,rand()*Math.PI,0]);}
    }else if(stage.key==='city'){
      const w=5.5+rand()*4.5,d=5.5+rand()*5,h=7+rand()*13;boxes.push([x,h*.5,z,w,h,d]);boxColors.push([0x202936,0x2b313b,0x25202f][i%3]);
      if(i%4===2){const w2=3+rand()*2,d2=7+rand()*3;boxes.push([x-side*(6+rand()*2),1.2,z+3,w2,2.4,d2]);boxColors.push(0x3a4149);}
    }else if(stage.key==='sea'){
      boxes.push([x,1.35,z,5.2,2.7,8.6,0,(i%2)*Math.PI/2,0]);boxColors.push([0x7d3e34,0x2f5269,0x786332][i%3]);
    }else if(stage.key==='river'){
      const rs=1.9+rand()*1.8;rocks.push([x,.65*rs,z,rs,rs*.72,rs*1.25,0,rand()*Math.PI,0]);
      if(i%4===0){boxes.push([x-side*4,.6,z+2.5,6.5,1.2,1.1,0,rand()*.45-.22,0]);boxColors.push(0x6d5239);}
    }else if(stage.key==='castle'){
      const h=5+rand()*4,w=2.2+rand()*1.8;boxes.push([x,h*.5,z,w,h,w]);boxColors.push(i%2?0x33213b:0x472945);
      if(i%3===0){const s=1.8+rand();cones.push([x-side*4,2.6,z+2.5,s,5.2,s,0,rand()*Math.PI,0]);}
    }else{
      const w=3.5+rand()*3,d=3.5+rand()*2.5,h=3.5+rand()*4;boxes.push([x,h*.5,z,w,h,d]);boxColors.push(i%2?0x3a2b2d:0x2a3330);
      if(i%3===1){const rs=1.3+rand();rocks.push([x-side*4,.6*rs,z+2,rs,rs*.75,rs,0,rand()*Math.PI,0]);}
    }
  }
  if(boxes.length)p13BatchObstacle(PERF_GEO.box,perfMat(0xffffff,0,0,.88,.06),boxes,'box',boxColors,.84);
  if(rocks.length)p13BatchObstacle(PERF_GEO.rock,perfMat(stage.key==='river'?0x536158:0x58605d),rocks,'round',null,.72);
  if(cones.length)p13BatchObstacle(PERF_GEO.cone,perfMat(stage.key==='mountain'?0x4f5f64:0x3a2941),cones,'round',null,.68);
  if(isHost())for(const e of state.enemies.values())if(!e.boss&&!e.dead&&blocked(e.x,e.z,.55)){for(let k=0;k<10;k++){const a=(k/10)*Math.PI*2,nx=e.x+Math.cos(a)*(3+k*.45),nz=e.z+Math.sin(a)*(3+k*.45);if(!blocked(nx,nz,.55)){e.x=nx;e.z=nz;break;}}}
}
const p13BeginAreaBase=beginArea;
beginArea=function(fromStart=true){const r=p13BeginAreaBase(fromStart);p13AddCourseObstacles();return r;};

hostWorldStep=function(dt,now){
  if(!isHost()||!state.running)return;const stage=currentStage();
  for(const e of state.enemies.values()){
    if(e.dead)continue;const n=nearestLivingPlayer(e);if(!n)continue;
    if(e.boss){
      if(!e._p13Awake){if(n.d>P13_BOSS_WAKE){e.visualYaw=Math.atan2(n.p.x-e.x,n.p.z-e.z);continue;}e._p13Awake=true;toast(`${stage.boss} 出現`,900);}
      const phase=bossPhase(e),dx=n.p.x-e.x,dz=n.p.z-e.z,len=Math.hypot(dx,dz)||1;e.phase=phase;e.visualYaw=Math.atan2(dx,dz);
      if(now>state.bossAbilityAt){state.bossAbilityAt=now+(phase===3?2500:phase===2?3300:4200);if(n.d<10)spawnShockwave(e,stage,phase);else{state.bossChargeUntil=now+(phase===3?1150:850);state.bossChargeDir={x:dx/len,z:dz/len};toast(`${stage.boss} CHARGE!`,650);}}
      if(phase===3&&now>state.bossSummonAt){state.bossSummonAt=now+8200;summonBossRunners(e,state.difficulty==='nightmare'?10:7);}
      const mul=now<state.bossChargeUntil?2.8:phase===3?1.42:phase===2?1.18:1,dir=now<state.bossChargeUntil&&state.bossChargeDir?state.bossChargeDir:{x:dx/len,z:dz/len},step=e.speed*mul*dt,nx=e.x+dir.x*step,nz=e.z+dir.z*step;
      if(!blocked(nx,nz,1.2)){e.x=nx;e.z=nz;}const radius=phase===3?2.65:phase===2?2.35:2.05;
      if(n.d<radius){const last=damageCooldown.get(n.p.id)||0;if(now-last>difficulty().touchCd*1000*(phase===3?.62:phase===2?.78:1)){damageCooldown.set(n.p.id,now);damagePlayer(n.p.id,'BOSS STRIKE');}}
      continue;
    }
    if(n.d>PERF_AI_RANGE)continue;
    const dx=n.p.x-e.x,dz=n.p.z-e.z,len=Math.hypot(dx,dz)||1,fx=dx/len,fz=dz/len,sx=-fz,sz=fx;
    const amp=n.d<5?.08:e.type==='licker'?.58:e.type==='dog'?.50:e.runner?.42:e.type==='fat'?.18:.30,freq=e.type==='dog'?5.8:e.type==='licker'?4.9:e.runner?4.1:e.type==='fat'?1.7:2.7;
    const sway=Math.sin(now*.001*freq+e.phase*1.73)*amp,rx=fx+sx*sway,rz=fz+sz*sway,rlen=Math.hypot(rx,rz)||1,step=e.speed*dt;
    let nx=e.x+rx/rlen*step,nz=e.z+rz/rlen*step;
    if(!blocked(nx,nz,.55)){e.x=nx;e.z=nz;}else{const sign=Math.sin(now*.003+e.phase)>0?1:-1;let moved=false;for(const dir of [sign,-sign]){nx=e.x+sx*dir*step*1.28;nz=e.z+sz*dir*step*1.28;if(!blocked(nx,nz,.55)){e.x=nx;e.z=nz;moved=true;break;}}if(!moved){nx=e.x-fx*step*.45;nz=e.z-fz*step*.45;if(!blocked(nx,nz,.55)){e.x=nx;e.z=nz;}}}
    e.visualYaw=Math.atan2(n.p.x-e.x,n.p.z-e.z);
    const radius=e.type==='fat'?1.20:e.type==='dog'?.92:e.crawler?.82:e.runner?1.05:.94;
    if(n.d<radius){const last=damageCooldown.get(n.p.id)||0;if(now-last>difficulty().touchCd*1000){damageCooldown.set(n.p.id,now);damagePlayer(n.p.id,e.type==='dog'?'感染犬':e.type==='licker'?'リッカー':e.type==='fat'?'デブゾンビ':e.runner?'RUNNER HIT':'ZOMBIE HIT');}}
  }
  checkItems();
};

const p13AnimateBossBase=animateBoss;
animateBoss=function(now){const e=state.enemies.get('boss');if(e&&!e.dead&&Math.hypot(local.x-e.x,local.z-e.z)>P13_BOSS_REVEAL){if(bossMesh)bossMesh.visible=false;return;}p13AnimateBossBase(now);};

drawMinimap=function(){
  if(!minimapCtx||!state.maze)return;const ctx=minimapCtx,m=state.maze,w=minimap.width,h=minimap.height,pad=7,sx=(w-pad*2)/(m.cols*m.cell),sz=(h-pad*2)/(m.rows*m.cell),mapX=x=>pad+(x-m.x0)*sx,mapY=z=>pad+(m.z0-z)*sz;
  ctx.clearRect(0,0,w,h);ctx.fillStyle='rgba(4,7,9,.90)';ctx.fillRect(0,0,w,h);ctx.strokeStyle='rgba(210,226,232,.22)';ctx.strokeRect(pad,pad,w-pad*2,h-pad*2);
  for(const item of state.items.values())if(!item.taken){ctx.fillStyle=item.type==='life'?'#ff5577':item.type==='infinite'?'#ffd84b':item.type==='invincible'?'#52dbff':'#ff8739';ctx.fillRect(mapX(item.x)-1.5,mapY(item.z)-1.5,3,3);}
  let shown=0;for(const e of state.enemies.values()){if(e.dead)continue;if(e.boss){if(Math.hypot(local.x-e.x,local.z-e.z)<=P13_BOSS_REVEAL){ctx.fillStyle='#ff2d5f';ctx.beginPath();ctx.arc(mapX(e.x),mapY(e.z),4.1,0,Math.PI*2);ctx.fill();}continue;}if(shown++>85)continue;const dx=e.x-local.x,dz=e.z-local.z;if(dx*dx+dz*dz>PERF_VISUAL_RANGE*PERF_VISUAL_RANGE*1.5)continue;ctx.fillStyle=e.type==='licker'?'#d34e76':e.type==='dog'?'#9a4f37':e.type==='fat'?'#8fa0a7':e.crawler?'#6485a5':e.runner?'#d3833d':'#82945f';const s=e.type==='fat'?2.8:2;ctx.fillRect(mapX(e.x)-s/2,mapY(e.z)-s/2,s,s);}
  if(state.goal){ctx.fillStyle=state.bossGate?'#858996':'#49ff92';ctx.beginPath();ctx.arc(mapX(state.goal.x),mapY(state.goal.z),3.5,0,Math.PI*2);ctx.fill();}
  for(const p of state.players.values()){ctx.fillStyle=p.id===state.playerId?'#ffffff':'#ffd85a';ctx.beginPath();ctx.arc(mapX(p.x),mapY(p.z),p.id===state.playerId?3.2:2.7,0,Math.PI*2);ctx.fill();}
};
