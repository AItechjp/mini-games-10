export const BOSSES = [
 {name:'グリッチ・ガーディアン',title:'01 / THE GATEKEEPER',hp:220,color:0xa58cfa},
 {name:'バグ・バーサーカー',title:'02 / FRACTURED CODE',hp:270,color:0xee8294},
 {name:'パラドックス・ナイト',title:'03 / LOGIC TRIAL',hp:330,color:0x6ca2ff},
 {name:'カオス・アーキビスト',title:'04 / LOST ARCHIVE',hp:390,color:0xf09b59},
 {name:'無知の王 アンノウン',title:'05 / THE UNKNOWN',hp:460,color:0xb088ff},
];
export const RULES={easy:{hp:320,seconds:0,boss:.78,cpu:.78},normal:{hp:240,seconds:30,boss:1,cpu:.72},hard:{hp:200,seconds:20,boss:1.18,cpu:.66}};
export function shuffle(a,random=Math.random){a=[...a];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function newRaid({difficulty='normal',roles=['striker','guard'],review=false}={}){const rule=RULES[difficulty]||RULES.normal;return{difficulty,roles,review,maxHp:rule.hp,hp:rule.hp,wave:0,bossMax:Math.round(BOSSES[0].hp*rule.boss),bossHp:Math.round(BOSSES[0].hp*rule.boss),round:0,waveRound:0,combo:0,maxCombo:0,charge:0,hints:2,guards:2,correct:[0,0],score:0,phase:'question',unison:false,guard:false,cleared:0};}
export function resolveRound(s,right){if(s.phase!=='question'||right.length!==2)return null;s.round++;s.waveRound++;const n=right.filter(Boolean).length;const dual=n===2;s.combo=dual?s.combo+1:0;s.maxCombo=Math.max(s.maxCombo,s.combo);right.forEach((v,i)=>{if(v)s.correct[i]++;});
 const attack=right.reduce((v,yes,i)=>v+(yes?32+(s.roles[i]==='striker'?12:0):0),0)+(dual?18+Math.min(5,s.combo)*5:0)+(s.unison?95:0);
 const enemySpecial=s.waveRound%3===0;const raw=n===2?0:n===1?20+s.wave*4:38+s.wave*6;const defense=s.roles.filter(x=>x==='guard').length*5;
 let hurt=Math.max(0,raw+(enemySpecial&&n<2?18:0)-defense);if(s.guard)hurt=Math.ceil(hurt*.3);
 const heal=right.reduce((v,yes,i)=>v+(yes&&s.roles[i]==='healer'?10:0),0)+(s.unison?25:0);
 const wasUnison=s.unison;s.bossHp=Math.max(0,s.bossHp-attack);if(s.bossHp===0)hurt=0;
 s.hp=Math.max(0,Math.min(s.maxHp,s.hp-hurt+heal));if(s.review&&s.hp===0)s.hp=s.maxHp;s.charge=Math.min(100,s.charge+(dual?25:n?8:0));s.score+=n*100+(dual?50+s.combo*10:0);s.guard=false;s.unison=false;
 const clear=s.bossHp===0;if(clear){s.cleared++;s.score+=300*(s.wave+1);}s.phase='explanation';
 return{right,attack,hurt,heal,dual,clear,enemySpecial,unison:wasUnison,lost:s.hp===0,won:clear&&s.wave===BOSSES.length-1};
}
export function nextRound(s){if(s.phase!=='explanation')return false;if(!s.hp||(!s.review&&s.cleared===BOSSES.length)){s.phase='result';return false;}if(s.bossHp===0){s.wave=s.review?(s.wave+1)%BOSSES.length:s.wave+1;s.bossMax=Math.round(BOSSES[s.wave].hp*RULES[s.difficulty].boss);s.bossHp=s.bossMax;s.waveRound=0;s.hp=Math.min(s.maxHp,s.hp+35);s.hints=2;s.guards=2;}s.phase='question';return true;}
export function useSkill(s,skill){if(s.phase!=='question')return false;if(skill==='hint'&&s.hints>0){s.hints--;return true;}if(skill==='guard'&&s.guards>0&&!s.guard){s.guards--;s.guard=true;return true;}if(skill==='unison'&&s.charge>=100&&!s.unison){s.charge=0;s.unison=true;return true;}return false;}
export function selectQuestions(bank,subject,category,wrongIds=null){return bank.filter(q=>(subject==='mix'||q.domain===subject)&&(category==='all'||q.category===category)&&(!wrongIds||wrongIds.includes(q.id)));}
