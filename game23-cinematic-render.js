/* Single composite pass: depth contact shading, restrained bloom, edge AA and film grade. */
const cineRender=renderer.render.bind(renderer);
const cineSize=new THREE.Vector2();
const cineTarget=new THREE.WebGLRenderTarget(1,1,{type:renderer.extensions.has('EXT_color_buffer_float')?THREE.HalfFloatType:THREE.UnsignedByteType,depthBuffer:true});
cineTarget.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
const cinePostScene=new THREE.Scene(),cinePostCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
const cinePostMat=new THREE.ShaderMaterial({depthTest:false,depthWrite:false,toneMapped:true,uniforms:{tColor:{value:cineTarget.texture},tDepth:{value:cineTarget.depthTexture},uResolution:{value:new THREE.Vector2(1,1)},uTime:{value:0},uNear:{value:camera.near},uFar:{value:camera.far},uContact:{value:1},uDetail:{value:.12}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',fragmentShader:`
  varying vec2 vUv;uniform sampler2D tColor;uniform sampler2D tDepth;uniform vec2 uResolution;uniform float uTime;uniform float uNear;uniform float uFar;uniform float uContact;uniform float uDetail;
  float depthAt(vec2 uv){float z=texture2D(tDepth,uv).x*2.0-1.0;return 2.0*uNear*uFar/(uFar+uNear-z*(uFar-uNear));}
  float luma(vec3 c){return dot(c,vec3(.299,.587,.114));}
  void main(){vec2 px=1.0/uResolution;vec3 c=texture2D(tColor,vUv).rgb;
    vec3 n=texture2D(tColor,vUv+vec2(0,px.y)).rgb,s=texture2D(tColor,vUv-vec2(0,px.y)).rgb,e=texture2D(tColor,vUv+vec2(px.x,0)).rgb,w=texture2D(tColor,vUv-vec2(px.x,0)).rgb;
    float hi=max(max(luma(n),luma(s)),max(luma(e),luma(w))),lo=min(min(luma(n),luma(s)),min(luma(e),luma(w)));
    float edge=smoothstep(.12,.45,(hi-lo)/max(hi,.15));c=mix(c,(n+s+e+w)*.25,edge*.23);c=max(vec3(0.0),c+(c-(n+s+e+w)*.25)*(1.0-edge)*uDetail);
    float z=depthAt(vUv),occ=0.0;vec3 bloom=vec3(0.0);float radius=clamp(17.0/max(2.0,z),1.4,5.0);
    for(int i=0;i<6;i++){float a=float(i)*1.0472;vec2 d=vec2(cos(a),sin(a));float other=depthAt(clamp(vUv+d*px*radius,vec2(.001),vec2(.999)));float dz=z-other;occ+=step(.10,dz)*(1.0-smoothstep(.35,2.8,dz));vec3 b=texture2D(tColor,vUv+d*px*4.0).rgb;bloom+=max(b-vec3(1.1),vec3(0.0));}
    c*=1.0-min(occ/6.0*.25*uContact,.20);c+=bloom*.035;
    float lum=luma(c);c=mix(vec3(lum),c,.96);c*=vec3(.99,1.015,1.025);c+=vec3(.016,.024,.029)*(1.0-smoothstep(.0,.3,lum));
    vec2 centered=vUv-.5;float vignette=1.0-.22*smoothstep(.17,.50,dot(centered,centered));c*=vignette;
    float grain=fract(sin(dot(vUv*uResolution,vec2(12.9898,78.233))+floor(uTime*24.0))*43758.5453)-.5;c+=grain*.0035;
    gl_FragColor=vec4(max(c,vec3(0.0)),1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`});
cinePostScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),cinePostMat));
const cineResizeBase=resize;
resize=function(){cineRatio=cineBudget.scale(frame.clientWidth||innerWidth,frame.clientHeight||innerHeight,devicePixelRatio||1);renderer.setPixelRatio(cineRatio);renderer.shadowMap.needsUpdate=true;cineResizeBase();renderer.getDrawingBufferSize(cineSize);cineTarget.setSize(cineSize.x,cineSize.y);cinePostMat.uniforms.uResolution.value.copy(cineSize);};
resize();
let cinePrevFrame=performance.now(),cineLastDraw=0,cineCpuMs=0,cineShadowAt=0,cineSizeAt=0,cineLampAt=0,cineFlashOn=true,cineReloadAt=0,cineWasReloading=false,cineDrawCalls=0;
const cineFlashButton=document.createElement('button');cineFlashButton.type='button';cineFlashButton.className='cine-flash-button';cineFlashButton.setAttribute('aria-label','ライトを切り替え');cineFlashButton.setAttribute('aria-pressed','true');cineFlashButton.textContent='LIGHT';frame.append(cineFlashButton);
function cineToggleLight(){cineFlashOn=!cineFlashOn;if(cineFlashlight)cineFlashlight.visible=cineFlashOn;cineFlashButton.setAttribute('aria-pressed',String(cineFlashOn));}
cineFlashButton.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();cineToggleLight();});
addEventListener('keydown',e=>{if(e.code==='KeyF'&&!e.repeat)cineToggleLight();});

renderer.render=function(s,c){
  if(s!==scene||c!==camera)return cineRender(s,c);
  const now=performance.now(),t=now*.001,frameMs=now-cinePrevFrame;cinePrevFrame=now;
  const changed=cineBudget.sample(frameMs,cineCpuMs,now,state.running&&!document.hidden);
  if(!cineBudget.shouldDraw(now,!document.hidden,!state.running))return;
  const dt=Math.min(.08,(now-(cineLastDraw||now))/1000);cineLastDraw=now;
  if(changed||now-cineSizeAt>1000){cineSizeAt=now;const ratio=cineBudget.scale(frame.clientWidth||innerWidth,frame.clientHeight||innerHeight,devicePixelRatio||1);if(Math.abs(ratio-cineRatio)>.025)resize();}
  if(renderer.shadowMap.enabled&&now-cineShadowAt>(cineBudget.effects===2?30:65)){renderer.shadowMap.needsUpdate=true;cineShadowAt=now;}
  if(cineSky){cineSky.position.copy(camera.position);cineSky.material.uniforms.uTime.value=t;}
  if(cineMoonLight){const texel=70/cineMoonLight.shadow.mapSize.x,x=Math.round(local.x/texel)*texel,z=Math.round(local.z/texel)*texel;cineMoonLight.position.set(x-35,52,z-35);cineMoonLight.target.position.set(x,0,z);}
  if(now-cineLampAt>220){cineLampAt=now;const near=[null,null,null],dist=[Infinity,Infinity,Infinity];for(const p of cineLamps){const d=(p.x-local.x)**2+(p.z-local.z)**2;for(let i=0;i<3;i++)if(d<dist[i]){for(let j=2;j>i;j--){near[j]=near[j-1];dist[j]=dist[j-1];}near[i]=p;dist[i]=d;break;}}cineLampLights.forEach((l,i)=>{if(near[i])l.position.copy(near[i]);l.intensity=near[i]&&dist[i]<400?18:0;});}
  for(const v of cineWater){if(v.type==='mist')v.material.uniforms.uTime.value=t;else if(v.material.userData.shader)v.material.userData.shader.uniforms.uCineTime.value=t;}
  if(cineWeather){cineWeather.material.uniforms.uTime.value=t;cineWeather.material.uniforms.uCenter.value.set(local.x,0,local.z);cineWeather.visible=cineBudget.effects>0;}
  if(cineFlashlight)cineFlashlight.visible=cineFlashOn;
  cineKick*=Math.exp(-dt*15);
  if(uxReloading&&!cineWasReloading)cineReloadAt=now;cineWasReloading=uxReloading;
  if(cineGun){const moving=state.running&&(touchMove.x||touchMove.y||keys.has('KeyW')||keys.has('KeyA')||keys.has('KeyS')||keys.has('KeyD')),walk=moving?1:.15,reload=uxReloading?Math.sin(clamp((now-cineReloadAt)/900,0,1)*Math.PI):0;
    cineGun.position.set(.30+Math.sin(t*6)*.008*walk,-.27+Math.cos(t*12)*.006*walk-reload*.14,-.45+cineKick);
    cineGun.rotation.set(cineKick*.6+reload*.48,-.035,Math.sin(t*6)*.006*walk+reload*.4);cineGun.visible=state.localLives>0;
    if(cineMuzzle){cineMuzzle.visible=now-cineLastShot<48&&state.running;cineMuzzle.rotation.z=t*47;}
  }
  for(const [id,g] of remoteMeshes){const p=state.players.get(id);if(!p)continue;const old=g.userData.cineLastPosition;const moving=old&&Math.hypot(p.x-old.x,p.z-old.z)>.008;g.userData.cineLastPosition={x:p.x,z:p.z};for(const o of g.children){if(o.name==='lLeg')o.rotation.x=moving?Math.sin(t*7)*.3:0;if(o.name==='rLeg')o.rotation.x=moving?-Math.sin(t*7)*.3:0;}}
  if(cineQuality==='low'){renderer.setRenderTarget(null);cineRender(scene,camera);cineDrawCalls=renderer.info.render.calls;cineCpuMs=performance.now()-now;return;}
  cinePostMat.uniforms.uDetail.value=cineQuality==='high'?.18:cineBudget.effects<2?.08:.12;cinePostMat.uniforms.uTime.value=t;cinePostMat.uniforms.uContact.value=cineBudget.effects<2?.6:1;
  renderer.setRenderTarget(cineTarget);cineRender(scene,camera);cineDrawCalls=renderer.info.render.calls;renderer.setRenderTarget(null);cineRender(cinePostScene,cinePostCamera);cineDrawCalls+=renderer.info.render.calls;cineCpuMs=performance.now()-now;
};

/* A real scene behind the game menu; no separate promotional artwork. */
startBtn.disabled=true;
await cineTextureReady;
state.seed=state.seed||917263;
const cinePreviewArena=buildEnvironment();spawnHostWorld(cinePreviewArena);cineMakeWeapon();
syncModeUI();syncDifficultyUI();uxLabels();
if(owNote)owNote.textContent=currentStage().jp;
/* Keep diagnostics read-only; the existing automated startup gate uses these facts. */
Object.defineProperty(window,'blacksiteGraphics',{configurable:true,get:()=>({version:CINE_VERSION,worldBuildMs:Math.round(cineWorldBuildMs),cachedEnvironments:cineEnvironmentCache.size,budget:cineBudget.stats,quality:cineQuality,resolutionScale:cineRatio,textures:Object.keys(cineTextures),area:state.area,infected:state.enemies.size,shadowMap:renderer.shadowMap.enabled,drawCalls:cineDrawCalls})});
