export const RETENTION_MS=72*3600000;
export const BODY_LIMIT=3000;
const entities={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' ',ndash:'–',mdash:'—',lsquo:'‘',rsquo:'’',ldquo:'“',rdquo:'”',hellip:'…',copy:'©',reg:'®'};
export function decode(s='') {return String(s).replace(/&#(x[0-9a-f]+|\d+);|&([a-z]+);/gi,(all,n,k)=>{if(k)return entities[k.toLowerCase()]??all;const v=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):parseInt(n,10);return v>0&&v<=0x10ffff&&!(v>=0xd800&&v<=0xdfff)?String.fromCodePoint(v):'�';});}
export function plain(s='') {return decode(decode(String(s).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1')).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,' ').replace(/<(br|\/p|\/div|\/li)\b[^>]*>/gi,'\n').replace(/<[^>]*>/g,' ')).replace(/[\t \u00a0]+/g,' ').replace(/\n\s*\n\s*\n/g,'\n\n').trim();}
function field(block,name) {const safe=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');return block.match(new RegExp('<'+safe+'(?:\\s[^>]*)?>([\\s\\S]*?)<\\/'+safe+'\\s*>','i'))?.[1]??'';}
export function safeUrl(value,base) {try{const u=new URL(decode(value).trim(),base);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)return null;u.hash='';for(const key of [...u.searchParams.keys()])if(/^(utm_|fbclid$|gclid$|mc_cid$|mc_eid$)/i.test(key))u.searchParams.delete(key);return u.href.length<=2000?u.href:null;}catch{return null;}}
function link(block,base) {
 const direct=plain(field(block,'link'));if(direct)return safeUrl(direct,base);
 for(const m of block.matchAll(/<link\b([^>]*?)\/?\s*>/gi)){const rel=m[1].match(/\brel=["']([^"']*)["']/i)?.[1];const href=m[1].match(/\bhref=["']([^"']+)["']/i)?.[1];if(href&&(!rel||rel==='alternate'))return safeUrl(href,base);}
 const id=plain(field(block,'guid')||field(block,'id'));return /^https?:\/\//i.test(id)?safeUrl(id):null;
}
export function parseFeed(xml,source,now=Date.now()) {
 if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw new Error('RSSに未対応の文書宣言があります');
 if(!/<(?:rss|feed|rdf:RDF)\b/i.test(xml))throw new Error('RSS・Atom形式ではありません');
 const items=[];let undated=0;const seen=new Set();
 const blocks=[...xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi)];
 for(const m of blocks.slice(0,350)){
  const b=m[2],title=plain(field(b,'title')).slice(0,600),url=link(b,source.website);
  const published=plain(field(b,'pubDate')||field(b,'published')||field(b,'dc:date'));
  const date=published||plain(field(b,'updated')),ms=Date.parse(date);
  if(!Number.isFinite(ms)){undated++;continue;}
  if(!title||!url||ms<=now-RETENTION_MS||ms>now||seen.has(url))continue;
  seen.add(url);
  // Use the publisher's RSS description. Never scrape/paywall-extract article pages.
  const body=plain(field(b,'description')||field(b,'summary')||field(b,'content:encoded')||field(b,'content'));
  items.push({url,title_original:title,body_original:body.slice(0,BODY_LIMIT),body_truncated:body.length>BODY_LIMIT,source_id:source.id,language:source.language,category:classify(title+' '+body),published_at:new Date(ms).toISOString(),expires_at:new Date(ms+RETENTION_MS).toISOString(),date_basis:published?'published':'updated'});
 }
 return {items,undated};
}
export function classify(text){if(/ransom|ランサム/i.test(text))return 'ransomware';if(/CVE-\d|vulnerab|zero.day|脆弱性|ゼロデイ/i.test(text))return 'vulnerability';if(/breach|leak|exfiltrat|漏えい|漏洩|流出/i.test(text))return 'breach';if(/phish|フィッシング/i.test(text))return 'phishing';if(/malware|botnet|trojan|マルウェア/i.test(text))return 'malware';if(/APT\d|espionage|nation.state|スパイ/i.test(text))return 'apt';return 'security';}
export async function sha(s){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(n=>n.toString(16).padStart(2,'0')).join('');}
export function retryDelay(failures,status,retryAfter,now=Date.now()){
 const seconds=Number(retryAfter),date=Date.parse(retryAfter||'');const server=Number.isFinite(seconds)&&seconds>0?seconds*1000:Number.isFinite(date)?date-now:0;
 return Math.min(6*3600000,Math.max(60000*(2**Math.min(failures,8)),status===429?300000:60000,server));
}
export async function pool(values,n,fn){let next=0;await Promise.all(Array.from({length:Math.min(n,values.length)},async()=>{while(next<values.length){const i=next++;await fn(values[i],i);}}));}
export function chunks(text,max=1800){const out=[];while(text.length>max){let pos=text.lastIndexOf(' ',max);if(pos<max/2)pos=max;out.push(text.slice(0,pos));text=text.slice(pos).trimStart();}if(text)out.push(text);return out;}
