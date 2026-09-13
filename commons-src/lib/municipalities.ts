// Prefectural government municipality lists, checked 2026-09-13.
export const municipalitySources = {
  '岐阜県':'https://www.pref.gifu.lg.jp/page/6058.html',
  '愛知県':'https://www.pref.aichi.jp/site/aichisaigai-portal/aichisaigai-portal-sityouson.html',
};
export const municipalities:Record<string,string[]> = {
  '岐阜県':'岐阜市 大垣市 高山市 多治見市 関市 中津川市 美濃市 瑞浪市 羽島市 恵那市 美濃加茂市 土岐市 各務原市 可児市 山県市 瑞穂市 飛騨市 本巣市 郡上市 下呂市 海津市 岐南町 笠松町 養老町 垂井町 関ケ原町 神戸町 輪之内町 安八町 揖斐川町 大野町 池田町 北方町 坂祝町 富加町 川辺町 七宗町 八百津町 白川町 東白川村 御嵩町 白川村'.split(' '),
  '愛知県':'名古屋市 豊橋市 岡崎市 一宮市 瀬戸市 半田市 春日井市 豊川市 津島市 碧南市 刈谷市 豊田市 安城市 西尾市 蒲郡市 犬山市 常滑市 江南市 小牧市 稲沢市 新城市 東海市 大府市 知多市 知立市 尾張旭市 高浜市 岩倉市 豊明市 日進市 田原市 愛西市 清須市 北名古屋市 弥富市 みよし市 あま市 長久手市 東郷町 豊山町 大口町 扶桑町 大治町 蟹江町 飛島村 阿久比町 東浦町 南知多町 美浜町 武豊町 幸田町 設楽町 東栄町 豊根村'.split(' '),
};
export const normalizeSearch=(s:string)=>s.normalize('NFKC').toLocaleLowerCase('ja').replace(/ヶ/g,'ケ');
export function matchesSearch(text:string,query:string){const haystack=normalizeSearch(text);return normalizeSearch(query).trim().split(/\s+/).every(term=>haystack.includes(term));}
export function municipalityOf(pref:string,city:string,address=''){
  return municipalities[pref]?.find(name=>normalizeSearch(city).startsWith(normalizeSearch(name)))
    ?? municipalities[pref]?.find(name=>normalizeSearch(address.replace(pref,'')).replace(/^[^市町村]+郡/,'').startsWith(normalizeSearch(name))) ?? city;
}
