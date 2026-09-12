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
