// Deterministic, host-authoritative sidewalk graph and civilian simulation.
// No renderer dependency. Compact snapshots keep guests on the same simulation.
export const POPULATION = 288;
export const SIGNAL_PERIOD = 60;
export function signalState(time, axis, ix=0, iz=0) {
  const p=((time+(ix+iz)*3)%60+60)%60;
  const t=axis==='z'?p:(p+30)%60;
  return t<24?'green':t<27?'amber':'red';
}
export function buildSidewalks(){
  const nodes=[];
  const index=(x,z,c)=>(x*6+z)*4+c;
  for(let x=0;x<6;x++)for(let z=0;z<6;z++){
    const l=-480+x*160+16,r=l+128,n=-480+z*160+16,b=n+128;
    for(const [px,pz] of [[l,n],[r,n],[r,b],[l,b]])nodes.push({x:px,z:pz,edges:[]});
  }
  const link=(a,b,cross=false,axis='x',ix=0,iz=0)=>{nodes[a].edges.push({to:b,cross,axis,ix,iz});nodes[b].edges.push({to:a,cross,axis,ix,iz});};
  for(let x=0;x<6;x++)for(let z=0;z<6;z++){
    for(let c=0;c<4;c++)link(index(x,z,c),index(x,z,(c+1)%4));
    if(x<5){link(index(x,z,1),index(x+1,z,0),true,'x',x+1,z);link(index(x,z,2),index(x+1,z,3),true,'x',x+1,z+1);}
    if(z<5){link(index(x,z,3),index(x,z+1,0),true,'z',x,z+1);link(index(x,z,2),index(x,z+1,1),true,'z',x+1,z+1);}
  }
  return nodes;
}
export const SIDEWALKS=buildSidewalks();
export function makePopulation(random){
  return Array.from({length:POPULATION},(_,id)=>{
    const block=Math.floor(id/8),corner=id%4,reverse=id%8>=4;
    const from=block*4+corner,to=block*4+(corner+(reverse?3:1))%4;
    const a=SIDEWALKS[from],b=SIDEWALKS[to],f=.12+random()*.75;
    return {id,x:a.x+(b.x-a.x)*f,z:a.z+(b.z-a.z)*f,yaw:Math.atan2(b.x-a.x,b.z-a.z),moving:0,mode:0,from,to,previous:from,panic:0,idle:0,travel:0,pace:1.15+random()*.65,choice:0};
  });
}
function choose(p,threat){
  const node=SIDEWALKS[p.to];
  let options=node.edges.filter(e=>e.to!==p.from);
  if(!options.length)options=node.edges;
  p.previous=p.from;p.from=p.to;
  if(threat)options.sort((a,b)=>Math.hypot(SIDEWALKS[b.to].x-threat.x,SIDEWALKS[b.to].z-threat.z)-Math.hypot(SIDEWALKS[a.to].x-threat.x,SIDEWALKS[a.to].z-threat.z));
  // Stable route variation without depending on renderer frame rate.
  const h=((p.id+1)*2654435761+ ++p.choice*2246822519)>>>0;
  p.to=options[threat?0:h%options.length].to;
}
export function tickPopulation(s,dt,blocked){
  for(const p of s.civilians){
    let threat=null;
    for(const e of s.events||[])if((e.type==='shot'||e.type==='enemyshot')&&s.time-e.t<.35&&Math.hypot(p.x-e.x,p.z-e.z)<43){threat=e;break;}
    if(!threat)for(const c of s.cars){
      if(Math.abs(c.speed)<3)continue;
      const dx=p.x-c.x,dz=p.z-c.z,along=dx*Math.sin(c.yaw)+dz*Math.cos(c.yaw),side=dx*Math.cos(c.yaw)-dz*Math.sin(c.yaw);
      if(along>0&&along<Math.min(12,Math.abs(c.speed)*.8+2)&&Math.abs(side)<2.4){threat=c;break;}
    }
    if(threat){p.panic=5+(p.id%3);p.idle=0;if(p.mode!==3){
      const a=SIDEWALKS[p.from],b=SIDEWALKS[p.to];
      if(Math.hypot(a.x-threat.x,a.z-threat.z)>Math.hypot(b.x-threat.x,b.z-threat.z)){const n=p.from;p.from=p.to;p.to=n;}
    }}
    p.panic=Math.max(0,p.panic-dt);p.idle=Math.max(0,p.idle-dt);
    if(p.idle>0&&p.panic===0){p.mode=1;p.moving=0;continue;}
    const a=SIDEWALKS[p.from],b=SIDEWALKS[p.to],edge=a.edges.find(e=>e.to===p.to);
    const startDistance=Math.hypot(p.x-a.x,p.z-a.z);
    if(edge?.cross&&startDistance<1.2){
      const red=signalState(s.time,edge.axis,edge.ix,edge.iz)!=='green';
      const unsafe=s.cars.some(c=>Math.abs(c.speed)>2&&Math.hypot(c.x-(a.x+b.x)/2,c.z-(a.z+b.z)/2)<11);
      if(red||unsafe){p.mode=p.panic>0?3:2;p.moving=0;continue;}
    }
    p.mode=p.panic>0?3:0;
    const dx=b.x-p.x,dz=b.z-p.z,len=Math.hypot(dx,dz),speed=p.panic>0?3.8:p.pace;
    const step=Math.min(len,speed*dt);
    if(len>.02){
      const nx=p.x+dx/len*step,nz=p.z+dz/len*step;
      if(!blocked(nx,nz,.32)){p.x=nx;p.z=nz;p.moving=speed;p.travel+=step;p.yaw=Math.atan2(dx,dz);}
      else{p.moving=0;const n=p.from;p.from=p.to;p.to=n;}
    }
    if(len<.35){p.x=b.x;p.z=b.z;choose(p,threat);if(p.panic<=0&&(p.id+p.choice)%5===0)p.idle=2.5+p.id%7;}
  }
}
export function trafficLimit(s,c){
  if(!c.traffic||c.driver>=0||c.police)return Infinity;
  const sx=Math.sin(c.yaw),sz=Math.cos(c.yaw),axis=Math.abs(sx)>Math.abs(sz)?'x':'z';
  // Do not stop inside a junction. Stop lines are 19 m before its centre.
  let limit=Infinity;
  for(let k=0;k<7;k++){
    const road=-480+k*160,pos=axis==='x'?c.x:c.z,dir=axis==='x'?sx:sz;
    const ahead=(road-pos)*Math.sign(dir);
    if(ahead<17||ahead>45)continue;
    const perpendicular=axis==='x'?c.z:c.x;
    const cross=Math.max(0,Math.min(6,Math.round((perpendicular+480)/160)));
    if(signalState(s.time,axis,axis==='x'?k:cross,axis==='x'?cross:k)!=='green')limit=Math.min(limit,Math.sqrt(Math.max(0,2*4*(ahead-20))));
  }
  for(const b of s.cars){if(b===c)continue;const dx=b.x-c.x,dz=b.z-c.z,forward=dx*sx+dz*sz,lateral=Math.abs(dx*sz-dz*sx);if(forward>0&&forward<18&&lateral<2.2)limit=Math.min(limit,Math.max(0,(forward-5.5)*1.2));}
  for(const p of s.civilians||[]){const dx=p.x-c.x,dz=p.z-c.z,forward=dx*sx+dz*sz,lateral=Math.abs(dx*sz-dz*sx);if(forward>0&&forward<17&&lateral<2.7)limit=Math.min(limit,Math.sqrt(Math.max(0,2*5*(forward-4.5))));}
  return limit;
}
export function packPopulation(s){
  return s.civilians.filter(p=>s.players.some(a=>Math.hypot(a.x-p.x,a.z-p.z)<280)).sort((a,b)=>Math.min(...s.players.map(p=>Math.hypot(p.x-a.x,p.z-a.z)))-Math.min(...s.players.map(p=>Math.hypot(p.x-b.x,p.z-b.z)))).slice(0,128).map(p=>[p.id,Math.round(p.x*100)/100,Math.round(p.z*100)/100,Math.round(p.yaw*1000)/1000,Math.round(p.moving*100)/100,p.mode,Math.round(p.travel*100)/100]);
}
export function unpackPopulation(value){
  if(value===undefined)return [];// Backwards-compatible old peer.
  if(!Array.isArray(value)||value.length>128)return null;
  const seen=new Set();
  for(const a of value){if(!Array.isArray(a)||a.length!==7||!a.every(Number.isFinite)||!Number.isInteger(a[0])||a[0]<0||a[0]>=POPULATION||seen.has(a[0])||Math.abs(a[1])>530||Math.abs(a[2])>530||Math.abs(a[3])>3.142||a[4]<0||a[4]>5||!Number.isInteger(a[5])||a[5]<0||a[5]>3||a[6]<0||a[6]>1e8)return null;seen.add(a[0]);}
  return value.map(a=>({id:a[0],x:a[1],z:a[2],yaw:a[3],moving:a[4],mode:a[5],travel:a[6]}));
}
