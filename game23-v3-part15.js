/* GAME 23 ULTIMATE — silhouette pass for the four new infected classes */
const p15VisualBase=updateHordeVisuals;
updateHordeVisuals=function(now){
  p15VisualBase(now);if(!horde)return;const t=now*.001;let changed=false;
  for(const e of state.enemies.values()){
    if(e.boss||e.dead||!['spitter','screamer','stalker','charger'].includes(e.type))continue;const i=e.index;if(i<0||i>=horde.capacity)continue;const gait=Math.sin(t*(6.5+e.speed)+e.phase),bob=Math.abs(gait)*.07;
    if(e.type==='spitter'){
      setInst(horde.body,i,e,0,1.34+bob,0,.18,0,gait*.025,1.48,1.18,1.30);setInst(horde.head,i,e,0,2.18+bob,-.13,.10,0,gait*.06,1.02,1.02,1.02);
      setInst(horde.lArm,i,e,-.62,1.28,-.12,-.86+gait*.24,0,-.15,1.12,1.05,1.12);setInst(horde.rArm,i,e,.62,1.28,-.12,-.86-gait*.24,0,.15,1.12,1.05,1.12);
    }else if(e.type==='screamer'){
      setInst(horde.body,i,e,0,1.30+bob,0,.26,0,gait*.045,.78,1.08,.82);setInst(horde.head,i,e,0,2.17+bob,-.16,.16,0,gait*.09,1.42,1.48,1.35);
      setInst(horde.lArm,i,e,-.48,1.34,-.20,-1.40+gait*.40,0,-.28,.78,1.28,.78);setInst(horde.rArm,i,e,.48,1.34,-.20,-1.40-gait*.40,0,.28,.78,1.28,.78);setInst(horde.mouth,i,e,0,1.90+bob,-.48,.16,0,0,1.65,1.75,1.40);
    }else if(e.type==='stalker'){
      setInst(horde.body,i,e,0,1.38+bob,0,.38,0,gait*.055,.78,1.22,.76);setInst(horde.head,i,e,0,2.25+bob,-.17,.24,0,gait*.11,.84,.92,.82);
      setInst(horde.lArm,i,e,-.54,1.42,-.24,-1.20+gait*.72,0,-.22,.72,1.58,.72);setInst(horde.rArm,i,e,.54,1.42,-.24,-1.20-gait*.72,0,.22,.72,1.58,.72);
      setInst(horde.lLeg,i,e,-.20,.50,0,gait*.82,0,0,.78,1.28,.78);setInst(horde.rLeg,i,e,.20,.50,0,-gait*.82,0,0,.78,1.28,.78);
    }else if(e.type==='charger'){
      setInst(horde.body,i,e,0,1.34+bob,0,.24,0,gait*.035,1.48,1.16,1.26);setInst(horde.head,i,e,0,2.18+bob,-.15,.14,0,gait*.04,.92,.90,.94);
      setInst(horde.lArm,i,e,-.72,1.30,-.18,-1.04+gait*.46,0,-.18,1.52,1.28,1.52);setInst(horde.rArm,i,e,.72,1.30,-.18,-1.04-gait*.46,0,.18,1.52,1.28,1.52);
      setInst(horde.lLeg,i,e,-.30,.48,0,gait*.68,0,0,1.18,1.12,1.18);setInst(horde.rLeg,i,e,.30,.48,0,-gait*.68,0,0,1.18,1.12,1.18);
    }
    changed=true;
  }
  if(changed)for(const k of PERF_HORDE_PARTS)horde[k].instanceMatrix.needsUpdate=true;
};