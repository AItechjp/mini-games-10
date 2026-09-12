import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
const COLORS=[0x184b60,0xc9a46a,0xd3d7d6,0x793038,0x152936,0x93846e,0x24292d];
const mat=(color,roughness=.5,metalness=0)=>new T.MeshStandardMaterial({color,roughness,metalness});
function shell(rows){
 const pos=[],uv=[],index=[];
 for(let j=0;j<rows.length;j++){const[z,w,lo,hi]=rows[j];const ring=[[-w*.83,hi],[w*.83,hi],[w,hi-.10],[w,lo+.09],[w*.83,lo],[-w*.83,lo],[-w,lo+.09],[-w,hi-.10]];for(let k=0;k<8;k++){pos.push(ring[k][0],ring[k][1],z);uv.push(k/8,j/(rows.length-1));}}
 for(let j=0;j<rows.length-1;j++)for(let k=0;k<8;k++){const a=j*8+k,b=j*8+(k+1)%8,c=a+8,d=b+8;index.push(a,b,c,b,d,c);}
 for(let k=1;k<7;k++){index.push(0,k+1,k);const a=(rows.length-1)*8;index.push(a,a+k,a+k+1);}
 for(let i=0;i<index.length;i+=3){const b=index[i+1];index[i+1]=index[i+2];index[i+2]=b;}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeVertexNormals();return g;
}
export function carModelHD(type=0,paint=0){
 const root=new T.Group(),buckets=new Map();
 const paintMat=new T.MeshPhysicalMaterial({color:COLORS[paint%7],roughness:.27,metalness:.57,clearcoat:1,clearcoatRoughness:.09,envMapIntensity:1.2});
 const glass=new T.MeshPhysicalMaterial({color:0x264654,roughness:.11,metalness:.35,clearcoat:1,clearcoatRoughness:.025,envMapIntensity:1.5});
 const black=mat(0x11191d,.58,.16),rubber=mat(0x141719,.94),alloy=mat(0xb8c3c7,.26,.85),brake=mat(0x68130d,.25,.22),lamp=mat(0xd4f0ff,.15,.25);brake.emissive.set(0xff2614);brake.emissiveIntensity=.8;lamp.emissive.set(0xe1edff);lamp.emissiveIntensity=4;
 function add(g,m,x=0,y=0,z=0,rx=0,ry=0,rz=0){if(g.index){const old=g;g=g.toNonIndexed();old.dispose();}g.applyMatrix4(new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromEuler(new T.Euler(rx,ry,rz)),new T.Vector3(1,1,1)));if(!buckets.has(m))buckets.set(m,[]);buckets.get(m).push(g);}
 function box(w,h,d,m,x,y,z,rz=0){const r=Math.min(w,h,d)*.22;add(new RoundedBoxGeometry(w,h,d,1,r),m,x,y,z,0,0,rz);}
 const tall=type===2?.33:type===3?.50:0;
 add(shell([[-2.27,.78,.45,.73],[-2.09,.91,.40,.87],[-1.55,.99,.38,.97],[-.5,.995,.39,.94],[.65,.97,.39,.91],[1.5,.94,.40,.87],[1.99,.87,.46,.79],[2.26,.73,.52,.67]]),paintMat);
 add(shell([[-1.42,.80,.91,1.045+tall*.35],[-.85,.73,.94,1.47+tall],[-.56,.72,.94,1.54+tall],[.39,.71,.91,1.53+tall],[.65,.74,.90,1.42+tall],[1.13,.81,.87,.96]]),glass);
 add(shell([[-.86,.70,1.46+tall,1.5+tall],[-.55,.72,1.525+tall,1.565+tall],[.40,.705,1.515+tall,1.555+tall],[.62,.69,1.425+tall,1.465+tall]]),paintMat);
 box(1.53,.085,.085,paintMat,0,1.48+tall,.55);
 box(1.46,.08,.085,paintMat,0,1.5+tall,-.83);
 for(const side of [-1,1]){
  box(.07,.1,3.5,black,side*.975,.46,0);
  box(.045,.58+tall,.075,black,side*.73,1.20+tall/2,-.18);
  box(.04,.022,2.3,alloy,side*.94,.97,-.05);
  box(.07,.035,.26,alloy,side*1.003,.94,-.38);
  box(.22,.12,.32,paintMat,side*1.08,1.09,.70);
  box(.035,.09,.22,glass,side*1.20,1.095,.71);
  for(const z of [-1.39,1.37])add(new T.TorusGeometry(.452,.047,7,28,Math.PI),paintMat,side*.994,.45,z,0,Math.PI/2);
 }
 box(1.62,.14,.18,black,0,.49,2.12);box(1.64,.16,.15,black,0,.48,-2.15);
 box(.84,.16,.05,black,0,.65,2.204);for(let i=-5;i<=5;i++)box(.025,.12,.06,alloy,i*.067,.65,2.238);
 for(const x of [-.57,.57]){box(.47,.09,.10,black,x,.79,2.055);box(.41,.035,.11,lamp,x,.805,2.088);box(.32,.02,.09,lamp,x,.762,2.106);box(.39,.07,.10,brake,x,.84,-2.124);add(new T.CylinderGeometry(.067,.067,.17,16),alloy,x,.40,-2.22,Math.PI/2);}
 box(.43,.135,.015,mat(0xd6dad4,.7),0,.62,-2.28);
 if(type===0){box(1.55,.055,.28,paintMat,0,1.075,-1.95);for(const x of [-.6,.6])box(.06,.20,.10,black,x,.98,-1.95);}
 if(type===1)box(.55,.12,.29,mat(0xd9ac52,.4,.2),0,1.67,0);
 if(type===2)for(const x of [-.6,.6])box(.055,.055,1.62,black,x,1.99,-.09);
 if(type===3)box(1.49,.74,1.40,paintMat,0,1.36,-.73);
 const sirens=[];if(type===4){box(1.2,.07,.31,black,0,1.65,0);for(const[x,c]of [[-.36,0x168bff],[.36,0xff3020]]){const m=mat(c,.17,.2);m.emissive.set(c);const o=new T.Mesh(new RoundedBoxGeometry(.45,.10,.27,2,.028),m);o.position.set(x,1.73,0);sirens.push(o);root.add(o);}}
 for(const[m,gs]of buckets){const mesh=new T.Mesh(mergeGeometries(gs,false),m);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);for(const g of gs)g.dispose();}
 const wheels=[];for(const side of [-1,1])for(const z of [-1.39,1.37]){
  const steering=new T.Group(),spin=new T.Group();steering.position.set(side*.995,.445,z);steering.add(spin);root.add(steering);
  const tire=new T.Mesh(new T.CylinderGeometry(.428,.428,.265,32),rubber);tire.rotation.z=Math.PI/2;spin.add(tire);
  const rim=new T.Mesh(new T.CylinderGeometry(.298,.298,.272,32),black);rim.rotation.z=Math.PI/2;spin.add(rim);
  const spokeGeos=[];for(let k=0;k<5;k++){const a=k*Math.PI*2/5,g=new T.BoxGeometry(.282,.044,.49);g.rotateX(a);spokeGeos.push(g);}const spokes=new T.Mesh(mergeGeometries(spokeGeos,false),alloy);spin.add(spokes);spokeGeos.forEach(g=>g.dispose());
  const hub=new T.Mesh(new T.CylinderGeometry(.072,.072,.287,16),alloy);hub.rotation.z=Math.PI/2;spin.add(hub);
  tire.castShadow=spokes.castShadow=true;wheels.push({steering,spin,front:z>0});
 }
 root.userData={brake,sirens,wheels};return root;
}
