/* Sculpted instanced infected. Local forward is +Z, matching the gameplay yaw. */
const CA={};
CA.head=cineMerge([
  cineEllipsoid(0,.055,-.015,.263,.315,.24),cineEllipsoid(0,-.19,.045,.205,.166,.205),
  cineEllipsoid(-.16,-.055,.16,.095,.09,.09,12),cineEllipsoid(.16,-.055,.16,.095,.09,.09,12),
  cineEllipsoid(0,-.025,.227,.052,.11,.09,12),cineEllipsoid(-.10,.09,.185,.104,.04,.062,12),cineEllipsoid(.10,.09,.185,.104,.04,.062,12),
  cineEllipsoid(-.264,-.005,0,.045,.091,.055,10),cineEllipsoid(.264,-.005,0,.045,.091,.055,10)
]);
CA.body=cineKeep(cineProfile([[-.55,.19,.14],[-.45,.28,.17],[-.17,.29,.19],[.08,.34,.235],[.32,.42,.24],[.43,.39,.21],[.52,.19,.13],[.57,.13,.11]],20));
CA.neck=cineKeep(cineProfile([[-.15,.115,.115],[.03,.11,.10],[.21,.10,.095]],14));
CA.sockets=cineMerge([cineEllipsoid(-.105,.016,.224,.061,.049,.036,10),cineEllipsoid(.105,.016,.224,.061,.049,.036,10),cineEllipsoid(0,-.193,.226,.09,.065,.036,10)]);
CA.eyes=cineMerge([cineEllipsoid(-.104,.014,.252,.030,.023,.023,10),cineEllipsoid(.104,.014,.252,.030,.023,.023,10)]);
CA.teeth=cineMerge(Array.from({length:7},(_,i)=>new THREE.BoxGeometry(.017,.028+(i%2)*.006,.021).translate((i-3)*.022,-.153,.266)));
const cineArmParts=[cineProfile([[-.35,.064,.068],[-.27,.093,.092],[-.04,.115,.107],[.19,.124,.113],[.34,.115,.098],[.43,.09,.08]],14),cineEllipsoid(0,-.35,.04,.085,.084,.095,12),cineProfile([[-.80,.061,.048],[-.67,.068,.067],[-.49,.09,.093],[-.34,.084,.082]],14).rotateX(.18),cineEllipsoid(0,-.83,-.095,.094,.13,.057,12)];
for(let i=0;i<4;i++)cineArmParts.push(cineTube([[(-1.5+i)*.042,-.88,-.07],[(-1.5+i)*.047,-1.02,-.02],[(-1.5+i)*.05,-1.07,.035]],.021,6));
cineArmParts.push(cineTube([[.08,-.78,-.04],[.13,-.89,.015],[.14,-.94,.07]],.027,6));CA.arm=cineMerge(cineArmParts);
CA.leg=cineKeep(cineProfile([[-.53,.09,.085],[-.4,.107,.10],[-.23,.12,.13],[-.03,.12,.12],[.12,.146,.15],[.29,.157,.155],[.47,.14,.14]],16));
CA.boot=cineMerge([cineEllipsoid(0,.07,.06,.123,.135,.25,12),new THREE.BoxGeometry(.24,.05,.42).translate(0,-.018,.055)]);
CA.shoulders=cineMerge([cineEllipsoid(-.38,.27,0,.17,.24,.21,12),cineEllipsoid(.38,.27,0,.17,.24,.21,12),new THREE.TorusGeometry(.17,.046,6,18).rotateX(Math.PI/2).scale(1,.6,.8).translate(0,.46,0)]);
CA.armor=cineMerge([cineEllipsoid(0,0,0,.40,.36,.12,12),new THREE.BoxGeometry(.22,.30,.11).translate(-.2,-.07,.10),new THREE.BoxGeometry(.22,.30,.11).translate(.2,-.07,.10)]);
CA.helmet=cineKeep(new THREE.SphereGeometry(.302,16,10,0,Math.PI*2,0,Math.PI*.57).scale(1,1.05,.96));
CA.sac=cineKeep(new THREE.SphereGeometry(.43,18,14));
CA.spine=cineMerge(Array.from({length:5},(_,i)=>new THREE.ConeGeometry(.075,.24+(i%2)*.12,7).rotateX(-.7).translate(0,.08+i*.16,-.25)));
CA.houndMuzzle=cineMerge([cineEllipsoid(0,-.12,.30,.15,.10,.23,12),cineEllipsoid(0,.23,-.06,.10,.24,.08,10)]);
const cineSacMat=cineKeep(new THREE.MeshStandardMaterial({color:0x89915e,roughness:.48,emissive:0x365f17,emissiveIntensity:.25}));
const cineArmorMat=CM.metal;
const cineHordeSpec={body:[CA.body,CM.cloth],head:[CA.head,CM.skin],lArm:[CA.arm,CM.skin],rArm:[CA.arm,CM.skin],lLeg:[CA.leg,CM.pants],rLeg:[CA.leg,CM.pants],eyes:[CA.eyes,CM.eye],mouth:[CA.sockets,CM.cavity],bone:[CA.teeth,CM.bone],neck:[CA.neck,CM.skin],shoulders:[CA.shoulders,CM.cloth],lBoot:[CA.boot,CM.leather],rBoot:[CA.boot,CM.leather],v5Armor:[CA.armor,cineArmorMat],helmet:[CA.helmet,cineArmorMat],v5Sac:[CA.sac,cineSacMat],v5Spike:[CA.spine,CM.bone],muzzle:[CA.houndMuzzle,CM.skin]};
const cineHordeKeys=Object.keys(cineHordeSpec);
makeHorde=function(capacity){
  horde={capacity};
  for(const [key,[geo,material]] of Object.entries(cineHordeSpec)){const mesh=new THREE.InstancedMesh(geo,material,capacity);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.frustumCulled=false;mesh.userData.hordePart=true;mesh.userData.weakpoint=key==='head';mesh.castShadow=!['eyes','mouth','bone'].includes(key);mesh.receiveShadow=true;scene.add(mesh);horde[key]=mesh;for(let i=0;i<capacity;i++)hideInst(mesh,i);}
};
const cineSkinColors={walker:0xd4d1bf,runner:0xd3b7a9,crawler:0xb4beb8,hound:0xad9b8a,stalker:0xc2a6ac,brute:0xd3c6b4,spitter:0xbbc79c,leaper:0xb6b7be,armored:0xc0c3b7,bloater:0xccbf9e};
v5TintEnemies=function(){
  if(!horde)return;for(const e of state.enemies.values()){if(e.boss||e.index<0||e.index>=horde.capacity)continue;const skin=new THREE.Color(cineSkinColors[e.type]||0xc4c6b8),cloth=new THREE.Color().setHSL(.10+(e.index%5)*.018,.12+(e.index%3)*.055,.42+(e.index%4)*.05);for(const k of ['head','neck','lArm','rArm','muzzle'])horde[k].setColorAt(e.index,skin);for(const k of ['body','shoulders'])horde[k].setColorAt(e.index,cloth);}
  for(const k of cineHordeKeys)if(horde[k].instanceColor)horde[k].instanceColor.needsUpdate=true;
};
let cineVisualAt=0;
const cinePose={x:0,z:0,visualYaw:0};
updateHordeVisuals=function(now){
  animateBoss(now);if(!horde)return;const interval=cineQuality==='low'?42:cineMobile?30:20;if(now-cineVisualAt<interval)return;cineVisualAt=now;
  const t=now*.001,range=cineQuality==='low'?58:cineMobile?90:125;
  for(const e of state.enemies.values()){
    if(e.boss||e.index<0||e.index>=horde.capacity)continue;const i=e.index,dist=Math.hypot(e.x-local.x,e.z-local.z);
    if(e.dead&&!e.cineDeathAt)e.cineDeathAt=now;
    if(dist>range||(e.dead&&now-e.cineDeathAt>1250)){for(const k of cineHordeKeys)hideInst(horde[k],i);continue;}
    if(e.cineHp!==undefined&&e.hp<e.cineHp)e.cineHitAt=now;e.cineHp=e.hp;
    const type=e.type||'walker',quad=['crawler','hound','stalker'].includes(type),heavy=['brute','bloater'].includes(type),s=heavy?1.32:type==='hound'?.80:1;
    const speed=e.runner?1.45:.85,phase=t*(3.4+e.speed*.58)*speed+(e.phase||0),gait=Math.sin(phase),stride=e.runner?.48:.30,bob=Math.abs(Math.sin(phase))*.035;
    const react=Math.max(0,1-(now-(e.cineHitAt||-9999))/260),death=e.dead?clamp((now-e.cineDeathAt)/700,0,1):0;
    Object.assign(cinePose,{x:e.x,z:e.z,visualYaw:e.visualYaw||0});
    const put=(key,x,y,z,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1)=>{
      if(death){const a=death*1.48,oy=y;y=oy*Math.cos(a)+.08;z+=oy*Math.sin(a);rx+=a;}
      setInst(horde[key],i,cinePose,x*s,y*s,z*s,rx,ry,rz,sx*s,sy*s,sz*s);
    };
    for(const k of ['v5Armor','helmet','v5Sac','v5Spike','muzzle'])hideInst(horde[k],i);
    let headY=2.03+bob,headZ=.08,headPitch=.04-react*.20,headScale=e.headScale||1;
    if(quad){
      headY=type==='hound'?.76:.84;headZ=.62;headPitch=-.03;
      put('body',0,.66,0,Math.PI/2-.05,0,gait*.025,type==='hound'?.84:1.1,type==='hound'?1.2:1.02,.78);
      put('shoulders',0,.70,.06,Math.PI/2,0,0,1,1.05,.83);
      for(const side of [-1,1]){const swing=gait*side*.40;put(side<0?'lArm':'rArm',side*.43,.52,.42,-.50+swing,0,side*-.12,.80,.68,.80);put(side<0?'lLeg':'rLeg',side*.29,.33,-.56,-.53-swing,0,side*.10,.85,.70,.85);put(side<0?'lBoot':'rBoot',side*.30,.06,-.61+swing*.2,.10,0,0,.75,.7,.75);}
      put('neck',0,.78,.49,Math.PI/2);put('v5Spike',0,.80,-.25,-1.3);
      if(type==='hound')put('muzzle',0,headY,headZ,0,0,0,1,1,1.15);
    }else{
      const lean=(e.runner?.24:.10)+(e.lean||0)*.3-react*.19,breath=Math.sin(t*1.8+(e.phase||0))*.008;
      put('body',0,1.31+bob,-.03,lean,0,gait*.028,heavy?1.28:1,1+breath,heavy?1.25:1);
      put('shoulders',0,1.31+bob,-.03,lean,0,gait*.028,heavy?1.25:1,1,heavy?1.22:1);
      put('neck',0,1.83+bob,.07,lean*.4);
      for(const side of [-1,1]){
        const arm=side<0?'lArm':'rArm',leg=side<0?'lLeg':'rLeg',foot=side<0?'lBoot':'rBoot';
        put(arm,side*(heavy?.56:.44),1.39+bob,.10,-.40+gait*side*(e.runner?.5:.18)-react*.3,0,side*(.10+Math.sin(t*2+(e.phase||0))*.03),heavy?1.15:1,1,1);
        put(leg,side*.19,.57,Math.sin(phase+side*Math.PI/2)*.06,gait*side*stride,0,side*.035,heavy?1.1:1,1,1);
        put(foot,side*.20,.11+Math.max(0,gait*side)*.085,gait*side*.27,.04+Math.max(0,-gait*side)*.22,0,0);
      }
      if(type==='armored'){put('v5Armor',0,1.40,.23,lean,0,0,1.1,1.25,1);put('helmet',0,headY+.06,headZ,headPitch);}
      if(type==='brute')put('v5Armor',0,1.44,.27,.1,0,0,1.20,1.25,1);
      if(type==='spitter')put('v5Sac',0,1.40,-.29,0,0,0,.86,1.15,.66);
      if(type==='bloater')put('v5Sac',0,1.20,.11,0,0,0,1.12,1.20,.84);
    }
    const tilt=(e.headTilt||0)*.35+Math.sin(t*1.1+(e.phase||0))*.045;
    for(const k of ['head','eyes','mouth','bone'])put(k,0,headY,headZ,headPitch,Math.sin(t*.8+(e.phase||0))*.06,tilt,headScale,headScale,headScale);
  }
  for(const k of cineHordeKeys){horde[k].instanceMatrix.needsUpdate=true;horde[k].boundingSphere=null;}
};

/* The co-op partner uses the same anatomical model, with a tactical vest. */
humanoid=function(material){const g=new THREE.Group();for(const [name,geo,ma,x,y,z] of [['body',CA.body,CM.cloth,0,1.31,0],['head',CA.head,CM.skin,0,2.03,0],['lArm',CA.arm,CM.cloth,-.44,1.38,0],['rArm',CA.arm,CM.cloth,.44,1.38,0],['lLeg',CA.leg,CM.pants,-.19,.56,0],['rLeg',CA.leg,CM.pants,.19,.56,0],['eyes',CA.eyes,CM.eye,0,2.03,0],['armor',CA.armor,material,0,1.4,.23],['helmet',CA.helmet,CM.blackMetal,0,2.08,0],['leftBoot',CA.boot,CM.leather,-.19,.10,0],['rightBoot',CA.boot,CM.leather,.19,.10,0]]){const o=new THREE.Mesh(geo,ma);o.name=name;o.position.set(x,y,z);o.castShadow=true;g.add(o);}return g;};

function cineBossPart(g,geo,ma,x,y,z,sx=1,sy=1,sz=1,name=''){const o=new THREE.Mesh(geo,ma);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.name=name;o.castShadow=true;o.receiveShadow=true;o.userData.enemyId='boss';g.add(o);return o;}
createBossMesh=function(e){
  const stage=currentStage(),g=new THREE.Group(),kind=stage.key;
  const skin=CM.skin.clone();skin.color.set({mansion:0x68665e,mountain:0xdadfd9,river:0x57705b,sea:0x507a88,city:0x98928a,castle:0x6d4d59}[kind]);skin.userData.cineKind='skin';
  if(cineTextures.skin){skin.map=cineTextures.skin;skin.bumpMap=cineTextures.skin;skin.bumpScale=.035;}
  cineBossPart(g,CA.body,skin,0,1.55,0,1.9,1.4,1.5,'body');cineBossPart(g,CA.head,skin,0,2.58,.10,1.62,1.40,1.5,'head');
  for(const side of [-1,1]){cineBossPart(g,CA.arm,skin,side*.76,1.62,.08,1.6,1.25,1.6,side<0?'lArm':'rArm');cineBossPart(g,CA.leg,skin,side*.33,.55,-.04,1.65,1.05,1.65,side<0?'lLeg':'rLeg');cineBossPart(g,CA.boot,CM.leather,side*.34,.12,.02,1.4,1.1,1.7);}
  for(const k of ['eyes','sockets','teeth'])cineBossPart(g,CA[k],k==='eyes'?CM.eye:k==='sockets'?CM.cavity:CM.bone,0,2.58,.10,1.62,1.40,1.5);
  if(kind==='mansion'){
    cineBossPart(g,CA.houndMuzzle,skin,0,2.51,.22,2,1.5,1.7);
    for(const side of [-1,1]){cineBossPart(g,cineTube([[side*.18,2.86,0],[side*.4,3.26,-.04],[side*.44,3.43,.05]],.10,12),CM.leather,0,0,0);for(let i=0;i<4;i++)cineBossPart(g,cineTube([[side*.82+(i-1.5)*.095,.38,.22],[side*.86+(i-1.5)*.095,.2,.47],[side*.83+(i-1.5)*.095,.08,.59]],.028,8),CM.bone,0,0,0);}
    const mane=[];for(let i=0;i<26;i++){const a=i*2.4;mane.push(new THREE.ConeGeometry(.09,.35,6).rotateX(-.7).rotateZ(Math.sin(a)*.4).translate(Math.sin(a)*.66,1.7+(i%7)*.13,-.21-Math.abs(Math.cos(a))*.18));}cineBossPart(g,cineMerge(mane,false),CM.leather,0,0,0);
  }else if(kind==='mountain'){
    const fur=[];for(let i=0;i<95;i++){const a=i*2.4;fur.push(new THREE.ConeGeometry(.065,.24+(i%4)*.04,6).rotateZ(Math.PI).translate(Math.sin(a)*(.57+(i%3)*.06),1.0+(i%13)*.1,Math.cos(a)*.36));}cineBossPart(g,cineMerge(fur,false),CM.paleStone,0,0,0);
    for(const side of [-1,1])cineBossPart(g,cineTube([[side*.25,2.8,0],[side*.6,3.0,-.08],[side*.8,3.23,.1]],.105,16),CM.bone,0,0,0);
  }else if(kind==='river'){
    cineBossPart(g,CA.houndMuzzle,skin,0,2.38,.3,2.3,1.4,3.4);
    cineBossPart(g,cineTube([[0,1.05,-.3],[0,.55,-1.1],[.4,.23,-1.95],[.8,.13,-2.55]],.21,24),skin,0,0,0);
    for(let i=0;i<9;i++)cineBossPart(g,CG.cone,CM.bone,0,1.2+i*.17,-.4,.18,.4,.20);
  }else if(kind==='sea'){
    for(let i=0;i<8;i++){const a=i/8*Math.PI*2;const tent=cineBossPart(g,cineTube([[Math.cos(a)*.4,1.1,Math.sin(a)*.3],[Math.cos(a)*1.05,.65,Math.sin(a)*.9],[Math.cos(a)*1.4,.25,Math.sin(a)*1.35],[Math.cos(a+.4)*1.75,.35,Math.sin(a+.4)*1.7]],.09,24),skin,0,0,0);tent.userData.tentacle=i;}
    for(const side of [-1,1])cineBossPart(g,CG.cone,CM.bone,side*.65,2.18,-.1,.26,1.3,.65).rotation.z=side*.65;
  }else if(kind==='city'){
    for(const side of [-1,1])cineBossPart(g,CA.armor,CM.blackMetal,side*.47,1.73,.31,1.38,1.65,2.1);
    cineBossPart(g,CA.helmet,CM.metal,0,2.67,.08,1.73,1.5,1.62);
    const cannon=cineBossPart(g,CG.cylinder,CM.metal,.88,.76,.31,.48,1.6,.48);cannon.rotation.x=Math.PI/2;
    for(let i=0;i<5;i++)cineBossPart(g,CG.torus,CM.blackMetal,.88,.76,-.18+i*.23,.27,.27,.27);
  }else{
    for(const side of [-1,1]){
      const s=new THREE.Shape();s.moveTo(0,0);s.bezierCurveTo(side*.7,1.0,side*1.7,1.8,side*2.45,1.55);s.lineTo(side*2.1,.4);s.quadraticCurveTo(side*1.55,.73,side*1.4,-.35);s.quadraticCurveTo(side*.9,.12,side*.55,-.9);s.closePath();
      const wingMat=skin.clone();wingMat.side=THREE.DoubleSide;wingMat.color.set(0x432d40);const wing=cineBossPart(g,new THREE.ShapeGeometry(s,16),wingMat,side*.43,1.9,-.32);wing.userData.wing=side;
      for(const p of [[side*2.45,1.55],[side*2.1,.4],[side*1.4,-.35]])cineBossPart(g,cineTube([[0,0,0],[p[0]*.5,p[1]*.65,.04],[...p,0]],.037,14),CM.bone,side*.43,1.9,-.29);
      cineBossPart(g,cineTube([[side*.23,2.84,0],[side*.55,3.22,-.07],[side*.70,3.58,.07],[side*.55,3.85,.21]],.105,20),CM.bone,0,0,0);
    }
  }
  const coreMat=new THREE.MeshStandardMaterial({color:stage.luxury,emissive:stage.accent,emissiveIntensity:3.5,roughness:.2});bossWeakpoint=cineBossPart(g,new THREE.IcosahedronGeometry(.20,2),coreMat,0,1.91,.49,1,1,1,'weakpoint');bossWeakpoint.userData.weakpoint=true;
  g.userData.enemyId='boss';g.scale.setScalar(stage.bossScale);g.position.set(e.x,0,e.z);scene.add(g);bossMesh=g;return g;
};
const cineBossAnimation=animateBoss;
animateBoss=function(now){cineBossAnimation(now);if(!bossMesh?.visible)return;const t=now*.001;for(const o of bossMesh.children){if(o.userData.wing)o.rotation.y=Math.sin(t*1.2)*.13*o.userData.wing;if(o.userData.tentacle!==undefined)o.rotation.y=Math.sin(t*1.8+o.userData.tentacle)*.08;if(o.name==='lLeg')o.rotation.x=Math.sin(t*3)*.17;if(o.name==='rLeg')o.rotation.x=-Math.sin(t*3)*.17;}};

/* Physically lit first-person carbine with gloves, rails, lens and reload motion. */
let cineGun=null,cineMuzzle=null,cineKick=0,cineLastShot=0,cineWeaponTemplate=null;
function cineMakeWeapon(){
  if(cineWeaponTemplate){cineGun=cineWeaponTemplate.clone(true);cineMuzzle=cineGun.getObjectByName('muzzle-flash');camera.add(cineGun);muzzleLight.position.set(.28,-.24,-1.2);return;}
  const g=new THREE.Group(),sets=new Map();
  const part=(geo,ma,x,y,z,rx=0,ry=0,rz=0)=>{geo.rotateX(rx).rotateY(ry).rotateZ(rz).translate(x,y,z);if(!sets.has(ma))sets.set(ma,[]);sets.get(ma).push(geo);};
  part(new THREE.BoxGeometry(.135,.12,.33),CM.blackMetal,0,0,0);part(new THREE.BoxGeometry(.13,.08,.30),CM.metal,0,.035,-.15);
  part(new THREE.CylinderGeometry(.025,.029,.40,16),CM.metal,0,.025,-.48,Math.PI/2);
  part(new THREE.CylinderGeometry(.033,.036,.13,16),CM.blackMetal,0,.025,-.72,Math.PI/2);
  part(new THREE.BoxGeometry(.11,.115,.31),CM.blackMetal,0,-.005,-.32);
  for(let i=0;i<11;i++){part(new THREE.BoxGeometry(.14,.017,.011),CM.metal,0,.106,-.36+i*.04);for(const side of [-1,1])part(new THREE.BoxGeometry(.009,.018,.021),CM.cavity,side*.058,.01,-.42+i*.024);}
  part(new THREE.BoxGeometry(.09,.19,.10),CM.blackMetal,0,-.155,.005,.22);part(new THREE.BoxGeometry(.075,.19,.07),CM.blackMetal,0,-.14,.13,-.28);
  part(new THREE.BoxGeometry(.13,.15,.25),CM.leather,0,-.025,.30);part(new THREE.BoxGeometry(.145,.18,.045),CM.blackMetal,0,-.025,.445);
  part(new THREE.TorusGeometry(.038,.007,8,24),CM.blackMetal,0,-.095,.075,0,Math.PI/2);
  part(new THREE.CylinderGeometry(.039,.039,.16,18),CM.blackMetal,0,.16,-.085,Math.PI/2);
  part(new THREE.CylinderGeometry(.029,.029,.005,18),CM.glass,0,.16,-.005,Math.PI/2);
  for(const z of [-.14,-.04])part(new THREE.TorusGeometry(.04,.006,8,20),CM.metal,0,.16,z);
  part(new THREE.BoxGeometry(.04,.07,.12),CM.blackMetal,0,.11,-.085);
  part(new THREE.BoxGeometry(.075,.025,.025),CM.metal,.093,.025,.08);
  /* Sleeves, palms, knuckles and individual supporting fingers. */
  part(new THREE.CapsuleGeometry(.055,.28,5,12),CM.cloth,.02,-.34,.22,-.25,0,-.10);
  part(new THREE.CapsuleGeometry(.053,.28,5,12),CM.cloth,-.18,-.24,-.24,0,0,-.60);
  part(cineEllipsoid(0,0,0,.063,.10,.059,12),CM.leather,.015,-.16,.115);
  part(cineEllipsoid(0,0,0,.081,.054,.081,12),CM.leather,-.042,-.082,-.31);
  for(let i=0;i<4;i++){part(new THREE.CapsuleGeometry(.013,.045,3,8),CM.leather,.045,-.117-i*.031,.12,0,0,Math.PI/2);part(new THREE.CapsuleGeometry(.012,.071,3,8),CM.leather,-.027+i*.026,-.046,-.335,0,0,.3);}
  for(const [ma,geos] of sets){const o=new THREE.Mesh(cineMerge(geos),ma);o.frustumCulled=false;g.add(o);}
  cineMuzzle=new THREE.Group();cineMuzzle.name='muzzle-flash';const flashMa=cineKeep(new THREE.MeshBasicMaterial({color:0xffdc82,transparent:true,opacity:.9,depthWrite:false,toneMapped:false}));
  for(let i=0;i<3;i++){const f=new THREE.Mesh(cineKeep(new THREE.ConeGeometry(.045,.24,5)),flashMa);f.rotation.x=-Math.PI/2;f.rotation.z=i*2.1;f.position.z=-.1;cineMuzzle.add(f);}cineMuzzle.position.set(0,.025,-.80);cineMuzzle.visible=false;g.add(cineMuzzle);
  g.position.set(.30,-.27,-.45);g.rotation.y=-.035;camera.add(g);cineGun=g;cineWeaponTemplate=g.clone(true);muzzleLight.position.set(.28,-.24,-1.2);
}
const cineBeginArea=beginArea;
beginArea=function(fromStart=true){const r=cineBeginArea(fromStart);cineMakeWeapon();return r;};
const cineShoot=shoot;
shoot=function(){const before=uxAmmo,launcherBefore=expansionLauncherShots;cineShoot();if(uxAmmo<before||expansionLauncherShots<launcherBefore||(state.running&&!uxReloading&&performance.now()<expansionInfiniteUntil)){cineKick=Math.min(.085,cineKick+.047);cineLastShot=performance.now();}};
