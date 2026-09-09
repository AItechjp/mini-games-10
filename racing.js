import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const TRACK_METERS = 18900;
const TIME_LIMIT = 360;
const ROAD_HALF = 8.25;
const RIVALS = 11;
const MOBILE = matchMedia('(pointer:coarse)').matches;
const $ = id => document.getElementById(id);
const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const UP = new THREE.Vector3(0, 1, 0);

const stage = $('stage');
const mapCanvas = $('map-canvas');
const mapCtx = mapCanvas.getContext('2d');
const ui = {
  hud: $('hud'), zone: $('zone-name'), rank: $('rank'), checkpoint: $('checkpoint-label'), progress: $('progress-bar'), distance: $('distance-label'),
  elapsed: $('time-elapsed'), delta: $('delta'), speed: $('speed'), gear: $('gear'), rpm: $('rpm-bar'), boost: $('boost-bar'), surface: $('surface'),
  message: $('race-message'), countdown: $('countdown'), flash: $('flash'), loading: $('loading-layer'), start: $('start-layer'), pause: $('pause-layer'), finish: $('finish-layer'),
  finishKicker: $('finish-kicker'), finishTitle: $('finish-title'), finishCopy: $('finish-copy'), resultRank: $('result-rank'), resultTime: $('result-time'), resultSpeed: $('result-speed'), resultTop: $('result-top'),
  touch: $('touch-controls'), sound: $('sound-btn'), camera: $('camera-btn')
};

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, MOBILE ? 1.35 : 1.8));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.06;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.domElement.setAttribute('aria-label', '3D racing scene');
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x94b7c2, 0.00275);
const camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.08, 1200);
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), MOBILE ? 0.34 : 0.53, 0.5, 0.82);
composer.addPass(bloom);

const hemi = new THREE.HemisphereLight(0xcbe8ff, 0x384331, 1.75);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffe1bd, 3.4);
sun.position.set(-50, 80, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(MOBILE ? 1024 : 2048, MOBILE ? 1024 : 2048);
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 180;
sun.shadow.camera.left = -35;
sun.shadow.camera.right = 35;
sun.shadow.camera.top = 35;
sun.shadow.camera.bottom = -35;
sun.shadow.bias = -0.0008;
scene.add(sun);

const skyGeo = new THREE.SphereGeometry(700, 24, 14);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  uniforms: { topColor: { value: new THREE.Color(0x4d92c3) }, bottomColor: { value: new THREE.Color(0xf2c698) }, exponent: { value: 0.7 } },
  vertexShader: `varying vec3 vPos; void main(){vPos=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader: `uniform vec3 topColor; uniform vec3 bottomColor; uniform float exponent; varying vec3 vPos; void main(){float h=pow(clamp(normalize(vPos).y*.5+.5,0.,1.),exponent);gl_FragColor=vec4(mix(bottomColor,topColor,h),1.);}`
});
const sky = new THREE.Mesh(skyGeo, skyMat);
scene.add(sky);

const ocean = new THREE.Mesh(
  new THREE.PlaneGeometry(2200, 2200, 1, 1),
  new THREE.MeshPhysicalMaterial({ color: 0x176982, roughness: 0.2, metalness: 0.22, transparent: true, opacity: 0.94, clearcoat: 0.5 })
);
ocean.rotation.x = -Math.PI / 2;
ocean.position.y = -5.4;
ocean.receiveShadow = true;
scene.add(ocean);

const controlPoints = [
  [-110, 5, -250],[-30, 7, -330],[85, 8, -300],[175, 10, -205],[185, 14, -85],[120, 20, 25],[10, 26, 70],[-100, 35, 45],[-175, 47, -35],[-155, 56, -145],[-70, 62, -220],[55, 58, -205],[155, 48, -135],[215, 39, -20],[205, 29, 110],[120, 22, 205],[0, 17, 245],[-120, 13, 218],[-205, 11, 128],[-235, 9, 10],[-205, 7, -100]
].map(p => new THREE.Vector3(...p));
const curve = new THREE.CatmullRomCurve3(controlPoints, true, 'catmullrom', 0.32);
curve.arcLengthDivisions = 1800;
curve.updateArcLengths();

function sampleTrack(t, lane = 0) {
  const u = ((t % 1) + 1) % 1;
  const p = curve.getPointAt(u);
  const tangent = curve.getTangentAt(u).normalize();
  const side = new THREE.Vector3().crossVectors(UP, tangent).normalize();
  return { p: p.addScaledVector(side, lane), tangent, side, u };
}

function makeNoiseTexture(base = '#23262a', speck = '#373b40') {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d'); x.fillStyle = base; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2500; i++) { x.globalAlpha = Math.random() * .28; x.fillStyle = speck; x.fillRect(Math.random()*256, Math.random()*256, Math.random()*2+.4, Math.random()*2+.4); }
  x.globalAlpha = 1; x.strokeStyle = 'rgba(255,255,255,.025)'; x.lineWidth = 1;
  for (let y=24;y<256;y+=48){x.beginPath();x.moveTo(0,y);x.lineTo(256,y+Math.random()*4-2);x.stroke();}
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t;
}
function makeCurbTexture() {
  const c = document.createElement('canvas'); c.width = 128; c.height = 32; const x = c.getContext('2d');
  for (let i=0;i<8;i++){x.fillStyle=i%2?'#f1f0e8':'#cc203c';x.fillRect(i*16,0,16,32);} const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;return t;
}
function makeWindowTexture(neon = false) {
  const c=document.createElement('canvas'); c.width=128;c.height=256;const x=c.getContext('2d');x.fillStyle=neon?'#060a15':'#20232a';x.fillRect(0,0,128,256);
  for(let yy=8;yy<248;yy+=14)for(let xx=7;xx<124;xx+=15){const lit=Math.random()>.35;x.fillStyle=lit?(neon?(Math.random()>.5?'#49eaff':'#fb60ff'):'#ffd49b'):'#10151d';x.fillRect(xx,yy,6,6);}
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=THREE.SRGBColorSpace;return t;
}
function makeSignTexture(text, accent='#58e9ff') {
  const c=document.createElement('canvas');c.width=512;c.height=160;const x=c.getContext('2d');
  x.fillStyle='#050912';x.fillRect(0,0,512,160);x.strokeStyle=accent;x.lineWidth=7;x.strokeRect(4,4,504,152);x.shadowColor=accent;x.shadowBlur=22;x.fillStyle='#f4f7ff';x.font='900 62px Arial';x.textAlign='center';x.textBaseline='middle';x.fillText(text,256,80);x.shadowBlur=0;
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

const TRACK_SEGMENTS = MOBILE ? 650 : 900;
function makeRibbon(width, yOffset, mat, uvScale=22) {
  const pos=[],uv=[],idx=[];
  for(let i=0;i<=TRACK_SEGMENTS;i++){
    const t=i/TRACK_SEGMENTS; const s=sampleTrack(t); const center=s.p; const side=s.side;
    const l=center.clone().addScaledVector(side,-width); const r=center.clone().addScaledVector(side,width); l.y+=yOffset;r.y+=yOffset;
    pos.push(l.x,l.y,l.z,r.x,r.y,r.z);uv.push(i/uvScale,0,i/uvScale,1);
    if(i<TRACK_SEGMENTS){const a=i*2,b=a+1,c=a+2,d=a+3;idx.push(a,b,c,b,d,c);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
  const m=new THREE.Mesh(g,mat);m.receiveShadow=true;scene.add(m);return m;
}
function makeTerrain() {
  const widths=[-88,-12,0,12,88],pos=[],uv=[],idx=[];
  for(let i=0;i<=TRACK_SEGMENTS;i++){
    const s=sampleTrack(i/TRACK_SEGMENTS);
    for(let j=0;j<widths.length;j++){const w=widths[j],p=s.p.clone().addScaledVector(s.side,w);p.y-=Math.abs(w)>20?7.5:0.5;pos.push(p.x,p.y,p.z);uv.push(i/18,j/4);}
    if(i<TRACK_SEGMENTS){for(let j=0;j<4;j++){const a=i*5+j,b=a+1,c=a+5,d=c+1;idx.push(a,c,b,b,c,d);}}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
  const mat=new THREE.MeshStandardMaterial({color:0x38513b,roughness:.96,metalness:0});const m=new THREE.Mesh(g,mat);m.receiveShadow=true;scene.add(m);
}
makeTerrain();
const shoulderMat=new THREE.MeshStandardMaterial({color:0x55575a,roughness:.98});
makeRibbon(10.1,-.17,shoulderMat,16);
const roadTex=makeNoiseTexture(); roadTex.repeat.set(1,1);
const roadMat=new THREE.MeshStandardMaterial({map:roadTex,color:0xffffff,roughness:.82,metalness:.03});
makeRibbon(ROAD_HALF,0,roadMat,12);

function makeEdgeStrip(sign) {
  const pos=[],uv=[],idx=[],inner=ROAD_HALF+.04,outer=9.35;
  for(let i=0;i<=TRACK_SEGMENTS;i++){
    const s=sampleTrack(i/TRACK_SEGMENTS);const a=s.p.clone().addScaledVector(s.side,sign*inner);const b=s.p.clone().addScaledVector(s.side,sign*outer);a.y+=.035;b.y+=.035;
    pos.push(a.x,a.y,a.z,b.x,b.y,b.z);uv.push(i/5,0,i/5,1);if(i<TRACK_SEGMENTS){const n=i*2;idx.push(n,n+1,n+2,n+1,n+3,n+2);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
  const m=new THREE.Mesh(g,new THREE.MeshStandardMaterial({map:makeCurbTexture(),roughness:.77}));m.receiveShadow=true;scene.add(m);
}
makeEdgeStrip(-1);makeEdgeStrip(1);

function orientObject(obj, t, lane=0, y=0) {
  const s=sampleTrack(t,lane);obj.position.copy(s.p);obj.position.y+=y;
  const m=new THREE.Matrix4().makeBasis(s.side.clone(),UP.clone(),s.tangent.clone());obj.quaternion.setFromRotationMatrix(m);return s;
}

function addRoadMarkers() {
  const count=170,geom=new THREE.BoxGeometry(.11,.035,2.9),mat=new THREE.MeshStandardMaterial({color:0xf2f1e8,roughness:.7});
  for(const offset of [-2.75,2.75]){
    const mesh=new THREE.InstancedMesh(geom,mat,count);const q=new THREE.Quaternion();const sc=new THREE.Vector3(1,1,1);const mat4=new THREE.Matrix4();
    for(let i=0;i<count;i++){const t=(i+.5)/count;const s=sampleTrack(t,offset);const basis=new THREE.Matrix4().makeBasis(s.side.clone(),UP.clone(),s.tangent.clone());q.setFromRotationMatrix(basis);const p=s.p.clone();p.y+=.045;mat4.compose(p,q,sc);mesh.setMatrixAt(i,mat4);}mesh.receiveShadow=true;scene.add(mesh);
  }
}
addRoadMarkers();

let seed=94917;function rnd(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
function instancedScatter(geom,mat,count,range,offsetRange,scaleRange,yOffset=0) {
  const im=new THREE.InstancedMesh(geom,mat,count);const m=new THREE.Matrix4(),q=new THREE.Quaternion(),sc=new THREE.Vector3();
  for(let i=0;i<count;i++){
    const t=lerp(range[0],range[1],(i+rnd()*.7)/count);const sign=i%2?1:-1;const lane=sign*lerp(offsetRange[0],offsetRange[1],rnd());const s=sampleTrack(t,lane);const p=s.p.clone();p.y+=yOffset;sc.setScalar(lerp(scaleRange[0],scaleRange[1],rnd()));q.setFromAxisAngle(UP,rnd()*Math.PI*2);m.compose(p,q,sc);im.setMatrixAt(i,m);
  }im.castShadow=true;im.receiveShadow=true;scene.add(im);return im;
}
const trunkMat=new THREE.MeshStandardMaterial({color:0x5a3c28,roughness:.96});
const pineMat=new THREE.MeshStandardMaterial({color:0x1c4c35,roughness:.92});
instancedScatter(new THREE.CylinderGeometry(.2,.34,3.8,7),trunkMat,105,[.22,.49],[12,35],[.75,1.5],1.8);
instancedScatter(new THREE.ConeGeometry(2.0,7.2,8),pineMat,105,[.22,.49],[12,35],[.72,1.45],5.0);
const rockMat=new THREE.MeshStandardMaterial({color:0x62686a,roughness:.95});
instancedScatter(new THREE.DodecahedronGeometry(2.3,0),rockMat,70,[.18,.51],[18,54],[.55,1.9],1.0);

function addPalms() {
  const leavesMat=new THREE.MeshStandardMaterial({color:0x267052,roughness:.86});
  for(let i=0;i<24;i++){
    const t=.015+(i/24)*.20;const lane=(i%2?1:-1)*(15+rnd()*20);const s=sampleTrack(t,lane);const g=new THREE.Group();
    const tr=new THREE.Mesh(new THREE.CylinderGeometry(.18,.32,6.5,8),trunkMat);tr.position.y=3.2;tr.castShadow=true;g.add(tr);
    for(let k=0;k<6;k++){const leaf=new THREE.Mesh(new THREE.BoxGeometry(.35,.12,4.2),leavesMat);leaf.position.y=6.55;leaf.rotation.y=k*Math.PI/3;leaf.rotation.x=-.18;leaf.position.x=Math.sin(k*Math.PI/3)*1.1;leaf.position.z=Math.cos(k*Math.PI/3)*1.1;leaf.castShadow=true;g.add(leaf);}
    g.position.copy(s.p);scene.add(g);
  }
}
addPalms();

function addMountains() {
  for(let i=0;i<15;i++){
    const t=.24+(i/15)*.25;const lane=(i%2?1:-1)*(65+rnd()*45);const s=sampleTrack(t,lane);const h=22+rnd()*32,rad=15+rnd()*18;
    const base=new THREE.Mesh(new THREE.ConeGeometry(rad,h,7),new THREE.MeshStandardMaterial({color:i%3===0?0x58656b:0x68757a,roughness:1}));base.position.copy(s.p);base.position.y+=h*.36-7;base.rotation.y=rnd()*6;base.receiveShadow=true;scene.add(base);
    if(h>32){const snow=new THREE.Mesh(new THREE.ConeGeometry(rad*.36,h*.27,7),new THREE.MeshStandardMaterial({color:0xe4edf0,roughness:.9}));snow.position.copy(base.position);snow.position.y+=h*.38;scene.add(snow);}
  }
}
addMountains();

const windowTex=makeWindowTexture(false);const neonWindowTex=makeWindowTexture(true);
function addBuildings(range, neon=false) {
  const mat=new THREE.MeshStandardMaterial({map:neon?neonWindowTex:windowTex,emissiveMap:neon?neonWindowTex:windowTex,emissive:neon?new THREE.Color(0x5d6dff):new THREE.Color(0x44372a),emissiveIntensity:neon?1.7:.55,roughness:.75,metalness:.12});
  const count=neon?48:58;const base=new THREE.BoxGeometry(1,1,1);const im=new THREE.InstancedMesh(base,mat,count);const M=new THREE.Matrix4(),q=new THREE.Quaternion(),sc=new THREE.Vector3();
  for(let i=0;i<count;i++){
    const t=lerp(range[0],range[1],(i+rnd()*.7)/count);const lane=(i%2?1:-1)*(16+rnd()*28);const s=sampleTrack(t,lane);const h=8+rnd()*(neon?25:34);const w=4+rnd()*7;const d=4+rnd()*7;const p=s.p.clone();p.y+=h*.5-.5;const basis=new THREE.Matrix4().makeBasis(s.side.clone(),UP.clone(),s.tangent.clone());q.setFromRotationMatrix(basis);sc.set(w,h,d);M.compose(p,q,sc);im.setMatrixAt(i,M);
  }im.castShadow=false;im.receiveShadow=true;scene.add(im);
}
addBuildings([.5,.75],false);addBuildings([.76,.995],true);

function addNeonFrames() {
  const cyan=new THREE.MeshStandardMaterial({color:0x12283a,emissive:0x31e7ff,emissiveIntensity:5,roughness:.32,metalness:.45});
  const pink=new THREE.MeshStandardMaterial({color:0x2a1530,emissive:0xff4fe1,emissiveIntensity:5,roughness:.32,metalness:.45});
  for(let i=0;i<18;i++){
    const t=.765+i*.0125;const g=new THREE.Group();const mat=i%2?pink:cyan;
    const l=new THREE.Mesh(new THREE.BoxGeometry(.22,5.2,.22),mat);l.position.set(-10.1,2.6,0);const r=l.clone();r.position.x=10.1;const top=new THREE.Mesh(new THREE.BoxGeometry(20.4,.22,.22),mat);top.position.y=5.1;g.add(l,r,top);orientObject(g,t,0,.1);scene.add(g);
  }
}
addNeonFrames();

function addSigns() {
  const signs=[['APEX',.12,'#52efff'],['ALPINE GT',.34,'#ecf5ff'],['CITY RUN',.58,'#ffc062'],['VELOCITY',.79,'#ff58e5'],['FINAL SECTOR',.93,'#55f4ff']];
  for(const [text,t,accent] of signs){const s=sampleTrack(t,11.8);const mat=new THREE.MeshBasicMaterial({map:makeSignTexture(text,accent),side:THREE.DoubleSide,toneMapped:false});const mesh=new THREE.Mesh(new THREE.PlaneGeometry(8,2.5),mat);mesh.position.copy(s.p);mesh.position.y+=3.8;const basis=new THREE.Matrix4().makeBasis(s.side.clone(),UP.clone(),s.tangent.clone());mesh.quaternion.setFromRotationMatrix(basis);mesh.rotateY(Math.PI/2);scene.add(mesh);}
}
addSigns();

function createCar(color, player=false) {
  const car=new THREE.Group();
  const paint=new THREE.MeshPhysicalMaterial({color,metalness:.58,roughness:.22,clearcoat:1,clearcoatRoughness:.09});
  const dark=new THREE.MeshStandardMaterial({color:0x090b0e,metalness:.55,roughness:.38});
  const carbon=new THREE.MeshStandardMaterial({color:0x101215,metalness:.28,roughness:.58});
  const glass=new THREE.MeshPhysicalMaterial({color:0x101f2d,metalness:.1,roughness:.06,transmission:.28,transparent:true,opacity:.72});
  const chrome=new THREE.MeshStandardMaterial({color:0xaab5bf,metalness:.9,roughness:.18});
  const body=new THREE.Mesh(new RoundedBoxGeometry(3.1,.68,6.3,5,.22),paint);body.position.y=.88;body.castShadow=true;car.add(body);
  const hood=new THREE.Mesh(new RoundedBoxGeometry(2.94,.34,2.35,4,.14),paint);hood.position.set(0,1.23,1.58);hood.rotation.x=-.045;hood.castShadow=true;car.add(hood);
  const cabin=new THREE.Mesh(new RoundedBoxGeometry(2.34,.95,2.52,4,.18),paint);cabin.position.set(0,1.72,-.45);cabin.castShadow=true;car.add(cabin);
  const windows=new THREE.Mesh(new RoundedBoxGeometry(2.14,.78,2.30,4,.12),glass);windows.position.set(0,1.82,-.43);car.add(windows);
  const roof=new THREE.Mesh(new RoundedBoxGeometry(2.18,.12,1.78,3,.09),carbon);roof.position.set(0,2.23,-.55);car.add(roof);
  const splitter=new THREE.Mesh(new THREE.BoxGeometry(3.25,.12,.45),carbon);splitter.position.set(0,.53,3.13);car.add(splitter);
  const diffuser=new THREE.Mesh(new THREE.BoxGeometry(3.18,.16,.55),carbon);diffuser.position.set(0,.56,-3.08);car.add(diffuser);
  const wing=new THREE.Mesh(new THREE.BoxGeometry(3.15,.13,.48),carbon);wing.position.set(0,1.55,-3.18);car.add(wing);
  for(const x of [-1.15,1.15]){const post=new THREE.Mesh(new THREE.BoxGeometry(.12,.75,.12),carbon);post.position.set(x,1.2,-3.05);car.add(post);}
  const tireGeo=new THREE.CylinderGeometry(.61,.61,.42,24);const rimGeo=new THREE.CylinderGeometry(.35,.35,.45,16);
  const wheels=[];
  for(const x of [-1.6,1.6])for(const z of [-1.9,1.95]){const wg=new THREE.Group();wg.position.set(x,.61,z);wg.rotation.z=Math.PI/2;const tire=new THREE.Mesh(tireGeo,dark);tire.castShadow=true;const rim=new THREE.Mesh(rimGeo,chrome);wg.add(tire,rim);car.add(wg);wheels.push(wg);}
  const headMat=new THREE.MeshStandardMaterial({color:0xeaf7ff,emissive:0xcff5ff,emissiveIntensity:player?7:3,toneMapped:false});
  const tailMat=new THREE.MeshStandardMaterial({color:0xff244e,emissive:0xff163d,emissiveIntensity:4,toneMapped:false});
  for(const x of [-1.05,1.05]){const h=new THREE.Mesh(new THREE.BoxGeometry(.72,.17,.08),headMat);h.position.set(x,1.02,3.18);car.add(h);const tl=new THREE.Mesh(new THREE.BoxGeometry(.72,.18,.08),tailMat);tl.position.set(x,1.04,-3.19);car.add(tl);}
  if(player){const glow=new THREE.PointLight(0x39e8ff,4.2,8.5,2);glow.position.set(0,.25,-.7);car.add(glow);}
  car.userData={paint,wheels,body,cabin};car.scale.setScalar(.88);return car;
}

const paintChoices=['#19d8ff','#ff3b57','#f0f2f5','#ffd24b'];
let selectedPaint=paintChoices[0];
const playerCar=createCar(selectedPaint,true);scene.add(playerCar);
const rivalColors=[0xff3e57,0xffc74a,0x8b76ff,0x51d58a,0xf470d2,0xff914d,0xe6e9ef,0x32a7ff,0xd3ff3f,0xff6a3d,0x9ea5b3];
const rivals=Array.from({length:RIVALS},(_,i)=>({
  car:createCar(rivalColors[i],false), dist:42+i*22, lane:((i%4)-1.5)*2.35, targetLane:((i%4)-1.5)*2.35,
  base:213+(i%5)*5.5+rnd()*8, think:1+rnd()*3, finished:false
}));
rivals.forEach(r=>scene.add(r.car));

const zones=[
  {name:'AZURE COAST',top:0x3c85b9,bottom:0xf7c794,fog:0x8fb7c4,ground:0x355640,hemi:0xc7ecff,sun:0xffddb5,exp:1.07},
  {name:'ALPINE CREST',top:0x6284a1,bottom:0xd9edf2,fog:0xa9bec4,ground:0x465b49,hemi:0xe3f4ff,sun:0xfff0d5,exp:1.05},
  {name:'GOLDEN METRO',top:0x55284b,bottom:0xff9964,fog:0x996e73,ground:0x3f3b42,hemi:0xffc8af,sun:0xffb26a,exp:1.10},
  {name:'NEON VELOCITY',top:0x020713,bottom:0x182650,fog:0x07101d,ground:0x171720,hemi:0x5a79bd,sun:0x607cb5,exp:1.14}
];
const zTop=new THREE.Color(),zBottom=new THREE.Color(),zFog=new THREE.Color(),zHemi=new THREE.Color(),zSun=new THREE.Color();
function updateAtmosphere(progress){
  const scaled=progress*4;const a=Math.min(3,Math.floor(scaled));const b=Math.min(3,a+1);const f=b===a?0:THREE.MathUtils.smoothstep(scaled-a,.72,1);
  zTop.setHex(zones[a].top).lerp(new THREE.Color(zones[b].top),f);zBottom.setHex(zones[a].bottom).lerp(new THREE.Color(zones[b].bottom),f);zFog.setHex(zones[a].fog).lerp(new THREE.Color(zones[b].fog),f);zHemi.setHex(zones[a].hemi).lerp(new THREE.Color(zones[b].hemi),f);zSun.setHex(zones[a].sun).lerp(new THREE.Color(zones[b].sun),f);
  skyMat.uniforms.topColor.value.copy(zTop);skyMat.uniforms.bottomColor.value.copy(zBottom);scene.fog.color.copy(zFog);hemi.color.copy(zHemi);sun.color.copy(zSun);
  renderer.toneMappingExposure=lerp(1.07,zones[a].exp,f);ocean.material.color.lerpColors(new THREE.Color(0x176982),new THREE.Color(0x09182d),clamp((progress-.62)/.38,0,1));
  const night=clamp((progress-.72)/.22,0,1);sun.intensity=lerp(3.4,.55,night);hemi.intensity=lerp(1.75,.85,night);bloom.strength=lerp(MOBILE?.34:.53,MOBILE?.52:.78,night);
}

let state='menu', distance=0, speed=0, lane=0, boost=1, elapsed=0, topSpeed=0, cameraMode=0, steeringVisual=0, collisionCooldown=0, currentZone=0, checkpoint=0, shake=0, raceStartAt=0;
const input={left:false,right:false,accel:false,brake:false,boost:false};
let last=performance.now();
let audioCtx=null,osc1=null,osc2=null,filter=null,engineGain=null,soundEnabled=true;

function startAudio(){
  if(audioCtx)return;try{audioCtx=new (window.AudioContext||window.webkitAudioContext)();engineGain=audioCtx.createGain();engineGain.gain.value=.035;filter=audioCtx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=800;osc1=audioCtx.createOscillator();osc1.type='sawtooth';osc2=audioCtx.createOscillator();osc2.type='triangle';const g2=audioCtx.createGain();g2.gain.value=.26;osc1.connect(filter);osc2.connect(g2).connect(filter);filter.connect(engineGain).connect(audioCtx.destination);osc1.start();osc2.start();}catch{}
}
function updateAudio(){if(!audioCtx)return;const gear=Math.max(1,Math.min(6,Math.floor(speed/48)+1));const rpm=clamp((speed-(gear-1)*42)/48,0,1);const f=52+gear*18+rpm*88;osc1.frequency.setTargetAtTime(f,audioCtx.currentTime,.04);osc2.frequency.setTargetAtTime(f*.5,audioCtx.currentTime,.05);filter.frequency.setTargetAtTime(520+speed*5.2,audioCtx.currentTime,.06);engineGain.gain.setTargetAtTime(soundEnabled?(state==='race'?.035:.013):0,audioCtx.currentTime,.05);}

function getGamepadInput(){
  const gp=navigator.getGamepads?.()[0];if(!gp)return {steer:0,accel:0,brake:0,boost:false};return {steer:Math.abs(gp.axes[0]||0)>.08?gp.axes[0]:0,accel:gp.buttons[7]?.value||0,brake:gp.buttons[6]?.value||0,boost:!!gp.buttons[0]?.pressed};
}
function controls(){const gp=getGamepadInput();const steer=(input.left?-1:0)+(input.right?1:0)+gp.steer;return {steer:clamp(steer,-1,1),accel:Math.max(input.accel?1:0,gp.accel),brake:Math.max(input.brake?1:0,gp.brake),boost:input.boost||gp.boost};}

function setCarOnTrack(car, meters, carLane, lean=0) {
  const t=clamp(meters/TRACK_METERS,0,.999999);const s=sampleTrack(t,carLane);car.position.copy(s.p);car.position.y+=.43;
  const basis=new THREE.Matrix4().makeBasis(s.side.clone(),UP.clone(),s.tangent.clone());car.quaternion.setFromRotationMatrix(basis);car.rotateZ(-lean*.055);return s;
}
function resetRace(){
  distance=0;speed=0;lane=0;boost=1;elapsed=0;topSpeed=0;steeringVisual=0;collisionCooldown=0;currentZone=0;checkpoint=0;shake=0;
  rivals.forEach((r,i)=>{r.dist=42+i*22;r.lane=((i%4)-1.5)*2.35;r.targetLane=r.lane;r.base=213+(i%5)*5.5+rnd()*8;r.think=1+rnd()*3;r.finished=false;});
  setCarOnTrack(playerCar,0,0);rivals.forEach(r=>setCarOnTrack(r.car,r.dist,r.lane));updateHUD();
}
function rankNow(){return 1+rivals.filter(r=>r.dist>distance).length;}
function showMessage(text,ms=1400){ui.message.textContent=text;ui.message.classList.add('show');clearTimeout(showMessage.t);showMessage.t=setTimeout(()=>ui.message.classList.remove('show'),ms);}
function flash(){ui.flash.classList.remove('hit');void ui.flash.offsetWidth;ui.flash.classList.add('hit');}

function curvature(t){const a=curve.getTangentAt(clamp(t,0,.998)).normalize();const b=curve.getTangentAt(clamp(t+.0022,0,.999)).normalize();const side=new THREE.Vector3().crossVectors(UP,a).normalize();return b.dot(side);}
function updateRace(dt){
  const c=controls();collisionCooldown=Math.max(0,collisionCooldown-dt);shake=Math.max(0,shake-dt*2.8);
  const off=Math.abs(lane)>ROAD_HALF-.75;const nitro=c.boost&&boost>.01&&c.accel>.05;let max=nitro?318:286;
  let accel=(speed<110?72:speed<205?48:25)*c.accel;accel-=c.accel<.04?(14+speed*.018):0;accel-=c.brake*165;if(off)accel-=72+speed*.13;if(nitro){accel+=76;boost=Math.max(0,boost-dt*.29);}else boost=Math.min(1,boost+dt*.047);
  speed=clamp(speed+accel*dt,0,max);topSpeed=Math.max(topSpeed,speed);
  steeringVisual=THREE.MathUtils.damp(steeringVisual,c.steer,8,dt);
  lane+=c.steer*(4.9+speed/54)*dt*(off?.64:1);
  const p=clamp(distance/TRACK_METERS,0,.999);lane-=curvature(p)*Math.pow(speed/230,2)*118*dt;lane=clamp(lane,-ROAD_HALF-4,ROAD_HALF+4);
  distance=Math.min(TRACK_METERS,distance+(speed/3.6)*dt);elapsed+=dt;

  for(const r of rivals){
    r.think-=dt;if(r.think<0){r.think=1.2+rnd()*3.1;r.targetLane=clamp((Math.floor(rnd()*5)-2)*1.65,-5.6,5.6);}r.lane=THREE.MathUtils.damp(r.lane,r.targetLane,.65,dt);
    let catchup=distance-r.dist>230?18:distance-r.dist<-550?-7:0;const rv=clamp(r.base+catchup+Math.sin(elapsed*.37+r.base)*3,185,252);r.dist=Math.min(TRACK_METERS+30,r.dist+rv/3.6*dt);if(r.dist>=TRACK_METERS)r.finished=true;
    if(collisionCooldown===0&&Math.abs(r.dist-distance)<10.5&&Math.abs(r.lane-lane)<2.15){speed*=.72;lane+=(lane<=r.lane?-1:1)*1.15;collisionCooldown=.8;shake=.65;flash();showMessage('CONTACT  —  HOLD YOUR LINE');}
  }
  const z=Math.min(3,Math.floor((distance/TRACK_METERS)*4));if(z!==currentZone){currentZone=z;showMessage(zones[z].name,1700);}
  const cpNow=Math.min(3,Math.floor((distance/TRACK_METERS)*4));if(cpNow>checkpoint&&cpNow<=3){checkpoint=cpNow;showMessage(`SECTOR ${checkpoint} CLEAR`,1400);}
  if(distance>=TRACK_METERS)finish(true);else if(elapsed>=TIME_LIMIT)finish(false);
}

function updateCars(dt){
  const ps=setCarOnTrack(playerCar,distance,lane,steeringVisual);playerCar.userData.body.rotation.x=THREE.MathUtils.damp(playerCar.userData.body.rotation.x,-Math.min(.03,speed/10000),5,dt);playerCar.userData.cabin.rotation.z=THREE.MathUtils.damp(playerCar.userData.cabin.rotation.z,-steeringVisual*.02,5,dt);
  const spin=speed*dt*.045;playerCar.userData.wheels.forEach(w=>w.rotation.x-=spin);
  rivals.forEach(r=>{setCarOnTrack(r.car,r.dist,r.lane);r.car.userData.wheels.forEach(w=>w.rotation.x-=r.base*dt*.04);});
  return ps;
}

function updateCamera(dt, ps){
  if(state==='menu'){
    const t=performance.now()*.00012;const s=sampleTrack(.001,0);const orbit=new THREE.Vector3(Math.sin(t)*10,4.1,Math.cos(t)*10);camera.position.lerp(s.p.clone().add(orbit),1-Math.exp(-dt*2.5));camera.lookAt(s.p.clone().add(new THREE.Vector3(0,1.2,0)));return;
  }
  const side=ps.side,tan=ps.tangent,p=playerCar.position.clone();let desired,target;
  if(cameraMode===0){desired=p.clone().addScaledVector(tan,-10.7).addScaledVector(side,-steeringVisual*.9).add(new THREE.Vector3(0,4.5,0));target=p.clone().addScaledVector(tan,9.0).add(new THREE.Vector3(0,1.3,0));}
  else{desired=p.clone().addScaledVector(tan,1.35).add(new THREE.Vector3(0,2.02,0));target=p.clone().addScaledVector(tan,22).add(new THREE.Vector3(0,1.55,0));}
  if(shake>0){desired.x+=(Math.random()-.5)*shake*.35;desired.y+=(Math.random()-.5)*shake*.24;desired.z+=(Math.random()-.5)*shake*.35;}
  camera.position.lerp(desired,1-Math.exp(-dt*8.5));const look=camera.userData.look||(camera.userData.look=target.clone());look.lerp(target,1-Math.exp(-dt*10));camera.lookAt(look);
  camera.fov=THREE.MathUtils.damp(camera.fov,cameraMode===0?58+clamp((speed-180)/12,0,8):66,5,dt);camera.updateProjectionMatrix();
  sun.position.copy(p).add(new THREE.Vector3(-55,75,35));sun.target.position.copy(p);if(!sun.target.parent)scene.add(sun.target);sky.position.copy(camera.position);
}

function formatTime(sec){const m=Math.floor(sec/60);const s=sec-m*60;return `${String(m).padStart(2,'0')}:${s.toFixed(1).padStart(4,'0')}`;}
function updateHUD(){
  const p=clamp(distance/TRACK_METERS,0,1);ui.speed.textContent=Math.round(speed);ui.rank.textContent=rankNow();ui.progress.style.width=`${p*100}%`;ui.distance.textContent=`${(distance/1000).toFixed(1)} / ${(TRACK_METERS/1000).toFixed(1)} KM`;ui.elapsed.textContent=formatTime(elapsed);ui.zone.textContent=zones[Math.min(3,Math.floor(p*4))].name;
  ui.checkpoint.textContent=p<.25?'SECTOR 1 / 4':p<.5?'SECTOR 2 / 4':p<.75?'SECTOR 3 / 4':'FINAL SECTOR';ui.boost.style.width=`${boost*100}%`;ui.surface.textContent=Math.abs(lane)>ROAD_HALF-.75?'GRAVEL':'RACING LINE';
  const gear=speed<6?'N':Math.min(6,Math.floor(speed/47)+1);ui.gear.textContent=gear;const local=gear==='N'?0:clamp((speed-(gear-1)*42)/51,0,1);ui.rpm.style.width=`${(18+local*82)}%`;
  const target=elapsed>0?distance/(240/3.6):0;const d=elapsed-target;ui.delta.textContent=d>0?`+${d.toFixed(1)}`:`${d.toFixed(1)}`;ui.delta.classList.toggle('good',d<0);
}

function drawMap(){
  const w=mapCanvas.width,h=mapCanvas.height;mapCtx.clearRect(0,0,w,h);const pts=[];let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
  for(let i=0;i<=160;i++){const p=curve.getPointAt(i/160);pts.push(p);minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minZ=Math.min(minZ,p.z);maxZ=Math.max(maxZ,p.z);}const sx=(w-28)/(maxX-minX),sy=(h-28)/(maxZ-minZ),sc=Math.min(sx,sy),ox=(w-(maxX-minX)*sc)/2-minX*sc,oy=(h-(maxZ-minZ)*sc)/2-minZ*sc;
  mapCtx.lineJoin='round';mapCtx.lineCap='round';mapCtx.strokeStyle='rgba(255,255,255,.19)';mapCtx.lineWidth=13;mapCtx.beginPath();pts.forEach((p,i)=>{const x=p.x*sc+ox,y=p.z*sc+oy;i?mapCtx.lineTo(x,y):mapCtx.moveTo(x,y)});mapCtx.closePath();mapCtx.stroke();mapCtx.strokeStyle='#64eaff';mapCtx.lineWidth=2.5;mapCtx.stroke();
  const pp=sampleTrack(clamp(distance/TRACK_METERS,0,.999)).p;mapCtx.fillStyle='#fff';mapCtx.beginPath();mapCtx.arc(pp.x*sc+ox,pp.z*sc+oy,6,0,7);mapCtx.fill();mapCtx.fillStyle='#ff5576';for(const r of rivals){const rp=sampleTrack(clamp(r.dist/TRACK_METERS,0,.999)).p;mapCtx.beginPath();mapCtx.arc(rp.x*sc+ox,rp.z*sc+oy,3,0,7);mapCtx.fill();}
}

async function fullscreen(){try{if(!document.fullscreenElement)await $('race-shell').requestFullscreen?.()}catch{}try{await screen.orientation?.lock?.('landscape')}catch{}}
function showGameUI(on){ui.hud.classList.toggle('hidden',!on);ui.touch.classList.toggle('hidden',!on);document.body.classList.toggle('racing',on);}
async function countdownStart(){
  state='count';ui.countdown.classList.remove('hidden');let n=3;ui.countdown.textContent=n;
  await new Promise(resolve=>{const timer=setInterval(()=>{n--;if(n>0)ui.countdown.textContent=n;else if(n===0)ui.countdown.textContent='GO!';else{clearInterval(timer);resolve();}},720);});ui.countdown.classList.add('hidden');state='race';raceStartAt=performance.now();showMessage(zones[0].name,1200);
}
async function startRace(){await fullscreen();startAudio();audioCtx?.resume?.();resetRace();ui.start.classList.add('hidden');ui.finish.classList.add('hidden');ui.pause.classList.add('hidden');showGameUI(true);await countdownStart();}
function pauseToggle(force){if(state==='race'&&(force!==false)){state='paused';ui.pause.classList.remove('hidden');}else if(state==='paused'&&(force!==true)){state='race';ui.pause.classList.add('hidden');last=performance.now();}}
function finish(ok){if(state==='finish')return;state='finish';showGameUI(false);ui.finish.classList.remove('hidden');const r=rankNow();ui.finishKicker.textContent=ok?'RACE COMPLETE':'TIME LIMIT';ui.finishTitle.textContent=ok?(r===1?'VICTORY':'FINISH'):'TIME OUT';ui.finishCopy.textContent=ok?`18.9km グランドツアーを ${formatTime(elapsed)} で走破。${r===1?'総合優勝です。':'次は表彰台を狙えます。'}`:'6分の制限時間に到達しました。ライン取りとニトロの使い所を詰めて再挑戦してください。';ui.resultRank.textContent=`${r} / 12`;ui.resultTime.textContent=formatTime(elapsed);ui.resultSpeed.textContent=Math.round((distance/1000)/(Math.max(elapsed,1)/3600));ui.resultTop.textContent=Math.round(topSpeed);}

function bindHold(id,key){const el=$(id);const down=e=>{e.preventDefault();input[key]=true;el.classList.add('active')};const up=e=>{e.preventDefault();input[key]=false;el.classList.remove('active')};el.addEventListener('pointerdown',down,{passive:false});['pointerup','pointercancel','pointerleave'].forEach(t=>el.addEventListener(t,up,{passive:false}));}
bindHold('left-btn','left');bindHold('right-btn','right');bindHold('accel-btn','accel');bindHold('brake-btn','brake');bindHold('boost-btn','boost');
const keyMap={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ArrowUp:'accel',KeyW:'accel',ArrowDown:'brake',KeyS:'brake',Space:'boost'};
addEventListener('keydown',e=>{if(keyMap[e.code]){input[keyMap[e.code]]=true;e.preventDefault()}if(e.code==='KeyC'){cameraMode=(cameraMode+1)%2;ui.camera.textContent=cameraMode?'BONNET':'CHASE';}if(e.code==='KeyP')pauseToggle();});
addEventListener('keyup',e=>{if(keyMap[e.code]){input[keyMap[e.code]]=false;e.preventDefault()}});
addEventListener('blur',()=>{if(state==='race')pauseToggle(true)});document.addEventListener('visibilitychange',()=>{if(document.hidden&&state==='race')pauseToggle(true)});document.addEventListener('contextmenu',e=>e.preventDefault());
$('start-btn').onclick=startRace;$('start-fullscreen-btn').onclick=fullscreen;$('fullscreen-btn').onclick=fullscreen;$('retry-btn').onclick=startRace;$('resume-btn').onclick=()=>pauseToggle(false);
ui.camera.onclick=()=>{cameraMode=(cameraMode+1)%2;ui.camera.textContent=cameraMode?'BONNET':'CHASE';};
ui.sound.onclick=()=>{soundEnabled=!soundEnabled;ui.sound.textContent=soundEnabled?'SOUND ON':'SOUND OFF';if(audioCtx)audioCtx.resume?.();};
document.querySelectorAll('.paint').forEach((b,i)=>{b.onclick=()=>{document.querySelectorAll('.paint').forEach(x=>x.classList.remove('active'));b.classList.add('active');selectedPaint=b.dataset.color;playerCar.userData.paint.color.set(selectedPaint);};if(i===0)b.classList.add('active');});

function resize(){const w=innerWidth,h=innerHeight;renderer.setSize(w,h);renderer.setPixelRatio(Math.min(devicePixelRatio,MOBILE?1.35:1.8));camera.aspect=w/h;camera.updateProjectionMatrix();composer.setSize(w,h);bloom.resolution.set(w,h);}
addEventListener('resize',resize);

function render(now){requestAnimationFrame(render);let dt=Math.min(.033,Math.max(.001,(now-last)/1000));last=now;
  if(state==='race')updateRace(dt);const ps=updateCars(dt);updateAtmosphere(clamp(distance/TRACK_METERS,0,1));updateCamera(dt,ps);updateAudio();if(state==='race'||state==='paused'||state==='count'){updateHUD();drawMap();}
  ocean.position.x=camera.position.x;ocean.position.z=camera.position.z;composer.render();
}

resetRace();updateAtmosphere(0);setTimeout(()=>{ui.loading.classList.add('hidden');ui.start.classList.remove('hidden');},450);requestAnimationFrame(render);
