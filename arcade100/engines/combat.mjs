import {base,arena,object,int,random,dist,move,blocked,effect,damage,finish,winTeam,byScore,bounds,clamp} from './common.mjs';
export const realtime=true;
export function create(spec,players,seed){const s=base(spec,players,seed);arena(s);s.goal='移動して狙い、Aで攻撃 / Bで能力';s.target=24;s.data.wave=1;s.data.spawn=0;s.data.baseHP=100;s.data.charge=0;s.players.forEach(p=>{p.ammo=1;p.weapon='pulse';});
 if([5,10,81,86,87,88].includes(s.n)){s.goal='仲間を守りながら敵を倒す。Bで支援';s.zones=[{x:500,y:525,r:50,kind:'base',label:'CORE'}];}
 if(s.n===5){object(s,'boss',500,160,{hp:700,maximum:700,r:58,sprite:14,attack:3});s.target=1;s.goal='ボスの予告円を避ける。A攻撃 / B回復・盾';}
 if(s.n===10){s.zones[0]={x:130,y:450,r:65,kind:'train',label:'TRAIN'};s.target=35;s.goal='列車を護衛。近くでBを押すと修理';}
 if(s.n===12){s.goal='Aで投げる・パス / Bでキャッチ。相手チームを倒す';s.players.forEach((p,i)=>{p.x=i%2?780:220;p.y=140+Math.floor(i/2)*250;p.ammo=1;});s.data.teamGame=true;}
 if(s.n===14){s.goal='Aで床を塗る。自分の色の床でインク回復';s.data.paint=Array(20*12).fill(-1);}
 if(s.n===16){s.goal='弾は1発。撃った弾を拾って再装填。Bで回避';for(let i=0;i<4;i++)s.walls.push({x:240+i*170,y:i%2?350:120,w:70,h:120});}
 if(s.n===20){s.goal='巨人1人 対 ハンター3人。A攻撃 / B特殊技';s.players[0].hp=600;s.players[0].maximum=600;s.players[0].x=500;s.players[0].y=250;s.players[0].lives=1;s.players.forEach((p,i)=>p.team=i===0?0:1);}
 if(s.n===81){s.goal='近くの味方と連結して弾を強化。Bで弾消し';s.target=36;}
 if(s.n===84){s.goal='最初の20秒に装備を選択。その後対戦';s.data.buildUntil=20;s.choices=['レーザー','重装甲','高速脚'];}
 if(s.n===85){s.goal='端末の近くでAを押して確保。2対2の拠点戦';s.data.teamGame=true;for(let i=0;i<3;i++)object(s,'terminal',300+i*200,300,{owner:-1,capture:0});}
 if(s.n===86){s.goal='P1が車体を操縦、P2が砲撃。Bで緊急修理';s.target=30;s.players.forEach(p=>{p.x=500;p.y=440;});}
 if(s.n===87){s.goal='Aで魔法。味方の近くで撃つと合成 / Bで回復';s.target=32;}
 if(s.n===88){s.goal='空母を防衛。Aで迎撃 / 空母の近くでBで修理';s.target=40;s.zones[0].y=540;}
 if(s.n===89){s.goal='Aでドローンを目的地へ。拠点を占拠して得点';s.zones=[{x:250,y:200,r:65,owner:-1,kind:'hill'},{x:750,y:200,r:65,owner:-1,kind:'hill'},{x:500,y:430,r:65,owner:-1,kind:'hill'}];s.players.forEach(p=>{p.droneTarget={x:p.x,y:p.y};for(let i=0;i<3;i++)object(s,'drone',p.x+i*20,p.y,{owner:p.side,hp:35,r:12,sprite:10+p.side%2});});}
 if(s.n===96){s.goal='Aで雪玉 / Bで雪壁。相手の旗へ近づいて奪う';s.data.teamGame=true;s.zones=[{x:70,y:300,r:45,kind:'flag',team:0},{x:930,y:300,r:45,kind:'flag',team:1}];}
 return s;}
function fire(s,p,input){if(p.cooldown>0||p.hp<=0||s.n===84&&s.t<20)return false;let a=Number.isFinite(input?.aimX)?Math.atan2(input.aimY-p.y,input.aimX-p.x):p.a;if(s.n===86&&p.side===0)return false;
 if(s.n===89){p.droneTarget={x:clamp(input?.aimX||p.x,40,960),y:clamp(input?.aimY||p.y,40,560)};p.cooldown=.3;return true;}
 if(s.n===85){const o=s.objects.find(o=>o.kind==='terminal'&&dist(o,p)<70);if(o){o.capture+=1;if(o.capture>=5){o.owner=p.team;o.capture=0;effect(s,o.x,o.y,'celebrate',p.side);}p.cooldown=.4;return true;}}
 if(s.n===16&&p.ammo<=0)return false;if(s.n===14&&p.energy<5)return false;if(s.n===16)p.ammo--;
 p.energy-=s.n===14?5:0;p.cooldown=s.n===16?.9:s.n===12?.55:s.n===20&&p.side===0?.6:p.weapon==='laser'?.14:.28;p.a=a;
 let fan=s.n===20&&p.side===0?[-.4,-.2,0,.2,.4]:s.n===81&&s.players.some(q=>q!==p&&dist(p,q)<110)?[-.15,0,.15]:s.n===87&&s.players.some(q=>q!==p&&dist(p,q)<130)?[-.24,0,.24]:[0];
 for(const off of fan)s.shots.push({x:p.x+Math.cos(a)*24,y:p.y+Math.sin(a)*24,vx:Math.cos(a+off)*(s.n===12?390:490),vy:Math.sin(a+off)*(s.n===12?390:490),owner:p.side,team:p.team,life:1.8,damage:s.n===16?100:s.n===20&&p.side===0?30:s.n===12?45:p.weapon==='laser'?12:22,r:s.n===12?12:6,kind:s.n===12?'ball':s.n===96?'snow':'bolt'});effect(s,p.x,p.y,'muzzle',p.side);return true;}
export function act(s,side,a){const p=s.players[side];if(!p)return false;if(a.type==='choice'&&s.n===84&&s.t<20){p.weapon=['laser','armor','speed'][a.choice]||'pulse';if(p.weapon==='armor'){p.hp=180;p.maximum=180;}return true;}if(a.type==='primary'||a.type==='ability')return fire(s,p,{aimX:a.x,aimY:a.y});if(a.type==='secondary'&&p.energy>=30){p.energy-=30;if(s.n===12){p.catchUntil=s.t+.6;return true;}if(s.n===96){s.walls.push({x:p.x+Math.cos(p.a)*40-20,y:p.y+Math.sin(p.a)*40-20,w:40,h:40,hp:65,owner:side});if(s.walls.length>32)s.walls.splice(4,1);return true;}if([5,10,86,87,88].includes(s.n)){for(const q of s.players)if(dist(p,q)<160){q.hp=Math.min(q.maximum||100,q.hp+25);q.invulnerable=s.t+1;}if(s.zones[0]&&dist(p,s.zones[0])<130)s.data.baseHP=Math.min(100,s.data.baseHP+10);effect(s,p.x,p.y,'heal',p.side);}else if(s.n===81){s.shots=s.shots.filter(q=>q.owner>=0);effect(s,p.x,p.y,'pulse',p.side);}else {p.invulnerable=s.t+.65;p.x+=Math.cos(p.a)*70;p.y+=Math.sin(p.a)*70;bounds(p);}return true;}return false;}
export function step(s,inputs,dt){const n=s.n;for(const p of s.players){move(s,p,inputs[p.side],dt,n===20&&p.side===0?90:p.weapon==='speed'?260:195);if(inputs[p.side]?.primary)fire(s,p,inputs[p.side]);if(n===14){const i=Math.floor(p.y/50)*20+Math.min(19,Math.floor(p.x/50));if(s.data.paint[i]===p.side)p.energy=Math.min(100,p.energy+dt*30);}}
 if(n===86){s.players.slice(1).forEach(p=>{p.x=s.players[0].x;p.y=s.players[0].y;});}
 if(n===10){s.zones[0].x=140+(s.t*3.5)%720;}
 const coop=s.mode==='coop';if(coop&&n!==5&&s.t>=s.data.spawn){s.data.spawn=s.t+Math.max(.5,1.4-s.t/180);const side=int(s,3);object(s,'enemy',side===0?35:side===1?965:100+int(s,800),side===2?30:80+int(s,350),{hp:40+s.data.wave*8,maximum:60,r:22,attack:s.t+2,sprite:15,enemy:true});}
 for(const o of s.objects){if(!o.active)continue;if(o.kind==='boss'){const p=s.players[int(s,s.players.length)];if(s.t>o.attack){o.attack=s.t+(o.hp<250?1.5:2.8);s.zones.push({x:p.x,y:p.y,r:o.hp<250?100:70,kind:'danger',activate:s.t+1,expires:s.t+1.4});}for(const z of s.zones)if(z.kind==='danger'&&s.t>=z.activate&&s.t<z.expires)for(const q of s.players)if(dist(q,z)<z.r)damage(s,q,dt*100);if(o.hp<=0){o.active=false;s.progress=1;winTeam(s,'巨人を討伐した');}}
 if(o.kind==='enemy'){const target=n===88||n===10?s.zones[0]:s.players.filter(p=>p.hp>0).sort((a,b)=>dist(o,a)-dist(o,b))[0]||s.players[0];const d=dist(o,target)||1;o.x+=(target.x-o.x)/d*dt*(n===81?80:55);o.y+=(target.y-o.y)/d*dt*55;if(d<35){if(target.kind)s.data.baseHP-=dt*9;else damage(s,target,dt*18);}if(s.t>o.attack){o.attack=s.t+3;const a=Math.atan2(target.y-o.y,target.x-o.x);s.shots.push({x:o.x,y:o.y,vx:Math.cos(a)*180,vy:Math.sin(a)*180,owner:-1,team:-1,life:4,damage:16,r:7});}}
 if(o.kind==='ammo')for(const p of s.players)if(p.ammo<1&&dist(p,o)<30){p.ammo++;o.active=false;}
 if(o.kind==='drone'){const p=s.players[o.owner],target=p.droneTarget;const d=dist(o,target)||1;if(d>18){o.x+=(target.x-o.x)/d*dt*120;o.y+=(target.y-o.y)/d*dt*120;}for(const z of s.zones)if(dist(o,z)<z.r){z.owner=o.owner;p.score+=dt*2;}for(const other of s.objects)if(other.kind==='drone'&&other.owner!==o.owner&&dist(o,other)<55){other.hp-=dt*10;if(other.hp<=0){other.x=s.players[other.owner].x;other.y=s.players[other.owner].y;other.hp=35;p.score+=20;}}}
 if(n===85&&o.kind==='terminal'&&o.owner>=0)for(const p of s.players)if(p.team===o.owner)p.score+=dt*3;
 }
 for(const b of s.shots){if(b.life<=0)continue;b.x+=b.vx*dt;b.y+=b.vy*dt;b.life-=dt;const wall=s.walls.find(w=>b.x>w.x&&b.x<w.x+w.w&&b.y>w.y&&b.y<w.y+w.h);if(wall){if(n===12&&b.bounces!==1){b.vx*=-1;b.vy*=-1;b.bounces=1;}else b.life=0;if(wall.hp)wall.hp-=b.damage;}
 if(n===14&&b.owner>=0){const i=Math.floor(clamp(b.y,0,599)/50)*20+Math.floor(clamp(b.x,0,999)/50);s.data.paint[i]=b.owner;}
 for(const p of s.players){if(p.hp<=0||p.side===b.owner||coop&&b.owner>=0||s.data.teamGame&&p.team===b.team||n===20&&p.team===b.team)continue;if(dist(p,b)<(n===20&&p.side===0?50:22)+b.r){if(n===12&&p.catchUntil>s.t){b.owner=p.side;b.team=p.team;b.vx*=-1;b.vy*=-1;b.life=2;p.score+=15;p.catchUntil=0;}else{damage(s,p,b.damage,b.owner);b.life=0;if(b.owner>=0)s.players[b.owner].score+=10;}break;}}
 if(b.owner>=0&&coop)for(const o of s.objects)if(o.active&&(o.kind==='enemy'||o.kind==='boss')&&dist(o,b)<o.r+b.r){o.hp-=b.damage;b.life=0;effect(s,o.x,o.y,'hit',b.owner);if(o.hp<=0&&o.kind==='enemy'){o.active=false;s.progress++;s.players[b.owner].score+=50;s.data.wave=1+Math.floor(s.progress/10);}break;}
 if(b.x<15||b.x>985||b.y<15||b.y>585)b.life=0;if(n===16&&b.life<=0&&b.owner>=0){object(s,'ammo',clamp(b.x,35,965),clamp(b.y,35,565),{r:12});b.owner=-2;}}
 if(n===14)s.players.forEach(p=>p.score=s.data.paint.filter(x=>x===p.side).length);
 if(n===96)for(const p of s.players)for(const z of s.zones)if(z.team!==p.team&&dist(p,z)<z.r&&p.cooldown<=0){p.score+=100;p.cooldown=2;p.x=p.team===0?100:900;p.y=300;}
 s.shots=s.shots.filter(b=>b.life>0).slice(-160);s.objects=s.objects.filter(o=>o.active);s.walls=s.walls.filter(w=>w.hp===undefined||w.hp>0);s.zones=s.zones.filter(z=>!z.expires||z.expires>s.t);
 if(coop&&s.progress>=s.target)winTeam(s,'共同防衛ミッション達成');if(coop&&(s.data.baseHP<=0||s.players.every(p=>p.lives<=0)))finish(s,'failed','防衛ラインが突破された');if(!coop&&s.players.filter(p=>p.lives>0).length<=1)finish(s,s.players.find(p=>p.lives>0)?.side??'draw','最後の生存者');if(n===20&&s.players[0].hp<=0)finish(s,'hunters','ハンター側の勝利');}
