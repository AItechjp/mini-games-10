declare module 'opening_hours' {
 export default class OpeningHours {
  constructor(hours:string,place:unknown,options:unknown);
  getUnknown(date:Date):boolean;
  getComment(date:Date):string|undefined;
  getState(date:Date):boolean;
  getNextChange(from:Date,to:Date):Date|undefined;
 }
}
