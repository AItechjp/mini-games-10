export type Item={id:string;kind:string;body:Record<string,any>;author:string;name:string;created:number;updated:number;revision:number};
export type Member={actor:string;name:string;seen:number};
export type VoteSummary={scope:string;choice:string;count:number};
export type MyVote={scope:string;choice:string;updated:number};
export type RoomData={room:{id:string;tool:string;title:string;owner:string;created:number;updated:number;canvas_epoch:number;canvas_revision:number};canvasUndo?:{id:string;created:number}|null;clockOffset?:number;items:Item[];voteSummary:VoteSummary[];myVotes:MyVote[];scheduleVotes:Record<string,string>;members:Member[];me:string;now:number};
