import {base,clamp,int,random,dist,object,move,arena,effect,finish,winTeam} from './common.mjs';
export const realtime=true;
const TRACK=[{x:180,y:120},{x:780,y:95},{x:890,y:275},{x:750,y:480},{x:210,y:490},{x:100,y:310}];
export function create(spec,players,seed){
 const s=base(spec,players,seed);s.data.track=TRACK.map(p=>({...p}));s.target=3;s.goal='チェックポイントを順に通過して3周。矢印/WASDで操縦、Aで技、Bで加速。';
 for(const p of s.players)Object.assign(p,{x:180+p.side*38,y:155,a:0,speed:0,checkpoint:1,lap:0,boost:70,jump:0,strokes:0});
 if(s.n===21){s.goal='横滑りでブーストをため、Aでドリフト、Bで加速。3周先着。';s.data.drift=true;}
 if(s.n===22){s.goal='光るジャンプ台へ進み、空中でAを押すと技。着地前に回転を止めよう。';for(let i=0;i<3;i++)object(s,'ramp',TRACK[i*2].x,TRACK[i*2].y,{r:45});}
 if(s.n===23){s.goal='走者を交代する協力リレー。Aでワイヤー、次の走者へBでバトン。全員で3周。';s.data.runner=0;s.data.baton={...s.players[0]};s.target=3;}
 if(s.n===24){s.goal='左右で斜面を選ぶ。Aでジャンプ。迫る雪崩を避けてゴールへ。';s.data.distance=2400;for(const p of s.players){p.travel=0;p.lane=0;}for(let i=0;i<24;i++)object(s,'rock',90+int(s,820),i*100+100,{r:25,travel:i*100+100});}
 if(s.n===25)s.goal='艇の後ろに入ると引き波で加速。Aで旋回、Bで直線加速。3周先着。';
 if(s.n===27){arena(s);s.goal='ボールが止まったら、狙う場所をタップして打つ。手数が少ないほど高得点。3ホール。';s.data.hole=0;s.data.cup={x:850,y:145};s.walls.push({x:340,y:90,w:30,h:300},{x:650,y:280,w:30,h:230});for(const p of s.players)Object.assign(p,{x:120,y:400+p.side*25,vx:0,vy:0,done:false});}
 if(s.n===29){s.goal='P1はAで左オール、P2はAで右オール。交互に漕ぎ、旗を順に通過して3周。';s.data.boat={x:180,y:120,a:0,speed:0,checkpoint:1,lap:0};s.data.lastPaddle=-1;}
 if(s.n===30){s.goal='自動で走る。Aでハードルを跳び、Bで相手レーンへ障害物を送る。';s.data.distance=1800;for(const p of s.players){p.travel=0;p.lane=p.side;}for(let i=0;i<20;i++)object(s,'hurdle',i*85+110,0,{travel:i*85+110,lane:i%players.length});}
 if(s.n===93){arena(s);s.goal='街の箱をAで拾い、同じ色の配達先へ運ぶ。Bで軽い荷物をダッシュ配送。';s.target=8;for(let i=0;i<4;i++)object(s,'depot',100+i*265,80+(i%2)*430,{color:i});for(let i=0;i<12;i++)object(s,'parcel',100+int(s,800),130+int(s,340),{color:i%4,weight:1+i%3});s.walls.push({x:340,y:170,w:90,h:180},{x:610,y:260,w:100,h:160});}
 return s;
}
export function act(s,side,a){
 const p=s.players[side];if(!p||s.phase!=='playing')return false;
 if(s.n===27&&a.type==='primary'&&!p.done&&Math.hypot(p.vx,p.vy)<8){const angle=Math.atan2(a.y-p.y,a.x-p.x),power=clamp(dist(p,a)*1.5,90,580);p.vx=Math.cos(angle)*power;p.vy=Math.sin(angle)*power;p.strokes++;return true;}
 if(s.n===29&&a.type==='primary'&&p.cooldown<=0){const b=s.data.boat;const alternate=s.data.lastPaddle!==side;b.speed=Math.min(260,b.speed+(alternate?60:20));b.a+=(side===0?1:-1)*.21;s.data.lastPaddle=side;p.cooldown=.28;return true;}
 if(s.n===93&&a.type==='primary'){if(p.carried){const o=s.objects.find(o=>o.id===p.carried);if(o){o.carrier=null;o.x=p.x;o.y=p.y;}p.carried=null;}else{const o=s.objects.find(o=>o.kind==='parcel'&&!o.carrier&&dist(p,o)<65);if(o){o.carrier=p.id;p.carried=o.id;}}return true;}
 if(s.n===23){if(a.type==='secondary'&&side===s.data.runner){s.data.runner=(side+1)%s.players.length;const q=s.players[s.data.runner];Object.assign(q,{x:p.x,y:p.y,a:p.a,speed:p.speed,checkpoint:p.checkpoint,lap:p.lap});s.data.handoffs=(s.data.handoffs||0)+1;return true;}if(a.type==='primary'&&side===s.data.runner){const t=TRACK[p.checkpoint];p.a=Math.atan2(t.y-p.y,t.x-p.x);p.speed+=70;p.jump=.8;return true;}}
 if(a.type==='primary'&&p.cooldown<=0){if([22,24,30].includes(s.n)){if(p.jump>0){if(s.n===22){p.tricks=(p.tricks||0)+1;p.boost=Math.min(100,p.boost+22);}}else p.jump=.85;p.cooldown=.25;}else p.drifting=s.t+1;return true;}
 if(a.type==='secondary'&&p.boost>=25){p.boost-=25;p.turbo=s.t+1.2;if(s.n===30){const q=s.players[(side+1)%s.players.length];object(s,'hurdle',q.travel+150,0,{travel:q.travel+150,lane:q.lane});}return true;}return false;
}
function checkpoint(s,p){const t=TRACK[p.checkpoint];if(dist(p,t)<90){p.checkpoint=(p.checkpoint+1)%TRACK.length;if(p.checkpoint===1){p.lap++;effect(s,p.x,p.y,'goal',p.side);if(s.n===23){s.progress=p.lap;if(p.lap>=3&&(s.data.handoffs||0)>=s.players.length-1)winTeam(s,'全員のバトンで3周完走！');}else if(s.n===29){s.progress=p.lap;if(p.lap>=3)winTeam(s,'息を合わせて完漕！');}else if(p.lap>=3)finish(s,p.side,'3周を先に完走！');}}p.score=p.lap*600+((p.checkpoint+5)%6)*100+(1-Math.min(1,dist(p,t)/700))*90;}
export function step(s,inputs,dt){
 if(s.n===29){const b=s.data.boat;for(const p of s.players){p.cooldown-=dt;if(inputs[p.side]?.primary)act(s,p.side,{type:'primary'});}b.speed*=Math.pow(.7,dt);b.x+=Math.cos(b.a)*b.speed*dt;b.y+=Math.sin(b.a)*b.speed*dt;b.x=clamp(b.x,35,965);b.y=clamp(b.y,35,565);checkpoint(s,b);s.players.forEach((p,i)=>{p.x=b.x+(i-.5)*30*Math.sin(b.a);p.y=b.y-(i-.5)*30*Math.cos(b.a);p.a=b.a;p.score=b.score;});return;}
 if(s.n===27){for(const p of s.players){if(p.done)continue;const nx=p.x+p.vx*dt,ny=p.y+p.vy*dt;for(const w of s.walls)if(nx+10>w.x&&nx-10<w.x+w.w&&ny+10>w.y&&ny-10<w.y+w.h){if(p.x<w.x||p.x>w.x+w.w)p.vx*=-.8;else p.vy*=-.8;}p.x=clamp(p.x+p.vx*dt,25,975);p.y=clamp(p.y+p.vy*dt,25,575);p.vx*=Math.pow(.24,dt);p.vy*=Math.pow(.24,dt);if(dist(p,s.data.cup)<23&&Math.hypot(p.vx,p.vy)<200){p.done=true;p.vx=p.vy=0;p.score+=Math.max(10,120-p.strokes*10);effect(s,p.x,p.y,'goal',p.side);}}for(let i=0;i<s.players.length;i++)for(let j=i+1;j<s.players.length;j++){const a=s.players[i],b=s.players[j];if(!a.done&&!b.done&&dist(a,b)<20){[a.vx,b.vx]=[b.vx,a.vx];[a.vy,b.vy]=[b.vy,a.vy];a.x-=4;b.x+=4;}}
 if(s.players.every(p=>p.done)){if(++s.data.hole===3){const max=Math.max(...s.players.map(p=>p.score));finish(s,s.players.filter(p=>p.score===max).length>1?'draw':s.players.find(p=>p.score===max).side,'3ホール終了');}else{s.data.cup={x:800-s.data.hole*120,y:100+s.data.hole*170};for(const p of s.players){p.done=false;p.strokes=0;p.x=120;p.y=380+p.side*25;}}}return;}
 for(const p of s.players){const i=inputs[p.side]||{};p.cooldown=Math.max(0,p.cooldown-dt);p.jump=Math.max(0,p.jump-dt);p.boost=Math.min(100,p.boost+dt*5);if(i.primary)act(s,p.side,{type:'primary'});
 if(s.n===93){const o=s.objects.find(o=>o.id===p.carried);move(s,p,i,dt,(p.turbo>s.t?330:200)/(o?1+o.weight*.25:1));if(o){o.x=p.x;o.y=p.y-25;const d=s.objects.find(x=>x.kind==='depot'&&x.color===o.color&&dist(x,p)<60);if(d){o.active=false;p.carried=null;p.score+=100*o.weight;effect(s,p.x,p.y,'goal',p.side);object(s,'parcel',120+int(s,760),160+int(s,290),{color:int(s,4),weight:1+int(s,3)});}}continue;}
 if(s.n===30||s.n===24){p.travel+=(p.stun>0?20:145+(p.turbo>s.t?90:0))*dt;p.stun=Math.max(0,p.stun-dt);if(s.n===24)p.lane=clamp(p.lane+i.x*dt*2,-1,1);p.x=s.n===30?160+p.side*200:500+p.lane*370;p.y=450-p.jump*70;for(const o of s.objects){const close=s.n===30?o.lane===p.side:Math.abs(o.x-p.x)<40;if(close&&Math.abs(o.travel-p.travel)<18&&p.jump<.15&&p.stun<=0){p.stun=1.3;p.travel-=25;effect(s,p.x,p.y,'hit',p.side);}}p.score=p.travel;if(p.travel>=s.data.distance)finish(s,p.side,'ゴールに到着！');continue;}
 if(s.n===23&&s.data.runner!==p.side)continue;
 const steer=clamp(i.x,-1,1),throttle=i.y<-.1?1:i.y>.1?-.5:.55;const drift=p.drifting>s.t;
 p.a+=steer*dt*(drift?3.1:2.1)*Math.max(.3,Math.abs(p.speed)/160);p.speed=clamp(p.speed+throttle*dt*180,-70,p.turbo>s.t?390:250);p.speed*=Math.pow(.7,dt);if(drift&&Math.abs(steer)>.5)p.boost=Math.min(100,p.boost+dt*25);
 if(s.n===25){const draft=s.players.some(q=>q.side!==p.side&&dist(q,p)<110&&Math.abs(Math.atan2(q.y-p.y,q.x-p.x)-p.a)<.6);if(draft)p.speed+=dt*60;p.a+=Math.sin(s.t+p.x*.01)*dt*.1;}
 p.x+=Math.cos(p.a)*p.speed*dt;p.y+=Math.sin(p.a)*p.speed*dt;if(p.x<25||p.x>975||p.y<25||p.y>575)p.speed*=.7;p.x=clamp(p.x,25,975);p.y=clamp(p.y,25,575);
 if(s.n===22&&s.objects.some(o=>o.kind==='ramp'&&dist(o,p)<35)&&p.jump<=0)p.jump=1.2;checkpoint(s,p);
 }s.objects=s.objects.filter(o=>o.active);
}
