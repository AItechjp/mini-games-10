export const prefectures = '北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県'.split(' ');
export const romanized = 'Hokkaido Aomori Iwate Miyagi Akita Yamagata Fukushima Ibaraki Tochigi Gunma Saitama Chiba Tokyo Kanagawa Niigata Toyama Ishikawa Fukui Yamanashi Nagano Gifu Shizuoka Aichi Mie Shiga Kyoto Osaka Hyogo Nara Wakayama Tottori Shimane Okayama Hiroshima Yamaguchi Tokushima Kagawa Ehime Kochi Fukuoka Saga Nagasaki Kumamoto Oita Miyazaki Kagoshima Okinawa'.split(' ');
export const layouts = ['ワンルーム','1K','1DK','1LDK','2K','2DK','2LDK','3K','3DK','3LDK','4K','4DK','4LDK','5K以上'];
export const walks = ['1','5','7','10','15','20'];
export const todayJST = (now = new Date()) => new Date(now.getTime()+9*3600000).toISOString().slice(0,10);
export function addDays(date, count) { return new Date(Date.parse(date+'T00:00:00Z') + count*86400000).toISOString().slice(0,10); }
export function nightsBetween(a,b) { return Math.round((Date.parse(b+'T00:00:00Z')-Date.parse(a+'T00:00:00Z'))/86400000); }
function validDate(date) { return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date+'T00:00:00Z').toISOString().slice(0,10) === date; }
function link(base, params) { const u = new URL(base); for(const [k,v] of Object.entries(params)) if(v!=='' && v!=null) u.searchParams.set(k,String(v)); return u.href; }
export function validateHotel(s, today = todayJST()) {
  if(!prefectures.includes(s.prefecture)) return '都道府県を選んでください。';
  if(!validDate(s.checkin)||!validDate(s.checkout)) return 'チェックイン日とチェックアウト日を指定してください。';
  if(s.checkin < today) return 'チェックイン日は今日以降を選んでください。';
  const n=nightsBetween(s.checkin,s.checkout);
  if(n<1||n>30) return '宿泊日数は1泊〜30泊で指定してください。';
  if(!Number.isInteger(s.adults)||s.adults<1||s.adults>10) return '大人は1〜10名で指定してください。';
  if(!Number.isInteger(s.rooms)||s.rooms<1||s.rooms>5) return '部屋数は1〜5室で指定してください。';
  if(!['price','recommended'].includes(s.sort)) return '並び順を選んでください。';
  return '';
}
export function hotelSearches(s) {
  const place=[s.prefecture,s.destination.trim()].filter(Boolean).join(' ');
  const [iy,im,id]=s.checkin.split('-'), [oy,om,od]=s.checkout.split('-');
  const index=prefectures.indexOf(s.prefecture);
  return [
    {id:'booking',name:'Booking.com',mark:'B.',type:'日程を引き継ぐ',note:'宿泊日・大人人数・部屋数を指定。安い順はBooking.com内の表示料金順です。',capabilities:['宿泊日','大人・部屋数',s.sort==='price'?'料金の安い順':'おすすめ順'],url:link('https://www.booking.com/searchresults.ja.html',{ss:place+', 日本',checkin:s.checkin,checkout:s.checkout,group_adults:s.adults*s.rooms,no_rooms:s.rooms,group_children:0,selected_currency:'JPY',order:s.sort==='price'?'price':'popularity'})},
    {id:'rakuten',name:'楽天トラベル',mark:'R',type:'日程を引き継ぐ',note:s.destination.trim()?'都道府県・日程・人数・料金順を渡します。市区町村や駅、ホテル名は楽天トラベルで再指定してください。':'指定した都道府県と日程で検索。ポイント・クーポン適用条件は予約画面で確認できます。',capabilities:['宿泊日','大人・部屋数',s.sort==='price'?'料金の安い順':'おすすめ順'],url:link('https://search.travel.rakuten.co.jp/ds/vacant/searchVacant/',{f_dai:'japan',f_chu:romanized[index].toLowerCase(),f_cd:'02',f_nen1:iy,f_tuki1:im,f_hi1:id,f_nen2:oy,f_tuki2:om,f_hi2:od,f_otona_su:s.adults,f_heya_su:s.rooms,f_sort:s.sort==='price'?'hotel_kin_low':'hotel',f_sort_cate:'hotel',f_tab:'hotel',f_hyoji:30})},
    {id:'jalan',name:'じゃらん',mark:'J',type:'検索先で条件を指定',note:'国内のホテル・旅館を追加で確認。日程・人数・料金順は検索先で指定してください。',capabilities:['国内の宿'],url:'https://www.jalan.net/'},
    {id:'yahoo',name:'Yahoo!トラベル',mark:'Y!',type:'検索先で条件を指定',note:'国内の宿と割引条件を確認。日程・地域・人数は検索先で指定してください。',capabilities:['国内の宿'],url:'https://travel.yahoo.co.jp/'},
    {id:'agoda',name:'Agoda',mark:'a.',type:'検索先で条件を指定',note:'別の販売プランを確認。地域・日程・人数は検索先で指定してください。',capabilities:['ホテル・宿泊施設'],url:'https://www.agoda.com/ja-jp/'},
    {id:'ikyu',name:'一休.com',mark:'一',type:'検索先で条件を指定',note:'ホテル・旅館のプランを確認。日程・地域・人数は検索先で指定してください。',capabilities:['ホテル・旅館'],url:'https://www.ikyu.com/'},
  ];
}
export function validateRental(s, stations) {
  if(!['gifu','aichi'].includes(s.prefecture)) return '岐阜県または愛知県を選んでください。';
  if(!stations.some(x=>x.id===s.station&&x.prefecture===s.prefecture)) return '一覧から駅を選んでください。';
  if(s.walk && !walks.includes(s.walk)) return '徒歩分数を選び直してください。';
  if(!Array.isArray(s.layouts)||s.layouts.some(x=>!layouts.includes(x))) return '間取りを選び直してください。';
  return '';
}
export function rentalSearches(s, stations) {
  const station=stations.find(x=>x.id===s.station&&x.prefecture===s.prefecture);
  if(!station) throw new Error('駅を選んでください。');
  const ek=Object.values(station.lines)[0];
  const params=new URLSearchParams({rn:ek.slice(0,-station.code.length),et:s.walk||'9999999'});
  for(const layout of s.layouts) params.append('md',String(layouts.indexOf(layout)+1).padStart(2,'0'));
  const pref=s.prefecture==='gifu'?'岐阜県':'愛知県';
  const query = [pref,station.name+'駅','賃貸',s.walk?'徒歩'+s.walk+'分以内':'',...s.layouts].filter(Boolean).join(' ');
  const keyword=(domain)=>link('https://www.google.com/search',{q:'site:'+domain+' '+query});
  return [
    {id:'suumo',name:'SUUMO',mark:'S',type:'絞り込み条件を引き継ぐ',note:'駅・徒歩分数・間取りを指定してSUUMOの募集物件を表示。複数の間取りは「いずれかに一致」で検索します。',capabilities:['駅',s.walk?'徒歩'+s.walk+'分以内':'徒歩指定なし',s.layouts.length?s.layouts.join(' / '):'間取り指定なし'],url:'https://suumo.jp/chintai/'+s.prefecture+'/ek_'+station.code+'/?'+params},
    {id:'homes',name:"LIFULL HOME’S",mark:'H',type:'掲載ページをキーワード検索',note:'Googleで掲載ページを探します。徒歩・間取りの厳密な絞り込みと現在の募集状況は、掲載サイトで確認してください。',capabilities:['駅名・条件を検索語に使用'],url:keyword('homes.co.jp/chintai/')},
    {id:'athome',name:'アットホーム',mark:'at',type:'掲載ページをキーワード検索',note:'Googleで掲載ページを探します。徒歩・間取りの厳密な絞り込みは、掲載サイトで指定してください。',capabilities:['駅名・条件を検索語に使用'],url:keyword('athome.co.jp/chintai/')},
    {id:'nifty',name:'ニフティ不動産',mark:'n',type:'掲載ページをキーワード検索',note:'Googleで賃貸の掲載ページを探します。検索結果には募集が終了した物件が含まれる場合があります。',capabilities:['駅名・条件を検索語に使用'],url:keyword('myhome.nifty.com/rent/')},
    {id:'chintai',name:'CHINTAI',mark:'C',type:'掲載ページをキーワード検索',note:'Googleで掲載ページを探します。指定条件に一致するか、掲載サイトで確認してください。',capabilities:['駅名・条件を検索語に使用'],url:keyword('chintai.net/')},
    {id:'apaman',name:'アパマンショップ',mark:'A',type:'掲載ページをキーワード検索',note:'Googleで掲載ページを探します。店舗独自の募集も、掲載元で確認してください。',capabilities:['駅名・条件を検索語に使用'],url:keyword('apamanshop.com/')},
  ];
}
