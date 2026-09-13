// Copyright (c) 2026 AItechjp. All rights reserved.
// Third-party libraries retain their own licenses.
import * as T from './vendor/three.mjs';
export function startScene(host){
 const renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.outputColorSpace=T.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;host.append(renderer.domElement);
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(35,1,.1,60);camera.position.set(0,3.15,9.5);camera.lookAt(0,1.15,0);
 scene.add(new T.HemisphereLight(0xc5e8ff,0x414259,2.5));const key=new T.DirectionalLight(0xffecd6,4.2);key.position.set(2,8,6);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-6;key.shadow.camera.right=6;key.shadow.camera.top=5;key.shadow.camera.bottom=-5;scene.add(key);const rim=new T.DirectionalLight(0x82cfff,3);rim.position.set(-5,3,-3);scene.add(rim);
 const mat=(color,roughness=.6)=>new T.MeshStandardMaterial({color,roughness,metalness:.04});const skin=mat(0xf2ba8d),hair=mat(0x2e2434),dark=mat(0x132b44),white=mat(0xfffaf0),blue=mat(0x29a6d5),coral=mat(0xef776b);
 const mesh=(g,m,parent,x=0,y=0,z=0)=>{const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;};
 const sphere=(r,m,parent,x,y,z,sx=1,sy=1,sz=1)=>{const o=mesh(new T.SphereGeometry(r,24,16),m,parent,x,y,z);o.scale.set(sx,sy,sz);return o;};
 const capsule=(r,len,m,parent,x,y,z)=>mesh(new T.CapsuleGeometry(r,len,6,14),m,parent,x,y,z);
 function person(x,color,flip){const root=new T.Group();root.position.set(x,0,0);root.rotation.y=flip?-.20:.20;scene.add(root);
  mesh(new T.BoxGeometry(.9,.14,.82),mat(0x263a54),root,0,.7,-.04);mesh(new T.BoxGeometry(.88,1,.16),mat(0x284463),root,0,1.12,-.4);
  for(const xx of [-.28,.28]){const leg=capsule(.15,.55,dark,root,xx,.56,.25);leg.rotation.x=-.12;sphere(.19,dark,root,xx,.20,.44,1,.75,1.6);}
  const body=new T.Group();body.position.y=1.17;root.add(body);sphere(.46,color,body,0,.10,0,1,1.15,.67);mesh(new T.CylinderGeometry(.17,.2,.18,20),skin,body,0,.62,0);
  const head=new T.Group();head.position.set(0,.98,.015);body.add(head);sphere(.38,skin,head,0,0,0,.97,1.1,.9);sphere(.39,hair,head,0,.14,-.05,1, .85,.92);
  for(const xx of [-.38,.38])sphere(.085,skin,head,xx,0,0,.65,1,1);
  for(const xx of [-.13,.13]){sphere(.065,white,head,xx,.015,.306,.9,1.2,.3);sphere(.030,dark,head,xx,.013,.33,1,1.2,.4);sphere(.014,white,head,xx-.008,.029,.343);const brow=capsule(.017,.095,hair,head,xx,.13,.303);brow.rotation.z=Math.PI/2;}
  sphere(.06,skin,head,0,-.055,.335,.75,.8,1);const smile=mesh(new T.TorusGeometry(.085,.013,6,20,Math.PI),mat(0x9b4950),head,0,-.14,.307);smile.rotation.z=Math.PI;
  const arms=[];for(const side of [-1,1]){const pivot=new T.Group();pivot.position.set(side*.40,.32,.02);body.add(pivot);const upper=capsule(.115,.34,color,pivot,side*.045,-.2,.04);upper.rotation.z=side*.2;const fore=capsule(.10,.30,skin,pivot,side*.09,-.43,.20);fore.rotation.x=-.8;sphere(.125,skin,pivot,side*.10,-.49,.39,1,1,.85);arms.push(pivot);}
  mesh(new T.BoxGeometry(.22,.08,.04),white,body,0,.29,.325);return {root,body,head,arms};}
 const people=[person(-1.42,blue,false),person(1.42,coral,true)];
 const table=mesh(new T.CylinderGeometry(2.85,2.7,.17,64),mat(0x365e71),scene,0,.78,1.1);table.scale.z=.52;mesh(new T.CylinderGeometry(.2,.48,.78,24),mat(0x263b4e),scene,0,.34,1.05);
 const board=mesh(new T.BoxGeometry(1.05,.07,.70),mat(0xd7ae6d),scene,0,.9,1.1);for(let i=0;i<7;i++){mesh(new T.BoxGeometry(.9,.004,.007),mat(0x795b39),scene,0,.94,.84+i*.086);mesh(new T.BoxGeometry(.007,.004,.55),mat(0x795b39),scene,-.43+i*.143,.94,1.1);}for(const [x,z,c] of [[0,1.1,dark],[.15,1.18,white],[-.15,1.02,dark]])sphere(.057,c,scene,x,.96,z,1,.45,1);
 const floor=mesh(new T.PlaneGeometry(40,30),mat(0x233b52),scene,0,-.04,0);floor.rotation.x=-Math.PI/2;
 let active=1,winner=null,paused=matchMedia('(prefers-reduced-motion: reduce)').matches,raf,last=0;
 const resize=()=>{const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.position.set(0,2.8,w<650?5.6:5.5);camera.fov=w<480?43:35;camera.lookAt(0,1.4,.15);camera.updateProjectionMatrix();draw(performance.now());};
 function draw(ms){const t=paused?0:ms/1000;people.forEach((p,i)=>{const on=active===i+1;p.body.position.y=1.17+(paused?0:Math.sin(t*1.6+i)*.012);p.head.rotation.z=paused?0:Math.sin(t*.65+i)*.025;p.head.rotation.x=on?-.07:.025;p.arms.forEach((a,j)=>{a.rotation.x=winner===i+1?2.3+Math.sin(t*4)*.12:on&&j===0?-.15+Math.sin(t*2)*.09:0;a.rotation.z=winner===i+1?(j===0?-.4:.4):0;});});renderer.render(scene,camera);}
 function animate(ms){raf=requestAnimationFrame(animate);if(document.hidden||ms-last<32)return;last=ms;draw(ms);}raf=requestAnimationFrame(animate);const observer=new ResizeObserver(resize);observer.observe(host);resize();
 return {set:(turn,result)=>{active=turn;winner=result;draw(performance.now());},pause:()=>{paused=!paused;return paused;},get paused(){return paused;},dispose:()=>{cancelAnimationFrame(raf);observer.disconnect();renderer.dispose();}};
}
