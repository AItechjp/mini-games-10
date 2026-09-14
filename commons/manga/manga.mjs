const API='https://dcvtubivtextycifngtk.supabase.co/functions/v1/commons-manga';
const $=id=>document.getElementById(id),format=new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false});
let data=null,configured=[],mode='links',limit=40,busy=false,clockOffset=0,nextRefresh=Date.now()+60000,toastTimer;
const now=()=>Date.now()+clockOffset;
const fmt=v=>v&&Number.isFinite(Date.parse(v))?format.format(new Date(v)):'未取得';
function el(tag,className,value){const n=document.createElement(tag);if(className)n.className=className;if(value!==undefined)n.textContent=value;return n;}
function safeURL(raw,source,episode=false){try{const u=new URL(raw),base=new URL(source.website);return u.protocol==='https:'&&!u.username&&!u.password&&u.origin===base.origin&&(!episode||/^\/episode\/\d+\/?$/.test(u.pathname))?u.href:null;}catch{return null;}}
function link(label,url,source,episode=false){const a=el('a','',label),href=safeURL(url,source,episode);if(href){a.href=href;a.target='_blank';a.rel='noopener noreferrer';}return a;}
function fresh(s){return s.status==='ok'&&Date.parse(s.nextCheckAt)+300000>=now();}
function showMode(value){mode=value;$('links-view').hidden=value!=='links';$('sites-view').hidden=value!=='sites';$('view-title').textContent=value==='links'?'漫画リンク収集':'配信サイト・取得状況';for(const v of ['links','sites']){$(v+'-tab').classList.toggle('selected',v===value);$(v+'-tab').setAttribute('aria-pressed',String(v===value));}}
function sources(){return configured.map(s=>({...data?.sources?.find(x=>x.id===s.id),...s}));}
function syncFilters(){const saved=$('source').value;$('source').replaceChildren(new Option('すべての配信元',''));for(const s of sources())$('source').append(new Option(s.name,s.id));$('source').value=configured.some(x=>x.id===saved)?saved:'';}
function renderMeta(){if(!data)return;const ss=sources(),healthy=ss.filter(fresh).length;$('link-count').textContent=data.items.length.toLocaleString('ja-JP');$('nav-count').textContent=data.items.length.toLocaleString('ja-JP');$('health-count').textContent=healthy+' / '+ss.length;$('nav-sources').textContent=ss.length;$('collected').textContent=data.collectedAt?fmt(data.collectedAt):'初回巡回を待っています';const notices=[];if(data.error)notices.push(data.error);if(!data.collectedAt)notices.push('まだ初回収集が完了していません。「配信サイト」から公式サイトを開けます。');else if(now()-Date.parse(data.collectedAt)>720000)notices.push('自動収集が遅れています。最終取得時点のリンクを表示しています。');if(ss.some(s=>s.status==='error'))notices.push('取得に失敗した配信元があります。「配信サイト」で日時と理由を確認できます。');if(data.collecting)notices.push('公式フィードを巡回中です。次の画面更新で反映します。');$('notice').textContent=notices.join(' ');$('notice').hidden=!notices.length;}
function saveQuery(){const p=new URLSearchParams();if($('query').value.trim())p.set('q',$('query').value.trim());if($('source').value)p.set('source',$('source').value);if($('period').value!=='30')p.set('days',$('period').value);history.replaceState(null,'',location.pathname+(p.size?'?'+p:''));}
function renderLinks(){
 if(!data)return;const root=$('links'),ss=sources(),q=$('query').value.trim().normalize('NFKC').toLocaleLowerCase('ja'),source=$('source').value,cutoff=now()-Number($('period').value)*86400000;
 const items=data.items.filter(item=>{const s=ss.find(x=>x.id===item.sourceId);return s&&safeURL(item.url,s,true)&&Date.parse(item.updatedAt)>=cutoff&&(!source||source===item.sourceId)&&(!q||[item.title,item.author,s.name,s.publisher].join(' ').normalize('NFKC').toLocaleLowerCase('ja').includes(q));}).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt));
 $('result-count').textContent=items.length.toLocaleString('ja-JP')+'件 · 更新が新しい順';root.replaceChildren();
 if(!items.length){const empty=el('div','empty');empty.append(el('strong','',data.items.length?'この条件のリンクはありません':'リンクの収集結果はまだありません'),el('span','',data.items.length?'作品名を短くするか、配信元・更新時期を変更してください。':'「配信サイト」から公式サイトを直接開けます。'));const b=el('button','',data.items.length?'条件をリセット':'配信サイトを見る');b.onclick=()=>{if(data.items.length){$('query').value='';$('source').value='';$('period').value='30';filterChanged();}else showMode('sites');};empty.append(b);root.append(empty);}
 for(const [i,item] of items.slice(0,limit).entries()){
  const s=ss.find(x=>x.id===item.sourceId),row=el('article','link-row');row.style.setProperty('--source',s.color);row.append(el('span','number',String(i+1).padStart(2,'0')));
  const main=el('div','row-main'),meta=el('div','row-meta');meta.append(el('span','source-name',s.name));
  if(s.status==='error'||!fresh(s))meta.append(el('span','badge warning','前回の取得情報'));
  if(item.freeFrom&&Date.parse(item.freeFrom)<=now()&&(!item.freeUntil||Date.parse(item.freeUntil)>now()))meta.append(el('span','badge',item.freeUntil?'無料期間の記載あり':'無料開始日の記載あり'));
  const title=el('h2');title.append(link(item.title,item.url,s,true));main.append(meta,title);if(item.author)main.append(el('p','author',item.author));const url=link(item.url,item.url,s,true);url.className='url';main.append(url);
  const actions=el('div','actions'),time=el('time','');time.dateTime=item.updatedAt;time.append(el('span','','配信元の更新'),document.createTextNode(fmt(item.updatedAt)));const read=link('配信元で読む ↗',item.url,s,true);read.className='read';const copy=el('button','copy','URLをコピー');copy.type='button';copy.setAttribute('aria-label',item.title+'のURLをコピー');copy.onclick=()=>copyURL(item.url);actions.append(time,read,copy);row.append(main,actions);root.append(row);
 }
 $('more').hidden=items.length<=limit;$('more').textContent='さらに'+Math.min(40,items.length-limit)+'件表示';
}
function renderSources(){const root=$('sites');root.replaceChildren();for(const [i,s] of sources().entries()){
 const card=el('article','site');card.style.setProperty('--source',s.color);const top=el('div','site-top');top.append(el('span','',String(i+1).padStart(2,'0')+' / 公式配信元'));const cls=s.status==='error'?'failed':s.status==='ok'?(fresh(s)?'':'stale'):'pending';top.append(el('span','status '+cls,s.status==='error'?'取得失敗':s.status==='ok'?(fresh(s)?'取得成功':'再確認が遅延'):'未取得'));card.append(top,el('h2','',s.name),el('p','publisher',s.publisher));const dl=el('dl');for(const [key,value] of [['最終確認',fmt(s.lastCheckedAt)],['最終成功',fmt(s.lastSuccessAt)],['次回予定',s.nextCheckAt?fmt(s.nextCheckAt):'初回巡回待ち'],['収集URL',Number(s.count||0).toLocaleString('ja-JP')+'件']])dl.append(el('dt','',key),el('dd','',value));card.append(dl);if(s.error)card.append(el('p','source-error',s.error));const row=el('div','site-links');row.append(link('公式サイトを開く ↗',s.website,s),link('更新フィード ↗',s.feed,s));card.append(row);root.append(card);}}
async function copyURL(url){try{if(!navigator.clipboard)throw new Error();await navigator.clipboard.writeText(url);toast('URLをコピーしました');}catch{toast('コピーできませんでした。作品名を長押ししてリンクをコピーできます。');}}
function toast(message){clearTimeout(toastTimer);$('toast').textContent=message;$('toast').hidden=false;toastTimer=setTimeout(()=>$('toast').hidden=true,4500);}
function filterChanged(){limit=40;saveQuery();renderLinks();}
async function load(){
 if(busy)return;busy=true;$('refresh').disabled=true;$('refresh').textContent='↻ 更新中';$('links').setAttribute('aria-busy','true');
 try{
  const response=await fetch(API,{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('HTTP '+response.status);const value=await response.json();
  if(value.version!==1||!Array.isArray(value.items)||!Array.isArray(value.sources)||!Number.isFinite(Date.parse(value.now)))throw new Error('invalid response');
  clockOffset=Date.parse(value.now)-Date.now();data=value;renderMeta();renderLinks();renderSources();$('error').hidden=true;
 }catch{
  $('error').textContent=data?'更新できませんでした。表示中のリンクは前回の取得情報です。通信状態を確認して再試行してください。':'収集結果を読み込めませんでした。「一覧を更新」で再試行するか、「配信サイト」から公式サイトを開いてください。';$('error').hidden=false;
  if(!data){$('result-count').textContent='収集結果を取得できませんでした';const empty=el('div','empty');empty.append(el('strong','','配信サイトは直接開けます'));const b=el('button','','公式サイトの一覧へ');b.onclick=()=>showMode('sites');empty.append(b);$('links').replaceChildren(empty);}
 }finally{busy=false;nextRefresh=Date.now()+60000;$('refresh').disabled=false;$('refresh').textContent='↻ 一覧を更新';$('links').setAttribute('aria-busy','false');}
}
$('refresh').onclick=()=>load();$('links-tab').onclick=()=>showMode('links');$('sites-tab').onclick=()=>showMode('sites');$('query').oninput=filterChanged;$('source').onchange=filterChanged;$('period').onchange=filterChanged;$('more').onclick=()=>{limit+=40;renderLinks();};
try{const r=await fetch('./sources.json');if(!r.ok)throw new Error();configured=await r.json();syncFilters();renderSources();}catch{$('error').textContent='配信元の一覧を読み込めませんでした。ページを再読み込みしてください。';$('error').hidden=false;}
const params=new URLSearchParams(location.search);$('query').value=(params.get('q')||'').slice(0,120);if(configured.some(x=>x.id===params.get('source')))$('source').value=params.get('source');if(['1','7','30'].includes(params.get('days')))$('period').value=params.get('days');
await load();setInterval(()=>{if(document.hidden)return;const left=Math.max(0,Math.ceil((nextRefresh-Date.now())/1000));$('next-refresh').textContent=busy?'新着を確認中':'次の画面更新まで '+left+'秒';if(!left)load();renderMeta();},1000);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()>=nextRefresh)load();});
