// Deterministic arcade vehicle dynamics. Units: metres, seconds, radians.
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const lerp=(a,b,t)=>a+(b-a)*t;
export const damp=(a,b,k,dt)=>lerp(a,b,1-Math.exp(-k*dt));
export const LIMIT=300;
export function fresh(){return {s:8,x:-1.5,v:0,slip:0,steer:0,t:0,score:0,combo:0,bestCombo:0,contacts:0,top:0,grip:1,drift:false,cooldown:0,rival:29,rv:0,finished:false,reason:'',rivalFinish:null};}
export function cornerSpeed(k){return clamp(Math.sqrt(6.5/(Math.abs(k)+.0011)),14,32);}
export function step(p,dt,i,track,assist=true,difficulty='normal'){
 if(p.finished||!Number.isFinite(dt)||dt<=0)return;p.t+=dt;p.cooldown=Math.max(0,p.cooldown-dt);
 const a=track.at(p.s),look=track.at(p.s+Math.max(18,p.v*1.5));
 const steer=clamp(i.steer||0,-1,1),gas=clamp(i.gas||0,0,1),brake=clamp(i.brake||0,0,1);
 p.steer=damp(p.steer,steer,9,dt);
 const drifting=!!i.drift&&p.v>11&&Math.abs(p.steer)>.12;
 const safe=cornerSpeed(Math.max(Math.abs(a.k),Math.abs(look.k)));
 const autoBrake=assist?clamp((p.v-safe-2)/10,0,.78):0;
 const off=Math.abs(p.x)>4.9,targetSlip=p.steer*(drifting?.43:.045)*(p.v/38);
 p.slip=damp(p.slip,clamp(targetSlip,-.57,.57),drifting?4:7,dt);
 const acceleration=gas*(5.5/(1+p.v*.028))-Math.max(brake,autoBrake)*14-.18-p.v*p.v*.003-(off?7:0)-(drifting?1.7:0);
 p.v=clamp(p.v+acceleration*dt,0,57);p.top=Math.max(p.top,p.v*3.6);
 const outward=-a.k*p.v*p.v*.092;
 const lateral=p.steer*(1.5+p.v*.105)+(drifting?p.slip*p.v*.12:0)+outward*(assist?.24:1);
 p.x+=lateral*dt;
 if(Math.abs(p.x)>5.45){p.x=Math.sign(p.x)*5.45;p.slip*=-.25;if(p.cooldown<=0&&p.v>3){p.v*=.72;p.contacts++;p.cooldown=.9;p.combo=0;}}
 p.grip=off?.6:drifting?.76:1;p.drift=drifting&&!off;
 if(p.drift){const points=(p.v*1.4+Math.abs(p.slip)*100)*dt;p.score+=points;p.combo+=points;p.bestCombo=Math.max(p.bestCombo,p.combo);}else p.combo=Math.max(0,p.combo-45*dt);
 const old=p.s,advance=p.v*dt*Math.cos(p.slip*.4);p.s=Math.min(track.length,p.s+advance);
 const ar=track.at(p.rival+Math.max(22,p.rv*1.4)),ra=track.at(p.rival);
 const skill=difficulty==='hard'?1.08:difficulty==='easy'?.82:.96;
 const target=cornerSpeed(Math.max(Math.abs(ar.k),Math.abs(ra.k)))*skill;
 p.rv=clamp(p.rv+clamp((target-p.rv)*1.4,-13,5)*dt,0,56);
 const previousRival=p.rival;p.rival=Math.min(track.length,p.rival+p.rv*dt);
 if(p.rival>=track.length&&p.rivalFinish===null)p.rivalFinish=p.t-dt+(track.length-previousRival)/Math.max(.01,p.rv);
 const rx=track.rivalLane(p.rival);
 if(Math.abs(p.s-p.rival)<4.4&&Math.abs(p.x-rx)<1.65&&p.cooldown<=0){p.v=Math.max(0,Math.min(p.v,p.rv)*.81);p.x=clamp(p.x+(p.x>=rx?.85:-.85),-5.4,5.4);p.contacts++;p.cooldown=.85;p.combo=0;}
 if(p.s>=track.length){p.t-=dt*clamp((old+advance-track.length)/Math.max(.001,advance),0,1);p.finished=true;p.reason='finish';}
 else if(p.t>=LIMIT){p.t=LIMIT;p.finished=true;p.reason='time';}
}
