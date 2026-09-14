export const INTERVAL=300000, RETENTION=30*86400000, PER_SOURCE=120;
export function text(value='') {
 return String(value).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/<[^>]*>/g,' ').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,s)=>{
  const fixed={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};if(fixed[s.toLowerCase()])return fixed[s.toLowerCase()];
  const n=s[1]?.toLowerCase()==='x'?parseInt(s.slice(2),16):parseInt(s.slice(1),10);return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):'';
 }).replace(/[\u0000-\u001f\u007f]/g,' ').replace(/\s+/g,' ').trim();
}
function tag(xml,name){return xml.match(new RegExp('<'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+name+'>','i'))?.[1]||'';}
function date(value){const n=Date.parse(text(value));return Number.isFinite(n)?new Date(n).toISOString():null;}
function attr(xml,name){return xml.match(new RegExp('(?:^|\\s)'+name+'\\s*=\\s*["\x27]([^"\x27]*)["\x27]','i'))?.[1]||'';}
export function safeEpisode(raw,source){
 try{const u=new URL(text(raw),source.website),origin=new URL(source.website);if(u.protocol!=='https:'||u.origin!==origin.origin||u.username||u.password||!/^\/episode\/\d+\/?$/.test(u.pathname))return null;u.search='';u.hash='';return u.href.replace(/\/$/,'');}catch{return null;}
}
export function parseFeed(xml,source,now=Date.now()){
 if(!/<feed(?:\s|>)/i.test(xml)||!/<\/feed>\s*$/i.test(xml)||/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('公式フィードの形式を確認できません');
 const items=new Map();let skipped=0;
 for(const match of xml.matchAll(/<entry(?:\s[^>]*)?>([\s\S]*?)<\/entry>/gi)){
  const entry=match[1];let url=null;
  for(const link of entry.matchAll(/<link\s+[^>]*>/gi)){const rel=attr(link[0],'rel');if(rel&&rel!=='alternate')continue;url=safeEpisode(attr(link[0],'href'),source);if(url)break;}
  const episode=text(tag(entry,'title')).slice(0,200),series=text(tag(entry,'content')).slice(0,160);
  const updatedAt=date(tag(entry,'updated'))||date(tag(entry,'published'));
  if(!url||!episode||!updatedAt||Date.parse(updatedAt)>now+300000||Date.parse(updatedAt)<now-RETENTION){skipped++;continue;}
  const title=series&&!episode.includes(series)?series+' / '+episode:episode;
  items.set(url,{url,sourceId:source.id,title,author:text(tag(tag(entry,'author'),'name')).slice(0,100),updatedAt,freeFrom:date(tag(entry,'giga:freeTermStartDate')),freeUntil:date(tag(entry,'giga:freeTermEndDate'))});
 }
 return {items:[...items.values()].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,PER_SOURCE),skipped};
}
export function retryDelay(failures,retryAfter,now=Date.now()){
 const value=Number(retryAfter),requested=retryAfter?(Number.isFinite(value)?value*1000:Date.parse(retryAfter)-now):0;
 return Math.max(INTERVAL*Math.min(2**Math.min(failures,7),144),Number.isFinite(requested)?Math.min(Math.max(0,requested),7*86400000):0);
}
export function nextInterval(cacheControl='',ttl=0){const age=Number(cacheControl.match(/(?:^|,)\s*max-age=(\d+)/i)?.[1]||0);return Math.max(INTERVAL,age*1000,ttl*60000);}
export async function limitedText(response,max=1100000){
 if(!response.body)throw new Error('空の応答でした');const reader=response.body.getReader(),chunks=[];let length=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>max)throw new Error('フィードの取得上限を超えました');chunks.push(value);}}finally{await reader.cancel().catch(()=>{});}
 const bytes=new Uint8Array(length);let offset=0;for(const value of chunks){bytes.set(value,offset);offset+=value.length;}return new TextDecoder().decode(bytes);
}
export async function collectSource(source,previous={},previousItems=[],fetcher=fetch,now=Date.now()){
 const current={...previous,...source};const existing=previousItems.filter(x=>x.sourceId===source.id&&Date.parse(x.updatedAt)>=now-RETENTION);
 if(Date.parse(previous.nextCheckAt)>now)return {source:current,items:existing};
 let status=null,retryAfter=null;
 try{
  const headers={'Accept':'application/atom+xml,application/xml;q=0.9','User-Agent':'AItech-MangaLinks/1.0 (+https://aitechd.com/commons/manga/)'};
  if(previous.etag)headers['If-None-Match']=previous.etag;if(previous.lastModified)headers['If-Modified-Since']=previous.lastModified;
  const response=await fetcher(source.feed,{headers,signal:AbortSignal.timeout(10000),redirect:'manual'});status=response.status;retryAfter=response.headers.get('retry-after');
  if(status!==200&&status!==304){await response.body?.cancel();throw new Error(status>=300&&status<400?'配信先が転送されました。登録先の確認が必要です':'HTTP '+status);}
  if(status===304&&!previous.lastSuccessAt)throw new Error('初回取得の内容を確認できません');
  const result=status===304?{items:existing,skipped:previous.skipped||0}:parseFeed(await limitedText(response),source,now);
  if(status===200){const byURL=new Map(existing.map(x=>[x.url,x]));result.items=result.items.map(item=>{const old=byURL.get(item.url);return old&&old.updatedAt===item.updatedAt&&old.freeFrom===item.freeFrom&&old.freeUntil===item.freeUntil?{...old,...item}:item;});}
  return {items:result.items,source:{...current,status:'ok',httpStatus:status,lastCheckedAt:new Date(now).toISOString(),lastSuccessAt:new Date(now).toISOString(),contentFetchedAt:status===304?previous.contentFetchedAt:new Date(now).toISOString(),nextCheckAt:new Date(now+nextInterval(response.headers.get('cache-control')||'')).toISOString(),etag:response.headers.get('etag')||previous.etag||null,lastModified:response.headers.get('last-modified')||previous.lastModified||null,error:null,failures:0,count:result.items.length,skipped:result.skipped}};
 }catch(error){
  const reason=error?.name==='TimeoutError'||error?.name==='AbortError'?'通信タイムアウト':/HTTP|フィード|転送|取得上限|初回|空の応答/.test(error?.message||'')?error.message:'配信元への接続に失敗しました';
  return {items:existing,source:{...current,status:'error',httpStatus:status,lastCheckedAt:new Date(now).toISOString(),lastSuccessAt:previous.lastSuccessAt||null,nextCheckAt:new Date(now+retryDelay((previous.failures||0)+1,retryAfter,now)).toISOString(),error:reason,failures:(previous.failures||0)+1,count:existing.length}};
 }
}
