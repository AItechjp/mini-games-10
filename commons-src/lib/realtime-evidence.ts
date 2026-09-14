import {cleanText} from './openings';
import {localStatus,readableHours,type LocalStore} from './local-hours';
export type Target={id:string;name:string;prefecture:string;city:string;address:string;phone:string;url:string;kinds:string[];sourceName:string;scope:string};
export type Evidence={id:string;url:string;checkedAt:string;expiresAt:string;ok:boolean;reason?:string;hours?:string;hoursText?:string;method?:string;scope?:string;notice?:string;exceptions?:Record<string,string>;lastEntry?:number;lastEntryBeforeClose?:number;hash?:string};
export type SourceCheck={url:string;site:string;checkedAt:string;ok:boolean;httpStatus?:number;records:number;reason?:string};
export type EvidenceSnapshot={version:number;updatedAt:string|null;evidence:Evidence[];sources:SourceCheck[];cursor:number;refreshing?:boolean;error?:string};
export const maxAge=2*60*60*1000;
export const emptySnapshot:EvidenceSnapshot={version:1,updatedAt:null,evidence:[],sources:[],cursor:0};
const norm=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/[\s・･「」『』()（）－-]/g,'');
export function siteName(url:string){const host=new URL(url).hostname.replace(/^www\./,'');const p=host.split('.');return p.slice(/\.(co|or|ne|ac|go)\.jp$/.test(host)?-3:-2).join('.')}
function objects(value:unknown):Record<string,any>[]{if(Array.isArray(value))return value.flatMap(objects);if(value&&typeof value==='object'){const v=value as Record<string,any>;return [v,...Object.values(v).flatMap(objects)]}return []}
const days:Record<string,string>={Monday:'Mo',Tuesday:'Tu',Wednesday:'We',Thursday:'Th',Friday:'Fr',Saturday:'Sa',Sunday:'Su',PublicHolidays:'PH'};
export function structuredHours(html:string,target:Target):string|null{
 const candidates:string[]=[];
 for(const match of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)){
  let nodes:Record<string,any>[];try{nodes=objects(JSON.parse(match[1]))}catch{continue}
  for(const node of nodes){
   if(typeof node.name!=='string'||!norm(node.name).includes(norm(target.name).replace(/^スーパーマーケット/,'').replace(/^アオキスーパー|^カネスエ|^フィール|^業務スーパー/,'')))continue;
   const specs=Array.isArray(node.openingHoursSpecification)?node.openingHoursSpecification:node.openingHoursSpecification?[node.openingHoursSpecification]:[];
   const rules:string[]=[];let invalid=false;
   for(const s of specs){
    if(s.validFrom||s.validThrough){invalid=true;break}
    if(!/^\d{2}:\d{2}(?::00)?$/.test(s.opens??'')||!/^\d{2}:\d{2}(?::00)?$/.test(s.closes??'')){invalid=true;break}
    const ds=(Array.isArray(s.dayOfWeek)?s.dayOfWeek:[s.dayOfWeek]).map((d:unknown)=>typeof d==='string'?days[d.split('/').pop()!]:null);
    if(!ds.length||ds.some((d:unknown)=>!d)){invalid=true;break}
    rules.push(ds.join(',')+' '+(s.opens===s.closes?'off':s.opens.slice(0,5)+'-'+s.closes.slice(0,5)));
   }
   if(!invalid&&rules.length)candidates.push(rules.join('; '));
  }
 }
 return new Set(candidates).size===1?candidates[0]:null;
}
export function visibleText(html:string){return cleanText(html.replace(/<!--[\s\S]*?-->/g,'').replace(/<head\b[^>]*>[\s\S]*?<\/head>/gi,'').replace(/<(nav|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi,'')).normalize('NFKC')}
function clock(h:string,m='0',night=''){let hour=Number(h);if((/深夜|翌/.test(night))&&hour<12)hour+=24;return String(hour).padStart(2,'0')+':'+String(Number(m)).padStart(2,'0')}
// Fail closed on multiple schedules, monthly closures, booking-only hours or mixed venue pages.
export function textHours(text:string,target:Target):{hours:string;hoursText:string;lastEntry?:number}|null{
 const normalized=norm(text);const name=norm(target.name).replace(/^スーパーマーケット/,'').replace(/^アオキスーパー|^カネスエ|^フィール|^業務スーパー/,'');
 if(!name||!normalized.includes(name))return null;
 const chunks=[...text.matchAll(/(?=(?:営業時間|営業日時|営業時間帯|入館)\s*[:：/]?\s*([^。]{0,200}))/g)].map(m=>m[1]);
 const schedules=new Map<string,{hours:string;hoursText:string;lastEntry?:number}>();
 for(const chunk of chunks){
  const m=chunk.match(/^(?:Opening Hours\s*)?(?:(?:毎日|全日|ご入浴)\s*)?(?:朝\s*|午前\s*|AM\s*)?(\d{1,2})(?:[:時](\d{1,2})?分?)?\s*[~〜～－–―-]\s*(深夜|翌日?|午後|PM)?\s*(\d{1,2})(?:[:時](\d{1,2})?分?)?/i);
  if(!m)continue;
  if(Number(m[1])>24||Number(m[4])>30||Number(m[2]||0)>59||Number(m[5]||0)>59)continue;
  let end=clock(m[4],m[5],m[3]);if(/午後|PM/i.test(m[3]||'')&&Number(m[4])<12)end=clock(String(Number(m[4])+12),m[5]);
  let hours=clock(m[1],m[2])+'-'+end;
  if(/^\s*[/,、]\s*(?:\d|AM|PM|午)/i.test(chunk.slice(m[0].length)))continue;
  const closed=text.match(/(?:定休日|休業日|休館日|お休み)[\s】]*[:：]?\s*([^。]{0,55})/)?.[1]??'';
  if(/第|隔週|月末|不定|偶数|奇数|祝日|祝前|土日|平日/.test(closed)||/平日|土日|日曜|祝日|祝前/.test(chunk.slice(m[0].length, m[0].length+45)))continue;
  const day=closed.match(/^(?:毎週)?([月火水木金土日])曜/);if(day)hours+='; '+({月:'Mo',火:'Tu',水:'We',木:'Th',金:'Fr',土:'Sa',日:'Su'}[day[1]])+' off';
  const cutoff=chunk.match(/(?:最終受付|チェックイン最終|ラストオーダー|L\.?O\.?)\s*[:：]?\s*(\d{1,2})(?:[:時](\d{1,2})?分?)?/);
  const lastEntry=cutoff?Number(cutoff[1])*60+Number(cutoff[2]||0):undefined;
  schedules.set(hours,{hours,hoursText:readableHours(hours),lastEntry});
 }
 return schedules.size===1?[...schedules.values()][0]:null;
}
export function inspectTarget(target:Target,html:string,now=new Date()):Evidence{
 const base={id:target.id,url:target.url,checkedAt:now.toISOString(),expiresAt:new Date(now.getTime()+maxAge).toISOString(),ok:false};
 if(/captcha|just a moment|access denied|ロボットではない/i.test(html.slice(0,2000)))return {...base,reason:'取得先の制限により本文を取得できません'};
 const text=visibleText(html);
 const structured=structuredHours(html,target),plain=textHours(text,target);
 const ranges=(s:string)=>[...new Set(s.match(/\d{2}:\d{2}-\d{2}:\d{2}/g)||[])].sort().join(',');
 if(structured&&plain&&ranges(structured)!==ranges(plain.hours))return {...base,reason:'公式本文と構造化データの営業時間が一致しません'};
 if(structured&&plain){
  const closedDays=[...plain.hours.matchAll(/\b(Mo|Tu|We|Th|Fr|Sa|Su) off/g)].map(m=>m[1]);
  const starts=plain.hours.match(/(\d{2}):(\d{2})-/);
  if(closedDays.length&&starts){
   const today=new Date(now.getTime()+9*3600000).toISOString().slice(0,10),midnight=Date.parse(today+'T00:00:00+09:00');
   for(let day=0;day<7;day++){
    const at=midnight+day*86400000+(Number(starts[1])*60+Number(starts[2])+1)*60000;
    if(closedDays.includes(['Su','Mo','Tu','We','Th','Fr','Sa'][new Date(at+9*3600000).getUTCDay()])&&localStatus({...target,hours:structured,checkedAt:base.checkedAt,sourceType:'official'} as unknown as LocalStore,at).state==='open')return {...base,reason:'公式本文と構造化データの定休日が一致しません'};
   }
  }
 }
 const result=structured?{hours:structured,hoursText:readableHours(structured),lastEntry:plain?.lastEntry}:plain;
 if(!result)return {...base,reason:'店舗と曜日別営業時間を本文から一意に確定できません'};
 const store={...target,hours:result.hours,checkedAt:base.checkedAt,sourceType:'official'} as unknown as LocalStore;
 if(localStatus(store,now.getTime()).state==='unknown')return {...base,reason:'取得した営業カレンダーを確定できません'};
 return {...base,...result,ok:true,method:structured?'公式の構造化データ':'公式本文の営業案内',scope:target.scope};
}
export function validEvidence(e:Evidence|undefined,now:number){return !!e?.ok&&!!e.hours&&Date.parse(e.checkedAt)<=now&&Date.parse(e.expiresAt)>now&&now-Date.parse(e.checkedAt)<=maxAge}
export function announcedClosures(html:string,now=new Date()):Record<string,string>{
 const exceptions:Record<string,string>={},text=visibleText(html),blocks:{text:string;year?:number}[]=[];
 const notice=text.match(/お知らせ\s*([^。]{0,240}(?:休業します|休館します)[^。]{0,160})/);
 if(notice)blocks.push({text:notice[1]});
 for(const link of html.replace(/<!--[\s\S]*?-->/g,'').matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)){
  const label=visibleText(link[2]);if(!/休館日のお知らせ|臨時休業|臨時休館/.test(label))continue;
  const year=Number(link[1].match(/\/(20\d{2})\/\d{1,2}\/\d{1,2}\//)?.[1])||undefined;blocks.push({text:label,year});
 }
 for(const block of blocks)for(const m of block.text.matchAll(/(?:(20\d{2})年)?(\d{1,2})(?:月|\/)(\d{1,2})(?:日)?(?:[（(]([日月火水木金土])[）)])?/g)){
  const y=Number(m[1]||block.year||new Date(now.getTime()+9*3600000).getUTCFullYear()),date=`${y}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`,at=Date.parse(date+'T00:00:00+09:00');
  if(!Number.isFinite(at)||new Date(at+9*3600000).toISOString().slice(0,10)!==date)continue;
  if(!m[1]&&!block.year&&(at-now.getTime()<-7*86400000||at-now.getTime()>60*86400000))continue;
  if(m[4]&&'日月火水木金土'[new Date(at+9*3600000).getUTCDay()]!==m[4])continue;
  exceptions[date]='off';
 }
 return exceptions;
}
