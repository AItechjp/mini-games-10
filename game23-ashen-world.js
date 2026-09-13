/* Moonlit cloisters and the remnants of an extinguished order. All art is
   original geometry; scenery shares instanced batches and three local lights. */
const ASH_VERSION='moonlit-cloisters-1';
const ashReducedMotion=matchMedia('(prefers-reduced-motion:reduce)');
const ASH_PALETTES=[
  {sky:0x182c42,fog:0x243544,moon:0xb7d5f1,cloth:0x786660},
  {sky:0x253750,fog:0x465967,moon:0xc3def3,cloth:0x687780},
  {sky:0x192e32,fog:0x283d40,moon:0xaacccd,cloth:0x64756d},
  {sky:0x182838,fog:0x263644,moon:0xb6c6df,cloth:0x606c80},
  {sky:0x302834,fog:0x393139,moon:0xd5c5c0,cloth:0x895e58},
  {sky:0x30252b,fog:0x372e32,moon:0xd7bba6,cloth:0x886350}
];
const AG={},AM={};
AG.column=cineKeep(cineProfile([[0,.68,.68],[.16,.68,.68],[.26,.50,.50],[.43,.44,.44],[.54,.32,.32],[3.5,.26,.26],[3.65,.40,.40],[3.82,.53,.53],[4,.53,.53]],12));
AG.bell=cineKeep(new THREE.LatheGeometry([[.08,.9],[.24,.84],[.31,.63],[.35,.34],[.47,.12],[.65,.02],[.66,-.1],[.53,-.12],[.4,.04],[.29,.34],[.21,.68]].map(p=>new THREE.Vector2(...p)),20));
AG.flame=cineKeep(new THREE.PlaneGeometry(1,1).translate(0,.5,0));
AG.seal=cineKeep(new THREE.RingGeometry(1.18,1.27,40));
AG.banner=cineKeep(new THREE.PlaneGeometry(1.3,4.1,6,12).translate(0,-2.05,0));
{
  const p=AG.banner.attributes.position;
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),y=p.getY(i),drop=Math.max(0,(-y-3.45)/.65);
    p.setZ(i,Math.sin(x*6-y*1.2)*.07*Math.min(1,-y));
    p.setY(i,y+drop*(.11+.31*(.5+.5*Math.sin(x*23))));
  }
  p.needsUpdate=true;AG.banner.computeVertexNormals();AG.banner.computeBoundingSphere();
}
AM.banner=cineSurface(0x743d34,.95,0,'fabric');AM.banner.side=THREE.DoubleSide;
AM.brass=cineSurface(0xbba174,.52,.67,'metal');
AM.plate=cineSurface(0x71818a,.46,.68,'metal');
AM.ember=cineKeep(new THREE.MeshBasicMaterial({color:0xe8a453,toneMapped:false}));
AM.ash=cineSurface(0x8b8980,.98,0,'stone',.7);
AM.flame=cineKeep(new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
  uniforms:{uTime:{value:0}},
  vertexShader:`varying vec2 vUv;varying float vSeed;
    void main(){vUv=uv;vec4 p=vec4(position,1.0);
      #ifdef USE_INSTANCING
      p=instanceMatrix*p;
      #endif
      vec4 world=modelMatrix*p;vSeed=world.x*.37+world.z*.23;
      gl_Position=projectionMatrix*viewMatrix*world;}`,
  fragmentShader:`varying vec2 vUv;varying float vSeed;uniform float uTime;
    void main(){float y=vUv.y,t=uTime*3.4+vSeed;
      float curl=sin(y*7.0-t)*.07*y+sin(y*15.0-t*1.7)*.025*y;
      float width=mix(.34,.025,pow(y,.72));float edge=1.0-smoothstep(width*.5,width,abs(vUv.x-.5-curl));
      float a=edge*smoothstep(0.0,.10,y)*(1.0-smoothstep(.68,1.0,y));
      vec3 c=mix(vec3(1.8,.19,.015),vec3(3.0,1.25,.25),edge*(1.0-y*.72));
      gl_FragColor=vec4(c,a*.92);}`
}));
AM.flame.userData.ashNoShadow=true;AM.ember.userData.ashNoShadow=true;
// Keep cloth movement in the vertex shader, independent of the number of flags.
const ashWind={value:0};
const ashBannerCompile=AM.banner.onBeforeCompile;
AM.banner.onBeforeCompile=shader=>{
  ashBannerCompile(shader);shader.uniforms.uAshWind=ashWind;
  shader.vertexShader='uniform float uAshWind;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
    float loose=clamp(-position.y/4.1,0.0,1.0);
    transformed.z+=(sin(uAshWind*1.2+position.y*1.8)+sin(uAshWind*.65+position.x*4.0)*.35)*loose*.19;`);
};
AM.banner.customProgramCacheKey=()=>ASH_VERSION+'-cloth';

// Larger masonry courses and damp foundations remain legible at playing distance.
for(const material of [CM.stone,CM.darkStone,CM.brick,CM.paving]){
  const base=material.onBeforeCompile,key=material.customProgramCacheKey.bind(material);
  material.onBeforeCompile=shader=>{
    base(shader);
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`
      vec3 an=abs(normalize(vCineNormal));
      vec2 blockUv=an.y>.65?vCineWorld.xz:vec2(an.x>an.z?vCineWorld.z:vCineWorld.x,vCineWorld.y);
      blockUv*=vec2(.82,1.55);blockUv.x+=mod(floor(blockUv.y),2.0)*.5;
      vec2 cell=fract(blockUv);float joint=1.0-smoothstep(.012,.035,min(min(cell.x,1.0-cell.x),min(cell.y,1.0-cell.y)));
      float stain=.5+.5*sin(vCineWorld.x*.8+sin(vCineWorld.z*1.3))*sin(vCineWorld.z*.7+vCineWorld.y*.3);
      diffuseColor.rgb*=mix(.92,1.10,stain)*(1.0-joint*.30);
      float wet=(1.0-smoothstep(.2,2.7,vCineWorld.y))*smoothstep(.3,.85,stain);
      diffuseColor.rgb*=1.0-wet*.12;
      #include <roughnessmap_fragment>
      roughnessFactor=mix(roughnessFactor,.30,wet*.58);`);
  };
  material.customProgramCacheKey=()=>key()+'-ashen-masonry';material.needsUpdate=true;
}
CM.stone.color.setHex(0xb5b2a5);CM.darkStone.color.setHex(0x777f80);
CM.paving.color.setHex(0x96968c);CM.paving.roughness=.57;
DG.iron.color.setHex(0x78818a);DG.iron.roughness=.48;
DG.cloakMaterial.color.setHex(0xb2a38c);
CM.skin.color.setHex(0xc3c8bd);CM.eye.emissive.setHex(0xf3a447);CM.eye.emissiveIntensity=2.3;

cineLantern=function(x,z,y=2.4){
  cinePlace(CG.cylinder,CM.darkStone,x,y*.37,z,.38,y*.74,.38);
  cinePlace(CG.cylinder,CM.stone,x,.13,z,.70,.26,.70);
  cinePlace(CG.cone,DG.iron,x,y-.26,z,.90,.48,.90,0,Math.PI);
  cinePlace(CG.sphere,AM.ember,x,y-.14,z,.43,.12,.43);
  for(let i=0;i<5;i++){const a=i*Math.PI*2/5;cineBox(DG.iron,x+Math.cos(a)*.31,y-.12,z+Math.sin(a)*.31,.055,.60,.055);}
  for(const ry of [0,Math.PI/2])cinePlace(AG.flame,AM.flame,x,y-.1,z,.82,1.35,.82,ry);
  cineLamps.push(new THREE.Vector3(x,y+.16,z));
};

function ashGate(p,ry,scale=1,broken=false){
  const c=Math.cos(ry),s=Math.sin(ry),at=(x,z)=>({x:p.x+(x*c+z*s)*scale,z:p.z+(-x*s+z*c)*scale});
  const put=(g,m,x,y,z,sx=1,sy=1,sz=1,rz=0)=>{const a=at(x,z);cinePlace(g,m,a.x,y*scale,a.z,sx*scale,sy*scale,sz*scale,ry,0,rz);};
  put(DG.ogive,CM.stone,0,0,0,3.05,3.15,3.0);
  put(DG.ogive,CM.darkStone,0,.1,-.65,3.25,3.2,2.4);
  for(const side of [-1,1]){
    put(AG.column,CM.paleStone,side*4.35,0,.2,1.15,2.5,1.15);
    put(CG.box,CM.stone,side*4.35,10.25,0,2.1,.50,2.4);
    put(CG.cone,DG.iron,side*4.35,12,0,.52,3,.52);
    const foot=at(side*4.35,.2);cineSolid(foot.x,foot.z,1.45*scale,1.45*scale);
    const lamp=at(side*3.0,2.0);cineLantern(lamp.x,lamp.z,2.0*scale);
    put(CG.box,AM.brass,side*5.5,9,.8,2.5,.09,.12);
    put(AG.banner,AM.banner,side*5.5,9,.84,1,1,1);
    const a=at(side*4.5,-.7),b=at(side*8,-5);
    cineRod(CM.stone,new THREE.Vector3(a.x,10*scale,a.z),new THREE.Vector3(b.x,3.7*scale,b.z),.24*scale);
  }
  put(AG.seal,AM.brass,0,13.15,.2,1.10,1.10,1.10);
  put(CG.torus,CM.darkStone,0,13.15,0,1.5,1.5,.85);
  for(let i=0;i<8;i++){const a=i*Math.PI/4;put(CG.box,AM.brass,Math.sin(a)*.68,13.15+Math.cos(a)*.68,.2,.055,1.4,.07,-a);}
  put(CG.sphere,AM.ember,0,13.15,.21,.17,.17,.09);
  if(!broken){put(AG.bell,AM.brass,0,9.5,0,1.1,1.1,1.1);put(CG.cylinder,DG.iron,0,10.7,0,.08,1.4,.08);}
  else for(let i=0;i<4;i++)put(CG.rock,CM.stone,5.8+i*.55,.2,2+i%2,.65,.45,.6,i*.4);
}
function ashShrine(x,z,ry=0){
  cinePlace(CG.cylinder,CM.darkStone,x,.12,z,2.5,.24,2.5);
  cinePlace(CG.cylinder,AM.ash,x,.26,z,1.75,.10,1.75);
  for(let i=0;i<7;i++){const a=i*Math.PI*2/7;cinePlace(CG.rock,CM.rock,x+Math.cos(a)*.72,.3,z+Math.sin(a)*.72,.40,.25,.35,a);}
  cinePlace(DG.sword,AM.brass,x,.95,z,.65,.88,.65,ry,0,-.13);
  for(const angle of [0,Math.PI/2])cinePlace(AG.flame,AM.flame,x,.27,z,1.25,1.55,1.25,angle);
  cineLamps.push(new THREE.Vector3(x,1.1,z));
}
const ashBuildBase=cineBuildWorld;
cineBuildWorld=function(stage,rand){
  ashBuildBase(stage,rand);
  // First gateway establishes scale from the spawn. Later gateways frame encounters.
  for(const [i,t] of [.065,.29,.53,.76].entries()){
    const p=v5RouteAt(t),q=v5RouteAt(t+.008),ry=Math.atan2(q.x-p.x,q.z-p.z);
    ashGate(p,ry,i===0?1.12:1,i%2===1);
    const shrine=v5SidePoint(p,q,i%2?1:-1,7.8);ashShrine(shrine.x,shrine.z,ry);
  }
  // Receding side arcades give each route a foreground, middle distance and skyline.
  for(let i=0;i<10;i++){
    const t=.018+i*.018,p=v5RouteAt(t),q=v5RouteAt(t+.008),ry=Math.atan2(q.x-p.x,q.z-p.z);
    for(const side of [-1,1]){
      const a=v5SidePoint(p,q,side,9.7);
      cinePlace(AG.column,CM.stone,a.x,0,a.z,.83,1.9,.83,ry);
      cineSolid(a.x,a.z,1.05,1.05);
      if(i%2===0){cinePlace(AG.banner,AM.banner,a.x,6.8,a.z,1,1,1,ry);dfCandles(a.x,a.z+.6,i);}
    }
  }
  const end=v5RouteAt(.9);dfTower(end.x-34,end.z-20,48,5.3,true);dfTower(end.x+39,end.z-34,60,4.1,false);
  cineFlush();frame.dataset.art=ASH_VERSION;
};
decorateMansion=decorateMountain=decorateRiver=decorateSea=decorateCity=decorateCastle=cineBuildWorld;

// Dark silver plate, narrow helmets and torn cloth break up the old round silhouettes.
AG.pauldrons=cineMerge([-1,1].flatMap(side=>[
  cineEllipsoid(side*.36,.29,0,.19,.115,.25,12),
  cineEllipsoid(side*.40,.20,0,.18,.08,.23,12)
]));
AG.helm=cineMerge([
  new THREE.SphereGeometry(.275,16,10,0,Math.PI*2,0,Math.PI*.55).scale(.9,1.05,.9),
  new THREE.BoxGeometry(.032,.39,.055).translate(0,.015,.248),
  new THREE.BoxGeometry(.42,.055,.06).translate(0,.085,.238),
  new THREE.BoxGeometry(.09,.22,.05).translate(-.17,-.045,.19),
  new THREE.BoxGeometry(.09,.22,.05).translate(.17,-.045,.19)
]);
for(const geometry of [CA.head,CA.eyes,CA.sockets,CA.teeth])geometry.scale(.82,.86,.84);
DG.cowl.scale(.88,.91,.90);
cineHordeSpec.shoulders=[AG.pauldrons,AM.plate];
cineHordeSpec.helmet=[AG.helm,AM.plate];
cineHordeSpec.cowl=[DG.cowl,DG.cloakMaterial];cineHordeKeys.push('cowl');
const ashTintBase=v5TintEnemies;
v5TintEnemies=function(){
  ashTintBase();if(!horde)return;
  const colors=[0xb9a695,0x82605b,0x9aa6a3,0x6e7b81];
  for(const e of state.enemies.values())if(!e.boss&&e.index>=0&&e.index<horde.capacity){
    const cloth=new THREE.Color(colors[e.index%colors.length]);
    horde.body.setColorAt(e.index,cloth);horde.shoulders.setColorAt(e.index,new THREE.Color(0xa4aeb0));
    horde.tabard.setColorAt(e.index,cloth);horde.cowl.setColorAt(e.index,cloth);
  }
  for(const key of ['body','shoulders','tabard','cowl'])if(horde[key].instanceColor)horde[key].instanceColor.needsUpdate=true;
};
const ashPoseBase=updateHordeVisuals;
updateHordeVisuals=function(now){
  const before=cineVisualAt;ashPoseBase(now);if(cineVisualAt===before||!horde?.cowl)return;
  for(const e of state.enemies.values()){
    if(e.boss||e.index<0||e.index>=horde.capacity)continue;
    const i=e.index,low=['crawler','hound','stalker'].includes(e.type);
    if(e.dead||low||!cineVisibility.get(e)?.shown){hideInst(horde.cowl,i);continue;}
    const heavy=['brute','bloater'].includes(e.type),s=heavy?1.32:1;
    Object.assign(cinePose,{x:e.x,z:e.z,visualYaw:e.visualYaw||0});
    if(e.type==='armored'||e.type==='brute'||i%4===1){
      hideInst(horde.cowl,i);setInst(horde.helmet,i,cinePose,0,2.07*s,.08*s,.06,0,(e.headTilt||0)*.12,s,s,s);
      setInst(horde.v5Armor,i,cinePose,0,1.40*s,.22*s,.1,0,0,s*1.02,s*1.1,s);
    }else{
      hideInst(horde.helmet,i);
      if(i%3!==2)setInst(horde.cowl,i,cinePose,0,2.06*s,.06*s,.06,0,0,s,s,s);else hideInst(horde.cowl,i);
    }
  }
  for(const key of ['helmet','cowl','v5Armor'])horde[key].instanceMatrix.needsUpdate=true;
};
const ashEnvironmentBase=buildEnvironment;
buildEnvironment=function(){
  const arena=ashEnvironmentBase(),palette=ASH_PALETTES[state.area%6],act=Math.floor(state.area/6);
  cineSky?.material.uniforms.uTint.value.setHex(palette.sky);
  if(scene.fog){scene.fog.color.setHex(palette.fog);scene.fog.density=currentStage().key==='mountain'?.010:.0095;}
  scene.environmentIntensity=.40;
  for(const light of scene.children)if(light.isHemisphereLight){light.color.setHex(0xb2c9dc);light.groundColor.setHex(0x514333);light.intensity=.72;}
  if(cineMoonLight){cineMoonLight.color.setHex(palette.moon);cineMoonLight.intensity=2.65;}
  if(cineFlashlight){cineFlashlight.color.setHex(0xffdbaa);cineFlashlight.intensity=48;cineFlashlight.distance=38;cineFlashlight.decay=1.45;cineFlashlight.penumbra=.85;}
  if(cineWeather)cineWeather.material.uniforms.uSnow.value=currentStage().key==='castle'?2:1;
  AM.banner.color.setHex(act===2?0x58342f:state.area%6===1?0x68737f:0x743d34);
  renderer.toneMappingExposure=1.08;
  return arena;
};
function ashAnimate(now){
  const t=now*.001;AM.flame.uniforms.uTime.value=t;ashWind.value=ashReducedMotion.matches?0:t;
  for(let i=0;i<cineLampLights.length;i++){
    const light=cineLampLights[i];if(!light.intensity)continue;
    light.color.setHex(0xffb660);light.intensity=34+Math.sin(t*7.3+i*2.1)*3+Math.sin(t*13.7+i)*1.7;
  }
}
