export const KANTO='https://lfb.mof.go.jp/kantou/kinyuu/kashikin/akusitsu.htm';
export const INPIT='https://chizai-portal.inpit.go.jp/madoguchi/osaka/news/post_82.html';
export const normalize=value=>String(value??'').normalize('NFKC').replace(/[‐‑‒–—―ー−]/g,'-');
export function plain(value){return normalize(String(value).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' ').replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>String.fromCodePoint(Math.min(0x10ffff,n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n)))).replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"')).replace(/\s+/g,' ').trim();}
export function japaneseDate(value){const t=normalize(value);let m=t.match(/(令和|平成)(元|\d+)年\s*(\d+)月\s*(\d+)日/);if(m)return `${(m[1]==='令和'?2018:1988)+(m[2]==='元'?1:Number(m[2]))}-${m[3].padStart(2,'0')}-${m[4].padStart(2,'0')}`;m=t.match(/(20\d{2})[年/.-]\s*(\d{1,2})[月/.-]\s*(\d{1,2})/);return m?`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`:null;}
const rows=html=>[...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map(m=>[...m[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map(c=>c[1]));
const phones=t=>[...normalize(t).matchAll(/(?<![\d-])(0[\d]{1,4}-[\d×xX]{1,4}-[\d×xX]{2,4})(?![\d-])/g)].map(m=>m[1].replace(/[xX]/g,'×')).filter(n=>{const s=n.replace(/-/g,'');return /^[\d×]{10,11}$/.test(s)});
function record(number,publishedAt,url,checkedAt,extra={}){return {id:url+'#'+number+'-'+publishedAt,number,numberType:number.includes('×')?'masked':'full',category:'lending',title:'悪質な貸金業者への公的警告',summary:'関東財務局の警告資料に記載された電話番号。公表時点の情報であり、現在の利用者や営業状況を示すとは限りません。',publishedAt,source:'関東財務局',sourceUrl:url,checkedAt,...extra};}
export function parseKantoIndex(html,checkedAt){
 if(!plain(html).includes('悪質な貸金業者の情報'))throw new Error('警告一覧の構成が変わりました');
 const items=[],details=[];
 for(const cells of rows(html)){
  const text=cells.map(plain);
  if(cells.length===4&&text[3]&&japaneseDate(text[3])){const link=cells[0].match(/href=["']([^"']+)["']/i)?.[1];if(link){const url=new URL(link,KANTO);if(url.origin==='https://lfb.mof.go.jp'&&/^\/kantou\/kinyuu\/pagekt_[\w]+\.html$/.test(url.pathname))details.push({url:url.href,publishedAt:japaneseDate(text[3])});}}
  // Only the second cell in warning rows, and only the telephone label (never FAX/contact footers).
  if(cells.length===6&&/^\d+$/.test(text[0])){const m=text[1].match(/電話\s*:\s*([\d×xX-]+)/);if(m)for(const number of phones(m[1]))items.push(record(number,japaneseDate(text[5]),KANTO,checkedAt));}
 }
 if(!details.length&&!items.length)throw new Error('警告対象の欄を確認できませんでした');
 return {items,details:details.slice(0,40),sourcePublishedAt:japaneseDate(plain(html).match(/最終更新日.{0,35}/)?.[0]||'')};
}
export function parseKantoDetail(html,url,publishedAt,checkedAt){
 if(!plain(html).includes('無登録で貸金業を行っている者等'))throw new Error('警告資料の構成が変わりました');
 const cell=rows(html).find(c=>c.length===2&&plain(c[0])==='電話番号等');
 if(!cell)throw new Error('電話番号欄が見つかりません');
 const t=plain(cell[1]);const entries=[];
 // A number must explicitly precede the phone marker; fax-only numbers never qualify.
 for(const match of t.matchAll(/([\d×xX-]+)\s*\(電話\)/g))for(const n of phones(match[1]))entries.push(record(n,publishedAt,url,checkedAt));
 if(!entries.length&&!/該当なし|不明|記載なし/.test(t))throw new Error('電話番号欄の形式が変わりました');
 return entries;
}
export function parseInpit(html,checkedAt){const t=plain(html);if(!t.includes('旧電話番号')||!t.includes('特殊詐欺'))throw new Error('注意喚起の構成が変わりました');const n='06-6110-5746';if(!t.includes(n))throw new Error('掲載番号を再確認できませんでした');return [record(n,'2025-11-27',INPIT,checkedAt,{category:'fraud',source:'INPIT 大阪府知財総合支援窓口',title:'旧窓口番号を利用した特殊詐欺への注意喚起',summary:'INPITが旧窓口の電話番号を使った特殊詐欺の発生を公表。この番号は現在の知財相談窓口ではありません。'})];}
export async function fetchSource(url,fetcher=fetch,timeoutMs=12000){
 const signal=AbortSignal.timeout(timeoutMs);let current=new URL(url);
 for(let i=0;i<3;i++){
  const response=await fetcher(current.href,{signal,redirect:'manual',headers:{'User-Agent':'AITECH-PhoneWatch/1.0 (+https://aitechd.com/commons/phone-watch/)','Accept':'text/html','Accept-Language':'ja'}});
  if([301,302,303,307,308].includes(response.status)){const location=response.headers.get('location');await response.body?.cancel();if(!location)throw new Error('転送先が不明です');const next=new URL(location,current);if(next.origin!==new URL(url).origin||next.username||next.password)throw new Error('掲載元の転送先を確認してください');current=next;continue;}
  if(!response.ok)throw new Error('掲載元に接続できません (HTTP '+response.status+')');
  if(!response.headers.get('content-type')?.includes('text/html'))throw new Error('HTML形式を取得できません');
  const reader=response.body?.getReader();if(!reader)throw new Error('応答が空です');let size=0;const chunks=[];
  while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>1500000){await reader.cancel();throw new Error('資料のサイズを確認してください');}chunks.push(r.value);}
  const data=new Uint8Array(size);let offset=0;for(const c of chunks){data.set(c,offset);offset+=c.length;}
  return new TextDecoder('utf-8').decode(data);
 }throw new Error('転送が完了しませんでした');
}
export async function collect(previous=null,fetcher=fetch){
 const items=[],sources=[],deadline=Date.now()+50000;
 async function read(url,name,parser){const attemptedAt=new Date().toISOString();try{const remaining=deadline-Date.now();if(remaining<=0)throw new Error('収集時間の上限に達したため再確認できませんでした');const html=await fetchSource(url,fetcher,Math.min(12000,remaining));const checkedAt=new Date().toISOString();const parsed=parser(html,checkedAt);const entries=Array.isArray(parsed)?parsed:parsed.items;items.push(...entries);sources.push({url,name,status:'ok',checkedAt,attemptedAt,recordCount:entries.length});return parsed;}catch(e){const old=(previous?.items||[]).filter(r=>r.sourceUrl===url);items.push(...old.map(r=>({...r,stale:true})));sources.push({url,name,status:'error',checkedAt:previous?.sources?.find(s=>s.url===url)?.checkedAt||null,attemptedAt,recordCount:old.length,error:e.name==='TimeoutError'?'掲載元の応答が時間内に届きませんでした':e.message});return null;}}
 const [index]=await Promise.all([read(KANTO,'関東財務局・悪質な貸金業者一覧',parseKantoIndex),read(INPIT,'INPIT・旧電話番号の悪用への警告',parseInpit)]);
 if(index){const queue=[...index.details];await Promise.all(Array.from({length:4},async()=>{while(queue.length){const d=queue.shift();await read(d.url,'関東財務局・個別警告 '+d.publishedAt,(h,at)=>parseKantoDetail(h,d.url,d.publishedAt,at));}}));}
 else{for(const s of previous?.sources||[]){if(s.url!==KANTO&&s.url!==INPIT){sources.push({...s,status:'error',error:'警告一覧が未取得のため再確認できませんでした'});items.push(...(previous.items||[]).filter(r=>r.sourceUrl===s.url).map(r=>({...r,stale:true})));}}}
 const unique=[...new Map(items.map(r=>[r.id,r])).values()].sort((a,b)=>(b.publishedAt||'').localeCompare(a.publishedAt||''));
 return {items:unique,sources,attemptedAt:new Date().toISOString(),refreshSeconds:60,sourceRefreshSeconds:300,coverage:'登録した公的機関の警告資料のみ。全国の迷惑・詐欺電話を網羅していません。'};
}
