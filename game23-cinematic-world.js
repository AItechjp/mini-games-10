/* Instanced architectural sets, terrain, water and atmospheric lighting. */
const CG={box:cineKeep(new THREE.BoxGeometry(1,1,1)),cylinder:cineKeep(new THREE.CylinderGeometry(.5,.5,1,16)),
  cone:cineKeep(new THREE.ConeGeometry(.5,1,16)),sphere:cineKeep(new THREE.SphereGeometry(1,16,12)),
  torus:cineKeep(new THREE.TorusGeometry(1,.09,8,32)),rock:null,arch:null,tomb:null};
{
  const g=new THREE.IcosahedronGeometry(1,2),p=g.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),n=1+.13*Math.sin(x*8+z*5)*Math.cos(y*6-z*4)+.07*Math.sin(z*12+y*7);p.setXYZ(i,x*n,y*n,z*n);}g.computeVertexNormals();CG.rock=cineKeep(g);
  const s=new THREE.Shape();s.moveTo(-1.4,0);s.lineTo(-1.4,1.6);s.absarc(0,1.6,1.4,Math.PI,0,true);s.lineTo(1.4,0);s.lineTo(1.05,0);s.lineTo(1.05,1.6);s.absarc(0,1.6,1.05,0,Math.PI,false);s.lineTo(-1.05,0);s.closePath();
  CG.arch=cineKeep(new THREE.ExtrudeGeometry(s,{depth:.35,bevelEnabled:true,bevelSize:.04,bevelThickness:.04,bevelSegments:2,steps:1,curveSegments:16}).translate(0,0,-.175));
  const t=new THREE.Shape();t.moveTo(-.4,0);t.lineTo(-.4,1);t.absarc(0,1,.4,Math.PI,0,true);t.lineTo(.4,0);t.closePath();CG.tomb=cineKeep(new THREE.ExtrudeGeometry(t,{depth:.18,bevelEnabled:true,bevelSize:.04,bevelThickness:.025,bevelSegments:2}).translate(0,0,-.09));
}
let cineBatches=new Map(),cineChunks=[],cineLamps=[],cineLampLights=[],cineMoonLight=null,cineSky=null,cineWater=[],cineWeather=null,cineEnvironment=null,cineFlashlight=null;
const cineMtx=new THREE.Object3D();
function cinePlace(geometry,material,x,y,z,sx=1,sy=1,sz=1,ry=0,rx=0,rz=0){
  const chunk=Math.floor(z/48),key=geometry.uuid+material.uuid+chunk;
  if(!cineBatches.has(key))cineBatches.set(key,{geometry,material,matrices:[],chunk});
  cineMtx.position.set(x,y,z);cineMtx.rotation.set(rx,ry,rz);cineMtx.scale.set(sx,sy,sz);cineMtx.updateMatrix();cineBatches.get(key).matrices.push(cineMtx.matrix.clone());
}
function cineBox(material,x,y,z,w,h,d,ry=0,rx=0,rz=0){cinePlace(CG.box,material,x,y,z,w,h,d,ry,rx,rz);}
function cineRod(material,a,b,r=.06){const mid=new THREE.Vector3().addVectors(a,b).multiplyScalar(.5),dir=new THREE.Vector3().subVectors(b,a);cineMtx.position.copy(mid);cineMtx.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.clone().normalize());cineMtx.scale.set(r*2,dir.length(),r*2);cineMtx.updateMatrix();const chunk=Math.floor(mid.z/48),key=CG.cylinder.uuid+material.uuid+chunk;if(!cineBatches.has(key))cineBatches.set(key,{geometry:CG.cylinder,material,matrices:[],chunk});cineBatches.get(key).matrices.push(cineMtx.matrix.clone());}
function cineFlush(){for(const b of cineBatches.values()){const m=new THREE.InstancedMesh(b.geometry,b.material,b.matrices.length);b.matrices.forEach((mat,i)=>m.setMatrixAt(i,mat));m.instanceMatrix.needsUpdate=true;m.castShadow=b.material!==CM.window&&b.material!==CM.amber;m.receiveShadow=true;m.computeBoundingSphere();m.userData.cineScenery=true;scene.add(m);cineChunks.push(m);}cineBatches.clear();}
function cineSolid(x,z,w,d){state.walls.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,mesh:null,cine:true});}

function cineLantern(x,z,y=3.6){
  cinePlace(CG.cylinder,CM.blackMetal,x,y/2,z,.11,y,.11);cinePlace(CG.cylinder,CM.blackMetal,x,.15,z,.45,.3,.45);
  cineBox(CM.blackMetal,x,y+.34,z,.6,.10,.6);cineBox(CM.blackMetal,x,y-.25,z,.55,.10,.55);
  cineBox(CM.amber,x,y,z,.28,.44,.28);
  for(const a of [-1,1])for(const b of [-1,1])cineBox(CM.blackMetal,x+a*.23,y,z+b*.23,.035,.55,.035);
  cinePlace(CG.cone,CM.blackMetal,x,y+.53,z,.75,.32,.75);cineLamps.push(new THREE.Vector3(x,y,z));
}
function cineWindow(x,y,z,w=1,h=2,rot=0,lit=true){
  const side=Math.sin(rot),front=Math.cos(rot),m=lit?CM.window:CM.glass;
  cineBox(m,x,y,z,w,h,.12,rot);
  for(const q of [-1,1])cineBox(CM.paleStone,x+q*w*.55*front,y,z-q*w*.55*side,.13,h+.25,.27,rot);
  for(const q of [-1,1])cineBox(CM.paleStone,x,y+q*h*.55,z,w+ .28,.13,.28,rot);
  cineBox(CM.blackMetal,x,y,z+.10*front,.06,h,.09,rot);
  cineBox(CM.blackMetal,x,y,z+.10*front,w,.065,.09,rot);
}
function cineManor(x,z,w=20,h=12,depth=13,castle=false){
  const m=castle?CM.darkStone:CM.brick;
  cineBox(m,x,h/2,z,w,h,depth);
  for(const y of [.35,3.8,7.4,h])cineBox(CM.stone,x,y,z,w+.65,.30,depth+.65);
  for(const side of [-1,1]){
    cineBox(CM.stone,x+side*(w/2-.25),h/2,z+depth/2+.25,.7,h,.8);
    cinePlace(CG.cone,CM.roof,x+side*w*.39,h+3,z,w*.43,6,depth*1.04,Math.PI/4);
  }
  cineBox(CM.roof,x,h+.85,z,w*.94,1.6,depth*.91);
  for(let y=2;y<h;y+=3.7)for(let dx=-w/2+2.1;dx<w/2-1;dx+=3.2){cineWindow(x+dx,y,z+depth/2+.08,1.15,2.05,0,Math.sin(dx*17+y*7)>.1);if(castle)cinePlace(CG.arch,CM.stone,x+dx,y-1.12,z+depth/2+.10,.56,.86,.65);}
  for(const side of [-1,1])for(let dz=-depth/2+2;dz<depth/2;dz+=3.5)for(let y=2;y<h;y+=3.7)cineWindow(x+side*(w/2+.04),y,z+dz,.95,1.9,side*Math.PI/2,Math.sin(y+dz)>.4);
  cinePlace(CG.arch,CM.paleStone,x,0,z+depth/2+.45,1.6,1.5,2);
  cineBox(CM.wood,x,1.6,z+depth/2+.10,3.1,3.2,.2);
  for(let i=0;i<4;i++)cineBox(CM.stone,x,.10+i*.14,z+depth/2+1.9-i*.4,5.4-i*.2,.20+i*.27,1.1);
  for(const side of [-1,1])cineLantern(x+side*3.8,z+depth/2+1.2,3.1);
  for(let i=0;i<4;i++){const cx=x+(i-1.5)*w*.23;cineBox(CM.darkStone,cx,h+2,z-2,1,3.4,1.25);cineBox(CM.stone,cx,h+3.75,z-2,1.25,.18,1.5);}
  cineSolid(x,z,w,depth);
}
function cineTree(x,z,s=1,seed=0,pine=false){
  const rand=mulberry32(seed),base=new THREE.Vector3(x,0,z),top=new THREE.Vector3(x+.22*s,5.4*s,z-.12*s);
  cineRod(CM.wood,base,top,.20*s);
  for(let i=0;i<9;i++){const a=i*2.39+seed,height=(1.9+i*.36)*s,len=(pine?2.3-i*.16:1.1+rand()*1.4)*s;
    const root=new THREE.Vector3(x,height,z),end=new THREE.Vector3(x+Math.cos(a)*len,height+(.3+rand())*s,z+Math.sin(a)*len);
    cineRod(CM.wood,root,end,(.09-i*.005)*s);
    if(pine){cinePlace(CG.rock,CM.moss,end.x,end.y+.2*s,end.z,1.25*s,.36*s,.85*s,a);if(i>5)cinePlace(CG.rock,CM.paleStone,end.x,end.y+.37*s,end.z,1.02*s,.12*s,.68*s,a);}
    else for(const sign of [-1,1])cineRod(CM.wood,end,new THREE.Vector3(end.x+Math.cos(a+sign*.65)*.65*s,end.y+.9*s,end.z+Math.sin(a+sign*.65)*.65*s),.033*s);
  }
  for(let i=0;i<4;i++){const a=i*1.57;cineRod(CM.wood,new THREE.Vector3(x,.4*s,z),new THREE.Vector3(x+Math.cos(a)*.65*s,0,z+Math.sin(a)*.65*s),.11*s);}
}
function cineCliff(x,z,s,seed,snow=false){
  const rand=mulberry32(seed);for(let j=0;j<4;j++){const h=(4+rand()*7)*s,px=x+(rand()-.5)*s*5,pz=z+(rand()-.5)*s*6;
    cinePlace(CG.rock,CM.rock,px,h*.35-1,pz,s*(3+rand()*2),h*.7,s*(3+rand()*2),rand()*6,rand()*.3);
    if(snow)cinePlace(CG.rock,CM.paleStone,px,h*.83,pz,s*2.9,h*.19,s*2.5,rand()*6);
  }
}
function cineIndustrial(x,z,w=15,h=12){
  cineBox(CM.darkStone,x,h/2,z,w,h,12);for(let y=3;y<h;y+=3.5)for(let dx=-w/2+1.3;dx<w/2;dx+=2.4)cineWindow(x+dx,y,z+6.05,1.2,1.5,0,Math.sin(y*dx)>.6);
  for(const q of [-1,1])cinePlace(CG.cylinder,CM.rust,x+q*w*.48,h*.53,z+6.4,.19,h*1.05,.19);
  cineBox(CM.metal,x,h+.1,z,w+.7,.4,12.6);cineBox(CM.blackMetal,x+3,h+1.15,z+2,3.5,2.0,3);
  cineSolid(x,z,w,12);
}
function cineCrane(x,z,side=1){
  for(const a of [-1,1])for(const b of [-1,1])cineBox(CM.rust,x+a*1.5,8,z+b*1.5,.27,16,.27);
  for(let y=2;y<16;y+=3){cineBox(CM.metal,x,y,z,3.3,.17,3.3);cineRod(CM.rust,new THREE.Vector3(x-1.5,y-2,z+1.5),new THREE.Vector3(x+1.5,y+1,z+1.5),.08);}
  cineBox(CM.rust,x-side*5,16,z,15,.38,2);cineBox(CM.metal,x-side*3,16.5,z,4,1.6,2.5);
  cineRod(CM.metal,new THREE.Vector3(x,20,z),new THREE.Vector3(x-side*12,16,z),.055);
  cineRod(CM.metal,new THREE.Vector3(x-side*10,16,z),new THREE.Vector3(x-side*10,5,z),.035);
  cinePlace(CG.torus,CM.metal,x-side*10,4.9,z,.4,.4,.4);
}

/* The map and collision positions are retained, while all prop meshes are replaced. */
V5_GEO.rock=CG.rock;V5_GEO.tomb=CG.tomb;
V5_MAT.rock=CM.rock;V5_MAT.stone=CM.stone;V5_MAT.wood=CM.wood;V5_MAT.rust=CM.rust;V5_MAT.metal=CM.metal;
V5_GEO.car=cineMerge([new THREE.BoxGeometry(2.18,.46,4.15).translate(0,0,0),cineEllipsoid(0,.11,-1.5,1.12,.27,.57,12),cineEllipsoid(0,.11,1.48,1.10,.24,.57,12)]);
V5_GEO.cabin=cineKeep(cineProfile([[0,.73,.9],[.1,.86,1.06],[.54,.63,.78],[.62,.49,.60]],12).translate(0,-.29,0));
const cineWreckBase=v5Wreck;
v5Wreck=function(x,z,ry=0,s=1){cineWreckBase(x,z,ry,s);for(const a of [-1,1])for(const b of [-1,1]){const dx=a*1.08*s,dz=b*1.34*s,px=x+dx*Math.cos(ry)+dz*Math.sin(ry),pz=z-dx*Math.sin(ry)+dz*Math.cos(ry);cinePlace(CG.cylinder,CM.blackMetal,px,.38*s,pz,.7*s,.25*s,.7*s,ry,0,Math.PI/2);cinePlace(CG.cylinder,CM.metal,px+a*.02,.38*s,pz,.35*s,.28*s,.35*s,ry,0,Math.PI/2);}for(const q of [-1,1]){const dx=q*.76*s,dz=2.02*s;cineBox(CM.glass,x+dx*Math.cos(ry)+dz*Math.sin(ry),.54*s,z-dx*Math.sin(ry)+dz*Math.cos(ry),.45*s,.2*s,.10*s,ry);}};
v5DeadTree=(x,z,s=1,ry=0)=>cineTree(x,z,s,Math.abs(Math.floor(x*139+z*17)),false);
v5RuinedArch=function(x,z,ry){cinePlace(CG.arch,CM.darkStone,x,0,z,3.05,2.35,3.7,ry);for(const side of [-1,1]){const dx=side*3.95;cineBox(CM.stone,x+dx*Math.cos(ry),.18,z-dx*Math.sin(ry),1.25,.35,1.5,ry);cinePlace(CG.cone,CM.blackMetal,x+dx*Math.cos(ry),7.2,z-dx*Math.sin(ry),.42,1.2,.42);}};
v5LoadSceneAssets=async function(){};
v5Road=function(stage){
  const width=stage.key==='city'?13:stage.key==='sea'?11:9.5,p=[],uv=[],ind=[];
  for(let i=0;i<v5Route.length;i++){const a=v5Route[i],b=v5Route[Math.min(i+1,v5Route.length-1)],c=v5Route[Math.max(0,i-1)],dx=b.x-c.x,dz=b.z-c.z,len=Math.hypot(dx,dz)||1;
    for(const side of [-1,1]){p.push(a.x-dz/len*width*.5*side,.015,a.z+dx/len*width*.5*side);uv.push(side===-1?0:width/4,i*2);}
    if(i<v5Route.length-1){const n=i*2;ind.push(n,n+1,n+2,n+1,n+3,n+2);}
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ind);g.computeVertexNormals();const road=new THREE.Mesh(g,CM.paving);road.receiveShadow=true;scene.add(road);
  for(let i=0;i<v5Route.length-1;i++){const a=v5Route[i],b=v5Route[i+1],len=Math.hypot(b.x-a.x,b.z-a.z),rot=Math.atan2(b.x-a.x,b.z-a.z);for(const side of [-1,1]){const pt=v5SidePoint(a,b,side,width/2+.08);cineBox(CM.stone,pt.x,.06,pt.z,.20,.16,len*1.06,rot);}}
};

const cineSkyVertex='varying vec3 vDirection; void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}';
const cineNoise=`float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}float fbm(vec2 p){return noise(p)*.54+noise(p*2.1)*.27+noise(p*4.3)*.13;}`;
function cineAtmosphere(stage,rand){
  scene.background=new THREE.Color(0x101921);scene.fog=new THREE.FogExp2(stage.key==='castle'?0x242030:stage.key==='mountain'?0x8092a1:0x28343c,stage.key==='mountain'?.0045:.006);
  const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{uTime:{value:0},uTint:{value:new THREE.Color(stage.key==='castle'?0x1d182e:stage.key==='mountain'?0x485f78:0x172b40)}},vertexShader:cineSkyVertex,fragmentShader:`varying vec3 vDirection; uniform float uTime;uniform vec3 uTint;${cineNoise}
    void main(){vec3 d=normalize(vDirection);float height=max(d.y,0.0);vec2 uv=d.xz/max(.18,d.y+.27);float cloud=fbm(uv*.85+vec2(uTime*.003,0.0));float thin=smoothstep(.35,.72,cloud);vec3 color=mix(uTint*1.9,uTint*.42,pow(height,.5));color=mix(color,vec3(.24,.28,.32),thin*.62);float stars=pow(hash(floor(d.xz*1400.0)),180.0)*smoothstep(.24,.7,d.y)*(1.0-thin);vec3 moonDir=normalize(vec3(-.48,.58,-.65));float moon=dot(d,moonDir);float disc=smoothstep(.9984,.9992,moon);color+=vec3(.88,.85,.71)*(disc*.9+pow(max(moon,0.0),35.0)*.16)+stars*.22;gl_FragColor=vec4(color,1.0);#include <colorspace_fragment>}`.replace(';#include',';\n#include')});
  cineSky=new THREE.Mesh(new THREE.SphereGeometry(360,32,16),skyMat);cineSky.frustumCulled=false;scene.add(cineSky);
  const envScene=new THREE.Scene(),envSky=cineSky.clone();envScene.add(envSky);const gen=new THREE.PMREMGenerator(renderer);cineEnvironment=gen.fromScene(envScene,.08,.1,450);gen.dispose();scene.environment=cineEnvironment.texture;scene.environmentIntensity=.5;cineTransient.add(cineEnvironment);
  scene.add(new THREE.HemisphereLight(stage.key==='mountain'?0xb9d5e8:0x9db2c5,0x36312b,1.4));
  cineMoonLight=new THREE.DirectionalLight(stage.key==='castle'?0x9e95d2:0xc0d5e8,2.25);cineMoonLight.position.set(-35,52,-35);cineMoonLight.castShadow=true;cineMoonLight.shadow.mapSize.set(cineMobile?1024:2048,cineMobile?1024:2048);Object.assign(cineMoonLight.shadow.camera,{left:-35,right:35,top:35,bottom:-35,near:1,far:140});cineMoonLight.shadow.bias=-.00018;cineMoonLight.shadow.normalBias=.05;scene.add(cineMoonLight,cineMoonLight.target);
  cineLampLights=[];for(let i=0;i<3;i++){const l=new THREE.PointLight(0xffc17b,18,15,2);scene.add(l);cineLampLights.push(l);}
  cineFlashlight=new THREE.SpotLight(0xffead0,34,32,Math.PI/6,.7,1.5);cineFlashlight.position.set(.2,-.2,.05);cineFlashlight.target.position.set(0,-.05,-12);camera.add(cineFlashlight,cineFlashlight.target);
  const m=state.maze,ground=new THREE.Mesh(new THREE.PlaneGeometry(m.cols*m.cell+130,m.rows*m.cell+150),stage.key==='mountain'?CM.paleStone:CM.darkStone);ground.rotation.x=-Math.PI/2;ground.position.set(0,-.065,m.z0-m.rows*m.cell/2);ground.receiveShadow=true;scene.add(ground);
  /* Low drifting ground mist; distance fog remains the main depth cue. */
  const mist=new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,uniforms:{uTime:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',fragmentShader:`varying vec2 vUv;uniform float uTime;${cineNoise}void main(){float edge=smoothstep(0.0,.22,vUv.x)*smoothstep(1.0,.78,vUv.x)*smoothstep(0.0,.25,vUv.y)*smoothstep(1.0,.75,vUv.y);float n=fbm(vUv*5.0+vec2(uTime*.018,0.0));gl_FragColor=vec4(.49,.56,.60,edge*n*.12);}`});
  for(let i=0;i<8;i++){const p=v5RouteAt((i+.3)/8),fog=new THREE.Mesh(new THREE.PlaneGeometry(34,20),mist);fog.rotation.x=-Math.PI/2+.07;fog.position.set(p.x,.35+(i%3)*.2,p.z);scene.add(fog);}cineWater.push({type:'mist',material:mist});
  const count=cineMobile?350:650,positions=new Float32Array(count*3),speeds=new Float32Array(count);for(let i=0;i<count;i++){positions.set([(rand()-.5)*62,rand()*24,(rand()-.5)*62],i*3);speeds[i]=.4+rand();}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setAttribute('aSpeed',new THREE.BufferAttribute(speeds,1));
  const snowy=stage.key==='mountain',embers=stage.key==='castle';
  const wm=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uTime:{value:0},uCenter:{value:new THREE.Vector3()},uSnow:{value:snowy?1:embers?2:0}},vertexShader:`uniform float uTime;uniform vec3 uCenter;uniform float uSnow;attribute float aSpeed;varying float vFade;void main(){vec3 p=position;p.x+=sin(uTime*.35+p.y)*.8;float speed=uSnow<.5?15.0:uSnow<1.5?1.6:-1.4;p.y=mod(p.y-uTime*speed*aSpeed,24.0);p+=uCenter;vec4 mv=modelViewMatrix*vec4(p,1.0);vFade=1.0-smoothstep(16.0,34.0,-mv.z);gl_PointSize=clamp((uSnow<.5?28.0:65.0)/max(1.0,-mv.z),1.0,6.0);gl_Position=projectionMatrix*mv;}`,fragmentShader:`uniform float uSnow;varying float vFade;void main(){vec2 p=gl_PointCoord-.5;float a=uSnow<.5?smoothstep(.2,.02,abs(p.x))*smoothstep(.5,.3,abs(p.y)):smoothstep(.5,.08,length(p));vec3 c=uSnow>1.5?vec3(1.0,.31,.08):vec3(.75,.84,.92);gl_FragColor=vec4(c,a*vFade*.44);}`});
  cineWeather=new THREE.Points(g,wm);cineWeather.frustumCulled=false;scene.add(cineWeather);
}
function cineWaterSurface(x,z,w,d,lava=false){
  const m=new THREE.MeshStandardMaterial({color:lava?0x491405:0x123b43,roughness:lava?.72:.2,metalness:lava?0:.58,emissive:lava?0xff4013:0x000000,emissiveIntensity:lava?1.8:0});
  m.onBeforeCompile=shader=>{shader.uniforms.uCineTime={value:0};m.userData.shader=shader;shader.vertexShader='uniform float uCineTime;varying vec3 vWater;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    vWater=position;transformed.z+=sin(position.x*.65+uCineTime)*.07+sin(position.y*.4+uCineTime*1.3)*.04;`);shader.fragmentShader='uniform float uCineTime;varying vec3 vWater;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
    normal=normalize(normal+vec3(sin(vWater.x*2.3+uCineTime*1.2)*.22,cos(vWater.y*2.0+uCineTime)*.13,0.0));`);};
  const o=new THREE.Mesh(new THREE.PlaneGeometry(w,d,20,70),m);o.rotation.x=-Math.PI/2;o.position.set(x,-.12,z);scene.add(o);cineWater.push({mesh:o,material:m});
}
function cineBuildWorld(stage,rand){
  cineChunks=[];cineBatches.clear();cineLamps=[];cineWater=[];v5BuildRoute();cineAtmosphere(stage,rand);v5Scenery(stage,rand);
  /* v5 adds legacy fill lights; retain only the intentional cinematic light rig. */
  for(const o of [...scene.children])if(o.isLight&&o!==cineMoonLight&&!cineLampLights.includes(o)&&!o.isHemisphereLight)scene.remove(o);
  const hemis=scene.children.filter(o=>o.isHemisphereLight);hemis.slice(1).forEach(o=>scene.remove(o));
  scene.fog=new THREE.FogExp2(stage.key==='mountain'?0x8092a1:stage.key==='castle'?0x242030:0x28343c,stage.key==='mountain'?.0045:.006);
  const m=state.maze,total=m.rows*m.cell;
  for(let i=0;i<19;i++){const p=v5RouteAt(i/20),q=v5RouteAt(Math.min(1,i/20+.015));for(const side of [-1,1]){
    const a=v5SidePoint(p,q,side,18+rand()*8),seed=state.seed+i*37+(side+1)*132;
    if(stage.key==='mansion'){
      if(i%4===1)cineManor(a.x+side*6,a.z,16+rand()*8,10+rand()*5,11);
      else{cineTree(a.x,a.z,.9+rand()*.5,seed);for(let j=0;j<3;j++){cinePlace(CG.tomb,CM.stone,a.x+side*j*1.8,0,a.z+j*1.2,1,1.2,1,rand()*.4);}}
    }else if(stage.key==='mountain'){cineCliff(a.x+side*8,a.z,1.1+rand(),seed,true);cineTree(a.x,a.z,1.3+rand(),seed,true);}
    else if(stage.key==='river'){cineCliff(a.x+side*12,a.z,1.5+rand(),seed);cineTree(a.x,a.z,1.1+rand(),seed,true);}
    else if(stage.key==='sea'){if(i%4===1)cineIndustrial(a.x+side*7,a.z,16,8+rand()*4);if(i%5===0)cineCrane(a.x+side*15,a.z,side);}
    else if(stage.key==='city'){cineIndustrial(a.x+side*6,a.z,14+rand()*9,13+rand()*27);if(i%3===0)cineBox(CM.red,a.x,4.7,a.z+6,2.8,.7,.18);}
    else{if(i%4===1)cineManor(a.x+side*7,a.z,17,18+rand()*7,13,true);else{cinePlace(CG.cylinder,CM.darkStone,a.x,7,a.z,4.2,14,4.2);cinePlace(CG.cone,CM.roof,a.x,16,a.z,5.2,5.5,5.2);for(let j=0;j<8;j++){const an=j*Math.PI/4;cineBox(CM.stone,a.x+Math.cos(an)*2,13.6,a.z+Math.sin(an)*2,.65,1.1,.65);}}}
  }
    if(i%2===0){for(const side of [-1,1]){const a=v5SidePoint(p,q,side,5.8);cineLantern(a.x,a.z,3.5);}}
  }
  if(stage.key==='mansion'){
    const p=v5RouteAt(.055);cineManor(p.x-24,p.z-14,22,14,14);cineManor(p.x+27,p.z-22,24,13,16);
    for(let i=0;i<24;i++){const z=4-i*3;for(const side of [-1,1]){cineBox(CM.blackMetal,side*10,1.25,z,.065,2.5,.065);cinePlace(CG.cone,CM.blackMetal,side*10,2.62,z,.17,.28,.17);if(i<23)for(const y of [.65,1.8])cineBox(CM.blackMetal,side*10,y,z-1.5,.075,.07,3.05);}}
  }
  if(stage.key==='river'||stage.key==='sea'||stage.key==='castle')for(const side of [-1,1])cineWaterSurface(side*(m.cols*m.cell/2+12),m.z0-total/2,30,total+90,stage.key==='castle');
  if(stage.key==='river')for(const t of [.25,.56,.77]){const p=v5RouteAt(t);for(const side of [-1,1])cinePlace(CG.arch,CM.stone,p.x+side*12,-.3,p.z,4,2.4,2,Math.PI/2);}
  for(let i=0;i<160;i++){const t=rand(),p=v5RouteAt(t),q=v5RouteAt(Math.min(.999,t+.01)),a=v5SidePoint(p,q,i%2?1:-1,6.8+rand()*8);cinePlace(CG.rock,stage.key==='mountain'?CM.paleStone:CM.rock,a.x,.07,a.z,.12+rand()*.34,.1+rand()*.2,.15+rand()*.32,rand()*6);}
  cineFlush();
  if(owNote)owNote.textContent=stage.jp;
}
decorateMansion=decorateMountain=decorateRiver=decorateSea=decorateCity=decorateCastle=cineBuildWorld;

/* Reuse the six existing arenas and exits, but replace their surfaces and silhouette. */
const cineArenaBase=buildBossArena;
buildBossArena=function(stage){const before=new Set(scene.children),z=cineArenaBase(stage);for(const o of [...scene.children])if(!before.has(o)){if(o.isLight){scene.remove(o);continue;}if(o.isMesh){o.castShadow=true;o.receiveShadow=true;if(o.geometry.type==='PlaneGeometry')o.material=CM.paving;else if(!o.userData.bossGate&&o.geometry.type!=='TorusGeometry')o.material=CM.darkStone;}}
  cinePlace(CG.arch,CM.stone,0,0,z-12,6,5,5);cineFlush();return z;};

const cineEnvironmentBase=buildEnvironment;
buildEnvironment=function(){const z=cineEnvironmentBase();scene.traverse(o=>{if(o.isMesh&&!o.isInstancedMesh&&!o.material?.transparent&&o!==cineSky){o.receiveShadow=true;o.castShadow=true;}});return z;};
