/* Original first-person weapon models. Shared PBR surfaces, batched static parts,
   and one cached template per loadout keep the additional GPU work bounded. */
let cineGun=null,cineMuzzle=null,cineKick=0,cineLastShot=0;
const armoryTemplates=new Map();
// A separate viewmodel scene gives the held weapon natural, stable lighting.
// The world flashlight starts behind it and must not bleach its nearby surfaces.
const armoryScene=new THREE.Scene(),armoryCamera=new THREE.PerspectiveCamera();
armoryScene.add(new THREE.HemisphereLight(0xbdcbd6,0x25231e,1.15));
const armoryKey=new THREE.DirectionalLight(0xd3deea,2.1);armoryKey.position.set(-2,4,2);armoryScene.add(armoryKey);
const armoryWidePose={x:.245,y:-.25,z:-.43},armoryPortraitPose={x:.02,y:-.24,z:-.57};
function armoryPlacement(){return camera.aspect<1.1?armoryPortraitPose:armoryWidePose;}
function armoryTexture(kind){
  const c=document.createElement('canvas');c.width=c.height=256;const x=c.getContext('2d'),r=mulberry32(kind==='metal'?713:891);
  x.fillStyle=kind==='metal'?'#b3b7b9':'#9b9d99';x.fillRect(0,0,256,256);
  const data=x.getImageData(0,0,256,256);
  for(let i=0;i<data.data.length;i+=4){const n=(r()-.5)*(kind==='metal'?17:42);for(let j=0;j<3;j++)data.data[i+j]+=n;}
  x.putImageData(data,0,0);
  if(kind==='metal')for(let i=0;i<100;i++){const y=r()*256;x.strokeStyle=`rgba(235,241,244,${.06+r()*.17})`;x.lineWidth=.35+r()*.45;x.beginPath();const z=r()*256;x.moveTo(z,y);x.lineTo(z+4+r()*35,y+r()*2);x.stroke();}
  else for(let y=0;y<256;y+=5)for(let z=0;z<256;z+=5){x.fillStyle='rgba(28,33,31,.13)';x.fillRect(z+(y%10?2:0),y,2,2);}
  const t=cineKeep(new THREE.CanvasTexture(c));t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());t.colorSpace=THREE.SRGBColorSpace;return t;
}
const armorySteelMap=armoryTexture('metal'),armoryGripMap=armoryTexture('polymer');
function armorySurface(color,roughness,metalness,map){return cineKeep(new THREE.MeshStandardMaterial({color,roughness,metalness,map,bumpMap:map,bumpScale:map===armorySteelMap?.00055:.0012,envMapIntensity:.65}));}
const ARM={
  receiver:armorySurface(0x48525b,.44,.72,armorySteelMap),steel:armorySurface(0x88949a,.36,.86,armorySteelMap),
  barrel:armorySurface(0x2d343a,.32,.86,armorySteelMap),polymer:armorySurface(0x292d2b,.78,.02,armoryGripMap),
  tan:armorySurface(0x777360,.76,.01,armoryGripMap),rubber:armorySurface(0x171c1b,.91,0,armoryGripMap),
  glove:armorySurface(0x44483e,.94,0,armoryGripMap),brass:armorySurface(0xb49b58,.34,.78,armorySteelMap),
  cavity:cineKeep(new THREE.MeshBasicMaterial({color:0x080b0c})),
  glass:cineKeep(new THREE.MeshPhysicalMaterial({color:0x12343c,roughness:.22,metalness:.06,clearcoat:.6,clearcoatRoughness:.18,envMapIntensity:.35})),
  dot:cineKeep(new THREE.MeshBasicMaterial({color:0xff7453,toneMapped:false})),
  flash:cineKeep(new THREE.MeshBasicMaterial({color:0xffdd9d,transparent:true,opacity:.85,depthWrite:false,toneMapped:false}))
};
const ARMORY={
  rifle:{length:.91,guard:.32,mag:'curve',stock:'solid',optic:'dot',kick:1},
  smg:{length:.65,guard:.19,mag:'straight',stock:'wire',optic:'open',kick:.65},
  marksman:{length:1.12,guard:.39,mag:'short',stock:'precision',optic:'scope',kick:1.22},
  carbine:{length:.76,guard:.25,mag:'curve',stock:'compact',optic:'dot',kick:.88},
  machinegun:{length:1.03,guard:.36,mag:'box',stock:'solid',optic:'open',bipod:true,kick:1.05},
  interceptor:{length:.58,guard:.18,mag:'straight',stock:'compact',optic:'dot',kick:.55},
  revolver:{length:.53,mag:'cylinder',optic:'iron',kick:1.9},
  scout:{length:1.19,guard:.43,mag:'short',stock:'precision',optic:'scope',bipod:true,kick:1.4},
  vanguard:{length:.96,guard:.33,mag:'drum',stock:'solid',optic:'scope',kick:1.3}
};
function armoryBevel(w,h,d,b=.006){
  b=Math.min(b,w/5,h/5,d/5);const s=new THREE.Shape();s.moveTo(-w/2+b,-h/2+b);s.lineTo(w/2-b,-h/2+b);s.lineTo(w/2-b,h/2-b);s.lineTo(-w/2+b,h/2-b);s.closePath();
  return new THREE.ExtrudeGeometry(s,{depth:d-2*b,bevelEnabled:true,bevelThickness:b,bevelSize:b,bevelSegments:2,steps:1,curveSegments:1}).translate(0,0,-d/2+b);
}
function armoryBatch(group){
  const sets=new Map();
  const add=(geo,ma,x=0,y=0,z=0,rx=0,ry=0,rz=0)=>{geo.rotateX(rx).rotateY(ry).rotateZ(rz).translate(x,y,z);if(!sets.has(ma))sets.set(ma,[]);sets.get(ma).push(geo);};
  const box=(w,h,d,ma,x=0,y=0,z=0,rx=0,ry=0,rz=0)=>add(armoryBevel(w,h,d),ma,x,y,z,rx,ry,rz);
  const tube=(r1,r2,length,ma,x=0,y=0,z=0,rx=Math.PI/2,ry=0,rz=0,open=false)=>add(new THREE.CylinderGeometry(r1,r2,length,16,1,open),ma,x,y,z,rx,ry,rz);
  const finish=()=>{for(const [ma,geos] of sets){const m=new THREE.Mesh(cineMerge(geos),ma);m.frustumCulled=false;group.add(m);}sets.clear();};
  return {add,box,tube,finish};
}
function armoryOptic(b,p){
  const {box,tube,add}=b;
  if(p.optic==='scope'){
    box(.057,.069,.12,ARM.barrel,0,.125,-.08);
    tube(.040,.04,.31,ARM.barrel,0,.20,-.16);tube(.058,.04,.09,ARM.receiver,0,.20,-.35);tube(.046,.045,.08,ARM.receiver,0,.20,.032);
    tube(.039,.039,.003,ARM.glass,0,.20,.075);
    for(const z of [-.28,-.05]){add(new THREE.TorusGeometry(.041,.006,6,24),ARM.steel,0,.20,z);box(.068,.08,.04,ARM.receiver,0,.143,z);}
    tube(.019,.019,.032,ARM.receiver,0,.253,-.15,0);tube(.018,.018,.03,ARM.receiver,.055,.20,-.15,0,0,Math.PI/2);
  }else if(p.optic==='dot'){
    box(.054,.056,.095,ARM.barrel,0,.12,-.105);tube(.038,.038,.09,ARM.receiver,0,.175,-.105);
    add(new THREE.TorusGeometry(.038,.006,6,24),ARM.steel,0,.175,-.058);
    tube(.031,.031,.004,ARM.glass,0,.175,-.057);
    add(new THREE.SphereGeometry(.0025,8,6),ARM.dot,0,.175,-.052);
  }
  if(p.optic==='open'||p.optic==='iron'){
    box(.016,.05,.023,ARM.barrel,-.027,.111,.092);box(.016,.05,.023,ARM.barrel,.027,.111,.092);box(.064,.015,.023,ARM.steel,0,.09,.092);
  }
  box(.009,.035,.018,ARM.steel,0,.104,-p.length+.10);
}
function armoryHands(g,p){
  const support=new THREE.Group();support.name='support-hand';g.add(support);const b=armoryBatch(support);
  const z=p.mag==='cylinder'?.1:-.26;
  b.add(new THREE.CapsuleGeometry(.051,.28,5,10),CM.cloth,-.19,-.245,z+.055,.15,0,-.56);
  b.add(cineEllipsoid(0,0,0,.073,.047,.074,12),ARM.glove,-.045,-.10,z);
  for(let i=0;i<4;i++){b.add(new THREE.CapsuleGeometry(.010,.055,3,8),ARM.glove,-.026+i*.022,-.063,z-.02,0,0,.26);b.box(.017,.018,.018,ARM.rubber,-.027+i*.022,-.051,z-.023);}
  b.add(new THREE.CapsuleGeometry(.014,.052,3,8),ARM.glove,-.095,-.063,z+.024,.2,0,-.6);b.finish();
  const r=armoryBatch(g);r.add(new THREE.CapsuleGeometry(.052,.24,5,12),CM.cloth,.055,-.31,.25,-.3,0,-.2);r.add(cineEllipsoid(0,0,0,.055,.089,.052,12),ARM.glove,.018,-.155,.15);
  for(let i=0;i<3;i++){r.add(new THREE.CapsuleGeometry(.012,.046,3,8),ARM.glove,.048,-.157-i*.027,.122,0,0,Math.PI/2);}
  r.add(new THREE.CapsuleGeometry(.010,.054,3,8),ARM.glove,.066,-.097,.065,Math.PI/2,0,.4);r.finish();
}
function armoryMagazine(g,p){
  const m=new THREE.Group();m.name='magazine';g.add(m);const b=armoryBatch(m);
  if(p.mag==='box'){
    b.box(.19,.18,.17,ARM.tan,0,-.19,-.025);b.box(.197,.018,.177,ARM.polymer,0,-.285,-.025);
    for(let i=0;i<7;i++)b.tube(.012,.012,.085,ARM.brass,-.06-i*.018,-.063-Math.sin(i*.2)*.017,-.015,Math.PI/2);
  }else if(p.mag==='drum'){
    b.tube(.099,.099,.14,ARM.polymer,0,-.19,-.015,0,0,Math.PI/2);b.tube(.068,.068,.145,ARM.receiver,0,-.19,-.015,0,0,Math.PI/2);
  }else{
    const short=p.mag==='short',straight=p.mag==='straight',length=short?.14:straight?.27:.24,w=straight?.058:.077,d=straight?.066:.105;
    for(let i=0;i<4;i++){const y=-.082-(i+.5)*length/4,z=-.04+(straight?0:i*i*.004);b.box(w,length/4+.008,d,ARM.polymer,0,y,z,straight?0:-i*.06);for(const side of [-1,1])b.box(.003,length/4-.006,d*.7,ARM.receiver,side*(w/2+.001),y,z);}
    b.box(w+.01,.019,d+.008,ARM.rubber,0,-.087-length,straight?-.04:-.004);
  }
  b.finish();return m;
}
function armoryLongGun(id,p){
  const g=new THREE.Group(),b=armoryBatch(g),{box,tube,add}=b,small=['smg','interceptor'].includes(id),width=small?.103:.132;
  box(width,.114,.31,ARM.receiver,0,.005,-.025);box(width*.97,.062,.22,ARM.polymer,0,-.075,.015);
  box(width+.01,.033,.30,ARM.barrel,0,.077,-.025);
  box(.09,.185,.074,ARM.polymer,0,-.166,.147,-.28);
  for(let i=0;i<5;i++)box(.092,.006,.058,ARM.rubber,0,-.113-i*.022,.163+i*.006,-.28);
  add(cineTube([[0,-.093,.113],[0,-.153,.086],[0,-.149,.016],[0,-.10,.007]],.007,14),ARM.receiver);
  add(cineTube([[0,-.085,.056],[0,-.108,.052],[0,-.122,.066]],.006,9),ARM.steel);
  const front=-.2-p.guard,guardCenter=-.2-p.guard/2;
  box(width*.95,.12,p.guard,small?ARM.polymer:ARM.barrel,0,.016,guardCenter);
  tube(.021,.024,p.length+front,ARM.steel,0,.026,(front-p.length)/2);
  tube(.033,.028,.083,ARM.barrel,0,.026,-p.length+.02,Math.PI/2,0,0,true);
  tube(.020,.020,.003,ARM.cavity,0,.026,-p.length-.018);
  add(new THREE.TorusGeometry(.027,.005,6,20),ARM.steel,0,.026,-p.length-.024);
  for(let i=0;i<3;i++)for(const side of [-1,1])box(.003,.027,.009,ARM.cavity,side*.028,.026,-p.length+.004+i*.015);
  tube(.009,.009,p.guard,ARM.steel,0,.089,guardCenter);
  for(let i=0;i<Math.ceil(p.guard/.04);i++)for(const side of [-1,1]){
    const z=-.22-i*.037;box(.003,.018,.026,ARM.cavity,side*width*.478,.024,z);box(.003,.006,.024,ARM.steel,side*width*.48,.043,z);
  }
  for(let i=0;i<Math.ceil((p.guard+.27)/.027);i++)box(width*.74,.013,.012,ARM.receiver,0,.097,front+.03+i*.027);
  box(.003,.036,.09,ARM.cavity,width/2+.001,.024,-.04);box(.01,.009,.085,ARM.steel,width/2+.005,.046,-.04);
  box(.035,.018,.042,ARM.receiver,width/2+.013,.022,.071);
  for(const z of [.078,-.10])for(const side of [-1,1]){tube(.009,.009,width+.004,ARM.steel,0,-.039,z,0,0,Math.PI/2);box(.001,.003,.011,ARM.cavity,side*(width/2+.003),-.039,z);}
  tube(.013,.013,.008,ARM.steel,-width/2-.004,-.04,.09,0,0,Math.PI/2);box(.004,.031,.01,ARM.receiver,-width/2-.009,-.047,.099,0,0,.35);
  const rear=p.stock==='compact'?.30:.43;
  // The stock rests at the shoulder, outside the first-person camera. Keeping it
  // in its own hidden group avoids a near-plane slab covering the receiver.
  const stock=new THREE.Group();stock.name='shoulder-stock';stock.visible=false;g.add(stock);const sb=armoryBatch(stock);
  if(p.stock==='wire')for(const side of [-1,1])sb.tube(.009,.009,.28,ARM.steel,side*.05,.022,.285);
  else{
    sb.tube(.027,.027,rear-.09,ARM.barrel,0,.005,.15+(rear-.09)/2);
    sb.box(.115,.113,rear-.16,ARM.polymer,0,-.013,.22+(rear-.16)/2);
    sb.box(.092,.028,.18,p.stock==='precision'?ARM.tan:ARM.polymer,0,.06,.29);
    for(let i=0;i<4;i++)sb.box(.008,.047,.007,ARM.receiver,.061,-.008,.24+i*.027);
  }
  sb.box(.13,.185,.028,ARM.rubber,0,-.035,rear+.064);
  if(p.stock==='precision')sb.tube(.019,.019,.018,ARM.steel,.063,-.005,.34,0,0,Math.PI/2);sb.finish();
  if(p.bipod)for(const side of [-1,1]){tube(.009,.009,.28,ARM.barrel,side*.065,-.075,front+.08,1.24,0,side*.12);box(.027,.024,.045,ARM.rubber,side*.078,-.124,front-.045);}
  if(id==='scout'){tube(.013,.013,.092,ARM.steel,.104,.015,.01,0,0,Math.PI/2);add(new THREE.SphereGeometry(.023,12,8),ARM.barrel,.151,.015,.01);}
  armoryOptic(b,p);b.finish();armoryMagazine(g,p);
  const bolt=new THREE.Group();bolt.name='bolt';const bb=armoryBatch(bolt);bb.box(.006,.022,.068,ARM.steel,width/2+.005,.024,-.045);bb.finish();g.add(bolt);
  armoryHands(g,p);return g;
}
function armoryRevolver(p){
  const g=new THREE.Group(),b=armoryBatch(g),{box,tube,add}=b;
  box(.09,.14,.22,ARM.receiver,0,.002,.015);box(.071,.185,.086,ARM.polymer,0,-.151,.149,-.28);box(.077,.023,.09,ARM.rubber,0,-.24,.174,-.28);
  box(.051,.043,.31,ARM.steel,0,.057,-.31);tube(.03,.03,.32,ARM.receiver,0,.015,-.31);tube(.021,.021,.19,ARM.steel,0,-.039,-.275);
  tube(.020,.020,.002,ARM.cavity,0,.015,-.472);add(new THREE.TorusGeometry(.025,.004,6,20),ARM.steel,0,.015,-.474);
  add(cineTube([[0,-.065,.115],[0,-.131,.075],[0,-.131,-.006],[0,-.072,-.005]],.008,14),ARM.receiver);
  add(cineTube([[0,-.065,.035],[0,-.096,.025],[0,-.113,.041]],.006,10),ARM.steel);
  box(.027,.042,.022,ARM.barrel,0,.10,.108,-.32);for(let i=0;i<5;i++)box(.074,.005,.052,ARM.rubber,0,-.103-i*.027,.158+i*.007,-.28);
  armoryOptic(b,p);b.finish();
  const cylinder=new THREE.Group();cylinder.name='cylinder';cylinder.position.set(0,.01,-.055);g.add(cylinder);const cb=armoryBatch(cylinder);
  cb.tube(.066,.066,.13,ARM.steel);
  for(let i=0;i<6;i++){const a=i*Math.PI/3,x=Math.cos(a)*.043,y=Math.sin(a)*.043;cb.tube(.015,.015,.003,ARM.brass,x,y,.067);cb.tube(.005,.005,.004,ARM.receiver,x,y,.069);cb.tube(.011,.011,.078,ARM.barrel,Math.cos(a)*.062,Math.sin(a)*.062,0);}
  cb.finish();armoryHands(g,p);return g;
}
function armoryTemplate(id){
  if(armoryTemplates.has(id))return armoryTemplates.get(id);
  const p=ARMORY[id],g=id==='revolver'?armoryRevolver(p):armoryLongGun(id,p);g.name=`weapon-${id}`;g.userData.weaponId=id;g.userData.profile=p;
  const flash=new THREE.Group();flash.name='muzzle-flash';flash.position.set(0,.026,id==='revolver'?-.48:-p.length-.034);
  for(let i=0;i<3;i++){const f=new THREE.Mesh(cineKeep(new THREE.ConeGeometry(.028,.13,5)),ARM.flash);f.rotation.x=-Math.PI/2;f.rotation.z=i*2.1;f.position.z=-.04;flash.add(f);}flash.visible=false;g.add(flash);
  armoryTemplates.set(id,g);return g;
}
function cineMakeWeapon(){
  const selected=document.querySelector('#ops-weapon')?.value||'rifle',id=Object.hasOwn(ARMORY,selected)?selected:'rifle';
  if(cineGun?.parent)cineGun.removeFromParent();
  const pose=armoryPlacement();
  cineGun=armoryTemplate(id).clone(true);cineGun.scale.set(.78,.92,1);cineGun.position.set(pose.x,pose.y,pose.z);cineGun.rotation.y=.12;armoryScene.add(cineGun);
  cineMuzzle=cineGun.getObjectByName('muzzle-flash');cineGun.userData.parts={magazine:cineGun.getObjectByName('magazine'),cylinder:cineGun.getObjectByName('cylinder'),bolt:cineGun.getObjectByName('bolt'),support:cineGun.getObjectByName('support-hand')};
  cineGun.userData.seenShot=0;cineGun.userData.cylinderTurn=0;
  if(muzzleLight)muzzleLight.position.set(pose.x,pose.y+.026,pose.z-ARMORY[id].length);
}
const armoryBeginArea=beginArea;
beginArea=function(fromStart=true){const result=armoryBeginArea(fromStart);cineMakeWeapon();return result;};
function cineAnimateWeapon(now,dt,t,reloadStart){
  if(!cineGun)return;const id=cineGun.userData.weaponId,p=ARMORY[id],parts=cineGun.userData.parts;
  const moving=state.running&&(touchMove.x||touchMove.y||keys.has('KeyW')||keys.has('KeyA')||keys.has('KeyS')||keys.has('KeyD')),walk=moving?1:.14;
  const duration=BlacksiteRules.WEAPONS[id].reload,phase=uxReloading?clamp((now-reloadStart)/duration,0,1):0;
  const lower=uxReloading?Math.sin(Math.PI*phase):0,recoil=cineKick*p.kick;
  const pose=armoryPlacement();
  cineGun.position.set(pose.x+Math.sin(t*6)*.006*walk,pose.y+Math.cos(t*12)*.005*walk-lower*.10,pose.z+recoil);
  cineGun.rotation.set(recoil*.72+lower*.35,.12-lower*.13,Math.sin(t*6)*.004*walk+lower*(id==='revolver'?-.40:.36));cineGun.visible=state.localLives>0;
  const elapsed=now-cineLastShot,cycling=state.running&&elapsed>=0&&elapsed<100;
  if(parts.bolt)parts.bolt.position.z=cycling?Math.sin(elapsed/100*Math.PI)*.043:0;
  if(parts.magazine){const out=uxReloading?Math.sin(clamp((phase-.12)/.70,0,1)*Math.PI):0;parts.magazine.position.set(-.025*out,-.26*out,.07*out);parts.magazine.rotation.x=out*.20;}
  if(parts.support){const reach=uxReloading?Math.sin(clamp((phase-.06)/.88,0,1)*Math.PI):0;parts.support.position.set(-.025*reach,-.11*reach,.18*reach);}
  if(parts.cylinder){if(cineLastShot!==cineGun.userData.seenShot&&state.running){cineGun.userData.seenShot=cineLastShot;cineGun.userData.cylinderTurn-=Math.PI/3;}parts.cylinder.rotation.z=cineGun.userData.cylinderTurn;parts.cylinder.position.x=-.105*lower;}
  if(cineMuzzle){cineMuzzle.visible=elapsed>=0&&elapsed<38&&state.running;cineMuzzle.rotation.z=t*47;cineMuzzle.scale.setScalar(.8+p.kick*.18);}
}
function cineRenderWeapon(){
  if(!cineGun?.visible)return 0;
  armoryCamera.projectionMatrix.copy(camera.projectionMatrix);
  armoryCamera.projectionMatrixInverse.copy(camera.projectionMatrixInverse);
  armoryScene.environment=scene.environment;armoryScene.environmentIntensity=.55;
  const autoClear=renderer.autoClear;renderer.autoClear=false;renderer.clearDepth();
  try{cineRender(armoryScene,armoryCamera);return renderer.info.render.calls;}finally{renderer.autoClear=autoClear;}
}
