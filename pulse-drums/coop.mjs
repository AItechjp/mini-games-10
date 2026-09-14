// Same-device cooperative charts. Preserve each attack and its original drum sound,
// while giving each player three dedicated inputs and an equal share of the music.
export const PLAYERS=[
  {label:'1P',color:'#56e5c2',keys:'D / F / Space'},
  {label:'2P',color:'#ffd27d',keys:'J / K / L'},
];
const FAMILIES=[0,1,2,1,2,0];
export function cooperativeChart(notes){
  const sorted=notes.map((n,index)=>({...n,sourceIndex:index})).sort((a,b)=>a.t-b.t||a.lane-b.lane);
  const counts=[0,0],output=[];let turn=0;
  for(let i=0;i<sorted.length;){
    let end=i+1;while(end<sorted.length&&Math.abs(sorted[end].t-sorted[i].t)<.00001)end++;
    const lead=counts[0]===counts[1]?turn:counts[0]<counts[1]?0:1;
    for(let j=i;j<end;j++){
      const note=sorted[j],player=(lead+j-i)%2,sourceLane=note.lane;
      output.push({...note,sourceLane,player,lane:player*3+FAMILIES[sourceLane],pair:end-i===2?i:null});counts[player]++;
    }
    turn=1-lead;i=end;
  }
  return output.sort((a,b)=>a.t-b.t||a.lane-b.lane);
}
export function createPlayerStats(notes){
  return PLAYERS.map((_,player)=>({total:notes.filter(n=>n.player===player).length,counts:{perfect:0,great:0,good:0,miss:0},weight:0,empty:0,combo:0,maxCombo:0}));
}
export function recordPlayer(stats,grade,weight){
  if(grade==='empty'){stats.empty++;stats.combo=0;return;}
  stats.counts[grade]++;stats.weight+=weight;
  if(grade==='miss')stats.combo=0;
  else{stats.combo++;stats.maxCombo=Math.max(stats.maxCombo,stats.combo);}
}
export function playerAccuracy(stats,complete=false){
  const count=complete?stats.total:Object.values(stats.counts).reduce((a,b)=>a+b,0);
  return count?Math.max(0,(stats.weight-stats.empty*.18)/count*100):0;
}
export function synchronizedPair(a,b){
  return !!a&&!!b&&a.player!==b.player&&['perfect','great'].includes(a.status)&&['perfect','great'].includes(b.status)&&Math.abs(a.delta-b.delta)<=.09;
}
