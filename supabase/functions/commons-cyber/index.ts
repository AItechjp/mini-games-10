import {parseFeed,sha,pool,retryDelay} from './core.mjs';
import {translateText,translationProvider} from './translation.ts';
const REST=Deno.env.get('SUPABASE_URL')+'/rest/v1/';
const KEY=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'apikey,content-type,x-cyber-token','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff'};
const headers={apikey:KEY,Authorization:'Bearer '+KEY,'Content-Type':'application/json'};
const iso=(ms=Date.now())=>new Date(ms).toISOString();
async function db(path:string,method='GET',body?:unknown,prefer='return=representation'){
 const r=await fetch(REST+path,{method,headers:{...headers,Prefer:prefer},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
 if(!r.ok){console.error('cyber db',r.status,(await r.text()).slice(0,300));throw new Error('保存先への接続に失敗しました');}
 return r.status===204||prefer.includes('return=minimal')?null:r.json();
}
function json(body:unknown,status=200,cache=false){return new Response(JSON.stringify(body),{status,headers:{...CORS,'Cache-Control':cache?'public, max-age=15':'no-store'}});}
async function limitedText(r:Response,max=2500000){const reader=r.body!.getReader();const parts:Uint8Array[]=[];let size=0;try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>max)throw new Error('RSSが取得上限を超えました');parts.push(value);}}finally{await reader.cancel().catch(()=>{});}const data=new Uint8Array(size);let off=0;for(const p of parts){data.set(p,off);off+=p.length;}const start=new TextDecoder().decode(data.slice(0,250));const charset=start.match(/encoding=["']([^"']+)/i)?.[1]||'utf-8';try{return new TextDecoder(charset).decode(data);}catch{return new TextDecoder().decode(data);}}
async function feedFetch(url:string,requestHeaders:Record<string,string>,allowed:Set<string>){const signal=AbortSignal.timeout(9000);for(let i=0;i<4;i++){const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password||!allowed.has(u.hostname))throw new Error('未登録の配信先への転送');const r=await fetch(u,{headers:requestHeaders,signal,redirect:'manual'});if(r.status>=300&&r.status<400&&r.status!==304){const loc=r.headers.get('location');await r.body?.cancel();if(!loc)throw new Error('転送先がありません');url=new URL(loc,u).href;continue;}return r;}throw new Error('RSSの転送回数超過');}
async function collectOne(source:any,allowed:Set<string>){
 const now=Date.now();let status:number|null=null,retry:string|null=null;
 try{
  const h:Record<string,string>={'User-Agent':'AItech-CyberNews/1.0 (+https://aitechd.com/commons/cyber-news/)','Accept':'application/rss+xml,application/atom+xml,application/rdf+xml,application/xml,text/xml;q=0.9'};
  if(source.etag)h['If-None-Match']=source.etag;if(source.last_modified)h['If-Modified-Since']=source.last_modified;
  const r=await feedFetch(source.feed_url,h,allowed);status=r.status;retry=r.headers.get('retry-after');
  if(status===304){await db('cyber_sources?id=eq.'+source.id,'PATCH',{last_checked_at:iso(),last_ok_at:iso(),next_check_at:iso(now+Math.max(60000,Math.min(21600000,(Date.parse(source.next_check_at)-Date.parse(source.last_checked_at))||60000))),http_status:status,error:null,failures:0},'return=minimal');return;}
  if(!r.ok){await r.body?.cancel();throw new Error('HTTP '+status);}
  const xml=await limitedText(r,["google-project-zero","elastic-security-labs","wordfence","microsoft-msrc-updates"].includes(source.id)?8000000:2500000),{items,undated}=parseFeed(xml,source,Date.now());
  const rows=[];for(const item of items){const ja=source.language==='ja';rows.push({...item,id:await sha(item.url),fetched_at:iso(),title_ja:ja?item.title_original:null,body_ja:ja?item.body_original:null,translation_status:ja?'ready':'pending',translator:ja?'原文（日本語）':null,translated_at:ja?iso():null});}
  if(rows.length)await db('cyber_articles?on_conflict=url','POST',rows,'resolution=ignore-duplicates,return=minimal');
  // RSS ttl is a publisher-supplied minimum interval, not an invented freshness claim.
  const ttl=Number(xml.match(/<ttl>\s*(\d+)\s*<\/ttl>/i)?.[1]||0);
  await db('cyber_sources?id=eq.'+source.id,'PATCH',{last_checked_at:iso(),last_ok_at:iso(),next_check_at:iso(now+Math.max(60000,Math.min(ttl,360)*60000)),http_status:status,error:null,failures:0,etag:r.headers.get('etag'),last_modified:r.headers.get('last-modified'),recent_count:items.length,skipped_undated:undated,...(items.length?{latest_article_at:items.reduce((a:any,b:any)=>a.published_at>b.published_at?a:b).published_at}:{})},'return=minimal');
 }catch(e){const raw=e instanceof Error?e.message:'取得に失敗しました';const message=/certificate|tls/i.test(raw)?'TLS接続・証明書の検証に失敗しました':/timeout|aborted/i.test(raw)?'通信タイムアウト（9秒）':/error sending|dns|connect|http2/i.test(raw)?'配信元との通信に失敗しました':raw;await db('cyber_sources?id=eq.'+source.id,'PATCH',{last_checked_at:iso(),next_check_at:iso(now+retryDelay(source.failures+1,status,retry)),http_status:status,error:message.slice(0,180),failures:source.failures+1},'return=minimal');}
}
async function translateQueue(deadline:number){
 if(!translationProvider()){await db('cyber_control?id=eq.1','PATCH',{translation_error:'翻訳APIが未設定です'},'return=minimal');return 0;}
 const rows=await db('cyber_articles?translation_status=neq.ready&expires_at=gt.'+encodeURIComponent(iso())+'&next_translation_at=lte.'+encodeURIComponent(iso())+'&order=translation_attempts.asc,published_at.desc&limit=50');
 let error:string|null=null,count=0;
 await pool(rows,4,async(a:any)=>{
  if(Date.now()>deadline)return;
  try{
   const title=await translateText(a.title_original,a.language);
   // Persist the headline first so a long RSS body cannot hide a translated story.
   await db('cyber_articles?id=eq.'+a.id,'PATCH',{title_ja:title,translation_status:'partial'},'return=minimal');
   const body=await translateText(a.body_original,a.language);
   await db('cyber_articles?id=eq.'+a.id,'PATCH',{body_ja:body,translation_status:'ready',translated_at:iso(),translation_error:null,translator:translationProvider()+'（機械翻訳）'},'return=minimal');count++;
  }catch(e){error=e instanceof Error?e.message:'翻訳に失敗しました';await db('cyber_articles?id=eq.'+a.id,'PATCH',{translation_error:error,translation_attempts:a.translation_attempts+1,next_translation_at:iso(Date.now()+Math.min(3600000,60000*2**Math.min(a.translation_attempts,6)))},'return=minimal');}
 });
 await db('cyber_control?id=eq.1','PATCH',{translation_error:error,...(count?{last_translation_at:iso()}:{})},'return=minimal');
 return count;
}
async function collect(){
 if(!await db('rpc/cyber_claim','POST',{}))return {ok:true,skipped:'already_running'};
 const start=Date.now();let ok=false;
 try{
  const sources=await db('cyber_sources?enabled=eq.true&order=rank.asc');
  const allowed=new Set<string>(['feeds.feedburner.com','feeds2.feedburner.com','feedproxy.google.com']);for(const s of sources){for(const raw of [s.feed_url,s.website]){const host=new URL(raw).hostname;allowed.add(host);allowed.add(host.startsWith('www.')?host.slice(4):'www.'+host);}}
  const due=sources.filter((s:any)=>Date.parse(s.next_check_at)<=start);let checked=0;
  await pool(due,12,async(s:any)=>{if(Date.now()-start>37000)return;await collectOne(s,allowed);checked++;});
  const translated=await translateQueue(start+51000);
  await db('cyber_control?id=eq.1','PATCH',{last_completed_at:iso(),last_error:null,scan_count:checked},'return=minimal');ok=true;
  return {ok:true,checked,translated,duration_ms:Date.now()-start};
 }finally{await db('cyber_control?id=eq.1','PATCH',{lease_until:null,...(!ok?{last_error:'巡回処理が完了しませんでした。次の定期実行で再試行します。'}:{})},'return=minimal');}
}
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
 try{
  if(req.method==='POST'){
   // Collector writes require a private Vault token; public API keys cannot trigger it.
   const token=req.headers.get('x-cyber-token')||'';if(!/^[a-f0-9]{64}$/.test(token))return json({error:'認証が必要です'},401);
   const control=await db('cyber_control?id=eq.1&select=token_hash');if(await sha(token)!==control[0]?.token_hash)return json({error:'認証に失敗しました'},403);
   return json(await collect());
  }
  if(req.method!=='GET')return json({error:'Method not allowed'},405);
  const u=new URL(req.url),id=u.searchParams.get('id');
  if(id){if(!/^[a-f0-9]{64}$/.test(id))return json({error:'記事が見つかりません'},404);const rows=await db('cyber_articles?id=eq.'+id+'&expires_at=gt.'+encodeURIComponent(iso())+'&title_ja=not.is.null&select=id,source_id,url,title_original,title_ja,body_ja,published_at,expires_at,date_basis,translation_status,body_truncated,translator,translated_at');return rows.length?json(rows[0],200,true):json({error:'記事の保存期間（72時間）が終了したか、記事が見つかりません。'},404);}
  const before=u.searchParams.get('before');if(before&&!Number.isFinite(Date.parse(before)))return json({error:'日時が正しくありません'},400);
  const data=await db('rpc/cyber_read','POST',{p_query:(u.searchParams.get('q')||'').slice(0,120),p_source:(u.searchParams.get('source')||'').slice(0,70),p_category:(u.searchParams.get('category')||'').slice(0,40),p_before:before,p_before_id:(u.searchParams.get('before_id')||'').slice(0,64),p_limit:60});
  data.translation={configured:Boolean(translationProvider()),provider:translationProvider()};
  return json(data,200,true);
 }catch(e){console.error(e);return json({error:'ニュースを取得できませんでした。時間をおいて再試行してください。'},503);}
});
