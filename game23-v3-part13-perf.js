/* GAME 23 final performance guard — keep camera/render responsive while heavy world systems run at 30/40 Hz. */
if(!liteHighQuality){
  const v6VisualBase=updateHordeVisuals;let v6VisualAt=0;
  updateHordeVisuals=function(now){const wait=liteMobile?34:25;if(now-v6VisualAt<wait)return;v6VisualAt=now;v6VisualBase(now);};

  const v6StageBase=updateStageVisuals;let v6StageAt=0;
  updateStageVisuals=function(now){const wait=liteMobile?34:25;if(now-v6StageAt<wait)return;v6StageAt=now;v6StageBase(now);};

  const v6HostBase=hostWorldStep;let v6HostAccum=0;
  hostWorldStep=function(dt,now){v6HostAccum+=dt;const tick=liteMobile?1/30:1/40;if(v6HostAccum<tick)return;const step=Math.min(v6HostAccum,.065);v6HostAccum=0;v6HostBase(step,now);};

  /* Fewer dynamic pixels while moving, without changing CSS size or controls. */
  renderer.setPixelRatio(liteMobile?.78:Math.min(devicePixelRatio||1,1));
  resize();
}
