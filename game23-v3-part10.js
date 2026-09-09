/* GAME 23 ULTIMATE — open world scenery, Japanese power UI, infected textures */
const owInvincibleDamage=damagePlayer;
damagePlayer=function(id,reason='DAMAGE'){if(id===state.playerId&&expansionInvincibleUntil>performance.now()){toast('完全無敵',260);return;}owInvincibleDamage(id,reason);};

const OW_STAGE_CONFIG=[
  {cols:19,rows:56,cell:6.2},
  {cols:21,rows:62,cell:6.4},
  {cols:21,rows:66,cell:6.3},
  {cols:23,rows:68,cell:6.4},
  {cols:23,rows:72,cell:6.1},
  {cols:21,rows:76,cell:6.2}
];
STAGES.forEach((s,i)=>Object.assign(s,OW_STAGE_CONFIG[i],{loops:1}));

const owStyle=document.createElement('style');
owStyle.textContent=`
.ux-power-panel strong,.ux-power-panel span,.item-status{font-family:system-ui,-apple-system,"Noto Sans JP",sans-serif}
.ow-scenery-note{position:absolute;left:50%;top:68px;transform:translateX(-50%);z-index:22;padding:5px 11px;border:1px solid rgba(255,255,255,.14);border-radius:999px;background:rgba(5,10,14,.55);backdrop-filter:blur(7px);color:#e7f3ee;font-size:.56rem;font-weight:900;letter-spacing:.08em;pointer-events:none;opacity:.88}
@media(max-width:820px){.ow-scenery-note{top:58px;font-size:.5rem;padding:4px 8px}}
`;
document.head.appendChild(owStyle);
const owNote=document.createElement('div');owNote.className='ow-scenery-note';owNote.textContent='広域探索エリア / 景観ルート';frame.appendChild(owNote);

Object.assign(EXP_ITEMS.life,{label:'救急スプレー',short:'ライフ +1'});
Object.assign(EXP_ITEMS.infinite,{label:'無限弾薬',short:'無限弾薬 30秒'});
Object.assign(EXP_ITEMS.invincible,{label:'完全防護薬',short:'無敵 30秒'});
Object.assign(EXP_ITEMS.launcher,{label:'ロケットランチャー',short:'ランチャー 10発'});

const owBaseToast=toast;
toast=function(msg,ms=1450){
  let t=String(msg)
    .replaceAll('∞ AMMO','無限弾薬').replaceAll('INVINCIBLE','完全無敵').replaceAll('LAUNCHER','ランチャー')
    .replaceAll('INFECTED HOUND','感染犬').replaceAll('BRUTE ZOMBIE','デブゾンビ').replaceAll('LICKER','リッカー')
    .replaceAll('ENDED','終了').replaceAll('DROPPED!','が出現！').replaceAll('DOWN','撃破');
  return owBaseToast(t,ms);
};
function owTranslatePowerText(){
  if(expansionPowerPanel){let h=expansionPowerPanel.innerHTML;h=h.replaceAll('DROP','撃破').replaceAll('∞ AMMO','無限弾薬').replaceAll('INVINCIBLE','完全無敵').replaceAll('LAUNCHER','ランチャー');if(h!==expansionPowerPanel.innerHTML)expansionPowerPanel.innerHTML=h;}
  if(itemStatus){let t=itemStatus.textContent||'';t=t.replaceAll('NO POWER','強化なし').replaceAll('∞ AMMO','無限弾薬').replaceAll('INVINCIBLE','完全無敵').replaceAll('LAUNCHER','ランチャー');if(t!==itemStatus.textContent)itemStatus.textContent=t;}
}
new MutationObserver(owTranslatePowerText).observe(expansionPowerPanel,{childList:true,subtree:true,characterData:true});
new MutationObserver(owTranslatePowerText).observe(itemStatus,{childList:true,subtree:true,characterData:true});
if(expansionLegend)expansionLegend.innerHTML=`
  <div><b class="item-dot life"></b><strong>救急スプレー</strong><span>ライフ+1</span></div>
  <div><b class="item-dot infinite"></b><strong>無限弾薬</strong><span>30秒 弾数無限</span></div>
  <div><b class="item-dot invincible"></b><strong>完全防護薬</strong><span>30秒 完全無敵</span></div>
  <div><b class="item-dot launcher"></b><strong>ロケットランチャー</strong><span>30秒 / 10発 / 広範囲×3</span></div>`;

expansionApplyLocalPower=function(type,duration=EXP_POWER_DURATION,shots=EXP_LAUNCHER_SHOTS,lives=null){
  const now=performance.now();
  if(type==='life'){
    if(lives!=null){state.localLives=lives;const p=state.players.get(state.playerId)||{id:state.playerId};p.lives=lives;state.players.set(state.playerId,p);}
    toast('救急スプレー — ライフ +1',1100);updateHud();
  }
  if(type==='infinite'){expansionInfiniteUntil=Math.max(expansionInfiniteUntil,now+duration);toast('無限弾薬 — 30秒',1300);}
  if(type==='invincible'){expansionInvincibleUntil=Math.max(expansionInvincibleUntil,now+duration);toast('完全防護薬 — 30秒無敵',1300);}
  if(type==='launcher'){expansionLauncherUntil=now+duration;expansionLauncherShots=shots;expansionLauncherNextShot=0;toast('ロケットランチャー — 10発 / 30秒',1500);}
};

expansionSpawnDrop=function(e){
  const types=['life','infinite','invincible','launcher'],type=types[(Math.floor(expansionKillCount/EXP_DROP_EVERY)-1)%types.length],id=`drop${expansionKillCount}_${expansionDropSeq++}`,x=e.x,z=e.z,mesh=expansionItemMesh(type,x,z);
  state.items.set(id,{id,type,x,z,taken:false,mesh});toast(`${EXP_ITEMS[type].label} が出現！`,1250);sendWorld(true);
};
expansionRegisterKill=function(e){
  if(!e||e.boss||e._expCounted)return;e._expCounted=true;expansionKillCount++;
  if(e.type==='dog')toast('感染犬を撃破',340);else if(e.type==='licker')toast('リッカーを撃破',340);else if(e.type==='fat')toast('デブゾンビを撃破',400);
  if(expansionKillCount%EXP_DROP_EVERY===0)expansionSpawnDrop(e);
};
expansionPowerHud=function(){
  const now=performance.now(),inf=Math.max(0,Math.ceil((expansionInfiniteUntil-now)/1000)),inv=Math.max(0,Math.ceil((expansionInvincibleUntil-now)/1000)),lan=Math.max(0,Math.ceil((expansionLauncherUntil-now)/1000)),toDrop=EXP_DROP_EVERY-(expansionKillCount%EXP_DROP_EVERY||0);let active=[];
  if(inf)active.push(`無限弾薬 ${inf}秒`);if(inv)active.push(`完全無敵 ${inv}秒`);if(lan&&expansionLauncherShots>0)active.push(`ランチャー ${expansionLauncherShots}発 / ${lan}秒`);
  expansionPowerPanel.innerHTML=`<strong>撃破 ${expansionKillCount%EXP_DROP_EVERY} / ${EXP_DROP_EVERY} <b>あと${toDrop}体</b></strong><span>${active.length?active.join('  •  '):'20体撃破ごとに強化アイテム'}</span>`;expansionPowerPanel.classList.toggle('hot',active.length>0);
  frame.classList.toggle('exp-infinite',inf>0);frame.classList.toggle('exp-invincible',inv>0);frame.classList.toggle('exp-launcher',lan>0&&expansionLauncherShots>0);
  const me=state.players.get(state.playerId);if(me&&inv)me.inv=performance.now()+Math.min(250,inv*1000);
  if(lan&&expansionLauncherShots>0){uxAmmoCount.innerHTML=`<b>RPG ${expansionLauncherShots}</b> / 10`;uxReloadBtn.disabled=true;}else if(inf){uxAmmoCount.innerHTML='<b>∞</b> / ∞';uxReloadBtn.disabled=true;}else uxUpdateAmmo();
  if(!inf&&expansionInfiniteUntil&&now>=expansionInfiniteUntil){expansionInfiniteUntil=0;toast('無限弾薬 終了',500);}if(!inv&&expansionInvincibleUntil&&now>=expansionInvincibleUntil){expansionInvincibleUntil=0;toast('完全無敵 終了',500);}if(!lan&&expansionLauncherUntil&&now>=expansionLauncherUntil){expansionLauncherUntil=0;expansionLauncherShots=0;toast('ロケットランチャー 終了',500);}
  itemStatus.textContent=active.length?active.join(' / '):'強化なし';
};

makeMaze=function(stage,seed){
  const cols=stage.cols,rows=stage.rows,cell=stage.cell,rand=mulberry32(seed^0x74c19e21);
  const cells=Array.from({length:rows},()=>Array.from({length:cols},()=>({w:[0,0,0,0],seen:true})));
  return {cols,rows,cell,cells,x0:-cols*cell/2,z0:20,rand};
};
renderMazeWalls=function(){};

function owTexture(kind,base,detail,blood){
  const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d'),rand=mulberry32(hashCode(kind)^0x91a7f3);
  x.fillStyle=base;x.fillRect(0,0,512,512);
  for(let i=0;i<1100;i++){const v=30+Math.floor(rand()*90),a=.025+rand()*.055;x.fillStyle=`rgba(${v},${v+(kind==='skin'?10:0)},${v},${a})`;x.fillRect(rand()*512,rand()*512,1+rand()*6,1+rand()*5);}
  for(let i=0;i<90;i++){const px=rand()*512,py=rand()*512,r=4+rand()*28;x.fillStyle=detail;x.globalAlpha=.035+rand()*.13;x.beginPath();x.ellipse(px,py,r,r*(.35+rand()),rand()*Math.PI,0,Math.PI*2);x.fill();}
  x.globalAlpha=1;
  if(blood){for(let i=0;i<34;i++){const px=rand()*512,py=rand()*512,r=3+rand()*20;x.fillStyle=`rgba(${110+Math.floor(rand()*70)},${5+Math.floor(rand()*20)},${8+Math.floor(rand()*16)},${.22+rand()*.48})`;x.beginPath();x.arc(px,py,r,0,Math.PI*2);x.fill();for(let k=0;k<3;k++)x.fillRect(px+(rand()-.5)*r*3,py+(rand()-.5)*r*3,1+rand()*3,4+rand()*18);}}
  if(kind==='skin')for(let i=0;i<24;i++){x.strokeStyle=`rgba(55,20,24,${.20+rand()*.35})`;x.lineWidth=1+rand()*3;x.beginPath();let px=rand()*512,py=rand()*512;x.moveTo(px,py);for(let k=0;k<4;k++){px+=(rand()-.5)*36;py+=12+rand()*30;x.lineTo(px,py);}x.stroke();}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(kind==='skin'?1.35:1.9,kind==='skin'?1.5:2.4);t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy?.()||1);return t;
}
const owSkinTex=owTexture('skin','#6e7566','rgba(42,68,43,.55)',true);
const owSkinDarkTex=owTexture('skinDark','#4a5148','rgba(35,52,34,.55)',true);
const owClothTex=owTexture('cloth','#30342e','rgba(92,82,62,.45)',false);
const owBloodClothTex=owTexture('clothBlood','#312428','rgba(100,84,75,.40)',true);
MAT.skin.map=owSkinTex;MAT.skin.roughness=.92;MAT.skin.needsUpdate=true;
MAT.skinRot.map=owSkinTex;MAT.skinRot.roughness=.95;MAT.skinRot.needsUpdate=true;
MAT.skinDark.map=owSkinDarkTex;MAT.skinDark.roughness=.98;MAT.skinDark.needsUpdate=true;
MAT.cloth.map=owClothTex;MAT.cloth.roughness=.92;MAT.cloth.needsUpdate=true;
MAT.clothBlood.map=owBloodClothTex;MAT.clothBlood.roughness=.96;MAT.clothBlood.needsUpdate=true;

function owGroundTexture(stage){
  const c=document.createElement('canvas');c.width=c.height=512;const x=c.getContext('2d'),rand=mulberry32(hashCode(stage.key)^0x17ff13);
  const colors={mansion:['#22241f','#454437'],mountain:['#394442','#c7d2d0'],river:['#31463a','#69553e'],sea:['#24343d','#56616a'],city:['#24272b','#54565a'],castle:['#211722','#4b2944']}[stage.key];x.fillStyle=colors[0];x.fillRect(0,0,512,512);
  for(let i=0;i<1700;i++){x.globalAlpha=.04+rand()*.12;x.fillStyle=rand()>.75?colors[1]:'#0c0d0e';const s=1+rand()*7;x.fillRect(rand()*512,rand()*512,s,s);}
  if(stage.key==='mountain')for(let i=0;i<70;i++){x.globalAlpha=.15+rand()*.2;x.fillStyle='#eaf2f1';x.beginPath();x.ellipse(rand()*512,rand()*512,8+rand()*45,3+rand()*18,rand()*Math.PI,0,Math.PI*2);x.fill();}
  if(stage.key==='city'){x.globalAlpha=.3;x.strokeStyle='#111';x.lineWidth=3;for(let i=0;i<12;i++){x.beginPath();x.moveTo(rand()*512,rand()*512);x.lineTo(rand()*512,rand()*512);x.stroke();}}
  x.globalAlpha=1;const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(7,36);return t;
}
function owAddGround(stage){
  const m=state.maze,w=m.cols*m.cell+28,l=m.rows*m.cell+34,geo=new THREE.PlaneGeometry(w,l),matg=new THREE.MeshStandardMaterial({map:owGroundTexture(stage),color:0xffffff,roughness:.88,metalness:stage.key==='city'?.12:.02});const g=new THREE.Mesh(geo,matg);g.rotation.x=-Math.PI/2;g.position.set(0,-.045,m.z0-m.rows*m.cell/2);scene.add(g);return g;
}
function owRoad(stage,rand,width=10){
  const m=state.maze,segments=26,len=m.rows*m.cell/segments,roadColor=stage.key==='mansion'?0x4a3033:stage.key==='mountain'?0x52605e:stage.key==='river'?0x584a3b:stage.key==='sea'?0x38464f:stage.key==='city'?0x22262a:0x3c263d;
  for(let i=0;i<segments;i++){const z=m.z0-(i+.5)*len,x=Math.sin(i*.52+state.area)*Math.min(7,m.cols*m.cell*.06),p=addPlane(x,.015,z,width+(i%5===0?4:0),len*1.10,roadColor,stage.key==='city'?0x08090a:0,.98);p.rotation.z=Math.sin(i*.52+state.area)*.025;if(stage.key==='city'&&i%2===0)addPlane(x,.022,z,.18,len*.72,0xe5bd62,0xd9a51f,.76);}
}
function owCloudTexture(){const c=document.createElement('canvas');c.width=512;c.height=256;const x=c.getContext('2d');x.clearRect(0,0,512,256);for(let i=0;i<20;i++){const g=x.createRadialGradient(80+i*18,130,0,80+i*18,130,70);g.addColorStop(0,'rgba(255,255,255,.18)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,512,256);}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
const owCloudTex=owCloudTexture();
function owClouds(stage,rand){const m=state.maze;for(let i=0;i<14;i++){const matc=new THREE.SpriteMaterial({map:owCloudTex,color:stage.key==='castle'?0xd35d82:stage.key==='city'?0xa284c8:0xdde8ee,transparent:true,opacity:.16+rand()*.16,depthWrite:false});const s=new THREE.Sprite(matc);s.scale.set(32+rand()*46,12+rand()*20,1);s.position.set((rand()-.5)*(m.cols*m.cell+90),18+rand()*24,m.z0-rand()*m.rows*m.cell);scene.add(s);state.stageVisuals.push({type:'owCloud',mesh:s,drift:(rand()-.5)*.018});}}
function owTree(x,z,scale=1,color=0x24432f){const g=new THREE.Group();const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.18,.3,2.8,7),mat(0x463327));trunk.position.y=1.4;g.add(trunk);for(let i=0;i<3;i++){const crown=new THREE.Mesh(new THREE.DodecahedronGeometry(1.15-i*.08,0),mat(color));crown.position.set((i-1)*.22,2.7+i*.62,0);crown.scale.set(1.1,.75,1);g.add(crown);}g.position.set(x,0,z);g.scale.setScalar(scale);scene.add(g);return g;}
function owRock(x,z,scale=1,color=0x59615e){const r=new THREE.Mesh(new THREE.DodecahedronGeometry(1,0),mat(color));r.position.set(x,.55*scale,z);r.scale.set(scale,scale*.7,scale*1.1);r.rotation.y=Math.random()*Math.PI;scene.add(r);return r;}
function owBuilding(x,z,w,h,d,color,accent=0){addBox(x,h/2,z,w,h,d,color,false,accent,accent?.25:0,.62,.12);if(accent)for(let y=3;y<h-1;y+=4)addBox(x,y,z-d*.505,w*.72,.45,.06,accent,false,accent,.6,.15,.02,.6);}
function owLampRow(stage,count=16){const m=state.maze;for(let i=0;i<count;i++){const z=m.z0-(i+.7)*m.rows*m.cell/count,side=i%2?-1:1,x=side*(m.cols*m.cell*.22+1.5);addLamp(x,z,stage.key==='castle'?0xff466f:stage.key==='city'?stage.accent:0xffd99a);}}
function owVistaMarker(x,z,color,scale=1){const ring=new THREE.Mesh(new THREE.TorusGeometry(1.1*scale,.06*scale,8,28),mat(color,color,1.8,.2,.1));ring.rotation.x=Math.PI/2;ring.position.set(x,.15,z);scene.add(ring);addGlow(x,1.5,z,color,.28,10);}

function owSky(stage,rand){
  scene.background=expansionMakeSkyTexture(stage);scene.fog=new THREE.FogExp2(stage.fog,stage.key==='castle'?.0032:stage.key==='mansion'?.0028:.0022);renderer.toneMappingExposure=stage.key==='city'?1.32:stage.key==='castle'?1.30:1.24;owClouds(stage,rand);
}
function owDecorateMansion(stage,rand){
  owSky(stage,rand);owAddGround(stage);owRoad(stage,rand,11);const m=state.maze,half=m.cols*m.cell/2;
  for(let i=0;i<64;i++){const side=i%2?-1:1;owTree(side*(half*.36+rand()*half*.48),m.z0-rand()*m.rows*m.cell,.75+rand()*1.5,rand()>.25?0x173624:0x3b2b2c);}
  owLampRow(stage,22);
  for(let k=1;k<=4;k++){const z=m.z0-k*m.rows*m.cell/5,side=k%2?-1:1;owBuilding(side*half*.34,z,16+rand()*8,9+rand()*8,12+rand()*6,0x2a1b21,0x7d2638);for(let i=-2;i<=2;i++)addCandelabra(side*half*.14+i*2.4,z+5,stage.accent);owVistaMarker(side*half*.12,z,stage.luxury,1.2);}
  for(let i=0;i<18;i++){const z=m.z0-(i+1)*m.rows*m.cell/19,side=i%2?-1:1;const statue=new THREE.Mesh(new THREE.CylinderGeometry(.45,.7,2.4,8),mat(0x777069));statue.position.set(side*half*.31,1.2,z);scene.add(statue);}
}
function owDecorateMountain(stage,rand){
  owSky(stage,rand);owAddGround(stage);owRoad(stage,rand,9);const m=state.maze,half=m.cols*m.cell/2;
  for(let layer=0;layer<3;layer++)for(let i=0;i<26;i++){const side=i%2?-1:1,x=side*(half*.60+12+layer*14+rand()*22),z=m.z0-rand()*m.rows*m.cell,h=16+layer*9+rand()*30;const peak=new THREE.Mesh(new THREE.ConeGeometry(8+rand()*11,h,7),mat(layer?0x263944:0x43535a));peak.position.set(x,h*.45,z);scene.add(peak);const cap=new THREE.Mesh(new THREE.ConeGeometry(3.5+rand()*5,h*.24,7),mat(0xe0ecee));cap.position.set(x,h*.82,z);scene.add(cap);}
  for(let i=0;i<78;i++){const side=i%2?-1:1,x=side*(half*.28+rand()*half*.62),z=m.z0-rand()*m.rows*m.cell;addPine(x,z,.7+rand()*1.45);}
  for(let k=1;k<=4;k++){const z=m.z0-k*m.rows*m.cell/5,side=k%2?-1:1;owBuilding(side*half*.27,z,9,5.5,7,0x303b3c,0x75c9e8);for(let i=0;i<7;i++)owRock((rand()-.5)*half*.9,z+(rand()-.5)*16,.7+rand()*1.6);owVistaMarker(0,z,0xbcecff,1.4);}
  expansionParticles('snow',rand);
}
function owDecorateRiver(stage,rand){
  owSky(stage,rand);owAddGround(stage);owRoad(stage,rand,10);const m=state.maze,half=m.cols*m.cell/2,riverX=half*.36;
  for(let i=0;i<34;i++){const z=m.z0-(i+.5)*m.rows*m.cell/34,x=riverX+Math.sin(i*.55)*5;const water=addPlane(x,-.08,z,14,m.rows*m.cell/32,0x0b6072,0x0c5261,.82);state.stageVisuals.push({type:'water',mesh:water,baseY:-.08,phase:i*.3});}
  for(let i=0;i<70;i++){const side=i%2?-1:1,x=side*(half*.28+rand()*half*.60),z=m.z0-rand()*m.rows*m.cell;owTree(x,z,.65+rand()*1.3,rand()>.5?0x244e34:0x4b5630);}
  for(let k=1;k<=4;k++){const z=m.z0-k*m.rows*m.cell/5;addBox(riverX,.18,z,18,.36,5.6,0x765740,false,0,.76,.03);for(const sx of [-1,1])for(let j=-3;j<=3;j++)addCylinder(riverX+sx*8,.8,z+j*.7,.08,1.6,0x42342a);owBuilding(-half*.30,z+7,8,4.8,7,0x4a3d32,0x4fb9b2);owVistaMarker(-half*.12,z,0x76ffd9,1.2);}
  expansionParticles('mist',rand);
}
function owDecorateSea(stage,rand){
  owSky(stage,rand);owAddGround(stage);owRoad(stage,rand,12);const m=state.maze,half=m.cols*m.cell/2;
  for(let i=0;i<28;i++){const z=m.z0-(i+.5)*m.rows*m.cell/28,sea=addPlane(half*.47,-.12,z,half*.92,m.rows*m.cell/26,0x073c5a,0x074963,.84);state.stageVisuals.push({type:'water',mesh:sea,baseY:-.12,phase:i*.35});}
  for(let i=0;i<26;i++){const z=m.z0-(i+1)*m.rows*m.cell/27,x=-half*.32+(i%3)*5;addContainer(x,z,(i%2)*Math.PI/2,[0x74433a,0x2d5064,0x696036][i%3]);}
  for(let k=1;k<=4;k++){const z=m.z0-k*m.rows*m.cell/5,side=k%2?-1:1;const lx=side*half*.26;addCylinder(lx,5,z,1.5,10,0xe4e4dc);const cap=new THREE.Mesh(new THREE.ConeGeometry(1.9,1.8,12),mat(0xa62b35));cap.position.set(lx,10.8,z);scene.add(cap);addGlow(lx,9.8,z,0xffe8a8,1.0,40);owVistaMarker(0,z,0x6dd8ff,1.25);}
  for(let i=0;i<10;i++){const x=half*.70+rand()*40,z=m.z0-rand()*m.rows*m.cell;addBox(x,.5,z,6+rand()*6,.5,14+rand()*10,0x1c3038,false);addBox(x,3,z,.25,5,.25,0xb8c7cc,false);}
  expansionParticles('mist',rand);
}
function owDecorateCity(stage,rand){
  owSky(stage,rand);owAddGround(stage);owRoad(stage,rand,16);const m=state.maze,half=m.cols*m.cell/2;
  for(let i=0;i<76;i++){const side=i%2?-1:1,x=side*(half*.58+5+rand()*22),z=m.z0-rand()*m.rows*m.cell,h=14+rand()*42,w=7+rand()*13,d=7+rand()*12;owBuilding(x,z,w,h,d,0x161b24,[0xff397d,0x3ed8ff,0xffa23f,0x9a63ff][i%4]);}
  for(let k=1;k<=5;k++){const z=m.z0-k*m.rows*m.cell/6;addPlane(0,.025,z,m.cols*m.cell*.90,15,0x2a2d31,0,.95);for(let j=-3;j<=3;j++){if(j===0)continue;addCar(j*8,z+(j%2)*2.5,j%2?0:Math.PI/2);}for(const side of [-1,1])addLamp(side*half*.28,z,stage.accent);owVistaMarker(0,z,stage.accent,1.25);}
  for(let i=0;i<18;i++){const z=m.z0-(i+1)*m.rows*m.cell/19;addLamp(-half*.26,z,0x54dfff);addLamp(half*.26,z,0xff7b32);}
}
function owDecorateCastle(stage,rand){
  owSky(stage,rand);owAddGround(stage);owRoad(stage,rand,12);const m=state.maze,half=m.cols*m.cell/2;
  for(let i=0;i<50;i++){const side=i%2?-1:1,x=side*(half*.57+8+rand()*26),z=m.z0-rand()*m.rows*m.cell,h=15+rand()*35;owBuilding(x,z,7+rand()*8,h,7+rand()*8,0x1b0d22,0x67205d);const sp=new THREE.Mesh(new THREE.ConeGeometry(2+rand()*3,8+rand()*12,7),mat(0x2d1236,stage.accent,.28));sp.position.set(x,h+4,z);scene.add(sp);}
  for(let i=0;i<34;i++){const z=m.z0-(i+.5)*m.rows*m.cell/34,side=i%2?-1:1;const lava=addPlane(side*half*.38,-.09,z,half*.44,m.rows*m.cell/32,0x5a0d06,0xff3c08,.94);state.stageVisuals.push({type:'lava',mesh:lava,baseY:-.09,phase:i*.22});}
  for(let k=1;k<=5;k++){const z=m.z0-k*m.rows*m.cell/6;for(const side of [-1,1]){addCylinder(side*half*.28,3,z,.65,6,0x4a3150);const garg=new THREE.Mesh(new THREE.ConeGeometry(.8,2.4,6),mat(0x27152e,stage.accent,.2));garg.position.set(side*half*.28,6.6,z);scene.add(garg);}addBox(0,5.2,z,half*.70,.5,.55,stage.luxury,false,0,.45,.35);owVistaMarker(0,z,0xcf65ff,1.4);}
  expansionParticles('embers',rand);
}

decorateMansion=owDecorateMansion;decorateMountain=owDecorateMountain;decorateRiver=owDecorateRiver;decorateSea=owDecorateSea;decorateCity=owDecorateCity;decorateCastle=owDecorateCastle;

const owBaseUpdateStageVisuals=updateStageVisuals;
updateStageVisuals=function(now){owBaseUpdateStageVisuals(now);for(const v of state.stageVisuals){if(v.type==='owCloud'&&v.mesh){v.mesh.position.x+=v.drift;if(v.mesh.position.x>state.maze.cols*state.maze.cell*.7)v.mesh.position.x=-state.maze.cols*state.maze.cell*.7;if(v.mesh.position.x<-state.maze.cols*state.maze.cell*.7)v.mesh.position.x=state.maze.cols*state.maze.cell*.7;}}};

function owInfectedTint(){
  if(!horde)return;const parts=['body','head','lArm','rArm','lLeg','rLeg'];
  for(const e of state.enemies.values()){
    if(e.boss||e.index<0||e.index>=horde.capacity)continue;const rr=mulberry32(hashCode(e.id)^state.seed);let tint;
    if(e.type==='dog')tint=new THREE.Color(0x7b5248);else if(e.type==='licker')tint=new THREE.Color(0xc34b4b);else if(e.type==='fat')tint=new THREE.Color(0xa6a58b);else{const choices=[0x8b927a,0x798276,0x8c7e6d,0x667266,0x95877b];tint=new THREE.Color(choices[Math.floor(rr()*choices.length)]);}
    for(const p of parts)horde[p]?.setColorAt?.(e.index,tint);
    if(e.type==='licker')horde.mouth?.setColorAt?.(e.index,new THREE.Color(0xff5b62));
  }
  for(const p of [...parts,'mouth'])if(horde[p]?.instanceColor)horde[p].instanceColor.needsUpdate=true;
}
const owBaseSpawnHostWorld=spawnHostWorld;
spawnHostWorld=function(arenaZ){owBaseSpawnHostWorld(arenaZ);owInfectedTint();};
const owBaseSyncWorld=syncWorld;
syncWorld=function(m){owBaseSyncWorld(m);owInfectedTint();};

const miniLegend=document.querySelector('.minimap-panel small');if(miniLegend)miniLegend.innerHTML='白=自分 / 黄=相方 / 緑=GOAL<br>赤=感染者 / 橙=高速種 / 紫=リッカー / 大=デブゾンビ';

const owBaseBeginArea=beginArea;
beginArea=function(fromStart=true){const r=owBaseBeginArea(fromStart);setTimeout(()=>{owNote.textContent=`${currentStage().jp} / 広域探索 ${Math.round(state.maze.rows*state.maze.cell)}m`;},80);return r;};
