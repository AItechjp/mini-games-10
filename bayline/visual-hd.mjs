import * as T from 'three';
import {GTAOPass} from 'three/addons/postprocessing/GTAOPass.js';
import {FXAAPass} from 'three/addons/postprocessing/FXAAPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {rng,BUILDINGS,ROADS} from './core-hd.mjs';

export const QUALITY={
 low:{dpr:1,shadow:0,post:false,ao:false,far:250},
 medium:{dpr:1.2,shadow:1024,post:false,ao:false,far:340},
 high:{dpr:1.65,shadow:2048,post:true,ao:false,far:460},
 ultra:{dpr:2,shadow:4096,post:true,ao:true,far:600}
};
// Deterministic procedural PBR maps. No third-party image downloads or API keys.
function tex(n,draw,linear=false){const c=document.createElement('canvas');c.width=c.height=n;const g=c.getContext('2d');draw(g,n);const t=new T.CanvasTexture(c);t.colorSpace=linear?T.NoColorSpace:T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;return t;}
function grain(g,n,seed,base,range){const r=rng(seed),im=g.createImageData(n,n);for(let i=0;i<im.data.length;i+=4){const v=base+(r()-.5)*range;im.data[i]=v;im.data[i+1]=v+1;im.data[i+2]=v+2;im.data[i+3]=255;}g.putImageData(im,0,0);}
function asphaltMaps(){
 const map=tex(1024,(g,n)=>{grain(g,n,271,89,66);const r=rng(459);for(let i=0;i<12500;i++){const x=r()*n,y=r()*n;g.fillStyle=r()>.5?'rgba(202,204,196,.16)':'rgba(17,21,22,.26)';g.fillRect(x,y,1+r()*2,1+r()*2);}for(let j=0;j<13;j++){let x=r()*n,y=r()*n;g.strokeStyle='rgba(28,30,30,.55)';g.lineWidth=1+r()*2;g.beginPath();g.moveTo(x,y);for(let k=0;k<14;k++){x+=(r()-.47)*44;y+=r()*22;g.lineTo(x,y);}g.stroke();}g.strokeStyle='rgba(170,174,166,.07)';g.lineWidth=13;g.beginPath();g.moveTo(n*.23,0);g.lineTo(n*.25,n);g.stroke();});
 const rough=tex(512,(g,n)=>{grain(g,n,733,183,45);const r=rng(723);for(let i=0;i<22;i++){const x=r()*n,y=r()*n,rad=30+r()*80,d=g.createRadialGradient(x,y,0,x,y,rad);d.addColorStop(0,'rgba(8,8,8,.63)');d.addColorStop(1,'rgba(8,8,8,0)');g.fillStyle=d;g.fillRect(x-rad,y-rad,rad*2,rad*2);}},true);
 map.repeat.set(135,135);rough.repeat.set(80,80);return{map,rough};
}
function facades(){
 const windows=[];const r=rng(3307);for(let y=0;y<8;y++)for(let x=0;x<8;x++)windows.push({x:x*128,y:y*128,lit:r()>.49,tint:r(),blind:r()*.65});
 const map=tex(1024,(g,n)=>{grain(g,n,349,126,18);for(const w of windows){const{x,y}=w;g.fillStyle='#424b50';g.fillRect(x+11,y+9,106,108);const a=g.createLinearGradient(x,y,x+90,y+110);a.addColorStop(0,w.lit?'#b9a084':'#8a9fa8');a.addColorStop(.44,w.lit?'#6b5c50':'#536c7e');a.addColorStop(1,w.lit?'#d1b48d':'#1b3543');g.fillStyle=a;g.fillRect(x+15,y+13,98,98);g.fillStyle=w.lit?'#38322c':'#20303c';g.fillRect(x+18,y+16,92,94*w.blind);g.fillStyle='rgba(221,226,215,.26)';for(let j=0;j<94*w.blind;j+=5)g.fillRect(x+18,y+16+j,92,1);g.fillStyle='#343e43';g.fillRect(x+62,y+12,4,100);g.fillRect(x+14,y+67,100,3);g.fillStyle='rgba(209,219,216,.55)';g.fillRect(x+14,y+12,1,99);g.fillStyle='#4c5659';g.fillRect(x+9,y+117,110,4);g.fillStyle='rgba(37,39,38,.13)';g.fillRect(x+11,y+122,107,3);}});
 const emission=tex(1024,(g,n)=>{g.fillStyle='#000';g.fillRect(0,0,n,n);for(const w of windows){if(!w.lit)continue;const{x,y}=w;g.fillStyle=w.tint>.65?'#c7d9e1':'#eac58a';g.fillRect(x+18,y+16+94*w.blind,92,94*(1-w.blind));g.fillStyle='#000';g.fillRect(x+62,y+12,4,100);g.fillRect(x+14,y+67,100,3);}});
 const rough=tex(1024,(g,n)=>{g.fillStyle='#dbdbdb';g.fillRect(0,0,n,n);for(const{x,y}of windows){g.fillStyle='#474747';g.fillRect(x+15,y+13,98,98);g.fillStyle='#999';g.fillRect(x+62,y+12,4,100);g.fillRect(x+14,y+67,100,3);}},true);
 return{map,emission,rough};
}
const skyShader=`varying vec3 vDirection;uniform float phase;
float hsh(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float ns(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hsh(i),hsh(i+vec2(1,0)),f.x),mix(hsh(i+vec2(0,1)),hsh(i+1.),f.x),f.y);}
float fbm(vec2 p){float f=0.,a=.55;for(int i=0;i<5;i++){f+=ns(p)*a;p=p*2.07+vec2(3.1,4.2);a*=.48;}return f;}
void main(){vec3 d=normalize(vDirection);float h=max(d.y,0.);vec3 sun=normalize(vec3(-.70,.31,-.65));float sd=max(dot(d,sun),0.);float warmth=pow(sd,5.)*(1.-phase*.68);vec3 horizon=mix(vec3(.25,.38,.49),vec3(.86,.44,.19),warmth);vec3 top=mix(vec3(.035,.12,.26),vec3(.006,.018,.055),phase);vec3 col=mix(horizon*(1.-phase*.52),top,pow(h,.43));vec2 uv=d.xz/max(d.y+.16,.11)*1.3;float n=fbm(uv);float band=smoothstep(.01,.11,h)*(1.-smoothstep(.7,.94,h));float cloud=smoothstep(.43,.7,n)*band;vec3 c=mix(vec3(.22,.29,.39),vec3(.86,.58,.37),warmth);col=mix(col,c*(1.-phase*.65),cloud*.56);col+=vec3(1.,.5,.19)*pow(sd,48.)*.14*(1.-phase);col+=vec3(4.,2.8,1.7)*smoothstep(.99960,.99988,sd)*(1.-phase)*(1.-cloud);float stars=step(.99965,hsh(floor(d.xz/max(h,.15)*1800.)))*smoothstep(.3,.7,h)*phase*(1.-cloud);col+=stars*.45;gl_FragColor=vec4(col,1.);}`;

export function upgradeVisuals(v){
 const {scene,renderer}=v;v.hdInstalled=true;
 const asphalt=asphaltMaps(),facade=facades();v.hdMaterials={asphalt:[],facade:[]};
 const anisotropy=Math.min(16,renderer.capabilities.getMaxAnisotropy());
 for(const t of [asphalt.map,asphalt.rough,facade.map,facade.emission,facade.rough])t.anisotropy=anisotropy;
 const seen=new Set();scene.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:[o.material]){if(!m||seen.has(m))continue;seen.add(m);if(m.map===v.tex.asphalt){m.map=asphalt.map;m.bumpMap=asphalt.map;m.bumpScale=.055;m.roughnessMap=asphalt.rough;m.roughness=.86;m.metalness=.05;m.color.set(0x9ea6a7);v.hdMaterials.asphalt.push(m);}else if(m.map===v.tex.wall){m.map=facade.map;m.emissiveMap=facade.emission;m.bumpMap=facade.rough;m.bumpScale=.065;m.roughnessMap=facade.rough;m.roughness=.85;m.metalness=.23;m.emissiveIntensity=.5;v.hdMaterials.facade.push(m);}if(m.map)m.map.anisotropy=anisotropy;m.needsUpdate=true;}});
 v.sky.material.fragmentShader=skyShader;v.sky.material.needsUpdate=true;
 renderer.toneMappingExposure=1.12;scene.environmentIntensity=.72;
 v.sun.color.set(0xffd0a1);v.sun.shadow.normalBias=.025;v.sun.shadow.bias=-.00008;v.sun.shadow.radius=2;
 v.sun.shadow.camera.left=v.sun.shadow.camera.bottom=-72;v.sun.shadow.camera.right=v.sun.shadow.camera.top=72;v.sun.shadow.camera.far=520;v.sun.shadow.camera.updateProjectionMatrix();
 v.hemi.color.set(0xa7c8ea);v.hemi.groundColor.set(0x3d4143);
 // Capture the upgraded sky, architecture and horizon AFTER the environment art pass.
 const target=new T.WebGLCubeRenderTarget(256,{type:T.HalfFloatType}),cc=new T.CubeCamera(.4,2600,target),pm=new T.PMREMGenerator(renderer);
 const shadows=renderer.shadowMap.enabled;renderer.shadowMap.enabled=false;
 const hidden=[v.marker,...v.cacheMeshes,v.rain,...v.localLights,...v.headlights];const old=hidden.map(o=>o.visible);hidden.forEach(o=>o.visible=false);
 cc.position.set(-320,6,405);cc.update(renderer,scene);v.hdEnvironment=pm.fromCubemap(target.texture);scene.environment=v.hdEnvironment.texture;target.dispose();pm.dispose();renderer.shadowMap.enabled=shadows;hidden.forEach((o,i)=>o.visible=old[i]);
 v.bloom.strength=.24;v.bloom.radius=.48;v.bloom.threshold=1.25;
 v.hdAO=new GTAOPass(scene,v.camera,512,512);v.hdAO.blendIntensity=.42;v.hdAO.updateGtaoMaterial({radius:1.4,distanceExponent:1.7,thickness:1.2,samples:8});v.hdAO.updatePdMaterial({radius:4.,samples:8});
 v.composer.insertPass(v.hdAO,1);
 const grade=new ShaderPass({uniforms:{tDiffuse:{value:null}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform sampler2D tDiffuse;varying vec2 vUv;void main(){vec4 p=texture2D(tDiffuse,vUv);vec3 c=max(p.rgb,vec3(0.));float l=dot(c,vec3(.2126,.7152,.0722));c=mix(vec3(l),c,1.055);c*=mix(vec3(.975,1.005,1.025),vec3(1.028,1.004,.977),smoothstep(.1,1.1,l));gl_FragColor=vec4(c,p.a);}'});
 v.composer.insertPass(grade,v.composer.passes.length-1);v.composer.addPass(new FXAAPass());
 addStreetDetails(v);
 v.setQuality(v.quality);
}
function addStreetDetails(v){
 const box=new T.BoxGeometry(1,1,1),round=new T.CylinderGeometry(.5,.5,1,12),dark=new T.MeshStandardMaterial({color:0x202a30,roughness:.43,metalness:.65}),frame=new T.MeshStandardMaterial({color:0xa2a4a0,roughness:.52,metalness:.45}),glass=new T.MeshPhysicalMaterial({color:0x344a54,roughness:.15,metalness:.4,clearcoat:.8}),warm=new T.MeshStandardMaterial({color:0xe4c693,emissive:0xffcf8b,emissiveIntensity:1.4,roughness:.4}),red=new T.MeshStandardMaterial({color:0x952d27,roughness:.6,metalness:.35});
 const B=(x,y,z,w,h,d,m)=>v.batch(box,m,x,y,z,w,h,d);
 for(const b of BUILDINGS){
  const front=b.z+b.d/2+.08;
  B(b.x,1.3,front,2.6,2.5,.15,dark);B(b.x,1.35,front+.1,2.25,2.25,.08,glass);B(b.x,1.4,front+.17,.065,2.7,.07,frame);B(b.x+.27,1.2,front+.23,.055,.5,.06,frame);
  for(const side of [-1,1]){B(b.x+side*2.1,2.25,front+.17,.14,.36,.18,warm);B(b.x+side*(b.w/2+1),.35,front-1,.65,.55,.65,dark);}
  if(b.h<50){for(let i=-2;i<=2;i++){if(i===0)continue;const x=b.x+i*b.w*.18;B(x,1.55,front+.025,b.w*.155,2.45,.12,frame);B(x,1.55,front+.11,b.w*.14,2.18,.09,glass);}for(let y=5.2;y<Math.min(b.h-2,19);y+=4.8){for(const side of [-1,1]){const x=b.x+side*b.w*.25;B(x,y,front+.65,3.1,.16,1.25,frame);B(x,y+.58,front+1.2,3.1,.045,.045,frame);for(let k=-2;k<=2;k++)B(x+k*.67,y+.3,front+1.2,.032,.58,.032,dark);}}}
  if(b.id%3===0){B(b.x-2,b.h+1.1,b.z,2.3,1.9,1.8,frame);for(let i=0;i<6;i++)B(b.x-2,b.h+.48+i*.21,b.z+.93,2.0,.04,.08,dark);}
 }
 for(let i=0;i<ROADS.length;i++)for(let z=-400;z<470;z+=160){const x=ROADS[i]+14.1;v.batch(round,red,x,.48,z,.28,.85,.28);v.batch(round,red,x,.92,z,.39,.12,.39);B(x,.55,z,.7,.11,.14,red);B(x+1.3,.55,z+3,.55,1.1,.55,dark);B(x+1.3,1.11,z+3,.59,.08,.59,frame);}
 v.flush();
}
export function setHDWeather(v,rain){
 for(const m of v.hdMaterials?.asphalt||[]){m.roughness=rain?.47:.86;m.envMapIntensity=rain?1.4:1.;}
 v.scene.fog.density=rain?.00165:.00078;
}
export function updateHDLighting(v,p,phase){
 v.sun.position.set(p.x-190,85,p.z-177);v.sun.target.position.set(p.x,0,p.z);
 v.sun.intensity=3.2-phase*2.6;v.hemi.intensity=1.25-phase*.42;v.scene.environmentIntensity=.72-phase*.22;
 for(const m of v.hdMaterials?.facade||[])m.emissiveIntensity=.4+phase*.5;
}
