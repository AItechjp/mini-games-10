// Import map routes the existing game's simulation through this compatible layer.
// The query suffix deliberately bypasses the import-map alias for the base engine.
import * as Base from './core-hd.mjs?engine=2';
import {makePopulation,tickPopulation,trafficLimit,packPopulation,unpackPopulation} from './population.mjs';
export * from './core-hd.mjs?engine=2';
// Maintain a clear 16 m sidewalk line; both renderer and collision buckets share
// these same building objects. No save format, vehicle ID or mission is changed.
for(const b of Base.BUILDINGS){b.w=Math.min(b.w,44);b.d=Math.min(b.d,44);}
export function newGame(saved){const s=Base.newGame(saved);s.civilians=makePopulation(Base.rng(932031));s.lifeAccumulator=0;return s;}
export function tick(s,inputs,delta){
  if(!s.civilians)s.civilians=makePopulation(Base.rng(932031));
  const dt=Base.clamp(Base.finite(delta),0,.05);if(!dt)return;
  const constraints=s.cars.filter(c=>c.traffic&&c.driver<0).map(c=>({c,x:c.x,z:c.z,limit:trafficLimit(s,c)}));
  Base.tick(s,inputs,dt);
  for(const item of constraints){const{c,x,z,limit}=item;if(!c.traffic||c.driver>=0||!Number.isFinite(limit))continue;
    if(c.speed>limit){const length=Math.hypot(c.x-x,c.z-z),move=Math.min(length,limit*dt);if(length>0){c.x=x+(c.x-x)*move/length;c.z=z+(c.z-z)*move/length;}c.speed=limit;}
  }
  s.lifeAccumulator=(s.lifeAccumulator||0)+dt;
  if(s.lifeAccumulator>=.1){tickPopulation(s,s.lifeAccumulator,Base.blocked);s.lifeAccumulator=0;}
}
export function snapshot(s){const d=Base.snapshot(s);d.civ=packPopulation(s);return d;}
export function readSnapshot(d){const s=Base.readSnapshot(d);if(!s)return null;const civilians=unpackPopulation(d.civ);if(!civilians)return null;s.civilians=civilians;return s;}
