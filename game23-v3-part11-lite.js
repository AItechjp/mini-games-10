/* GAME 23 PERFORMANCE PATCH — keep the open-world FPS, cut mobile CPU/GPU load. */
const liteParams=new URLSearchParams(location.search);
const liteHighQuality=liteParams.get('quality')==='high';
const liteMobile=matchMedia('(pointer:coarse)').matches||(navigator.maxTouchPoints||0)>0||innerWidth<=900;

if(!liteHighQuality){
  /* Lower internal render resolution. CSS size stays unchanged, so controls/layout remain identical. */
  renderer.setPixelRatio(liteMobile?.82:Math.min(devicePixelRatio||1,1.05));
  resize();

  /* Keep the large wall-less open map, but reduce simultaneous infected. */
  DIFF.easy.count=[28,32,36,40,46,52];
  DIFF.normal.count=[36,42,48,54,60,68];
  DIFF.nightmare.count=[48,56,64,72,80,90];

  /* Part 10's dense scenery can create hundreds of individual meshes/lights.
     Reuse the original stage decorators captured by part 9. The large open-world
     dimensions and wall-less navigation from part 10 stay active. */
  decorateMansion=expansionMansion;
  decorateMountain=expansionMountain;
  decorateRiver=expansionRiver;
  decorateSea=expansionSea;
  decorateCity=expansionCity;
  decorateCastle=expansionCastle;

  /* Open-world cells have no maze walls, so a full BFS field for every player is wasted work.
     nextPathPoint already falls back to the player's world position when there is no field. */
  updateFields=function(now){state.lastFieldUpdate=now;if(state.fields.size)state.fields.clear();};

  /* AI simulation does not need display refresh frequency. */
  const liteBaseHostWorldStep=hostWorldStep;
  let liteAiAccum=0;
  hostWorldStep=function(dt,now){
    liteAiAccum+=dt;
    const tick=liteMobile?1/30:1/40;
    if(liteAiAccum<tick)return;
    const step=Math.min(liteAiAccum,.065);
    liteAiAccum=0;
    liteBaseHostWorldStep(step,now);
  };

  /* Instanced zombie matrices are expensive: update them at 30/40 Hz instead of every RAF. */
  const liteBaseHordeVisuals=updateHordeVisuals;
  let liteLastHorde=0;
  updateHordeVisuals=function(now){
    const wait=liteMobile?33:25;
    if(now-liteLastHorde<wait)return;
    liteLastHorde=now;
    liteBaseHordeVisuals(now);
  };

  /* Water/lava/particle animation also gets a lower update cadence. */
  const liteBaseStageVisuals=updateStageVisuals;
  let liteLastStage=0;
  updateStageVisuals=function(now){
    if(now-liteLastStage<(liteMobile?42:33))return;
    liteLastStage=now;
    liteBaseStageVisuals(now);
  };

  /* The tactical map is informational; ~4 Hz is enough on a phone. */
  const liteBaseDrawMinimap=drawMinimap;
  let liteLastMap=0;
  drawMinimap=function(){
    const now=performance.now();
    if(now-liteLastMap<(liteMobile?250:180))return;
    liteLastMap=now;
    liteBaseDrawMinimap();
  };

  /* Do not ask the GPU to draw the unused +36 reserved zombie instances. */
  function liteSyncHordeCount(){
    if(!horde)return;
    let used=0;
    for(const e of state.enemies.values())if(!e.boss&&e.index>=0)used=Math.max(used,e.index+1);
    used=Math.min(used,horde.capacity||used);
    for(const m of Object.values(horde))if(m?.isInstancedMesh)m.count=used;
  }
  const liteBaseSpawnHostWorld=spawnHostWorld;
  spawnHostWorld=function(arenaZ){const r=liteBaseSpawnHostWorld(arenaZ);liteSyncHordeCount();return r;};
  const liteBaseSummonBossRunners=summonBossRunners;
  summonBossRunners=function(e,count){const r=liteBaseSummonBossRunners(e,count);liteSyncHordeCount();return r;};
  const liteBaseSyncWorld=syncWorld;
  syncWorld=function(m){const r=liteBaseSyncWorld(m);liteSyncHordeCount();return r;};

  /* On phones remove high-frequency procedural texture sampling from the horde. */
  if(liteMobile){
    for(const key of ['skin','skinRot','skinDark','cloth','clothBlood']){
      if(MAT[key]){MAT[key].map=null;MAT[key].needsUpdate=true;}
    }
  }

  const liteStyle=document.createElement('style');
  liteStyle.textContent=`
    .game23-frame.performance-mode .ux-power-panel,
    .game23-frame.performance-mode .ux-ammo-panel,
    .game23-frame.performance-mode .ow-scenery-note{backdrop-filter:none!important;-webkit-backdrop-filter:none!important;box-shadow:none!important}
    .game23-frame.performance-mode.exp-infinite,
    .game23-frame.performance-mode.exp-invincible,
    .game23-frame.performance-mode.exp-launcher{box-shadow:none!important}
  `;
  document.head.appendChild(liteStyle);
  frame.classList.add('performance-mode');
  if(owNote)owNote.textContent='広域探索 / 軽量モード';
}
