function clearScene(){state.walls=[];state.goal=null;state.bossGate=null;state.maze=null;state.fields.clear();remoteMeshes.clear();bossMesh=null;bossWeakpoint=null;horde=null;state.stageVisuals=[];while(scene.children.length)scene.remove(scene.children[0]);}
function addBox(x,y,z,w,h,d,color,solid=true,emissive=0,rough=.62,metal=.08,opacity=1){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(color,emissive,emissive?1.3:0,rough,metal,opacity<1,opacity));m.position.set(x,y,z);scene.add(m);if(solid)state.walls.push({minX:x-w/2,maxX:x+w/2,minZ:z-d/2,maxZ:z+d/2,mesh:m});return m;}
function addCylinder(x,y,z,r,h,color,solid=false,emissive=0){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,12),mat(color,emissive,emissive?1.1:0,.45,.18));m.position.set(x,y,z);scene.add(m);if(solid)state.walls.push({minX:x-r,maxX:x+r,minZ:z-r,maxZ:z+r,mesh:m});return m;}
function addPlane(x,y,z,w,d,color,emissive=0,opacity=1){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),mat(color,emissive,emissive?1.25:0,.38,.15,opacity<1,opacity));m.rotation.x=-Math.PI/2;m.position.set(x,y,z);scene.add(m);return m;}
function addGlow(x,y,z,color,intensity=1,range=25){const l=new THREE.PointLight(color,intensity,range);l.position.set(x,y,z);scene.add(l);return l;}

function makeMaze(stage,seed){
  const cols=stage.cols,rows=stage.rows,cell=stage.cell,rand=mulberry32(seed^0x74c19e21),cells=Array.from({length:rows},()=>Array.from({length:cols},()=>({w:[1,1,1,1],seen:false})));
  const dirs=[[0,-1,0,2],[1,0,1,3],[0,1,2,0],[-1,0,3,1]];
  let sc=Math.floor(cols/2),sr=0,stack=[[sc,sr]];cells[sr][sc].seen=true;
  while(stack.length){const [c,r]=stack[stack.length-1];let opts=[];for(const [dc,dr,wi,oi] of dirs){const nc=c+dc,nr=r+dr;if(nc>=0&&nc<cols&&nr>=0&&nr<rows-5&&!cells[nr][nc].seen)opts.push([dc,dr,wi,oi,nc,nr]);}
    if(!opts.length){stack.pop();continue;}
    let pick;
    if(stage.key==='mansion'&&opts.some(o=>o[1]===1)&&rand()<.48)pick=opts.filter(o=>o[1]===1)[Math.floor(rand()*opts.filter(o=>o[1]===1).length)];
    else if(stage.key==='mountain'&&opts.some(o=>o[0]!==0)&&rand()<.58)pick=opts.filter(o=>o[0]!==0)[Math.floor(rand()*opts.filter(o=>o[0]!==0).length)];
    else if(stage.key==='river'&&rand()<.42)pick=opts.sort((a,b)=>Math.abs(a[4]-cols/2)-Math.abs(b[4]-cols/2))[0];
    else if(stage.key==='sea'&&rand()<.4)pick=opts[(r+Math.floor(rand()*opts.length))%opts.length];
    else if(stage.key==='city'&&rand()<.48)pick=opts.sort((a,b)=>((a[4]+a[5])%2)-((b[4]+b[5])%2))[0];
    else pick=opts[Math.floor(rand()*opts.length)];
    const [, ,wi,oi,nc,nr]=pick;cells[r][c].w[wi]=0;cells[nr][nc].w[oi]=0;cells[nr][nc].seen=true;stack.push([nc,nr]);
  }
  for(let r=rows-5;r<rows;r++)for(let c=0;c<cols;c++){cells[r][c].seen=true;cells[r][c].w=[0,0,0,0];}
  for(let c=0;c<cols;c++){cells[rows-5][c].w[0]=0;cells[rows-1][c].w[2]=1;}
  cells[rows-6][Math.floor(cols/2)].w[2]=0;cells[rows-5][Math.floor(cols/2)].w[0]=0;
  const loopCount=Math.floor(cols*rows*stage.loops);
  for(let i=0;i<loopCount;i++){const r=1+Math.floor(rand()*(rows-7)),c=Math.floor(rand()*cols);const horiz=stage.key==='mountain'?rand()<.7:stage.key==='city'?rand()<.55:rand()<.5;if(horiz&&c<cols-1){cells[r][c].w[1]=0;cells[r][c+1].w[3]=0;}else if(r<rows-6){cells[r][c].w[2]=0;cells[r+1][c].w[0]=0;}}
  const x0=-cols*cell/2,z0=12;
  return {cols,rows,cell,cells,x0,z0,rand};
}
function cellCenter(c,r){const m=state.maze;return{x:m.x0+(c+.5)*m.cell,z:m.z0-(r+.5)*m.cell};}
function worldToCell(x,z){const m=state.maze;if(!m)return null;const c=Math.floor((x-m.x0)/m.cell),r=Math.floor((m.z0-z)/m.cell);if(c<0||c>=m.cols||r<0||r>=m.rows)return null;return{c,r};}
function cellKey(c,r){return `${c},${r}`;}
function openNeighbors(c,r){const m=state.maze,cell=m.cells[r]?.[c];if(!cell)return[];const out=[];if(!cell.w[0]&&r>0)out.push({c,r:r-1});if(!cell.w[1]&&c<m.cols-1)out.push({c:c+1,r});if(!cell.w[2]&&r<m.rows-1)out.push({c,r:r+1});if(!cell.w[3]&&c>0)out.push({c:c-1,r});return out;}
function computeFieldFor(id,p){const start=worldToCell(p.x,p.z);if(!start)return;const q=[start],dist=new Map([[cellKey(start.c,start.r),0]]);for(let qi=0;qi<q.length;qi++){const cur=q[qi],d=dist.get(cellKey(cur.c,cur.r));for(const n of openNeighbors(cur.c,cur.r)){const k=cellKey(n.c,n.r);if(!dist.has(k)){dist.set(k,d+1);q.push(n);}}}state.fields.set(id,dist);}
function updateFields(now){if(now-state.lastFieldUpdate<420)return;state.lastFieldUpdate=now;for(const p of state.players.values())if((p.lives??0)>0)computeFieldFor(p.id,p);}
function nextPathPoint(e,p){const pos=worldToCell(e.x,e.z),field=state.fields.get(p.id);if(!pos||!field)return{x:p.x,z:p.z};let best=field.get(cellKey(pos.c,pos.r))??1e9,bestCell=pos;for(const n of openNeighbors(pos.c,pos.r)){const d=field.get(cellKey(n.c,n.r));if(d!=null&&d<best){best=d;bestCell=n;}}return cellCenter(bestCell.c,bestCell.r);}
function blocked(x,z,r=.68){const m=state.maze;if(!m)return false;const minX=m.x0+.25,maxX=m.x0+m.cols*m.cell-.25,minZ=m.z0-m.rows*m.cell+.2,maxZ=m.z0+.4;if(x<minX+r||x>maxX-r||z<minZ+r||z>maxZ-r)return true;for(const w of state.walls)if(x+r>w.minX&&x-r<w.maxX&&z+r>w.minZ&&z-r<w.maxZ)return true;return false;}
function mazeWallStyle(stage){if(stage.key==='mansion')return{color:0x3a2529,h:4.6,t:.42,rough:.7,metal:.04};if(stage.key==='mountain')return{color:0x4b5553,h:5.4,t:.9,rough:1,metal:0};if(stage.key==='river')return{color:0x314b43,h:3.8,t:.75,rough:.92,metal:.02};if(stage.key==='sea')return{color:0x2b4557,h:4.2,t:.58,rough:.72,metal:.16};if(stage.key==='city')return{color:0x323a43,h:4.5,t:.52,rough:.58,metal:.18};return{color:0x392742,h:5.2,t:.72,rough:.72,metal:.08};}
function renderMazeWalls(stage){const m=state.maze,s=mazeWallStyle(stage),c=m.cell;for(let r=0;r<m.rows;r++)for(let col=0;col<m.cols;col++){const cell=m.cells[r][col],p=cellCenter(col,r);if(cell.w[0])addThemedWall(stage,p.x,2.3,p.z+c/2,c,s.h,s.t,0,s);if(cell.w[3])addThemedWall(stage,p.x-c/2,2.3,p.z,s.t,s.h,c,1,s);if(col===m.cols-1&&cell.w[1])addThemedWall(stage,p.x+c/2,2.3,p.z,s.t,s.h,c,1,s);if(r===m.rows-1&&cell.w[2])addThemedWall(stage,p.x,2.3,p.z-c/2,c,s.h,s.t,0,s);}}
function addThemedWall(stage,x,y,z,w,h,d,axis,s){if(stage.key==='mountain'){const rock=addBox(x,h*.42,z,w,h*.84,d,stage.wall,true,0,1,0);rock.rotation.y=(Math.random()-.5)*.04;return rock;}if(stage.key==='river'){const wall=addBox(x,h/2,z,w,h,d,0x2b453e,true,0,.9,.02);if(w>d)addBox(x,h+.12,z,w,.22,d+.18,0x829d75,false,0,.95,0);else addBox(x,h+.12,z,w+.18,.22,d,0x829d75,false,0,.95,0);return wall;}if(stage.key==='sea'){const wall=addBox(x,h/2,z,w,h,d,stage.wall,true,0,.58,.22);addBox(x,h*.78,z,w*.96,.13,d*.96,stage.accent,false,stage.accent,.35,.08,.52);return wall;}if(stage.key==='city'){const wall=addBox(x,h/2,z,w,h,d,stage.wall,true,0,.6,.2);if((Math.abs(x+z)*10|0)%3===0)addBox(x,h*.72,z,w*.78,.12,d*.78,stage.accent,false,stage.accent,.28,.1,.55);return wall;}if(stage.key==='castle'){const wall=addBox(x,h/2,z,w,h,d,stage.wall,true,0,.82,.05);for(let i=-1;i<=1;i++)if(w>d)addBox(x+i*w*.3,h+.35,z,.34,.7,d*.9,stage.luxury,false,0,.42,.3);return wall;}const wall=addBox(x,h/2,z,w,h,d,stage.wall,true,0,.72,.04);if(stage.key==='mansion'&&w>d)addBox(x,1.05,z,w*.9,.12,d+.08,0x8d1b2e,false,0,.5,.02);return wall;}