import {allDays,exceptDays,windowHours as h,type RamenShop} from './ramen-hours';

export const checkedOn='2026-09-12';
export const holidaySource='https://www8.cao.go.jp/chosei/shukujitsu/gaiyou.html';
export const holidayYears=[2026,2027];
export const holidays=new Set([
  '2026-01-01','2026-01-12','2026-02-11','2026-02-23','2026-03-20','2026-04-29',
  '2026-05-03','2026-05-04','2026-05-05','2026-05-06','2026-07-20','2026-08-11',
  '2026-09-21','2026-09-22','2026-09-23','2026-10-12','2026-11-03','2026-11-23',
  '2027-01-01','2027-01-11','2027-02-11','2027-02-23','2027-03-21','2027-03-22','2027-04-29',
  '2027-05-03','2027-05-04','2027-05-05','2027-07-19','2027-08-11','2027-09-20',
  '2027-09-23','2027-10-11','2027-11-03','2027-11-23',
]);

const tanmenSource='https://gifu-tanmen.com/99_access/';
const tanmenRows=[
  ['gifu','岐阜本店','岐阜市','岐阜','岐阜県岐阜市手力町38-1','058-338-5609'],
  ['ogaki','大垣店','大垣市','西濃','岐阜県大垣市長沢町5-27','0584-76-5102'],
  ['tajimi','多治見店','多治見市','東濃','岐阜県多治見市宝町3丁目61','0572-74-2865'],
  ['nagara','長良店','岐阜市','岐阜','岐阜県岐阜市下土居3丁目2番地17号','058-338-7750'],
  ['akanabe','21号茜部店','岐阜市','岐阜','岐阜県岐阜市茜部菱野1丁目26','058-275-3233'],
  ['kakamigahara','各務原店','各務原市','岐阜','岐阜県各務原市鵜沼川崎町2-224','058-325-9192'],
  ['minokamo','美濃加茂店','美濃加茂市','中濃','岐阜県美濃加茂市蜂屋町上蜂屋字石塚3501番21','0574-58-7146'],
  ['seki','関店','関市','中濃','岐阜県関市小屋名字神明前1362番4','0575-48-0659'],
  ['kani','可児店','可児市','中濃','岐阜県可児市広見5丁目43','0574-50-7154'],
];
const tanmen:RamenShop[]=tanmenRows.map(([id,name,city,region,address,phone])=>{
  const hours=h(660,['seki','kani'].includes(id)?1500:1620,['seki','kani'].includes(id)?1500:1590);
  const week=allDays(hours);
  if(id==='ogaki'){week[0]=h(630,1620,1590);week[6]=h(630,1620,1590);}
  return {id:'tanmen-'+id,name:'岐阜タンメン '+name,city,region,address,phone,kind:'タンメン',source:tanmenSource,sourceLabel:'公式店舗情報',checkedOn,closedLabel:'年中無休',week,...(id==='ogaki'?{holiday:h(630,1620,1590)}:{})};
});

const rairaiSource='https://rairaitei.co.jp/store/pref.php?pref_code=21';
const common={kind:'背脂醤油',source:rairaiSource,sourceLabel:'公式店舗情報',checkedOn};
const lateWeek=allDays(h(660,1410,1410));lateWeek[5]=h(660,1440,1440);lateWeek[6]=h(660,1440,1440);
const collegeWeek=lateWeek.map((v,i)=>i===3?[]:v);
const closedDates=(dates:string[])=>Object.fromEntries(dates.map(date=>[date,[]]));
const rairai:RamenShop[]=[
  {...common,id:'rairai-university',name:'来来亭 岐阜大学前店',city:'岐阜市',region:'岐阜',address:'岐阜県岐阜市古市場字神田64',phone:'058-234-8999',week:collegeWeek,holiday:h(660,1410,1410),holidayEve:h(660,1440,1440),shiftHolidayClosure:{weekday:3,shift:1},closedLabel:'水曜（祝日は営業・翌日休業）',exceptions:{'2026-09-23':h(660,1410,1410),'2026-09-24':[],'2026-12-23':h(660,1410,1410),'2026-12-24':[],'2026-12-30':h(660,1410,1410),'2026-12-31':h(660,900,900)}},
  {...common,id:'rairai-ginan',name:'来来亭 岐南店',city:'岐南町',region:'岐阜',address:'岐阜県羽島郡岐南町八剣4丁目12',phone:'058-240-6078',week:lateWeek,holidayEve:h(660,1440,1440),calendarYear:2026,closedLabel:'公式の月別休業日による',exceptions:{...closedDates(['2026-09-09','2026-09-30','2026-10-14','2026-10-28','2026-11-11','2026-11-25','2026-12-02','2026-12-24']),'2026-12-31':h(660,900,900)},note:'9/30、10/14・28、11/11・25、12/2・24は休業予定。'},
  {...common,id:'rairai-kakamigahara',name:'来来亭 各務原店',city:'各務原市',region:'岐阜',address:'岐阜県各務原市那加不動丘2丁目7-1',phone:'058-371-5139',week:exceptDays(h(660,1380,1350),[4]),holiday:h(660,1380,1350),closedLabel:'木曜（祝日は営業）'},
  {...common,id:'rairai-ena',name:'来来亭 恵那店',city:'恵那市',region:'東濃',address:'岐阜県恵那市長島町中野1丁目7-6',phone:'0573-26-1300',week:exceptDays(h(660,1380,1350),[3]),holiday:h(660,1380,1350),shiftHolidayClosure:{weekday:3,shift:1},closedLabel:'水曜（祝日は営業・翌営業日休業）'},
  {...common,id:'rairai-tajimi',name:'来来亭 多治見店',city:'多治見市',region:'東濃',address:'岐阜県多治見市白山町4丁目3-1',phone:'0572-24-3704',week:exceptDays(h(660,1380,1380),[4]),holiday:h(660,1380,1380),shiftHolidayClosure:{weekday:4,shift:-1},closedLabel:'木曜（祝日は営業・水曜休業）'},
  {...common,id:'rairai-kani',name:'来来亭 可児店',city:'可児市',region:'中濃',address:'岐阜県可児市広見田尻裏1563-3',phone:'0574-63-7988',week:exceptDays(h(660,1380,1350),[4]),holiday:h(660,1380,1350),closedLabel:'木曜（祝日は営業）'},
  {...common,id:'rairai-nishigifu',name:'来来亭 西岐阜店',city:'岐阜市',region:'岐阜',address:'岐阜県岐阜市鏡島西3丁目5-5',phone:'058-214-6350',week:allDays(h(660,1410,1410)),calendarYear:2026,closedLabel:'水曜中心・公式の月別休業日による',exceptions:{...closedDates(['2026-09-02','2026-09-09','2026-09-16','2026-09-24','2026-09-30','2026-10-07','2026-10-14','2026-10-21','2026-10-28','2026-11-04','2026-11-11','2026-11-18','2026-11-25','2026-12-02','2026-12-09','2026-12-16','2026-12-24']),'2026-12-31':h(660,900,900)},note:'9/23は営業、9/24は休業予定。'},
];

const marugen:RamenShop[]=[
  {id:'marugen-kitajima',name:'丸源ラーメン 岐阜北島店',city:'岐阜市',region:'岐阜',address:'岐阜県岐阜市北島6-1-6',phone:'058-296-6366',source:'https://www.syodai-marugen.jp/shop/6103'},
  {id:'marugen-ogaki',name:'丸源ラーメン 大垣店',city:'大垣市',region:'西濃',address:'岐阜県大垣市築捨町3-122-1',phone:'0584-87-2333',source:'https://www.syodai-marugen.jp/shop/6052'},
  {id:'marugen-tajimi',name:'丸源ラーメン 多治見店',city:'多治見市',region:'東濃',address:'岐阜県多治見市金岡町4-53-1',phone:'0572-56-7507',source:'https://www.syodai-marugen.jp/shop/6209'},
].map(shop=>({...shop,kind:'肉そば',sourceLabel:'公式店舗情報',checkedOn,closedLabel:'通常毎日営業・臨時休業は公式へ',week:allDays(shop.id==='marugen-tajimi'?h(630,1500,1470):h(660,1440,1420)),...(shop.id==='marugen-tajimi'?{}:{exceptions:{'2026-09-17':[]},note:'9/17は社内研修のため休業予定。'})}));

const locals:RamenShop[]=[
  {id:'hakuryu',name:'麺切り白流',city:'岐阜市',region:'岐阜',address:'岐阜県岐阜市折立909-1',phone:'058-322-3231',kind:'焼干し・自家製麺',source:'https://www.mengiri-hakuryu.com/about/',sourceLabel:'公式店舗情報',checkedOn,week:[...Array.from({length:1},()=>[...h(600,840),...h(1050,1230)]),h(600,870),h(600,870),[],h(600,870),[...h(600,840),...h(1050,1230)],[...h(600,840),...h(1050,1230)]],closedLabel:'水曜'},
  {id:'hakushin',name:'麺屋 白神',city:'関市',region:'中濃',address:'岐阜県関市巾2丁目144-6',phone:'0575-30-8430',kind:'ラーメン・つけ麺',source:'https://www.instagram.com/hakushin555/',sourceLabel:'店主の公式Instagram',checkedOn,week:exceptDays([...h(660,840),...h(1050,1260)],[1]),closedLabel:'月曜',note:'売り切れ・臨時休業の案内は公式SNSをご確認ください。'},
  {id:'mametengu',name:'豆天狗 本店',city:'高山市',region:'飛騨',address:'岐阜県高山市下一之町3番地3',phone:'0577-33-5177',kind:'高山ラーメン',source:'https://mametengu.com/company/',sourceLabel:'公式店舗情報',checkedOn,week:exceptDays(h(660,960),[4]),closedLabel:'木曜',note:'スープがなくなり次第終了。'},
  {id:'jingoro',name:'甚五郎らーめん 本店',city:'高山市',region:'飛騨',address:'岐阜県高山市西之一色町2-132-1',phone:'0577-34-5565',kind:'高山ラーメン',source:'https://www.hidatakayama.or.jp/eat/detail_3028.html',sourceLabel:'飛騨高山観光公式サイト',checkedOn,week:allDays(h(630,900)).map((day,i)=>i===0||i===1?day:[...(day??[]),...h(1200,1560)]),closedLabel:'昼は無休・夜は日曜と月曜休業'},
];

export const ramenShops:RamenShop[]=[...locals,...tanmen,...rairai,...marugen];
export const regions=['岐阜','西濃','中濃','東濃','飛騨'];
