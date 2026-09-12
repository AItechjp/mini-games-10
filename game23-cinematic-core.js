/* BLACK SITE / cinematic renderer. Original models and materials, shared by all six areas. */
const CINE_VERSION='ashen-pilgrimage-1';
const cineMobile=matchMedia('(pointer:coarse)').matches||navigator.maxTouchPoints>0;
const cineAssets=new URL('assets/game23/cinematic/',document.baseURI).href;
const cineTextures={},cineShared=new Set(),cineTransient=new Set();
let cineQuality='auto';
try{cineQuality=localStorage.getItem('blacksite.graphics')||'auto';}catch{}
if(!['auto','high','balanced','low'].includes(cineQuality))cineQuality='auto';
if(new URLSearchParams(location.search).get('quality')==='high')cineQuality='high';
const cineBudget=new AitechFrameBudget({mode:cineQuality,coarse:cineMobile,maxPixels:cineMobile?1500000:2600000});
let cineRatio=cineBudget.scale(frame.clientWidth||innerWidth,frame.clientHeight||innerHeight,devicePixelRatio||1);
renderer.setPixelRatio(cineRatio);
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.12;
renderer.shadowMap.enabled=cineQuality!=='low';
renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
camera.far=420;camera.updateProjectionMatrix();
resize();

function cineKeep(x){cineShared.add(x);return x;}
function cineMerge(parts,shared=true){
  const data={position:[],normal:[],uv:[]};
  for(const part of parts){const g=part.index?part.toNonIndexed():part;for(const key of Object.keys(data)){const a=g.getAttribute(key);if(a)data[key].push(...a.array);}if(g!==part)g.dispose();part.dispose();}
  const g=new THREE.BufferGeometry();for(const key of Object.keys(data))g.setAttribute(key,new THREE.Float32BufferAttribute(data[key],key==='uv'?2:3));g.computeBoundingSphere();return shared?cineKeep(g):g;
}
function cineEllipsoid(x,y,z,sx,sy,sz,segments=16){return new THREE.SphereGeometry(1,segments,12).scale(sx,sy,sz).translate(x,y,z);}
function cineTube(points,radius=.08,segments=16){return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),segments,radius,7,false);}
function cineProfile(rings,segments=20){
  const p=[],uv=[],ind=[];
  for(let j=0;j<rings.length;j++){const [y,rx,rz,cx=0,cz=0]=rings[j];for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2;p.push(cx+Math.sin(a)*rx,y,cz+Math.cos(a)*rz);uv.push(i/segments,j/(rings.length-1));}}
  for(let j=0;j<rings.length-1;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+segments+1;ind.push(a,a+1,b,b,a+1,b+1);}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(ind);g.computeVertexNormals();g.computeBoundingSphere();return g;
}
function cineSurface(color,roughness=.8,metalness=0,kind='stone',scale=.28){
  const m=cineKeep(new THREE.MeshStandardMaterial({color,roughness,metalness}));
  m.userData.cineKind=kind;m.userData.cineScale=scale;
  if(kind==='stone'){
    m.onBeforeCompile=shader=>{
      shader.vertexShader='varying vec3 vCineWorld; varying vec3 vCineNormal;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
        vec4 cpos=vec4(transformed,1.0); vec3 cn=objectNormal;
        #ifdef USE_INSTANCING
          cpos=instanceMatrix*cpos; cn=mat3(instanceMatrix)*cn;
        #endif
        vCineWorld=(modelMatrix*cpos).xyz; vCineNormal=normalize(mat3(modelMatrix)*cn);`);
      shader.fragmentShader='varying vec3 vCineWorld; varying vec3 vCineNormal;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`
        float cineHeight=0.5;
        #ifdef USE_MAP
          vec3 weights=pow(abs(normalize(vCineNormal)),vec3(5.0));weights/=max(dot(weights,vec3(1.0)),0.001);
          vec3 wp=vCineWorld*${scale.toFixed(4)};
          vec4 texel=texture2D(map,wp.yz)*weights.x+texture2D(map,wp.xz)*weights.y+texture2D(map,wp.xy)*weights.z;
          diffuseColor*=texel;cineHeight=dot(texel.rgb,vec3(.299,.587,.114));
        #endif`);
      // Screen derivatives reuse the existing triplanar sample for fine stone relief.
      if(cineQuality==='high'||!cineMobile&&cineQuality==='auto')shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
        vec3 cq0=dFdx(-vViewPosition),cq1=dFdy(-vViewPosition);
        vec3 cr1=cross(cq1,normal),cr2=cross(normal,cq0);float cd=dot(cq0,cr1);
        vec3 cg=sign(cd)*(dFdx(cineHeight)*cr1+dFdy(cineHeight)*cr2);
        if(abs(cd)>0.000001)normal=normalize(abs(cd)*normal-cg*0.018);`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        float damp=sin(vCineWorld.x*.77+sin(vCineWorld.z*.36))*sin(vCineWorld.z*.63);
        roughnessFactor=clamp(roughnessFactor-damp*.13,.18,1.0);`);
    };
    m.customProgramCacheKey=()=>`cine-triplanar-relief-${scale}-${cineQuality}`;
  }
  return m;
}
const CM={
  stone:cineSurface(0xb0aaa0,.87,0),darkStone:cineSurface(0x646a70,.84,0),paving:cineSurface(0x91968f,.61,.06),
  paleStone:cineSurface(0xc5c8c5,.92,0),rock:cineSurface(0x878d88,.92,0,'stone',.16),
  brick:cineSurface(0x786659,.9,0),roof:cineSurface(0x39434c,.68,.1),wood:cineSurface(0x544535,.88,0,'fabric'),
  metal:cineSurface(0x56626a,.37,.82,'metal'),blackMetal:cineSurface(0x1b2228,.44,.75,'metal'),rust:cineSurface(0x69503e,.8,.5,'stone',.6),
  glass:cineKeep(new THREE.MeshPhysicalMaterial({color:0x1a2c35,roughness:.16,metalness:.32,clearcoat:1})),
  window:cineKeep(new THREE.MeshStandardMaterial({color:0xc7a477,emissive:0xffb565,emissiveIntensity:1.2,roughness:.22})),
  red:cineKeep(new THREE.MeshStandardMaterial({color:0x7e2221,emissive:0xff3c21,emissiveIntensity:2})),
  moss:cineSurface(0x455441,.96,0),skin:cineSurface(0xc4c1ae,.72,0,'skin'),cloth:cineSurface(0xc2c1ad,.96,0,'fabric'),
  pants:cineSurface(0x7b8379,.98,0,'fabric'),leather:cineSurface(0x343b38,.68,0,'fabric'),bone:cineSurface(0xd0c6a9,.66,0,'skin'),
  eye:cineKeep(new THREE.MeshStandardMaterial({color:0xe0dfb1,emissive:0xb28d55,emissiveIntensity:.7,roughness:.19})),
  cavity:cineKeep(new THREE.MeshStandardMaterial({color:0x201919,roughness:.9})),
  amber:cineKeep(new THREE.MeshBasicMaterial({color:0xffd29a,toneMapped:false}))
};

const cineTextureReady=Promise.all(['stone','skin','fabric'].map(async kind=>{
  try{
    const t=await new THREE.TextureLoader().loadAsync(kind==='stone'?new URL('assets/game23/ashen/cathedral-stone.webp',document.baseURI).href:kind==='fabric'?new URL('assets/game23/ashen/burial-cloth.webp',document.baseURI).href:cineAssets+kind+'.webp');
    t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());cineKeep(t);cineTextures[kind]=t;
    for(const m of cineShared)if(m.isMaterial&&m.userData.cineKind===kind){m.map=t;if(kind!=='stone'){m.bumpMap=t;m.bumpScale=kind==='skin'?.022:.012;}m.needsUpdate=true;}
    return true;
  }catch(err){console.warn('Material unavailable; using physical base material:',kind);return false;}
}));

/* Public rendering preferences: switching detail does not reset a running mission. */
const cineSelect=document.createElement('select');cineSelect.id='game23-quality';cineSelect.setAttribute('aria-label','グラフィック品質');
for(const [value,label] of [['auto','画質：自動'],['high','画質：高画質'],['balanced','画質：標準'],['low','画質：軽量']]){const o=document.createElement('option');o.value=value;o.textContent=label;cineSelect.append(o);}
cineSelect.value=cineQuality;document.querySelector('.outbreak-toolbar')?.append(cineSelect);
cineSelect.addEventListener('change',()=>{cineQuality=cineSelect.value;try{localStorage.setItem('blacksite.graphics',cineQuality);}catch{}cineBudget.setMode(cineQuality);cineRatio=cineBudget.scale(frame.clientWidth||innerWidth,frame.clientHeight||innerHeight,devicePixelRatio||1);renderer.setPixelRatio(cineRatio);renderer.shadowMap.enabled=cineQuality!=='low';renderer.shadowMap.needsUpdate=true;scene.traverse(o=>{if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material])m.needsUpdate=true;}});resize();toast(cineSelect.selectedOptions[0].textContent,900);});
frame.dataset.graphics=CINE_VERSION;

/* Dispose area-only GPU resources; shared geometry/textures remain reusable. */
const cineOldClear=clearScene;
clearScene=function(){
  const gs=new Set(),ms=new Set(),ts=new Set(),instances=[];
  scene.traverse(o=>{if(o.isInstancedMesh)instances.push(o);if(o.geometry&&!cineShared.has(o.geometry))gs.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])if(!cineShared.has(m))ms.add(m);if(o.isLight)o.shadow?.map?.dispose();});
  for(const m of ms)for(const k of ['map','normalMap','roughnessMap','bumpMap'])if(m[k]&&!cineShared.has(m[k]))ts.add(m[k]);
  cineOldClear();for(const o of instances)o.dispose();for(const g of gs)g.dispose();for(const m of ms)m.dispose();for(const t of ts)t.dispose();for(const x of cineTransient)x.dispose?.();cineTransient.clear();
};
/* Legacy collision and pickup resources are reused on subsequent areas. */
for(const d of [GEO,MAT,V5_GEO,V5_MAT])for(const x of Object.values(d))cineKeep(x);
for(const t of [owSkinTex,owSkinDarkTex,owClothTex,owBloodClothTex,owCloudTex])cineKeep(t);
