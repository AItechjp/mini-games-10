import OpeningHours from 'opening_hours';
import {holidays,holidayYears} from './ramen-data';

export type LocalKind='supermarkets'|'saunas'|'sento'|'fishmongers';
export type LocalStore={id:string;name:string;prefecture:string;city:string;address:string;lat?:number;lon?:number;categories:LocalKind[];hours:string;hoursText?:string;phone:string;website:string;sourceUrl:string;sourceName:string;sourceType:'official'|'osm'|'directory'|'registry';checkedAt:string;access?:string;note?:string;scope?:string;exceptions?:Record<string,string>;otherSources?:{name:string;url:string}[]};
export type LocalStatus={state:'open'|'closed'|'unknown';reason?:string;next?:string};
export type LocalSnapshot={updatedAt:string;stores:LocalStore[];sources:{name:string;url:string;count:number;complete:boolean;note:string}[];coverageNote:string};
const cache=new Map<string,OpeningHours|null>();
const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function expandHolidays(hours:string,year:number):string|null{
 if(!/\bPH\b/.test(hours))return hours;
 if(!holidayYears.includes(year))return null;
 const result:string[]=[];
 for(const rule of hours.split(';').map(x=>x.trim())){
  if(!/\bPH\b/.test(rule)){result.push(rule);continue;}
  const m=rule.match(/^((?:Mo|Tu|We|Th|Fr|Sa|Su|PH)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?(?:,(?:Mo|Tu|We|Th|Fr|Sa|Su|PH)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*)\s+(.+)$/);
  if(!m)return null;
  const weekdays=m[1].split(',').filter(x=>x!=='PH').join(',');
  if(weekdays)result.push(weekdays+' '+m[2]);
  for(const date of holidays){const [y,mn,d]=date.split('-');result.push(`${y} ${months[Number(mn)-1]} ${d} ${m[2]}`);}
 }
 return result.join('; ');
}
export function localStatus(store:LocalStore,now:number):LocalStatus{
 const unknown=(reason:string):LocalStatus=>({state:'unknown',reason});
 if(!Number.isFinite(now))return unknown('現在時刻を取得できません');
 if(!store.hours)return unknown('営業時間は未確認');
 if(['private','no','members','customers'].includes(store.access??''))return unknown('予約・宿泊などの利用条件を確認');
 if(!Number.isFinite(Date.parse(store.checkedAt)))return unknown('情報の取得日を確認');
 if(now-Date.parse(store.checkedAt)>90*86400000)return unknown('情報の取得から90日経過。最新情報を確認');
 if(/sunrise|sunset|dawn|dusk|\bSH\b/i.test(store.hours))return unknown('季節や休暇に応じた営業を確認');
 const jst=new Date(now+9*3600000);
 // Give the parser Japan's calendar fields even when the device is overseas.
 const wall=new Date(jst.getUTCFullYear(),jst.getUTCMonth(),jst.getUTCDate(),jst.getUTCHours(),jst.getUTCMinutes(),jst.getUTCSeconds());
 if(wall.getHours()!==jst.getUTCHours()||wall.getDate()!==jst.getUTCDate())return unknown('時差の影響により自動判定できません');
 let hours=store.hours;
 for(const [day,value] of Object.entries(store.exceptions??{})){const [y,m,d]=day.split('-');hours+=`; ${y} ${months[Number(m)-1]} ${d} ${value}`;}
 const expression=expandHolidays(hours,jst.getUTCFullYear());
 if(!expression)return unknown('祝日営業時間は要確認');
 const key=expression+'|'+store.prefecture;
 if(!cache.has(key)){try{cache.set(key,new OpeningHours(expression,{lat:store.lat??35.2,lon:store.lon??136.9,address:{country_code:'jp',state:store.prefecture}},{mode:0,locale:'ja',warnings_severity:4}));}catch{cache.set(key,null);}}
 const parser=cache.get(key);
 if(!parser)return unknown('営業時間の自動判定に未対応');
 try{
  if(parser.getUnknown(wall))return unknown(parser.getComment(wall)||'当日の営業を確認');
  const state=parser.getState(wall)?'open':'closed';
  return {state};
 }catch{return unknown('当日の営業を確認');}
}

export function readableHours(value:string){
 if(!value)return '営業時間は未確認';
 if(value==='24/7')return '24時間';
 return value.replace(/Mo|Tu|We|Th|Fr|Sa|Su|PH|off/g,m=>({Mo:'月',Tu:'火',We:'水',Th:'木',Fr:'金',Sa:'土',Su:'日',PH:'祝',off:'休業'}[m]!)).replaceAll(';',' ／ ').replaceAll('00:00-24:00','24時間');
}
