import * as T from '../board-games/vendor/three.mjs';
export function createArena(host){
 const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 const renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.outputColorSpace=T.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;host.replaceChildren(renderer.domElement);
 const scene=new T.Scene();scene.background=new T.Color(0x23394d);scene.fog=new T.Fog(0x23394d,16,38);
 const camera=new T.PerspectiveCamera(36,1,.1,70);camera.position.set(0,5.4,12);camera.lookAt(0,1.1,0);
 scene.add(new T.HemisphereLight(0xc8eafa,0x12212b,2.8));const sun=new T.DirectionalLight(0xe5f4ff,3.7);sun.position.set(-3,9,7);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-8,right:8,top:7,bottom:-5});sun.shadow.bias=-.001;scene.add(sun);const rim=new T.PointLight(0x63ffcb,20,20);rim.position.set(-4,3,-2);scene.add(rim);const rim2=new T.PointLight(0xb999ff,30,20);rim2.position.set(5,4,-2);scene.add(rim2);
 const mat=(color,metalness=.1,roughness=.55)=>new T.MeshStandardMaterial({color,metalness,roughness});
 const dark=mat(0x1e2d43,.3),white=mat(0xedf4ed),skin=mat(0xf2c296),gold=mat(0xffcb76,.6),teal=mat(0x55e7c9,.45),stone=mat(0x40556a,.2),purple=mat(0xa58cfa,.55);
 const glow=c=>new T.MeshStandardMaterial({color:c,emissive:c,emissiveIntensity:1.3,roughness:.3});
 function mesh(g,m,p,x=0,y=0,z=0){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;p.add(o);return o;}
 function ball(r,m,p,x,y,z,sx=1,sy=1,sz=1){const o=mesh(new T.SphereGeometry(r,16,12),m,p,x,y,z);o.scale.set(sx,sy,sz);return o;}
 function box(w,h,d,m,p,x,y,z){return mesh(new T.BoxGeometry(w,h,d),m,p,x,y,z);}
 function capsule(r,l,m,p,x,y,z){return mesh(new T.CapsuleGeometry(r,l,4,10),m,p,x,y,z);}
 const ground=mesh(new T.PlaneGeometry(80,60),mat(0x1e3245),scene,0,-.19,0);ground.rotation.x=-Math.PI/2;
 const platform=mesh(new T.CylinderGeometry(5.5,5.8,.35,64),stone,scene,0,0,0);platform.scale.z=.55;
 const circle=mesh(new T.TorusGeometry(4.8,.024,5,80),glow(0x699fbc),scene,0,.19,0);circle.rotation.x=-Math.PI/2;circle.scale.y=.53;
 for(let i=-5;i<=5;i++){box(.016,.005,5,mat(0x607a8d),scene,i,.183,0);}
 for(let i=0;i<10;i++){const x=(i%5-2)*3.5,z=-5-Math.floor(i/5)*3;const h=2+((i*7)%5)*.6;box(1.1,h,1.1,mat(0x2c4258),scene,x,h/2-.2,z);box(1.28,.18,1.28,stone,scene,x,h-.1,z);box(.045,h*.7,.03,glow(i%2?0x7473c5:0x4a9b9a),scene,x,h/2,z+.57);}
 function hero(x,z,color,isMage){const root=new T.Group();root.position.set(x,.20,z);scene.add(root);root.rotation.y=.35;const body=new T.Group();root.add(body);const armor=isMage?gold:teal;const head=new T.Group();head.position.set(0,1.63,0);body.add(head);
  ball(.37,skin,head,0,0,0,1,1.03,.94);ball(.38,dark,head,0,.18,-.07,1,.72,.98);for(const xx of [-.14,.14]){ball(.04,dark,head,xx,.01,.34,1,1.4,.5);ball(.018,white,head,xx-.009,.025,.356);}
  box(.78,.68,.47,armor,body,0,1.03,0);box(.26,.35,.04,white,body,0,1.10,.26);box(.81,.12,.5,dark,body,0,.73,0);
  for(const xx of [-.22,.22]){capsule(.14,.31,dark,body,xx,.48,0);box(.29,.2,.44,armor,body,xx,.18,.07);}const arms=[];
  for(const side of [-1,1]){const arm=new T.Group();arm.position.set(side*.48,1.28,0);body.add(arm);ball(.22,armor,arm,0,0,0);capsule(.105,.32,dark,arm,0,-.28,0);ball(.13,skin,arm,0,-.52,0);arms.push(arm);}
  const hand=arms[1];if(isMage){const staff=capsule(.04,1.2,gold,hand,.10,-.3,0);ball(.19,glow(0x68efcf),hand,.10,.4,0);const ring=mesh(new T.TorusGeometry(.25,.032,6,24),gold,hand,.10,.40,0);ring.rotation.y=.25;const hat=mesh(new T.ConeGeometry(.44,.64,6),dark,head,0,.49,0);hat.rotation.z=-.15;}else{const blade=box(.10,.76,.09,white,hand,0,-.8,.07);blade.rotation.z=-.15;box(.35,.07,.1,gold,hand,0,-.42,.07);const shield=mesh(new T.CylinderGeometry(.32,.32,.1,6),teal,arms[0],-.10,-.25,.14);shield.rotation.x=Math.PI/2;}
  const cape=box(.6,.83,.06,isMage?mat(0x66526e):mat(0x27726d),body,0,.98,-.30);cape.rotation.x=.15;
  const ring=mesh(new T.TorusGeometry(.58,.028,5,40),glow(color),root,0,.015,0);ring.rotation.x=-Math.PI/2;
  return{root,body,head,arms,baseX:x,baseZ:z,color};}
 const heroes=[hero(-2.8,.65,0x5eefd0,false),hero(-1.65,-.25,0xffc875,true)];
 const boss=new T.Group();boss.position.set(2.45,.2,0);boss.rotation.y=-.32;scene.add(boss);const bossBody=new T.Group();boss.add(bossBody);
 box(1.2,.92,.70,dark,bossBody,0,1.24,0);box(.82,.68,.76,purple,bossBody,0,1.31,0);const core=mesh(new T.OctahedronGeometry(.23),glow(0xffc875),bossBody,0,1.37,.43);
 const bossHead=new T.Group();bossHead.position.y=2.04;bossBody.add(bossHead);box(.85,.66,.66,dark,bossHead,0,0,0);box(.90,.2,.7,purple,bossHead,0,.33,0);box(.64,.08,.06,glow(0xffb080),bossHead,0,.03,.35);for(const x of [-.35,.35]){const horn=mesh(new T.ConeGeometry(.10,.52,4),gold,bossHead,x,.63,0);horn.rotation.z=-x;}
 const bossArms=[];for(const side of [-1,1]){box(.39,.51,.43,dark,bossBody,side*.35,.51,0);box(.48,.23,.65,purple,bossBody,side*.35,.17,.1);const arm=new T.Group();arm.position.set(side*.82,1.64,0);bossBody.add(arm);ball(.35,purple,arm,0,0,0,1.1,.95,1);box(.35,.60,.39,dark,arm,0,-.35,0);box(.48,.39,.48,purple,arm,0,-.73,.05);bossArms.push(arm);}
 const enemyRing=mesh(new T.TorusGeometry(.98,.025,5,40),glow(0xbca1ff),boss,0,.01,0);enemyRing.rotation.x=-Math.PI/2;
 const particles=[],projectiles=[];let effect=null,last=0,raf,paused=false,clock=0,prevTime=performance.now(),currentWave=0;
 function burst(x,y,z,color,count=18){if(reduced)return;for(let i=0;i<count;i++){const o=mesh(new T.OctahedronGeometry(.04+Math.random()*.06),glow(color),scene,x,y,z);particles.push({o,v:new T.Vector3((Math.random()-.5)*5,Math.random()*3,(Math.random()-.5)*3),ttl:1});}}
 function projectile(start,end,color){const o=ball(.14,glow(color),scene,...start);projectiles.push({o,start:new T.Vector3(...start),end:new T.Vector3(...end),time:0});}
 function draw(ms){const dt=Math.min(.05,(ms-prevTime)/1000);prevTime=ms;if(!paused&&!document.hidden)clock+=dt;const t=reduced?0:clock;
  heroes.forEach((p,i)=>{p.body.position.y=Math.sin(t*2+i)*.035;p.head.rotation.z=Math.sin(t*.9+i)*.025;p.root.position.x=p.baseX;p.arms.forEach((a,j)=>a.rotation.x=Math.sin(t*1.5+i+j)*.035);});bossBody.position.y=Math.sin(t*1.8)*.05;bossHead.rotation.y=Math.sin(t*.7)*.08;core.rotation.y=t*.8;boss.rotation.z=0;
  if(effect&&!paused){const elapsed=clock-effect.start;if(elapsed<.75&&!reduced){if(effect.attack)heroes.forEach((p,i)=>{if(effect.right[i]){p.root.position.x=p.baseX+Math.sin(elapsed/.75*Math.PI)*.55;p.arms[1].rotation.x=-Math.sin(elapsed/.75*Math.PI)*1.3;}});if(effect.hurt)bossArms.forEach(a=>a.rotation.x=-Math.sin(elapsed/.75*Math.PI)*1.3);if(effect.attack)boss.rotation.z=Math.sin(elapsed*50)*.04;}if(elapsed>1.1){effect=null;bossArms.forEach(a=>a.rotation.x=0);}}
  if(!paused){for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i];p.time+=dt*2;p.o.position.lerpVectors(p.start,p.end,Math.min(1,p.time));p.o.position.y+=Math.sin(p.time*Math.PI)*.6;if(p.time>=1){burst(...p.end.toArray(),p.o.material.color,22);scene.remove(p.o);p.o.geometry.dispose();p.o.material.dispose();projectiles.splice(i,1);}}for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.ttl-=dt;p.v.y-=dt*5;p.o.position.addScaledVector(p.v,dt);p.o.scale.setScalar(Math.max(0,p.ttl));if(p.ttl<=0){scene.remove(p.o);p.o.geometry.dispose();p.o.material.dispose();particles.splice(i,1);}}}
  renderer.render(scene,camera);}
 function resize(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.position.set(0,w<600?7:5.6,w<600?15:12);camera.fov=w<600?43:36;camera.lookAt(0,.95,0);camera.updateProjectionMatrix();draw(performance.now());}
 const observer=new ResizeObserver(resize);observer.observe(host);resize();function animate(ms){raf=requestAnimationFrame(animate);if(document.hidden||ms-last<32)return;last=ms;draw(ms);}raf=requestAnimationFrame(animate);
 return{hit(result){effect={...result,start:clock};if(!reduced){result.right.forEach((yes,i)=>{if(yes)projectile([heroes[i].baseX,1.5,heroes[i].baseZ],[2.45,1.5,0],heroes[i].color);});if(result.hurt)projectile([2.45,1.6,0],[-2.2,1.1,.3],0xff879a);if(result.unison)burst(0,1.8,0,0xffdf91,40);}},setWave(n,color){currentWave=n;purple.color.set(color);boss.scale.setScalar(1+Math.min(n,4)*.04);},pause(v){paused=v;},dispose(){cancelAnimationFrame(raf);observer.disconnect();scene.traverse(o=>{o.geometry?.dispose();if(o.material?.dispose)o.material.dispose();});renderer.dispose();}};
}
