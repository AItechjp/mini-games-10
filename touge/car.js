import * as T from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { v,canvasTexture,textTexture } from './world.js';
function loft(sections){const p=[],idx=[],profile=[[0,0],[-.82,0],[-1,.2],[-1,.74],[-.93,.96],[-.72,1],[.72,1],[.93,.96],[1,.74],[1,.2],[.82,0]];for(const [z,w,b,t] of sections){for(const [x,y] of profile)p.push(x*w,b+y*(t-b),z);}const n=profile.length;for(let s=0;s<sections.length-1;s++)for(let j=0;j<n;j++){const a=s*n+j,b=s*n+(j+1)%n,c=a+n,d=b+n;idx.push(a,c,b,b,c,d);}for(const end of [0,sections.length-1])for(let j=1;j<n-1;j++){const a=end*n;end?idx.push(a,a+j,a+j+1):idx.push(a,a+j+1,a+j);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();return g;}
function panel(points){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points.flat(),3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();return g;}
export function buildCar(color=0xe4e3da,rival=false){
const car=new T.Group(),body=new T.Group();car.add(body);const batches=new Map();
const paint=new T.MeshPhysicalMaterial({color,metalness:.52,roughness:.23,clearcoat:1,clearcoatRoughness:.07,envMapIntensity:1.5});
const black=new T.MeshStandardMaterial({color:0x090e13,roughness:.52,metalness:.16});const rubber=new T.MeshStandardMaterial({color:0x111519,roughness:.88});
const chrome=new T.MeshStandardMaterial({color:0xb9c5cf,roughness:.2,metalness:.95});const glass=new T.MeshPhysicalMaterial({color:0x244052,roughness:.09,metalness:.58,clearcoat:1,envMapIntensity:1.7,side:T.DoubleSide});
const lamp=new T.MeshStandardMaterial({color:0xddeef1,emissive:0xc9e5ff,emissiveIntensity:5,roughness:.25});const tail=new T.MeshStandardMaterial({color:0x8e1120,emissive:0xff162c,emissiveIntensity:2.5,roughness:.25});
function add(g,m,x=0,y=0,z=0,rx=0,ry=0,rz=0){g=g.clone();g.rotateX(rx);g.rotateY(ry);g.rotateZ(rz);g.translate(x,y,z);g=g.index?g.toNonIndexed():g;g.deleteAttribute('uv');g.deleteAttribute('uv1');if(!g.attributes.normal)g.computeVertexNormals();if(!batches.has(m))batches.set(m,[]);batches.get(m).push(g);}
const box=(w,h,d)=>new RoundedBoxGeometry(w,h,d,2,Math.min(.035,h*.2,w*.15));
const shape=rival?[[ -2.2,.67,.30,.63],[-1.95,.87,.29,.83],[-1.35,.91,.29,.88],[-.3,.9,.29,.84],[.8,.89,.29,.78],[1.5,.87,.30,.72],[2.2,.76,.34,.55]]:[[-2.12,.76,.31,.78],[-1.92,.86,.29,.86],[-1.35,.89,.29,.88],[-.65,.9,.29,.87],[.55,.88,.30,.79],[1.35,.88,.32,.72],[1.99,.84,.33,.64],[2.2,.78,.36,.59]];
add(loft(shape),paint);
for(const side of [-1,1]){add(box(.045,.20,3.67),black,side*.89,.45,0);add(box(.048,.045,3.85),black,side*.892,.69,-.03);add(box(.06,.045,3.6),chrome,side*.905,.30,0);}
add(box(1.81,.20,.17),black,0,.48,-2.13);add(box(1.75,.18,.2),black,0,.44,2.12);add(box(1.46,.16,.025),black,0,.62,2.19);
for(let j=0;j<9;j++)add(new T.BoxGeometry(1.42,.009,.02),chrome,0,.566+j*.014,2.209);
add(box(1.64,.038,.19),black,0,.31,2.21);add(box(1.68,.055,.16),black,0,.31,-2.2);
const rz=rival?-.42:-.60,fz=rival?.55:.4;
add(loft([[-1.57,.76,.77,.86],[rz,.68,.8,1.38],[fz,.64,.8,1.36],[1.16,.72,.75,.83]]),black);
add(loft([[rz-.03,.68,1.35,1.395],[fz+.05,.64,1.34,1.38]]),paint);
add(panel([[-.63,1.342,fz+.07],[.63,1.342,fz+.07],[.715,.835,1.167],[-.715,.835,1.167]]),glass);
add(panel([[-.73,.87,-1.565],[.73,.87,-1.565],[.66,1.347,rz-.035],[-.66,1.347,rz-.035]]),glass);
for(const side of [-1,1]){
add(panel([[side*.744,.866,-1.43],[side*.668,1.327,rz-.07],[side*.65,1.318,-.17],[side*.772,.835,-.17]]),glass);
add(panel([[side*.773,.835,-.10],[side*.649,1.318,-.10],[side*.625,1.31,fz-.01],[side*.733,.841,1.04]]),glass);
add(box(.045,.04,2.53),chrome,side*.757,.835,-.18);
add(box(.045,.036,.21),chrome,side*.908,.737,-.38);
add(box(.018,.33,.012),black,side*.909,.58,-.8);
add(box(.15,.04,.20),black,side*.90,.93,.64,0,side*.22,0);
add(box(.23,.12,.23),paint,side*1.015,.97,.65);
add(new T.PlaneGeometry(.19,.08),glass,side*1.015,.975,.527,0,Math.PI,0);
add(box(.47,rival?.13:.21,.38),paint,side*.565,rival?.68:.80,1.62,-.11,0,0);
add(box(.36,.135,.02),lamp,side*.565,rival?.68:.813,1.82,-.11,0,0);
add(box(.25,.08,.02),lamp,side*.61,.427,2.227);
add(box(.62,.145,.028),tail,side*.49,.736,-2.145);
add(box(.055,.14,.03),black,side*.37,.733,-2.17);
add(new T.CylinderGeometry(.067,.067,.20,18),chrome,side*.58,.305,-2.24,Math.PI/2);
add(new T.CircleGeometry(.053,18),black,side*.58,.305,-2.345,0,Math.PI);
}
add(box(.18,.07,.03),chrome,0,.70,-2.154);
for(const x of [-.65,.65])add(box(.06,.13,.07),black,x,.97,-1.82);
add(box(1.8,.055,.18),rival?paint:black,0,1.04,-1.85,0.08);
add(box(.014,.014,.54),black,-.16,1.064,.77,.83,0,.18);
add(new T.CylinderGeometry(.006,.006,.5,6),black,.54,1.56,-.45,0,0,-.20);
for(const x of [-.42,.42])add(box(.017,.014,.62),black,x,.753,1.15,.07);
for(let j=0;j<6;j++)add(box(.75,.007,.016),black,0,.83,-1.69+j*.036);
for(const [m,gs] of batches){const g=mergeGeometries(gs),mesh=new T.Mesh(g,m);mesh.castShadow=true;mesh.receiveShadow=true;body.add(mesh);gs.forEach(x=>x.dispose());}
const plate=new T.Mesh(new T.PlaneGeometry(.46,.23),new T.MeshStandardMaterial({map:textTexture(rival?'02 · RS':'01 · MT','#cbd1c5','#183228',256,128),roughness:.5}));plate.position.set(0,.49,-2.226);plate.rotation.y=Math.PI;body.add(plate);
const wheels=[];
for(const x of [-.9,.9])for(const z of [-1.30,1.35]){
 const pivot=new T.Group(),spin=new T.Group();pivot.position.set(x,.385,z);pivot.add(spin);car.add(pivot);const sign=Math.sign(x);
 const tire=new T.Mesh(new T.TorusGeometry(.298,.088,12,32),rubber);tire.rotation.y=Math.PI/2;spin.add(tire);
 const tread=new T.Mesh(new T.CylinderGeometry(.359,.359,.235,32,1,true),rubber);tread.rotation.z=Math.PI/2;spin.add(tread);
 const rim=new T.Mesh(new T.TorusGeometry(.245,.019,8,32),chrome);rim.rotation.y=Math.PI/2;rim.position.x=sign*.132;spin.add(rim);
 const disc=new T.Mesh(new T.CylinderGeometry(.214,.214,.018,32),new T.MeshStandardMaterial({color:0x576371,metalness:.85,roughness:.42}));disc.rotation.z=Math.PI/2;disc.position.x=sign*.075;spin.add(disc);
 const spokes=[];for(let j=0;j<8;j++){const g=new T.BoxGeometry(.025,.405,.037);g.rotateX(j*Math.PI/4);g.translate(sign*.13,0,0);spokes.push(g);}spin.add(new T.Mesh(mergeGeometries(spokes),rival?chrome:black));
 const hub=new T.Mesh(new T.CylinderGeometry(.068,.068,.05,16),chrome);hub.rotation.z=Math.PI/2;hub.position.x=sign*.15;spin.add(hub);
 const caliper=new T.Mesh(box(.055,.145,.07),new T.MeshStandardMaterial({color:0xa93c2a,metalness:.4,roughness:.5}));caliper.position.set(sign*.085,.07,-.15);pivot.add(caliper);
 wheels.push({pivot,spin,front:z>0});
}
const shadowTexture=canvasTexture(128,128,(c,w,h)=>{let g=c.createRadialGradient(64,64,10,64,64,64);g.addColorStop(0,'#000d');g.addColorStop(.6,'#0007');g.addColorStop(1,'#0000');c.fillStyle=g;c.fillRect(0,0,w,h);});const contact=new T.Mesh(new T.PlaneGeometry(3.4,6),new T.MeshBasicMaterial({map:shadowTexture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));contact.rotation.x=-Math.PI/2;contact.position.y=.022;car.add(contact);
car.userData={body,wheels,paint,tail};return car;
}
