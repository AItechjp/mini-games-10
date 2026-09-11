/* Three acts use six physical biomes, with independent routes and objectives. */
const deluxeBaseStages=STAGES.slice();
const deluxeRegions=[['地下研究棟','雪原の中継基地','排水工区','隔離輸送港','地下鉄車両基地','黒曜の王座'],['封鎖病棟','黎明の頂','浄化施設','避難船埠頭','中央放送区','感染中枢']];
for(let act=1;act<3;act++)for(let biome=0;biome<6;biome++){
  const base=deluxeBaseStages[biome];
  STAGES.push({...base,jp:deluxeRegions[act-1][biome],name:`ACT ${act+1} / ${base.name}`,act,
    cols:base.cols+(act===1?2:0),rows:base.rows+(act===2?4:2),
    cell:base.cell*(act===1?.94:1.03),loops:1,
    boss:`${act===1?'REVENANT':'PRIME'} ${base.boss}`});
}
const deluxeBuildEnvironment=buildEnvironment;
buildEnvironment=function(){
  const arena=deluxeBuildEnvironment(),act=Math.floor(state.area/6);
  const tint=[0x20374b,0x33304f,0x684e42][act];
  if(cineSky)cineSky.material.uniforms.uTint.value.setHex(tint);
  if(scene.fog){scene.fog.color.setHex([0x28343c,0x322b44,0x6a6460][act]);scene.fog.density=act===1?.0065:.0048;}
  if(cineMoonLight){cineMoonLight.color.setHex([0xc0d5e8,0xbca9ef,0xffddb0][act]);cineMoonLight.intensity=[2.25,2.1,2.8][act];}
  stageSubtitle.textContent=`ACT ${act+1} / ${BlacksiteRules.CHAPTERS[state.area].title} · ${currentStage().boss}`;
  return arena;
};
// Reuse one detailed receiver and shared attachment geometry across nine loadouts.
// Materials and geometry remain in the renderer's bounded shared-resource pool.
const deluxeWeaponBase=cineMakeWeapon;
const deluxeScopeGeometry=cineKeep(new THREE.CylinderGeometry(.049,.049,.28,20));
const deluxeDrumGeometry=cineKeep(new THREE.CylinderGeometry(.095,.095,.15,20));
const deluxeRailGeometry=cineKeep(new THREE.BoxGeometry(.025,.018,.30));
cineMakeWeapon=function(){
  deluxeWeaponBase();
  const id=document.querySelector('#ops-weapon')?.value||'rifle';
  const profile={rifle:[1,0,0],smg:[.82,0,0],marksman:[1.14,1,0],carbine:[.9,0,0],machinegun:[1.10,0,1],interceptor:[.76,0,1],revolver:[.64,0,1],scout:[1.25,1,0],vanguard:[1.02,1,1]}[id]||[1,0,0];
  for(const part of cineGun.children)if(part.isMesh&&part.material!==CM.cloth&&part.material!==CM.leather)part.scale.z=profile[0];
  cineMuzzle.position.z=-.8*profile[0];
  if(profile[1]){const scope=new THREE.Mesh(deluxeScopeGeometry,CM.blackMetal);scope.rotation.x=Math.PI/2;scope.position.set(0,.23,-.12);cineGun.add(scope);}
  if(profile[2]){const drum=new THREE.Mesh(deluxeDrumGeometry,CM.metal);drum.rotation.z=Math.PI/2;drum.position.set(0,-.20,-.06);cineGun.add(drum);}
  const rail=new THREE.Mesh(deluxeRailGeometry,id==='scout'?CM.window:CM.metal);rail.position.set(.08,.055,-.28);cineGun.add(rail);
};
