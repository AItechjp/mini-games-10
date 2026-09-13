/* Small, always-on bars stay above the rendered heads. Only the enemy under the
   crosshair gets HP text; authoritative HP still drives both solo and co-op. */
const lifeCanvas=document.createElement('canvas');lifeCanvas.className='game23-enemy-health';lifeCanvas.setAttribute('aria-label','敵の残りライフ');frame.append(lifeCanvas);
const lifeContext=lifeCanvas.getContext('2d'),lifePoint=new THREE.Vector3(),lifeCoverPoint=new THREE.Vector3(),lifeMatrix=new THREE.Matrix4();
const lifeStats={visible:0,full:0,damaged:0,bosses:0,labels:0};
let lifeWidth=0,lifeHeight=0,lifeScale=0;
function lifeHeadRadius(e){
  const head=e.boss?bossMesh?.getObjectByName('head'):horde?.head;
  if(!head?.visible||(!e.boss&&(!cineVisibility.get(e)?.shown||e.index<0||e.index>=horde.capacity)))return 0;
  if(e.boss)lifeMatrix.copy(head.matrixWorld);
  else{head.getMatrixAt(e.index,lifeMatrix);lifeMatrix.premultiply(head.matrixWorld);}
  if(!head.geometry.boundingSphere)head.geometry.computeBoundingSphere();
  const sphere=head.geometry.boundingSphere;
  lifePoint.copy(sphere.center).applyMatrix4(lifeMatrix).applyMatrix4(camera.matrixWorldInverse);
  // Include helmets and cowls as well as the bosses' horns and crowns.
  let radius=sphere.radius*lifeMatrix.getMaxScaleOnAxis()+(e.boss?currentStage().bossScale*.7:0);
  if(!e.boss)for(const key of ['helmet','cowl']){
    const cover=horde[key];if(!cover?.visible)continue;
    cover.getMatrixAt(e.index,lifeMatrix);lifeMatrix.premultiply(cover.matrixWorld);
    const scale=lifeMatrix.getMaxScaleOnAxis();if(scale<.01)continue;
    if(!cover.geometry.boundingSphere)cover.geometry.computeBoundingSphere();
    const bounds=cover.geometry.boundingSphere;
    lifeCoverPoint.copy(bounds.center).applyMatrix4(lifeMatrix).applyMatrix4(camera.matrixWorldInverse);
    radius=Math.max(radius,lifeCoverPoint.distanceTo(lifePoint)+bounds.radius*scale);
  }
  return radius;
}
function drawEnemyLives(){
  const w=frame.clientWidth,h=frame.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
  if(w!==lifeWidth||h!==lifeHeight||dpr!==lifeScale){lifeWidth=w;lifeHeight=h;lifeScale=dpr;lifeCanvas.width=Math.round(w*dpr);lifeCanvas.height=Math.round(h*dpr);}
  lifeContext.setTransform(dpr,0,0,dpr,0,0);lifeContext.clearRect(0,0,w,h);Object.assign(lifeStats,{visible:0,full:0,damaged:0,bosses:0,labels:0});
  if(!w||!h||!state.running||!overlay.classList.contains('hidden'))return;
  const range=cineQuality==='low'?58:cineMobile?90:125,focus=opsTrace(local,local).enemy;
  const focal=h*.5*camera.projectionMatrix.elements[5];
  for(const e of state.enemies.values()){
    if(e.dead||e.hp<=0||!Number.isFinite(e.hp)||!Number.isFinite(e.maxHp))continue;
    if(e.boss&&!bossMesh?.visible)continue;
    const distance=Math.hypot(e.x-local.x,e.z-local.z);if(!e.boss&&distance>range)continue;
    const heavy=['brute','bloater','fat'].includes(e.type),radius=lifeHeadRadius(e),depth=-lifePoint.z;
    if(!radius||depth<=radius+camera.near||depth>camera.far)continue;
    // Project the upper edge of the head's enclosing sphere, with an 8px gap.
    // Never clamp an offscreen label back down onto the enemy's face.
    const upper=lifePoint.y+radius,headTop=h*.5-focal*upper/(depth+(upper<0?radius:-radius));
    lifePoint.applyMatrix4(camera.projectionMatrix);
    const width=Math.round(clamp(focal*(e.boss?2.4:heavy?.95:.7)/depth,e.boss?36:14,e.boss?88:heavy?48:38)),height=e.boss?4:3;
    const x=Math.round((lifePoint.x*.5+.5)*w),top=Math.floor(headTop-8-height),left=x-width/2;
    if(left<2||left+width>w-2||top<2||top+height>h-2)continue;
    // Leave the crosshair clear even while looking steeply down at a low enemy.
    if(Math.abs(x-w*.5)<width*.5+14&&Math.abs(top-h*.5)<height+14)continue;
    const ratio=clamp(e.hp/Math.max(1,e.maxHp),0,1);
    lifeContext.globalAlpha=e===focus?1:clamp(1-distance/range*.65,.35,.85);
    lifeContext.fillStyle='rgba(8,10,13,.7)';lifeContext.fillRect(left-1,top-1,width+2,height+2);
    lifeContext.fillStyle='#412c2e';lifeContext.fillRect(left,top,width,height);
    lifeContext.fillStyle=e.boss?'#cc744b':heavy?'#c98968':'#d56061';lifeContext.fillRect(left,top,Math.max(1,width*ratio),height);
    if(e===focus&&top>=20){
      lifeContext.textAlign='center';lifeContext.font='600 10px system-ui,sans-serif';lifeContext.lineWidth=2;lifeContext.lineJoin='round';lifeContext.strokeStyle='#080b0fe8';
      const label=`${Math.ceil(e.hp)} / ${Math.ceil(e.maxHp)}`;lifeContext.strokeText(label,x,top-5);lifeContext.fillStyle='#f3eadc';lifeContext.fillText(label,x,top-5);lifeStats.labels++;
    }
    lifeStats.visible++;if(ratio===1)lifeStats.full++;else lifeStats.damaged++;if(e.boss)lifeStats.bosses++;
  }
  lifeContext.globalAlpha=1;
}
const lifeRender=renderer.render;
renderer.render=function(s,c){const before=cineLastDraw,result=lifeRender.call(this,s,c);if(s===scene&&c===camera&&cineLastDraw!==before)drawEnemyLives();return result;};
const scrollRail=document.createElement('div');scrollRail.className='game23-scroll-rail';scrollRail.textContent='↕';scrollRail.setAttribute('aria-label','上下になぞってページをスクロール');frame.append(scrollRail);
const combatFooter=document.createElement('div');combatFooter.className='game23-combat-footer';combatFooter.append(uxAmmoPanel,cineFlashButton);frame.append(combatFooter);
uxExit.textContent='ページへ';uxExit.setAttribute('aria-label','全画面を終了してページへ戻る');
document.querySelector('.game23-page-nav a').addEventListener('click',()=>{if(state.running&&!ops.paused)opsSetPause(true);});
opsChooseWeapon.addEventListener('change',()=>{if(!state.running)cineMakeWeapon();});
// Reading below the game must release held input and pause an unattended battle.
const gameVisibility=new IntersectionObserver(entries=>{if(entries[0].intersectionRatio<.12&&!uxActive()&&state.running&&!ops.paused){opsClearInputs();opsSetPause(true);document.exitPointerLock?.();}},{threshold:[0,.12]});gameVisibility.observe(frame);
Object.defineProperty(window,'blacksitePlayability',{configurable:true,get:()=>({version:'health-visibility-2',scrollable:!uxActive(),enemyLife:{...lifeStats},weapon:{id:cineGun?.userData.weaponId,templates:armoryTemplates.size,meshes:cineGun?.children.filter(o=>o.isMesh).length||0,magazineOffset:cineGun?.userData.parts?.magazine?.position.y||0,cycling:!!cineGun?.userData.parts?.bolt&&cineGun.userData.parts.bolt.position.z>0}})});
