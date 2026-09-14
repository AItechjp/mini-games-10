export const GENRES = [
  {id:'jpop', label:'J-POP', mood:'いつもの気分を上げる'},
  {id:'chill', label:'Chill / Lo-fi', mood:'ゆっくり、ひと息'},
  {id:'electronic', label:'Electronic', mood:'ビートに乗りたい'},
  {id:'rock', label:'Rock', mood:'エネルギーをくれる'},
  {id:'cinematic', label:'Cinematic', mood:'物語の世界へ'},
  {id:'acoustic', label:'Acoustic', mood:'やさしい音に包まれる'},
];
export function makeQueue(tracks, {station='mix', favorites=false, likes=[], recent=[], current=null, failed=[]}={}, random=Math.random) {
  const liked=new Set(likes), blocked=new Set(failed);
  const affinity={};
  for(const t of tracks) if(liked.has(t.id)) affinity[t.genre]=(affinity[t.genre]||0)+1;
  const candidates=tracks.filter(t=>!blocked.has(t.id) && (!favorites||liked.has(t.id)) && (station==='mix'||t.genre===station));
  // A singleton favorite may repeat, but larger stations never repeat immediately.
  const available=candidates.filter(t=>t.id!==current || candidates.length===1);
  return available.map(t=>{
    const recency=recent.lastIndexOf(t.id);
    const historyPenalty=recency<0?0:25+recency;
    return {t,score:random()*5+Math.min(affinity[t.genre]||0,4)*1.5+(liked.has(t.id)?1:0)-historyPenalty};
  }).sort((a,b)=>b.score-a.score).map(x=>x.t);
}
