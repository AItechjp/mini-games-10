// Presentation only. Never write animation state into the authoritative game.
export const THEMES = [
 ['#addec5','#25483f','#18372f'], ['#b4dafa','#304656','#213444'],
 ['#f1cf91','#65513a','#433b2e'], ['#c4defa','#344a69','#24324d'],
 ['#ffb384','#593744','#3b293a'], ['#9fe7f7','#254c63','#1b3748'],
 ['#c2a3ff','#44395e','#2d2846'], ['#ffb8e6','#443454','#29273d'],
 ['#f0d59f','#614b39','#403429'], ['#b9eb9e','#3c533c','#293d30'],
 ['#ffdaae','#5e4235','#402e29'], ['#a9bbff','#383651','#24243e'],
 ['#e0ebff','#485d74','#304253'], ['#cfecff','#3a5463','#263e50'],
 ['#e2bbff','#46435e','#2c3047'], ['#ffc998','#574235','#392f2a']
];
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export class Graphics {
 constructor(renderer){this.r=renderer;this.players=new Map();this.sparks=[];this.quality='auto';this.reduced=false;this.last=0;this.game=null;this.dt=.016;}
 begin(s,time){
  this.dt=clamp((time-this.last)/1000,0,.06);this.last=time;
  if(this.game!==s.id||s.t<this.simTime){this.players.clear();this.sparks=[];this.game=s.id;}
  this.simTime=s.t;this.palette=THEMES[s.theme]||THEMES[0];
  this.sparks=this.sparks.filter(p=>time-p.born<650);
 }
 player(p){
  let v=this.players.get(p.side);
  if(!v){v={x:p.x,y:p.y,hp:p.hp,face:1,speed:0,flash:0};this.players.set(p.side,v);}
  const dx=p.x-v.x,dy=p.y-v.y,d=Math.hypot(dx,dy),t=this.last;
  if(p.hp<v.hp){v.flash=t+180;this.burst(p.x,p.y-12,'#ffb3b3',10);}
  v.hp=p.hp;if(Math.abs(dx)>.6)v.face=dx<0?-1:1;
  // Ease remote snapshots without changing collisions, actions or aim coordinates.
  const a=d>150||this.reduced?1:1-Math.exp(-this.dt*24);
  v.x+=dx*a;v.y+=dy*a;v.speed+=(Math.min(1,d/10)-v.speed)*.2;
  return v;
 }
 burst(x,y,color,count=9){
  if(this.r.budget.effects===0||this.reduced)return;
  for(let i=0;i<count&&this.sparks.length<100;i++){const a=i*2.39996,v=35+(i%4)*23;this.sparks.push({x,y,color,vx:Math.cos(a)*v,vy:Math.sin(a)*v,born:this.last});}
 }
 ambient(s){
  if(this.r.budget.effects===0||this.reduced)return;
  const r=this.r,c=r.ctx,t=this.last/1000,theme=s.theme;
  c.save();c.globalCompositeOperation='screen';
  const count=this.r.budget.effects===1?9:theme===12?32:19;
  for(let i=0;i<count;i++){
   const x=(i*173.19+t*(theme===12?14:3+i%4))%1040-20;
   const y=((i*i*57.83+(theme===12?t*24:-t*(7+i%5)))%660+660)%660-30;
   const alpha=(.16+.12*Math.sin(i*1.7+t))*(s.board ? .55 : 1);
   c.globalAlpha=alpha;c.fillStyle=this.palette[0];
   if(theme===12){r.circle(x,y,1.5+i%3,this.palette[0]);}
   else {r.circle(x,y,1+i%2,this.palette[0]);if(i%5===0){c.globalAlpha=alpha*.18;r.circle(x,y,6,this.palette[0]);}}
  }
  c.restore();
 }
 frame(x,y,w,h,radius=18){return this.r.cached('frame:'+this.palette.join('')+':'+w+':'+h+':'+radius,x,y,w,h,32,()=>this.frameRaw(x,y,w,h,radius));}
 frameRaw(x,y,w,h,radius=18){
  const r=this.r,c=r.ctx,[accent,light,dark]=this.palette;
  c.save();c.shadowColor='#00000090';c.shadowBlur=22;c.shadowOffsetY=12;
  const g=c.createLinearGradient(x,y,x,y+h);g.addColorStop(0,light);g.addColorStop(.18,dark);g.addColorStop(1,'#101b2b');
  r.rect(x,y,w,h,g,radius,accent+'88');c.shadowBlur=0;c.shadowOffsetY=0;
  r.rect(x+6,y+6,w-12,h-12,'#030a111f',Math.max(2,radius-5),accent+'36');
  r.line(x+radius,y+2,x+w-radius,y+2,accent+'75',2);c.restore();
 }
 cell(x,y,size,fill,selected=false){
  const r=this.r,c=r.ctx;
  r.rect(x+2,y+3,size-4,size-4,'#03060d8f',Math.min(7,size*.1));
  r.rect(x+2,y+1,size-4,size-5,fill,Math.min(7,size*.1),'#ffffff13');
  r.line(x+6,y+3,x+size-6,y+3,'#ffffff17',1);
  if(selected){c.save();c.shadowColor=this.palette[0];c.shadowBlur=this.quality==='low'?0:9;r.rect(x+2,y+1,size-4,size-5,'#ffffff10',6,this.palette[0]);c.restore();}
 }
 gem(x,y,radius,color){return this.r.cached('gem:'+radius+':'+color,x-radius,y-radius,radius*2,radius*2,10,()=>this.gemRaw(x,y,radius,color));}
 gemRaw(x,y,radius,color){
  const r=this.r,c=r.ctx;c.save();c.shadowColor='#030912b0';c.shadowBlur=5;c.shadowOffsetY=4;
  const g=c.createRadialGradient(x-radius*.3,y-radius*.4,1,x,y,radius);
  g.addColorStop(0,'#fffdf4');g.addColorStop(.22,color);g.addColorStop(1,'#183543');
  r.circle(x,y,radius,g,color);c.shadowBlur=0;c.shadowOffsetY=0;r.circle(x-radius*.25,y-radius*.3,radius*.16,'#ffffffaf');c.restore();
 }
 finish(s){
  const r=this.r,c=r.ctx,t=this.last;
  for(const p of this.sparks){const age=(t-p.born)/1000;c.save();c.globalAlpha=Math.max(0,1-age/.65);r.line(p.x+p.vx*age*.75,p.y+p.vy*age*.75,p.x+p.vx*age,p.y+p.vy*age+age*age*24,p.color,2);c.restore();}

 }
}
