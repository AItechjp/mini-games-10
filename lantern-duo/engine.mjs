// LANTERN DUO — deterministic, dependency-free cooperative platforming.
export const W = 28, H = 46;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const WORLDS = [
  {name:'こもれびの森',sky:'#a5e6e4',far:'#6ebda7',near:'#398777',soil:'#344c55',grass:'#a4e389',accent:'#ffe397'},
  {name:'こはくの渓谷',sky:'#f0bd8f',far:'#c78786',near:'#986875',soil:'#574f6c',grass:'#ffbf78',accent:'#ffe8a3'},
  {name:'雲海の庭',sky:'#a8ceef',far:'#829fd0',near:'#6669a0',soil:'#444562',grass:'#c8d6f8',accent:'#a7ffff'},
  {name:'星夜の灯台',sky:'#172843',far:'#304d71',near:'#386275',soil:'#263c52',grass:'#6ad8c4',accent:'#ffd577'},
];
const names = ['はじまりの小道','ふたりの橋','森の番人','はずむ水晶','くずれる鉱山','こはくの守り手','風にのって','氷の回廊','雲海の番人','星を結ぶ道','最後の登り坂','灯台に火をともせ'];
const briefs = ['左右とジャンプで進もう。ふたりで床のスイッチに乗ると扉が開く。','動く足場は上から着地。はぐれた仲間は光の泡で戻ってくる。','大きな番人は光っていない時に上から踏もう。','水晶のばねで高くジャンプ。空中の星も探してみよう。','ひびの入った足場は乗るとくずれる。下にも帰れる道がある。','ふたりでスイッチを踏み、跳ねる守り手を越えよう。','風に押される場所では、ジャンプの着地点をよく見よう。','氷の上はすべりやすい。短いジャンプと早めの減速を。','雲の足場とジャンプで、雲海の番人の頭をねらおう。','点滅するトゲは引っ込むタイミングを待とう。','森・渓谷・雲海で覚えたしかけを、ふたりの力で越えよう。','最後の守護者を越え、ふたりそろって灯台へ。'];
export const LEVELS = names.map((name,id)=>({id,name,world:Math.floor(id/3),brief:briefs[id],width:21120+(id%3)*1320,minutes:id%3===2?3:2.5}));
const unit = (id,x=140,z=0) => ({id,x,z,vx:0,vz:0,facing:1,health:3,grounded:true,bubble:false,invulnerable:1,coyote:.12,buffer:0,wasJump:false,ride:null,downTime:0});
const hit = (a,b,pad=0) => a.x+W/2>b.x-pad && a.x-W/2<b.x+b.w+pad && a.z<b.z+b.h && a.z+H>b.z;

export function makeLevel(index) {
  const info=LEVELS[clamp(Math.floor(index),0,11)];
  const data={platforms:[],coins:[],stars:[],enemies:[],spikes:[],springs:[],gates:[],checkpoints:[]};
  const n=info.width/1320;
  for(let i=0;i<n;i++) {
    const x=i*1320, rest=i===0||i===n-1||i%4===0, gateZone=i===5||i===11;
    const top=rest||gateZone?0:[0,40,80,40][(i+index)%4];
    const gap=rest||gateZone?0:105+((i+index)%3)*25;
    const width=1320-gap;
    const ground={x,z:top,w:width,h:280,kind:'ground',baseX:x,baseZ:top};
    data.platforms.push(ground);
    if(i%4===0) data.checkpoints.push({x:x+140,z:0,active:i===0});
    for(let k=0;k<5;k++)data.coins.push({x:x+180+k*170,z:top+65+(k%2)*20,taken:false});
    if(gateZone) {
      const gx=x+830;
      data.gates.push({x:gx,z:0,w:36,h:310,open:false,charge:0,plates:[{x:gx-290,z:0,w:70,pressed:false},{x:gx-110,z:0,w:70,pressed:false}]});
      continue;
    }
    if(!rest) {
      const kind=(index===4||index===10)&&i%3===0?'crumble':(index===1||index===6||index===8||index>=10)&&i%3===1?'moving':'float';
      const px=x+330, pz=top+105;
      data.platforms.push({x:px,z:pz,w:175,h:24,kind,baseX:px,baseZ:pz,phase:i*.9,axis:i%2?'x':'z',timer:0,reset:0,hidden:false});
      if(i%3===1) {
        data.platforms.push({x:x+590,z:top+195,w:170,h:24,kind:'float',baseX:x+590,baseZ:top+195});
        if(data.stars.length<3)data.stars.push({x:x+675,z:top+245,taken:false});
      }
      if(i%3!==1) data.spikes.push({x:x+780,z:top,w:50+(index%3)*8,h:25,active:true,timed:index>=9,phase:i*.75});
      if(index>=3 && [2,6,10,14].includes(i)) data.springs.push({x:x+1030,z:top,w:55});
      data.enemies.push({x:x+480,z:top,w:38,h:31,alive:true,kind:index>=4&&i%3===0?'hopper':'walker',hp:1,maxHp:1,homeZ:top,left:x+200,right:x+700,dir:1,speed:38+index*3,phase:i,invulnerable:0});
    }
  }
  if(index%3===2) {
    const x=info.width-790;
    data.enemies.push({x,z:0,w:84,h:88,alive:true,kind:'boss',hp:4+Math.floor(index/3),maxHp:4+Math.floor(index/3),homeZ:0,left:x-240,right:x+180,dir:-1,speed:65,phase:0,invulnerable:0});
    // A reusable stepping stone makes every boss reachable from either side.
    data.platforms.push({x:x-270,z:68,w:140,h:22,kind:'float',baseX:x-270,baseZ:68});
  }
  return data;
}

export class Game {
  constructor({level=0,mode='solo',elapsed=0,coins=0}={}) {
    this.levelIndex=clamp(Number.isFinite(level)?Math.floor(level):0,0,11);this.level=LEVELS[this.levelIndex];
    Object.assign(this,makeLevel(this.levelIndex));
    this.mode=mode==='coop'?'coop':'solo'; this.players=[unit(0,140),unit(1,215)];
    this.state='playing';this.time=Math.max(0,Number(elapsed)||0);this.stageTime=0;this.score=Math.max(0,Number(coins)||0);
    this.starCount=0;this.deaths=0;this.events=[];this.banner=this.level.brief;this.bannerTime=7;
    this.checkpoint={x:140,z:0};this.finish=this.level.width-180;this.resetTime=0;this.tick=0;
  }
  say(text,time=3) {this.banner=text;this.bannerTime=time;}
  retry() {
    this.players=this.players.map((p,i)=>unit(i,this.checkpoint.x+i*65,this.checkpoint.z));
    this.resetTime=0;this.say('中間地点から、ふたりでもう一度。');
    this.events.push('checkpoint');
  }
  recall() {
    const alive=this.players.filter(p=>!p.bubble&&p.grounded);
    if(!alive.length){if(this.players.every(p=>p.bubble))this.retry();return;}
    const leader=alive.reduce((a,b)=>a.x>b.x?a:b);
    for(const p of this.players)if(p!==leader&&(p.bubble||Math.abs(p.x-leader.x)>400))this.rescue(p,leader);
  }
  rescue(p,friend) {
    Object.assign(p,{x:friend.x-40*friend.facing,z:friend.z+10,vx:0,vz:120,bubble:false,health:3,invulnerable:2,downTime:0,ride:null,wasJump:true});
    this.events.push('rescue');
  }
  damage(p,fall=false) {
    if(p.bubble||(!fall&&p.invulnerable>0))return;
    p.health--; p.invulnerable=1.6;this.events.push('hurt');
    if(fall||p.health<=0){p.bubble=true;p.downTime=0;p.vx=p.vz=0;p.ride=null;this.deaths++;this.say('光の泡に触れると、仲間が復活！');}
    else {p.vz=350;p.vx=-p.facing*170;}
  }
  cpu() {
    const p=this.players[1],a=this.players[0];
    if(p.bubble)return {move:0,jump:false};
    let target=a.x-65*a.facing;
    if(a.bubble)target=a.x;
    const gate=this.gates.find(g=>!g.open&&Math.abs(a.x-g.x)<430);
    if(gate) {
      const nearest=gate.plates.reduce((best,s)=>Math.abs(a.x-(s.x+s.w/2))<Math.abs(a.x-(best.x+best.w/2))?s:best);
      const other=gate.plates.find(s=>s!==nearest);target=other.x+other.w/2;
    }
    const dist=target-p.x,move=Math.abs(dist)>18?Math.sign(dist):0;
    const probe=p.x+move*62;
    const groundAhead=this.platforms.some(s=>!s.hidden&&probe>=s.x&&probe<=s.x+s.w&&s.z<=p.z+3&&s.z>p.z-100);
    const obstacle=this.spikes.some(s=>s.active&&Math.abs(s.x-probe)<75&&s.z<p.z+35)||this.enemies.some(e=>e.alive&&Math.abs(e.x-probe)<90&&e.z<p.z+110);
    const ledge=this.platforms.some(s=>s.kind==='ground'&&Math.abs((move>0?s.x:s.x+s.w)-probe)<50&&s.z>p.z+5&&s.z<p.z+150);
    const jump=p.grounded && !!move && (!groundAhead||obstacle||ledge||a.z>p.z+70);
    return {move,jump:jump||(!p.grounded&&p.vz>0)};
  }
  step(dt,inputs=[]) {
    this.events=[];if(this.state!=='playing')return;
    dt=clamp(Number(dt)||0,0,1/30);if(!dt)return;
    this.time+=dt;this.stageTime+=dt;this.tick+=dt;this.bannerTime=Math.max(0,this.bannerTime-dt);
    for(const s of this.platforms) {
      s.dx=0;s.dz=0;
      if(s.kind==='moving') {
        const oldX=s.x,oldZ=s.z;
        if(s.axis==='x')s.x=s.baseX+Math.sin(this.tick*1.25+s.phase)*70;
        else s.z=s.baseZ+Math.sin(this.tick*1.3+s.phase)*35;
        s.dx=s.x-oldX;s.dz=s.z-oldZ;
      }
      if(s.kind==='crumble') {
        if(s.hidden){s.reset-=dt;if(s.reset<=0){s.hidden=false;s.timer=0;}}
        else if(s.timer>0){s.timer+=dt;if(s.timer>.8){s.hidden=true;s.reset=3;}}
      }
    }
    for(const s of this.spikes)if(s.timed)s.active=Math.sin(this.tick*1.7+s.phase)>.05;
    for(const e of this.enemies) {
      if(!e.alive)continue;
      e.invulnerable=Math.max(0,e.invulnerable-dt);
      e.x+=e.dir*e.speed*dt;
      if(e.x<e.left){e.x=e.left;e.dir=1;}if(e.x>e.right){e.x=e.right;e.dir=-1;}
      if(e.kind==='hopper')e.z=e.homeZ+Math.max(0,Math.sin(this.tick*2.3+e.phase))*68;
      if(e.kind==='boss')e.z=e.homeZ+Math.max(0,Math.sin(this.tick*1.35))*48;
    }
    const controls=[inputs[0]||{},this.mode==='solo'?this.cpu():inputs[1]||{}];
    for(const p of this.players) {
      if(p.bubble)continue;
      const input=controls[p.id];const move=clamp(Number(input.move)||0,-1,1),jump=!!input.jump;
      p.invulnerable=Math.max(0,p.invulnerable-dt);
      const riding=p.ride&&!p.ride.hidden&&p.grounded?p.ride:null;
      if(riding){p.x+=riding.dx||0;p.z+=riding.dz||0;}
      p.coyote=p.grounded?.12:Math.max(0,p.coyote-dt);
      p.buffer=jump&&!p.wasJump?.14:Math.max(0,p.buffer-dt);
      if(!jump&&p.wasJump&&p.vz>290)p.vz=290;
      p.wasJump=jump;
      if(p.coyote>0&&p.buffer>0){p.vz=690;p.grounded=false;p.coyote=p.buffer=0;p.ride=null;this.events.push('jump');}
      const icy=this.levelIndex===7||this.levelIndex===10;
      const acc=p.grounded?(icy?620:2000):1450;
      const speed=p.id===1&&this.mode==='solo'?305:285;
      p.vx+=clamp(move*speed-p.vx,-acc*dt,acc*dt);
      if(move)p.facing=Math.sign(move);
      const wind=this.levelIndex===6||this.levelIndex===8?Math.sin(this.tick*.7+p.x*.0006)*26:0;
      const ox=p.x,oz=p.z;
      let nx=clamp(p.x+(p.vx+wind)*dt,18,this.level.width-35);
      const near=this.platforms.filter(s=>!s.hidden&&s.x<nx+350&&s.x+s.w>nx-350);
      for(const s of near)if(s.kind==='ground'&&p.z<s.z-.5&&p.z+H>s.z-s.h) {
        if(ox+W/2<=s.x+.5&&nx+W/2>s.x){nx=s.x-W/2;p.vx=0;}
        else if(ox-W/2>=s.x+s.w-.5&&nx-W/2<s.x+s.w){nx=s.x+s.w+W/2;p.vx=0;}
      }
      for(const g of this.gates)if(!g.open&&p.z<g.z+g.h&&p.z+H>g.z) {
        if(ox+W/2<=g.x+.5&&nx+W/2>g.x){nx=g.x-W/2;p.vx=0;}
        else if(ox-W/2>=g.x+g.w-.5&&nx-W/2<g.x+g.w){nx=g.x+g.w+W/2;p.vx=0;}
      }
      p.x=nx;p.vz=Math.max(-980,p.vz-1650*dt);
      let nz=p.z+p.vz*dt;p.grounded=false;p.ride=null;
      // Highest crossed top wins; one-way platforms remain passable from below.
      let landing=null;
      for(const s of near)if(p.x+W/2>s.x&&p.x-W/2<s.x+s.w&&p.vz<=0&&oz>=s.z-(s===riding?0:(s.dz||0))-1&&nz<=s.z&&(!landing||s.z>landing.z))landing=s;
      if(landing){nz=landing.z;p.vz=0;p.grounded=true;p.ride=landing;if(landing.kind==='crumble'&&!landing.timer)landing.timer=.001;}
      p.z=nz;
      if(p.z<-380){this.damage(p,true);continue;}
      for(const s of this.springs)if(p.grounded&&p.x+W/2>s.x&&p.x-W/2<s.x+s.w&&Math.abs(p.z-s.z)<5){p.vz=900;p.grounded=false;p.coyote=0;this.events.push('jump');}
      for(const c of this.coins)if(!c.taken&&Math.abs(p.x-c.x)<32&&Math.abs(p.z+H/2-c.z)<42){c.taken=true;this.score++;this.events.push('coin');}
      for(const c of this.stars)if(!c.taken&&Math.abs(p.x-c.x)<36&&Math.abs(p.z+H/2-c.z)<45){c.taken=true;this.score+=10;this.starCount++;this.events.push('star');}
      for(const e of this.enemies)if(e.alive&&hit(p,{x:e.x-e.w/2,z:e.z,w:e.w,h:e.h})) {
        if(p.vz<0&&oz>=e.z+e.h-14) {
          p.vz=590;p.grounded=false;
          if(e.invulnerable<=0){e.hp--;e.invulnerable=.65;this.events.push('stomp');if(e.hp<=0){e.alive=false;this.score+=e.kind==='boss'?30:3;}}
        } else this.damage(p);
      }
      for(const s of this.spikes)if(s.active&&hit(p,{x:s.x+5,z:s.z,w:s.w-10,h:s.h-5}))this.damage(p);
    }
    for(const g of this.gates) {
      if(g.open)continue;
      for(const plate of g.plates)plate.pressed=this.players.some(p=>!p.bubble&&p.grounded&&Math.abs(p.z-plate.z)<6&&p.x>plate.x&&p.x<plate.x+plate.w);
      g.charge=g.plates.every(s=>s.pressed)?Math.min(1,g.charge+dt/0.65):0;
      if(g.charge>=1){g.open=true;this.events.push('gate');this.say('ふたりの灯りで、扉が開いた！');}
    }
    const alive=this.players.filter(p=>!p.bubble);
    if(!alive.length){this.resetTime+=dt;if(this.resetTime>1.2)this.retry();return;}
    this.resetTime=0;
    for(const p of this.players)if(p.bubble) {
      const friend=alive[0];p.downTime+=dt;
      const tx=friend.x-45*friend.facing,tz=friend.z+64;
      p.x+=(tx-p.x)*Math.min(1,dt*4);p.z+=(tz-p.z)*Math.min(1,dt*4);
      if(p.downTime>.9&&Math.abs(p.x-friend.x)<65&&Math.abs(p.z-friend.z)<95&&friend.grounded)this.rescue(p,friend);
    }
    if(this.players.every(p=>!p.bubble)&&Math.abs(this.players[0].x-this.players[1].x)>780) {
      const p=this.players.reduce((a,b)=>a.x<b.x?a:b);p.bubble=true;p.downTime=0;this.say('はぐれた仲間が、光の泡で追いかけてくる。');
    }
    for(const c of this.checkpoints)if(c.x>this.checkpoint.x&&this.players.some(p=>!p.bubble&&p.grounded&&p.x>=c.x&&p.x<c.x+260&&Math.abs(p.z-c.z)<4)) {
      this.checkpoint={x:c.x,z:c.z};c.active=true;
      for(const p of this.players)p.health=3;
      this.say('中間地点を記録。ふたりの体力が回復！');this.events.push('checkpoint');
    }
    if(this.players.every(p=>!p.bubble&&p.x>=this.finish-85)&&!this.enemies.some(e=>e.alive&&e.kind==='boss')&&this.gates.every(g=>g.open)) {
      this.state='clear';this.events.push('win');
    } else if(this.players.some(p=>p.x>=this.finish-50)) {
      if(this.enemies.some(e=>e.alive&&e.kind==='boss'))this.say('番人を倒してから、ふたりで灯台へ。',1);
      else this.say('ふたりそろって、灯りの門へ！',1);
    }
  }
}
