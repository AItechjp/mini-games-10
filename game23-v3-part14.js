/* GAME 23 ULTIMATE — 10 infected classes, infinite respawn, continue, area-specific bosses */
const P14_TYPES={
  zombie:{label:'感染者',color:0x728458,speed:'normal',sway:.28,freq:2.6,attack:'bite'},
  runner:{label:'ランナー',color:0xc77932,speed:'runner',sway:.48,freq:4.4,attack:'rush'},
  crawler:{label:'クロウラー',color:0x4777a6,speed:'crawler',sway:.42,freq:3.8,attack:'crawl'},
  dog:{label:'感染犬',color:0x9b3c2f,speed:'dog',sway:.68,freq:6.2,attack:'pounce'},
  licker:{label:'リッカー',color:0xd43e66,speed:'licker',sway:.72,freq:5.2,attack:'tongue'},
  fat:{label:'デブゾンビ',color:0x86979b,speed:'fat',sway:.16,freq:1.6,attack:'slam'},
  spitter:{label:'スピッター',color:0x6fbf3e,speed:'spitter',sway:.32,freq:2.4,attack:'acid'},
  screamer:{label:'スクリーマー',color:0xb557d1,speed:'screamer',sway:.38,freq:2.9,attack:'scream'},
  stalker:{label:'ストーカー',color:0x32a6a2,speed:'stalker',sway:.82,freq:5.8,attack:'flank'},
  charger:{label:'チャージャー',color:0xe0a536,speed:'charger',sway:.34,freq:3.5,attack:'charge'}
};
const P14_KEYS=Object.keys(P14_TYPES);
const P14_WEIGHTS=[.25,.115,.085,.10,.08,.09,.08,.06,.075,.065];
let p14ContinuePending=false,p14LastRespawn=0,p14SpawnSerial=0;

/* Every class gets a clearly different full-body tint. Eyes/mouth remain readable as attack tells. */
for(const [key,def] of Object.entries(P14_TYPES)){
  const eye=key==='dog'?0xff3b28:key==='licker'?0xffd1db:key==='spitter'?0xdfff62:key==='screamer'?0xff8dff:key==='charger'?0xffef8a:0xffe2a2;
  const mouth=key==='spitter'?0x315c19:key==='screamer'?0x55245f:0x6c2027;
  P13_TINT[key]={body:def.color,head:def.color,arm:def.color,leg:def.color,bone:def.color,eyes:eye,mouth};
}
p13TintKey=function(e){return P14_TYPES[e.type]?e.type:(e.crawler?'crawler':e.runner?'runner':'zombie');};

function p14PickType(rand){let n=rand(),sum=0;for(let i=0;i<P14_KEYS.length;i++){sum+=P14_WEIGHTS[i];if(n<=sum)return P14_KEYS[i];}return 'zombie';}
function p14Speed(type,d){switch(type){case'runner':return d.runnerSpeed*1.02;case'crawler':return d.runnerSpeed*.72;case'dog':return d.runnerSpeed*1.48;case'licker':return d.runnerSpeed*1.14;case'fat':return d.zombieSpeed*.64;case'spitter':return d.zombieSpeed*.78;case'screamer':return d.zombieSpeed*.72;case'stalker':return d.runnerSpeed*1.25;case'charger':return d.runnerSpeed*.96;default:return d.zombieSpeed*(.88+Math.random()*.20);}}
function p14ConfigureEnemy(e,type,rand=Math.random){
  const d=difficulty();e.type=type;e.hp=e.maxHp=type==='fat'?3:1;e.speed=p14Speed(type,d);e.dead=false;e._expCounted=false;e._p13Tint='';e._perfVisible=undefined;e.nextAttack=performance.now()+900+rand()*1800;e.dashUntil=0;e.dashDir=null;
  e.runner=['runner','dog','stalker','charger'].includes(type);e.crawler=['crawler','licker'].includes(type);
  e.headScale=type==='fat'?1.22:type==='dog'?.78:type==='licker'?1.06:type==='crawler'?.84:type==='screamer'?1.12:.94+rand()*.10;
  e.lean=type==='fat'?.02:type==='dog'?.28:type==='licker'?.34:type==='crawler'?.22:type==='stalker'?.25:.08;
  e.headTilt=(rand()-.5)*(type==='screamer'?.72:.42);e.phase=rand()*Math.PI*2;e.woundSide=rand()<.5?-1:1;e.visualYaw=0;
  return e;
}
function p14TargetCount(){const base=PERF_MOBILE?(state.difficulty==='easy'?24:state.difficulty==='nightmare'?38:31):(state.difficulty==='easy'?34:state.difficulty==='nightmare'?54:44);return Math.min(base+state.area*2,PERF_MOBILE?46:64);}
function p14RandomCoursePoint(rand){const m=state.maze;for(let tries=0;tries<30;tries++){const x=m.x0+2+rand()*(m.cols*m.cell-4),z=m.z0-m.cell*2-rand()*m.cell*(m.rows-11);if(!blocked(x,z,.65))return{x,z};}return{x:0,z:m.z0-m.cell*(3+rand()*(m.rows-13))};}
function p14RespawnPoint(rand){const m=state.maze,fx=Math.sin(local.yaw),fz=-Math.cos(local.yaw),sx=-fz,sz=fx;for(let tries=0;tries<30;tries++){const dist=30+rand()*38,side=(rand()-.5)*34,x=local.x+fx*dist+sx*side,z=local.z+fz*dist+sz*side;if(x>m.x0+2&&x<m.x0+m.cols*m.cell-2&&z<m.z0-3&&z>m.z0-m.rows*m.cell+m.cell*7&&!blocked(x,z,.7))return{x,z};}return p14RandomCoursePoint(rand);}

/* Replace finite opening horde with a performance-bounded pool that is replenished forever. */
spawnHostWorld=function(arenaZ){
  state.enemies.clear();state.items.clear();const d=difficulty(),rand=mulberry32(state.seed^0x14f00d^(state.area*977)),target=p14TargetCount(),capacity=target+(PERF_MOBILE?18:26);makeHorde(capacity);
  for(let i=0;i<target;i++){const p=p14RandomCoursePoint(rand),type=p14PickType(rand),e={id:`z${i}`,index:i,x:p.x,z:p.z,boss:false};p14ConfigureEnemy(e,type,rand);state.enemies.set(e.id,e);}
  const hp=d.bossHp[state.area],boss={id:'boss',index:-1,x:0,z:arenaZ+state.maze.cell*.55,hp,maxHp:hp,boss:true,dead:false,speed:d.bossSpeed,visualYaw:0,phase:1,_p13Awake:false};state.enemies.set('boss',boss);createBossMesh(boss);p14SpawnSerial=target;p14LastRespawn=performance.now();p13TintAll();updateHordeVisuals(performance.now());updateBossHud();
};
function p14MaintainInfiniteHorde(now){
  if(!isHost()||!state.running||now-p14LastRespawn<1050)return;p14LastRespawn=now;const target=p14TargetCount(),alive=[...state.enemies.values()].filter(e=>!e.boss&&!e.dead).length;if(alive>=target)return;
  const rand=mulberry32((state.seed^((now/1000)|0)^p14SpawnSerial*2654435761)>>>0),need=Math.min(target-alive,PERF_MOBILE?2:3);let made=0;
  for(const e of state.enemies.values()){if(made>=need)break;if(e.boss||!e.dead)continue;const p=p14RespawnPoint(rand),type=p14PickType(rand);e.x=p.x;e.z=p.z;p14ConfigureEnemy(e,type,rand);made++;p14SpawnSerial++;}
  /* Boss summons may temporarily consume spare slots; create only within existing InstancedMesh capacity. */
  while(made<need&&horde&&p14SpawnSerial<horde.capacity){const p=p14RespawnPoint(rand),id=`z${p14SpawnSerial}`,e={id,index:p14SpawnSerial,x:p.x,z:p.z,boss:false};p14ConfigureEnemy(e,p14PickType(rand),rand);state.enemies.set(id,e);p14SpawnSerial++;made++;}
  if(made){p13TintAll();sendWorld(true);}
}

function p14TempRing(x,z,r,color,duration=520){const geo=new THREE.RingGeometry(Math.max(.2,r*.82),r,28),ma=new THREE.MeshBasicMaterial({color,transparent:true,opacity:.58,side:THREE.DoubleSide,depthWrite:false}),mesh=new THREE.Mesh(geo,ma);mesh.rotation.x=-Math.PI/2;mesh.position.set(x,.13,z);scene.add(mesh);setTimeout(()=>{scene.remove(mesh);geo.dispose();ma.dispose();},duration);return mesh;}
function p14TempBeam(x1,z1,x2,z2,color,duration=360){const geo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x1,1.2,z1),new THREE.Vector3(x2,1.2,z2)]),ma=new THREE.LineBasicMaterial({color,transparent:true,opacity:.75}),line=new THREE.Line(geo,ma);scene.add(line);setTimeout(()=>{scene.remove(line);geo.dispose();ma.dispose();},duration);}
function p14AreaDamage(x,z,r,reason,delay=0){setTimeout(()=>{if(!isHost()||!state.running)return;for(const p of state.players.values())if((p.lives??0)>0&&Math.hypot(p.x-x,p.z-z)<=r)damagePlayer(p.id,reason);},delay);}
function p14TargetStrike(p,r,color,reason,delay=480){const x=p.x,z=p.z;p14TempRing(x,z,r,color,delay+120);p14AreaDamage(x,z,r,reason,delay);}
function p14EnemySpecial(e,n,now){
  if(now<(e.nextAttack||0))return;const p=n.p;
  if(e.type==='dog'&&n.d>3.5&&n.d<11){const dx=p.x-e.x,dz=p.z-e.z,l=Math.hypot(dx,dz)||1;e.dashDir={x:dx/l,z:dz/l};e.dashUntil=now+520;e.nextAttack=now+2600;}
  else if(e.type==='licker'&&n.d<5.6){e.nextAttack=now+3000;p14TempBeam(e.x,e.z,p.x,p.z,0xff5577,260);setTimeout(()=>{if(state.running&&Math.hypot(p.x-e.x,p.z-e.z)<6.2)damagePlayer(p.id,'リッカーの舌撃');},260);}
  else if(e.type==='fat'&&n.d<3.4){e.nextAttack=now+3600;p14TempRing(e.x,e.z,3.2,0xe2edf0,520);p14AreaDamage(e.x,e.z,3.2,'デブゾンビの叩きつけ',430);}
  else if(e.type==='spitter'&&n.d>6&&n.d<25){e.nextAttack=now+3300;p14TargetStrike(p,2.8,0x8cff45,'酸液攻撃',620);}
  else if(e.type==='screamer'&&n.d<14){e.nextAttack=now+4400;p14TempRing(e.x,e.z,12,0xd66cff,650);p14AreaDamage(e.x,e.z,12,'絶叫衝撃波',560);}
  else if(e.type==='stalker'&&n.d>4&&n.d<13){e.nextAttack=now+2300;e.dashUntil=now+430;const dx=p.x-e.x,dz=p.z-e.z,l=Math.hypot(dx,dz)||1,side=Math.sin(e.phase)>0?1:-1;e.dashDir={x:dx/l+(-dz/l)*side*.45,z:dz/l+(dx/l)*side*.45};}
  else if(e.type==='charger'&&n.d>6&&n.d<19){e.nextAttack=now+4000;const dx=p.x-e.x,dz=p.z-e.z,l=Math.hypot(dx,dz)||1;e.dashDir={x:dx/l,z:dz/l};e.dashUntil=now+820;p14TempBeam(e.x,e.z,p.x,p.z,0xffbd3d,260);}
}

function p14BossAttack(e,n,now,phase){const stage=currentStage(),p=n.p,dx=p.x-e.x,dz=p.z-e.z,l=Math.hypot(dx,dz)||1;
  if(stage.key==='mansion'){p14TargetStrike(p,3.4,0xe62848,'ネクロハウンドの飛びかかり',420);state.bossChargeDir={x:dx/l,z:dz/l};state.bossChargeUntil=now+900;}
  else if(stage.key==='mountain'){p14TempRing(e.x,e.z,8.8,0x8ddfff,720);p14AreaDamage(e.x,e.z,8.8,'氷震スマッシュ',620);}
  else if(stage.key==='river'){p14TempRing(e.x,e.z,6.7,0x4df5c2,560);p14AreaDamage(e.x,e.z,6.7,'クロコドレイクの尻尾薙ぎ',470);state.bossChargeDir={x:-dz/l,z:dx/l};state.bossChargeUntil=now+620;}
  else if(stage.key==='sea'){for(let i=0;i<3+(phase===3?2:0);i++){const a=i*2.2+phase,x=p.x+Math.cos(a)*(i?3.4:0),z=p.z+Math.sin(a)*(i?3.4:0);p14TempRing(x,z,2.5,0x42cbff,620+i*90);p14AreaDamage(x,z,2.5,'リヴァイアサン触手',500+i*90);}}
  else if(stage.key==='city'){p14TempBeam(e.x,e.z,p.x,p.z,0xff7b32,520);p14TargetStrike(p,2.6,0xff7b32,'タイタン砲撃',560);if(phase>=2)setTimeout(()=>p14TargetStrike(p,3.0,0xffcf55,'追尾ミサイル',520),430);}
  else{for(let i=0;i<4+(phase===3?2:0);i++){const a=i*Math.PI/2.1+now*.001,x=p.x+Math.cos(a)*(i?4.2:0),z=p.z+Math.sin(a)*(i?4.2:0);p14TempRing(x,z,2.7,0xd34dff,620+i*75);p14AreaDamage(x,z,2.7,'魔王の地獄火',520+i*75);}}
}

/* Ten movement/attack archetypes + six different boss attack patterns. */
hostWorldStep=function(dt,now){
  if(!isHost()||!state.running)return;const stage=currentStage();
  for(const e of state.enemies.values()){
    if(e.dead)continue;const n=nearestLivingPlayer(e);if(!n)continue;
    if(e.boss){
      if(!e._p13Awake){if(n.d>P13_BOSS_WAKE){e.visualYaw=Math.atan2(n.p.x-e.x,n.p.z-e.z);continue;}e._p13Awake=true;toast(`${stage.boss} 出現`,900);}
      const phase=bossPhase(e),dx=n.p.x-e.x,dz=n.p.z-e.z,len=Math.hypot(dx,dz)||1;e.phase=phase;e.visualYaw=Math.atan2(dx,dz);
      if(now>state.bossAbilityAt){state.bossAbilityAt=now+(phase===3?2600:phase===2?3400:4300);p14BossAttack(e,n,now,phase);}
      if(phase===3&&now>state.bossSummonAt){state.bossSummonAt=now+9000;summonBossRunners(e,state.difficulty==='nightmare'?7:4);}
      const mul=now<state.bossChargeUntil?2.85:phase===3?1.40:phase===2?1.18:1,dir=now<state.bossChargeUntil&&state.bossChargeDir?state.bossChargeDir:{x:dx/len,z:dz/len},step=e.speed*mul*dt,nx=e.x+dir.x*step,nz=e.z+dir.z*step;if(!blocked(nx,nz,1.2)){e.x=nx;e.z=nz;}
      const radius=phase===3?2.65:phase===2?2.35:2.05;if(n.d<radius){const last=damageCooldown.get(n.p.id)||0;if(now-last>difficulty().touchCd*1000*(phase===3?.62:phase===2?.78:1)){damageCooldown.set(n.p.id,now);damagePlayer(n.p.id,'BOSS STRIKE');}}continue;
    }
    if(n.d>PERF_AI_RANGE)continue;p14EnemySpecial(e,n,now);const def=P14_TYPES[e.type]||P14_TYPES.zombie,dx=n.p.x-e.x,dz=n.p.z-e.z,len=Math.hypot(dx,dz)||1,fx=dx/len,fz=dz/len,sx=-fz,sz=fx;
    let keep=1;if((e.type==='spitter'||e.type==='screamer')&&n.d<8.5)keep=-.72;else if(e.type==='spitter'&&n.d<19)keep=.20;let sway=Math.sin(now*.001*def.freq+e.phase*1.73)*def.sway;if(n.d<4)sway*=.18;
    let rx=fx*keep+sx*sway,rz=fz*keep+sz*sway,rlen=Math.hypot(rx,rz)||1,mul=1;if(now<(e.dashUntil||0)&&e.dashDir){rx=e.dashDir.x;rz=e.dashDir.z;rlen=Math.hypot(rx,rz)||1;mul=e.type==='charger'?3.25:e.type==='dog'?2.45:2.1;}const step=e.speed*mul*dt;let nx=e.x+rx/rlen*step,nz=e.z+rz/rlen*step;
    if(!blocked(nx,nz,.55)){e.x=nx;e.z=nz;}else{const sign=Math.sin(now*.003+e.phase)>0?1:-1;let moved=false;for(const side of [sign,-sign]){nx=e.x+sx*side*step*1.2;nz=e.z+sz*side*step*1.2;if(!blocked(nx,nz,.55)){e.x=nx;e.z=nz;moved=true;break;}}if(!moved){nx=e.x-fx*step*.35;nz=e.z-fz*step*.35;if(!blocked(nx,nz,.55)){e.x=nx;e.z=nz;}}}
    e.visualYaw=Math.atan2(n.p.x-e.x,n.p.z-e.z);const radius=e.type==='fat'?1.28:e.type==='dog'?.95:e.crawler?.84:e.type==='charger'?1.12:e.runner?1.05:.94;if(n.d<radius){const last=damageCooldown.get(n.p.id)||0,cool=e.type==='dog'?.72:e.type==='runner'?.82:e.type==='charger'?.78:1;if(now-last>difficulty().touchCd*1000*cool){damageCooldown.set(n.p.id,now);damagePlayer(n.p.id,`${def.label}の攻撃`);}}
  }
  checkItems();p14MaintainInfiniteHorde(now);
};

/* Non-boss HP rule: fat zombie = 3 bullets, every other infected = one bullet. */
const p14HostHitBase=hostHit;
hostHit=function(id,playerId,weak=false){const e=state.enemies.get(id);if(e&&!e.boss){const required=e.type==='fat'?3:1;if(e.maxHp!==required){e.maxHp=required;e.hp=Math.min(e.hp,required);}}p14HostHitBase(id,playerId,weak);};

/* Continue restarts the current area with three lives rather than forcing AREA 1. */
const p14ResetBase=resetMission;
resetMission=function(){
  if(!p14ContinuePending){p14ResetBase();return;}
  if(state.mode==='coop'&&!isHost()){toast('ホストのコンティニューを待っています');return;}p14ContinuePending=false;state.completed=false;state.localLives=3;state.shield=false;state.adrenalineUntil=0;
  for(const p of state.players.values()){p.lives=3;p.shield=false;p.adr=0;p.inv=0;}if(!state.players.has(state.playerId))state.players.set(state.playerId,{id:state.playerId,x:0,z:0,yaw:0,lives:3,shield:false,adr:0});
  send('area_start',{area:state.area,seed:state.seed,difficulty:state.difficulty,lives:[...state.players.values()].map(p=>[p.id,3])});beginArea(false);toast(`AREA ${state.area+1} からコンティニュー`,1500);
};
failMission=function(reason){if(!isHost())return;state.running=false;p14ContinuePending=true;send('fail',{reason,area:state.area});setOverlay('MISSION FAILED',`${reason}\n現在のAREA ${state.area+1}から再開できます。`,'このエリアからコンティニュー',true);startBtn.disabled=false;};

/* Existing boss silhouettes are already area-specific; add a second strong silhouette layer for instant readability. */
const p14BossMeshBase=createBossMesh;
createBossMesh=function(e){const g=p14BossMeshBase(e),stage=currentStage(),bm=bossMaterial(stage),dark=mat(stage.key==='mountain'?0xaac5cf:stage.key==='river'?0x244d42:stage.key==='sea'?0x153e55:stage.key==='city'?0x242b33:stage.key==='castle'?0x190922:0x32101a,stage.accent,.42,.72,.12);
  if(stage.key==='mansion'){const muzzle=addBossDeco(g,new THREE.BoxGeometry(.72,.42,1.28),bm,0,2.58,-.72);for(const s of[-1,1])for(let i=0;i<3;i++){const c=addBossDeco(g,new THREE.ConeGeometry(.08,.58,5),mat(0xeee3d2),s*(.75+i*.13),1.12,-.52);c.rotation.x=Math.PI/2;}}
  else if(stage.key==='mountain'){for(const s of[-1,1]){addBossDeco(g,new THREE.SphereGeometry(.62,9,7),dark,s*1.02,2.05,0);addBossDeco(g,new THREE.BoxGeometry(.72,.76,.72),bm,s*1.18,.66,-.05);}}
  else if(stage.key==='river'){const jaw=addBossDeco(g,new THREE.BoxGeometry(1.35,.38,1.75),dark,0,2.42,-.85);jaw.rotation.x=.12;const tail=addBossDeco(g,new THREE.ConeGeometry(.32,3.3,7),bm,0,1.12,1.85);tail.rotation.x=Math.PI/2;}
  else if(stage.key==='sea'){for(let i=0;i<6;i++){const a=i/6*Math.PI*2,t=addBossDeco(g,new THREE.CylinderGeometry(.10,.22,2.6,6),dark,Math.cos(a)*1.05,.95,Math.sin(a)*.8);t.rotation.z=Math.cos(a)*.62;t.rotation.x=Math.sin(a)*.62;}}
  else if(stage.key==='city'){const cannon=addBossDeco(g,new THREE.CylinderGeometry(.22,.34,2.4,8),dark,1.35,2.05,-.15);cannon.rotation.x=Math.PI/2;addBossDeco(g,new THREE.BoxGeometry(1.8,.34,1.15),bm,0,3.02,0);}
  else{for(const s of[-1,1]){const wing=addBossDeco(g,new THREE.ConeGeometry(1.5,4.2,6),dark,s*1.65,2.25,.55);wing.rotation.z=s*.88;}addBossDeco(g,new THREE.SphereGeometry(.35,8,6),mat(0xff5a30,0xff2400,2.4),0,3.45,-.25);}
  g.traverse(o=>{o.userData.enemyId='boss';});return g;
};

/* Hide boss HUD as well as geometry/minimap until encounter range. */
updateBossHud=function(){const e=state.enemies.get('boss');if(!e){$('#hud-boss').textContent='---';bossBanner.classList.add('hidden');return;}const dist=Math.hypot(local.x-e.x,local.z-e.z);if(!e.dead&&dist>P13_BOSS_REVEAL){$('#hud-boss').textContent='???';bossBanner.classList.add('hidden');return;}const phase=e.dead?'DOWN':`P${bossPhase(e)} ${e.hp}/${e.maxHp}`;$('#hud-boss').textContent=phase;if(!e.dead&&dist<42){bossNameEl.textContent=currentStage().boss;bossPhaseEl.textContent=`PHASE ${bossPhase(e)} / WEAK POINT ×5`;bossBanner.classList.remove('hidden');}else bossBanner.classList.add('hidden');};

/* Ten-class tactical map colors. */
drawMinimap=function(){if(!minimapCtx||!state.maze)return;const ctx=minimapCtx,m=state.maze,w=minimap.width,h=minimap.height,pad=7,sx=(w-pad*2)/(m.cols*m.cell),sz=(h-pad*2)/(m.rows*m.cell),mapX=x=>pad+(x-m.x0)*sx,mapY=z=>pad+(m.z0-z)*sz;ctx.clearRect(0,0,w,h);ctx.fillStyle='rgba(4,7,9,.90)';ctx.fillRect(0,0,w,h);ctx.strokeStyle='rgba(210,226,232,.22)';ctx.strokeRect(pad,pad,w-pad*2,h-pad*2);for(const item of state.items.values())if(!item.taken){ctx.fillStyle=item.type==='life'?'#ff5577':item.type==='infinite'?'#ffd84b':item.type==='invincible'?'#52dbff':'#ff8739';ctx.fillRect(mapX(item.x)-1.5,mapY(item.z)-1.5,3,3);}let shown=0;for(const e of state.enemies.values()){if(e.dead)continue;if(e.boss){if(Math.hypot(local.x-e.x,local.z-e.z)<=P13_BOSS_REVEAL){ctx.fillStyle='#ff2d5f';ctx.beginPath();ctx.arc(mapX(e.x),mapY(e.z),4.1,0,Math.PI*2);ctx.fill();}continue;}if(shown++>90)continue;const dx=e.x-local.x,dz=e.z-local.z;if(dx*dx+dz*dz>PERF_VISUAL_RANGE*PERF_VISUAL_RANGE*1.5)continue;ctx.fillStyle=`#${(P14_TYPES[e.type]?.color||0xe84958).toString(16).padStart(6,'0')}`;const s=e.type==='fat'?3:2;ctx.fillRect(mapX(e.x)-s/2,mapY(e.z)-s/2,s,s);}if(state.goal){ctx.fillStyle=state.bossGate?'#858996':'#49ff92';ctx.beginPath();ctx.arc(mapX(state.goal.x),mapY(state.goal.z),3.5,0,Math.PI*2);ctx.fill();}for(const p of state.players.values()){ctx.fillStyle=p.id===state.playerId?'#fff':'#ffd85a';ctx.beginPath();ctx.arc(mapX(p.x),mapY(p.z),p.id===state.playerId?3.2:2.7,0,Math.PI*2);ctx.fill();}};
