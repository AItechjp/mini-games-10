import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
// Authored articulated human meshes. Shared geometry/materials; one instance per
// visible citizen, not dozens of new draw calls per citizen.
const SHIRTS=[0xd8d2bd,0x254452,0x71392f,0x858d78,0xbaa575,0x41424c,0xa2aabc,0x4a6567,0xeee7d2,0x36516f,0xb57452,0x363639];
const TROUSERS=[0x24384a,0x303034,0x817763,0x172a3d,0x575c57,0x342f32];
const SKINS=[0xbc8567,0x865a42,0xd0a180,0x6c4531,0xe2b18c,0xa47456];
const HAIR=[0x231e1b,0x3b3027,0x574330,0x9a805e,0x1c191a,0x777571];
const color=new T.Color();
function clothTexture(){
 const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d'),im=g.createImageData(256,256);
 for(let y=0;y<256;y++)for(let x=0;x<256;x++){const n=(Math.sin(x*63.17+y*137.91)*41177)%1,v=216+((x+y)%4===0?15:0)+n*8,i=(y*256+x)*4;im.data[i]=im.data[i+1]=im.data[i+2]=v;im.data[i+3]=255;}g.putImageData(im,0,0);
 const map=new T.CanvasTexture(c);map.wrapS=map.wrapT=T.RepeatWrapping;map.repeat.set(2,2);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;return map;
}
function torsoGeometry(){
 const g=new T.LatheGeometry([[.14,0],[.175,.03],[.177,.11],[.16,.18],[.191,.36],[.215,.44],[.20,.49],[.09,.53]].map(([x,y])=>new T.Vector2(x,y)),24);g.scale(1,1,.64);return g;
}
function limb(top,bottom,length){return new T.CylinderGeometry(top,bottom,length,16,3).translate(0,-length/2,0);}
function ellipsoid(x,y,z){return new T.SphereGeometry(1,16,12).scale(x,y,z);}
function shadowTexture(){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),r=g.createRadialGradient(32,32,2,32,32,32);r.addColorStop(0,'rgba(0,0,0,.4)');r.addColorStop(.4,'rgba(0,0,0,.21)');r.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=r;g.fillRect(0,0,64,64);return new T.CanvasTexture(c);}
export function makeHumanRig(){
 const fabric=clothTexture(),mats={
  cloth:new T.MeshStandardMaterial({color:0xffffff,map:fabric,bumpMap:fabric,bumpScale:.008,roughness:.92}),
  pants:new T.MeshStandardMaterial({color:0xffffff,map:fabric,bumpMap:fabric,bumpScale:.007,roughness:.96}),
  skin:new T.MeshStandardMaterial({color:0xffffff,roughness:.69}),
  hair:new T.MeshStandardMaterial({color:0xffffff,roughness:.94}),
  shoe:new T.MeshStandardMaterial({color:0x262629,roughness:.79}),
  sole:new T.MeshStandardMaterial({color:0x9b9990,roughness:.98}),
  eye:new T.MeshStandardMaterial({color:0xd6cfbe,roughness:.31}),
  iris:new T.MeshStandardMaterial({color:0x17191a,roughness:.22}),
  metal:new T.MeshStandardMaterial({color:0x778186,metalness:.7,roughness:.36}),
  lips:new T.MeshStandardMaterial({color:0x765245,roughness:.76})
 };
 const root=new T.Group(),parts=[],buckets=new Map();
 const joint=(parent,x,y,z)=>{const n=new T.Group();n.position.set(x,y,z);parent.add(n);return n;};
 const pelvis=joint(root,0,.9,0),chest=joint(pelvis,0,.035,0),neck=joint(chest,0,.53,0),head=joint(neck,0,.10,0);
 function shape(parent,key,geo,x=0,y=0,z=0,rx=0,ry=0,rz=0){const id=parent.uuid+key;geo.rotateX(rx).rotateY(ry).rotateZ(rz).translate(x,y,z);const old=geo;if(geo.index){geo=geo.toNonIndexed();old.dispose();}if(!buckets.has(id))buckets.set(id,{parent,key,geos:[]});buckets.get(id).geos.push(geo);}
 const ball=(parent,key,rx,ry,rz,x,y,z)=>shape(parent,key,ellipsoid(rx,ry,rz),x,y,z);
 shape(chest,'cloth',torsoGeometry());
 ball(pelvis,'pants',.175,.13,.115,0,0,0);
 shape(pelvis,'shoe',new T.TorusGeometry(.167,.011,5,32),0,.053,0,Math.PI/2); // belt
 shape(pelvis,'metal',new T.BoxGeometry(.035,.033,.012),0,.05,.12);
 shape(neck,'skin',new T.CylinderGeometry(.057,.07,.14,16),0,.009,0);
 // Jaw, cheeks, ears, nose, lips and inset eyes, rather than a featureless ball.
 const skull=ellipsoid(.104,.147,.112);const p=skull.attributes.position;
 for(let i=0;i<p.count;i++){const y=p.getY(i);if(y<-.04)p.setX(i,p.getX(i)*(.72+.28*(y+.147)/.107));}skull.computeVertexNormals();shape(head,'skin',skull,0,.048,.006);
 for(const side of [-1,1]){
  ball(head,'skin',.019,.034,.013,side*.107,.044,.0);
  ball(head,'eye',.026,.012,.012,side*.04,.082,.105);
  ball(head,'iris',.009,.01,.006,side*.04,.081,.117);
  shape(head,'hair',new T.CapsuleGeometry(.006,.04,3,6),side*.04,.104,.105,0,0,Math.PI/2);
 }
 ball(head,'skin',.019,.033,.032,0,.047,.114);
 ball(head,'lips',.027,.005,.007,0,.0,.108);
 shape(head,'hair',new T.SphereGeometry(1,18,12,0,Math.PI*2,0,Math.PI*.52).scale(.11,.135,.117),0,.087,.002);
 // Shirt opening, tailored collar and vertical seam.
 for(const side of [-1,1])shape(chest,'cloth',new T.BoxGeometry(.068,.018,.087),side*.065,.52,.052,.15,0,side*.3);
 shape(chest,'metal',new T.CylinderGeometry(.003,.003,.38,5),0,.27,.129);
 const arms=[],forearms=[],legs=[],knees=[],feet=[];
 for(const side of [-1,1]){
  const upper=joint(chest,side*.216,.44,0),lower=joint(upper,0,-.265,0),hand=joint(lower,0,-.245,0);
  ball(upper,'cloth',.086,.093,.083,0,-.018,0);shape(upper,'cloth',limb(.075,.058,.24));
  shape(lower,'skin',limb(.055,.035,.245));ball(hand,'skin',.037,.06,.025,0,-.04,.012);
  ball(hand,'skin',.02,.034,.022,-side*.028,-.02,.03);
  shape(lower,'metal',new T.CylinderGeometry(.037,.037,.025,12),0,-.211,0);
  const thigh=joint(pelvis,side*.095,-.045,0),knee=joint(thigh,0,-.395,0),foot=joint(knee,0,-.39,0);
  shape(thigh,'pants',limb(.096,.067,.395));ball(knee,'pants',.067,.065,.068,0,0,0);
  shape(knee,'pants',limb(.066,.046,.375));
  ball(foot,'shoe',.076,.064,.142,0,-.014,.046);ball(foot,'sole',.078,.021,.145,0,-.056,.047);
  for(let j=0;j<3;j++)shape(foot,'sole',new T.BoxGeometry(.083,.008,.01),0,.025,.035+j*.022);
  arms.push(upper);forearms.push(lower);legs.push(thigh);knees.push(knee);feet.push(foot);
 }
 for(const {parent,key,geos} of buckets.values()){
  const geometry=mergeGeometries(geos,false);geos.forEach(g=>g.dispose());parts.push({parent,key,geometry,material:mats[key]});
 }
 return{root,pelvis,chest,head,arms,forearms,legs,knees,feet,parts,mats};
}
function pose(r,person,time){
 const speed=person.moving||0,run=speed>2.5,amp=Math.min(1,speed/1.2),phase=(person.travel||0)*(run?3.2:4.5),idle=person.mode===1,phone=idle&&person.id%2===0;
 r.root.position.set(person.x,.19,person.z);r.root.rotation.set(0,person.yaw,0);
 const h=.94+(person.id%7)*.017,w=.94+(person.id%5)*.035;r.root.scale.set(w,h,w);
 r.pelvis.position.y=.9+Math.abs(Math.sin(phase))*(run?.043:.014)*amp;r.pelvis.rotation.set(0,Math.sin(phase)*.035*amp,Math.sin(phase)*.025*amp);
 r.chest.rotation.set(run?.13:0,Math.sin(phase)*-.06*amp,Math.sin(time*1.3+person.id)*.008);
 r.head.rotation.set(phone?.14:0,(idle||person.mode===2)?Math.sin(time*.7+person.id)*.3:Math.sin(time*.4+person.id)*.05,0);
 for(let i=0;i<2;i++){
  const f=Math.sin(phase+i*Math.PI),side=i===0?-1:1;
  r.legs[i].rotation.set(f*(run?.8:.42)*amp,0,0);
  r.knees[i].rotation.set(Math.max(0,-f)*(run?1.25:.63)*amp,0,0);
  r.feet[i].rotation.x=-Math.max(0,f)*.18*amp;
  r.arms[i].rotation.set(-f*(run?.77:.32)*amp,0,side*.04);
  r.forearms[i].rotation.set(run?-1.04:-.14,0,0);
 }
 if(phone){r.arms[1].rotation.set(-.55,-.2,.09);r.forearms[1].rotation.x=-1.72;}
 else if(idle){r.arms[0].rotation.x=-.32-Math.sin(time*1.8)*.10;r.forearms[0].rotation.x=-.7;}
 r.root.updateMatrixWorld(true);
}
export class CivilianView{
 constructor(scene){
  this.scene=scene;this.rig=makeHumanRig();this.capacity=96;this.smooth=new Map();this.count=0;this.meshes=[];
  for(const part of this.rig.parts){const mesh=new T.InstancedMesh(part.geometry,part.material,this.capacity);mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;mesh.castShadow=mesh.receiveShadow=true;mesh.count=0;mesh.name='civilian-'+part.key;scene.add(mesh);this.meshes.push({...part,mesh});}
  this.shadows=new T.InstancedMesh(new T.PlaneGeometry(.85,.72).rotateX(-Math.PI/2),new T.MeshBasicMaterial({map:shadowTexture(),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}),this.capacity);this.shadows.frustumCulled=false;this.shadows.count=0;scene.add(this.shadows);this.dummy=new T.Object3D();
 }
 update(state,player,dt,quality){
  const maximum={low:20,medium:36,high:64,ultra:96}[quality]||36,radius={low:65,medium:100,high:155,ultra:200}[quality]||100;
  const people=(state.civilians||[]).filter(p=>Math.hypot(p.x-player.x,p.z-player.z)<radius).sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z)).slice(0,maximum);
  const mix=1-Math.exp(-Math.max(dt,1/120)*12),seen=new Set();this.count=people.length;
  for(let i=0;i<people.length;i++){
   const person=people[i];let p=this.smooth.get(person.id);if(!p){p={...person};this.smooth.set(person.id,p);}seen.add(p.id);
   p.x+=(person.x-p.x)*mix;p.z+=(person.z-p.z)*mix;p.yaw+=Math.atan2(Math.sin(person.yaw-p.yaw),Math.cos(person.yaw-p.yaw))*mix;p.moving=person.moving;p.mode=person.mode;p.travel+=(person.travel-p.travel)*mix;
   pose(this.rig,p,state.time||0);
   for(const part of this.meshes){part.mesh.setMatrixAt(i,part.parent.matrixWorld);const palette=part.key==='cloth'?SHIRTS:part.key==='pants'?TROUSERS:part.key==='skin'?SKINS:part.key==='hair'?HAIR:null;part.mesh.setColorAt(i,color.setHex(palette?palette[p.id%palette.length]:0xffffff));}
   this.dummy.position.set(p.x,.181,p.z);this.dummy.rotation.set(0,p.yaw,0);this.dummy.updateMatrix();this.shadows.setMatrixAt(i,this.dummy.matrix);
  }
  for(const [id]of this.smooth)if(!seen.has(id))this.smooth.delete(id);
  for(const{mesh}of this.meshes){mesh.count=people.length;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.castShadow=quality==='high'||quality==='ultra';}
  this.shadows.count=people.length;this.shadows.instanceMatrix.needsUpdate=true;
 }
}
