/* GAME 23 ULTIMATE — boss arena/minimap fast paths */
buildBossArena=function(stage){
  const m=state.maze,center=cellCenter(Math.floor(m.cols/2),m.rows-3),arenaZ=center.z,width=m.cols*m.cell*.82;
  addPlane(0,.02,arenaZ,width,m.cell*4.2,stage.key==='castle'?0x211326:stage.key==='city'?0x20242a:stage.floor,stage.key==='castle'?0x45103b:0,.96);
  const posts=[];for(const side of [-1,1])for(let i=0;i<3;i++){const x=side*(width/2-3-i*.9),z=arenaZ+(i-1)*m.cell;posts.push([x,2.5,z,1.15,5,1.15]);}
  perfBatch(PERF_GEO.box,perfMat(stage.luxury,stage.accent,.22,.52,.12),posts);
  const goalZ=m.z0-m.rows*m.cell+m.cell*.62;state.goal=new THREE.Vector3(0,0,goalZ);
  const gateZ=goalZ+m.cell*.72;const gate=addBox(0,2.9,gateZ,width*.96,5.8,.42,stage.key==='castle'?0x32133d:0x232b30,true,stage.accent,.40,.22,.78);gate.userData.bossGate=true;state.bossGate=gate;
  const bars=[];const n=PERF_MOBILE?14:18;for(let i=0;i<n;i++){const x=-width*.44+(i/(n-1))*width*.88;bars.push([x,2.9,gateZ-.14,.14,5.25,.16]);}
  perfBatch(PERF_GEO.box,perfMat(stage.luxury,0,0,.42,.45),bars);
  const portalMat=mat(stage.key==='castle'?0xc65cff:0x9affc2,stage.key==='castle'?0xb638ff:0x24ff79,2.7,.18,.08,true,.82);
  const ring=new THREE.Mesh(new THREE.TorusGeometry(4.2,.38,8,28),portalMat);ring.rotation.x=Math.PI/2;ring.position.set(0,.6,goalZ);scene.add(ring);
  for(let i=0;i<2;i++){const halo=new THREE.Mesh(new THREE.TorusGeometry(2.7+i*.75,.06,6,22),portalMat);halo.position.set(0,1.9+i*1.5,goalZ);halo.rotation.y=i*.7;scene.add(halo);}
  if(stage.key==='castle')addBox(0,1.8,goalZ-5,5.2,3.6,2.0,0x29132e,false,stage.accent,.45,.2);
  return arenaZ;
};

drawMinimap=function(){
  if(!minimapCtx||!state.maze)return;const ctx=minimapCtx,m=state.maze,w=minimap.width,h=minimap.height,pad=7,sx=(w-pad*2)/(m.cols*m.cell),sz=(h-pad*2)/(m.rows*m.cell),mapX=x=>pad+(x-m.x0)*sx,mapY=z=>pad+(m.z0-z)*sz;
  ctx.clearRect(0,0,w,h);ctx.fillStyle='rgba(4,7,9,.90)';ctx.fillRect(0,0,w,h);ctx.strokeStyle='rgba(210,226,232,.22)';ctx.strokeRect(pad,pad,w-pad*2,h-pad*2);
  ctx.strokeStyle='rgba(130,180,166,.16)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(mapX(0),pad);ctx.lineTo(mapX(0),h-pad);ctx.stroke();
  for(const item of state.items.values())if(!item.taken){ctx.fillStyle=item.type==='life'?'#ff5577':item.type==='infinite'?'#ffd84b':item.type==='invincible'?'#52dbff':'#ff8739';ctx.fillRect(mapX(item.x)-1.5,mapY(item.z)-1.5,3,3);}
  let shown=0;for(const e of state.enemies.values()){if(e.dead)continue;if(e.boss){ctx.fillStyle='#ff2d5f';ctx.beginPath();ctx.arc(mapX(e.x),mapY(e.z),4.1,0,Math.PI*2);ctx.fill();continue;}if(shown++>85)continue;const dx=e.x-local.x,dz=e.z-local.z;if(dx*dx+dz*dz>PERF_VISUAL_RANGE*PERF_VISUAL_RANGE*1.5)continue;ctx.fillStyle=e.type==='licker'?'#b66cff':e.type==='dog'||e.runner?'#ff8a2a':e.type==='fat'?'#ff5168':'#e84958';const s=e.type==='fat'?2.8:2;ctx.fillRect(mapX(e.x)-s/2,mapY(e.z)-s/2,s,s);}
  if(state.goal){ctx.fillStyle=state.bossGate?'#858996':'#49ff92';ctx.beginPath();ctx.arc(mapX(state.goal.x),mapY(state.goal.z),3.5,0,Math.PI*2);ctx.fill();}
  for(const p of state.players.values()){ctx.fillStyle=p.id===state.playerId?'#ffffff':'#ffd85a';ctx.beginPath();ctx.arc(mapX(p.x),mapY(p.z),p.id===state.playerId?3.2:2.7,0,Math.PI*2);ctx.fill();}
};