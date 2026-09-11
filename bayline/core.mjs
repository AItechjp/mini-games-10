// BAYLINE — original city-action game. Simulation has no DOM or rendering dependency.
export const VERSION=1, SAVE_KEY='bayline.city.v1', PI=Math.PI, TAU=PI*2;
export const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const finite=(n,d=0)=>Number.isFinite(n)?n:d;
export const angle=a=>Math.atan2(Math.sin(a),Math.cos(a));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function rng(seed=61423){let s=seed>>>0;return()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
export const ROADS=[-480,-320,-160,0,160,320,480];
export const POI={garage:{x:-310,z:430,name:'サウスサイド・ガレージ'},docks:{x:450,z:480,name:'コンテナ埠頭'},marina:{x:480,z:230,name:'マリーナ'},market:{x:-160,z:55,name:'オールドマーケット'},club:{x:160,z:-240,name:'クラブ・ヴェルヴェット'},tower:{x:12,z:-320,name:'アトラス・タワー'},rail:{x:-470,z:-160,name:'鉄道貨物ターミナル'},power:{x:-320,z:-430,name:'西変電所'},relay:{x:320,z:-470,name:'通信中継局'},hotel:{x:320,z:140,name:'オーシャン・ホテル'},plaza:{x:0,z:12,name:'シビック・プラザ'},depot:{x:-480,z:320,name:'ウェスト倉庫'},beach:{x:480,z:400,name:'ベイウォーク'},safehouse:{x:-465,z:-320,name:'北の隠れ家'}};
const step=(type,place,text,extra={})=>({type,place,text,...extra});
export const CIRCUITS=[
 [[-320,320],[-320,0],[-160,0],[-160,-320],[160,-320],[160,160],[320,160],[320,480],[-320,480],[-320,320]],
 [[480,320],[480,-480],[0,-480],[0,-160],[-480,-160],[-480,480],[0,480],[0,320],[480,320]],
 [[-480,-320],[-160,-320],[-160,160],[160,160],[160,-480],[480,-480],[480,480],[-480,480],[-480,-320]]
].map(r=>r.map(([x,z])=>({x,z})));
export const CHAPTERS=[
 {name:'01 / 戻れない夜',contact:'MAYA',intro:'久しぶり、相棒。港の積み荷が消えた。まず車を確保して、マーケットで私の仲間に会って。',reward:900,minutes:4,steps:[step('drive','market','車を確保し、マーケットへ向かう'),step('interact','market','車を降り、連絡員から情報を受け取る'),step('drive','docks','埠頭へ向かい、荷物の行方を探る'),step('hack','docks','積荷端末を調べる',{duration:18}),step('drive','garage','ガレージへ戻る')]},
 {name:'02 / 港の借り',contact:'JUNO',intro:'埠頭を仕切る連中が証拠を抱えている。連絡員は無事だが、保管庫の周囲には警備がいる。',reward:1200,minutes:5,steps:[step('drive','marina','マリーナで待ち合わせる'),step('interact','marina','保管庫の鍵を受け取る'),step('combat','docks','保管庫の警備を排除する',{count:5}),step('interact','docks','証拠のケースを回収する'),step('escape','depot','追跡を振り切り、ウェスト倉庫へ逃げ込む')]},
 {name:'03 / ミッドナイト・ラン',contact:'MAYA',intro:'街を知るには走るのがいちばん。ドライバー仲間から、湾岸一周の招待が届いた。',reward:1500,minutes:5,steps:[step('drive','garage','ガレージで車の状態を整える'),step('interact','garage','レースへの出走を登録する'),step('race','garage','黄色いチェックポイントを順に通過する',{circuit:0,limit:260}),step('drive','club','クラブで主催者に会う'),step('interact','club','主催者から報酬と情報を受け取る')]},
 {name:'04 / 停電前夜',contact:'JUNO',intro:'アトラス社の監視網は二つの中継局につながっている。順に停止させれば、貨物の経路が見えてくる。',reward:1600,minutes:5,steps:[step('combat','power','西変電所の警備を排除する',{count:5}),step('hack','power','西側の監視網を停止する',{duration:25}),step('drive','relay','北東の中継局へ移動する'),step('combat','relay','中継局を確保する',{count:4}),step('hack','relay','貨物ログをダウンロードする',{duration:28}),step('drive','safehouse','隠れ家へ証拠を持ち帰る')]},
 {name:'05 / ガラスの証人',contact:'MAYA',intro:'ホテルに証人がいる。敵より先に会い、連絡をつなぎ続けて。逃走用の車は近くに停めておこう。',reward:1800,minutes:5,steps:[step('drive','hotel','オーシャン・ホテルへ向かう'),step('interact','hotel','証人と連絡を取る'),step('defend','hotel','証人の避難が終わるまで周辺を守る',{duration:80,count:3}),step('drive','marina','証言の記録をマリーナへ運ぶ'),step('interact','marina','船の連絡員に記録を渡す'),step('escape','safehouse','隠れ家まで逃走する')]},
 {name:'06 / 赤いコンテナ',contact:'JUNO',intro:'貨物列車が着く。鉄道ターミナルと港に散らばった記録を照合すれば、密輸の証拠が揃う。',reward:2000,minutes:5,steps:[step('combat','rail','貨物ターミナルを確保する',{count:6}),step('hack','rail','列車の到着ログを調べる',{duration:22}),step('drive','docks','対応するコンテナを港で探す'),step('combat','docks','コンテナの警備を排除する',{count:6}),step('interact','docks','台帳を回収する'),step('drive','market','台帳をマーケットの仲間へ届ける')]},
 {name:'07 / ベイ・チェイス',contact:'MAYA',intro:'もう隠れきれない。目立つ車で監視を引きつけて、北から南まで大きく走り抜けよう。',reward:2100,minutes:5,steps:[step('drive','tower','アトラス・タワー前へ向かう'),step('interact','tower','公開端末から監視の囮信号を送る'),step('race','tower','監視ゲートをすべて通過する',{circuit:1,limit:300,heat:3}),step('escape','garage','追跡を振り切り、南のガレージへ戻る')]},
 {name:'08 / 倉庫の夜明け',contact:'JUNO',intro:'ウェスト倉庫が包囲された。仲間が持ち出す資料を守って。そのあと街の反対側へ運ぶ。',reward:2300,minutes:5,steps:[step('drive','depot','包囲された倉庫へ向かう'),step('defend','depot','資料搬出の間、倉庫を守る',{duration:95,count:4}),step('interact','depot','資料ケースを受け取る'),step('drive','beach','海沿いの受け渡し地点へ向かう'),step('combat','beach','待ち伏せを突破する',{count:5}),step('interact','beach','資料を仲間に託す')]},
 {name:'09 / アトラスの嘘',contact:'MAYA',intro:'企業の記録と街の噂がつながった。公開前に、タワーのサーバーから署名付きの原本を取る。',reward:2500,minutes:5,steps:[step('drive','club','クラブの情報屋に会う'),step('interact','club','サーバーのアクセス情報を受け取る'),step('combat','tower','タワー前の警備を突破する',{count:7}),step('hack','tower','署名付きの原本を抽出する',{duration:35}),step('escape','safehouse','原本を守りながら隠れ家へ戻る')]},
 {name:'10 / 最後の配達',contact:'JUNO',intro:'資料を分散しておく。どこか一か所が襲われても、街が真実を失わないように。',reward:2600,minutes:5,steps:[step('interact','safehouse','原本の複製を受け取る'),step('drive','market','一つ目の複製をマーケットへ運ぶ'),step('interact','market','連絡員へ複製を渡す'),step('drive','marina','二つ目の複製をマリーナへ運ぶ'),step('combat','marina','受け渡し地点を確保する',{count:6}),step('interact','marina','最後の複製を託す'),step('drive','plaza','公開の舞台、プラザへ集まる')]},
 {name:'11 / 街の声',contact:'MAYA',intro:'プラザの放送設備を使う。私が回線をつなぐ間、現場を守って。ここが正念場だ。',reward:3000,minutes:6,steps:[step('combat','plaza','放送設備の周辺を確保する',{count:7}),step('hack','plaza','公開回線を接続する',{duration:32}),step('defend','plaza','送信が完了するまで設備を守る',{duration:110,count:4}),step('drive','relay','予備回線の中継局へ向かう'),step('hack','relay','送信を最後まで中継する',{duration:25}),step('escape','hotel','追跡を外し、ホテルで仲間と合流する')]},
 {name:'12 / アフターライト',contact:'MAYA',intro:'街はもう真実を知っている。最後の証拠を港へ送り、みんなで帰ろう。今夜の借りは、これで終わり。',reward:5000,minutes:6,steps:[step('interact','hotel','最後のケースを受け取る'),step('race','hotel','街を横断する脱出ルートを走る',{circuit:2,limit:320,heat:3}),step('combat','docks','最後の封鎖を突破する',{count:8}),step('hack','docks','証拠を外部へ送信する',{duration:35}),step('drive','beach','海沿いの集合場所へ向かう'),step('interact','beach','仲間と再会し、夜を終える')]}
];
export const JOBS=[
 {name:'ベイサイド急送',from:'garage',to:'marina',reward:600,limit:150},
 {name:'北の小包',from:'market',to:'relay',reward:700,limit:150},
 {name:'クラブの忘れ物',from:'club',to:'hotel',reward:550,limit:130},
 {name:'港のスペアパーツ',from:'docks',to:'power',reward:850,limit:180},
 {name:'深夜の差し入れ',from:'hotel',to:'depot',reward:650,limit:150},
 {name:'最後の新聞',from:'rail',to:'beach',reward:750,limit:170}
];
export function buildCity(){
 const random=rng(), buildings=[];let id=0;
 for(let ix=0;ix<6;ix++)for(let iz=0;iz<6;iz++){
  if((ix===2&&iz===3)||(ix===5&&iz===5))continue;
  for(let a=0;a<2;a++)for(let b=0;b<2;b++){
   const x=-480+ix*160+42+a*76,z=-480+iz*160+42+b*76;
   const downtown=ix>=2&&ix<=4&&iz<=2;
   const h=downtown?30+random()*88:9+random()*28;
   buildings.push({id:id++,x,z,w:40+random()*18,d:38+random()*20,h,style:downtown?1:(ix===0?2:0),seed:Math.floor(random()*1e6)});
  }
 }
 return buildings;
}
export const BUILDINGS=buildCity();
export const CACHES=Array.from({length:24},(_,i)=>{const j=i%6,k=Math.floor(i/6);return {id:i,x:ROADS[j]+(k%2?14:-14),z:-425+k*255+(i%3)*20};});
const buckets=new Map();for(const b of BUILDINGS){const k=`${Math.floor(b.x/160)},${Math.floor(b.z/160)}`;if(!buckets.has(k))buckets.set(k,[]);buckets.get(k).push(b);}
export function blocked(x,z,r=.5){
 if(!Number.isFinite(x)||!Number.isFinite(z)||x<-529+r||x>529-r||z<-529+r||z>529-r)return true;
 const ix=Math.floor(x/160),iz=Math.floor(z/160);
 for(let a=ix-1;a<=ix+1;a++)for(let b=iz-1;b<=iz+1;b++)for(const q of buckets.get(`${a},${b}`)||[]){if(Math.abs(x-q.x)<q.w/2+r&&Math.abs(z-q.z)<q.d/2+r)return true;}
 return false;
}
export function sight(a,b){const d=distance(a,b),n=Math.ceil(d/4);for(let i=1;i<n;i++){const t=i/n;if(blocked(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t,.15))return false;}return true;}
export function nearestRoad(p){let rx=ROADS.reduce((a,b)=>Math.abs(p.x-a)<Math.abs(p.x-b)?a:b),rz=ROADS.reduce((a,b)=>Math.abs(p.z-a)<Math.abs(p.z-b)?a:b);return Math.abs(p.x-rx)<Math.abs(p.z-rz)?{x:rx,z:clamp(p.z,-480,480)}:{x:clamp(p.x,-480,480),z:rz};}
export function gps(a,b){const p=nearestRoad(a),q=nearestRoad(b);if(sight(p,q)&&(Math.abs(p.x-q.x)<3||Math.abs(p.z-q.z)<3))return[a,p,q,b];let ix=ROADS.reduce((v,r)=>Math.abs(r-p.x)<Math.abs(v-p.x)?r:v),iz=ROADS.reduce((v,r)=>Math.abs(r-p.z)<Math.abs(v-p.z)?r:v);let jx=ROADS.reduce((v,r)=>Math.abs(r-q.x)<Math.abs(v-q.x)?r:v),jz=ROADS.reduce((v,r)=>Math.abs(r-q.z)<Math.abs(v-q.z)?r:v);return[a,p,{x:ix,z:iz},{x:ix,z:jz},{x:jx,z:jz},q,b];}
export function cleanInput(v={}){const x=clamp(finite(v.x),-1,1),y=clamp(finite(v.y),-1,1),l=Math.max(1,Math.hypot(x,y));return{x:x/l,y:y/l,yaw:angle(finite(v.yaw)),run:!!v.run,fire:!!v.fire,brake:!!v.brake,interact:!!v.interact,seq:clamp(Math.floor(finite(v.seq)),-1,1e9),action:['enter','reload','start','retry','repair','engine','armor','rescue','job','race','cancel'].includes(v.action)?v.action:'',choice:clamp(Math.floor(finite(v.choice)),0,12)};}
export function player(id){return{id,x:-310+id*3,z:430-id*3,yaw:PI,hp:100,ammo:30,reload:0,car:-1,seat:-1,shot:0,lastHurt:-50,down:0,revive:0,moving:0,_seq:-1};}
export function newGame(saved){
 const s={v:VERSION,time:0,elapsed:0,chapter:0,stage:0,active:false,complete:false,stageTime:0,progress:0,started:false,wave:0,checkpoint:0,cash:1200,engine:0,armor:0,wanted:0,heatAt:-50,kills:0,caches:[],jobsDone:[],players:[player(0)],cars:[],enemies:[],events:[],eid:0,message:'BAYLINEへようこそ。Jで仕事を選択。',messageId:0,side:null};
 s.cars.push({id:0,x:-315,z:430,yaw:PI,speed:0,hp:100,driver:-1,passenger:-1,type:0,paint:0,traffic:false,police:false,route:[],wp:0});
 s.cars.push({id:1,x:-315,z:413,yaw:PI,speed:0,hp:100,driver:-1,passenger:-1,type:2,paint:1,traffic:false,police:false,route:[],wp:0});
 const random=rng(2315);
 for(let i=0;i<20;i++){
  const ix=Math.floor(random()*6),iz=Math.floor(random()*6),x=-480+160*ix,z=-480+160*iz;
  const route=[{x:x+5.5,z:z+5.5},{x:x+5.5,z:z+154.5},{x:x+154.5,z:z+154.5},{x:x+154.5,z:z+5.5}];
  const j=i%4,a=route[j],b=route[(j+1)%4],t=.12+random()*.7;
  s.cars.push({id:s.cars.length,x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,yaw:Math.atan2(b.x-a.x,b.z-a.z),speed:8+random()*4,hp:100,driver:-1,passenger:-1,type:i%4,paint:i%7,traffic:true,police:false,route,wp:(j+1)%4});
 }
 for(let i=0;i<3;i++)s.cars.push({id:s.cars.length,x:ROADS[i+2]+5.5,z:-470,yaw:0,speed:0,hp:100,driver:-1,passenger:-1,type:4,paint:2,traffic:false,police:true,route:[],wp:0});
 if(saved&&saved.v===VERSION){s.chapter=clamp(Math.floor(finite(saved.chapter)),0,12);s.stage=clamp(Math.floor(finite(saved.stage)),0,(CHAPTERS[s.chapter]?.steps.length||1)-1);s.complete=s.chapter>=12;s.active=!!saved.active&&!s.complete;s.cash=clamp(finite(saved.cash,1200),0,1e7);s.engine=clamp(Math.floor(finite(saved.engine)),0,3);s.armor=clamp(Math.floor(finite(saved.armor)),0,3);s.elapsed=clamp(finite(saved.elapsed),0,1e7);s.caches=[...new Set((Array.isArray(saved.caches)?saved.caches:[]).filter(n=>Number.isInteger(n)&&n>=0&&n<24))];s.jobsDone=[...new Set((Array.isArray(saved.jobsDone)?saved.jobsDone:[]).filter(n=>Number.isInteger(n)&&n>=0&&n<6))];s.players[0].hp=100+s.armor*20;}
 return s;
}
export function saveGame(s){return{v:VERSION,chapter:s.chapter,stage:s.stage,active:s.active,cash:s.cash,engine:s.engine,armor:s.armor,caches:[...s.caches],jobsDone:[...s.jobsDone],elapsed:s.elapsed};}
export function addPlayer(s){if(s.players.length>=2)return false;s.players.push(player(1));const a=s.players[0],b=s.players[1];b.x=a.x+3;b.z=a.z;b.hp=100+s.armor*20;if(blocked(b.x,b.z)){b.x=a.x;b.z=a.z+3;}return true;}
export function removeGuest(s){const p=s.players[1];if(p)exitCar(s,p);s.players=s.players.slice(0,1);}
export function notify(s,text){s.message=text;s.messageId++;}
export function event(s,type,x,z,data={}){s.events.push({id:++s.eid,t:s.time,type,x,z,...data});if(s.events.length>16)s.events.shift();}
export function currentStep(s){if(s.side){if(s.side.kind==='race')return step('race','garage','フリー・レース：チェックポイントを通過',{circuit:s.side.index,limit:300});const j=JOBS[s.side.index];return s.side.phase===0?step('interact',j.from,'荷物を受け取る'):step('drive',j.to,'制限時間内に荷物を届ける');}return s.active?CHAPTERS[s.chapter]?.steps[s.stage]:null;}
export function target(s){const q=currentStep(s);if(!q)return null;if(q.type==='race')return CIRCUITS[q.circuit][Math.min(s.checkpoint,CIRCUITS[q.circuit].length-1)];return POI[q.place];}
export function resetStage(s){s.enemies=[];s.stageTime=0;s.progress=0;s.started=false;s.wave=0;s.checkpoint=0;}
export function startMission(s){if(s.complete){notify(s,'メインストーリーは完結。街の仕事と探索を続けられます。');return;}s.side=null;s.active=true;resetStage(s);notify(s,CHAPTERS[s.chapter].intro);}
function completeStep(s){
 if(s.side){if(s.side.kind==='delivery'&&s.side.phase===0){s.side.phase=1;resetStage(s);s.started=true;notify(s,'荷物を受け取った。目的地へ急ごう。');return;}const reward=s.side.kind==='race'?900:JOBS[s.side.index].reward;s.cash+=reward;if(s.side.kind==='delivery'&&!s.jobsDone.includes(s.side.index))s.jobsDone.push(s.side.index);s.side=null;s.active=false;resetStage(s);notify(s,`依頼達成  +$${reward.toLocaleString()}。Jから次の仕事を選択。`);event(s,'success',s.players[0].x,s.players[0].z);return;}
 const ch=CHAPTERS[s.chapter];if(!ch)return;s.stage++;resetStage(s);event(s,'success',s.players[0].x,s.players[0].z);
 if(s.stage>=ch.steps.length){s.cash+=ch.reward;s.chapter++;s.stage=0;s.active=false;s.wanted=Math.min(s.wanted,.8);for(const p of s.players){p.hp=100+s.armor*20;p.ammo=30;}s.complete=s.chapter>=CHAPTERS.length;notify(s,s.complete?'AFTERLIGHT — 証拠は届いた。この街の続きは、あなたたちのもの。':`CHAPTER COMPLETE  +$${ch.reward.toLocaleString()}。Jで次の章へ。`);}else notify(s,currentStep(s).text);
}
function exitCar(s,p){const c=s.cars[p.car];if(!c){p.car=-1;p.seat=-1;return;}let x=c.x+Math.cos(c.yaw)*3,z=c.z-Math.sin(c.yaw)*3;if(blocked(x,z,.55)){x=c.x-Math.cos(c.yaw)*3;z=c.z+Math.sin(c.yaw)*3;}if(blocked(x,z,.55)){const q=nearestRoad(c);x=q.x;z=q.z;}if(c.driver===p.id)c.driver=-1;if(c.passenger===p.id)c.passenger=-1;c.traffic=false;p.x=x;p.z=z;p.yaw=c.yaw;p.car=-1;p.seat=-1;}
function useCar(s,p){if(p.car>=0){const c=s.cars[p.car];if(Math.abs(c.speed)>8){notify(s,'安全のため、速度を落としてから降りてください。');return;}exitCar(s,p);return;}const list=s.cars.filter(c=>distance(c,p)<9&&Math.abs(c.speed)<12&&c.hp>0).sort((a,b)=>distance(a,p)-distance(b,p));for(const c of list){if(c.driver<0){c.driver=p.id;p.car=c.id;p.seat=0;c.traffic=false;notify(s,'乗車。W/S 加減速・A/D ハンドル・Space ブレーキ・F 降車');return;}if(c.passenger<0){c.passenger=p.id;p.car=c.id;p.seat=1;notify(s,'助手席に同乗。射撃で相棒を援護できます。');return;}}notify(s,'近くの停車中の車に近づいて F。');}
function hurt(s,p,amount){if(p.hp<=0)return;p.hp=Math.max(0,p.hp-amount);p.lastHurt=s.time;event(s,'hurt',p.x,p.z,{who:p.id});if(p.hp<=0){if(p.car>=0)exitCar(s,p);p.down=0;notify(s,s.players.length>1?'相棒がダウン。近づいて E 長押しで救助。':'倒れた。チェックポイントから復帰します。');}}
function spawnEnemies(s,pos,count){for(let i=0;i<count;i++){if(s.enemies.filter(e=>e.hp>0).length>=10)break;const n=s.eid+s.enemies.length+1;let x=pos.x+Math.sin(i*2.399+n)*24,z=pos.z+Math.cos(i*2.399+n)*24;if(blocked(x,z,.5)){const q=nearestRoad({x,z});x=q.x+((i%2)*2-1)*5;z=q.z;}s.enemies.push({id:`e${s.time.toFixed(3)}-${n}-${i}`,x,z,yaw:0,hp:70,shot:.8+i*.15,moving:0});}}
function shoot(s,p,input){if(p.hp<=0||p.reload>0||p.shot>0)return;if(p.ammo<=0){p.reload=1.35;return;}p.ammo--;p.shot=.17;s.wanted=clamp(s.wanted+.018,0,5);s.heatAt=s.time;let found=null,best=120;for(const e of s.enemies){if(e.hp<=0)continue;const d=distance(p,e),a=Math.atan2(e.x-p.x,e.z-p.z);if(d<95&&Math.abs(angle(a-input.yaw))<.26&&sight(p,e)&&d<best){found=e;best=d;}}
 if(found){found.hp=Math.max(0,found.hp-28);if(!found.hp){s.kills++;s.cash+=30;event(s,'down',found.x,found.z);}}
 event(s,'shot',p.x,p.z,{yaw:found?Math.atan2(found.x-p.x,found.z-p.z):input.yaw,range:found?best:65,who:p.id});
}
function perform(s,p,i){
 if(i.seq<=p._seq)return;p._seq=i.seq;if(p.hp<=0)return;
 switch(i.action){
 case 'enter':useCar(s,p);break;
 case 'reload':if(p.ammo<30&&p.reload<=0)p.reload=1.35;break;
 case 'start':if(!s.active&&!s.side)startMission(s);break;
 case 'retry':if(s.active||s.side){resetStage(s);notify(s,'現在の目標を再開しました。');}break;
 case 'rescue':{if(p.car>=0)exitCar(s,p);const q=nearestRoad(p);p.x=q.x;p.z=q.z;p.hp=Math.max(p.hp,35);notify(s,'最寄りの道路へ復帰しました。');break;}
 case 'repair':case 'engine':case 'armor':{
  if(distance(p,POI.garage)>28){notify(s,'アップグレードは南のガレージで行えます。');break;}
  const type=i.action,cost=type==='repair'?100:type==='engine'?700*(s.engine+1):600*(s.armor+1);
  if((type==='engine'&&s.engine>=3)||(type==='armor'&&s.armor>=3)){notify(s,'すでに最大レベルです。');break;}
  if(s.cash<cost){notify(s,'資金が足りません。街の依頼で稼げます。');break;}s.cash-=cost;
  if(type==='engine')s.engine++;if(type==='armor')s.armor++;for(const u of s.players){u.hp=100+s.armor*20;u.ammo=30;}for(const c of s.cars)if(distance(c,POI.garage)<35)c.hp=100;notify(s,`ガレージ作業完了  −$${cost}`);break;}
 case 'job':if(s.active||s.side){notify(s,'進行中の仕事を終えるか、中断してください。');break;}s.side={kind:'delivery',index:i.choice%JOBS.length,phase:0};resetStage(s);notify(s,`${JOBS[s.side.index].name}：まず荷物を受け取ろう。`);break;
 case 'race':if(s.active||s.side)break;s.side={kind:'race',index:i.choice%CIRCUITS.length};resetStage(s);notify(s,'出発地点で車に乗るとレース開始。');break;
 case 'cancel':s.active=false;s.side=null;resetStage(s);notify(s,'仕事を中断。メインは同じ章の現在目標から再開できます。');break;
 }
}
function movePerson(p,dx,dz){if(!blocked(p.x+dx,p.z,.5))p.x+=dx;if(!blocked(p.x,p.z+dz,.5))p.z+=dz;}
function driveCar(s,c,throttle,steer,brake,dt){
 const max=c.type===2?29:c.type===3?26:35;const acc=13+s.engine*2.5;
 if(c.hp<=0){c.speed*=Math.exp(-5*dt);return;}
 c.speed+=throttle*acc*dt;
 c.speed*=Math.exp(-(brake?3.5:Math.abs(throttle)<.02?.45:.06)*dt);
 c.speed=clamp(c.speed,-11,(max+s.engine*4)*(c.hp<30?.65:1));
 c.yaw=angle(c.yaw-steer*clamp(Math.abs(c.speed)/9,0,1.5)*Math.sign(c.speed)*1.25*dt);
 const x=c.x+Math.sin(c.yaw)*c.speed*dt,z=c.z+Math.cos(c.yaw)*c.speed*dt;
 if(blocked(x,z,1.45)){if(Math.abs(c.speed)>5){c.hp=Math.max(0,c.hp-Math.abs(c.speed)*.32);event(s,'crash',c.x,c.z);s.wanted=clamp(s.wanted+.12,0,5);s.heatAt=s.time;}c.speed*=-.25;}else{c.x=x;c.z=z;}
}
function aiCar(s,c,dt){
 if(c.driver>=0||c.hp<=0)return;
 if(c.police){if(s.wanted<.8){c.speed*=Math.exp(-2*dt);return;}let p=s.players.filter(p=>p.hp>0).sort((a,b)=>distance(a,c)-distance(b,c))[0];if(!p)return;
 const route=gps(c,p);let q=route.find((q,i)=>i>0&&distance(q,c)>12)||p;
 if(distance(c,p)<65&&sight(c,p))q=p;
 const aim=Math.atan2(q.x-c.x,q.z-c.z),err=angle(aim-c.yaw);c.yaw=angle(c.yaw+clamp(err,-2*dt,2*dt));const speed=distance(c,p)<9?0:Math.abs(err)>1?7:20+s.wanted;
 c.speed+=(speed-c.speed)*Math.min(1,dt*3);const x=c.x+Math.sin(c.yaw)*c.speed*dt,z=c.z+Math.cos(c.yaw)*c.speed*dt;if(!blocked(x,z,1.4)){c.x=x;c.z=z;}else{c.speed=0;c.yaw+=dt*2;}
 if(distance(c,p)<14&&s.time-p.lastHurt>1.2&&sight(c,p))hurt(s,p,5);return;}
 if(!c.traffic){c.speed*=Math.exp(-3*dt);if(Math.abs(c.speed)>.05){const x=c.x+Math.sin(c.yaw)*c.speed*dt,z=c.z+Math.cos(c.yaw)*c.speed*dt;if(!blocked(x,z,1.45)){c.x=x;c.z=z;}}return;}
 const q=c.route[c.wp];if(distance(c,q)<7)c.wp=(c.wp+1)%c.route.length;
 const t=c.route[c.wp],aim=Math.atan2(t.x-c.x,t.z-c.z),err=angle(aim-c.yaw);c.yaw=angle(c.yaw+clamp(err,-2.7*dt,2.7*dt));const desired=Math.abs(err)>.6?6:11+c.id%4;c.speed+=(desired-c.speed)*Math.min(1,dt*2);
 const x=c.x+Math.sin(c.yaw)*c.speed*dt,z=c.z+Math.cos(c.yaw)*c.speed*dt;if(!blocked(x,z,1.4)){c.x=x;c.z=z;}else{c.speed=0;const n=nearestRoad(c);c.x+=(n.x-c.x)*dt;c.z+=(n.z-c.z)*dt;c.yaw=aim;}
}
function stageUpdate(s,inputs,dt){
 const q=currentStep(s),t=target(s);if(!q||!t)return;const near=s.players.filter(p=>p.hp>0&&distance(p,t)<(q.type==='combat'||q.type==='defend'?70:18));
 if(q.type==='escape'&&!s.started){s.started=true;s.stageTime=0;s.wanted=Math.max(s.wanted,2);s.heatAt=s.time;}
 if(q.type==='escape'&&!s.started){s.started=true;s.stageTime=0;s.wanted=Math.max(s.wanted,2);s.heatAt=s.time;}
 if(!s.started){if(!near.length)return;if(q.type==='race'&&!near.some(p=>p.car>=0))return;s.started=true;s.stageTime=0;if(q.type==='combat'||q.type==='defend')spawnEnemies(s,t,q.count||4);if(q.type==='escape'){s.wanted=Math.max(s.wanted,2);s.heatAt=s.time;}if(q.heat){s.wanted=Math.max(s.wanted,q.heat);s.heatAt=s.time;}}
 s.stageTime+=dt;
 if(q.type==='drive'){if(near.some(p=>p.car>=0)){completeStep(s);return;}}
 if(q.type==='interact'||q.type==='hack'){
  const use=near.filter(p=>p.car<0&&inputs[p.id]?.interact&&distance(p,t)<13);
  if(use.length)s.progress+=dt*(use.length===2?1.55:1);
  if(s.progress>=(q.duration||1)){completeStep(s);return;}
 }
 if(q.type==='combat'&&s.enemies.every(e=>e.hp<=0)){completeStep(s);return;}
 if(q.type==='defend'){
  if(near.length)s.progress+=dt;
  const wave=Math.floor(s.progress/25);if(wave>s.wave&&s.progress<q.duration-15){s.wave=wave;spawnEnemies(s,t,3+s.players.length);}
  if(s.progress>=q.duration&&s.enemies.every(e=>e.hp<=0)){completeStep(s);return;}
 }
 if(q.type==='escape'){
  // Reaching a safe area on foot lets the crew lay low instead of an endless pursuit.
  if(near.some(p=>p.car<0&&p.moving<.2)){s.progress+=dt;s.wanted=Math.max(0,s.wanted-dt*.14);}
  if(near.length&&s.wanted<.2){completeStep(s);return;}
 }
 if(q.type==='race'){
  if(near.some(p=>p.car>=0)){s.checkpoint++;event(s,'checkpoint',t.x,t.z);if(s.checkpoint>=CIRCUITS[q.circuit].length){completeStep(s);return;}}
  if(s.stageTime>q.limit){resetStage(s);notify(s,'タイムアップ。出発地点から何度でも再挑戦できます。');}
 }
 if(s.side?.kind==='delivery'&&s.side.phase===1&&s.stageTime>JOBS[s.side.index].limit){s.side.phase=0;resetStage(s);notify(s,'配達時間を超過。集荷地点から再挑戦できます。');}
}
export function tick(s,rawInputs,delta){
 const dt=clamp(finite(delta),0,.05);if(!dt)return;const inputs=s.players.map((_,i)=>cleanInput(rawInputs[i]));s.time+=dt;s.elapsed+=dt;
 for(const p of s.players){const i=inputs[p.id];p.shot=Math.max(0,p.shot-dt);if(p.reload>0){p.reload=Math.max(0,p.reload-dt);if(p.reload===0)p.ammo=30;}
  if(p.hp<=0){p.down+=dt;const helper=s.players.find(u=>u.id!==p.id&&u.hp>0&&u.car<0&&distance(u,p)<4&&inputs[u.id]?.interact);if(helper){p.revive+=dt;if(p.revive>=3){p.hp=60;p.down=0;p.revive=0;notify(s,'相棒を救助した。');}}else p.revive=0;continue;}
  perform(s,p,i);if(p.car<0){const speed=i.run?8:4.6,dx=(Math.sin(i.yaw)*i.y-Math.cos(i.yaw)*i.x)*speed*dt,dz=(Math.cos(i.yaw)*i.y+Math.sin(i.yaw)*i.x)*speed*dt;movePerson(p,dx,dz);p.moving=Math.hypot(dx,dz)/dt;if(p.moving>.1)p.yaw=Math.atan2(dx,dz);if(i.fire)p.yaw=i.yaw;}else p.moving=Math.abs(s.cars[p.car]?.speed||0);
  if(i.fire)shoot(s,p,i);
  if(s.time-p.lastHurt>12)p.hp=Math.min(100+s.armor*20,p.hp+dt*4);
 }
 for(const c of s.cars){if(c.driver>=0){const i=inputs[c.driver];if(i)driveCar(s,c,i.y,i.x,i.brake,dt);}else aiCar(s,c,dt);}
 // Resolve nearby player vehicle impacts once; no frame-dependent explosion of damage.
 for(const a of s.cars.filter(c=>c.driver>=0))for(const b of s.cars){if(a.id===b.id||b.id<a.id&&b.driver>=0)continue;const d=distance(a,b);if(d<3.2&&s.time-(a.hitAt||-10)>.8){const impact=Math.abs(a.speed-b.speed);a.hitAt=s.time;a.speed*=-.18;b.speed*=.5;if(impact>6){a.hp=Math.max(0,a.hp-impact*.28);b.hp=Math.max(0,b.hp-impact*.32);s.wanted=clamp(s.wanted+.35,0,5);s.heatAt=s.time;event(s,'crash',a.x,a.z);}}}
 for(const p of s.players){if(p.car>=0){const c=s.cars[p.car];p.x=c.x;p.z=c.z;p.yaw=c.yaw;if(c.hp<=0){exitCar(s,p);hurt(s,p,30);notify(s,'車が故障。別の車を探すか、ガレージで修理しよう。');}}}
 for(const e of s.enemies){if(e.hp<=0)continue;e.shot-=dt;const p=s.players.filter(p=>p.hp>0).sort((a,b)=>distance(e,a)-distance(e,b))[0];if(!p)continue;const d=distance(e,p);e.yaw=Math.atan2(p.x-e.x,p.z-e.z);e.moving=0;if(d>15&&d<120){const speed=2.4,dx=Math.sin(e.yaw)*speed*dt,dz=Math.cos(e.yaw)*speed*dt;movePerson(e,dx,dz);e.moving=speed;}if(d<62&&e.shot<=0&&sight(e,p)){e.shot=1.3+(s.players.length===1?.3:0);hurt(s,p,p.car>=0?2.5:5);event(s,'enemyshot',e.x,e.z,{yaw:e.yaw,range:d});}}
 if(s.players.every(p=>p.hp<=0)&&s.players.every(p=>p.down>3)){for(const p of s.players){Object.assign(p,player(p.id),{hp:100+s.armor*20,_seq:inputs[p.id].seq});}s.cars[0].x=-315;s.cars[0].z=430;s.cars[0].hp=100;s.cars[0].speed=0;s.cars[0].driver=-1;s.cars[0].passenger=-1;s.wanted=0;resetStage(s);notify(s,'ガレージで復帰。現在の目標からやり直せます。');}
 const policeClose=s.cars.some(c=>c.police&&c.driver<0&&s.players.some(p=>distance(c,p)<70&&sight(c,p)));
 if(!policeClose&&s.time-s.heatAt>8)s.wanted=Math.max(0,s.wanted-dt*.09);
 for(const c of CACHES){if(!s.caches.includes(c.id)&&s.players.some(p=>p.hp>0&&distance(p,c)<3)){s.caches.push(c.id);s.cash+=200;event(s,'success',c.x,c.z);notify(s,`隠しケース ${s.caches.length}/24  +$200`);}}
 stageUpdate(s,inputs,dt);
 s.events=s.events.filter(e=>s.time-e.t<2.5);
}
const round=n=>Math.round(n*100)/100;
export function snapshot(s){return{v:1,t:round(s.time),elapsed:round(s.elapsed),ch:s.chapter,st:s.stage,a:s.active,done:s.complete,tm:round(s.stageTime),p:round(s.progress),started:s.started,cp:s.checkpoint,cash:s.cash,en:s.engine,ar:s.armor,w:round(s.wanted),k:s.kills,ca:s.caches,jobs:s.jobsDone,side:s.side,msg:s.message,mi:s.messageId,players:s.players.map(p=>[p.id,round(p.x),round(p.z),round(p.yaw),round(p.hp),p.ammo,round(p.reload),p.car,p.seat,round(p.moving),round(p.revive)]),cars:s.cars.map(c=>[c.id,round(c.x),round(c.z),round(c.yaw),round(c.speed),round(c.hp),c.driver,c.passenger,c.type,c.paint,c.police?1:0]),enemies:s.enemies.filter(e=>e.hp>0).map(e=>[e.id,round(e.x),round(e.z),round(e.yaw),e.hp,round(e.moving)]),events:s.events.slice(-8)};}
export function readSnapshot(d){
 if(!d||d.v!==1||!Array.isArray(d.players)||d.players.length<1||d.players.length>2||!Array.isArray(d.cars)||d.cars.length!==25||!Array.isArray(d.enemies)||d.enemies.length>20)return null;
 if(![d.t,d.elapsed,d.ch,d.st,d.tm,d.p,d.cash,d.en,d.ar,d.w].every(Number.isFinite)||d.ch<0||d.ch>12||d.st<0||d.st>8)return null;
 const valid=(a,n)=>Array.isArray(a)&&a.length>=n&&a.slice(0,n).every(Number.isFinite);
 if(d.players.some(a=>!valid(a,11))||d.cars.some(a=>!valid(a,11))||d.enemies.some(a=>typeof a?.[0]!=='string'||!valid(a.slice(1),5)))return null;
 if(d.players.some(a=>Math.abs(a[1])>540||Math.abs(a[2])>540||a[7]<-1||a[7]>24))return null;
 if(d.side&&(!['race','delivery'].includes(d.side.kind)||!Number.isInteger(d.side.index)||d.side.index<0||d.side.index>5))return null;
 return{v:1,time:d.t,elapsed:d.elapsed,chapter:d.ch,stage:d.st,active:!!d.a,complete:!!d.done,stageTime:d.tm,progress:d.p,started:!!d.started,checkpoint:d.cp,cash:d.cash,engine:d.en,armor:d.ar,wanted:d.w,kills:d.k,caches:Array.isArray(d.ca)?d.ca:[],jobsDone:Array.isArray(d.jobs)?d.jobs:[],side:d.side||null,message:String(d.msg||'').slice(0,260),messageId:d.mi,players:d.players.map(a=>({id:a[0],x:a[1],z:a[2],yaw:a[3],hp:a[4],ammo:a[5],reload:a[6],car:a[7],seat:a[8],moving:a[9],revive:a[10]})),cars:d.cars.map(a=>({id:a[0],x:a[1],z:a[2],yaw:a[3],speed:a[4],hp:a[5],driver:a[6],passenger:a[7],type:a[8],paint:a[9],police:!!a[10]})),enemies:d.enemies.map(a=>({id:a[0],x:a[1],z:a[2],yaw:a[3],hp:a[4],moving:a[5]})),events:Array.isArray(d.events)?d.events.slice(-8):[]};
}
