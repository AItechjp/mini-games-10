import {canonicalUrl,cleanText,deduplicate,extractLocation,extractOpeningDate,getGenre,japanDay,addDays,addMonths,collectionWindow,type Opening,type OpeningSnapshot,type SourceStatus} from './openings';
import {openingSeeds} from './opening-seeds';

type OpeningSource={name:string;url:string;region:string;venuePrefix?:string;official?:boolean};
export const openingFeeds:OpeningSource[]=[
  {name:'名古屋情報通',url:'https://jouhou.nagoya/feed/',region:'愛知県'},
  {name:'号外NET 岐阜市',url:'https://gifu.goguynet.jp/feed/',region:'岐阜県'},
  {name:'ゆるなご',url:'https://yurunago.or.jp/feed/',region:''},
  {name:'PR TIMES',url:'https://prtimes.jp/index.rdf',region:'',official:true},
  {name:'SAUNA BROS.WEB',url:'https://saunabrosweb.jp/feed/',region:''},
];
export const saunaArchives:OpeningSource[]=[
  {name:'SAUNA BROS.WEB 過去の開業告知',url:'https://saunabrosweb.jp/wp-json/wp/v2/posts',region:''},
  {name:'フロサウナ 過去の開業告知',url:'https://furosauna.com/wp-json/wp/v2/posts',region:''},
];
const ramenNews:OpeningSource={name:'ラーメン魁力屋 公式',url:'https://www.kairikiya.co.jp/',region:'',venuePrefix:'ラーメン魁力屋 ',official:true};
type FeedArticle={title:string;url:string;body:string;publishedAt:string};
const tag=(xml:string,name:string)=>xml.match(new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)</'+name+'>','i'))?.[1]??'';
export function parseFeed(xml:string){
  if(!/<(?:rss|rdf:RDF)[\s>]/i.test(xml))throw new Error('Invalid feed');
  const records:FeedArticle[]=[];
  for(const m of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)){
    const title=cleanText(tag(m[1],'title')),raw=cleanText(tag(m[1],'link'));
    try{const url=canonicalUrl(raw);if(!url.startsWith('https://'))continue;records.push({title,url,body:cleanText(tag(m[1],'content:encoded')||tag(m[1],'description')),publishedAt:cleanText(tag(m[1],'pubDate')||tag(m[1],'dc:date'))})}catch{}
  }
  return records.slice(0,150);
}
export function parseWordpress(text:string):FeedArticle[]{
  const posts=JSON.parse(text);if(!Array.isArray(posts))throw new Error('Invalid archive');
  return posts.flatMap(post=>{
    if(typeof post.link!=='string'||typeof post.date!=='string'||typeof post.title?.rendered!=='string'||typeof post.content?.rendered!=='string')return [];
    try{const url=canonicalUrl(post.link),publishedAt=post.date+'+09:00';if(!url.startsWith('https://')||!Number.isFinite(Date.parse(publishedAt)))return [];
      return [{url,publishedAt,title:cleanText(post.title.rendered),body:cleanText(post.content.rendered)}];
    }catch{return []}
  });
}
function articleKind(title:string,body:string){
  if(!/オープン|開業|開店|NEW\s*OPEN|新設|新登場|誕生/i.test(title))return null;
  if(/閉店|オープンキャンパス|まとめ|\d+選|求人|新商品|新メニュー|オープン記念|放送|期間限定|POP.?UP|ポップアップ|開催|発売/i.test(title))return null;
  if(/サウナ|SAUNA/i.test(title))return 'sauna' as const;
  if(/サウナ|SAUNA/i.test(body.slice(0,800))&&/温浴|温泉|銭湯|ホテル/.test(title))return 'sauna' as const;
  if(/ラーメン|らーめん|らぁ麺|らあめん|ラー麺|中華そば|つけ麺|つけめん|油そば|まぜそば|RAMEN/i.test(title)&&!/カフェ|喫茶|居酒屋|酒場|うどん|蕎麦|ベーカリー|レストラン|薬局|書店|アパレル|ホテル|家具|中古|雑貨|美容|スポーツ|ジム|自動車/.test(title))return 'ramen' as const;
  return null;
}
export function articleToOpening(article:FeedArticle,feed:OpeningSource,now=new Date()):Opening|null{
  const title=(feed.venuePrefix??'')+article.title;
  const kind=articleKind(title,article.body);if(!kind)return null;
  const openingDate=extractOpeningDate(title,article.body,article.publishedAt);if(!openingDate)return null;
  const range=collectionWindow(now,kind);if(openingDate<range.start||openingDate>range.end)return null;
  const quoted=[...new Set([...title.matchAll(/[「『]([^」』]{2,100})[」』]/g)].map(m=>m[1]))];
  // Automatically structure only unambiguous, single-venue announcements.
  if(quoted.length!==1)return null;
  const name=(feed.venuePrefix??'')+quoted[0];if(/メニュー|周年|キャンペーン|フェア|セット|コース|クーポン/.test(name))return null;
  const location=extractLocation(title,article.body,feed.region);
  const status=/中止|見合わせ/.test(title)||/オープン(?:日|予定|時期)?[^。]{0,18}(?:未定|見合わせ|中止)|(?:開店|開業)(?:日|予定)?[^。]{0,18}(?:未定|見合わせ|中止)/.test(title+'。'+article.body.slice(0,800))?'uncertain':'scheduled';
  return {id:article.url,kind,name,openingDate,...location,genre:getGenre(title,kind),sourceName:feed.name.replace(' 過去の開業告知',''),sourceUrl:article.url,official:feed.official??false,reviewed:false,publishedAt:new Date(article.publishedAt).toISOString(),checkedAt:now.toISOString(),note:/リニューアル|改装|新装/.test(title)?'リニューアルオープンの告知。':kind==='sauna'&&/ホテル|ヴィラ|宿|貸別荘/.test(title)?'宿泊施設内のサウナ。利用条件は出典でご確認ください。':'',status};
}
export function archiveUrl(source:OpeningSource,now:Date,page=1){
  const url=new URL(source.url),range=collectionWindow(now,'sauna');
  // Include earlier announcements for venues that opened at the start of the window.
  const params={per_page:'20',page:String(page),after:addMonths(range.start,-2)+'T00:00:00',before:addDays(japanDay(now),1)+'T00:00:00',search:'オープン',_fields:'id,date,link,title,content'};
  for(const [key,value] of Object.entries(params))url.searchParams.set(key,value);
  return url.toString();
}
const allowedHosts=new Set([...openingFeeds,...saunaArchives,ramenNews].map(f=>new URL(f.url).hostname).concat(openingSeeds.map(s=>new URL(s.sourceUrl).hostname)));
async function fetchOpeningResponse(url:string){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
    let target=new URL(url);if(target.protocol!=='https:'||!allowedHosts.has(target.hostname))throw new Error('Unsupported source');
    let response:Response|undefined;
    for(let attempt=0;attempt<3;attempt++){
      response=await fetch(target,{signal:controller.signal,redirect:'manual',headers:{Accept:'application/json,application/rss+xml,application/rdf+xml,text/xml,text/html;q=0.8','User-Agent':'CommonsOpenings/1.1'}});
      if(response.status>=300&&response.status<400){await response.body?.cancel();target=new URL(response.headers.get('location')??'',target);if(target.protocol!=='https:'||!allowedHosts.has(target.hostname))throw new Error('Unsupported redirect');continue}break;
    }
    if(!response?.ok||!response.body)throw new Error('Source unavailable');
    const reader=response.body.getReader(),decoder=new TextDecoder();let total=0,text='';
    try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>1_500_000){await reader.cancel();throw new Error('Source too large')}text+=decoder.decode(value,{stream:true})}text+=decoder.decode()}finally{reader.releaseLock()}
    return {text,pages:Math.max(1,Number(response.headers.get('X-WP-TotalPages'))||1)};
  }finally{clearTimeout(timer)}
}
export async function fetchOpeningSource(url:string){return (await fetchOpeningResponse(url)).text}
export async function collectOpenings(previous:OpeningSnapshot,now=new Date()):Promise<OpeningSnapshot>{
  const statuses:SourceStatus[]=[],next:Opening[]=[],checkedAt=now.toISOString();
  const byUrl=new Map(previous.records.map(r=>[r.sourceUrl,r]));
  const consume=(articles:FeedArticle[],source:OpeningSource)=>{
    for(const article of articles){
      const record=articleToOpening(article,source,now);
      if(record)next.push(record);
      else if(byUrl.has(article.url)&&articleKind(article.title,article.body))next.push({...byUrl.get(article.url)!,status:'uncertain',checkedAt});
    }
  };
  const report=(source:OpeningSource,articles:FeedArticle[],ok=true)=>{
    const latest=Math.max(...articles.map(a=>Date.parse(a.publishedAt)).filter(Number.isFinite));
    statuses.push({name:source.name,url:source.url,ok,checkedAt,articles:articles.length,latestPublishedAt:Number.isFinite(latest)?new Date(latest).toISOString():null});
  };
  const eligible=(r:Opening)=>{if(r.kind!=='ramen'&&r.kind!=='sauna')return false;const range=collectionWindow(now,r.kind);return r.openingDate>=range.start&&r.openingDate<=range.end};
  await Promise.all([
    ...openingFeeds.map(async source=>{
      try{const articles=parseFeed(await fetchOpeningSource(source.url));consume(articles,source);report(source,articles)}catch{report(source,[],false)}
    }),
    ...saunaArchives.map(async source=>{
      const articles:FeedArticle[]=[];let ok=true;
      try{
        const first=await fetchOpeningResponse(archiveUrl(source,now));articles.push(...parseWordpress(first.text));
        // Bounded requests; retain useful pages even if a later page is unavailable.
        if(first.pages>8)ok=false;
        const pages=await Promise.allSettled(Array.from({length:Math.min(first.pages,8)-1},(_,i)=>fetchOpeningSource(archiveUrl(source,now,i+2)).then(parseWordpress)));
        for(const page of pages)if(page.status==='fulfilled')articles.push(...page.value);else ok=false;
        consume(articles.filter(a=>articleKind(a.title,a.body)==='sauna'),source);
      }catch{ok=false}
      report(source,articles,ok);
    }),
    (async()=>{
      try{
        const html=await fetchOpeningSource(ramenNews.url),articles:FeedArticle[]=[];
        for(const match of html.matchAll(/<a\b[^>]*href=["']([^"']*\/news\/\d+\/?)["'][^>]*>([\s\S]*?)<\/a>/gi)){
          const title=cleanText(match[2]),date=title.match(/20\d{2}\.\d{2}\.\d{2}/)?.[0];if(!title.includes('新店舗')||!date)continue;
          articles.push({title,url:canonicalUrl(new URL(match[1],ramenNews.url).toString()),publishedAt:date.replaceAll('.','-')+'T00:00:00+09:00',body:''});
        }
        consume(articles,ramenNews);report(ramenNews,articles);
      }catch{report(ramenNews,[],false)}
    })(),
    ...openingSeeds.filter(eligible).map(async seed=>{
      const source={name:seed.sourceName+' · '+seed.name,url:seed.sourceUrl,region:seed.prefecture};
      try{
        const html=await fetchOpeningSource(seed.sourceUrl),text=cleanText(html);
        const heading=html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]??'';
        const pageTitle=html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]??'';
        const postStart=html.match(/<div\b[^>]*class="(?:post_content|entry-content)"[^>]*>/i);
        const lead=postStart?cleanText(html.slice(postStart.index!+postStart[0].length)).slice(0,1800):text.slice(0,4000);
        const date=extractOpeningDate('',heading,seed.publishedAt)||extractOpeningDate('',pageTitle,seed.publishedAt)||extractOpeningDate('',lead,seed.publishedAt);
        const old=previous.records.find(r=>r.id===seed.id)??seed;
        const uncertain=/オープン(?:日|予定)?[^。]{0,12}(?:未定|中止|見合わせ)/.test(text.slice(0,2000));
        next.push({...old,openingDate:date??old.openingDate,status:date&&!uncertain?'scheduled':'uncertain',checkedAt});
        report(source,[{title:'',body:'',url:seed.sourceUrl,publishedAt:seed.publishedAt}]);
      }catch{report(source,[],false)}
    }),
  ]);
  const current=new Map(previous.records.filter(eligible).map(r=>[r.sourceUrl,r]));
  // Reviewed records win over automatically parsed mentions of the same source.
  for(const record of next.sort((a,b)=>Number(a.reviewed)-Number(b.reviewed)))current.set(record.sourceUrl,record);
  return {records:deduplicate([...current.values()]).filter(eligible).slice(0,800),sources:statuses.sort((a,b)=>a.name.localeCompare(b.name,'ja')),updatedAt:checkedAt};
}
