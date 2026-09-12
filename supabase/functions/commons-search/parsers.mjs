export function clean(value='') {
  return value.replace(/<script\b[\s\S]*?<\/script>/gi,'').replace(/<style\b[\s\S]*?<\/style>/gi,'').replace(/<[^>]+>/g,' ').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>{const cp=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return cp>0&&cp<=0x10ffff?String.fromCodePoint(cp):'';}).replace(/&(?:nbsp|amp|quot|apos|lt|gt);/g,x=>({'&nbsp;':' ','&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>'}[x])).replace(/\s+/g,' ').trim();
}
function field(html,name,tag='(?:div|span|li|p)') { return clean(html.match(new RegExp('<'+tag+'\\b[^>]*class="[^"]*\\b'+name+'\\b[^"]*"[^>]*>([\\s\\S]*?)<\\/'+tag+'>','i'))?.[1]||''); }
function amount(value) {const n=clean(value).replaceAll(',','').match(/([\d.]+)\s*(万)?円/);return n?Math.round(Number(n[1])*(n[2]?10000:1)):null;}
function blocks(html,re){const matches=[...html.matchAll(re)];return matches.map((m,i)=>({match:m,html:html.slice(m.index,matches[i+1]?.index??html.length)}));}
const escapeRE=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function parseHotelAreas(html,prefectureCode){
  const areas=[];
  for(const match of html.matchAll(/<a\b([^>]*data-locate="link-[^"]+"[^>]*)>([\s\S]*?)<\/a>/g)){
    const href=match[1].match(/href="([^"]+)"/)?.[1];if(!href)continue;
    const url=new URL(clean(href),'https://search.travel.rakuten.co.jp');
    if(url.origin!=='https://search.travel.rakuten.co.jp'||url.searchParams.get('f_chu')!==prefectureCode)continue;
    const area=url.searchParams.get('f_shou')||'',subarea=url.searchParams.get('f_sai')||'',name=clean(match[2]);
    if(name&&area)areas.push({area,subarea,name});
  }
  return [...new Map(areas.map(x=>[x.area+'/'+x.subarea,x])).values()];
}
export function parseRentals(html,query,station){
  if(!html.includes('cassetteitem')&&!/該当する物件がありません|条件に一致する物件がありません/.test(clean(html)))throw new Error('掲載元の結果を読み取れませんでした。掲載元で確認してください。');
  const rows=[];let omitted=0;
  for(const block of blocks(html,/<div\s+class="cassetteitem"[^>]*>/g)){
    const name=field(block.html,'cassetteitem_content-title');const address=field(block.html,'cassetteitem_detail-col1');
    if(!address.startsWith(query.prefecture==='gifu'?'岐阜県':'愛知県'))continue;
    const transports=[...block.html.matchAll(/<div\b[^>]*class="[^"]*cassetteitem_detail-text[^"]*"[^>]*>([\s\S]*?)<\/div>/g)].map(m=>clean(m[1]));
    const route=transports.find(t=>t.normalize('NFKC').match(new RegExp('(?:/|\\s)'+escapeRE(station.name.normalize('NFKC'))+'駅\\s*(?:歩|徒歩)\\d+分')));
    const walk=route?Number(route.match(/(?:歩|徒歩)(\d+)分/)?.[1]):null;
    if(query.walk&&(!route||walk==null||walk>Number(query.walk))){omitted++;continue;}
    for(const match of block.html.matchAll(/<tr\s+class="js-cassette_link"[^>]*>([\s\S]*?)<\/tr>/g)){
      const row=match[1], id=row.match(/name="bc"[^>]*value="(\d+)"/)?.[1];
      const href=row.match(/<a\s+href="([^"]+)"[^>]*class="[^"]*js-cassette_link_href/)?.[1];
      const layout=field(row,'cassetteitem_madori');
      if(query.layouts.length&&!query.layouts.includes(layout.replace('SLDK','LDK').replace('SDK','DK'))&&!(query.layouts.includes('5K以上')&&Number(layout[0])>=5)&&!(query.layouts.includes('ワンルーム')&&['1R','ワンルーム'].includes(layout)))continue;
      const price=amount(field(row,'cassetteitem_other-emphasis'));
      if(!id||!href||price==null||!name){omitted++;continue;}
      const management=field(row,'cassetteitem_price--administration');
      rows.push({id,name,address,price,management:amount(management)??(['-','なし'].includes(management)?0:null),layout,area:field(row,'cassetteitem_menseki').replace(/m\s*2/,'㎡'),walk,transport:route||transports[0]||'',url:new URL(clean(href),'https://suumo.jp').href});
    }
  }
  return {items:[...new Map(rows.map(x=>[x.id,x])).values()],omitted};
}
export function parseHotels(html){
  if(!html.includes('htl-list-card')&&!/条件に合う宿泊施設が見つかりません|条件に該当する宿泊施設はありません|該当する宿泊施設がありません/.test(clean(html)))throw new Error('掲載元の料金を読み取れませんでした。予約サイトで確認してください。');
  const items=[];let omitted=0;
  for(const block of blocks(html,/<li\b[^>]*class="[^"]*\bhtl-list-card\b[^"]*"[^>]*data-map-modal-hotel-no="(\d+)"[^>]*>/g)){
    const id=block.match[1];const name=clean(block.html.match(new RegExp('<a\\b[^>]*id="'+id+'_link"[^>]*>([\\s\\S]*?)<\\/a>'))?.[1]||'');
    const plans=[];
    for(const plan of blocks(block.html,/<li\b[^>]*class="plans"[^>]*>/g)){
      const price=Number(plan.html.match(new RegExp('id="total-'+id+'-[^"]+"\\s+value="(\\d+)"'))?.[1]);
      const href=plan.html.match(/<p\b[^>]*class="plnNm"[^>]*>[\s\S]*?<a\b[^>]*href="([^"]+)"[^>]*>/)?.[1];
      const title=field(plan.html,'plnNm','p');
      const priceLabel=field(plan.html,'planning','span');
      if(price>0&&href&&priceLabel)plans.push({price,plan:title,priceLabel,url:new URL(clean(href),'https://hotel.travel.rakuten.co.jp').href});
    }
    plans.sort((a,b)=>a.price-b.price);
    if(!name||!plans.length){omitted++;continue;}
    const lowest=plans[0];items.push({id,name,...lowest,access:field(block.html,'htlAccess','p').replace('地図から探す','').trim()});
  }
  if(html.includes('htl-list-card')&&!items.length)throw new Error('この条件の料金を取得できませんでした。予約サイトで確認してください。');
  return {items:[...new Map(items.map(x=>[x.id,x])).values()],omitted};
}
