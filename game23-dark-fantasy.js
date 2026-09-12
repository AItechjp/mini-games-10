/* Ashen pilgrimage. Shared, instanced architecture; routes and combat stay authoritative. */
const DF_REGIONS=[
  ['灰鐘の聖堂','ASHEN BELFRY'],['凍れる巡礼路','FROZEN PILGRIMAGE'],['忘却の水道橋','AQUEDUCT OF OBLIVION'],
  ['沈黙の葬送港','SILENT MOURNING HARBOR'],['棄てられた王都','FORSAKEN CAPITAL'],['蝕まれた黒城','ECLIPSED CITADEL'],
  ['聖堂地下の納骨廟','OSSUARY BELOW'],['雪葬の修道院','SNOWBOUND MONASTERY'],['涙の地下水路','CHANNEL OF TEARS'],
  ['幽霊船の墓場','GRAVE OF SHIPS'],['赤灰の旧市街','RED ASH QUARTER'],['偽王の玉座','THRONE OF THE PRETENDER'],
  ['最後の鐘楼','THE LAST BELFRY'],['夜明けなき霊峰','SUNLESS SUMMIT'],['聖水の枯れ井戸','WITHERED SACRED WELL'],
  ['灯火の果て','THE LAST BEACON'],['王なき聖都','CITY WITHOUT A KING'],['灰の心臓','HEART OF ASH']
];
const DF_BOSSES=['聖堂の獣侯','霜冠の巨人','溺れた竜司祭','深淵の葬送者','王都の処刑騎士','灰翼の堕王'];
STAGES.forEach((s,i)=>{s.jp=DF_REGIONS[i][0];s.name=DF_REGIONS[i][1];s.boss=`${i<6?'':i<12?'蘇りし ': '終焉の '}${DF_BOSSES[i%6]}`;s.fog=0x222c31;s.accent=i%6===5?0xbf6c36:0xb8ac83;s.luxury=0xc2ab79;});
const DG={};
{
  const a=new THREE.Shape();a.moveTo(-1.4,0);a.lineTo(-1.4,2);a.quadraticCurveTo(-1.3,3.05,0,4);a.quadraticCurveTo(1.3,3.05,1.4,2);a.lineTo(1.4,0);a.lineTo(1.08,0);a.lineTo(1.08,2);a.quadraticCurveTo(.95,2.9,0,3.55);a.quadraticCurveTo(-.95,2.9,-1.08,2);a.lineTo(-1.08,0);a.closePath();
  DG.ogive=cineKeep(new THREE.ExtrudeGeometry(a,{depth:.45,bevelEnabled:true,bevelSize:.045,bevelThickness:.035,bevelSegments:1,curveSegments:12}).translate(0,0,-.225));
  const cape=new THREE.Shape();cape.moveTo(-.40,.43);cape.quadraticCurveTo(-.68,-.20,-.61,-.88);for(let i=0;i<9;i++)cape.lineTo(-.61+i*.15,-.88+(i%2)*.18);cape.quadraticCurveTo(.64,-.2,.4,.43);cape.closePath();
  DG.cape=cineKeep(new THREE.ShapeGeometry(cape,8).translate(0,0,-.25));
  DG.cowl=cineKeep(new THREE.SphereGeometry(.34,16,10,0,Math.PI*2,0,Math.PI*.7).scale(1,1.14,1.04));
  DG.crown=cineMerge([new THREE.TorusGeometry(.31,.045,6,16).rotateX(Math.PI/2),...Array.from({length:7},(_,i)=>{const a=i*Math.PI*2/7;return new THREE.ConeGeometry(.055,.29+(i%2)*.12,6).translate(Math.cos(a)*.30,.13,Math.sin(a)*.30);})]);
  DG.sword=cineMerge([new THREE.BoxGeometry(.13,1.65,.055).translate(0,.48,0),new THREE.ConeGeometry(.075,.27,4).rotateY(Math.PI/4).translate(0,1.43,0),new THREE.BoxGeometry(.52,.08,.09).translate(0,-.35,0),new THREE.CylinderGeometry(.055,.055,.34,8).translate(0,-.53,0)]);
  DG.cloakMaterial=cineSurface(0x706861,.96,0,'fabric');DG.cloakMaterial.side=THREE.DoubleSide;
  DG.iron=cineSurface(0x6b6760,.64,.65,'metal');DG.patina=cineSurface(0x8b7955,.75,.50,'metal');
  DG.wax=cineKeep(new THREE.MeshStandardMaterial({color:0xd2bf8e,roughness:.95}));
}
CM.stone.color.set(0xa6a498);CM.darkStone.color.set(0x646a69);CM.brick.color.set(0x827f70);
CM.paving.color.set(0x888b81);CM.roof.color.set(0x464b4b);CM.moss.color.set(0x464e3f);
CM.cloth.color.set(0x999285);CM.pants.color.set(0x514f4b);CM.leather.color.set(0x34332f);
CM.window.color.set(0x665d46);CM.window.emissive.set(0xb78a4a);CM.window.emissiveIntensity=.42;
CM.eye.emissive.set(0xd38938);CM.eye.emissiveIntensity=1.45;

// Flickering flame geometry uses existing shared point lights: no per-torch lights.
cineLantern=function(x,z,y=2.4){
  cinePlace(CG.cylinder,CM.darkStone,x,y*.42,z,.42,y*.84,.42);
  cinePlace(CG.cylinder,CM.stone,x,.15,z,.85,.3,.85);
  cinePlace(CG.cone,DG.iron,x,y*.84,z,.9,.32,.9,0,Math.PI);
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5;cineBox(DG.iron,x+Math.cos(a)*.30,y*.92,z+Math.sin(a)*.30,.055,.5,.055);}
  cinePlace(CG.sphere,CM.amber,x,y,z,.18,.27,.18);
  cinePlace(CG.cone,CM.amber,x+.035,y+.28,z,.27,.48,.25,0,0,-.12);
  cineLamps.push(new THREE.Vector3(x,y,z));
};
function dfCandles(x,z,seed=0){
  for(let i=0;i<4;i++){const h=.20+((i+seed)%3)*.11,px=x+(i-1.5)*.18,pz=z+(i%2)*.15;cinePlace(CG.cylinder,DG.wax,px,h*.5,pz,.07,h,.07);cinePlace(CG.sphere,CM.amber,px,h+.045,pz,.026,.060,.026);}
}
function dfStatue(x,z,s=1,ry=0){
  cineBox(CM.darkStone,x,.3*s,z,1.9*s,.6*s,1.9*s,ry);
  cinePlace(CA.body,CM.stone,x,1.70*s,z,.95*s,1.25*s,.9*s,ry);
  cinePlace(DG.cowl,CM.darkStone,x,2.6*s,z,.94*s,.94*s,.94*s,ry);
  cinePlace(DG.cape,CM.stone,x,1.85*s,z,1.45*s,1.4*s,1.45*s,ry);
  cinePlace(DG.sword,DG.iron,x,1.28*s,z+.37*s,.8*s,-.8*s,.8*s,ry);
  cineSolid(x,z,1.9*s,1.9*s);
}
function dfTower(x,z,h=20,r=3,broken=false){
  cinePlace(CG.cylinder,CM.darkStone,x,h*.5,z,r*2,h,r*2);
  for(const y of [.35,h*.38,h*.76,h])cinePlace(CG.cylinder,CM.stone,x,y,z,r*2+.45,.26,r*2+.45);
  for(let i=0;i<8;i++){const a=i*Math.PI/4,xx=x+Math.cos(a)*r,zz=z+Math.sin(a)*r;
    cineBox(CM.stone,xx,h*.48,zz,.32,h*.93,.4,a);if(!broken||i%3)cineBox(CM.stone,xx,h+.45,zz,.74,.90,.70,a);
  }
  if(!broken){cinePlace(CG.cone,CM.roof,x,h+4,z,r*2.5,8,r*2.5);cinePlace(CG.cone,DG.iron,x,h+8.7,z,.2,1.6,.2);}
  else for(let i=0;i<4;i++)cinePlace(CG.rock,CM.stone,x+r*Math.sin(i*2),h+.3,z+r*Math.cos(i*2),.85,.52,.8,i);
}
function dfCathedral(x,z,w=18,h=17,d=13,ruined=true){
  const front=z+d/2;
  // Buttressed walls, open lancets, rose tracery and uneven towers form the silhouette.
  cineBox(CM.darkStone,x,h*.42,z,w,h*.84,d);
  cineBox(CM.stone,x,.30,z,w+1,.6,d+1);
  for(const side of [-1,1]){
    dfTower(x+side*w*.43,front-1,h+(side>0?4:0),2.1,ruined&&side<0);
    for(let j=0;j<4;j++){const zz=z-d*.39+j*d*.25;cineBox(CM.stone,x+side*(w*.5+.7),h*.26,zz,.8,h*.53,1.1);cineRod(CM.stone,new THREE.Vector3(x+side*w*.49,h*.75,zz),new THREE.Vector3(x+side*(w*.5+2.5),h*.35,zz),.34);}
  }
  for(let j=-1;j<=1;j++){
    const xx=x+j*w*.19;cinePlace(DG.ogive,CM.stone,xx,h*.42,front+.18,1.08,1.5,1.2);
    cineBox(CM.glass,xx,h*.57,front+.02,2.02,3.55,.11);
    cineBox(DG.patina,xx,h*.57,front+.31,.065,3.45,.08);
  }
  cinePlace(DG.ogive,CM.paleStone,x,0,front+.36,1.8,1.4,2.2);
  cineBox(CM.wood,x,2.15,front+.15,3.65,4.3,.17);
  for(const side of [-1,1])cineBox(DG.iron,x+side*.95,2.1,front+.26,.08,4,.08);
  cinePlace(CG.torus,CM.stone,x,h*.83,front+.18,1.75,1.75,1.0);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;cineRod(CM.stone,new THREE.Vector3(x,h*.83,front+.19),new THREE.Vector3(x+Math.cos(a)*1.65,h*.83+Math.sin(a)*1.65,front+.19),.04);}
  cinePlace(CG.cone,CM.roof,x,h+.5,z,w*.85,5,d*.90,Math.PI/4);
  for(const side of [-1,1]){dfStatue(x+side*w*.29,front+1.1,1.05);cineLantern(x+side*3.1,front+1.7,2.4);}
  if(ruined)for(let j=0;j<5;j++)cinePlace(CG.rock,CM.stone,x-w*.48+j*.75,.3+(j%2)*.2,front+1.7,1.1,.45,.8,j*1.8);
  cineSolid(x,z,w,d);
}
// Replace vehicle-shaped cover without changing its footprint or blocking the route.
v5Wreck=function(x,z,ry=0,s=1){
  cineBox(CM.darkStone,x,.43*s,z,2.6*s,.85*s,3.7*s,ry);
  cineBox(CM.stone,x,.92*s,z,2.85*s,.2*s,3.95*s,ry,0,.045);
  cinePlace(DG.cape,CM.paleStone,x,1.11*s,z,1.25*s,1.5*s,1.0*s,ry,-Math.PI/2);
  cinePlace(CG.rock,CM.stone,x+.5*s,1.06*s,z-.85*s,.38*s,.27*s,.6*s,ry);
  v5Solid(x,z,1.65*s);
};
v5Barricade=function(x,z,ry=0,s=1){
  for(let j=-1;j<=1;j++)cineBox(CM.stone,x+Math.cos(ry)*j*1.2*s,.48*s,z-Math.sin(ry)*j*1.2*s,1.27*s,.85*s,1.3*s,ry,0,j*.13);
  cinePlace(CG.rock,CM.darkStone,x,.88*s,z,.76*s,.35*s,.5*s,ry);
  v5Solid(x,z,1.45*s);
};
v5RuinedArch=function(x,z,ry=0){
  cinePlace(DG.ogive,CM.stone,x,0,z,3.6,2.45,3.3,ry);
  for(const side of [-1,1]){const xx=x+side*5.05*Math.cos(ry),zz=z-side*5.05*Math.sin(ry);cineBox(CM.darkStone,xx,1.35,zz,1.35,2.7,1.35,ry);cinePlace(CG.cone,CM.roof,xx,10.4,zz,1.1,2,1.1,ry);dfCandles(xx,zz+.8);}
};
// Existing city/harbor construction is replaced with religious ruins across all acts.
cineIndustrial=(x,z,w=16,h=18)=>dfCathedral(x,z,w,h,12,true);
cineCrane=(x,z,side=1)=>{dfTower(x,z,24,2.5,true);cinePlace(DG.ogive,CM.darkStone,x-side*6,5,z,4,3,2);};
cineManor=(x,z,w=20,h=16,d=13)=>dfCathedral(x,z,w,h,d,true);
const dfWorldBase=cineBuildWorld;
cineBuildWorld=function(stage,rand){
  dfWorldBase(stage,rand);
  const cold=stage.key==='mountain',act=Math.floor(state.area/6);
  for(let i=0;i<10;i++){
    const p=v5RouteAt((i+.25)/11),q=v5RouteAt((i+.35)/11),side=i%2?1:-1,a=v5SidePoint(p,q,side,11+rand()*3);
    if(i%3===0){dfStatue(a.x,a.z,1.3,Math.atan2(p.x-a.x,p.z-a.z));dfCandles(a.x,a.z+1.5,i);}
    else if(i%3===1){cinePlace(DG.ogive,CM.stone,a.x,-.1,a.z,1.5,2.2,1.5,a.ry,0,.07);for(let j=0;j<4;j++)cinePlace(CG.tomb,CM.stone,a.x+side*j*1.3,0,a.z+j*.9,.8,1.2,.8,a.ry);}
    else cinePlace(CG.cylinder,CM.stone,a.x,1.05,a.z,1.4,6,1.4,a.ry,0,1.3);
  }
  // Distant layered skyline. Outside playable navigation, culled in the existing 48 m chunks.
  for(let i=0;i<7;i++){const p=v5RouteAt(i/7),side=i%2?1:-1;dfTower(p.x+side*(65+i%3*9),p.z-25,28+(i%3)*11,3.8,i%2===0);}
  if(cold){const p=v5RouteAt(.5);dfCathedral(p.x+38,p.z,22,25,14);}
  cineFlush();
  // Remove the rectangular emissive city signs left by the base biome layout.
  for(const mesh of cineChunks)if(mesh.material===CM.red)mesh.visible=false;
  frame.dataset.world='ashen-pilgrimage';frame.dataset.act=String(act+1);
};
decorateMansion=decorateMountain=decorateRiver=decorateSea=decorateCity=decorateCastle=cineBuildWorld;
const dfArenaBase=buildBossArena;
buildBossArena=function(stage){
  const z=dfArenaBase(stage);
  for(const side of [-1,1])for(let i=0;i<4;i++){
    const x=side*18,zz=z-12+i*8;
    cinePlace(DG.ogive,CM.darkStone,x,0,zz,2.4,3.4,2.1,Math.PI/2);
    if(i%2===0){dfStatue(x-side*2,zz,1.8,side*Math.PI/2);cineLantern(x-side*4,zz,2.5);}
  }
  cinePlace(DG.ogive,CM.paleStone,0,0,z-17,4.1,4.3,3.3);
  cineFlush();return z;
};
const dfEnvironmentBase=buildEnvironment;
buildEnvironment=function(){
  const arena=dfEnvironmentBase(),act=Math.floor(state.area/6),cold=currentStage().key==='mountain';
  const fog=cold?0x53616a:[0x293237,0x2b2d35,0x342c2b][act];
  if(cineSky)cineSky.material.uniforms.uTint.value.setHex([0x182632,0x202536,0x332926][act]);
  if(scene.fog){scene.fog.color.setHex(fog);scene.fog.density=cold?.0065:.008;}
  scene.environmentIntensity=.30;
  for(const l of scene.children)if(l.isHemisphereLight){l.color.set(0x9fb4c6);l.groundColor.set(0x3a3025);l.intensity=.87;}
  if(cineMoonLight){cineMoonLight.color.setHex([0xb5c9de,0xb9bad4,0xd6c7b1][act]);cineMoonLight.intensity=cold?2.1:1.85;}
  cineLampLights.forEach(l=>{l.color.setHex(0xffbb71);l.intensity=24;});
  renderer.toneMappingExposure=1.16; // Preserve target and route readability in dark scenery.
  return arena;
};

// Tattered tabards, cowls and blackened plate stay in the existing instanced horde.
cineHordeSpec.body[1]=DG.cloakMaterial;cineHordeSpec.shoulders[1]=DG.iron;
cineHordeSpec.v5Armor[1]=DG.iron;cineHordeSpec.helmet[0]=DG.cowl;cineHordeSpec.helmet[1]=DG.cloakMaterial;
cineHordeSpec.tabard=[DG.cape,DG.cloakMaterial];cineHordeKeys.push('tabard');
const dfHordeBase=updateHordeVisuals;
updateHordeVisuals=function(now){
  const before=cineVisualAt;dfHordeBase(now);if(!horde?.tabard||cineVisualAt===before)return;
  for(const e of state.enemies.values()){
    if(e.boss||e.index<0||e.index>=horde.capacity)continue;
    const i=e.index,visible=cineVisibility.get(e)?.shown,quad=['crawler','hound','stalker'].includes(e.type);
    if(!visible||e.dead||quad){hideInst(horde.tabard,i);continue;}
    Object.assign(cinePose,{x:e.x,z:e.z,visualYaw:e.visualYaw||0});
    const heavy=['brute','bloater'].includes(e.type),s=heavy?1.32:1;
    setInst(horde.tabard,i,cinePose,0,1.34*s,-.07,.07+Math.sin(now*.002+(e.phase||0))*.025,0,0,s,s,s);
    if(!['armored','brute','bloater'].includes(e.type)&&i%3===0)setInst(horde.helmet,i,cinePose,0,2.09,.08,.10,0,0,1,1,1);
    if(e.type==='walker'&&i%4===1)setInst(horde.v5Armor,i,cinePose,0,1.4,.23,.1,0,0,.93,1.25,1);
  }
  horde.tabard.instanceMatrix.needsUpdate=true;horde.helmet.instanceMatrix.needsUpdate=true;horde.v5Armor.instanceMatrix.needsUpdate=true;
};
const dfBossBase=createBossMesh;
createBossMesh=function(e){
  const g=dfBossBase(e),kind=currentStage().key;
  cineBossPart(g,DG.crown,DG.patina,0,3.04,.07,1.85,1.45,1.75,'ashen-crown');
  cineBossPart(g,DG.cape,DG.cloakMaterial,0,1.81,-.13,2.5,2.15,1.5,'ashen-mantle');
  for(const side of [-1,1])cineBossPart(g,CA.armor,DG.iron,side*.51,1.77,.22,1.1,1.5,1.8);
  if(kind==='city')cineBossPart(g,DG.sword,DG.iron,1.16,1.35,.7,1.9,-1.9,1.9,'executioner-sword');
  return g;
};

// Quiet, user-mutable wind, low choir tones and a distant bell, started by a gesture.
let dfAudio=null,dfSoundEnabled=true,dfBellAt=0;
try{dfSoundEnabled=localStorage.getItem('blacksite.ambience')!=='off';}catch{}
const dfSoundButton=document.createElement('button');dfSoundButton.type='button';dfSoundButton.className='df-sound';
function dfSoundLabel(){dfSoundButton.textContent=`環境音：${dfSoundEnabled?'入':'切'}`;dfSoundButton.setAttribute('aria-pressed',String(dfSoundEnabled));}
dfSoundLabel();document.querySelector('.outbreak-toolbar')?.append(dfSoundButton);
const dfSoundMenu=document.createElement('button');dfSoundMenu.type='button';dfSoundMenu.className='df-sound df-sound-menu';dfSoundMenu.textContent='環境音';dfSoundMenu.setAttribute('aria-label','環境音を切り替える');dfSoundMenu.setAttribute('aria-pressed',String(dfSoundEnabled));overlay.querySelector('.overlay-card').append(dfSoundMenu);dfSoundMenu.addEventListener('click',()=>dfSoundButton.click());
function dfStartAmbience(){
  if(!dfSoundEnabled)return;
  try{
    if(!dfAudio){
      const AudioClass=window.AudioContext||window.webkitAudioContext;if(!AudioClass)return;
      const ctx=new AudioClass(),master=ctx.createGain();master.gain.value=0;master.connect(ctx.destination);
      for(const [f,level] of [[55,.024],[82.41,.016],[110.12,.011],[130.81,.007]]){
        const osc=ctx.createOscillator(),g=ctx.createGain();osc.type='sine';osc.frequency.value=f;g.gain.value=level;osc.connect(g).connect(master);osc.start();
      }
      const buffer=ctx.createBuffer(1,ctx.sampleRate*3,ctx.sampleRate),data=buffer.getChannelData(0);
      let last=0;for(let i=0;i<data.length;i++){last=(last+.025*(Math.random()*2-1))/1.025;data[i]=last*.6;}
      const wind=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),windGain=ctx.createGain();wind.buffer=buffer;wind.loop=true;filter.type='lowpass';filter.frequency.value=650;windGain.gain.value=.14;wind.connect(filter).connect(windGain).connect(master);wind.start();
      dfAudio={ctx,master};
    }
    if(dfAudio.ctx.state==='suspended')dfAudio.ctx.resume().catch(()=>{});
  }catch{}
}
dfSoundButton.addEventListener('click',()=>{dfSoundEnabled=!dfSoundEnabled;try{localStorage.setItem('blacksite.ambience',dfSoundEnabled?'on':'off');}catch{}dfSoundLabel();dfSoundMenu.setAttribute('aria-pressed',String(dfSoundEnabled));if(dfSoundEnabled)dfStartAmbience();else if(dfAudio)dfAudio.master.gain.setTargetAtTime(0,dfAudio.ctx.currentTime,.08);});
startBtn.addEventListener('click',dfStartAmbience);
const dfSoundTimer=setInterval(()=>{
  if(!dfAudio)return;const {ctx,master}=dfAudio,playing=dfSoundEnabled&&state.running&&!document.hidden&&overlay.classList.contains('hidden');
  master.gain.setTargetAtTime(playing?.65:0,ctx.currentTime,.35);
  if(playing&&ctx.currentTime>dfBellAt){
    dfBellAt=ctx.currentTime+20+state.area%6;
    for(const [ratio,volume] of [[1,.025],[2.76,.007],[5.4,.002]]){
      const o=ctx.createOscillator(),g=ctx.createGain(),t=ctx.currentTime;o.frequency.value=103.83*ratio;g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(volume,t+.025);g.gain.exponentialRampToValueAtTime(.0001,t+7);o.connect(g).connect(master);o.start(t);o.stop(t+7.1);o.onended=()=>{o.disconnect();g.disconnect();};
    }
  }
},300);
document.addEventListener('visibilitychange',()=>{if(document.hidden&&dfAudio)dfAudio.master.gain.setTargetAtTime(0,dfAudio.ctx.currentTime,.03);});
addEventListener('pagehide',()=>{clearInterval(dfSoundTimer);dfAudio?.ctx.close().catch(()=>{});});
