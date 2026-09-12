import OpeningHours from 'opening_hours';
import type {SaunaFacility} from './sauna-types';

export type SaunaStatus = {id:string; state:'open'|'closed'|'unknown'; nextChange?:number; reason?:string};
const parsers = new Map<string, OpeningHours | null>();
const JST = 9*60*60*1000;
// Cabinet Office 2026/2027 calendar, including substitute and citizens' holidays.
// https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html (checked 2026-09-12)
const holidayDates=[
  '2026-01-01','2026-01-12','2026-02-11','2026-02-23','2026-03-20','2026-04-29',
  '2026-05-03','2026-05-04','2026-05-05','2026-05-06','2026-07-20','2026-08-11',
  '2026-09-21','2026-09-22','2026-09-23','2026-10-12','2026-11-03','2026-11-23',
  '2027-01-01','2027-01-11','2027-02-11','2027-02-23','2027-03-21','2027-03-22','2027-04-29',
  '2027-05-03','2027-05-04','2027-05-05','2027-07-19','2027-08-11','2027-09-20',
  '2027-09-23','2027-10-11','2027-11-03','2027-11-23',
];
const monthNames=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function holidayExpression(hours:string,year:number):string|null {
  if(!/\bPH\b/.test(hours))return hours;
  if(![2026,2027].includes(year))return null;
  const expanded:string[]=[];
  for(const rule of hours.split(';').map(x=>x.trim())) {
    if(!/\bPH\b/.test(rule)){expanded.push(rule);continue;}
    // Expand simple weekday/holiday unions into exact official calendar dates.
    // Complex PH offsets/intersections stay unknown instead of being guessed.
    const match=rule.match(/^((?:Mo|Tu|We|Th|Fr|Sa|Su|PH)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?(?:,(?:Mo|Tu|We|Th|Fr|Sa|Su|PH)(?:-(?:Mo|Tu|We|Th|Fr|Sa|Su))?)*)\s+(.+)$/);
    if(!match)return null;
    const days=match[1].split(',').filter(x=>x!=='PH').join(',');
    if(days)expanded.push(days+' '+match[2]);
    for(const date of holidayDates){const [y,m,d]=date.split('-');expanded.push(`${y} ${monthNames[Number(m)-1]} ${d} ${match[2]}`);}
  }
  return expanded.join('; ');
}

// Server only. Cloudflare Workers use UTC. No browser timezone participates in
// the calculation; the opening_hours parser receives Japan's wall-clock time.
export function saunaStatus(facility:SaunaFacility, now:number):SaunaStatus {
  const unknown=(reason:string):SaunaStatus=>({id:facility.id,state:'unknown',reason});
  if(!Number.isFinite(now)) return unknown('時刻を確認できません');
  if(!facility.hours) return unknown('営業時間が未登録');
  if(['private','no'].includes(facility.access)) return unknown('一般利用の可否・営業時間を要確認');
  if(/sunrise|sunset|dawn|dusk|\bSH\b/i.test(facility.hours)) return unknown('季節・学校休暇に応じた営業時間を要確認');
  const local = new Date(now+JST);
  if(local.getTimezoneOffset()!==0) return unknown('営業時刻の判定環境を確認中');
  const expression=holidayExpression(facility.hours,local.getUTCFullYear());
  if(!expression)return unknown('この日の祝日営業時間を要確認');
  const key=[expression,facility.prefecture].join('|');
  if(!parsers.has(key)) {
    try {
      parsers.set(key,new OpeningHours(expression,{lat:facility.lat,lon:facility.lon,address:{country_code:'jp',state:facility.prefecture}},{mode:0,tag_key:'opening_hours',map_value:false,warnings_severity:4,locale:'ja'}));
    } catch {parsers.set(key,null);}
  }
  const parser=parsers.get(key);
  if(!parser) return unknown('登録された営業時間を自動判定できません');
  try {
    if(parser.getUnknown(local)) return unknown(parser.getComment(local)||'当日の営業を要確認');
    const state=parser.getState(local)?'open':'closed';
    const next=parser.getNextChange(local,new Date(local.getTime()+48*60*60*1000));
    const changesToKnownState=next&&(!/\bPH\b/.test(facility.hours)||[2026,2027].includes(next.getUTCFullYear()))&&!parser.getUnknown(next)&&parser.getState(next)!==(state==='open');
    return {id:facility.id,state,...(next&&changesToKnownState?{nextChange:next.getTime()-JST}:{})};
  } catch {return unknown('当日の営業時間を要確認');}
}

export function saunaStatuses(facilities:SaunaFacility[],now:number) {
  return facilities.map(facility=>saunaStatus(facility,now));
}
