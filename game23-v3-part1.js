import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js';

const $ = (s) => document.querySelector(s);
const canvas = $('#game23-canvas');
const frame = $('#game23-frame');
const overlay = $('#game23-overlay');
const overlayTitle = $('#overlay-title');
const overlayText = $('#overlay-text');
const startBtn = $('#game23-start');
const bossBanner = $('#boss-banner');
const bossNameEl = $('#boss-name');
const bossPhaseEl = $('#boss-phase');
const toastEl = $('#mission-toast');
const damageFlash = $('#damage-flash');
const goalArrow = $('#goal-arrow');
const goalDirection = $('#goal-direction');
const minimap = $('#minimap');
const minimapCtx = minimap?.getContext('2d');
const itemStatus = $('#item-status');
const stageTitle = $('#stage-title');
const stageSubtitle = $('#stage-subtitle');
const touchLeft = $('#touch-left');
const touchRight = $('#touch-right');
const touchStick = $('#touch-stick');

const STAGES = [
  {key:'mansion',name:'BLOOD MOON MANOR',jp:'血月の洋館',boss:'LORD NECROHOUND',bossType:'werewolf',accent:0xdc2848,luxury:0xe9c77a,fog:0x070505,sky:0x11080a,floor:0x1c1214,wall:0x352327,cols:13,rows:31,cell:5.6,loops:.08,bossScale:3.5},
  {key:'mountain',name:'FROSTBITE RIDGE',jp:'凍てつく霊峰',boss:'GORAM THE HOWLER',bossType:'yeti',accent:0x89dcff,luxury:0xe8f3ff,fog:0x091117,sky:0x111d2a,floor:0x24302f,wall:0x46504f,cols:15,rows:34,cell:5.8,loops:.14,bossScale:4.1},
  {key:'river',name:'DROWNED RAVINE',jp:'濁流の峡谷',boss:'ABYSSAL CROCODRAKE',bossType:'croc',accent:0x39f2c4,luxury:0xb6e2d8,fog:0x061111,sky:0x10252a,floor:0x1c2b27,wall:0x324b43,cols:15,rows:33,cell:5.7,loops:.20,bossScale:4.0},
  {key:'sea',name:'TEMPEST HARBOR',jp:'暴嵐の港湾',boss:'LEVIATHAN REAVER',bossType:'leviathan',accent:0x4ac8ff,luxury:0xd8e9f3,fog:0x050b10,sky:0x101925,floor:0x14232d,wall:0x29485b,cols:17,rows:34,cell:5.5,loops:.18,bossScale:4.4},
  {key:'city',name:'NEON DEADLINE',jp:'終末ネオンシティ',boss:'TITAN EXECUTIONER',bossType:'titan',accent:0xff7b32,luxury:0xcbd4df,fog:0x07070b,sky:0x11121a,floor:0x17191d,wall:0x303943,cols:17,rows:36,cell:5.45,loops:.26,bossScale:4.7},
  {key:'castle',name:'DEVIL CASTLE NOCTURNE',jp:'悪魔城ノクターン',boss:'ARCHDEMON VALZAROTH',bossType:'demon',accent:0xb84dff,luxury:0xf0cc6c,fog:0x050207,sky:0x140617,floor:0x160f1a,wall:0x342440,cols:17,rows:39,cell:5.55,loops:.12,bossScale:5.7}
];

const DIFF = {
  easy:{label:'EASY',speed:8.8,zombieSpeed:1.75,runnerSpeed:2.8,count:[38,46,56,66,78,92],runnerRate:.12,bossSpeed:1.35,bossHp:[42,52,62,76,92,130],touchCd:2.0,regen:true},
  normal:{label:'NORMAL',speed:9.6,zombieSpeed:2.35,runnerSpeed:3.8,count:[56,68,82,96,112,132],runnerRate:.22,bossSpeed:1.9,bossHp:[88,108,132,162,205,300],touchCd:1.35,regen:false},
  nightmare:{label:'NIGHTMARE',speed:10.4,zombieSpeed:3.25,runnerSpeed:5.0,count:[76,92,110,128,148,168],runnerRate:.32,bossSpeed:2.55,bossHp:[165,205,255,320,410,620],touchCd:.78,regen:false}
};

const state = {
  mode:new URLSearchParams(location.search).get('mode') === 'coop' ? 'coop' : 'solo',
  difficulty:'normal', role:'host', room:'', channel:null, playerId:crypto.randomUUID().slice(0,8), hostId:'',
  connected:false, partnerReady:false, running:false, completed:false, area:0, seed:0,
  startedAt:0, areaStartedAt:0, localLives:3, players:new Map(), enemies:new Map(), items:new Map(),
  walls:[], goal:null, bossGate:null, maze:null, fields:new Map(), lastFieldUpdate:0,
  lastSnapshot:0,lastPlayerSend:0,lastGoalCheck:0,toastTimer:0,shield:false,adrenalineUntil:0,
  bossAbilityAt:0,bossSummonAt:0,bossChargeUntil:0,bossChargeDir:null,stageVisuals:[]
};

const renderer = new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.55));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.22;
renderer.shadowMap.enabled=false;
let scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(74,16/9,.08,230);
const raycaster=new THREE.Raycaster();
raycaster.far=125;
const clock=new THREE.Clock();
const local={x:0,z:0,yaw:0,pitch:0};
const keys=new Set();
const damageCooldown=new Map();
let pointerLocked=false,leftTouch=null,rightTouch=null,lastRight=null,touchMove={x:0,y:0},muzzleLight=null;
let horde=null,bossMesh=null,remoteMeshes=new Map(),bossWeakpoint=null;
const dummy=new THREE.Object3D();

const GEO={
  torso:new THREE.BoxGeometry(.72,1.05,.44),head:new THREE.SphereGeometry(.36,8,6),arm:new THREE.BoxGeometry(.2,.94,.2),leg:new THREE.BoxGeometry(.24,.92,.24),
  eye:new THREE.BoxGeometry(.31,.052,.052),mouth:new THREE.BoxGeometry(.25,.07,.05),bone:new THREE.CylinderGeometry(.055,.07,.42,6),
  crate:new THREE.BoxGeometry(1,1,1),rock:new THREE.DodecahedronGeometry(1,0),column:new THREE.CylinderGeometry(1,1,1,12),
  cone:new THREE.ConeGeometry(1,1,8),sphere:new THREE.SphereGeometry(1,12,8)
};
const MAT={
  skin:new THREE.MeshStandardMaterial({color:0x768266,roughness:.98}),skinRot:new THREE.MeshStandardMaterial({color:0x91806d,roughness:1}),
  skinDark:new THREE.MeshStandardMaterial({color:0x4c5848,roughness:1}),cloth:new THREE.MeshStandardMaterial({color:0x30362d,roughness:.95}),
  clothBlood:new THREE.MeshStandardMaterial({color:0x421c22,roughness:.95}),eyes:new THREE.MeshStandardMaterial({color:0xff163d,emissive:0xff001f,emissiveIntensity:3.0,roughness:.25}),
  mouth:new THREE.MeshStandardMaterial({color:0x250306,roughness:1}),bone:new THREE.MeshStandardMaterial({color:0xd8d0b5,roughness:.85}),
  player:new THREE.MeshStandardMaterial({color:0x55d8ff,roughness:.55,metalness:.1}),guest:new THREE.MeshStandardMaterial({color:0xffd166,roughness:.55,metalness:.1})
};

function mat(color,emissive=0,intensity=0,rough=.6,metal=.08,transparent=false,opacity=1){return new THREE.MeshStandardMaterial({color,emissive,emissiveIntensity:intensity,roughness:rough,metalness:metal,transparent,opacity});}
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function hashCode(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function roomCode(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let s='';crypto.getRandomValues(new Uint32Array(6)).forEach(n=>s+=chars[n%chars.length]);return s;}
function fmt(sec){sec=Math.max(0,Math.floor(sec));return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;}
function clamp(v,a,b){return Math.max(a,Math.min(b,v));}
function normAngle(a){while(a>Math.PI)a-=Math.PI*2;while(a<-Math.PI)a+=Math.PI*2;return a;}
function difficulty(){return DIFF[state.difficulty];}
function currentStage(){return STAGES[state.area];}
function isHost(){return state.mode==='solo'||state.role==='host';}
function hearts(n){return '♥'.repeat(Math.max(0,n))+'♡'.repeat(Math.max(0,3-n));}
function toast(msg,ms=1450){clearTimeout(state.toastTimer);toastEl.textContent=msg;toastEl.classList.add('show');state.toastTimer=setTimeout(()=>toastEl.classList.remove('show'),ms);}
function setOverlay(title,text,button='開始',show=true){overlayTitle.textContent=title;overlayText.textContent=text;startBtn.textContent=button;overlay.classList.toggle('hidden',!show);}
function resize(){const r=frame.getBoundingClientRect(),w=Math.max(1,Math.floor(r.width)),h=Math.max(1,Math.floor(r.height));renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();}
addEventListener('resize',resize,{passive:true});new ResizeObserver(resize).observe(frame);resize();