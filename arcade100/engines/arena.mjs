import {base,arena,object,int,random,dist,move,nearest,effect,damage,finish,winTeam,byScore,bounds,W,H} from './common.mjs';
export const realtime=true;
const CARRY=[1,3,7,8,13,61,65,68,92,99];
export function create(spec,players,seed){const s=base(spec,players,seed);arena(s);s.data.nextEvent=5;s.data.supply=100;s.zones=[{x:85,y:300,r:65,kind:'home',label:'BASE'}];s.target=8;s.goal='A:近くを操作 / B:ダッシュ';
 const n=s.n;
 if([1,3,7,8,13,92,99].includes(n)){for(let i=0;i<8;i++)object(s,n===7||n===92?'treasure':n===1?'key':'crate',280+int(s,620),80+int(s,430),{weight:n===3?2:1});s.goal=n===1?'ロープでつながり、鍵を8個BASEへ':n===3?'家具の近くに2人集まり、一緒にBASEへ運ぶ':n===7?'酸素とホースの距離を守って8個回収':n===8?'線路スイッチを切り替え、荷物を列車へ':n===13?'ワイヤーダッシュで宝物を奪い、自分の陣地へ':n===92?'遺品を運ぶ相棒を近くから照らす':'荷物をAで投げ渡し、BASEへ8個届ける';}
 if(n===1){s.data.rope=210;s.walls.push({x:420,y:130,w:70,h:160},{x:680,y:350,w:70,h:180});}
 if(n===3){s.walls.push({x:380,y:160,w:100,h:190},{x:680,y:80,w:80,h:280});s.data.beams=[{x:560,y:460,w:240,h:28,a:0}];}
 if(n===4){s.goal='Aで消火・救助。住民8人をBASEへ';for(let i=0;i<12;i++)object(s,'fire',270+int(s,600),80+int(s,440),{hp:3});for(let i=0;i<8;i++)object(s,'victim',330+int(s,550),80+int(s,440));}
 if(n===6){s.goal='Aで緊急修理。酸素が尽きる前に全端末を直す';s.target=4;for(let i=0;i<4;i++)object(s,'terminal',300+(i%2)*400,160+Math.floor(i/2)*280,{work:0,need:12,label:['酸素','電源','エンジン','隔壁'][i]});}
 if(n===7)s.data.oxygen=100;
 if(n===8){object(s,'train',120,470,{progress:0,hp:100});for(let i=0;i<3;i++)object(s,'switch',300+i*230,380,{on:false});}
 if(n===11){s.goal='Aで爆弾。十字の連鎖爆発から逃げ切る';for(let y=140;y<550;y+=100)for(let x=200;x<900;x+=100){if((x/100+y/100)%2>1)s.walls.push({x,y,w:40,h:40});else object(s,'crate',x+20,y+20,{breakable:true});}s.players.forEach((p,i)=>{p.x=i%2?910:80;p.y=i<2?80:520;});}
 if(n===13){s.zones=s.players.map((p,i)=>({x:i%2?920:80,y:i<2?80:520,r:55,kind:'home',side:i,label:'P'+(i+1)}));for(let i=0;i<4;i++)object(s,'anchor',260+i*170,65,{r:12});}
 if(n===15){s.goal='Aで重力反転。上下の足場のクリスタルを集める';s.players.forEach(p=>{p.data={gravity:1};p.y=500;});for(let i=0;i<16;i++)object(s,'crystal',90+int(s,820),int(s,2)?80:520);}
 if(n===17){s.goal='踏んだ床が崩れる。最後まで残ろう';s.data.tiles=Array(96).fill(0);s.data.width=12;s.data.height=8;s.players.forEach((p,i)=>{p.x=150+i*90;p.y=250;});}
 if(n===18){s.goal='群衆の中の相手を探す。Aで攻撃、Bで分身';for(let i=0;i<18;i++)object(s,'decoy',80+int(s,840),80+int(s,440),{a:random(s)*6.28,sprite:0});}
 if(n===19){s.goal='動く丘の王冠を保持して得点。Aで相手を押す';s.zones=[{x:500,y:300,r:85,kind:'hill',label:'CROWN'}];}
 if(n===61||n===68){s.goal=n===61?'食材→調理台→コンロ→配膳へ。Aで持つ・作業':'食材→調理→回転する注文客へ。Aで操作';s.target=10;object(s,'supply',300,140,{label:'食材'});object(s,'chop',540,140,{label:'調理台'});object(s,'pan',780,150,{label:'コンロ',work:0,need:3});object(s,'serve',810,450,{label:'配膳'});s.walls.push({x:380,y:260,w:350,h:50});s.data.orders=10;}
 if(n===62){s.goal='Aで種まき・水やり・収穫。枯れる前に12株育てる';s.target=12;for(let i=0;i<12;i++)object(s,'plant',280+(i%4)*150,130+Math.floor(i/4)*150,{growth:0,water:60,stage:0});}
 if(n===65){s.goal='受付で鍵→汚れた部屋を清掃→BASEで次の鍵';s.target=8;object(s,'supply',100,100,{label:'受付'});for(let i=0;i<8;i++)object(s,'room',300+(i%4)*170,170+Math.floor(i/4)*230,{work:0,need:6,label:'客室'+(i+1)});}
 if(n===69){s.goal='左=操舵、右=帆。Aで浮力。協力して嵐を抜ける';s.target=200;s.data.ship={x:500,y:300,a:0,hp:100,alt:50};for(let i=0;i<10;i++)object(s,'storm',200+int(s,750),50+int(s,500),{r:40});}
 if(n===92){for(let i=0;i<4;i++)object(s,'ghost',300+int(s,600),80+int(s,440),{sprite:15});}
 if(n===99){for(let i=0;i<5;i++)s.walls.push({x:260+i*130,y:i%2?360:80,w:50,h:170});}
 if(n===100){s.goal='30秒ごとに勝利条件が変化。操作Aでスキル';s.data.rule=0;s.data.ruleLabel='クリスタル収集';for(let i=0;i<18;i++)object(s,'crystal',80+int(s,840),80+int(s,440));}
 return s;}
function interact(s,p){const n=s.n;if(p.cooldown>0||p.hp<=0)return false;p.cooldown=.28;
 if(n===11){object(s,'bomb',p.x,p.y,{owner:p.side,explode:s.t+2.2,r:16});p.cooldown=1.3;return true;}
 if([18,19,100].includes(n)){for(const q of s.players)if(q!==p&&dist(p,q)<85){q.x+=Math.cos(p.a)*60;q.y+=Math.sin(p.a)*60;if(n===18)damage(s,q,34,p.side);else q.stun=.5;bounds(q);}effect(s,p.x,p.y,'pulse',p.side);return true;}
 if(n===15){p.data.gravity*=-1;p.vy=p.data.gravity*170;return true;}
 if(n===69){s.data.ship.alt=Math.min(100,s.data.ship.alt+8);return true;}
 if(n===6){const o=nearest(s,p,x=>x.kind==='terminal');if(!o||o.work>=o.need)return false;o.work++;effect(s,o.x,o.y);if(o.work>=o.need){s.progress++;p.score+=100;s.data.supply+=14;}return true;}
 if(n===4){const f=nearest(s,p,x=>x.kind==='fire',90);if(f){f.hp--;if(f.hp<=0){f.active=false;p.score+=10;}effect(s,f.x,f.y,'water');return true;}if(p.carried){p.carried=null;return true;}const v=nearest(s,p,x=>x.kind==='victim');if(v){p.carried=v.id;v.carrier=p.side;return true;}return false;}
 if(n===62){const o=nearest(s,p,x=>x.kind==='plant',80);if(!o)return false;if(o.growth>=100){s.progress++;p.score+=50;o.growth=0;o.stage=0;o.water=65;}else{ o.stage=1;o.water=Math.min(100,o.water+35);}effect(s,o.x,o.y,'water');return true;}
 if(n===65){if(dist(p,{x:100,y:100})<70){p.carried='key';return true;}const o=nearest(s,p,x=>x.kind==='room'&&x.work<x.need);if(o&&p.carried==='key'){o.work++;if(o.work>=o.need){p.score+=100;s.progress++;p.carried=null;}return true;}return false;}
 if(n===61||n===68){const o=nearest(s,p,x=>['supply','chop','pan','serve'].includes(x.kind),90);if(!o)return false;if(o.kind==='supply'&&!p.carried)p.carried='raw';else if(o.kind==='chop'&&p.carried==='raw')p.carried='chopped';else if(o.kind==='pan'&&p.carried==='chopped'&&!o.cooking){o.cooking=s.t+3;p.carried=null;}else if(o.kind==='pan'&&o.ready&&!p.carried){p.carried='meal';o.ready=false;o.cooking=0;}else if(o.kind==='serve'&&p.carried==='meal'){p.carried=null;s.progress++;p.score+=100;effect(s,p.x,p.y,'celebrate');}else return false;return true;}
 if(n===8){const sw=nearest(s,p,x=>x.kind==='switch');if(sw){sw.on=!sw.on;effect(s,sw.x,sw.y);return true;}}
 if(CARRY.includes(n)){if(p.carried){const o=s.objects.find(x=>x.id===p.carried);if(o){o.carrier=null;o.x=p.x+Math.cos(p.a)*50;o.y=p.y+Math.sin(p.a)*50;if(n===99){o.vx=Math.cos(p.a)*380;o.vy=Math.sin(p.a)*380;}}p.carried=null;return true;}const o=nearest(s,p,x=>['crate','treasure','key'].includes(x.kind)&&x.carrier==null);if(o){p.carried=o.id;o.carrier=p.side;return true;}}
 return false;}
export function act(s,side,a){const p=s.players[side];if(!p)return false;if(a.type==='ability'||a.type==='primary')return interact(s,p);if(a.type==='secondary'&&p.energy>=30){p.energy-=30;if(s.n===18)object(s,'decoy',p.x,p.y,{a:p.a,sprite:0,expires:s.t+10});else {p.x+=Math.cos(p.a)*80;p.y+=Math.sin(p.a)*80;bounds(p);}return true;}return false;}
export function step(s,inputs,dt){const n=s.n;for(const p of s.players){const a=inputs[p.side]||{};let speed=p.carried?135:205;if(p.stun>0)speed*=.2;if(n===3&&p.carried){const others=s.players.filter(q=>q!==p&&dist(q,p)<95);speed=others.length?100:0;}if(n===100&&s.data.rule===2)speed*=1.6;move(s,p,a,dt,speed);if(a.primary)interact(s,p);if(n===15){p.vy+=(p.data?.gravity||1)*dt*520;p.y+=p.vy*dt;if(p.y<50||p.y>550){p.y=Math.max(50,Math.min(550,p.y));p.vy=0;}}}
 if(n===1){for(let i=1;i<s.players.length;i++){const a=s.players[i-1],b=s.players[i],d=dist(a,b);if(d>s.data.rope){const k=(d-s.data.rope)/d/2;const x=(b.x-a.x)*k,y=(b.y-a.y)*k;a.x+=x;a.y+=y;b.x-=x;b.y-=y;}}}
 for(const o of s.objects){if(!o.active)continue;if(o.expires&&s.t>o.expires)o.active=false;if(o.carrier!=null){const p=s.players[o.carrier];if(p?.carried===o.id){o.x=p.x;o.y=p.y-24;const home=n===13?s.zones[p.side]:s.zones[0];if(dist(p,home)<home.r){p.carried=null;o.active=false;p.score+=100;if(s.mode==='coop')s.progress++;if(n===13)object(s,'crate',340+int(s,320),100+int(s,400));}}}
 if(o.vx||o.vy){o.x+=o.vx*dt;o.y+=o.vy*dt;o.vx*=Math.pow(.2,dt);o.vy*=Math.pow(.2,dt);bounds(o);if(n===99&&o.carrier==null){const p=s.players.find(p=>!p.carried&&dist(p,o)<35);if(p){p.carried=o.id;o.carrier=p.side;p.score+=10;}}}
 if(o.kind==='bomb'&&o.explode<=s.t){o.active=false;effect(s,o.x,o.y,'explosion');for(const p of s.players)if(Math.abs(p.x-o.x)<40&&Math.abs(p.y-o.y)<190||Math.abs(p.y-o.y)<40&&Math.abs(p.x-o.x)<190)damage(s,p,100,o.owner);for(const q of s.objects)if(q!==o&&q.active&&(Math.abs(q.x-o.x)<40&&Math.abs(q.y-o.y)<190||Math.abs(q.y-o.y)<40&&Math.abs(q.x-o.x)<190)){if(q.kind==='bomb')q.explode=s.t+.1;else if(q.breakable)q.active=false;}}
 if(o.kind==='fire'){for(const p of s.players)if(dist(p,o)<32)damage(s,p,dt*12);}
 if(o.kind==='decoy'){o.x+=Math.cos(o.a)*dt*35;o.y+=Math.sin(o.a)*dt*35;if(o.x<40||o.x>960||o.y<40||o.y>560)o.a+=2;bounds(o);}
 if(o.kind==='ghost'){const p=s.players.reduce((a,b)=>dist(a,o)<dist(b,o)?a:b);const d=dist(p,o);if(d>25){o.x+=(p.x-o.x)/d*dt*45;o.y+=(p.y-o.y)/d*dt*45;}else damage(s,p,dt*22);}
 if(o.kind==='crystal'){for(const p of s.players)if(dist(p,o)<35){p.score+=25;o.x=80+int(s,840);o.y=n===15?(int(s,2)?80:520):80+int(s,440);effect(s,p.x,p.y,'spark',p.side);break;}}
 if(o.kind==='pan'&&o.cooking&&o.cooking<s.t)o.ready=true;
 if(o.kind==='plant'&&o.stage){o.water-=dt*2.2;o.growth=Math.min(100,o.growth+(o.water>0?dt*5:-dt*3));o.water=Math.max(0,o.water);}
 if(n===68&&o.kind==='serve'){o.y=330+Math.sin(s.t*.6)*160;o.x=760+Math.cos(s.t*.6)*100;}
 }
 if(n===6){s.data.supply-=dt*(.4+(4-s.progress)*.15);if(s.data.supply<=0)finish(s,'failed','酸素がなくなった');}
 if(n===7){s.data.oxygen-=dt*.65;for(const p of s.players){if(dist(p,s.zones[0])>570){damage(s,p,dt*15);s.data.oxygen-=dt;}if(dist(p,s.zones[0])<80)s.data.oxygen=Math.min(100,s.data.oxygen+dt*3);}if(s.data.oxygen<=0)finish(s,'failed','酸素がなくなった');}
 if(n===8){const train=s.objects.find(o=>o.kind==='train');const on=s.objects.filter(o=>o.kind==='switch'&&o.on).length;train.x+=dt*on*9;if(train.x>930)train.x=100;s.zones[0].x=train.x;s.zones[0].y=train.y;}
 if(n===17){for(const p of s.players){const i=Math.min(95,Math.floor(p.y/75)*12+Math.floor(p.x/(1000/12)));if(!s.data.tiles[i])s.data.tiles[i]=s.t+1.5;if(s.data.tiles[i]<s.t)damage(s,p,100);}const alive=s.players.filter(p=>p.lives>0);if(alive.length<=1)finish(s,alive[0]?.side??'draw','最後の生存者');}
 if(n===19){const z=s.zones[0];z.x=500+Math.cos(s.t*.15)*300;z.y=300+Math.sin(s.t*.22)*180;for(const p of s.players)if(dist(p,z)<z.r)p.score+=dt*8;}
 if(n===69){const ship=s.data.ship;const a=inputs[0]||{},b=inputs[1]||{};ship.a+=(Number(a.x)||0)*dt*1.5;ship.alt+=(Number(b.y)||0)*dt*15-dt*1.5;ship.x+=Math.cos(ship.a)*dt*(25+(Number(b.x)||0)*15);ship.y+=Math.sin(ship.a)*dt*40;bounds(ship,50);s.progress+=dt*(ship.alt>25&&ship.alt<80?1:.2);for(const o of s.objects)if(o.kind==='storm'){o.x-=dt*22;if(o.x<30)o.x=970;if(dist(o,ship)<70)ship.hp-=dt*5;}if(ship.alt<=0||ship.hp<=0)finish(s,'failed','飛行船が航行不能');s.players.forEach((p,i)=>{p.x=ship.x+(i%2?25:-25);p.y=ship.y+20;});}
 if(n===100){s.data.rule=Math.floor(s.t/30)%3;s.data.ruleLabel=['クリスタル収集','中央占拠','高速サバイバル'][s.data.rule];if(s.data.rule===1)for(const p of s.players)if(dist(p,{x:500,y:300})<100)p.score+=dt*12;if(s.data.rule===2&&s.t>s.data.nextEvent){object(s,'bomb',80+int(s,840),80+int(s,440),{owner:-1,explode:s.t+2});s.data.nextEvent=s.t+1.5;}}
 if(s.mode==='coop'&&s.progress>=s.target)winTeam(s,'全員でミッション達成');if(s.players.every(p=>p.lives<=0))finish(s,s.mode==='coop'?'failed':'draw','全員ダウン');s.objects=s.objects.filter(o=>o.active||o.kind==='room');}
