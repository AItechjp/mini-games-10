import type {RoomData} from './types';

export const voteCount=(data:RoomData,scope:string,choice?:string)=>data.voteSummary
  .filter(v=>v.scope===scope&&(!choice||v.choice===choice))
  .reduce((total,v)=>total+v.count,0);
export const myVote=(data:RoomData,scope:string)=>data.myVotes.find(v=>v.scope===scope)?.choice;
export const scheduleChoice=(data:RoomData,scope:string,memberIndex:number)=>{
  const code=data.scheduleVotes[scope]?.[memberIndex];
  return code==='y'?'yes':code==='m'?'maybe':code==='n'?'no':undefined;
};
export function compactScheduleVotes(members:Array<{actor:string}>,rows:Array<{scope:string;actor:string;choice:string}>){
  const actors=new Map(members.map((m,index)=>[m.actor,index]));
  const matrices:Record<string,string[]|string>={};
  for(const row of rows){
    const index=actors.get(row.actor);if(index===undefined)continue;
    const values=(matrices[row.scope]??=Array(members.length).fill('-')) as string[];
    values[index]=row.choice==='yes'?'y':row.choice==='maybe'?'m':row.choice==='no'?'n':'-';
  }
  for(const scope of Object.keys(matrices))matrices[scope]=(matrices[scope] as string[]).join('');
  return matrices as Record<string,string>;
}
