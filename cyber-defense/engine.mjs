import {MISSIONS,DECKS,TWISTS,GOALS,LEVELS,SUPPORTS} from './missions.mjs';
export const clamp=(v,min=0,max=100)=>Math.max(min,Math.min(max,v));
export const getMission=id=>MISSIONS.find(m=>m.id===id)||MISSIONS[0];
export function createRun(id,mode='local',timed=true,seed=Date.now()){
 const m=getMission(id);return {version:1,id:m.id,mode,timed,seed,turn:0,phase:'choose',service:90,data:94,trust:88,threat:18+m.level*5+(m.boss?7:0),cp:LEVELS[m.level].cp,charge:0,combo:0,bestCombo:0,score:0,picks:[null,null],locked:[false,false],history:[],ultimate:false,paused:false,remaining:timed?LEVELS[m.level].seconds:0,epoch:seed,revision:0};
}
export function getStep(run){
 const m=getMission(run.id),d=DECKS[m.type],steps=[d.steps[0],d.steps[1],TWISTS[m.twist],d.steps[2],d.steps[3],GOALS[m.goal].final];
 const step=steps[clamp(run.turn,0,5)];const offset=(run.id*7+run.turn*5+Math.abs(run.seed%3))%3;
 const options=step.options.map((_,i)=>step.options[(i+offset)%3]);
 const pressure=run.turn>0?(run.threat>=65?'防衛線が崩れかけている。敵は複数の経路で追撃してきた。':run.combo>=2?'連携で敵の動きを絞り込んだ。こちらに主導権がある。':'敵はまだ潜んでいる。前の対応で残った経路を警戒しよう。'):m.opening;
 return {...step,options,pressure,supportClue:SUPPORTS.find(s=>s.id===step.support).hint};
}
export function selectChoice(state,side,value){
 if(state.phase!=='choose'||state.paused||![0,1].includes(side)||state.locked[side])return state;
 if(side===0){const op=getStep(state).options.find(o=>o.id===value);if(!op||op.cost>state.cp)return state;}
 else if(!SUPPORTS.some(s=>s.id===value))return state;
 return {...state,picks:state.picks.map((v,i)=>i===side?value:v),revision:state.revision+1};
}
export function lockChoice(state,side){
 if(state.phase!=='choose'||state.paused||![0,1].includes(side)||!state.picks[side])return state;
 return {...state,locked:state.locked.map((v,i)=>i===side?true:v),revision:state.revision+1};
}
export function activateLink(state){
 if(state.phase!=='choose'||state.paused||state.charge<100||state.ultimate)return state;
 return {...state,charge:0,service:clamp(state.service+13),data:clamp(state.data+13),trust:clamp(state.trust+13),threat:clamp(state.threat-18),cp:state.cp+3,ultimate:true,revision:state.revision+1};
}
export function resolveTurn(state,timeout=false){
 if(state.phase!=='choose'||state.paused||(!timeout&&!state.locked.every(Boolean)))return state;
 const n=structuredClone(state),m=getMission(n.id),step=getStep(n),choice=step.options.find(o=>o.id===n.picks[0]);
 const quality=choice&&n.locked[0]&&choice.cost<=n.cp?choice.quality:0;
 const support=n.locked[1]?n.picks[1]:null;
 const sync=quality>0&&support===choice?.support;
 const p=LEVELS[m.level].pressure+(m.boss?4:0)+(n.turn===2?3:0)+(state.threat>=65?4:0);
 let hit=(quality===2?3:quality===1?10:22)+Math.floor(m.level*1.5);
 let delta={service:-hit-2-(quality===2?2:0),data:-hit,trust:-Math.ceil(hit*.75),threat:quality===2?-15:quality===1?-3:17};
 delta.threat+=p;
 if(support==='scan')delta.data+=7;
 if(support==='seal')delta.threat-=8;
 if(support==='keep')delta.service+=10;
 if(support==='proof')delta.trust+=9;
 if(sync){delta.service+=6;delta.data+=5;delta.trust+=5;delta.threat-=6;n.combo++;n.charge=clamp(n.charge+35);}
 else {n.combo=0;n.charge=clamp(n.charge+(quality>0?14:5));}
 if(timeout&&(!n.locked[0]||!n.locked[1])){delta.threat+=8;delta.trust-=5;}
 if(n.turn===2&&!sync){delta[GOALS[m.goal].key]-=4+m.level*2;}
 const before={};for(const key of ['service','data','trust','threat']){before[key]=n[key];n[key]=clamp(n[key]+delta[key]);}
 n.cp=Math.max(0,n.cp-(choice&&n.locked[0]?choice.cost:0))+1;
 n.score+=quality*110+(sync?100+n.combo*25:0)+(n.ultimate?0:10);
 n.bestCombo=Math.max(n.bestCombo,n.combo);
 const label=sync?'連携成功':quality===2?'的確な対処':quality===1?'応急対応':'防衛線に損害';
 const summary=quality===2?'攻撃の要所を押さえた。':quality===1?'被害を抑えたが、調査と対策が残った。':'残された経路から被害が広がった。';
 n.history.push({turn:n.turn,label,quality,sync,action:choice&&n.locked[0]?choice.label:'対処を確定できなかった',support:SUPPORTS.find(s=>s.id===support)?.name||'支援なし',summary,lesson:step.lesson,delta:Object.fromEntries(Object.keys(before).map(k=>[k,n[k]-before[k]])),timeout,charge:n.charge});
 n.ultimate=false;n.revision++;n.phase='report';
 if(n.service<=0||n.data<=0||n.trust<=0||n.threat>=100){n.phase='result';n.won=false;n.cause=n.threat>=100?'敵の侵入率が100%に到達した。':'守るべき機能の一つが失われた。';}
 else if(n.turn===5){n.phase='result';n.won=n[GOALS[m.goal].key]>=m.floor;n.cause=n.won?GOALS[m.goal].ending:`防衛は継続できたが、${GOALS[m.goal].name}が目標の${m.floor}%に届かなかった。`;}
 return n;
}
export function nextTurn(state){
 if(state.phase!=='report')return state;
 return {...state,turn:state.turn+1,phase:'choose',picks:[null,null],locked:[false,false],remaining:state.timed?LEVELS[getMission(state.id).level].seconds:0,revision:state.revision+1};
}
export function rank(run){if(!run.won)return 'D';const avg=(run.service+run.data+run.trust)/3;return avg>=88&&run.bestCombo>=4?'S':avg>=70?'A':avg>=52?'B':'C';}
export function command(state,side,action,value){
 if(action==='pick')return selectChoice(state,side,value);
 if(action==='lock')return lockChoice(state,side);
 if(action==='link'&&side===1)return activateLink(state);
 return state;
}
export function validSnapshot(s){return !!s&&s.version===1&&Number.isInteger(s.id)&&s.id>=1&&s.id<=100&&Number.isInteger(s.turn)&&s.turn>=0&&s.turn<=5&&['choose','report','result'].includes(s.phase)&&['service','data','trust','threat','cp','charge','score','remaining','revision','epoch','seed','combo','bestCombo'].every(k=>Number.isFinite(s[k]))&&['service','data','trust','threat','charge'].every(k=>s[k]>=0&&s[k]<=100)&&Array.isArray(s.picks)&&s.picks.length===2&&s.picks.every(v=>v===null||typeof v==='string'&&v.length<20)&&Array.isArray(s.locked)&&s.locked.length===2&&s.locked.every(v=>typeof v==='boolean')&&Array.isArray(s.history)&&s.history.length<=6&&s.history.every(h=>h&&['連携成功','的確な対処','応急対応','防衛線に損害'].includes(h.label)&&[0,1,2].includes(h.quality)&&['service','data','trust','threat'].every(k=>Number.isFinite(h.delta?.[k]))&&['lesson','summary','action','support'].every(k=>typeof h[k]==='string'&&h[k].length<1000));}
