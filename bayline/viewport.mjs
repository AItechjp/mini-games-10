// Native orientation when supported; an in-page rotated viewport otherwise.
// Both paths use the same logical coordinate system for touch, aiming and map taps.
export class GameViewport {
 constructor(root,{onResize=()=>{},onClear=()=>{},notify=()=>{}}={}){
  this.root=root;this.onResize=onResize;this.onClear=onClear;this.notify=notify;
  this.mode='auto';this.rotated=false;this.busy=false;
  this.resize=this.resize.bind(this);this.resize();
  window.addEventListener('resize',this.resize);
  window.visualViewport?.addEventListener('resize',this.resize);
  screen.orientation?.addEventListener?.('change',this.resize);
  document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement){try{screen.orientation?.unlock?.();}catch{}this.mode='auto';}this.resize();});
  document.addEventListener('click',e=>{const b=e.target.closest('[data-orientation]');if(!b)return;e.preventDefault();this.select(b.dataset.orientation);});
 }
 delta(dx,dy){return this.rotated?{x:dy,y:-dx}:{x:dx,y:dy};}
 normalizedPoint(element,x,y){const r=element.getBoundingClientRect();return this.rotated?{x:(y-r.top)/r.height,y:1-(x-r.left)/r.width}:{x:(x-r.left)/r.width,y:(y-r.top)/r.height};}
 resize(){
  const w=Math.max(1,innerWidth),h=Math.max(1,innerHeight);
  const current=w>=h?'landscape':'portrait';
  this.rotated=this.mode!=='auto'&&this.mode!==current;
  this.width=this.rotated?h:w;this.height=this.rotated?w:h;
  const s=this.root.style;s.width=this.width+'px';s.height=this.height+'px';
  s.transform=this.rotated?`translateX(${w}px) rotate(90deg)`:'translateZ(0)';
  s.setProperty('--vw',this.width/100+'px');s.setProperty('--vh',this.height/100+'px');
  this.root.dataset.layout=this.width>=this.height?'landscape':'portrait';
  document.body.classList.toggle('game-rotated',this.rotated);
  const dialog=document.getElementById('panel');
  if(dialog){dialog.style.width=Math.min(900,this.width*.94)+'px';dialog.style.maxHeight=this.height*.88+'px';dialog.style.transform=`translate(-50%,-50%)${this.rotated?' rotate(90deg)':''}`;}
  this.onClear();this.refreshButtons();this.onResize();
 }
 refreshButtons(){
  const next=this.width>=this.height?'portrait':'landscape';
  for(const b of document.querySelectorAll('[data-orientation]')){
   if(b.dataset.orientation==='toggle'){b.textContent=next==='landscape'?'↔ 横画面':'↕ 縦画面';b.setAttribute('aria-label',next==='landscape'?'横画面に切り替える':'縦画面に切り替える');}
   if(b.dataset.orientation==='auto')b.setAttribute('aria-pressed',String(this.mode==='auto'));
   b.disabled=this.busy;
  }
 }
 async select(request){
  if(this.busy)return;
  const mode=request==='toggle'?(this.width>=this.height?'portrait':'landscape'):request;
  if(!['auto','portrait','landscape'].includes(mode))return;
  this.onClear();this.mode=mode;
  if(mode==='auto'){try{screen.orientation?.unlock?.();}catch{}this.resize();this.notify('端末の向きに合わせる表示に戻しました。');return;}
  this.busy=true;this.refreshButtons();let native=false;
  try{
   if(typeof screen.orientation?.lock==='function'){
    if(!document.fullscreenElement&&document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();
    await screen.orientation.lock(mode);native=true;
   }
  }catch{/* Browser policies differ; the local viewport remains fully playable. */}
  finally{this.busy=false;this.resize();}
  this.notify((mode==='landscape'?'横画面':'縦画面')+(native?'に切り替えました。':'表示に切り替えました。端末の回転が非対応のため、ゲーム画面内で切り替えています。'));
 }
}
