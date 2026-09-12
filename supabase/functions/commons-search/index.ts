import {validateHotel,validateRental,hotelSearches,rentalSearches} from './search-core.mjs';
import {parseHotels,parseRentals,parseHotelAreas} from './parsers.mjs';
import stations from './stations.mjs';
import {PUBLIC_KEY} from './public-key.mjs';

// This endpoint reads public listings only. It never opens the project database.
// A project publishable key is required; no service-role key or user data is used.
const origins = new Set(['https://aitechd.com','https://www.aitechd.com','https://commons-100.douga071132.chatgpt.site']);
const cache = new Map<string,{at:number;data:unknown}>();
const pending = new Map<string,Promise<unknown>>();
const budgets = new Map<string,{at:number;count:number}>();
let inFlight=0;
function headers(origin:string|null){return {'Access-Control-Allow-Origin':origin&&origins.has(origin)?origin:'https://aitechd.com','Access-Control-Allow-Headers':'apikey, authorization, content-type','Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Max-Age':'600','Vary':'Origin','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};}
function json(data:unknown,origin:string|null,status=200){return Response.json(data,{status,headers:headers(origin)});}
async function fetchListing(initial:URL){
  let url=initial;const signal=AbortSignal.timeout(18000);
  for(let attempt=0;attempt<4;attempt++){
    const response=await fetch(url,{signal,redirect:'manual',headers:{'User-Agent':'AITECH-Search/1.0','Accept':'text/html','Accept-Language':'ja'}});
    if(![301,302,303,307,308].includes(response.status))return response;
    const location=response.headers.get('location');await response.body?.cancel();
    if(!location)throw new Error('掲載元の検索ページに接続できませんでした。');
    const next=new URL(location,url);
    if(next.origin!==initial.origin||next.username||next.password)throw new Error('掲載元の検索ページを確認してください。');
    url=next;
  }
  throw new Error('掲載元の検索ページへの接続が完了しませんでした。');
}
async function boundedText(response:Response){
  if(!response.ok)throw new Error('掲載元への接続に失敗しました。時間をおいて再試行してください。');
  const reader=response.body?.getReader();if(!reader)throw new Error('掲載元の応答が空です。');
  const chunks:Uint8Array[]=[];let length=0;
  while(true){const part=await reader.read();if(part.done)break;length+=part.value.length;if(length>5_000_000){await reader.cancel();throw new Error('結果が大きすぎます。条件を絞ってください。');}chunks.push(part.value);}
  const all=new Uint8Array(length);let i=0;for(const chunk of chunks){all.set(chunk,i);i+=chunk.length;}return new TextDecoder('utf-8').decode(all);
}
export default {async fetch(request:Request){
  const origin=request.headers.get('origin');
  if(origin&&!origins.has(origin))return json({error:'このサイトからは利用できません。'},origin,403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:headers(origin)});
  if(request.method!=='GET')return json({error:'GETのみ利用できます。'},origin,405);
  if(request.headers.get('apikey')!==PUBLIC_KEY)return json({error:'検索サービスの接続設定を確認してください。'},origin,401);
  const url=new URL(request.url),kind=url.searchParams.get('kind');
  if(!['hotel','rental'].includes(kind||''))return json({error:'検索種別を選んでください。'},origin,400);
  const page=Number(url.searchParams.get('page')||1);if(!Number.isInteger(page)||page<1||page>1000)return json({error:'ページ番号が不正です。'},origin,400);
  const query:any=kind==='hotel'?{prefecture:url.searchParams.get('prefecture')||'',area:url.searchParams.get('area')||'',subarea:url.searchParams.get('subarea')||'',destination:'',checkin:url.searchParams.get('checkin')||'',checkout:url.searchParams.get('checkout')||'',adults:Number(url.searchParams.get('adults')),rooms:Number(url.searchParams.get('rooms')),sort:url.searchParams.get('sort')||'price'}:{prefecture:url.searchParams.get('prefecture')||'',station:url.searchParams.get('station')||'',walk:url.searchParams.get('walk')||'',layouts:url.searchParams.getAll('layouts')};
  const invalid=kind==='hotel'?validateHotel(query):validateRental(query,stations);if(invalid)return json({error:invalid},origin,400);
  const upstream=new URL(kind==='hotel'?hotelSearches(query)[1].url:rentalSearches(query,stations)[0].url);
  upstream.searchParams.set(kind==='hotel'?'f_page':'page',String(page));
  const key=upstream.href;const now=Date.now();const saved=cache.get(key);
  if(saved&&now-saved.at<300_000)return json(saved.data,origin);
  const ip=request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'anonymous';
  const budget=budgets.get(ip);if(!budget||now-budget.at>60_000)budgets.set(ip,{at:now,count:1});else if(++budget.count>30)return json({error:'検索が続いています。1分ほど待ってください。'},origin,429);
  if(budgets.size>1000)budgets.clear();
  if(!pending.has(key)){
    if(inFlight>=4)return json({error:'検索が混み合っています。少し待って再試行してください。'},origin,429);
    inFlight++;
    pending.set(key,(async()=>{
      try{
        const response=await fetchListing(upstream);
        const html=await boundedText(response);
        const station=stations.find((s:any)=>s.id===query.station);
        const areas=kind==='hotel'&&!html.includes('htl-list-card')?parseHotelAreas(html,upstream.searchParams.get('f_chu')!):[];
        const parsed=areas.length?{items:[],omitted:0,areas}:kind==='hotel'?parseHotels(html):parseRentals(html,query,station);
        const next=page+1;
        const hasMore=kind==='hotel'?new RegExp('f_page='+next+'(?:&|["\\s])').test(html):new RegExp('(?:[?&]|&amp;)page='+next+'(?:&|["\\s])').test(html);
        const data={...parsed,kind,page,nextPage:hasMore?next:null,source:kind==='hotel'?'楽天トラベル':'SUUMO',sourceUrl:upstream.href,fetchedAt:new Date().toISOString(),scope:kind==='hotel'?'指定した県の楽天トラベル掲載結果。読み込んだ施設内の比較です。':'SUUMO掲載のうち、選択した駅・徒歩・間取りに合う取得結果です。',coverage:'partial',query};
        if(cache.size>=80)cache.delete(cache.keys().next().value!);cache.set(key,{at:Date.now(),data});return data;
      }finally{inFlight--;}
    })());
  }
  try{return json(await pending.get(key),origin);}catch(error){return json({error:error instanceof Error?error.message:'検索に失敗しました。'},origin,502);}finally{pending.delete(key);}
}};
