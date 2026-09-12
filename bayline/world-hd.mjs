import {QUALITY,updateHDLighting,setHDWeather} from './visual-hd.mjs';
import {carModelHD} from './models-hd.mjs';
import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {BUILDINGS,ROADS,POI,CACHES,clamp,angle,rng,target,distance} from './core-hd.mjs';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z), M=(color,roughness=.6,metalness=0,extra={})=>new T.MeshStandardMaterial({color,roughness,metalness,...extra});
const PAINT=[0x173f4d,0xd4b078,0xd4d9d8,0x722d34,0x162431,0x998471,0x212226];
function texture(size,draw){const c=document.createElement('canvas');c.width=c.height=size;const g=c.getContext('2d');draw(g,size);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;return t;}
function surfaces(){
 const random=rng(1628);
 const asphalt=texture(256,(g,n)=>{g.fillStyle='#394044';g.fillRect(0,0,n,n);for(let i=0;i<20000;i++){const q=Math.floor(33+random()*55);g.fillStyle=`rgba(${q},${q+2},${q+4},.45)`;g.fillRect(random()*n,random()*n,1+random()*2,1);}for(let i=0;i<8;i++){g.strokeStyle='rgba(12,20,24,.2)';g.lineWidth=1;g.beginPath();let x=random()*n,y=random()*n;g.moveTo(x,y);for(let j=0;j<8;j++){x+=random()*14-7;y+=random()*16;g.lineTo(x,y);}g.stroke();}});asphalt.repeat.set(65,65);
 const wall=texture(512,(g,n)=>{g.fillStyle='#798185';g.fillRect(0,0,n,n);for(let i=0;i<12000;i++){const v=70+Math.floor(random()*80);g.fillStyle=`rgba(${v},${v},${v},.12)`;g.fillRect(random()*n,random()*n,2,2);}for(let y=0;y<n;y+=64)for(let x=0;x<n;x+=64){g.fillStyle='#343e44';g.fillRect(x+7,y+5,48,50);const lit=random()>.58;let a=g.createLinearGradient(x,y,x+48,y+52);a.addColorStop(0,lit?'#e6c294':'#627b8b');a.addColorStop(.5,lit?'#9a846e':'#334958');a.addColorStop(1,lit?'#d1b89a':'#152733');g.fillStyle=a;g.fillRect(x+10,y+8,42,43);g.fillStyle='rgba(11,22,29,.55)';g.fillRect(x+30,y+8,2,43);g.fillRect(x+9,y+28,43,2);g.fillStyle='rgba(224,232,227,.3)';g.fillRect(x+10,y+8,1,43);if(lit){g.fillStyle='rgba(40,35,28,.28)';g.fillRect(x+12,y+11,9,40);}g.fillStyle='#303d43';g.fillRect(x+6,y+54,50,3);}});
 const emission=texture(512,(g,n)=>{const r=rng(121);g.fillStyle='#000';g.fillRect(0,0,n,n);for(let y=0;y<n;y+=64)for(let x=0;x<n;x+=64){if(r()>.65){g.fillStyle=['#705234','#cdb193','#99866f'][Math.floor(r()*3)];g.fillRect(x+11,y+9,40,40);g.fillStyle='#000';g.fillRect(x+30,y+8,2,43);g.fillRect(x+9,y+28,43,2);}}});
 const concrete=texture(128,(g,n)=>{g.fillStyle='#a6aaa6';g.fillRect(0,0,n,n);for(let i=0;i<6000;i++){g.fillStyle=`rgba(35,47,47,${random()*.13})`;g.fillRect(random()*n,random()*n,1.3,1.3);}g.strokeStyle='rgba(40,53,55,.35)';g.lineWidth=1;g.strokeRect(0,0,n,n);});concrete.repeat.set(4,4);
 const glow=texture(128,(g,n)=>{const a=g.createRadialGradient(n/2,n/2,0,n/2,n/2,n/2);a.addColorStop(0,'rgba(255,255,255,1)');a.addColorStop(.14,'rgba(255,238,200,.8)');a.addColorStop(.4,'rgba(255,215,160,.15)');a.addColorStop(1,'rgba(255,215,160,0)');g.fillStyle=a;g.fillRect(0,0,n,n);});
 return{asphalt,wall,emission,concrete,glow};
}
function label(text,fg='#e7d3b3',bg='#132832'){return texture(512,(g,n)=>{g.fillStyle=bg;g.fillRect(0,0,n,n);g.strokeStyle=fg;g.lineWidth=4;g.strokeRect(18,150,476,210);g.textAlign='center';g.textBaseline='middle';g.font='bold 46px sans-serif';g.fillStyle=fg;g.fillText(text,256,245,458);g.font='16px sans-serif';g.fillText('B A Y L I N E  /  A F T E R  H O U R S',256,310,450);});}
function hull(sections){const pos=[],ind=[],normals=[];for(const [z,w,low,high] of sections){pos.push(-w,low,z,w,low,z,w,high,z,-w,high,z);}for(let j=0;j<sections.length-1;j++)for(let k=0;k<4;k++){let a=j*4+k,b=j*4+(k+1)%4,c=b+4,d=a+4;ind.push(a,b,d,b,c,d);}ind.push(0,3,1,1,3,2);let a=(sections.length-1)*4;ind.push(a,a+1,a+3,a+1,a+2,a+3);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(pos.length/3*2),2));g.setAttribute('uv',new T.Float32BufferAttribute(new Float32Array(pos.length/3*2),2));g.setIndex(ind);g.computeVertexNormals();return g;}
function personModel(kind=0){
 const g=new T.Group(),skin=M(kind===1?0x815843:0xb48b70,.88),cloth=M(kind===2?0x30383b:kind===1?0x886746:0x263b45,.86),pants=M(0x1d252c,.9),boot=M(0x101517,.85),hair=M(0x171b1c,.95),trim=M(0x525d60,.75);
 const mesh=(geo,mat,x,y,z,parent=g)=>{const m=new T.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;};
 const torso=mesh(new T.CylinderGeometry(.22,.17,.58,10),cloth,0,1.19,0);torso.scale.z=.7;
 mesh(new T.SphereGeometry(.22,12,10),pants,0,.88,0).scale.set(1,.65,.72);
 mesh(new T.CylinderGeometry(.066,.08,.1,8),skin,0,1.51,0);
 mesh(new T.SphereGeometry(.133,16,12),skin,0,1.69,.01).scale.set(.88,1.18,.93);
 mesh(new T.SphereGeometry(.14,12,8,0,Math.PI*2,0,Math.PI*.58),hair,0,1.72,0).scale.set(.89,1.04,1);
 mesh(new T.BoxGeometry(.036,.045,.053),skin,0,1.69,.126);
 for(const x of [-.05,.05])mesh(new T.BoxGeometry(.03,.012,.017),hair,x,1.72,.122);
 mesh(new T.BoxGeometry(.024,.48,.03),trim,0,1.23,.155);
 for(const x of [-.11,.11])mesh(new T.BoxGeometry(.1,.11,.035),cloth,x,1.22,.17);
 const arms=[],legs=[];
 for(const side of [-1,1]){
  const leg=new T.Group();leg.position.set(side*.12,.88,0);g.add(leg);mesh(new T.CylinderGeometry(.092,.065,.4,9),pants,0,-.22,0,leg);mesh(new T.CylinderGeometry(.07,.056,.4,9),pants,0,-.59,.012,leg);mesh(new T.BoxGeometry(.15,.12,.27),boot,0,-.82,.065,leg);legs.push(leg);
  const arm=new T.Group();arm.position.set(side*.25,1.42,0);g.add(arm);mesh(new T.CylinderGeometry(.09,.065,.29,9),cloth,side*.017,-.14,0,arm);mesh(new T.CylinderGeometry(.064,.049,.27,9),cloth,side*.026,-.405,.025,arm);mesh(new T.SphereGeometry(.06,8,8),skin,side*.027,-.56,.03,arm);arms.push(arm);
 }
 const weapon=new T.Group();weapon.position.set(.28,.86,.2);mesh(new T.BoxGeometry(.065,.085,.28),M(0x171e23,.38,.75),0,0,.05,weapon);mesh(new T.BoxGeometry(.06,.14,.06),boot,0,-.09,-.04,weapon);g.add(weapon);
 if(kind===2){mesh(new T.BoxGeometry(.37,.37,.12),M(0x222a2b,.9),0,1.21,.14);mesh(new T.SphereGeometry(.15,12,8,0,Math.PI*2,0,Math.PI*.55),cloth,0,1.77,0);}
 g.userData={arms,legs,weapon};return g;
}
const SKY_VERTEX='varying vec3 vDirection; void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
const SKY_FRAGMENT=`varying vec3 vDirection;uniform float phase;void main(){vec3 d=normalize(vDirection);float h=clamp(d.y,0.,1.);vec3 top=mix(vec3(.11,.23,.36),vec3(.018,.039,.091),phase);vec3 horizon=mix(vec3(.83,.57,.40),vec3(.23,.28,.38),phase);vec3 col=mix(horizon,top,pow(h,.35));vec3 sun=normalize(vec3(-.7,.12,-.65));float s=max(dot(d,sun),0.);col+=vec3(1.,.6,.26)*pow(s,240.)*(1.-phase)*.55;col+=vec3(1.4,.96,.57)*smoothstep(.99955,.99985,s)*(1.-phase)*3.;float cloud=sin(d.x*22.+sin(d.z*18.))*sin(d.z*35.+d.y*19.);col+=vec3(.12,.1,.1)*smoothstep(.38,.9,cloud)*smoothstep(.02,.12,d.y)*(1.-smoothstep(.25,.42,d.y))*(1.-phase*.7);gl_FragColor=vec4(col,1.);}`;
export class CityView{
 constructor(canvas,quality='high'){
  this.canvas=canvas;this.quality=quality;this.scene=new T.Scene();this.scene.fog=new T.FogExp2(0x71818b,.00095);this.camera=new T.PerspectiveCamera(59,1,.12,3500);this.renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;this.tex=surfaces();this.staticBatches=new Map();this.dynamicCars=new Map();this.actors=new Map();this.effects=[];this.lastEvent=0;this.shake=0;this.clock=0;this.lamps=[];this.cameraReady=false;
  this.sun=new T.DirectionalLight(0xffd4a5,2.4);this.sun.castShadow=true;this.sun.shadow.camera.left=-90;this.sun.shadow.camera.right=90;this.sun.shadow.camera.top=90;this.sun.shadow.camera.bottom=-90;this.sun.shadow.camera.near=2;this.sun.shadow.camera.far=350;this.sun.shadow.normalBias=.035;this.sun.shadow.bias=-.00013;this.scene.add(this.sun,this.sun.target);this.hemi=new T.HemisphereLight(0xa8d0ee,0x565b53,2.05);this.scene.add(this.hemi);
  this.sky=new T.Mesh(new T.SphereGeometry(2700,40,24),new T.ShaderMaterial({side:T.BackSide,uniforms:{phase:{value:0}},vertexShader:SKY_VERTEX,fragmentShader:SKY_FRAGMENT,depthWrite:false}));this.scene.add(this.sky);
  this.buildWorld();this.flush();
  // One local reflection capture supplies the PBR environment; no giant external asset downloads.
  const rt=new T.WebGLCubeRenderTarget(128,{type:T.HalfFloatType});const cc=new T.CubeCamera(.3,2600,rt);cc.position.set(0,9,30);this.renderer.shadowMap.enabled=false;cc.update(this.renderer,this.scene);const pmrem=new T.PMREMGenerator(this.renderer);this.scene.environment=pmrem.fromCubemap(rt.texture).texture;rt.dispose();pmrem.dispose();
  this.composer=new EffectComposer(this.renderer);this.composer.addPass(new RenderPass(this.scene,this.camera));this.bloom=new UnrealBloomPass(new T.Vector2(800,600),.23,.55,1.18);this.composer.addPass(this.bloom);this.composer.addPass(new OutputPass());
  this.marker=new T.Group();const ring=new T.Mesh(new T.TorusGeometry(2.8,.075,8,64),M(0xf1ca82,.4,.2,{emissive:0xffc66b,emissiveIntensity:2}));ring.rotation.x=Math.PI/2;ring.position.y=.18;this.marker.add(ring);const beam=new T.Mesh(new T.CylinderGeometry(.11,.11,12,8),new T.MeshBasicMaterial({color:0xffd58c,transparent:true,opacity:.4,depthWrite:false}));beam.position.y=6;this.marker.add(beam);const arrow=new T.Mesh(new T.ConeGeometry(.8,1.3,4),M(0xffca71,.3,0,{emissive:0xffab35,emissiveIntensity:1}));arrow.rotation.z=Math.PI;arrow.position.y=4;this.marker.add(arrow);this.scene.add(this.marker);this.markerArrow=arrow;
  this.cacheMeshes=CACHES.map(c=>{const g=new T.Group();const m=new T.Mesh(new T.BoxGeometry(.62,.34,.43),M(0x826839,.3,.65,{emissive:0xa67b23,emissiveIntensity:.3}));m.castShadow=true;g.add(m);const l=new T.Mesh(new T.BoxGeometry(.64,.05,.05),M(0xffc96a,.4,0,{emissive:0xffb640,emissiveIntensity:2}));l.position.set(0,.15,.2);g.add(l);g.position.set(c.x,.45,c.z);this.scene.add(g);return g;});
  this.localLights=Array.from({length:6},()=>{const l=new T.PointLight(0xffca87,13,21,1.5);this.scene.add(l);return l;});
  this.headlights=[-1,1].map(side=>{const l=new T.SpotLight(0xe6f1ff,95,80,.38,.65,1.3);this.scene.add(l,l.target);l.userData.side=side;return l;});
  this.makeRain();this.setQuality(quality);this.resize();
 }
 batch(geometry,material,x,y,z,sx=1,sy=1,sz=1,ry=0,rz=0){const key=geometry.uuid+material.uuid;if(!this.staticBatches.has(key))this.staticBatches.set(key,{geometry,material,matrices:[]});this.staticBatches.get(key).matrices.push(new T.Matrix4().compose(V(x,y,z),new T.Quaternion().setFromEuler(new T.Euler(0,ry,rz)),V(sx,sy,sz)));}
 flush(){for(const {geometry,material,matrices}of this.staticBatches.values()){const m=new T.InstancedMesh(geometry,material,matrices.length);matrices.forEach((a,i)=>m.setMatrixAt(i,a));m.castShadow=true;m.receiveShadow=true;m.computeBoundingSphere();this.scene.add(m);}this.staticBatches.clear();}
 buildWorld(){
  const sc=this.scene,tx=this.tex,random=rng(331),box=new T.BoxGeometry(1,1,1),cyl=new T.CylinderGeometry(.5,.5,1,8),ball=new T.IcosahedronGeometry(1,1);
  const asphalt=M(0x697378,.51,.21,{map:tx.asphalt,bumpMap:tx.asphalt,bumpScale:.045}),concrete=M(0xa7a9a4,.9,.05,{map:tx.concrete}),stone=M(0x64757a,.8,.2),dark=M(0x1b2b32,.6,.5),white=M(0xc5c8b7,.78),yellow=M(0xc5a257,.7),grass=M(0x3b5347,.94),wood=M(0x665447,.9),leaf=M(0x314e43,.83,0,{side:T.DoubleSide}),bark=M(0x756e5f,.97);
  const B=(x,y,z,w,h,d,mat=concrete,ry=0)=>this.batch(box,mat,x,y,z,w,h,d,ry);
  const ground=new T.Mesh(new T.PlaneGeometry(1080,1080),asphalt);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;sc.add(ground);
  for(let ix=0;ix<6;ix++)for(let iz=0;iz<6;iz++){const x=-400+ix*160,z=-400+iz*160;B(x,.06,z,132,.15,132);B(x,.155,z,125,.025,125,(ix===2&&iz===3)?grass:concrete);for(const a of [-1,1]){B(x+a*64,.22,z,1.2,.26,130,white);B(x,.22,z+a*64,130,.26,1.2,white);}}
  // Lane stripes, tactile crossings, recessed drains, street lights and planted verges.
  const lampMat=M(0xffe3ab,.35,.2,{emissive:0xffc56d,emissiveIntensity:3});
  for(const r of ROADS){for(let n=-510;n<=510;n+=15){B(r-.2,.014,n,.1,.024,6,yellow);B(r+.2,.014,n,.1,.024,6,yellow);B(n,.015,r-.2,6,.024,.1,yellow);B(n,.015,r+.2,6,.024,.1,yellow);if(ROADS.every(v=>Math.abs(v-n)>19)){for(const side of [-1,1]){B(r+side*9.6,.014,n,.14,.023,10,white);B(n,.014,r+side*9.6,10,.023,.14,white);}}}
   for(let n=-450;n<=450;n+=64){for(const orient of [0,1]){const x=orient?n:r+12.6,z=orient?r-12.6:n;B(x,3.5,z,.12,7,.12,dark);B(x-(orient?0:1.4),7,z+(orient?1.4:0),orient?.12:2.9,.12,orient?2.9:.12,dark);B(x-(orient?0:2.65),6.94,z+(orient?2.65:0),orient?.44:.85,.09,orient?.85:.44,lampMat);this.lamps.push(V(x-(orient?0:2.65),6.8,z+(orient?2.65:0)));}}
  }
  for(const x of ROADS)for(const z of ROADS){for(let i=-4;i<=4;i++){B(x+i*1.1,.018,z-14,.55,.025,3.2,white);B(x+i*1.1,.018,z+14,.55,.025,3.2,white);B(x-14,.019,z+i*1.1,3.2,.025,.55,white);B(x+14,.019,z+i*1.1,3.2,.025,.55,white);}B(x+11,2.4,z+11,.09,4.8,.09,dark);B(x+11,4.4,z+11,.35,.9,.3,dark);B(x+11,4.65,z+11.16,.19,.19,.04,M(0x9b291d,.5,0,{emissive:0xe74721,emissiveIntensity:.5}));B(x+12,.16,z+22,.55,.05,1.4,dark);}
  const wallMats=[0xadb2b1,0x617886,0xaca397].map(color=>M(color,.57,.32,{map:tx.wall,emissiveMap:tx.emission,emissive:0xffdcc0,emissiveIntensity:.65}));
  const geoGroups=[[],[],[]];
  const facade=(b,x,z,w,h,d,base=0)=>{const g=new T.BoxGeometry(w,h,d);const p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv;for(let i=0;i<p.count;i++){uv.setXY(i,(Math.abs(n.getX(i))>.5?p.getZ(i):p.getX(i))/24+(b.seed%19),p.getY(i)/26);}g.translate(x,base+h/2,z);geoGroups[b.style%3].push(g);};
  for(const b of BUILDINGS){const{x,z,w,d,h}=b;facade(b,x,z,w,h,d,.2);B(x,h+.4,z,w+1,.8,d+1,b.style===1?dark:stone);B(x,.6,z,w+1,1.1,d+1,stone);if(h>60){facade(b,x,z,w*.67,h*.23,d*.72,h+.7);B(x,h*1.23+1.05,z,w*.67+.8,.7,d*.72+.8,stone);B(x,h*1.23+6,z,.28,10,.28,silverMaterial());}
   for(let y=4;y<h;y+=b.style===1?13:6.8){B(x,y,z,w+.4,.22,d+.4,b.style===1?dark:stone);}
   for(const side of [-1,1]){B(x+side*(w/2-.12),h/2,z,.4,h,d+.5,b.style===1?stone:concrete);}
   B(x+w*.2,h+1,z-d*.17,3.2,1.4,4.2,dark);B(x-w*.2,h+1,z+d*.16,2.1,1.6,3.5,stone);
   if(b.id%5===0&&h<60){const mat=M(b.id%2?0x703c30:0x244c50,.9);B(x,3.1,z+d/2+.9,w*.7,.2,2.5,mat);for(const side of [-1,1])B(x+side*w*.33,1.6,z+d/2+1.2,.09,3.1,.09,dark);}
   if(b.id%11===0){const sign=new T.Mesh(new T.PlaneGeometry(w*.7,4.2),new T.MeshStandardMaterial({map:label(['NIGHT OWL','ATLAS','BAYLINE','VELVET','COFFEE','HARBOR'][b.id%6]),emissive:0xffd1a0,emissiveIntensity:.3,side:T.DoubleSide,roughness:.55}));sign.position.set(x,4.3,z+d/2+.07);sc.add(sign);}
  }
  geoGroups.forEach((gs,i)=>{const m=new T.Mesh(mergeGeometries(gs,false),wallMats[i]);m.castShadow=true;m.receiveShadow=true;sc.add(m);gs.forEach(g=>g.dispose());});
  // Palms: curved fronds and individually modeled trunks, batched across the city.
  const frondPos=[],frondIndex=[];for(let i=0;i<=9;i++){const t=i/9,w=Math.sin(t*Math.PI)*.64;frondPos.push(t*4.3,Math.sin(t*Math.PI)*.8-t*t*1.7,-w,t*4.3,Math.sin(t*Math.PI)*.8-t*t*1.7,w);if(i<9){const j=i*2;frondIndex.push(j,j+2,j+1,j+1,j+2,j+3);}}
  const frond=new T.BufferGeometry();frond.setAttribute('position',new T.Float32BufferAttribute(frondPos,3));frond.setIndex(frondIndex);frond.computeVertexNormals();
  const palm=(x,z,h=6)=>{this.batch(cyl,bark,x,h/2,z,.32,h,.32,0,.045);for(let k=0;k<8;k++)this.batch(frond,leaf,x,h,z,1,1,1,k*Math.PI/4+random()*.15);this.batch(ball,leaf,x,h,z,.65,.4,.65);B(x,.19,z,2.1,.04,2.1,grass);};
  for(let i=-455;i<500;i+=36){palm(510,i,5.5+random()*2);palm(i,510,5.5+random()*2);if(Math.abs(i%160)>22){palm(-15.5,i,6.5);palm(i,15.5,6.5);}}
  for(let i=0;i<78;i++){const bx=-400+Math.floor(random()*6)*160,bz=-400+Math.floor(random()*6)*160,x=bx+(random()>.5?62:-62),z=bz+(random()-.5)*90;this.batch(cyl,bark,x,1.8,z,.3,3.6,.3);for(let k=0;k<3;k++)this.batch(ball,leaf,x+(random()-.5)*2,3.7+random()*1.5,z+(random()-.5)*2,2.1+random(),2.5,2.1);}
  // Public garden with reflecting pool, low planting, sculpture and seating.
  B(-80,.18,80,115,.05,115,grass);B(-80,.2,80,6,.05,115,concrete);B(-80,.21,80,115,.05,6,concrete);const pool=new T.Mesh(new T.CylinderGeometry(16,16,.25,64),M(0x315363,.18,.65));pool.position.set(-80,.66,80);pool.receiveShadow=true;sc.add(pool);this.batch(cyl,stone,-80,.4,80,33,.3,33);sc.add(pool);B(-80,3.5,80,2,6.5,2,stone,.6);
  for(let k=0;k<8;k++){const a=k*Math.PI/4,x=-80+Math.sin(a)*32,z=80+Math.cos(a)*32;for(let j=0;j<5;j++)B(x,.67,z+j*.13,2.8,.08,.09,wood);B(x,.95,z+.7,2.8,.55,.08,wood);for(const side of [-1,1])B(x+side*1.1,.37,z+.35,.09,.7,.09,dark);}
  // Waterfront edge and distant port: geometry beyond the drivable coastal boundary.
  B(536,-.55,0,10,1.1,1080,stone);B(0,-.55,536,1080,1.1,10,stone);for(let i=-500;i<530;i+=8){B(533,.85,i,.07,1.7,.07,silverMaterial());B(i,.85,533,.07,1.7,.07,silverMaterial());}B(533,1.45,0,.07,.07,1060,dark);B(0,1.45,533,1060,.07,.07,dark);
  B(600,-.3,-280,170,.6,250,stone);
  const containerMats=[0x943f32,0x2b4e5a,0xa89368,0x526656].map(c=>M(c,.79,.25));for(let i=0;i<28;i++){const x=550+(i%5)*25,z=-380+Math.floor(i/5)*16;B(x,2.5,z,21,5,10,containerMats[i%4]);if(i%3===0)B(x,7.5,z,21,5,10,containerMats[(i+1)%4]);}
  for(let i=0;i<3;i++){const x=590+i*46,z=-380;B(x,25,z,2.5,50,2.5,yellow);B(x,50,z+18,2,2,66,yellow);B(x,41,z-8,1.5,23,1.5,yellow);B(x,54,z-11,2,7,2,yellow);B(x,34,z+41,.07,31,.07,dark);B(x,19,z+41,3,2,2,dark);}
  // Low, organic ridgelines keep the horizon grounded without boxing the player in.
  const mountains=M(0x465463,.96);for(let i=0;i<25;i++){const a=i/25*Math.PI*1.25+Math.PI*.8,r=1250+random()*500;const geo=new T.ConeGeometry(120+random()*220,140+random()*260,9,1);const m=new T.Mesh(geo,mountains);m.position.set(Math.sin(a)*r,60,Math.cos(a)*r);m.scale.z=1.8;m.rotation.y=random()*6;sc.add(m);}
  this.ocean=new T.Mesh(new T.PlaneGeometry(6500,6500,72,72).rotateX(-Math.PI/2),new T.ShaderMaterial({uniforms:{time:{value:0}},vertexShader:`uniform float time;varying vec3 wp;void main(){vec3 p=position;p.y+=sin(p.x*.015+time*.45)*.17+cos(p.z*.017+time*.32)*.13;wp=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(wp,1.);}`,fragmentShader:`uniform float time;varying vec3 wp;void main(){vec3 n=normalize(vec3(sin(wp.x*.04+time)*.05+sin(wp.z*.13+time)*.025,1.,cos(wp.z*.038+time*.8)*.055));vec3 v=normalize(cameraPosition-wp);float f=pow(1.-max(dot(n,v),0.),3.);vec3 c=mix(vec3(.035,.12,.16),vec3(.43,.47,.5),f);vec3 h=normalize(v+normalize(vec3(-.7,.2,-.65)));c+=vec3(.85,.56,.32)*pow(max(dot(n,h),0.),100.)*.7;c+=sin(wp.x*.08+sin(wp.z*.03)+time)*.008;gl_FragColor=vec4(c,1.);}`}));this.ocean.position.y=-.65;sc.add(this.ocean);
  this.colliders=BUILDINGS.map(b=>new T.Box3(V(b.x-b.w/2,0,b.z-b.d/2),V(b.x+b.w/2,b.h+1,b.z+b.d/2)));
 }
 makeRain(){const r=rng(115),points=[];for(let i=0;i<700;i++){const x=(r()-.5)*80,y=r()*35,z=(r()-.5)*80;points.push(x,y,z,x+.14,y-.8,z+.08);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points,3));const mat=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time:{value:0}},vertexShader:'uniform float time;void main(){vec3 p=position;p.y=mod(p.y-time*17.,35.);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',fragmentShader:'void main(){gl_FragColor=vec4(.7,.82,.9,.25);}'});this.rain=new T.LineSegments(g,mat);this.rain.frustumCulled=false;this.rain.visible=false;this.scene.add(this.rain);}
 setWeather(rain){this.rain.visible=!!rain;this.scene.fog.density=rain?.00175:.00095;if(this.hdInstalled)setHDWeather(this,rain);}
 setQuality(q){
  this.quality=QUALITY[q]?q:'high';const cfg=QUALITY[this.quality];
  const area=Math.max(1,(this.canvas.clientWidth||innerWidth)*(this.canvas.clientHeight||innerHeight));
  const pixelCap=this.quality==='ultra'?8294400:this.quality==='high'?3700000:2200000;
  const dpr=Math.min(devicePixelRatio||1,cfg.dpr,Math.sqrt(pixelCap/area));
  this.renderer.setPixelRatio(dpr);this.renderer.shadowMap.enabled=cfg.shadow>0;
  const size=cfg.shadow||1024;
  if(this.sun.shadow.mapSize.x!==size){this.sun.shadow.mapSize.set(size,size);if(this.sun.shadow.map){this.sun.shadow.map.dispose();this.sun.shadow.map=null;}}
  if(this.hdAO)this.hdAO.enabled=cfg.ao;
  if(this.composer)this.composer.setPixelRatio(dpr);
  this.resize();
 }
 resize(){const w=this.canvas.clientWidth||innerWidth,h=this.canvas.clientHeight||innerHeight;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();this.renderer.setSize(w,h,false);if(this.composer){this.composer.setSize(w,h);if(this.hdAO)this.hdAO.setSize(Math.max(1,Math.round(w*this.renderer.getPixelRatio()*.6)),Math.max(1,Math.round(h*this.renderer.getPixelRatio()*.6)));}}
 effect(e,localId){if(e.type==='shot'||e.type==='enemyshot'){const len=finiteRange(e.range),start=V(e.x,1.35,e.z),end=V(e.x+Math.sin(e.yaw)*len,1.35,e.z+Math.cos(e.yaw)*len),g=new T.BufferGeometry().setFromPoints([start,end]),mat=new T.LineBasicMaterial({color:e.type==='shot'?0xffe8b4:0xff7a51,transparent:true,opacity:.8}),line=new T.Line(g,mat);this.scene.add(line);this.effects.push({mesh:line,life:.09,max:.09});if(e.who===localId)this.shake=Math.max(this.shake,.045);}
  if(['crash','down','success','checkpoint'].includes(e.type)){const color=e.type==='crash'?0xffc485:0xf9ce82;for(let i=0;i<7;i++){const m=new T.Mesh(new T.SphereGeometry(.045,5,4),new T.MeshBasicMaterial({color,transparent:true,opacity:1}));m.position.set(e.x,.5,e.z);this.scene.add(m);this.effects.push({mesh:m,life:.6,max:.6,vel:V((Math.random()-.5)*7,2+Math.random()*4,(Math.random()-.5)*7)});}if(e.type==='crash')this.shake=.38;}
  if(e.type==='hurt'&&e.who===localId)this.shake=Math.max(this.shake,.17);
 }
 draw(s,localId,dt,cam={yaw:Math.PI,pitch:.2},menu=false){
  dt=Math.min(dt,.05);this.clock+=dt;const p=s.players[localId]||s.players[0],focus=V(p.x,1.25,p.z),t=s.time;const visibleDistance=(QUALITY[this.quality]||QUALITY.high).far;
  for(const c of s.cars){let m=this.dynamicCars.get(c.id);if(!m){m=carModelHD(c.type,c.paint);this.scene.add(m);this.dynamicCars.set(c.id,m);m.position.set(c.x,0,c.z);}m.visible=distance(c,menu?{x:430,z:480}:p)<visibleDistance;if(m.visible){m.position.lerp(V(c.x,.05,c.z),1-Math.exp(-dt*28));m.rotation.y+=angle(c.yaw-m.rotation.y)*(1-Math.exp(-dt*22));m.rotation.z=Math.sin(t*16+c.id)*Math.min(.006,Math.abs(c.speed)*.0003);for(const wheel of m.userData.wheels||[]){wheel.spin.rotation.x+=c.speed*dt/.428;for(let k=1;k<wheel.spin.children.length;k++)wheel.spin.children[k].visible=distance(c,p)<85;}m.userData.brake.emissiveIntensity=c.speed<3?1.6:.55;for(let i=0;i<m.userData.sirens.length;i++)m.userData.sirens[i].material.emissiveIntensity=s.wanted>.5&&Math.sin(t*12+i*Math.PI)>.1?6:.2;}}
  const active=new Set();for(const [kind,list]of [['p',s.players],['e',s.enemies]])for(const a of list){const id=kind+a.id;active.add(id);let m=this.actors.get(id);if(!m){m=personModel(kind==='e'?2:a.id);m.position.set(a.x,.15,a.z);this.scene.add(m);this.actors.set(id,m);}m.visible=a.hp>0&&(a.car===undefined||a.car<0)&&(menu||distance(a,p)<190);if(!m.visible)continue;m.position.lerp(V(a.x,.16,a.z),1-Math.exp(-dt*24));m.rotation.y+=angle(a.yaw-m.rotation.y)*(1-Math.exp(-dt*20));const walk=Math.min(1,(a.moving||0)/3),phase=t*(a.moving>9?17:a.moving>5?12:8)+a.x*.01;for(let i=0;i<2;i++){m.userData.legs[i].rotation.x=Math.sin(phase+i*Math.PI)*.62*walk;m.userData.arms[i].rotation.x=-Math.sin(phase+i*Math.PI)*.42*walk;}if(a.shot>0){m.userData.arms[1].rotation.x=-1.45;m.userData.weapon.position.set(.28,1.28,.38);}else m.userData.weapon.position.set(.28,.86,.2);}
  for(const [id,m]of this.actors)if(!active.has(id))m.visible=false;
  CACHES.forEach((c,i)=>{this.cacheMeshes[i].visible=!s.caches.includes(i)&&distance(c,p)<120;this.cacheMeshes[i].rotation.y=t*.35;this.cacheMeshes[i].position.y=.52+Math.sin(t*2+i)*.1;});
  const goal=target(s);this.marker.visible=!!goal;if(goal){this.marker.position.set(goal.x,0,goal.z);this.markerArrow.position.y=4+Math.sin(t*3)*.35;this.marker.rotation.y=t*.4;}
  const phase=s.complete?0:.12+.65*(.5-.5*Math.cos(s.elapsed/1600*Math.PI));this.sky.material.uniforms.phase.value=phase;this.sun.intensity=2.2-phase*1.55;this.hemi.intensity=1.9-phase*.45;this.sun.position.set(p.x-90,145,p.z-75);this.sun.target.position.set(p.x,0,p.z);this.sky.position.copy(this.camera.position);this.ocean.material.uniforms.time.value=t;if(this.hdInstalled)updateHDLighting(this,p,phase);
  const closest=this.lamps.slice().sort((a,b)=>a.distanceToSquared(focus)-b.distanceToSquared(focus));this.localLights.forEach((l,i)=>{l.visible=this.quality!=='low';l.position.copy(closest[i]);});
  const car=p.car>=0?s.cars[p.car]:null;for(const l of this.headlights){l.visible=!!car;if(car){const side=l.userData.side;const x=car.x+Math.sin(car.yaw)*2+Math.cos(car.yaw)*.55*side,z=car.z+Math.cos(car.yaw)*2-Math.sin(car.yaw)*.55*side;l.position.set(x,.8,z);l.target.position.set(x+Math.sin(car.yaw)*40,.15,z+Math.cos(car.yaw)*40);}}
  for(const e of s.events||[]){if(e.id>this.lastEvent){this.effect(e,localId);this.lastEvent=e.id;}}
  for(let i=this.effects.length-1;i>=0;i--){const e=this.effects[i];e.life-=dt;if(e.life<=0){this.scene.remove(e.mesh);e.mesh.geometry.dispose();e.mesh.material.dispose();this.effects.splice(i,1);}else{e.mesh.material.opacity=e.life/e.max;if(e.vel){e.vel.y-=8*dt;e.mesh.position.addScaledVector(e.vel,dt);}}}
  this.rain.position.set(p.x,0,p.z);this.rain.material.uniforms.time.value=t;
  if(menu){const a=-.5+Math.sin(this.clock*.05)*.1;this.camera.position.set(430+Math.sin(a)*150,88,530+Math.cos(a)*70);this.camera.lookAt(20,22,-20);this.cameraReady=false;}
  else{const base=car?10.5:6.4,h=car?2.4:1.2,d=base*Math.cos(cam.pitch),height=h+base*Math.sin(cam.pitch);let desired=V(p.x-Math.sin(cam.yaw)*d,p.car>=0?height+1.1:height+1.45,p.z-Math.cos(cam.yaw)*d);const dir=desired.clone().sub(focus),len=dir.length(),ray=new T.Ray(focus,dir.normalize());let limit=len;const hit=new T.Vector3();for(let i=0;i<BUILDINGS.length;i++){if(distance(p,BUILDINGS[i])>65)continue;if(ray.intersectBox(this.colliders[i],hit))limit=Math.min(limit,focus.distanceTo(hit)-.4);}if(limit<len)desired=focus.clone().addScaledVector(dir,Math.max(1,limit));this.shake*=Math.exp(-dt*9);desired.x+=(Math.random()-.5)*this.shake;desired.y+=(Math.random()-.5)*this.shake;if(!this.cameraReady){this.camera.position.copy(desired);this.cameraReady=true;}else this.camera.position.lerp(desired,1-Math.exp(-dt*(car?8:13)));this.camera.lookAt(focus.x,focus.y+.2,focus.z);this.camera.fov=59+Math.min(10,car?Math.abs(car.speed)*.2:Math.max(0,(p.moving||0)-4.6)*.65);this.camera.updateProjectionMatrix();}
  if(QUALITY[this.quality]?.post)this.composer.render();else this.renderer.render(this.scene,this.camera);
 }
 stats(){return{calls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,quality:this.quality};}
}
let sharedSilver;function silverMaterial(){return sharedSilver||(sharedSilver=M(0x8b9797,.36,.8));}
function finiteRange(n){return Number.isFinite(n)?clamp(n,0,120):30;}
