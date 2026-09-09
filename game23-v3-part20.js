/* GAME 23 ULTIMATE — fullscreen-only gameplay + procedural combat soundscape */
const fs20Style=document.createElement('style');
fs20Style.textContent=`
body.game23-fullscreen-only{overflow:hidden!important;overscroll-behavior:none!important;background:#020304!important}
body.game23-fullscreen-only .site-header,body.game23-fullscreen-only .mode-switch-bar,body.game23-fullscreen-only .outbreak-hero,body.game23-fullscreen-only .outbreak-toolbar,body.game23-fullscreen-only .item-legend,body.game23-fullscreen-only .mission-strip,body.game23-fullscreen-only .outbreak-note,body.game23-fullscreen-only footer{display:none!important}
body.game23-fullscreen-only .outbreak-wrap,body.game23-fullscreen-only #mission,body.game23-fullscreen-only .outbreak-panel,body.game23-fullscreen-only .outbreak-shell{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;max-width:none!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;background:#020304!important}
body.game23-fullscreen-only .game23-frame{position:fixed!important;inset:0!important;width:100vw!important;height:100dvh!important;max-width:none!important;min-height:100dvh!important;margin:0!important;border:0!important;border-radius:0!important;box-shadow:none!important}
body.game23-fullscreen-only .game23-exit,body.game23-fullscreen-only #outbreak-fullscreen{display:none!important}
.fs20-sound{position:absolute;z-index:90;right:max(12px,calc(env(safe-area-inset-right) + 10px));top:max(12px,calc(env(safe-area-inset-top) + 10px));border:1px solid rgba(255,255,255,.24);border-radius:999px;background:rgba(3,7,9,.76);color:#f4fbff;padding:8px 11px;font:900 .62rem/1 system-ui,sans-serif;letter-spacing:.08em;backdrop-filter:blur(8px);box-shadow:0 8px 24px rgba(0,0,0,.28);touch-action:manipulation;pointer-events:auto}
.fs20-sound.off{opacity:.62;color:#9ca8ad}
@media(pointer:coarse){.fs20-sound{padding:9px 12px;font-size:.64rem}}
`;
document.head.appendChild(fs20Style);

const fs20SoundBtn=document.createElement('button');
fs20SoundBtn.type='button';fs20SoundBtn.className='fs20-sound';fs20SoundBtn.textContent='SOUND ON';fs20SoundBtn.setAttribute('aria-label','サウンド切替');frame.appendChild(fs20SoundBtn);

let fs20Audio=null,fs20Master=null,fs20Muted=false,fs20NoiseBuffer=null,fs20Drone=null,fs20Wind=null,fs20WindGain=null,fs20AmbientStarted=false,fs20LastGrowl=0,fs20LastBossRoar=0,fs20HadNative=false;
function fs20AudioReady(){
  if(fs20Audio)return fs20Audio;
  const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return null;
  try{
    fs20Audio=new AC();fs20Master=fs20Audio.createGain();fs20Master.gain.value=fs20Muted?0:.72;fs20Master.connect(fs20Audio.destination);
    fs20NoiseBuffer=fs20Audio.createBuffer(1,Math.max(1,fs20Audio.sampleRate*1.4),fs20Audio.sampleRate);
    const d=fs20NoiseBuffer.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=(Math.random()*2-1)*(.72+Math.random()*.28);
  }catch{fs20Audio=null;fs20Master=null;}
  return fs20Audio;
}
function fs20ResumeAudio(){const a=fs20AudioReady();try{a?.resume?.();}catch{}if(a&&!fs20AmbientStarted)fs20StartAmbient();}
function fs20Gain(value,when=0){if(!fs20Audio||!fs20Master)return null;const g=fs20Audio.createGain();g.gain.setValueAtTime(Math.max(.0001,value),fs20Audio.currentTime+when);g.connect(fs20Master);return g;}
function fs20Osc(freq,type='sine',gain=.05,dur=.12,slide=1,delay=0){
  if(!fs20Audio||!fs20Master||fs20Muted)return;const t=fs20Audio.currentTime+delay,o=fs20Audio.createOscillator(),g=fs20Audio.createGain();o.type=type;o.frequency.setValueAtTime(Math.max(20,freq),t);o.frequency.exponentialRampToValueAtTime(Math.max(20,freq*slide),t+dur);g.gain.setValueAtTime(Math.max(.0001,gain),t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);o.connect(g);g.connect(fs20Master);o.start(t);o.stop(t+dur+.03);
}
function fs20Noise(gain=.08,dur=.08,low=120,high=5200,delay=0){
  if(!fs20Audio||!fs20Master||!fs20NoiseBuffer||fs20Muted)return;const t=fs20Audio.currentTime+delay,s=fs20Audio.createBufferSource(),f=fs20Audio.createBiquadFilter(),g=fs20Audio.createGain();s.buffer=fs20NoiseBuffer;f.type='bandpass';f.frequency.value=(low+high)*.5;f.Q.value=.55;g.gain.setValueAtTime(Math.max(.0001,gain),t);g.gain.exponentialRampToValueAtTime(.0001,t+dur);s.connect(f);f.connect(g);g.connect(fs20Master);s.start(t);s.stop(t+dur+.03);
}
function fs20Gun(){fs20Noise(.14,.055,180,5200);fs20Osc(96,'square',.065,.065,.48);fs20Osc(210,'triangle',.026,.045,.62,.006);}
function fs20Launcher(){fs20Noise(.23,.22,45,1800);fs20Osc(52,'sawtooth',.16,.34,.32);fs20Osc(105,'square',.06,.18,.45,.02);}
function fs20Dry(){fs20Osc(610,'square',.025,.035,.72);fs20Osc(330,'square',.016,.028,.8,.045);}
function fs20ReloadSound(){fs20Osc(820,'square',.028,.035,1.25);fs20Osc(430,'triangle',.03,.05,.72,.19);fs20Noise(.025,.045,900,4600,.20);fs20Osc(980,'square',.032,.035,.75,.72);}
function fs20Damage(){fs20Noise(.16,.11,45,850);fs20Osc(72,'sine',.13,.22,.55);fs20Osc(155,'sawtooth',.035,.16,.62);}
function fs20Pickup(){[440,660,880,1180].forEach((f,i)=>fs20Osc(f,'sine',.035,.11,1.04,i*.055));}
function fs20BossOpen(){fs20Noise(.13,.42,30,700);fs20Osc(44,'sawtooth',.12,.55,.52);fs20Osc(78,'sine',.08,.48,.62,.05);}
function fs20AreaClear(){[330,440,554,660,880].forEach((f,i)=>fs20Osc(f,'triangle',.046,.18,1.02,i*.075));}
function fs20Complete(){[262,330,392,523,659,784].forEach((f,i)=>fs20Osc(f,i<3?'triangle':'sine',.048,.28,1.01,i*.09));}
function fs20Fail(){[220,174,130,82].forEach((f,i)=>fs20Osc(f,'sawtooth',.048,.28,.72,i*.12));}
function fs20Growl(strength=.5,boss=false){const base=boss?38:54+Math.random()*22;fs20Noise((boss?.12:.045)*strength,boss?.4:.20,30,boss?520:900);fs20Osc(base,'sawtooth',(boss?.1:.035)*strength,boss?.52:.24,.62);if(!boss)fs20Osc(base*1.73,'triangle',.018*strength,.18,.7,.03);}
function fs20StartAmbient(){
  if(!fs20Audio||!fs20Master||fs20AmbientStarted)return;fs20AmbientStarted=true;
  try{
    const t=fs20Audio.currentTime;fs20Drone=fs20Audio.createOscillator();const dg=fs20Audio.createGain();fs20Drone.type='sine';fs20Drone.frequency.value=42;dg.gain.value=.012;fs20Drone.connect(dg);dg.connect(fs20Master);fs20Drone.start(t);
    fs20Wind=fs20Audio.createBufferSource();fs20Wind.buffer=fs20NoiseBuffer;fs20Wind.loop=true;const filter=fs20Audio.createBiquadFilter();filter.type='lowpass';filter.frequency.value=520;fs20WindGain=fs20Audio.createGain();fs20WindGain.gain.value=.012;fs20Wind.connect(filter);filter.connect(fs20WindGain);fs20WindGain.connect(fs20Master);fs20Wind.start(t);
  }catch{}
}
function fs20AmbientTick(){
  if(!fs20Audio||!fs20Master)return;const active=state.running&&!fs20Muted;try{if(fs20WindGain)fs20WindGain.gain.setTargetAtTime(active?.013:.0001,fs20Audio.currentTime,.35);if(fs20Drone){const stage=state.area||0;fs20Drone.frequency.setTargetAtTime([42,47,45,39,51,36][stage]||42,fs20Audio.currentTime,.7);}}catch{}
  if(!active)return;let nearest=Infinity,bossDist=Infinity,nearType='';for(const e of state.enemies.values()){if(e.dead)continue;const d=Math.hypot(e.x-local.x,e.z-local.z);if(e.boss)bossDist=Math.min(bossDist,d);else if(d<nearest){nearest=d;nearType=e.type||'';}}
  const now=performance.now();if(bossDist<34&&now-fs20LastBossRoar>6200){fs20LastBossRoar=now;fs20Growl(Math.max(.45,1-bossDist/45),true);}else if(nearest<14&&now-fs20LastGrowl>2400+Math.random()*2600){fs20LastGrowl=now;const bonus=nearType==='dog'?.25:nearType==='licker'?.18:nearType==='fat'?.35:0;fs20Growl(Math.min(1,Math.max(.3,1-nearest/18)+bonus),false);}
}
setInterval(fs20AmbientTick,850);

fs20SoundBtn.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();fs20ResumeAudio();fs20Muted=!fs20Muted;try{if(fs20Master)fs20Master.gain.setTargetAtTime(fs20Muted?0:.72,fs20Audio.currentTime,.035);}catch{}fs20SoundBtn.classList.toggle('off',fs20Muted);fs20SoundBtn.textContent=fs20Muted?'SOUND OFF':'SOUND ON';});

function fs20EnterFullscreen(){
  document.body.classList.add('game23-fullscreen-only','game23-focus-mode');
  fs20ResumeAudio();
  try{uxEnter(true);}catch{
    try{if(!document.fullscreenElement&&uxShell?.requestFullscreen){const p=uxShell.requestFullscreen({navigationUI:'hide'});Promise.resolve(p).catch(()=>{});}}catch{}
  }
  try{screen.orientation?.lock?.('landscape')?.catch?.(()=>{});}catch{}
  setTimeout(()=>{document.body.classList.add('game23-fullscreen-only','game23-focus-mode');resize();},80);
}
startBtn.addEventListener('click',()=>{if(!startBtn.disabled)fs20EnterFullscreen();},{capture:true});

document.addEventListener('fullscreenchange',()=>{
  if(document.fullscreenElement){fs20HadNative=true;document.body.classList.add('game23-fullscreen-only','game23-focus-mode');}
  else if(fs20HadNative&&document.body.classList.contains('game23-fullscreen-only')){requestAnimationFrame(()=>{document.body.classList.add('game23-focus-mode');resize();});}
});

try{uxExit.style.display='none';uxFullscreen.style.display='none';}catch{}
if(state.mode==='solo'&&!startBtn.disabled)startBtn.textContent='全画面で開始';

const fs20BaseShoot=shoot;
shoot=function(){
  const can=state.running&&state.localLives>0,now=performance.now(),launcherBefore=typeof expansionLauncherShots==='number'?expansionLauncherShots:0,ammoBefore=typeof uxAmmo==='number'?uxAmmo:0,reloading=typeof uxReloading==='boolean'?uxReloading:false,infinite=typeof expansionInfiniteUntil==='number'&&expansionInfiniteUntil>now;
  fs20BaseShoot();
  if(!can)return;const launcherAfter=typeof expansionLauncherShots==='number'?expansionLauncherShots:launcherBefore,ammoAfter=typeof uxAmmo==='number'?uxAmmo:ammoBefore;
  if(launcherAfter<launcherBefore)fs20Launcher();else if(ammoAfter<ammoBefore||infinite)fs20Gun();else if(!reloading&&ammoBefore<=0)fs20Dry();
};

try{
  const fs20BaseReload=uxReload;
  uxReload=function(){const before=uxReloading;fs20BaseReload();if(!before&&uxReloading)fs20ReloadSound();};
}catch{}

const fs20BaseFlashDamage=flashDamage;
flashDamage=function(reason){fs20Damage();return fs20BaseFlashDamage(reason);};

const fs20BaseApplyItem=applyItemToPlayer;
applyItemToPlayer=function(item,p){const was=item?.taken;const out=fs20BaseApplyItem(item,p);if(!was&&item?.taken&&p?.id===state.playerId)fs20Pickup();return out;};

const fs20BaseRemoveBossGate=removeBossGate;
removeBossGate=function(){const had=!!state.bossGate;const out=fs20BaseRemoveBossGate();if(had&&!state.bossGate)fs20BossOpen();return out;};

const fs20BaseClearArea=clearArea;
clearArea=function(){const was=state.running;const out=fs20BaseClearArea();if(was)fs20AreaClear();return out;};
const fs20BaseCompleteMission=completeMission;
completeMission=function(){fs20Complete();return fs20BaseCompleteMission();};
const fs20BaseFailMission=failMission;
failMission=function(reason){if(state.running)fs20Fail();return fs20BaseFailMission(reason);};

const fs20BaseNetwork=onNetwork;
onNetwork=function(m){
  const localTarget=m?.target===state.playerId,guestAreaClear=m?.kind==='area_clear'&&state.role==='guest',guestComplete=m?.kind==='complete'&&state.role==='guest',guestFail=m?.kind==='fail'&&state.role==='guest',pickup=(m?.kind==='item'||m?.kind==='power_item')&&localTarget;
  const out=fs20BaseNetwork(m);
  if(pickup)fs20Pickup();if(guestAreaClear)fs20AreaClear();if(guestComplete)fs20Complete();if(guestFail)fs20Fail();return out;
};

/* Keep gameplay viewport-only even if native fullscreen is unavailable or the browser UI reappears. */
const fs20BaseBeginArea=beginArea;
beginArea=function(fromStart=true){document.body.classList.add('game23-fullscreen-only','game23-focus-mode');fs20ResumeAudio();return fs20BaseBeginArea(fromStart);};
