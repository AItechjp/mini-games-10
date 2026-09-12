import * as T from 'three';
import {CityView} from './world-hd.mjs';
import {CivilianView,makeHumanRig} from './humans.mjs';
import {StreetArt} from './street-art.mjs';
import {pavementHeight,groundCrowd} from './street-ground.mjs';
const drawBase=CityView.prototype.draw,weatherBase=CityView.prototype.setWeather,statsBase=CityView.prototype.stats;
CityView.prototype.setWeather=function(rain){this.livingRain=!!rain;return weatherBase.call(this,rain);};
function replaceActors(view){
 for(const[id,old]of [...view.actors]){
  if(old.userData.livingRig)continue;
  const rig=makeHumanRig(),g=rig.root,weapon=old.userData.weapon;
  const colors={cloth:id[0]==='e'?0x464d49:id==='p1'?0x96714f:0x2a414d,pants:0x273442,skin:id==='p1'?0xa37658:0xbe9072,hair:0x282322};
  for(const part of rig.parts){if(colors[part.key])part.material.color.setHex(colors[part.key]);const m=new T.Mesh(part.geometry,part.material);m.castShadow=m.receiveShadow=true;part.parent.add(m);}
  if(weapon){old.remove(weapon);g.add(weapon);}
  g.position.copy(old.position);g.rotation.copy(old.rotation);g.visible=old.visible;
  g.userData={arms:rig.arms,legs:rig.legs,weapon,livingRig:rig};view.scene.remove(old);view.scene.add(g);view.actors.set(id,g);
  // The legacy actor allocated materials per mesh. Dispose once per resource.
  const retained=new Set();weapon?.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)retained.add(m);});
  const geos=new Set(),mats=new Set();old.traverse(o=>{if(o.geometry)geos.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)mats.add(m);});geos.forEach(g=>g.dispose());mats.forEach(m=>{if(!retained.has(m))m.dispose();});
 }
}
CityView.prototype.draw=function(state,id,dt,cam,menu){
 if(!this.living){
  this.living={people:new CivilianView(this.scene),art:new StreetArt(this)};
  // Reduce the former opaque vignette; keep the game image readable on a phone.
  const style=document.createElement('style');style.textContent='.vignette{opacity:.36!important}#livingStatus{position:absolute;left:50%;bottom:14px;transform:translateX(-50%);font:10px monospace;letter-spacing:1.5px;color:#c5d1d5;background:#09151ac9;border:1px solid #cbd9d722;border-radius:20px;padding:6px 12px;pointer-events:none;white-space:nowrap}.touch #livingStatus{bottom:4px;font-size:8px}';document.head.append(style);
  const tag=document.createElement('div');tag.id='livingStatus';tag.textContent='LIVING CITY / BUILD 03';document.getElementById('hud').append(tag);this.living.tag=tag;this.living.uiTime=0;
 }
 const player=state.players[id]||state.players[0];
 const focus=menu?{x:430,z:480}:player;
 this.living.people.update(state,focus,dt,this.quality);groundCrowd(this.living.people,state,focus,this.quality);this.living.art.update(state,this.quality,this.livingRain);
 // Knees and elbows articulate separately from hips and shoulders.
 for(const[key,g]of this.actors){const rig=g.userData.livingRig;if(!rig)continue;const a=key[0]==='e'?state.enemies.find(e=>'e'+e.id===key):state.players.find(p=>'p'+p.id===key);if(!a)continue;
  rig.pelvis.position.y=.736+pavementHeight(a.x,a.z);
  const moving=a.moving||0,phase=state.time*(moving>9?17:moving>5?12:8)+a.x*.01,walk=Math.min(1,moving/3);
  for(let i=0;i<2;i++){rig.knees[i].rotation.x=Math.max(0,-Math.sin(phase+i*Math.PI))*(moving>5?1.1:.66)*walk;rig.forearms[i].rotation.x=moving>5?-.85:-.2;}
  rig.chest.rotation.x=moving>5?.075:0;rig.head.rotation.y=Math.sin(state.time*.5)*.025;
 }
 this.living.uiTime+=dt;if(this.living.uiTime>.5){this.living.tag.textContent=`LIVING CITY  /  周辺 ${this.living.people.count} 人  /  BUILD 03`;this.living.uiTime=0;}
 const result=drawBase.call(this,state,id,dt,cam,menu);replaceActors(this);return result;
};
CityView.prototype.stats=function(){return{...statsBase.call(this),pedestrians:this.living?.people.count||0,livingCity:!!this.living,planarReflection:this.living?.art.reflection.visible||false};};
// Install all compatibility hooks before the original controller starts.
await import('./game-hd.mjs?v=20260912-living3');
if(window.__BAYLINE_READY__)window.__BAYLINE_BUILD__='03-LIVING-CITY-20260912';
