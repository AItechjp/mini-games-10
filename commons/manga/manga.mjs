const API='https://dcvtubivtextycifngtk.supabase.co/functions/v1/commons-manga';
const $=id=>document.getElementById(id);
const format=new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
const kinds={publisher:'出版社・公式連載',store:'無料巻・電子書店',library:'無料の読み放題',creator:'作者投稿・公開作品'};
let data=null,configured=[],mode='links',limit=40,busy=false,clockOffset=0,nextRefresh=Date.now()+60000,toastTimer;
const now=()=>Date.now()+clockOffset;
const fmt=v=>v&&Number.isFinite(Date.parse(v))?format.format(new Date(v)):'未確認';
const normalize=v=>v.normalize('NFKC').toLocaleLowerCase('ja');
function el(tag,className,value){const n=document.createElement(tag);if(className)n.className=className;if(value!==undefined)n.textContent=value;return n;}
function safeURL(raw,source,episode=false){try{const u=new URL(raw),base=new URL(source.website);return u.protocol==='https:'&&!u.username&&!u.password&&u.origin===base.origin&&(!episode||/^\/episode\/\d+\/?$/.test(u.pathname))?u.href:null;}catch{return null;}}
function link(label,url,source,episode=false){const a=el('a','',label),href=safeURL(url,source,episode);if(href){a.href=href;a.target='_blank';a.rel='noopener noreferrer';}return a;}
function isFree(item){const t=Date.parse(item.verifiedAt);return item.access==='free'&&item.proof==='public-reader'&&Number.isFinite(t)&&t<=now()+60000&&now()-t<21600000&&(!item.freeFrom||Date.parse(item.freeFrom)<=now())&&(!item.freeUntil||Date.parse(item.freeUntil)>now());}
function freeItems(){return (data?.items||[]).filter(isFree);}
function fresh(s){return s.status==='ok'&&Date.parse(s.nextCheckAt)+300000>=now();}
function sources(){return configured.map(s=>({...data?.sources?.find(x=>x.id===s.id),...s}));}
function showMode(value){mode=value;$('links-view').hidden=value!=='links';$('sites-view').hidden=value!=='sites';$('view-title').textContent=value==='links'?'無料漫画を探す':'無料サイトを探す';for(const v of ['links','sites']){$(v+'-tab').classList.toggle('selected',v===value);$(v+'-tab').setAttribute('aria-pressed',String(v===value));}saveQuery();}
function syncFilters(){const saved=$('source').value;$('source').replaceChildren(new Option('すべての収集先',''));for(const s of sources().filter(s=>s.feed))$('source').append(new Option(s.name,s.id));$('source').value=configured.some(x=>x.id===saved&&x.feed)?saved:'';}
function renderMeta(){
 const ss=sources(),feeds=ss.filter(s=>s.feed),items=freeItems();$('site-count').textContent=ss.length;$('nav-sources').textContent=ss.length;
 if(!data)return;
 $('link-count').textContent=items.length.toLocaleString('ja-JP');$('nav-count').textContent=items.length.toLocaleString('ja-JP');
 $('collected').textContent=data.collectedAt?fmt(data.collectedAt):'初回巡回を待っています';
 const c=data.coverage||{};$('coverage').textContent=`配信サイト ${ss.length}件 / 新着の自動収集 ${feeds.length}サイト（取得成功 ${feeds.filter(fresh).length}）。候補 ${c.candidates||0}話のうち、無料確認 ${items.length}話、確認待ち・再確認 ${c.pending||0}話。`;
 const notices=[];if(data.error)notices.push(data.error);
 if(!data.collectedAt)notices.push('初回の確認中です。無料サイト一覧からも漫画を探せます。');
 else if(now()-Date.parse(data.collectedAt)>720000)notices.push('自動収集が遅れています。各話の無料確認日時もご確認ください。');
 if(feeds.some(s=>s.status==='error'))notices.push('取得できなかった収集先があります。サイト一覧で状況を確認できます。');
 if(data.collecting)notices.push('新着の収集・無料条件の確認中です。');
 const message=notices.join(' ');if($('notice').textContent!==message)$('notice').textContent=message;$('notice').hidden=!message;
}
function saveQuery(){const p=new URLSearchParams();if($('query').value.trim())p.set('q',$('query').value.trim());if($('source').value)p.set('source',$('source').value);if($('period').value!=='30')p.set('days',$('period').value);if(mode==='sites')p.set('view','sites');if($('site-query').value.trim())p.set('siteq',$('site-query').value.trim());if($('site-kind').value)p.set('kind',$('site-kind').value);history.replaceState(null,'',location.pathname+(p.size?'?'+p:''));}
function filteredItems(){const ss=sources(),q=normalize($('query').value.trim()),source=$('source').value,cutoff=now()-Number($('period').value)*86400000;return freeItems().filter(item=>{const s=ss.find(x=>x.id===item.sourceId);return s&&safeURL(item.url,s,true)&&Date.parse(item.updatedAt)>=cutoff&&(!source||source===item.sourceId)&&(!q||normalize([item.title,item.author,s.name,s.publisher].join(' ')).includes(q));}).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));}
function renderLinks(){
 if(!data)return;const root=$('links'),ss=sources(),items=filteredItems();
 $('result-count').textContent=items.length.toLocaleString('ja-JP')+'話 · 更新が新しい順';root.replaceChildren();
 if(!items.length){const empty=el('div','empty');empty.append(el('strong','','この条件で無料を確認できた新着話はありません'),el('span','','作品名を短くするか、配信サイトの一覧から過去作品・無料巻も探せます。'));const reset=el('button','','条件をリセット');reset.onclick=()=>{$('query').value='';$('source').value='';$('period').value='30';filterChanged();};const browse=el('button','','無料サイトを探す');browse.onclick=()=>showMode('sites');empty.append(reset,browse);root.append(empty);}
 for(const [i,item] of items.slice(0,limit).entries()){
  const s=ss.find(x=>x.id===item.sourceId),row=el('article','link-row');row.style.setProperty('--source',s.color);row.append(el('span','number',String(i+1).padStart(2,'0')));
  const main=el('div','row-main'),meta=el('div','row-meta');meta.append(el('span','source-name',s.name),el('span','badge','この話の無料公開を確認'));
  const title=el('h2');title.append(link(item.title,item.url,s,true));main.append(meta,title);if(item.author)main.append(el('p','author',item.author));
  const verified=el('p','verified','無料確認 '+fmt(item.verifiedAt)+(item.freeUntil?' · 公開期限 '+fmt(item.freeUntil):''));main.append(verified);
  const url=link(item.url,item.url,s,true);url.className='url';main.append(url);
  const actions=el('div','actions'),time=el('time','');time.dateTime=item.updatedAt;time.append(el('span','','配信元の更新'),document.createTextNode(fmt(item.updatedAt)));
  const read=link('無料の話を読む ↗',item.url,s,true);read.className='read';const copy=el('button','copy','URLをコピー');copy.type='button';copy.setAttribute('aria-label',item.title+'のURLをコピー');copy.onclick=()=>copyURL(item.url);actions.append(time,read,copy);row.append(main,actions);root.append(row);
 }
 $('more').hidden=items.length<=limit;$('more').textContent='さらに'+Math.min(40,Math.max(0,items.length-limit))+'件表示';
}
function renderSources(){
 const root=$('sites'),q=normalize($('site-query').value.trim()),kind=$('site-kind').value;
 const list=sources().filter(s=>(!kind||s.kind===kind)&&(!q||normalize([s.name,s.publisher,s.freeNote].join(' ')).includes(q)));
 root.replaceChildren();$('site-result').textContent=list.length+'サイト · 配信元の無料対象から選んで読めます';
 if(!list.length){root.append(el('p','empty','条件に合うサイトがありません。検索語や種類を変更してください。'));return;}
 for(const [i,s] of list.entries()){
  const card=el('article','site');card.style.setProperty('--source',s.color);const top=el('div','site-top');top.append(el('span','',kinds[s.kind]));top.append(el('span','status',s.feed?'新着話も収集':'配信元の一覧へ'));card.append(top,el('h2','',s.name),el('p','publisher',s.publisher),el('p','site-description',s.freeNote));
  const row=el('div','site-links');const open=link('無料の漫画を探す ↗',s.website,s);open.className='site-primary';row.append(open);
  if(s.feed){const b=el('button','site-filter','確認済みの新着話 '+freeItems().filter(x=>x.sourceId===s.id).length+'件');b.onclick=()=>{$('source').value=s.id;$('query').value='';$('period').value='30';showMode('links');filterChanged();};row.append(b);}card.append(row);
  const details=el('details','site-details');details.append(el('summary','',s.feed?'収集と無料確認の状況':'掲載範囲・リンク確認日'));const dl=el('dl');
  const values=s.feed?[['更新の取得',s.status==='error'?'取得失敗':fresh(s)?'取得成功':s.status==='ok'?'再確認待ち':'確認中'],['最終取得',fmt(s.lastSuccessAt)],['無料の確認待ち',String(s.coverage?.pending||0)+'話'],['次の巡回',s.nextCheckAt?fmt(s.nextCheckAt):'順次確認']]:[['案内URLの確認',fmt(s.directoryCheckedAt)],['収集範囲','サイトへのリンク案内。個々の話の自動収集は未対応']];
  for(const [key,value] of values)dl.append(el('dt','',key),el('dd','',value));details.append(dl);if(s.error)details.append(el('p','source-error',s.error));if(s.feed)details.append(link('配信元の更新情報 ↗',s.feed,s));card.append(details);root.append(card);
 }
}
function renderQuick(){const root=$('quick-sites');root.replaceChildren();for(const id of ['mangaz','cmoa','ebookjapan','kadocomi','rookie']){const s=configured.find(x=>x.id===id);if(s)root.append(link(s.name+' ↗',s.website,s));}}
async function copyURL(url){try{if(!navigator.clipboard)throw new Error();await navigator.clipboard.writeText(url);toast('URLをコピーしました');}catch{toast('コピーできませんでした。作品名を長押ししてリンクをコピーできます。');}}
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,4500);}
function filterChanged(){limit=40;saveQuery();renderLinks();}
function siteFilterChanged(){saveQuery();renderSources();}
async function load(){
 if(busy)return;busy=true;$('refresh').disabled=true;$('refresh').textContent='↻ 更新中';$('links').setAttribute('aria-busy','true');
 try{
  const response=await fetch(API,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error();const value=await response.json();
  if(value.version!==1||value.verificationVersion!==2||!Array.isArray(value.items)||!Array.isArray(value.sources)||!Number.isFinite(Date.parse(value.now)))throw new Error();
  clockOffset=Date.parse(value.now)-Date.now();data=value;renderMeta();renderLinks();renderSources();$('error').hidden=true;
 }catch{
  $('error').textContent=data?'更新できませんでした。無料確認の有効期限内のリンクを表示しています。時間をおいて再試行してください。':'無料公開の確認結果を読み込めませんでした。「無料サイトを探す」から各サイトの一覧を開けます。';$('error').hidden=false;
  if(data){renderMeta();renderLinks();renderSources();}else{$('result-count').textContent='無料の確認結果を取得できませんでした';const empty=el('div','empty');empty.append(el('strong','','配信サイトの一覧から探せます'));const b=el('button','','無料サイトを探す');b.onclick=()=>showMode('sites');empty.append(b);$('links').replaceChildren(empty);}
 }finally{busy=false;nextRefresh=Date.now()+60000;$('refresh').disabled=false;$('refresh').textContent='↻ 一覧を更新';$('links').setAttribute('aria-busy','false');}
}
$('refresh').onclick=()=>load();$('links-tab').onclick=()=>showMode('links');$('sites-tab').onclick=()=>showMode('sites');$('discover-sites').onclick=()=>showMode('sites');$('query').oninput=filterChanged;$('source').onchange=filterChanged;$('period').onchange=filterChanged;$('site-query').oninput=siteFilterChanged;$('site-kind').onchange=siteFilterChanged;$('more').onclick=()=>{limit+=40;renderLinks();};
try{const r=await fetch('./sources.json?v=20260915-free2',{cache:'no-cache'});if(!r.ok)throw new Error();configured=await r.json();syncFilters();renderSources();renderQuick();renderMeta();}catch{$('error').textContent='配信元の一覧を読み込めませんでした。ページを再読み込みしてください。';$('error').hidden=false;}
const params=new URLSearchParams(location.search);$('query').value=(params.get('q')||'').slice(0,120);if(configured.some(x=>x.id===params.get('source')&&x.feed))$('source').value=params.get('source');if(['1','7','30'].includes(params.get('days')))$('period').value=params.get('days');$('site-query').value=(params.get('siteq')||'').slice(0,100);if(Object.hasOwn(kinds,params.get('kind')))$('site-kind').value=params.get('kind');if(params.get('view')==='sites')showMode('sites');renderSources();
await load();
setInterval(()=>{if(document.hidden)return;const left=Math.max(0,Math.ceil((nextRefresh-Date.now())/1000));$('next-refresh').textContent=busy?'無料の新着話を確認中':'次の画面更新まで '+left+'秒';if(data&&data.items.some(x=>!isFree(x))){data.items=freeItems();renderMeta();renderLinks();}if(!left)load();},1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){renderMeta();renderLinks();if(Date.now()>=nextRefresh)load();}});
