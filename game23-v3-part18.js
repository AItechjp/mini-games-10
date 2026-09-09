/* GAME 23 — normal play remains page-scrollable; native fullscreen is optional */
const p18BaseUxEnter=uxEnter;
uxEnter=function(nativeFullscreen=false){
  if(nativeFullscreen)return p18BaseUxEnter(true);
  uxNativeRequested=false;uxFallback=false;
  document.body.classList.add('game23-playing');
  document.body.classList.remove('game23-focus-mode');
  document.body.style.overflow='';document.body.style.overscrollBehavior='';
  document.documentElement.style.overflow='';document.documentElement.style.overscrollBehavior='';
  uxOrientationHint();setTimeout(resize,40);
};
const p18BaseBeginArea=beginArea;
beginArea=function(fromStart=true){
  document.body.classList.add('game23-playing');
  if(!document.fullscreenElement){document.body.classList.remove('game23-focus-mode');document.body.style.overflow='';document.documentElement.style.overflow='';}
  return p18BaseBeginArea(fromStart);
};
const p18Style=document.createElement('style');
p18Style.textContent=`
html,body{overscroll-behavior-y:auto!important}
body.game23-focus-mode{overscroll-behavior:none!important}
@media(pointer:coarse){
 body.game23-playing:not(.game23-focus-mode) .touch-zone,
 body.game23-playing:not(.game23-focus-mode) .touch-fire{pointer-events:auto!important}
 body.game23-playing:not(.game23-focus-mode) .touch-left,
 body.game23-playing:not(.game23-focus-mode) .touch-right{height:70%!important;top:auto!important;bottom:0!important}
 body.game23-playing:not(.game23-focus-mode) .game23-frame{touch-action:pan-y!important}
 body.game23-playing:not(.game23-focus-mode) .game23-frame:after{content:'上部をスワイプでページ移動';position:absolute;z-index:18;left:50%;top:6px;transform:translateX(-50%);padding:4px 9px;border-radius:999px;background:rgba(0,0,0,.5);color:rgba(255,255,255,.72);font-size:.52rem;font-weight:800;letter-spacing:.04em;pointer-events:none}
 body.game23-focus-mode .game23-frame:after{display:none!important}
}
`;
document.head.appendChild(p18Style);
try{uxLabels=function(){uxFullscreen.textContent=uxTouch?'Chrome全画面':'全画面';if(uxTouch&&!state.running&&state.mode==='solo'&&!startBtn.disabled)startBtn.textContent='開始';};uxLabels();}catch{}
