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
touchRight.addEventListener('pointermove',e=>{if(e.pointerId!==rightTouch||!lastRight)return;e.preventDefault();e.stopImmediatePropagation();const dx=clamp(e.clientX-lastRight.x,-42,42),dy=clamp(e.clientY-lastRight.y,-36,36);uxLookX=uxLookX*.25+dx*.75;uxLookY=uxLookY*.25+dy*.75;local.yaw-=uxLookX*.00335;local.pitch=clamp(local.pitch-uxLookY*.00265,-1.05,1.02);lastRight={x:e.clientX,y:e.clientY};},{capture:true});
function uxRightEnd(e){if(e.pointerId!==rightTouch)return;e.stopImmediatePropagation();rightTouch=null;lastRight=null;uxLookX=uxLookY=0;touchRight.classList.remove('active');}
touchRight.addEventListener('pointerup',uxRightEnd,{capture:true});touchRight.addEventListener('pointercancel',uxRightEnd,{capture:true});touchRight.addEventListener('lostpointercapture',uxRightEnd,{capture:true});

const uxFire=$('#touch-fire');
function uxFireStop(e){if(e&&uxFirePointer!==null&&e.pointerId!==uxFirePointer)return;e?.stopImmediatePropagation?.();uxFirePointer=null;if(uxFireTimer){clearInterval(uxFireTimer);uxFireTimer=0;}uxFire.classList.remove('firing');}
uxFire.addEventListener('pointerdown',e=>{e.preventDefault();e.stopImmediatePropagation();if(uxFirePointer!==null)return;uxFirePointer=e.pointerId;uxFire.setPointerCapture?.(e.pointerId);uxFire.classList.add('firing');shoot();uxFireTimer=setInterval(()=>{if(state.running)shoot();},130);},{capture:true});
uxFire.addEventListener('pointerup',uxFireStop,{capture:true});uxFire.addEventListener('pointercancel',uxFireStop,{capture:true});uxFire.addEventListener('lostpointercapture',uxFireStop,{capture:true});

document.addEventListener('mousemove',e=>{if(!pointerLocked||!state.running)return;e.stopImmediatePropagation();local.yaw-=clamp(e.movementX,-80,80)*.00185;local.pitch=clamp(local.pitch-clamp(e.movementY,-70,70)*.00155,-1.08,1.04);},{capture:true});
frame.addEventListener('contextmenu',e=>{if(uxTouch)e.preventDefault();},{capture:true});