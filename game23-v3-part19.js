/* GAME 23 — safe page scrolling without stealing game pointer events */
const p19ScrollStyle=document.createElement('style');
p19ScrollStyle.textContent=`
html,body{overflow-y:auto!important;overscroll-behavior-y:auto!important}
body:not(.game23-focus-mode){touch-action:pan-y!important}
.p19-scroll-down,.p19-scroll-strip{display:none}
@media(pointer:coarse){
 body.game23-playing:not(.game23-focus-mode) .game23-frame{touch-action:pan-y!important}
 body.game23-playing:not(.game23-focus-mode) .touch-left,
 body.game23-playing:not(.game23-focus-mode) .touch-right{height:68%!important;top:auto!important;bottom:0!important;touch-action:none!important}
 body.game23-playing:not(.game23-focus-mode) .touch-fire,
 body.game23-playing:not(.game23-focus-mode) .ux-reload{touch-action:manipulation!important}
 .p19-scroll-strip{display:block;position:absolute;z-index:54;left:0;right:0;top:0;height:29%;pointer-events:auto;touch-action:pan-y!important;background:transparent}
 .p19-scroll-strip:after{content:'ここを上下スワイプでページ移動';position:absolute;left:50%;top:7px;transform:translateX(-50%);padding:4px 9px;border-radius:999px;background:rgba(0,0,0,.48);color:rgba(255,255,255,.78);font-size:.52rem;font-weight:900;letter-spacing:.03em;pointer-events:none;white-space:nowrap}
 .p19-scroll-down{display:block;position:absolute;z-index:55;left:50%;bottom:8px;transform:translateX(-50%);border:1px solid rgba(255,255,255,.28);border-radius:999px;background:rgba(3,8,9,.82);color:#fff;padding:7px 12px;font-size:.62rem;font-weight:900;letter-spacing:.04em;backdrop-filter:blur(7px);touch-action:manipulation}
 body.game23-focus-mode .p19-scroll-strip,
 body.game23-focus-mode .p19-scroll-down{display:none!important}
}
`;
document.head.appendChild(p19ScrollStyle);

const p19ScrollStrip=document.createElement('div');
p19ScrollStrip.className='p19-scroll-strip';
p19ScrollStrip.setAttribute('aria-hidden','true');
frame.appendChild(p19ScrollStrip);

const p19ScrollButton=document.createElement('button');
p19ScrollButton.type='button';p19ScrollButton.className='p19-scroll-down';
p19ScrollButton.textContent='↓ ページ下へ';
p19ScrollButton.setAttribute('aria-label','ゲーム画面より下へスクロール');
frame.appendChild(p19ScrollButton);
p19ScrollButton.addEventListener('click',e=>{
  e.preventDefault();e.stopPropagation();
  const below=frame.getBoundingClientRect().bottom+window.scrollY+18;
  window.scrollTo({top:below,behavior:'smooth'});
});

/* Keep normal play scrollable, but do not intercept pointerdown/move/up. */
const p19BeginAreaBase=beginArea;
beginArea=function(fromStart=true){
  if(!document.fullscreenElement){
    document.body.classList.remove('game23-focus-mode');
    document.body.style.overflow='';document.body.style.overscrollBehavior='';
    document.documentElement.style.overflow='';document.documentElement.style.overscrollBehavior='';
  }
  return p19BeginAreaBase(fromStart);
};
