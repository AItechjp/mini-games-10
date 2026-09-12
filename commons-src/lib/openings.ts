export type OpeningKind = 'ramen' | 'sauna';
export type Opening = {
  id:string; kind:OpeningKind; name:string; openingDate:string; prefecture:string;
  address:string; genre:string; sourceName:string; sourceUrl:string;
  official:boolean; reviewed:boolean; publishedAt:string; checkedAt:string;
  note:string; status:'scheduled'|'uncertain';
};
export type SourceStatus={name:string;url:string;ok:boolean;checkedAt:string;articles:number;latestPublishedAt:string|null};
export type OpeningSnapshot={records:Opening[];sources:SourceStatus[];updatedAt:string|null;refreshing?:boolean;storageError?:boolean};
export const prefectures='北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県'.split(' ');
export const dayMs=86_400_000;
export function japanDay(now=new Date()){return new Date(now.getTime()+9*3_600_000).toISOString().slice(0,10)}
export function addDays(day:string,n:number){return new Date(Date.parse(day+'T00:00:00Z')+n*dayMs).toISOString().slice(0,10)}
export function addMonths(day:string,n:number){const [y,m,d]=day.split('-').map(Number),target=new Date(Date.UTC(y,m-1+n,1));const last=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();target.setUTCDate(Math.min(d,last));return target.toISOString().slice(0,10)}
export function windowFor(now=new Date(),kind:OpeningKind='ramen'){const today=japanDay(now);return kind==='sauna'?{start:addMonths(today,-2),end:addMonths(today,2)}:{start:today,end:addDays(today,14)}}
export function collectionWindow(now:Date,kind:OpeningKind){return kind==='sauna'?windowFor(now,kind):{start:japanDay(now),end:addDays(japanDay(now),180)}}
export function monthsInRange(start:string,end:string){const months:string[]=[];let current=start.slice(0,7)+'-01';while(current.slice(0,7)<=end.slice(0,7)){months.push(current.slice(0,7));current=addMonths(current,1)}return months}
export function inWindow(record:Opening,start:string,end:string){return record.status==='scheduled'&&record.openingDate>=start&&record.openingDate<=end}
export function regionMatches(record:Opening,region:string){return region==='all'||(region==='local'?['岐阜県','愛知県'].includes(record.prefecture):record.prefecture===region)}
export function dateLabel(day:string){return new Intl.DateTimeFormat('ja-JP',{month:'numeric',day:'numeric',weekday:'short',timeZone:'Asia/Tokyo'}).format(new Date(day+'T12:00:00+09:00'))}
export function cleanText(html:string){return html.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]*>/g,' ').replace(/&#(x[\da-f]+|\d+);/gi,(_,v)=>{const n=v[0].toLowerCase()==='x'?parseInt(v.slice(1),16):Number(v);return n<=0x10ffff?String.fromCodePoint(n):''}).replace(/&(?:amp|lt|gt|quot|apos|nbsp);/g,v=>({'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'",'&nbsp;':' '}[v]??' ')).replace(/\s+/g,' ').trim()}
const openWord='(?:グランド[・\\s]*)?オープン|開店|開業|NEW\\s*OPEN|新設|誕生|新登場';
function validDate(year:number,month:number,day:number){const s=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;try{return new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s?s:null}catch{return null}}
// Publication time is used only to resolve a year omitted from an opening sentence.
// It is never used as an opening date itself.
export function extractOpeningDate(title:string,body:string,publishedAt:string):string|null {
  const text=cleanText(title+'。'+body).normalize('NFKC');
  const published=new Date(publishedAt),publishedJapan=new Date(published.getTime()+9*3_600_000),baseYear=publishedJapan.getUTCFullYear();
  if(!Number.isFinite(baseYear))return null;
  const date='(?:(20\\d{2})[年/.-]\\s*)?(\\d{1,2})[月/]\\s*(\\d{1,2})(?:日)?';
  const re=new RegExp(date+'(?:\\s*[(（][月火水木金土日祝・]+[)）])?([^。！？!?]{0,45})(?:'+openWord+')','gi');
  const dates=new Set<string>();
  for(const match of text.matchAll(re)){
    const bridge=match[4];
    if(/まで|周年|記念|開催|発売|放送|予約|プレ$|開店時間|オープン時間|\d{1,2}[月/]|延期|中止|閉店/.test(bridge))continue;
    let y=match[1]?Number(match[1]):baseYear;
    if(!match[1]){const difference=Number(match[2])-(publishedJapan.getUTCMonth()+1);if(difference<-6)y++;else if(difference>6)y--;}
    const d=validDate(y,Number(match[2]),Number(match[3]));if(d)dates.add(d);
  }
  const after=new RegExp('(?<!プレ)(?:オープン日|開業日|開店日|開業予定日)\\s*[:：]\\s*'+date,'gi');
  for(const match of text.matchAll(after)){const d=validDate(Number(match[1]??baseYear),Number(match[2]),Number(match[3]));if(d)dates.add(d)}
  return dates.size===1?[...dates][0]:null;
}
export function getGenre(title:string,kind:OpeningKind){if(kind==='sauna')return /ホテル|宿泊/.test(title)?'ホテル・サウナ':/温泉|銭湯|温浴/.test(title)?'温浴施設':'サウナ';return /つけ麺|つけめん/.test(title)?'ラーメン・つけ麺':/まぜそば|油そば/.test(title)?'ラーメン・まぜそば':'ラーメン'}
export function extractLocation(title:string,body:string,fallback=''){
  const text=cleanText(body).normalize('NFKC'),m=text.match(/(?:店舗所在地|店舗住所|所在地(?:\(エリア\))?|住所)\s*[:：＝=]?\s*(?:〒?\d{3}[-‐]?\d{4}\s*)?([^。\n]{5,100})/);
  const address=(m?.[1]??'').split(/(?:電話|TEL|営業時間|アクセス|定休日|開業日|開店日|オープン日|グランドオープン|プレオープン|リニューアル完成|運営\s*[:：]|客室数|基本設備|設備\s*[:：]|構造\s*[:：]|■)/)[0].trim();
  const target=address||title;
  const pref=prefectures.find(p=>target.includes(p))??prefectures.find(p=>target.includes(p.replace(/[都府県]$/,'')))??(/名古屋|清須|一宮|春日井|岡崎|豊橋|豊田市/.test(target)?'愛知県':/各務原|大垣|岐阜|岐南/.test(target)?'岐阜県':/門仲|門前仲町|渋谷|新宿|江東区|目黒|世田谷|千歳烏山/.test(target)?'東京都':/天王寺|梅田/.test(target)?'大阪府':/倶知安|札幌/.test(target)?'北海道':fallback);
  return {prefecture:pref||'地域未確認',address};
}
export function canonicalUrl(url:string){const u=new URL(url);u.hash='';for(const k of [...u.searchParams.keys()])if(k.startsWith('utm_'))u.searchParams.delete(k);return u.toString()}
export function deduplicate(records:Opening[]){
  const result=new Map<string,Opening>();
  const sorted=[...records].sort((a,b)=>Number(a.reviewed)-Number(b.reviewed)||a.publishedAt.localeCompare(b.publishedAt)||a.checkedAt.localeCompare(b.checkedAt));
  for(const record of sorted){const key=record.kind+':'+record.name.normalize('NFKC').replace(/[\s「」『』・]/g,'').toLowerCase()+':'+record.prefecture;result.set(key,record)}
  return [...result.values()].sort((a,b)=>a.openingDate.localeCompare(b.openingDate)||a.name.localeCompare(b.name,'ja'));
}
