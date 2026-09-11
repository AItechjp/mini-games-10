import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import {webcrypto} from 'node:crypto';

const root=new URL('../',import.meta.url);
const core=await readFile(new URL('game23-systems-core.js',root),'utf8');
const runtime=await readFile(new URL('game23-systems.js',root),'utf8');
const loader=await readFile(new URL('game23-v3-loader.js',root),'utf8');
const parts=vm.runInNewContext(loader.match(/const PARTS = (\[[\s\S]*?\n\]);/)[1]);
const combined=(await Promise.all(parts.map(p=>readFile(new URL(p.split('?')[0],root),'utf8')))).join('\n');
const syntax=spawnSync(process.execPath,['--input-type=module','--check'],{input:combined,encoding:'utf8'});
assert.equal(syntax.status,0,syntax.stderr);
vm.runInThisContext(core);const R=globalThis.BlacksiteRules;
for(const d of ['easy','normal','nightmare'])for(const type of R.NORMAL_TYPES){assert.equal(R.health(type,d),1);assert.equal(R.damage({type,hp:99}),99);}
for(const d of ['easy','normal','nightmare'])for(const type of R.FAT_TYPES)assert.ok(R.health(type,d)>1);
assert.equal(R.health('brute','normal'),8);assert.equal(R.health('bloater','normal'),5);
assert.equal(R.damage({type:'armored',hp:6},'smg'),6);
assert.equal(R.damage({boss:true,hp:100},'rifle',true),5);
assert.equal(R.damage({type:'brute',hp:8},'marksman',true),6);
assert.equal(R.CHAPTERS.length,18);assert.equal(R.CHAPTERS.flatMap(c=>c.objectives).length+18,72);
assert.equal(R.CHAPTERS.flatMap(c=>c.intel).length,54);
assert.equal(new Set(R.CHAPTERS.flatMap(c=>c.objectives.map(o=>o.kind))).size,5);
const gate=R.sequenceGate();assert.ok(gate.accept('a',1));assert.ok(!gate.accept('a',1));assert.ok(!gate.accept('a',0));assert.ok(gate.accept('a',3));assert.ok(!gate.accept('a',2));
assert.equal(R.rayBox({x:0,y:1,z:0},{x:0,y:0,z:-1},{minX:-1,maxX:1,minZ:-5,maxZ:-4}),4);
assert.equal(R.raySphere({x:0,y:1,z:0},{x:0,y:0,z:-1},{x:0,y:1,z:-8},1),7);
let objective={kind:'defend',progress:0,target:2};
for(let i=0;i<20;i++)objective=R.objectiveStep(objective,.1,{near:true,contested:true});assert.equal(objective.progress,0);
for(let i=0;i<21;i++)objective=R.objectiveStep(objective,.1,{near:true});assert.ok(objective.done);
assert.equal(R.objectiveStep({kind:'purge',progress:0,target:4,killStart:10},.1,{kills:14}).done,true);
assert.equal(R.validCheckpoint({version:R.VERSION,area:18,seed:1,difficulty:'normal',playlist:'campaign'}),false);
assert.equal(R.validSnapshot({enemies:[],players:[]}),false);

// Execute the production runtime twice with a renderer facade and a deterministic Realtime bus.
// These tests exercise authority, game flow and packets, not WebGL or browser layout.
class Bus {
  channels=[];queue=[];
  client(){return{channel:(name)=>{const c=new Channel(this,name);this.channels.push(c);return c;},removeChannel:async c=>c.unsubscribe()};}
  presence(name){const p={};for(const c of this.channels)if(c.active&&c.name===name&&c.meta)p[c.meta.id]=[c.meta];return p;}
  sync(name){for(const c of this.channels)if(c.active&&c.name===name)this.queue.push(()=>c.callbacks.presence?.());}
  flush(){for(let i=0;this.queue.length&&i<10000;i++)this.queue.shift()();assert.equal(this.queue.length,0,'message loop');}
}
class Channel {
  constructor(bus,name){Object.assign(this,{bus,name,callbacks:{},active:true});}
  on(kind,filter,cb){this.callbacks[kind]=cb;return this;}
  subscribe(cb){this.status=cb;this.bus.queue.push(()=>cb('SUBSCRIBED'));return this;}
  async track(meta){this.meta=meta;this.bus.sync(this.name);}
  presenceState(){return this.bus.presence(this.name);}
  send({payload}){for(const c of this.bus.channels)if(c!==this&&c.active&&c.name===this.name)this.bus.queue.push(()=>c.callbacks.broadcast?.({payload:structuredClone(payload)}));return Promise.resolve('ok');}
  async unsubscribe(){this.active=false;this.bus.sync(this.name);}
}
const bus=new Bus();let now=10000;const testClients=[];
function makeContext(name){
  const nodes=new Map();
  function element(key=''){
    const classes=new Set();
    const node={value:key==='#ops-playlist'?'campaign':key==='#ops-weapon'?'rifle':key==='#ops-upgrade'?'ammo':'0',textContent:'',innerHTML:'',dataset:{},style:{},hidden:false,disabled:false,
      classList:{add:(...a)=>a.forEach(x=>classes.add(x)),remove:(...a)=>a.forEach(x=>classes.delete(x)),toggle:(x,b)=>{const use=b??!classes.has(x);use?classes.add(x):classes.delete(x);},contains:x=>classes.has(x)},
      addEventListener(){},setAttribute(){},append(){},appendChild(){},insertBefore(){},replaceChildren(){},querySelector:s=>get(s),closest:s=>get(s),getContext:()=>new Proxy({},{get:()=>()=>{}}),setPointerCapture(){}};
    return node;
  }
  function get(key){if(!nodes.has(key))nodes.set(key,element(key));return nodes.get(key);}
  class Mesh{constructor(geometry={},material={}){this.geometry=geometry;this.material=material;this.position={x:0,y:0,z:0,set(x,y,z){Object.assign(this,{x,y,z});}};this.rotation={x:0,y:0,z:0};this.userData={};this.children=[];this.visible=true;}add(o){this.children.push(o);}dispose(){}}
  const stages=Array.from({length:18},(_,i)=>['mansion','mountain','river','sea','city','castle'][i%6]).map(key=>({key,jp:key,name:key,boss:key,bossScale:3.5}));
  const state={playerId:name,mode:'solo',role:'host',area:0,seed:2,running:false,players:new Map(),enemies:new Map(),items:new Map(),walls:[],stageVisuals:[],localLives:3,fields:new Map(),difficulty:'normal',connected:false,partnerReady:false,lastPlayerSend:0};
  const scope={console,URL,URLSearchParams,crypto:webcrypto,performance:{now:()=>now},setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){},localStorage:{getItem:()=>null,setItem(){}},sessionStorage:{getItem:()=>null,setItem(){}},navigator:{clipboard:{writeText:async()=>{}}},location:{href:'https://example.test/game23.html',search:''},
    document:{hidden:false,createElement:()=>element(),querySelector:get,querySelectorAll:()=>[],addEventListener(){}},window:{},addEventListener(){},state,STAGES:stages,DIFF:Object.fromEntries(['easy','normal','nightmare'].map(k=>[k,{speed:9.6,zombieSpeed:2,runnerSpeed:4,count:[3,3,3,3,3,3],bossHp:[80,90,100,120,140,180],touchCd:1.3}])),
    $:get,frame:get('#game23-frame'),canvas:get('canvas'),overlay:get('overlay'),startBtn:get('start'),keys:new Set(),local:{x:0,z:0,yaw:0,pitch:0},touchMove:{x:0,y:0},leftTouch:null,rightTouch:null,lastRight:null,pointerLocked:false,
    touchRight:get('right'),remoteMeshes:new Map(),damageCooldown:new Map(),scene:{add(){},remove(){}},CM:{amber:{}},THREE:new Proxy({Group:Mesh,Mesh,DoubleSide:2},{get:(o,k)=>o[k]||Mesh}),
    bossMesh:null,bossBanner:get('bossbanner'),bossNameEl:get('bossname'),bossPhaseEl:get('bossphase'),goalArrow:get('arrow'),goalDirection:get('direction'),minimap:get('minimap'),minimapCtx:null,
    uxAmmo:40,uxReloading:false,uxReloadTimer:0,uxAmmoCount:get('ammo'),uxAmmoPanel:get('ammopanel'),uxReloadBtn:get('reload'),expansionPowerPanel:get('power'),itemStatus:get('itemstatus'),expansionKillCount:0,cineKick:0,cineLastShot:0,v5Roster:null,owNote:null,
    EXP_ITEMS:{life:{label:'life'},infinite:{label:'infinite'},invincible:{label:'invincible'},launcher:{label:'launcher'}},
    V5_TYPES:['walker','runner','crawler','hound','stalker','brute','spitter','leaper','armored','bloater'],
    mulberry32:a=>()=>((a=Math.imul(1664525,a)+1013904223>>>0)/4294967296),normAngle:a=>a,fmt:n=>`${Math.floor(n)}s`,clamp:R.clamp,
    difficulty:()=>scope.DIFF[state.difficulty],currentStage:()=>stages[state.area],isHost:()=>state.mode==='solo'||state.role==='host',
    client:()=>scope.backend,backend:bus.client(),toast(){},setOverlay(){},uxFireStop(){},uxJoyReset(){},uxEnter(){},uxLeave(){},uxWeaponKick(){},expansionPowerReset(){},cineMakeWeapon(){},updateCamera(){},updateHordeVisuals(){},v5TintEnemies(){},updateStageVisuals(){},updateHud(){},drawMinimap(){},syncDifficultyUI(){},flashDamage(){},expansionBlastVisual(){},
    makeHorde:capacity=>({capacity}),humanoid:()=>new Mesh(),expansionTextSprite:()=>new Mesh(),
    v5RouteAt:t=>({x:Math.sin(t*10)*10,z:-t*300}),v5SidePoint:(a,b,s,d)=>({x:a.x+s*d,z:a.z}),cellCenter:()=>({x:0,z:4}),
    blocked:(x,z,r=.68)=>state.walls.some(w=>x+r>w.minX&&x-r<w.maxX&&z+r>w.minZ&&z-r<w.maxZ),
    v5TuneEnemy:(e,type)=>Object.assign(e,{type,hp:R.health(type),maxHp:R.health(type),speed:2,v5BaseSpeed:2,headScale:1,lean:0}),
    buildEnvironment:()=>{state.maze={cols:21,rows:60,cell:6,x0:-63,z0:20};state.goal={x:0,z:-350};state.bossGate={};state.stageVisuals=[];scope.local.x=0;scope.local.z=4;return -300;},
    spawnHostWorld:arena=>{state.enemies.set('z0',{id:'z0',index:0,x:0,z:-12,hp:2,maxHp:2,boss:false,dead:false,type:'walker',speed:2,phase:0});state.enemies.set('boss',{id:'boss',index:-1,x:0,z:arena,hp:80,maxHp:80,boss:true,dead:false,speed:2,phase:1});},
    removeBossGate:()=>state.bossGate=null,bossPhase:e=>e.hp/e.maxHp>.67?1:3,
    nearestLivingPlayer:e=>{const p=[...state.players.values()].filter(x=>x.lives>0).sort((a,b)=>Math.hypot(a.x-e.x,a.z-e.z)-Math.hypot(b.x-e.x,b.z-e.z))[0];return p?{p,d:Math.hypot(p.x-e.x,p.z-e.z)}:null;},
    checkItems(){},expansionSpawnDrop(){},expansionRegisterKill:()=>scope.expansionKillCount++,
    applyWorldEnemy:a=>state.enemies.set(a[0],{id:a[0],index:a[1],x:a[2],z:a[3],hp:a[4],dead:!!a[5],boss:!!a[6],maxHp:a[7],speed:a[8],phase:a[11],type:a[16]}),
    createSyncedItem:a=>state.items.set(a[0],{id:a[0],type:a[1],x:a[2],z:a[3],taken:!!a[4]}),
    createRemoteMesh:id=>{const mesh=new Mesh();scope.remoteMeshes.set(id,mesh);return mesh;}
  };
  for(const name of ['send','beginArea','resetMission','clearArea','completeMission','failMission','hostHit','shoot','uxReload','uxUpdateAmmo','expansionPowerHud','applyItemToPlayer','damagePlayer','hostWorldStep','updateLocal','goalCheck','connect','updateLobby','syncModeUI','sendWorld','onNetwork','networkTick','updateTimer','updateGoalHud','updateBossHud'])scope[name]=()=>{};
  const context=vm.createContext(scope);vm.runInContext(core,context);vm.runInContext(runtime,context,{filename:'game23-systems.js'});
  const client={context,run:s=>vm.runInContext(s,context),get facts(){return scope.window.blacksiteSystems;}};testClients.push(client);return client;
}
async function drain(){for(let i=0;i<4;i++){await Promise.resolve();bus.flush();}}
function step(client,seconds){for(let i=0;i<seconds*25;i++){now+=40;client.run('hostWorldStep(.04);networkTick(performance.now());');for(const other of testClients)if(other!==client)other.run('networkTick(performance.now());');bus.flush();}}
const host=makeContext('host-123'),guest=makeContext('guest-456');
await host.run("connect('host','TEST23')");await guest.run("connect('guest','TEST23')");await drain();
assert.ok(host.facts.partnerReady&&guest.facts.partnerReady,'both peers admitted');
host.run("ops.ready=true;send('ready',{ready:true,weapon:'rifle'});");guest.run("ops.ready=true;send('ready',{ready:true,weapon:'marksman'});");await drain();
guest.run("send('ready',{ready:true,weapon:'constructor'});send('ready',{ready:true,weapon:{toString:'bad'}});");await drain();
assert.equal(host.run("state.players.get('guest-456').weapon"),'marksman','unknown/inherited/object weapon identifiers must not corrupt loadouts');
assert.equal(host.run("opsPlayer('test','__proto__').weapon"),'rifle');
host.run('resetMission()');await drain();
assert.ok(host.facts.running&&guest.facts.running,'host starts both players');
assert.equal(host.facts.run,guest.facts.run);assert.equal(host.facts.epoch,guest.facts.epoch);
assert.ok(R.validSnapshot(host.run('opsSnapshot()')),'real runtime emits validated snapshots');
assert.equal(guest.facts.players.find(p=>p.id==='guest-456').weapon,'marksman');

// A guest cannot manufacture legacy hit/damage packets; the host computes hits from aim.
const hp=host.facts.enemies.find(e=>e.id==='z0').hp;
guest.run("send('hit',{enemyId:'z0',playerId:'host-123'});send('damage',{target:'host-123',lives:0});");await drain();
assert.equal(host.facts.enemies.find(e=>e.id==='z0').hp,hp);
host.run("Object.assign(state.players.get('guest-456'),{x:0,z:0,ammo:15,fireAt:-1000});state.enemies.get('z0').x=0;state.enemies.get('z0').z=-12;");
guest.run("send('shot',{yaw:0,pitch:0,shotSeq:1})");await drain();
assert.equal(host.facts.enemies.find(e=>e.id==='z0').dead,true,'guest shot kills normal');
const shots=host.facts.stats.shots;guest.run("send('shot',{yaw:0,pitch:0,shotSeq:1})");await drain();assert.equal(host.facts.stats.shots,shots,'duplicate shot ignored');

host.run("state.enemies.get('z0').dead=false;state.enemies.get('z0').hp=1;state.walls=[{minX:-2,maxX:2,minZ:-6,maxZ:-5}];");step(host,.4);
guest.run("send('shot',{yaw:0,pitch:0,shotSeq:2})");await drain();assert.equal(host.facts.enemies.find(e=>e.id==='z0').dead,false,'solid cover blocks guest fire');
host.run('state.walls=[];opsSetPause(true)');await drain();const frozen=host.facts.time;step(host,1);assert.equal(host.facts.time,frozen);assert.ok(guest.facts.paused);
host.run('opsSetPause(false)');step(host,.2);assert.ok(!guest.facts.paused);

host.run("for(const e of state.enemies.values())e.dead=true;const down=state.players.get('guest-456');down.guardUntil=0;down.lives=1;damagePlayer(down.id);Object.assign(state.players.get('host-123'),{x:down.x,z:down.z,interact:true});");
step(host,2.2);assert.equal(host.facts.players.find(p=>p.id==='guest-456').lives,3);assert.equal(host.facts.stats.revives,1);
host.run("const p=state.players.get('guest-456');p.guardUntil=0;p.lives=1;damagePlayer(p.id);state.players.get('host-123').interact=false;");step(host,10.2);assert.equal(host.facts.players.find(p=>p.id==='guest-456').lives,3,'automatic co-op continue');

// Activation, defense, escort and purge all advance using the same state machine.
host.run("ops.objectives=[{id:'o',label:'test',kind:'activate',t:.2,target:.2,progress:0,x:local.x,z:local.z,done:false}];state.players.get(state.playerId).interact=true;");step(host,.4);assert.equal(host.facts.objectives[0].done,true);
host.run("for(const o of ops.objectives)o.done=true;for(const p of state.players.values())Object.assign(p,{x:state.goal.x,z:state.goal.z,lives:3});state.bossGate=null;goalCheck();");await drain();assert.equal(host.run('ops.action'),'next');
host.run('resetMission()');step(host,.2);await drain();assert.equal(host.facts.area,1);assert.equal(guest.facts.area,1);assert.equal(host.run('ops.perks.ammo'),1);
const oldEpoch=guest.facts.epoch;const old=host.run('opsSnapshot()');old.epoch=oldEpoch-1;old.run=host.facts.run;guest.context.old=old;guest.run('opsApplySnapshot(old)');assert.equal(guest.facts.epoch,oldEpoch,'old area cannot roll back');

host.run("ops.lastPeerAt=performance.now()-7000;networkTick(performance.now())");assert.ok(host.facts.lost);const lostTime=host.facts.time;host.run('hostWorldStep(.04)');assert.equal(host.facts.time,lostTime,'disconnect freezes world');
guest.run("send('resync',{})");await drain();guest.run("send('heartbeat',{})");await drain();step(host,.3);assert.ok(!host.facts.lost);assert.equal(host.facts.area,guest.facts.area);

host.run("ops.paused=false;ops.lost=false;for(const p of state.players.values()){p.guardUntil=0;p.invUntil=0;p.lives=1;}damagePlayer('host-123');damagePlayer('guest-456');");assert.equal(host.facts.running,false);now+=3100;host.run('networkTick(performance.now())');await drain();assert.ok(host.facts.running);assert.equal(host.facts.area,1,'team wipe retries current chapter');
assert.ok(host.facts.players.every(p=>p.lives===3));
console.log('GAME23 systems PASS: full loader syntax, 1-shot rules, 72 objectives, 54 intel, authoritative guest fire, cover, duplicate rejection, pause, revival, area transition, stale snapshots, reconnect, team retry');
export {makeContext};
