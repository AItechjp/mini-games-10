export const W=1000,H=600;
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
export const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export const copy=v=>JSON.parse(JSON.stringify(v));
export function random(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296;}
export const int=(s,n)=>Math.floor(random(s)*n);
export function shuffle(s,a){for(let i=a.length-1;i>0;i--){let j=int(s,i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
export function base(spec,players,seed){return {version:1,id:spec.id,n:spec.number,family:spec.family,mode:spec.mode,theme:spec.theme,seed:seed>>>0||1,t:0,duration:spec.duration,phase:'playing',round:1,turn:0,ply:0,message:'',goal:'',progress:0,target:10,players:players.map((p,i)=>({id:p.id||String(i),name:p.name||'PLAYER '+(i+1),side:i,x:110+(i%4)*250,y:150+Math.floor(i/4)*250,vx:0,vy:0,a:0,hp:100,energy:100,score:0,lives:3,cooldown:0,stun:0,carried:null,team:spec.mode==='coop'?0:i%2})),objects:[],shots:[],walls:[],zones:[],fx:[],data:{},result:null};}
export function object(s,kind,x,y,extra={}){const o={id:'o'+(s.data.uid=(s.data.uid||0)+1),kind,x,y,r:18,active:true,...extra};s.objects.push(o);return o;}
export function effect(s,x,y,kind='spark',color=0){s.fx.push({x,y,kind,color,t:s.t});if(s.fx.length>40)s.fx.shift();}
export function finish(s,winner,reason){if(s.phase==='over')return;const scores=s.players.map(p=>({id:p.id,name:p.name,score:Math.round(p.score),side:p.side}));s.phase='over';s.result={winner,reason,scores};s.message=reason;}
export function winTeam(s,reason){finish(s,'team',reason);}
export function byScore(s,reason='タイムアップ'){const best=Math.max(...s.players.map(p=>p.score));const winners=s.players.filter(p=>p.score===best);finish(s,winners.length===1?winners[0].side:'draw',reason);}
export function endClock(s){if(s.phase!=='playing'||s.t<s.duration)return;if(s.mode==='coop')finish(s,s.progress>=s.target?'team':'failed',s.progress>=s.target?'共同ミッション達成':'時間切れ');else byScore(s);}
export function bounds(p,r=20){p.x=clamp(p.x,r,W-r);p.y=clamp(p.y,r,H-r);}
export function blocked(s,x,y,r=15){return s.walls.some(w=>x+r>w.x&&x-r<w.x+w.w&&y+r>w.y&&y-r<w.y+w.h);}
export function move(s,p,input,dt,speed=190){if(p.hp<=0)return;const x=clamp(input?.x,-1,1),y=clamp(input?.y,-1,1),l=Math.max(1,Math.hypot(x,y));const nx=p.x+x/l*speed*dt,ny=p.y+y/l*speed*dt;if(!blocked(s,nx,p.y))p.x=nx;if(!blocked(s,p.x,ny))p.y=ny;if(x||y)p.a=Math.atan2(y,x);bounds(p);p.cooldown=Math.max(0,p.cooldown-dt);p.stun=Math.max(0,p.stun-dt);p.energy=Math.min(100,p.energy+dt*9);}
export function nearest(s,p,predicate=()=>true,r=65){return s.objects.filter(o=>o.active&&predicate(o)&&dist(o,p)<r).sort((a,b)=>dist(a,p)-dist(b,p))[0];}
export function damage(s,p,n,attacker=-1){if(p.hp<=0||p.invulnerable>s.t)return;p.hp-=n;effect(s,p.x,p.y,'hit',attacker);if(p.hp<=0){p.lives--;if(attacker>=0&&s.players[attacker])s.players[attacker].score+=100;if(p.lives>0){p.hp=100;p.x=80+int(s,840);p.y=80+int(s,440);p.invulnerable=s.t+2;}else {p.hp=0;p.invulnerable=s.t+999;}}}
export function arena(s){s.walls=[{x:0,y:0,w:1000,h:14},{x:0,y:586,w:1000,h:14},{x:0,y:0,w:14,h:600},{x:986,y:0,w:14,h:600}];}
export function grid(s,w,h,fill=0){s.board={w,h,cells:Array(w*h).fill(fill),selected:-1,kind:'grid'};return s.board;}
export const xy=(i,w)=>({x:i%w,y:Math.floor(i/w)});
export function neighbors(i,w,h,diagonal=false){const {x,y}=xy(i,w),a=[];for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy||!diagonal&&dx&&dy)continue;const nx=x+dx,ny=y+dy;if(nx>=0&&nx<w&&ny>=0&&ny<h)a.push(ny*w+nx);}return a;}
export const validCell=(s,i)=>Number.isInteger(i)&&i>=0&&i<s.board.cells.length;
export function cleanAction(a){if(!a||typeof a!=='object'||Array.isArray(a))return null;return {type:String(a.type||'').slice(0,20),i:Number.isInteger(a.i)?a.i:-1,j:Number.isInteger(a.j)?a.j:-1,value:typeof a.value==='string'?a.value.slice(0,160):Number.isFinite(a.value)?a.value:null,text:typeof a.text==='string'?a.text.slice(0,120):'',x:clamp(a.x,0,W),y:clamp(a.y,0,H),choice:Number.isInteger(a.choice)?a.choice:-1};}
export function publicView(s,side){const v=copy(s);if(v.hands){v.hand=v.hands[side];v.handCounts=v.hands.map(h=>h.length);delete v.hands;}if(v.data.secret){v.private=v.data.secret[side];delete v.data.secret;}delete v.data.deck;delete v.data.solution;delete v.data.mines;delete v.data.roles;delete v.data.hidden;delete v.data.targets;return v;}
