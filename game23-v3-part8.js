/* GAME 23 ULTIMATE — immersive controls override */
const uxShell=frame.closest('.outbreak-shell')||frame;
const uxFullscreen=$('#outbreak-fullscreen');
const uxTouch=matchMedia('(pointer:coarse)').matches||(navigator.maxTouchPoints||0)>0;
let uxFallback=false,uxNativeRequested=false,uxFireTimer=0,uxFirePointer=null,uxLookX=0,uxLookY=0;

const uxRotate=document.createElement('div');
uxRotate.className='orientation-hint hidden';
uxRotate.innerHTML='<strong>横向きでプレイ</strong><span>端末を90°回転してください</span>';
frame.appendChild(uxRotate);
const uxExit=document.createElement('button');
uxExit.type='button';uxExit.className='game23-exit';uxExit.textContent='×';uxExit.setAttribute('aria-label','ゲーム全画面を終了');frame.appendChild(uxExit);
const uxKnob=document.createElement('div');uxKnob.className='touch-knob';touchStick.appendChild(uxKnob);

const uxCombatStyle=document.createElement('style');
uxCombatStyle.textContent=`
.ux-ammo-panel{position:absolute;z-index:30;right:20px;bottom:126px;display:grid;grid-template-columns:auto auto;gap:6px 9px;align-items:center;padding:9px 10px;border:1px solid rgba(255,255,255,.18);border-radius:13px;background:rgba(4,8,10,.78);backdrop-filter:blur(8px);box-shadow:0 10px 30px rgba(0,0,0,.34);pointer-events:auto;min-width:112px}.ux-ammo-label{grid-column:1/-1;color:#91a19c;font-size:.54rem;font-weight:900;letter-spacing:.15em}.ux-ammo-count{font-size:1.18rem;font-weight:1000;letter-spacing:.04em;color:#f5fbf7;line-height:1}.ux-ammo-count b{color:#75ffad}.ux-reload{min-width:58px;border:1px solid rgba(255,255,255,.22);border-radius:9px;background:#18201e;color:#fff;padding:8px 7px;font-size:.65rem;font-weight:1000;letter-spacing:.06em;touch-action:manipulation}.ux-reload:not(:disabled){border-color:#ffb347;background:#7f390d;box-shadow:0 0 20px rgba(255,135,41,.22)}.ux-reload:disabled{opacity:.42}.ux-ammo-panel.empty{border-color:#ff4055;box-shadow:0 0 26px rgba(255,40,65,.3);animation:uxAmmoPulse .58s ease-in-out infinite alternate}.ux-ammo-panel.empty .ux-ammo-count{color:#ff6376}.ux-ammo-panel.reloading .ux-ammo-count{color:#ffd56a}@keyframes uxAmmoPulse{from{filter:brightness(.92)}to{filter:brightness(1.3)}}
@media(pointer:coarse){.ux-ammo-panel{right:max(20px,calc(env(safe-area-inset-right) + 12px));bottom:max(136px,calc(env(safe-area-inset-bottom) + 126px));min-width:118px;padding:9px 10px}.ux-reload{min-width:62px;padding:9px 8px}.ux-ammo-count{font-size:1.24rem}}
`;
document.head.appendChild(uxCombatStyle);
const uxAmmoPanel=document.createElement('div');uxAmmoPanel.className='ux-ammo-panel';
uxAmmoPanel.innerHTML='<span class="ux-ammo-label">MAGAZINE</span><span class="ux-ammo-count"><b>50</b> / 50</span><button class="ux-reload" type="button" aria-label="リロード">RELOAD</button>';
frame.appendChild(uxAmmoPanel);
const uxAmmoCount=uxAmmoPanel.querySelector('.ux-ammo-count');
const uxReloadBtn=uxAmmoPanel.querySelector('.ux-reload');
let uxAmmo=50,uxReloading=false,uxReloadTimer=0,uxKickAnim=null,uxEmptyToastAt=0;

function uxUpdateAmmo(){
  uxAmmoCount.innerHTML=`<b>${uxAmmo}</b> / 50`;
  uxAmmoPanel.classList.toggle('empty',uxAmmo===0&&!uxReloading);
  uxAmmoPanel.classList.toggle('reloading',uxReloading);
  uxReloadBtn.disabled=uxReloading||uxAmmo===50||!state.running;
  uxReloadBtn.textContent=uxReloading?'LOADING…':'RELOAD';
}
function uxResetAmmo(){clearTimeout(uxReloadTimer);uxReloadTimer=0;uxAmmo=50;uxReloading=false;uxUpdateAmmo();}
function uxReload(){
  if(!state.running||uxReloading||uxAmmo===50)return;
  uxReloading=true;uxUpdateAmmo();toast('RELOADING…',720);
  uxReloadTimer=setTimeout(()=>{uxReloadTimer=0;if(!state.running){uxReloading=false;uxUpdateAmmo();return;}uxAmmo=50;uxReloading=false;uxUpdateAmmo();toast('MAGAZINE 50 / 50',520);},900);
}
function uxWeaponKick(){
  try{uxKickAnim?.cancel?.();}catch{}
  const rx=(Math.random()-.5)*.8,dx=(Math.random()-.5)*5.5,dy=2.5+Math.random()*3.5;
  try{uxKickAnim=canvas.animate([{transform:'translate3d(0,0,0) scale(1.002)'},{transform:`translate3d(${dx}px,${dy}px,0) scale(1.009) rotate(${rx}deg)`},{transform:'translate3d(0,0,0) scale(1.002)'}],{duration:105,easing:'cubic-bezier(.2,.8,.25,1)'});}catch{}
}
const uxBaseShoot=shoot;
shoot=function(){
  if(!state.running||state.localLives<=0)return;
  if(uxReloading)return;
  if(uxAmmo<=0){const now=performance.now();if(now-uxEmptyToastAt>650){uxEmptyToastAt=now;toast('EMPTY — RELOAD REQUIRED',600);}uxUpdateAmmo();return;}
  uxAmmo--;uxUpdateAmmo();uxWeaponKick();uxBaseShoot();
};
const uxBaseBeginArea=beginArea;
beginArea=function(fromStart=true){if(fromStart||state.area===0)uxResetAmmo();return uxBaseBeginArea(fromStart);};
uxReloadBtn.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();uxReload();});
addEventListener('keydown',e=>{if(e.code==='KeyR'){e.preventDefault();uxReload();}},{capture:true});
uxUpdateAmmo();

function uxActive(){return !!document.fullscreenElement||document.body.classList.contains('game23-focus-mode');}
function uxOrientationHint(){uxRotate.classList.toggle('hidden',!(uxTouch&&uxActive()&&innerHeight>innerWidth));}
function uxLockLandscape(){if(!uxTouch)return;try{const p=screen.orientation?.lock?.('landscape');p?.catch?.(()=>{});}catch{}}
function uxRestoreScroll(){
  document.body.classList.remove('game23-focus-mode');
  document.body.style.overflow='';document.body.style.overscrollBehavior='';
  document.documentElement.style.overflow='';document.documentElement.style.overscrollBehavior='';
  uxFallback=false;uxOrientationHint();
  requestAnimationFrame(()=>{try{window.scrollBy(0,0);}catch{}setTimeout(resize,30);});
}
function uxEnter(nativeFullscreen=false){
  document.body.classList.add('game23-focus-mode');uxFallback=true;uxNativeRequested=!!nativeFullscreen;uxOrientationHint();
  /* Touch devices default to CSS immersive mode. This avoids Chrome's persistent
     Fullscreen API notice. Native fullscreen is only requested by the explicit button. */
  if(nativeFullscreen){
    try{
      if(!document.fullscreenElement&&uxShell.requestFullscreen){
        const p=uxShell.requestFullscreen({navigationUI:'hide'});
        Promise.resolve(p).then(()=>{uxFallback=false;uxLockLandscape();uxOrientationHint();setTimeout(resize,50);}).catch(()=>{uxFallback=true;uxOrientationHint();});
      }else uxLockLandscape();
    }catch{}
  }
  setTimeout(resize,50);
}
async function uxLeave(){
  try{if(document.fullscreenElement)await document.exitFullscreen();}catch{}
  try{screen.orientation?.unlock?.();}catch{}
  uxNativeRequested=false;uxRestoreScroll();
}
function uxLabels(){
  uxFullscreen.textContent=uxTouch?'Chrome全画面':'全画面';
  if(uxTouch&&!state.running&&state.mode==='solo'&&!startBtn.disabled)startBtn.textContent='横向きで開始';
}
uxLabels();
startBtn.addEventListener('click',()=>{uxEnter(false);setTimeout(uxLabels,0);},{capture:true});
uxFullscreen.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();if(document.fullscreenElement)uxLeave();else uxEnter(true);},{capture:true});
uxExit.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();uxLeave();});
$('#mode-solo').addEventListener('click',()=>setTimeout(uxLabels,0),{capture:true});
$('#mode-coop').addEventListener('click',()=>setTimeout(uxLabels,0),{capture:true});
document.addEventListener('fullscreenchange',()=>{
  if(document.fullscreenElement){document.body.classList.add('game23-focus-mode');uxFallback=false;}
  else if(uxNativeRequested){uxNativeRequested=false;uxRestoreScroll();try{screen.orientation?.unlock?.();}catch{}}
  uxOrientationHint();setTimeout(resize,50);
});
addEventListener('resize',uxOrientationHint,{passive:true});try{screen.orientation?.addEventListener?.('change',uxOrientationHint);}catch{}
addEventListener('pagehide',uxRestoreScroll);addEventListener('beforeunload',uxRestoreScroll);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&!state.running&&!document.fullscreenElement)uxRestoreScroll();});

function uxJoyCenter(){const r=touchStick.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,r:Math.max(38,r.width*.39)};}
function uxJoyApply(e){
  const c=uxJoyCenter(),dx=e.clientX-c.x,dy=e.clientY-c.y,mag=Math.hypot(dx,dy),lim=c.r,clamped=Math.min(mag,lim),nx=mag?dx/mag:0,ny=mag?dy/mag:0;
  const raw=clamped/lim,dead=.12,power=raw<=dead?0:Math.pow((raw-dead)/(1-dead),.84);
  touchMove.x=nx*power;touchMove.y=ny*power;uxKnob.style.transform=`translate(${nx*clamped}px,${ny*clamped}px)`;touchStick.classList.toggle('active',power>.01);
}
function uxJoyReset(){touchMove.x=0;touchMove.y=0;uxKnob.style.transform='translate(0,0)';touchStick.classList.remove('active');}
touchLeft.addEventListener('pointerdown',e=>{if(leftTouch!==null)return;e.preventDefault();e.stopImmediatePropagation();leftTouch=e.pointerId;touchLeft.setPointerCapture(e.pointerId);uxJoyApply(e);},{capture:true});
touchLeft.addEventListener('pointermove',e=>{if(e.pointerId!==leftTouch)return;e.preventDefault();e.stopImmediatePropagation();uxJoyApply(e);},{capture:true});
function uxLeftEnd(e){if(e.pointerId!==leftTouch)return;e.stopImmediatePropagation();leftTouch=null;uxJoyReset();}
touchLeft.addEventListener('pointerup',uxLeftEnd,{capture:true});touchLeft.addEventListener('pointercancel',uxLeftEnd,{capture:true});touchLeft.addEventListener('lostpointercapture',uxLeftEnd,{capture:true});

touchRight.addEventListener('pointerdown',e=>{if(rightTouch!==null)return;e.preventDefault();e.stopImmediatePropagation();rightTouch=e.pointerId;lastRight={x:e.clientX,y:e.clientY};uxLookX=uxLookY=0;touchRight.setPointerCapture(e.pointerId);touchRight.classList.add('active');},{capture:true});
touchRight.addEventListener('pointermove',e=>{if(e.pointerId!==rightTouch||!lastRight)return;e.preventDefault();e.stopImmediatePropagation();const dx=clamp(e.clientX-lastRight.x,-42,42),dy=clamp(e.clientY-lastRight.y,-36,36);uxLookX=uxLookX*.25+dx*.75;uxLookY=uxLookY*.25+dy*.75;local.yaw-=uxLookX*.0067;local.pitch=clamp(local.pitch-uxLookY*.0053,-1.05,1.02);lastRight={x:e.clientX,y:e.clientY};},{capture:true});
function uxRightEnd(e){if(e.pointerId!==rightTouch)return;e.stopImmediatePropagation();rightTouch=null;lastRight=null;uxLookX=uxLookY=0;touchRight.classList.remove('active');}
touchRight.addEventListener('pointerup',uxRightEnd,{capture:true});touchRight.addEventListener('pointercancel',uxRightEnd,{capture:true});touchRight.addEventListener('lostpointercapture',uxRightEnd,{capture:true});

const uxFire=$('#touch-fire');
function uxFireStop(e){if(e&&uxFirePointer!==null&&e.pointerId!==uxFirePointer)return;e?.stopImmediatePropagation?.();uxFirePointer=null;if(uxFireTimer){clearInterval(uxFireTimer);uxFireTimer=0;}uxFire.classList.remove('firing');}
uxFire.addEventListener('pointerdown',e=>{e.preventDefault();e.stopImmediatePropagation();if(uxFirePointer!==null)return;uxFirePointer=e.pointerId;uxFire.setPointerCapture?.(e.pointerId);uxFire.classList.add('firing');shoot();uxFireTimer=setInterval(()=>{if(state.running)shoot();},130);},{capture:true});
uxFire.addEventListener('pointerup',uxFireStop,{capture:true});uxFire.addEventListener('pointercancel',uxFireStop,{capture:true});uxFire.addEventListener('lostpointercapture',uxFireStop,{capture:true});

document.addEventListener('mousemove',e=>{if(!pointerLocked||!state.running)return;e.stopImmediatePropagation();local.yaw-=clamp(e.movementX,-80,80)*.0037;local.pitch=clamp(local.pitch-clamp(e.movementY,-70,70)*.0031,-1.08,1.04);},{capture:true});
frame.addEventListener('contextmenu',e=>{if(uxTouch)e.preventDefault();},{capture:true});

/* Camera-relative movement fix: joystick/WASD now follow the view direction exactly.
   Up = forward, down = back, left = left, right = right at every yaw angle. */
updateLocal=function(dt){
  if(!state.running||state.localLives<=0)return;
  let forward=(keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0)-touchMove.y;
  let strafe=(keys.has('KeyD')?1:0)-(keys.has('KeyA')?1:0)+touchMove.x;
  const mag=Math.hypot(forward,strafe);if(mag>1){forward/=mag;strafe/=mag;}
  const boost=performance.now()<state.adrenalineUntil?1.35:1,sp=difficulty().speed*boost;
  const sx=Math.sin(local.yaw),cz=Math.cos(local.yaw);
  const dx=(-sx*forward+cz*strafe)*sp*dt;
  const dz=(-cz*forward-sx*strafe)*sp*dt;
  if(!blocked(local.x+dx,local.z,.68))local.x+=dx;
  if(!blocked(local.x,local.z+dz,.68))local.z+=dz;
  updateCamera();
  const me=state.players.get(state.playerId)||{};
  Object.assign(me,{id:state.playerId,x:local.x,z:local.z,yaw:local.yaw,lives:state.localLives,shield:state.shield,adr:state.adrenalineUntil});
  state.players.set(state.playerId,me);
};