/* GAME 23 — full page scrolling while not in native/fullscreen mode */
const p19ScrollStyle=document.createElement('style');
p19ScrollStyle.textContent=`
html,body{overflow-y:auto!important;overscroll-behavior-y:auto!important}
body:not(.game23-focus-mode){touch-action:pan-y!important}
@media(pointer:coarse){
 body.game23-playing:not(.game23-focus-mode) .game23-frame,
 body.game23-playing:not(.game23-focus-mode) #game23-canvas{touch-action:pan-y!important}
 body.game23-playing:not(.game23-focus-mode) .touch-zone{touch-action:pan-y!important}
 body.game23-playing:not(.game23-focus-mode) .touch-fire,
 body.game23-playing:not(.game23-focus-mode) .ux-reload{touch-action:manipulation!important}
 .p19-scroll-down{position:absolute;z-index:55;left:50%;bottom:8px;transform:translateX(-50%);border:1px solid rgba(255,255,255,.28);border-radius:999px;background:rgba(3,8,9,.78);color:#fff;padding:7px 12px;font-size:.62rem;font-weight:900;letter-spacing:.04em;backdrop-filter:blur(7px);touch-action:manipulation}
 body.game23-focus-mode .p19-scroll-down{display:none!important}
}
`;
document.head.appendChild(p19ScrollStyle);

const p19ScrollButton=document.createElement('button');
p19ScrollButton.type='button';p19ScrollButton.className='p19-scroll-down';p19ScrollButton.textContent='↓ ページ下へ';p19ScrollButton.setAttribute('aria-label','ゲーム画面より下へスクロール');frame.appendChild(p19ScrollButton);
p19ScrollButton.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();const below=frame.getBoundingClientRect().bottom+window.scrollY+18;window.scrollTo({top:below,behavior:'smooth'});});

/* Child MOVE/LOOK handlers call preventDefault immediately. Detect a clear vertical
   gesture first in frame capture and convert it to page scrolling manually. */
let p19Gesture=null;
function p19NormalMode(){return uxTouch&&document.body.classList.contains('game23-playing')&&!document.body.classList.contains('game23-focus-mode')&&!document.fullscreenElement;}
function p19CancelGamePointer(id){
  if(leftTouch===id){try{touchLeft.releasePointerCapture?.(id);}catch{}leftTouch=null;try{uxJoyReset();}catch{touchMove.x=0;touchMove.y=0;}}
  if(rightTouch===id){try{touchRight.releasePointerCapture?.(id);}catch{}rightTouch=null;lastRight=null;uxLookX=uxLookY=0;touchRight.classList.remove('active');}
}
frame.addEventListener('pointerdown',e=>{
  if(!p19NormalMode()||e.pointerType!=='touch'||e.target.closest?.('button'))return;
  p19Gesture={id:e.pointerId,startX:e.clientX,startY:e.clientY,lastY:e.clientY,scrolling:false};
},{capture:true});
frame.addEventListener('pointermove',e=>{
  const g=p19Gesture;if(!g||g.id!==e.pointerId||!p19NormalMode())return;
  const dx=e.clientX-g.startX,dy=e.clientY-g.startY;
  if(!g.scrolling&&Math.abs(dy)>10&&Math.abs(dy)>Math.abs(dx)*1.12){g.scrolling=true;p19CancelGamePointer(e.pointerId);}
  if(!g.scrolling)return;
  const delta=g.lastY-e.clientY;g.lastY=e.clientY;
  if(Math.abs(delta)>.2)window.scrollBy(0,delta);
  e.preventDefault();e.stopImmediatePropagation();
},{capture:true,passive:false});
function p19GestureEnd(e){if(p19Gesture?.id!==e.pointerId)return;if(p19Gesture.scrolling){e.preventDefault();e.stopImmediatePropagation();}p19Gesture=null;}
frame.addEventListener('pointerup',p19GestureEnd,{capture:true,passive:false});
frame.addEventListener('pointercancel',p19GestureEnd,{capture:true,passive:false});

/* Never leave the document locked after a normal start/restart. */
const p19BeginAreaBase=beginArea;
beginArea=function(fromStart=true){
  if(!document.fullscreenElement){document.body.classList.remove('game23-focus-mode');document.body.style.overflow='';document.documentElement.style.overflow='';}
  return p19BeginAreaBase(fromStart);
};
