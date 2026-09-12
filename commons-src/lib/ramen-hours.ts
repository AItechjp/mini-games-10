export type Hours = { open:number; close:number; lastOrder?:number };
export type DayHours = Hours[] | null;
export type RamenShop = {
  id:string; name:string; city:string; region:string; address:string; phone?:string;
  kind:string; source:string; sourceLabel:string; checkedOn:string;
  week:DayHours[]; holiday?:DayHours; holidayEve?:DayHours;
  shiftHolidayClosure?:{weekday:number; shift:-1|1};
  exceptions?:Record<string,DayHours>; calendarYear?:number;
  holidaySensitive?:boolean; note?:string; closedLabel:string;
};
export type ShopStatus = {
  state:'open'|'last-order'|'closed'|'unknown';
  today:DayHours; active?:Hours; businessDate?:string;
  minutesLeft?:number; next?:{date:string; open:number}; reason?:string;
};

// Dates are interpreted as Japanese calendar dates, independently of device timezone.
export function japanDate(now:number) {
  const d=new Date(now+9*60*60*1000);
  return {key:d.toISOString().slice(0,10),weekday:d.getUTCDay(),minute:d.getUTCHours()*60+d.getUTCMinutes()};
}
export function addDays(key:string,n:number) {
  return new Date(Date.parse(key+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
}

// Cabinet Office public holiday calendar; see ramen-data.ts for source and dates.
export function hoursForDate(shop:RamenShop,date:string,holidays:ReadonlySet<string>,holidayYears:readonly number[]):DayHours {
  if(shop.exceptions && Object.hasOwn(shop.exceptions,date)) return shop.exceptions[date];
  const year=Number(date.slice(0,4));
  if(shop.calendarYear && year!==shop.calendarYear) return null;
  const weekday=new Date(date+'T00:00:00Z').getUTCDay();
  if((shop.holidaySensitive||shop.holiday!==undefined||shop.holidayEve!==undefined||shop.shiftHolidayClosure) && !holidayYears.includes(year)) return null;
  const shift=shop.shiftHolidayClosure;
  if(shift) {
    const original=addDays(date,-shift.shift);
    if(new Date(original+'T00:00:00Z').getUTCDay()===shift.weekday && holidays.has(original)) return [];
  }
  // Explicit holidays can open an otherwise closed weekday.
  let hours=holidays.has(date) && shop.holiday!==undefined ? shop.holiday : shop.week[weekday];
  // Eve-of-holiday hours never reopen a scheduled day off.
  if(hours?.length && holidays.has(addDays(date,1)) && shop.holidayEve!==undefined) hours=shop.holidayEve;
  return hours;
}

export function shopStatus(shop:RamenShop,now:number,holidays:ReadonlySet<string>,holidayYears:readonly number[]):ShopStatus {
  const {key,minute}=japanDate(now);
  const today=hoursForDate(shop,key,holidays,holidayYears);
  const previousDate=addDays(key,-1);
  const previous=hoursForDate(shop,previousDate,holidays,holidayYears);
  for(const entry of [{hours:previous,date:previousDate,elapsed:minute+1440},{hours:today,date:key,elapsed:minute}]) {
    const active=entry.hours?.find(h=>entry.elapsed>=h.open && entry.elapsed<h.close);
    if(active) {
      const cutoff=active.lastOrder??active.close;
      return {state:entry.elapsed>=cutoff?'last-order':'open',today,active,businessDate:entry.date,minutesLeft:Math.max(0,cutoff-entry.elapsed)};
    }
  }
  if(today===null) return {state:'unknown',today,reason:'この日の営業時間は要確認'};
  // Missing previous-day information must not silently rule out overnight service.
  const mayContinue=shop.week.some(day=>day?.some(h=>h.close>1440));
  if(previous===null && mayContinue && minute<360) return {state:'unknown',today,reason:'前日からの深夜営業は要確認'};
  let next:ShopStatus['next'];
  for(let offset=0;offset<8;offset++) {
    const date=addDays(key,offset),hours=hoursForDate(shop,date,holidays,holidayYears);
    if(hours===null) break;
    const window=hours.find(h=>offset>0 || h.open>minute);
    if(window){next={date,open:window.open};break;}
  }
  return {state:'closed',today,next};
}

export function clockText(minute:number) {
  const day=Math.floor(minute/1440);
  return (day?'翌':'')+String(Math.floor(minute%1440/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0');
}
export function hoursText(hours:DayHours) {
  if(hours===null) return '要確認';
  if(!hours.length) return '休業日';
  return hours.map(h=>clockText(h.open)+'–'+clockText(h.close)).join(' / ');
}
export function allDays(hours:Hours[]):DayHours[] { return Array.from({length:7},()=>hours.map(h=>({...h}))); }
export function exceptDays(hours:Hours[],closed:number[]):DayHours[] { return allDays(hours).map((h,i)=>closed.includes(i)?[]:h); }
export function windowHours(open:number,close:number,lastOrder?:number):Hours[] {return [{open,close,...(lastOrder===undefined?{}:{lastOrder})}];}
