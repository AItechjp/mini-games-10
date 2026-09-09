/* GAME 23 ULTIMATE — co-op individual continue + team-wipe area restart */
const P21_CONTINUE_LIVES=3;
let p21PersonalContinuePending=false;
let p21TeamWipePending=false;
let p21ReviveRequestPending=false;
const p21DownPlayers=new Set();

function p21LivingPlayers(){
  return [...state.players.values()].filter(p=>(p.lives??0)>0);
}
function p21RespawnNearSurvivor(id){
  const survivors=p21LivingPlayers().filter(p=>p.id!==id);
  const anchor=survivors[0];
  if(!anchor)return{x:local.x,z:local.z};
  const m=state.maze;
  const offsets=[[2.2,0],[-2.2,0],[0,2.2],[0,-2.2],[3.2,1.8],[-3.2,-1.8]];
  for(const [ox,oz] of offsets){
    const x=anchor.x+ox,z=anchor.z+oz;
    if(!m||!blocked(x,z,.68))return{x,z};
  }
  return{x:anchor.x,z:anchor.z};
}
function p21ShowPersonalContinue(){
  p21PersonalContinuePending=true;p21ReviveRequestPending=false;
  setOverlay('戦闘不能','相方が生存中。現在の進行状況を維持したまま、相方の近くからライフ3で復帰できます。','続きからコンティニュー',true);
  startBtn.disabled=false;
}
function p21ShowTeamWipe(hostCanRestart){
  p21PersonalContinuePending=false;p21ReviveRequestPending=false;p21TeamWipePending=true;
  setOverlay('TEAM DOWN','2人とも戦闘不能。現在のAREAを最初から再開します。',hostCanRestart?'このエリアを最初から':'ホストの再開を待っています',true);
  startBtn.disabled=!hostCanRestart;
}
function p21RevivePlayer(id){
  if(!isHost()||state.mode!=='coop'||!state.running)return false;
  const p=state.players.get(id);if(!p||p.lives>0)return false;
  const pos=p21RespawnNearSurvivor(id);
  p.lives=P21_CONTINUE_LIVES;p.shield=false;p.adr=0;p.inv=0;p.x=pos.x;p.z=pos.z;
  state.players.set(id,p);p21DownPlayers.delete(id);damageCooldown.delete(id);
  if(id===state.playerId){
    state.localLives=P21_CONTINUE_LIVES;state.shield=false;state.adrenalineUntil=0;local.x=pos.x;local.z=pos.z;updateCamera();
    p21PersonalContinuePending=false;overlay.classList.add('hidden');updateHud();toast('相方の近くから復帰',1200);
  }
  send('coop_revive',{target:id,area:state.area,x:+pos.x.toFixed(2),z:+pos.z.toFixed(2),lives:P21_CONTINUE_LIVES});
  sendWorld(true);return true;
}
function p21RestartAreaAfterWipe(){
  if(!isHost()||state.mode!=='coop'||!p21TeamWipePending)return;
  p21TeamWipePending=false;p21PersonalContinuePending=false;p21ReviveRequestPending=false;p21DownPlayers.clear();
  try{p14ContinuePending=false;}catch{}
  state.completed=false;state.localLives=P21_CONTINUE_LIVES;state.shield=false;state.adrenalineUntil=0;
  for(const p of state.players.values()){p.lives=P21_CONTINUE_LIVES;p.shield=false;p.adr=0;p.inv=0;}
  if(!state.players.has(state.playerId))state.players.set(state.playerId,{id:state.playerId,x:0,z:0,yaw:0,lives:P21_CONTINUE_LIVES,shield:false,adr:0});
  send('area_start',{area:state.area,seed:state.seed,difficulty:state.difficulty,lives:[...state.players.values()].map(p=>[p.id,P21_CONTINUE_LIVES])});
  beginArea(false);toast(`AREA ${state.area+1} を最初から再開`,1500);
}
function p21RequestPersonalContinue(){
  if(!p21PersonalContinuePending||state.mode!=='coop')return false;
  if(isHost())p21RevivePlayer(state.playerId);
  else if(!p21ReviveRequestPending){
    p21ReviveRequestPending=true;startBtn.disabled=true;startBtn.textContent='復帰待ち';
    send('coop_revive_request',{area:state.area});toast('ホストへ復帰を要求しました',900);
  }
  return true;
}

/* Any single down no longer ends co-op. Only a full team wipe stops the current area. */
const p21BaseFailMission=failMission;
failMission=function(reason){
  if(state.mode!=='coop'||!isHost()){return p21BaseFailMission(reason);}
  const down=[...state.players.values()].filter(p=>(p.lives??0)<=0);
  const living=p21LivingPlayers();
  if(!down.length)return;
  if(living.length>0){
    for(const p of down){
      if(p21DownPlayers.has(p.id))continue;p21DownPlayers.add(p.id);
      send('coop_player_down',{target:p.id,area:state.area,reason});
      if(p.id===state.playerId)p21ShowPersonalContinue();
    }
    /* Keep the shared world, boss HP, kill count and enemy state running for the survivor. */
    state.running=true;sendWorld(true);return;
  }
  state.running=false;p21TeamWipePending=true;p21DownPlayers.clear();
  try{fs20Fail?.();}catch{}
  send('coop_team_wipe',{area:state.area,reason});
  p21ShowTeamWipe(true);
};

/* The existing start button is reused: personal continue revives only that player; team wipe restarts the area. */
const p21BaseResetMission=resetMission;
resetMission=function(){
  if(state.mode!=='coop'){return p21BaseResetMission();}
  if(p21TeamWipePending){
    if(isHost())p21RestartAreaAfterWipe();else toast('ホストの再開を待っています');
    return;
  }
  if(p21PersonalContinuePending){p21RequestPersonalContinue();return;}
  return p21BaseResetMission();
};
/* During a single-player down the shared world stays running, so the old click handler would skip resetMission().
   Capture this specific button state and route it directly to the personal continue path. */
startBtn.addEventListener('click',e=>{
  if(!p21PersonalContinuePending)return;
  e.preventDefault();e.stopImmediatePropagation();p21RequestPersonalContinue();
},{capture:true});

/* Extend co-op protocol with down/revive/team-wipe events. */
const p21BaseNetwork=onNetwork;
onNetwork=function(m){
  const out=p21BaseNetwork(m);
  if(!m||m.from===state.playerId)return out;
  if(m.kind==='coop_player_down'&&m.area===state.area&&m.target===state.playerId){
    const me=state.players.get(state.playerId)||{id:state.playerId};me.lives=0;state.players.set(state.playerId,me);state.localLives=0;updateHud();p21ShowPersonalContinue();
  }else if(m.kind==='coop_revive_request'&&isHost()&&m.area===state.area){
    p21RevivePlayer(m.from);
  }else if(m.kind==='coop_revive'&&m.area===state.area&&m.target===state.playerId){
    const me=state.players.get(state.playerId)||{id:state.playerId};
    Object.assign(me,{lives:m.lives||P21_CONTINUE_LIVES,x:m.x,z:m.z,shield:false,adr:0,inv:0});state.players.set(state.playerId,me);
    state.localLives=m.lives||P21_CONTINUE_LIVES;state.shield=false;state.adrenalineUntil=0;local.x=m.x;local.z=m.z;updateCamera();
    p21PersonalContinuePending=false;p21ReviveRequestPending=false;overlay.classList.add('hidden');updateHud();toast('相方の近くから復帰',1200);
  }else if(m.kind==='coop_team_wipe'&&m.area===state.area){
    state.running=false;p21DownPlayers.clear();p21ShowTeamWipe(false);
  }
  return out;
};

/* Clear stale continue flags whenever a fresh area starts. */
const p21BaseBeginArea=beginArea;
beginArea=function(fromStart=true){
  p21PersonalContinuePending=false;p21ReviveRequestPending=false;p21TeamWipePending=false;p21DownPlayers.clear();
  return p21BaseBeginArea(fromStart);
};
