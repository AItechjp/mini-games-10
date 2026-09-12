export const games=[
['MOSSBOUND','足場ジャンプ','宝石5個を集め、森の門へ。','← → / A D：移動　Space：ジャンプ','83e3b2','hero'],
['NOVA PATROL','縦シューティング','25機のドローンを撃破。下へ逃がさないで！','矢印 / WASD：移動　Space長押し：連射','80dfff','ship'],
['PRISM BREAK','ブロック崩し','28個のプリズムをすべて壊そう。','← → / A D：パドル　Space：発射','d5a2ff','gem'],
['GARDEN SNAKE','スネーク','果物10個を食べる。壁と自分に注意。','矢印 / WASD：方向転換','c5e879','fruit'],
['CARGO KEEPER','倉庫番','箱を金色の床へ。全3部屋を解こう。','矢印 / WASD：押す　Z：戻す　R：部屋をリセット','f5c780','crate'],
['PULSE PARADE','リズムゲーム','白い線でノートを叩く。32個中20個でクリア。','D F J K：4つのレーンを演奏','ff91be','orb'],
['TIDAL ANGLER','釣りゲーム','白い針を緑の帯で止め、45秒で8匹。','Space：釣り上げる','73dfdd','fish'],
['LANTERN GUARD','タワー防衛','3レーンの塔を強化し、5ウェーブを守る。','1 / 2 / 3：下・中・上の塔　Space：次の波','f7d777','tower'],
['MIDNIGHT RALLY','レース','コーンを避けて3000m。3回衝突で終了。','← → / A D：操舵　W：加速　S：減速','ffab85','car'],
['MOON MEMORY','神経衰弱','90秒で8組をそろえる。カードを覚えよう。','カードをタップ / 矢印で選択、Spaceでめくる','b5b1ff','moon']];
export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const same=(a,b)=>a[0]===b[0]&&a[1]===b[1], has=(list,p)=>list.some(q=>same(q,p));
const touch=(a,b)=>Math.abs(a[0]-b[0])*2<a[2]+b[2]&&Math.abs(a[1]-b[1])*2<a[3]+b[3];
export class Game{
 constructor(index,seed=107){
  this.index=index;this.seed=seed>>>0;this.time=0;this.score=0;this.state='playing';this.hp=3;this.cool=0;this.message='';this.previous=new Set;
  this.x=120;this.y=110;this.vx=0;this.vy=0;this.items=[];this.shots=[];
  switch(index){
   case 0:this.platforms=[[480,64,880,32],[205,145,150,20],[410,225,150,20],[650,310,180,20],[825,390,130,20]];this.gems=[[210,184],[420,264],[640,349],[820,429],[90,105]];this.ground=false;this.taken=new Set;this.x=95;this.y=106;break;
   case 1:this.x=480;this.y=115;this.spawn=0;this.kills=0;break;
   case 2:this.x=480;this.ball=[480,135];this.velocity=[165,235];this.launched=false;this.bricks=Array.from({length:28},(_,n)=>[140+n%7*112,300+Math.floor(n/7)*44,100,30]);break;
   case 3:this.snake=[[8,7],[7,7],[6,7]];this.direction=[1,0];this.pending=[1,0];this.timer=0;this.fruit=this.newFruit();break;
   case 4:this.level=0;this.loadPuzzle();break;
   case 5:this.notes=Array.from({length:32},(_,n)=>({lane:Math.floor(this.random()*4),t:2+n*.6,done:false}));this.hits=0;this.combo=0;this.feedback=0;break;
   case 6:this.target=.5;this.width=.22;this.caught=0;this.attempt=0;this.cursor=.5;break;
   case 7:this.towers=[0,0,0];this.money=90;this.wave=0;this.pendingEnemies=0;this.spawn=0;this.firing=[0,0,0];this.hp=10;break;
   case 8:this.x=480;this.speed=90;this.distance=0;this.spawn=0;this.invuln=0;break;
   case 9:this.cards=Array.from({length:16},(_,n)=>n%8);for(let n=15;n>0;n--){let j=Math.floor(this.random()*(n+1));[this.cards[n],this.cards[j]]=[this.cards[j],this.cards[n]];}this.selected=0;this.flipped=[];this.matched=new Set;this.reveal=0;this.moves=0;break;
  }
 }
 random(){this.seed=(Math.imul(1664525,this.seed)+1013904223)>>>0;return this.seed/4294967296;}
 newFruit(){const cells=[];for(let x=0;x<22;x++)for(let y=0;y<12;y++)if(!has(this.snake,[x,y]))cells.push([x,y]);return cells[Math.floor(this.random()*cells.length)];}
 loadPuzzle(){this.board=[['########','#......#','#.@$o..#','#......#','########'],['########','#..o...#','#..$...#','#.@.$o.#','#......#','########'],['########','#..o.o.#','#..$.$.#','#..@...#','#.$o...#','#......#','########']][this.level];this.walls=[];this.goals=[];this.boxes=[];this.history=[];this.board.forEach((row,y)=>[...row].forEach((c,x)=>{if(c==='#')this.walls.push([x,y]);if(c==='o')this.goals.push([x,y]);if(c==='$')this.boxes.push([x,y]);if(c==='@')this.player=[x,y];}));}
 finish(win){this.state=win?'won':'lost';}
 step(dt,input=[]){
  dt=clamp(dt,0,1/30);const keys=new Set(input),pressed=new Set([...keys].filter(k=>!this.previous.has(k)));this.previous=keys;if(this.state!=='playing')return;
  this.time+=dt;this.cool=Math.max(0,this.cool-dt);const dx=Number(keys.has('right'))-Number(keys.has('left')),dy=Number(keys.has('up'))-Number(keys.has('down')),action=pressed.has('action');
  switch(this.index){
   case 0:{this.x=clamp(this.x+dx*250*dt,60,900);if(action&&this.ground){this.vy=475;this.ground=false;}const old=this.y;this.vy-=980*dt;this.y+=this.vy*dt;this.ground=false;
    for(const[x,y,w,h]of this.platforms){const top=y+h/2+18;if(this.vy<=0&&old>=top-.1&&this.y<=top&&Math.abs(this.x-x)<w/2+12){this.y=top;this.vy=0;this.ground=true;}}
    this.gems.forEach(([x,y],i)=>{if(!this.taken.has(i)&&Math.abs(this.x-x)<27&&Math.abs(this.y-y)<36){this.taken.add(i);this.score+=100;}});
    if(Math.abs(this.x-(480+Math.sin(this.time*1.5)*120))<28&&this.y<110&&this.cool===0){this.hp--;this.cool=1.5;this.vy=300;}
    if(this.taken.size===5&&this.x>820&&this.y>405){this.score+=Math.max(0,Math.floor(120-this.time))*5;this.finish(true);}if(this.hp<=0||this.time>=120)this.finish(false);break;}
   case 1:{this.x=clamp(this.x+dx*320*dt,65,895);this.y=clamp(this.y+dy*280*dt,75,425);if(keys.has('action')&&this.cool===0){this.shots.push([this.x,this.y+20]);this.cool=.16;}
    this.spawn-=dt;if(this.spawn<=0){this.spawn=Math.max(.28,.75-this.time*.009);this.items.push([75+this.random()*810,455,-40+this.random()*80]);}
    for(const s of this.shots)s[1]+=560*dt;for(const e of this.items){e[0]+=e[2]*dt;e[1]-=(75+this.time*1.6)*dt;}
    for(const s of [...this.shots]){let hit=this.items.find(e=>Math.abs(s[0]-e[0])<25&&Math.abs(s[1]-e[1])<23);if(hit){this.items.splice(this.items.indexOf(hit),1);this.shots.splice(this.shots.indexOf(s),1);this.kills++;this.score+=100;}}
    this.items=this.items.filter(e=>{if(Math.abs(e[0]-this.x)<30&&Math.abs(e[1]-this.y)<28||e[1]<55){this.hp--;return false;}return true;});this.shots=this.shots.filter(s=>s[1]<475);
    if(this.hp<=0||this.time>=90)this.finish(false);else if(this.kills>=25)this.finish(true);break;}
   case 2:{this.x=clamp(this.x+dx*480*dt,110,850);if(!this.launched){this.ball=[this.x,126];if(action)this.launched=true;}else{
    for(let n=0;n<2;n++){const b=this.ball,v=this.velocity,old=[...b];b[0]+=v[0]*dt/2;b[1]+=v[1]*dt/2;
     if(b[0]<57||b[0]>903){b[0]=clamp(b[0],57,903);v[0]*=-1;}if(b[1]>463){b[1]=463;v[1]=-Math.abs(v[1]);}
     if(v[1]<0&&old[1]>=115&&b[1]<=115&&Math.abs(b[0]-this.x)<69){b[1]=115;v[0]=(b[0]-this.x)*4;v[1]=Math.max(220,330-Math.abs(v[0])*.25);}
     const hit=this.bricks.find(r=>touch([b[0],b[1],14,14],r));if(hit){this.bricks.splice(this.bricks.indexOf(hit),1);this.score+=50;if(Math.abs(old[0]-hit[0])>hit[2]/2+6)v[0]*=-1;else v[1]*=-1;}
     if(b[1]<65){this.hp--;this.launched=false;this.velocity=[165,235];break;}
    }}if(!this.bricks.length)this.finish(true);else if(this.hp<=0||this.time>=180)this.finish(false);break;}
   case 3:{for(const[key,d]of [['up',[0,1]],['down',[0,-1]],['left',[-1,0]],['right',[1,0]]])if(pressed.has(key)&&!same(d,[-this.direction[0],-this.direction[1]]))this.pending=d;
    this.timer+=dt;if(this.timer>=Math.max(.085,.18-this.score*.0005)){this.timer=0;this.direction=this.pending;const[x,y]=this.snake[0],d=this.direction,n=[x+d[0],y+d[1]],eating=same(n,this.fruit);
     if(n[0]<0||n[0]>=22||n[1]<0||n[1]>=12||has(eating?this.snake:this.snake.slice(0,-1),n)){this.finish(false);break;}this.snake.unshift(n);if(eating){this.score+=10;this.fruit=this.newFruit();}else this.snake.pop();if(this.score>=100)this.finish(true);
    }break;}
   case 4:{if(pressed.has('undo')&&this.history.length)[this.player,this.boxes]=this.history.pop();for(const[key,d]of [['up',[0,-1]],['down',[0,1]],['left',[-1,0]],['right',[1,0]]]){
    if(!pressed.has(key))continue;const[x,y]=this.player,n=[x+d[0],y+d[1]],n2=[n[0]+d[0],n[1]+d[1]];if(has(this.walls,n)||has(this.boxes,n)&&(has(this.walls,n2)||has(this.boxes,n2)))break;
    this.history.push([[...this.player],this.boxes.map(b=>[...b])]);if(has(this.boxes,n))this.boxes[this.boxes.findIndex(b=>same(b,n))]=n2;this.player=n;
    if(this.boxes.every(b=>has(this.goals,b))){this.score+=300;this.level++;if(this.level===3)this.finish(true);else this.loadPuzzle();}break;
   }break;}
   case 5:{this.feedback=Math.max(0,this.feedback-dt);for(let lane=0;lane<4;lane++){if(!pressed.has('lane'+lane))continue;let n=this.notes.filter(n=>!n.done&&n.lane===lane).sort((a,b)=>Math.abs(a.t-this.time)-Math.abs(b.t-this.time))[0];
    if(n&&Math.abs(n.t-this.time)<=.18){n.done=true;this.hits++;this.combo++;this.score+=100+Math.min(this.combo,20)*5;this.message=Math.abs(n.t-this.time)<.07?'PERFECT':'GOOD';}else{this.combo=0;this.message='タイミングを合わせよう';}this.feedback=.3;
   }for(const n of this.notes)if(!n.done&&this.time>n.t+.18){n.done=true;this.combo=0;}if(this.time>21.5)this.finish(this.hits>=20);break;}
   case 6:{this.cursor=.5+.46*Math.sin(this.time*(2.4+this.caught*.16));if(action&&this.cool===0){this.cool=.55;this.attempt++;if(Math.abs(this.cursor-this.target)<this.width/2){this.caught++;this.score+=100;this.message='釣れた！';this.target=.18+this.random()*.64;this.width=Math.max(.12,.22-this.caught*.012);}else this.message='緑の帯を狙おう';}if(this.caught>=8)this.finish(true);else if(this.time>=45)this.finish(false);break;}
   case 7:{for(let lane=0;lane<3;lane++)if(pressed.has('build'+lane)&&this.towers[lane]<3){const cost=30+this.towers[lane]*20;if(this.money>=cost){this.money-=cost;this.towers[lane]++;}}
    if(action&&!this.items.length&&this.pendingEnemies===0&&this.wave<5){if(this.towers.every(t=>t===0)){this.message='先に塔を建てよう';break;}this.wave++;this.pendingEnemies=5+this.wave*2;this.spawn=0;this.message='';}
    this.spawn-=dt;if(this.pendingEnemies&&this.spawn<=0){this.items.push([880,Math.floor(this.random()*3),2+Math.floor(this.wave/2)]);this.pendingEnemies--;this.spawn=.9;}
    for(let lane=0;lane<3;lane++){this.firing[lane]=Math.max(0,this.firing[lane]-dt);const es=this.items.filter(e=>e[1]===lane).sort((a,b)=>a[0]-b[0]);if(es.length&&this.towers[lane]&&this.firing[lane]===0){es[0][2]-=this.towers[lane];this.firing[lane]=.75;this.shots.push([150,es[0][0],lane,.13]);}}
    for(const s of this.shots)s[3]-=dt;this.shots=this.shots.filter(s=>s[3]>0);this.items=this.items.filter(e=>{if(e[2]<=0){this.money+=12;this.score+=50;return false;}e[0]-=(32+this.wave*5)*dt;if(e[0]<110){this.hp--;return false;}return true;});
    if(this.hp<=0)this.finish(false);else if(this.wave===5&&!this.items.length&&!this.pendingEnemies)this.finish(true);break;}
   case 8:{this.speed=clamp(this.speed+(keys.has('up')?55:keys.has('down')?-95:10)*dt,60,220);this.x=clamp(this.x+dx*310*dt,295,665);this.distance+=this.speed*dt;this.score=Math.floor(this.distance);this.spawn-=dt;this.invuln=Math.max(0,this.invuln-dt);
    if(this.spawn<=0){this.spawn=.8;this.items.push([[320,400,480,560,640][Math.floor(this.random()*5)],480]);}for(const e of this.items){e[1]-=this.speed*1.7*dt;if(Math.abs(e[0]-this.x)<33&&Math.abs(e[1]-130)<40&&this.invuln===0){this.hp--;this.invuln=1.4;this.speed=60;}}this.items=this.items.filter(e=>e[1]>30);if(this.hp<=0)this.finish(false);else if(this.distance>=3000)this.finish(true);break;}
   case 9:{if(this.reveal){this.reveal=Math.max(0,this.reveal-dt);if(this.reveal===0)this.flipped=[];}for(const[key,d]of [['left',-1],['right',1],['up',-4],['down',4]])if(pressed.has(key))this.selected=(this.selected+d+16)%16;
    if(action&&!this.reveal&&!this.matched.has(this.selected)&&!this.flipped.includes(this.selected)){this.flipped.push(this.selected);if(this.flipped.length===2){this.moves++;const[a,b]=this.flipped;if(this.cards[a]===this.cards[b]){for(const n of this.flipped)this.matched.add(n);this.flipped=[];this.score+=100;}else this.reveal=.85;}}
    if(this.matched.size===16){this.score+=Math.max(0,Math.floor(90-this.time))*5;this.finish(true);}else if(this.time>=90)this.finish(false);break;}
  }
 }
 status(){switch(this.index){case 0:return `宝石 ${this.taken.size}/5　♥ ${this.hp}　残り ${Math.max(0,120-Math.floor(this.time))}秒`;case 1:return `撃破 ${this.kills}/25　シールド ${this.hp}`;case 2:return `残り ${this.bricks.length}個　ボール ${this.hp}　${this.launched?'':'Space / 発射ボタン'}`;case 3:return `果物 ${this.score/10}/10`;case 4:return `部屋 ${Math.min(3,this.level+1)}/3　戻す：Z`;case 5:return `HIT ${this.hits}/32　COMBO ${this.combo}　${this.feedback?this.message:''}`;case 6:return `${this.caught}/8匹　残り ${Math.max(0,45-Math.floor(this.time))}秒　${this.message}`;case 7:return `WAVE ${this.wave}/5　資金 ${this.money}　城門 ${this.hp}　${this.message}`;case 8:return `${Math.floor(this.distance)}/3000m　${Math.floor(this.speed)}km/h　耐久 ${this.hp}`;default:return `${this.matched.size/2}/8組　${this.moves}手　残り ${Math.max(0,90-Math.floor(this.time))}秒`;}}
}
