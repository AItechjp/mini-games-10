import {ROADS} from './core-living.mjs';
// Heights match the authored road, pavement slabs and curb geometry.
export function pavementHeight(x,z){
 if(Math.abs(x)>466||Math.abs(z)>466)return 0;
 const dx=Math.min(...ROADS.map(r=>Math.abs(x-r))),dz=Math.min(...ROADS.map(r=>Math.abs(z-r)));
 if(dx<14||dz<14)return 0;
 if((Math.abs(dx-16)<=.61&&dz>=15)||(Math.abs(dz-16)<=.61&&dx>=15))return .35;
 return dx>=17.5&&dz>=17.5?.1675:.135;
}
export function groundCrowd(view,state,player,quality){
 const maximum={low:20,medium:36,high:64,ultra:96}[quality]||36,radius={low:65,medium:100,high:155,ultra:200}[quality]||100;
 // Use the same slot order as CivilianView; smoothed positions anchor the feet.
 const slots=(state.civilians||[]).filter(p=>Math.hypot(p.x-player.x,p.z-player.z)<radius).sort((a,b)=>Math.hypot(a.x-player.x,a.z-player.z)-Math.hypot(b.x-player.x,b.z-player.z)).slice(0,maximum);
 for(let i=0;i<slots.length;i++){
  const p=view.smooth.get(slots[i].id)||slots[i],height=pavementHeight(p.x,p.z),scale=.94+(p.id%7)*.017,offset=height+.01-(.19+.014*scale);
  for(const part of view.meshes)part.mesh.instanceMatrix.array[i*16+13]+=offset;
  view.shadows.instanceMatrix.array[i*16+13]=height+.004;
 }
 for(const part of view.meshes)part.mesh.instanceMatrix.needsUpdate=true;
 view.shadows.instanceMatrix.needsUpdate=true;
}
