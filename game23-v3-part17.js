/* GAME 23 — true full-body class colors + visible attack hitboxes */
let p17AttackMesh=null;
const p17Dummy=new THREE.Object3D();
const p17ColorCache=new Map();
function p17Color(hex){if(!p17ColorCache.has(hex))p17ColorCache.set(hex,new THREE.Color(hex));return p17ColorCache.get(hex);}
function p17NeutralizeHordeMaterials(){
  if(!horde)return;
  for(const key of ['body','head','lArm','rArm','lLeg','rLeg','bone']){
    const mesh=horde[key];if(!mesh?.material)continue;
    const source=mesh.material,neutral=source.clone();
    if(neutral.color)neutral.color.setHex(0xffffff);
    if(neutral.emissive)neutral.emissive.setHex(0x000000);
    neutral.needsUpdate=true;
    mesh.material=neutral;
  }
}
function p17ResetAttackMesh(capacity){
  if(p17AttackMesh){try{scene.remove(p17AttackMesh);p17AttackMesh.geometry?.dispose?.();p17AttackMesh.material?.dispose?.();}catch{}}
  const geo=new THREE.RingGeometry(.80,1,32);
  const material=new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.34,side:THREE.DoubleSide,depthWrite:false,depthTest:false});
  p17AttackMesh=new THREE.InstancedMesh(geo,material,Math.max(24,capacity+2));
  p17AttackMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);p17AttackMesh.frustumCulled=false;p17AttackMesh.renderOrder=18;p17AttackMesh.count=0;scene.add(p17AttackMesh);
}
const p17BaseMakeHorde=makeHorde;
makeHorde=function(capacity){
  const r=p17BaseMakeHorde(capacity);
  p17NeutralizeHordeMaterials();
  p17ResetAttackMesh(capacity);
  return r;
};
function p17MeleeRadius(e){
  if(e.boss){const phase=bossPhase(e);return phase===3?2.65:phase===2?2.35:2.05;}
  switch(e.type){case'fat':return 1.20;case'dog':return .92;case'crawler':return .82;case'licker':return .82;case'runner':return 1.05;case'charger':return 1.08;default:return .94;}
}
function p17AttackColor(e){
  if(e.boss)return 0xff174d;
  if(e.type==='fat')return 0xff8a22;
  if(e.type==='licker'||e.type==='screamer')return 0xff3ca6;
  if(e.type==='dog'||e.type==='charger')return 0xffc12f;
  if(e.type==='spitter')return 0x8cff45;
  return 0xff334c;
}
function p17UpdateAttackHitboxes(){
  if(!p17AttackMesh||!state.running){if(p17AttackMesh)p17AttackMesh.count=0;return;}
  let slot=0;
  for(const e of state.enemies.values()){
    if(e.dead)continue;
    if(e.boss){if(!bossMesh?.visible||!e._p13Awake)continue;}
    const dist=Math.hypot(local.x-e.x,local.z-e.z);if(!e.boss&&dist>38)continue;
    const r=p17MeleeRadius(e);
    p17Dummy.position.set(e.x,.07,e.z);p17Dummy.rotation.set(-Math.PI/2,0,0);p17Dummy.scale.set(r,r,1);p17Dummy.updateMatrix();
    p17AttackMesh.setMatrixAt(slot,p17Dummy.matrix);p17AttackMesh.setColorAt(slot,p17Color(p17AttackColor(e)));slot++;
    if(slot>=p17AttackMesh.instanceMatrix.count)break;
  }
  p17AttackMesh.count=slot;p17AttackMesh.instanceMatrix.needsUpdate=true;if(p17AttackMesh.instanceColor)p17AttackMesh.instanceColor.needsUpdate=true;
}
const p17BaseUpdateHorde=updateHordeVisuals;
updateHordeVisuals=function(now){const r=p17BaseUpdateHorde(now);p17UpdateAttackHitboxes();return r;};

/* Make special/ranged telegraphs unmistakable and render above the floor. */
if(typeof p14TempRing==='function'){
  const p17BaseTempRing=p14TempRing;
  p14TempRing=function(x,z,r,color,duration=520){const mesh=p17BaseTempRing(x,z,r,color,duration);if(mesh?.material){mesh.material.opacity=.82;mesh.material.depthTest=false;mesh.material.depthWrite=false;mesh.material.needsUpdate=true;mesh.renderOrder=22;}return mesh;};
}
if(typeof p14TempBeam==='function'){
  const p17BaseTempBeam=p14TempBeam;
  p14TempBeam=function(x1,z1,x2,z2,color,duration=360){const before=scene.children.length,r=p17BaseTempBeam(x1,z1,x2,z2,color,duration);const line=scene.children[scene.children.length-1];if(scene.children.length>before&&line?.material){line.material.opacity=1;line.material.depthTest=false;line.material.needsUpdate=true;line.renderOrder=23;}return r;};
}
