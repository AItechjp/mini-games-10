import * as T from 'three';
import {Reflector} from 'three/addons/objects/Reflector.js';
import {BUILDINGS,ROADS,rng} from './core-living.mjs';
import {signalState} from './population.mjs';
const mat=(color,roughness=.8,metalness=0,extra={})=>new T.MeshStandardMaterial({color,roughness,metalness,...extra});
function signAtlas(){
 const c=document.createElement('canvas');c.width=2048;c.height=1024;const g=c.getContext('2d');
 const labels=[['BAY COFFEE','ESPRESSO  /  BAKERY'],['NORTH & CO.','DESIGN  •  EVERYDAY GOODS'],['NOODLE HOUSE','OPEN LATE  /  TAKEAWAY'],['VINYL DISTRICT','RECORDS  •  LISTENING BAR'],['COASTAL MARKET','FRESH GOODS  /  SINCE 1987'],['ATELIER 08','FLOWERS  /  OBJECTS'],['NIGHT SERVICE','REPAIR  /  RESTORE'],['HARBOR PHARMACY','HEALTH  /  CARE']];
 const colors=['#193b3a','#302e2d','#62322e','#213246','#485145','#65564c','#24465a','#314b42'];
 for(let i=0;i<8;i++){
  const x=i%2*1024,y=Math.floor(i/2)*256;g.fillStyle=colors[i];g.fillRect(x,y,1024,256);g.strokeStyle='#c4b596';g.lineWidth=3;g.strokeRect(x+12,y+12,1000,232);
  g.fillStyle='#eee4d1';g.textAlign='center';g.font='600 64px sans-serif';g.fillText(labels[i][0],x+512,y+121,965);g.font='22px sans-serif';g.fillStyle='#beb7a8';g.fillText(labels[i][1],x+512,y+188);
 }
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.anisotropy=8;return t;
}
function normalMap(){
 const n=256,c=document.createElement('canvas');c.width=c.height=n;const g=c.getContext('2d'),im=g.createImageData(n,n),random=rng(23487),height=new Float32Array(n*n);
 for(let i=0;i<height.length;i++)height[i]=random();
 for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=y*n+x,dx=height[y*n+(x+1)%n]-height[y*n+(x+n-1)%n],dy=height[((y+1)%n)*n+x]-height[((y+n-1)%n)*n+x],len=Math.hypot(dx*.18,dy*.18,1);im.data[i*4]=128+dx*.18/len*127;im.data[i*4+1]=128+dy*.18/len*127;im.data[i*4+2]=128+127/len;im.data[i*4+3]=255;}
 g.putImageData(im,0,0);const t=new T.CanvasTexture(c);t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(300,300);return t;
}
export class StreetArt{
 constructor(view){
  this.view=view;this.time=0;this.signals=[];this.wind=[];const sc=view.scene;
  const box=new T.BoxGeometry(1,1,1),round=new T.CylinderGeometry(.5,.5,1,14),sphere=new T.SphereGeometry(1,12,8);
  const dark=mat(0x293033,.73,.44),black=mat(0x161b1e,.7),stone=mat(0x8d928a,.97),wood=mat(0x69523a,.95),cream=mat(0xd5c7ac,.92),green=mat(0x3d5140,.97),red=mat(0x864838,.8);
  const warm=mat(0xffd5a3,.4,0,{emissive:0xffbb77,emissiveIntensity:1.8}),glass=new T.MeshPhysicalMaterial({color:0xb7d1d7,roughness:.12,metalness:.07,transparent:true,opacity:.15,depthWrite:false,envMapIntensity:.55});
  const B=(x,y,z,w,h,d,m=stone,ry=0)=>view.batch(box,m,x,y,z,w,h,d,ry);
  const C=(x,y,z,r,h,m=dark)=>view.batch(round,m,x,y,z,r*2,h,r*2);
  const atlas=signAtlas(),signMat=mat(0xffffff,.67,.12,{map:atlas,emissiveMap:atlas,emissive:0xffffff,emissiveIntensity:.3});
  const addSign=(i,x,y,z,w,h,ry=0)=>{const g=new T.PlaneGeometry(w,h),uv=g.attributes.uv;for(let j=0;j<uv.count;j++)uv.setXY(j,(i%2+uv.getX(j))/2,1-(Math.floor(i/2)+1-uv.getY(j))/4);const m=new T.Mesh(g,signMat);m.position.set(x,y,z);m.rotation.y=ry;sc.add(m);};
  // Recessed, lit shop windows: real shelves, countertops, ceiling lights and glazing.
  for(const b of BUILDINGS.filter(b=>b.h<45&&b.id%2===0)){
   const z=b.z+b.d/2+.18,x=b.x,w=Math.min(15,b.w*.62),front=z+1.65;
   B(x,1.7,z+.15,w,3.1,.13,black);B(x,3.27,z+.87,w,.17,1.8,dark);B(x,.23,z+.9,w,.18,1.8,stone);
   for(const side of [-1,1])B(x+side*(w/2-.09),1.7,z+.9,.17,3,1.8,cream);
   for(let shelf=0;shelf<3;shelf++){
    B(x,1+shelf*.64,z+.48,w-1,.055,.55,wood);
    for(let j=0;j<8;j++){const px=x-w*.43+j*w*.12;B(px,1.16+shelf*.64,z+.45,.35,.24,.21,j%3?cream:red);}
   }
   B(x,2.98,z+.8,w*.75,.045,.055,warm);B(x,3.55,front,w+.3,.5,.2,dark);
   addSign(b.id%8,x,3.54,front+.115,w-.25,.48);
   // The transparent front is a separate surface, so props have actual parallax.
   const g=new T.Mesh(new T.PlaneGeometry(w-.35,2.7),glass);g.position.set(x,1.76,front);sc.add(g);
   for(const side of [-1,1])B(x+side*w*.165,1.72,front+.012,.045,2.92,.09,dark);
   B(x+w*.12,1.23,front+.08,.04,.46,.05,cream);
   B(x-w*.36,.81,front+.67,1.1,1.12,.09,wood);addSign(b.id%8,x-w*.36,.85,front+.725,.96,.74);
  }
  // Bus shelters, cafes and planted furniture occupy the inner sidewalk, not roads.
  for(let k=0;k<6;k++){
   const x=ROADS[k]+18.2,z=400-k*128;
   B(x,2.8,z,3.9,.12,6.6,dark);B(x,2.71,z,3.6,.03,.1,warm);
   for(const dz of [-3,3]){B(x+1.7,1.55,z+dz,.09,2.5,.09,dark);B(x-1.7,1.55,z+dz,.09,2.5,.09,dark);}
   B(x+1.7,1.58,z,.055,2.35,5.9,glass);B(x+.8,.7,z,1.1,.12,4.3,wood);B(x+1.15,1.03,z,.12,.52,4.3,wood);
   for(const dz of [-1.6,1.6])B(x+.8,.42,z+dz,.08,.45,.12,dark);
   addSign(k,x-1.5,1.78,z-2.85,1.5,.65,Math.PI/2);
  }
  for(let k=0;k<24;k++){
   const x=ROADS[k%6]+18.2,z=-396+Math.floor(k/6)*250;
   B(x,.4,z,2.5,.7,1.2,stone);B(x,.78,z,2.28,.09,.97,wood);
   for(let j=0;j<6;j++)view.batch(sphere,green,x-.95+j*.38,1.04,z,.32,.35,.38);
   for(const side of [-1,1]){C(x+side*2,.58,z,.095,.86,dark);B(x+side*2,.92,z,.22,.04,.22,cream);}
   C(x,.2,z+5,.50,.22,stone);C(x,.73,z+5,.065,1.05,dark);C(x,1.2,z+5,.74,.065,wood);
   for(const dz of [-1.03,1.03]){B(x,.65,z+5+dz,.62,.06,.57,wood);for(const side of [-1,1])B(x+side*.24,.42,z+5+dz,.038,.46,.43,dark);B(x,1.0,z+5+dz+Math.sign(dz)*.23,.6,.6,.05,wood);}
  }
  // Utility covers and subtle gutter detail break up uniform asphalt.
  for(let r=0;r<7;r++)for(let k=0;k<6;k++){
   const x=ROADS[r]+7.9,z=-425+k*160;C(x,.012,z,.38,.008,dark);
   for(let j=-3;j<=3;j++)B(x+j*.07,.018,z,.018,.008,.51,black);
  }
  // Replace the old permanently red dots with one synchronized signal system.
  for(const o of [...sc.children])if(o.material?.emissive?.getHex()===0xe74721)sc.remove(o);
  for(let ix=0;ix<7;ix++)for(let iz=0;iz<7;iz++)for(let side=0;side<4;side++){
   const x=ROADS[ix]+(side<2?11:-11),z=ROADS[iz]+(side%2?11:-11),axis=side%2?'x':'z',yaw=axis==='x'?(side<2?-Math.PI/2:Math.PI/2):(side<2?0:Math.PI);
   B(x,2.2,z,.1,4.4,.1,dark);B(x,4.12,z,.36,.96,.3,black,yaw);
   this.signals.push({x,z,axis,yaw,ix,iz});
  }
  view.flush();
  this.lenses=['red','amber','green'].map((name,i)=>{const color=[0xff2d19,0xffb42b,0x61efc1][i],m=new T.InstancedMesh(new T.SphereGeometry(.09,10,8),mat(color,.3,0,{emissive:color,emissiveIntensity:2.2}),this.signals.length);m.count=0;m.frustumCulled=false;sc.add(m);return m;});this.dummy=new T.Object3D();
  const normals=normalMap();for(const m of view.hdMaterials?.asphalt||[]){m.normalMap=normals;m.normalScale=new T.Vector2(.45,.45);m.bumpMap=null;m.metalness=.015;m.needsUpdate=true;}
  this.installInteriors();this.installWind();this.installReflection();
 }
 installInteriors(){
  // View-dependent interior shading only affects window panes; no screen-space
  // dependency and no downloaded room imagery.
  for(const material of this.view.hdMaterials?.facade||[]){
   material.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec3 livingPos;varying vec3 livingNormal;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
vec4 livingVertex=vec4(position,1.);vec3 livingN=normal;
#ifdef USE_INSTANCING
 livingVertex=instanceMatrix*livingVertex;livingN=mat3(instanceMatrix)*livingN;
#endif
livingPos=(modelMatrix*livingVertex).xyz;livingNormal=normalize(mat3(modelMatrix)*livingN);`);
    shader.fragmentShader='varying vec3 livingPos;varying vec3 livingNormal;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
     #ifdef USE_MAP
      vec2 pane=fract(vMapUv*8.);float windowMask=step(.13,pane.x)*step(pane.x,.87)*step(.15,pane.y)*step(pane.y,.87)*(1.-step(.482,pane.x)*step(pane.x,.525));
      vec3 viewRay=normalize(livingPos-cameraPosition);vec3 n=normalize(livingNormal);vec3 tangent=normalize(vec3(n.z,0.,-n.x)+vec3(.0001,0.,0.));
      vec2 parallax=vec2(dot(viewRay,tangent),viewRay.y)/max(.3,abs(dot(viewRay,n)))*.14;
      vec2 room=(pane-.5)*1.2-parallax;float back=1.-smoothstep(.31,.47,max(abs(room.x),abs(room.y)));
      float furniture=step(-.32,room.y)*step(room.y,-.15)*step(abs(room.x),.23);
      vec3 roomTint=mix(vec3(.40,.47,.49),vec3(.9,.72,.49),back)*(1.-furniture*.56);
      diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*roomTint,windowMask*.48);
     #endif`);
   };material.customProgramCacheKey=()=> 'bayline-window-parallax-v3.1';material.needsUpdate=true;
  }
 }
 installWind(){
  const seen=new Set();this.view.scene.traverse(o=>{const m=o.material;if(!m||seen.has(m)||m.color?.getHex()!==0x314e43)return;seen.add(m);m.onBeforeCompile=shader=>{shader.uniforms.livingTime={value:0};this.wind.push(shader.uniforms.livingTime);shader.vertexShader='uniform float livingTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    transformed.y += sin(livingTime*1.4+position.x*1.3)*pow(max(position.x,0.)/4.3,2.)*.19;
    transformed.z += sin(livingTime*.9+position.x*.8)*max(position.x,0.)*.015;`);};m.needsUpdate=true;});
 }
 installReflection(){
  const v=this.view,shader={uniforms:T.UniformsUtils.clone(Reflector.ReflectorShader.uniforms),vertexShader:Reflector.ReflectorShader.vertexShader,fragmentShader:''};
  shader.uniforms.wetness={value:0};shader.vertexShader=shader.vertexShader.replace('varying vec4 vUv;','varying vec4 vUv;varying vec3 roadPosition;').replace('vUv = textureMatrix','roadPosition=(modelMatrix*vec4(position,1.)).xyz;\n vUv = textureMatrix');
  shader.fragmentShader=`uniform sampler2D tDiffuse;uniform float wetness;varying vec4 vUv;varying vec3 roadPosition;
   float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
   float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
   void main(){vec2 uv=vUv.xy/vUv.w;float patch=noise(roadPosition.xz*.22);float puddle=smoothstep(.46,.77,patch);float fresnel=pow(1.-abs(normalize(cameraPosition-roadPosition).y),2.);
    vec2 j=vec2(noise(roadPosition.xz*2.),noise(roadPosition.zx*2.+8.))-.5;uv+=j*.0015;vec3 c=texture2D(tDiffuse,uv).rgb*.5;c+=texture2D(tDiffuse,uv+vec2(.0012,.0012)).rgb*.25;c+=texture2D(tDiffuse,uv-vec2(.0012,.0012)).rgb*.25;
    gl_FragColor=vec4(c,wetness*puddle*(.1+fresnel*.36));}`;
  this.reflection=new Reflector(new T.PlaneGeometry(1050,1050),{textureWidth:768,textureHeight:768,multisample:0,clipBias:.002,shader});this.reflection.rotation.x=-Math.PI/2;this.reflection.position.y=.009;this.reflection.material.transparent=true;this.reflection.material.depthWrite=false;this.reflection.visible=false;v.scene.add(this.reflection);
 }
 update(s,quality,rain){
  this.time=s.time||0;this.wind.forEach(u=>u.value=this.time);
  const counts=[0,0,0];for(const p of this.signals){const name=signalState(this.time,p.axis,p.ix,p.iz),i=['red','amber','green'].indexOf(name);this.dummy.position.set(p.x+Math.sin(p.yaw)*.17,4.42-i*.29,p.z+Math.cos(p.yaw)*.17);this.dummy.rotation.set(0,p.yaw,0);this.dummy.scale.set(1,1,.5);this.dummy.updateMatrix();this.lenses[i].setMatrixAt(counts[i]++,this.dummy.matrix);}
  this.lenses.forEach((m,i)=>{m.count=counts[i];m.instanceMatrix.needsUpdate=true;});
  this.reflection.visible=!!rain&&quality==='ultra';this.reflection.material.uniforms.wetness.value=rain?1:0;
 }
}
