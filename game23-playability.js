/* Always-on enemy life bars share one lightweight 2D overlay. Nothing depends on
   aiming at an enemy or damaging it; authoritative HP drives solo and co-op. */
const lifeCanvas=document.createElement('canvas');lifeCanvas.className='game23-enemy-health';lifeCanvas.setAttribute('aria-label','敵の残りライフ');frame.append(lifeCanvas);
const lifeContext=lifeCanvas.getContext('2d'),lifePoint=new THREE.Vector3();
const lifeStats={visible:0,full:0,damaged:0,bosses:0};
let lifeWidth=0,lifeHeight=0,lifeScale=0;
function drawEnemyLives(){
  const w=frame.clientWidth,h=frame.clientHeight,dpr=Math.min(devicePixelRatio||1,2);
  if(w!==lifeWidth||h!==lifeHeight||dpr!==lifeScale){lifeWidth=w;lifeHeight=h;lifeScale=dpr;lifeCanvas.width=Math.round(w*dpr);lifeCanvas.height=Math.round(h*dpr);}
  lifeContext.setTransform(dpr,0,0,dpr,0,0);lifeContext.clearRect(0,0,w,h);Object.assign(lifeStats,{visible:0,full:0,damaged:0,bosses:0});
  if(!state.running||!overlay.classList.contains('hidden'))return;
  const range=cineQuality==='low'?58:cineMobile?90:125;
  for(const e of state.enemies.values()){
    if(e.dead||e.hp<=0||!Number.isFinite(e.hp)||!Number.isFinite(e.maxHp))continue;
    if(e.boss&&!bossMesh?.visible)continue;
    const distance=Math.hypot(e.x-local.x,e.z-local.z);if(!e.boss&&distance>range)continue;
    const type=e.type||'walker',heavy=['brute','bloater','fat'].includes(type),quad=['crawler','hound','stalker','dog','licker'].includes(type);
    const y=e.boss?currentStage().bossScale*3.4:quad?(type==='hound'?1.12:1.32):heavy?3.45:2.64;
    lifePoint.set(e.x,y,e.z).project(camera);
    if(lifePoint.z<-1||lifePoint.z>1||Math.abs(lifePoint.x)>1.03||Math.abs(lifePoint.y)>1.05)continue;
    const width=e.boss?116:heavy?72:distance>38?42:54,height=e.boss?7:5;
    const x=clamp((lifePoint.x*.5+.5)*w,width/2+3,w-width/2-3),top=clamp((.5-lifePoint.y*.5)*h,22,h-12),left=x-width/2;
    const ratio=clamp(e.hp/Math.max(1,e.maxHp),0,1);
    lifeContext.fillStyle='rgba(8,10,13,.94)';lifeContext.fillRect(left-2,top-2,width+4,height+4);
    lifeContext.fillStyle='#412c2e';lifeContext.fillRect(left,top,width,height);
    lifeContext.fillStyle=e.boss?'#cc744b':heavy?'#c98968':'#d56061';lifeContext.fillRect(left,top,Math.max(1,width*ratio),height);
    lifeContext.fillStyle='#f4c4a280';lifeContext.fillRect(left,top,Math.max(1,width*ratio),1);
    lifeContext.textAlign='center';lifeContext.font=`600 ${e.boss?13:11}px system-ui,sans-serif`;lifeContext.lineWidth=3;lifeContext.lineJoin='round';lifeContext.strokeStyle='#080b0fe8';
    const label=`${Math.ceil(e.hp)} / ${Math.ceil(e.maxHp)}`;lifeContext.strokeText(label,x,top-5);lifeContext.fillStyle='#f3eadc';lifeContext.fillText(label,x,top-5);
    lifeStats.visible++;if(ratio===1)lifeStats.full++;else lifeStats.damaged++;if(e.boss)lifeStats.bosses++;
  }
}
const lifeRender=renderer.render;
renderer.render=function(s,c){const before=cineLastDraw,result=lifeRender.call(this,s,c);if(s===scene&&c===camera&&cineLastDraw!==before)drawEnemyLives();return result;};
const scrollRail=document.createElement('div');scrollRail.className='game23-scroll-rail';scrollRail.textContent='↕';scrollRail.setAttribute('aria-label','上下になぞってページをスクロール');frame.append(scrollRail);
uxExit.textContent='ページへ';uxExit.setAttribute('aria-label','全画面を終了してページへ戻る');
document.querySelector('.game23-page-nav a').addEventListener('click',()=>{if(state.running&&!ops.paused)opsSetPause(true);});
opsChooseWeapon.addEventListener('change',()=>{if(!state.running)cineMakeWeapon();});
// Reading below the game must release held input and pause an unattended battle.
const gameVisibility=new IntersectionObserver(entries=>{if(entries[0].intersectionRatio<.12&&!uxActive()&&state.running&&!ops.paused){opsClearInputs();opsSetPause(true);document.exitPointerLock?.();}},{threshold:[0,.12]});gameVisibility.observe(frame);
Object.defineProperty(window,'blacksitePlayability',{configurable:true,get:()=>({version:'armory-1',scrollable:!uxActive(),enemyLife:{...lifeStats},weapon:{id:cineGun?.userData.weaponId,templates:armoryTemplates.size,meshes:cineGun?.children.filter(o=>o.isMesh).length||0,magazineOffset:cineGun?.userData.parts?.magazine?.position.y||0,cycling:!!cineGun?.userData.parts?.bolt&&cineGun.userData.parts.bolt.position.z>0}})});
