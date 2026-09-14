const law=document.body.dataset.view==='law',root=document.querySelector('#app'),base='/commons/public-records/data/';
const kinds={bill:'法案・立法',law:'公布法令',revision:'法改正',meeting:'国会会議録',parliament:'国会会議録',feed:'パブリックコメント',whitepaper:'白書・年次報告',committee:'審議会・検討会',portal:'公式索引',document:'資料'};
const groups={central:'府省庁・外局',independent:'独立行政法人',local:'地方公共団体',legislature:'国会・司法',judiciary:'国会・司法','legislative-judicial':'国会・司法',legislative_judicial:'国会・司法',other:'その他'};
const state={tab:new URLSearchParams(location.search).get('tab')||'all',query:new URLSearchParams(location.search).get('q')||'',org:'',kind:'',period:'',sort:'date',page:1};
const lawKinds=new Set(['bill','law','revision','meeting','parliament','feed']);
let data={records:[],sources:[],generatedAt:null},agencies=[],loadError='',filtered=[];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeURL=s=>{try{const u=new URL(s);return ['https:','http:'].includes(u.protocol)?u.href:'#'}catch{return '#'}};
const link=(url,label,cls='')=>'<a href="'+esc(safeURL(url))+'" target="_blank" rel="noopener noreferrer" class="'+cls+'">'+esc(label)+'</a>';
const day=v=>v&&/^\d{4}-\d{2}-\d{2}/.test(v)?String(v).slice(0,10).replaceAll('-','/'):'日付記載なし';
const stamp=v=>{const d=new Date(v);return v&&Number.isFinite(+d)?new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d):'未取得'};
const title=law?'法律・国会ウォッチ':'行政資料ナビ';
const tabs=law?[['all','すべて'],['bill','法案・立法'],['law','法令・改正'],['revision','法改正履歴'],['meeting','国会'],['feed','パブコメ'],['sources','収集状況']]:[['all','資料一覧'],['whitepaper','白書'],['committee','審議会・検討会'],['agencies','機関一覧'],['sources','収集状況']];
if(!tabs.some(t=>t[0]===state.tab))state.tab='all';
function links(items){return '<ul class="link-list">'+items.map(([name,url,note])=>'<li>'+link(url,name)+(note?'<small>'+esc(note)+'</small>':'')+'</li>').join('')+'</ul>'}
function shell(){
 const lawAside='<section class="aside-section"><h2>公式情報へ</h2>'+links([['e-Gov 法令検索','https://laws.e-gov.go.jp/','現行法令・施行日・改正履歴'],['衆議院 議案審議状況','https://www.shugiin.go.jp/internet/itdb_gian.nsf/html/gian/menu.htm','法案本文・審議経過'],['参議院 議案情報','https://www.sangiin.go.jp/japanese/joho1/kousei/gian/current/gian.htm','議決・公布情報'],['国会会議録検索','https://kokkai.ndl.go.jp/','発言・会議内容を検索'],['衆議院 審議中継','https://www.shugiintv.go.jp/jp/','本日の審議予定・録画'],['官報発行サイト','https://www.kanpo.go.jp/','公布された法令を確認'],['意見募集・結果','https://public-comment.e-gov.go.jp/','パブリックコメント']])+'</section><section class="aside-section"><h2>法律ができるまで</h2><ol class="steps"><li>法案の提出</li><li>委員会・本会議で審議</li><li>両院の議決・成立</li><li>公布</li><li>施行</li></ol><p>成立・公布・施行は別の日付です。審議状況は公式表記を保持し、日付が不明な場合は補いません。</p></section>';
 const docsAside='<section class="aside-section"><h2>全国の公式索引</h2>'+links([['政府機関・地方公共団体','https://www.e-gov.go.jp/government-directory','府省庁・外局・国会・司法'],['独立行政法人一覧','https://www.e-gov.go.jp/government-directory/IAAs.html','所管府省ごとの公式リンク'],['全国の地方公共団体','https://www.j-lis.go.jp/spd/map-search/cms_1069.html','都道府県から市区町村へ'],['政府の白書・年次報告','https://www.e-gov.go.jp/about-government/white-papers.html','白書ごとの公開ページ'],['国立公文書館','https://www.archives.go.jp/','公文書・デジタルアーカイブ'],['e-Gov文書管理','https://administrative-doc.e-gov.go.jp/','行政文書ファイル管理簿'],['国立国会図書館WARP','https://warp.ndl.go.jp/','過去に公開されたウェブ資料']])+'</section><section class="aside-section"><h2>収集範囲</h2><p>府省庁・外局の公式索引、白書公開ページ、登録した審議会・検討会ページからリンクを収集します。</p><p>機関一覧は公式索引への掲載を確認したものです。全国の全機関・全資料を収録した一覧ではありません。未収録の市区町村等は「全国の地方公共団体」から確認できます。</p></section>';
 root.innerHTML='<header class="top"><a class="brand" href="/commons/">COMMONS <small>PUBLIC INFORMATION</small></a><nav aria-label="サービス"><a href="/commons/law/" '+(law?'aria-current="page"':'')+'>法律・国会</a><a href="/commons/documents/" '+(!law?'aria-current="page"':'')+'>行政資料</a><a href="/commons/">サイト一覧</a></nav></header><main id="main"><div class="intro"><div><p class="eyebrow">'+(law?'LEGISLATION & DIET':'GOVERNMENT DOCUMENTS')+'</p><h1>'+title+'</h1><p class="muted">'+(law?'法案から公布・施行まで。国会と法制度の動きを追う。':'機関をまたいで、白書・報告書・会議資料を探す。')+'</p></div><button id="refresh" class="refresh">更新を確認</button></div><div id="metrics" class="metrics"></div><div id="notice" role="status"></div><div class="workspace"><section class="panel" aria-label="情報検索"><nav class="tabs" aria-label="表示する情報">'+tabs.map(([id,label])=>'<button data-tab="'+id+'" aria-pressed="'+(state.tab===id)+'">'+label+'</button>').join('')+'</nav><div class="filters"><div class="search"><input id="query" type="search" aria-label="キーワードで横断検索" placeholder="'+(law?'法律名・議案名・委員会名で検索':'資料名・機関名・分野で検索')+'" value="'+esc(state.query)+'"><button id="clear">解除</button></div><div class="facets"><label>機関<select id="org" aria-label="機関で絞り込み"></select></label><label>種類<select id="kind" aria-label="種類で絞り込み"></select></label><label>公布・開催・更新日<select id="period" aria-label="期間で絞り込み"><option value="">すべて・日付なし含む</option><option value="7">過去7日</option><option value="30">過去30日</option><option value="90">過去90日</option><option value="365">過去1年</option></select></label><label>並び順<select id="sort" aria-label="並び順"><option value="date">公布・開催・更新が新しい順</option><option value="title">名前順</option><option value="organization">機関順</option><option value="fetched">取得が新しい順</option></select></label></div></div><div class="result-bar"><span id="count" role="status">読み込み中</span><button id="csv">絞り込み結果をCSV保存</button></div><div id="results"><p class="loading">公式情報を読み込んでいます…</p></div><div id="pager" class="pager"></div></section><aside class="aside">'+(law?lawAside:docsAside)+'<section class="aside-section"><h2>出典と鮮度</h2><p id="updated">取得日時を確認しています。</p><p>索引ページと個別資料を区別して掲載。原文・PDFは発行機関のページで開きます。</p><a class="source-link" href="?tab=sources">各情報源の収集状況を見る</a></section></aside></div></main><footer class="footer"><a href="/commons/">コモンズ</a><a href="/legal.html">サイト情報</a><span>公的情報へのリンクを集約 · 日時は日本時間</span></footer>';
 root.querySelector('#query').addEventListener('input',e=>{state.query=e.target.value;state.page=1;renderResults();syncURL()});
 for(const key of ['org','kind','period','sort'])root.querySelector('#'+key).addEventListener('change',e=>{state[key]=e.target.value;state.page=1;renderResults()});
 root.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>changeTab(b.dataset.tab)));
 root.querySelector('#clear').onclick=()=>{Object.assign(state,{query:'',org:'',kind:'',period:'',page:1});root.querySelector('#query').value='';root.querySelector('#period').value='';updateFacets();renderResults();syncURL();root.querySelector('#query').focus()};
 root.querySelector('#refresh').onclick=()=>load(true);
 root.querySelector('#csv').onclick=downloadCSV;
}
function changeTab(tab){Object.assign(state,{tab,org:'',kind:'',period:'',page:1});root.querySelector('#period').value='';updateFacets();renderResults();syncURL()}
const relevant=r=>law?lawKinds.has(r.kind):['whitepaper','committee','document','portal'].includes(r.kind);
function currentRows(){
 if(state.tab==='agencies')return agencies.map(a=>({...a,title:a.name,organization:a.note||a.agency||'',kind:a.group||'other',fetchedAt:a.verifiedAt,sourceUrl:a.sourceUrl,isAgency:true}));
 if(state.tab==='sources')return data.sources.filter(relevant).map(s=>({...s,title:s.name,sourceUrl:s.url,isSource:true,kind:s.kind||'portal'}));
 return data.records.filter(relevant).filter(r=>state.tab==='all'||(state.tab==='law'?['law','revision'].includes(r.kind):state.tab==='meeting'?['meeting','parliament'].includes(r.kind):r.kind===state.tab));
}
function options(selector,items,selected,first){root.querySelector(selector).innerHTML='<option value="">'+first+'</option>'+items.map(([v,n])=>'<option value="'+esc(v)+'" '+(v===selected?'selected':'')+'>'+esc(n)+'</option>').join('')}
function updateFacets(){
 const rows=currentRows(),orgs=[...new Set(rows.map(r=>r.organization).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ja'));
 options('#org',orgs.map(x=>[x,x]),state.org,'すべての機関');
 options('#kind',[...new Set(rows.map(r=>r.kind))].filter(Boolean).map(k=>[k,(state.tab==='agencies'?groups:kinds)[k]||k]),state.kind,'すべての種類');
 root.querySelector('#period').disabled=['agencies','sources'].includes(state.tab);
 root.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.tab===state.tab));
}
function statusLabel(s){return ({ok:'取得済み',success:'取得済み',partial:'一部取得',error:'取得失敗',failed:'取得失敗',skipped:'未実行',empty:'取得0件'})[s]||s||'未取得'}
function recordHTML(r){
 const metaKind=(r.isAgency?groups:kinds)[r.kind]||r.kind,details=[];
 if(r.isSource){
  details.push('掲載 '+Number(r.count??r.recordCount??0).toLocaleString()+'件');
  if(r.lastSuccessAt)details.push('最終成功 '+stamp(r.lastSuccessAt));
  if(r.error)details.push('取得エラー：'+r.error);
  if(r.coverage)details.push(r.coverage);
  if(r.diagnostics?.limited||r.diagnostics?.truncated)details.push('取得上限に達しました');
  if(r.truncated||r.limited)details.push('取得上限あり');
 }else if(r.isAgency){details.push('公式索引に掲載');details.push(r.targetVerifiedAt?'リンク先確認 '+stamp(r.targetVerifiedAt):'リンク先の現在の応答は未確認')}
 else{
  if(r.lawNumber)details.push(r.lawNumber);
  if(r.updateBatchDate)details.push('法令データ更新 '+day(r.updateBatchDate));
  if(r.effectiveDateNote)details.push('施行日：'+r.effectiveDateNote);
  if(r.amendmentLawNumber)details.push('改正法令番号：'+r.amendmentLawNumber);
  const sourceName=r.sourceName||data.sources.find(s=>s.id===r.sourceId)?.name;if(sourceName&&sourceName!==r.title)details.push(sourceName);
  if(r.linkLabel)details.push(r.linkLabel);
  if(r.commentDeadline)details.push('受付締切 '+r.commentDeadline);
  if(r.revisionStatus)details.push('施行状態：'+(({CurrentEnforced:'施行中',UnEnforced:'未施行',PreviousEnforced:'過去の施行内容',Repeal:'廃止'})[r.revisionStatus]||r.revisionStatus));
  for(const [key,label] of [['lawPromulgationDate','公布'],['amendmentPromulgationDate','改正公布'],['effectiveDate','施行'],['scheduledEffectiveDate','施行予定'],['eventDate','開催'],['deadline','締切']])if(r[key])details.push(label+' '+day(r[key]));
  if(r.house)details.push(r.house);
  if(r.session||r.billSession)details.push('第'+(r.session||r.billSession)+'回国会');
  if(r.amendmentLawTitle)details.push('改正法令：'+r.amendmentLawTitle);
  if(r.recordType)details.push(({index:'索引ページ',page:'公開ページ',document:'個別資料',pdf:'PDF',law:'法令',minutes:'会議録'})[r.recordType]||r.recordType);
 }
 const tag=r.isSource?'<span class="tag '+(['ok','success'].includes(r.status)?'green':'amber')+'">'+esc(statusLabel(r.status))+'</span>':r.status?'<span class="tag green">'+esc(r.status)+'</span>':'';
 return '<article class="record"><div><div class="meta"><span class="tag">'+esc(metaKind)+'</span>'+tag+'<span>'+esc(r.organization)+'</span>'+(r.stale?'<span class="tag amber">以前の取得データ</span>':'')+'</div><h2>'+link(r.url,r.title)+'</h2>'+(details.length?'<div class="details">'+details.map(v=>'<span>'+esc(v)+'</span>').join('')+'</div>':'')+'<div class="meta" style="margin-top:9px">'+link(r.sourceUrl||r.url,'出典','source-link')+'<span>取得 '+stamp(r.fetchedAt||r.verifiedAt||r.lastAttemptAt)+'</span></div></div><div class="record-side">'+(r.isAgency||r.isSource?'':(r.updateBatchDate?'データ更新 ':r.eventDate?'開催 ':'')+day(r.updateBatchDate||r.publishedAt||r.eventDate))+link(r.url,r.isAgency?'公式サイト ↗':r.isSource?'情報源 ↗':'原文を開く ↗')+'</div></article>';
}
function renderResults(){
 const words=state.query.normalize('NFKC').toLocaleLowerCase().trim().split(/\s+/).filter(Boolean),cutoff=state.period?Date.now()-Number(state.period)*86400000:null;
 filtered=currentRows().filter(r=>(!state.org||r.organization===state.org)&&(!state.kind||r.kind===state.kind)&&(!cutoff||((r.updateBatchDate||r.publishedAt||r.eventDate)&&+new Date(r.updateBatchDate||r.publishedAt||r.eventDate)>=cutoff))&&words.every(q=>[r.title,r.organization,r.kind,r.status,r.lawNumber,r.note,r.sourceName,data.sources.find(s=>s.id===r.sourceId)?.name,r.amendmentLawTitle].join(' ').normalize('NFKC').toLocaleLowerCase().includes(q)));
 filtered.sort((a,b)=>state.sort==='title'?a.title.localeCompare(b.title,'ja'):state.sort==='organization'?(a.organization||'').localeCompare(b.organization||'','ja'):String(state.sort==='fetched'?b.fetchedAt||'':b.updateBatchDate||b.publishedAt||b.eventDate||'').localeCompare(String(state.sort==='fetched'?a.fetchedAt||'':a.updateBatchDate||a.publishedAt||a.eventDate||''))||a.title.localeCompare(b.title,'ja'));
 const pages=Math.max(1,Math.ceil(filtered.length/30));state.page=Math.min(pages,state.page);
 root.querySelector('#count').innerHTML='<strong>'+filtered.length.toLocaleString()+'</strong> 件'+(filtered.length?' · '+((state.page-1)*30+1)+'–'+Math.min(state.page*30,filtered.length):'');
 root.querySelector('#results').className=state.tab==='sources'?'status-list':'';
 root.querySelector('#results').innerHTML=filtered.length?filtered.slice((state.page-1)*30,state.page*30).map(recordHTML).join(''):'<div class="empty"><h2>'+(loadError?'データを読み込めませんでした':'該当する情報はありません')+'</h2><p>'+(loadError?'「更新を確認」で再読み込みできます。公式リンクも利用できます。':'検索条件を解除するか、別の種類を選んでください。収集範囲は「収集状況」で確認できます。')+'</p></div>';
 root.querySelector('#pager').innerHTML=pages>1?'<button id="prev" '+(state.page===1?'disabled':'')+'>前へ</button><span>'+state.page+' / '+pages+'</span><button id="next" '+(state.page===pages?'disabled':'')+'>次へ</button>':'';
 for(const [id,step] of [['prev',-1],['next',1]]){const b=root.querySelector('#'+id);if(b)b.onclick=()=>{state.page+=step;renderResults();root.querySelector('.result-bar').scrollIntoView({block:'start',behavior:'smooth'})}}
 root.querySelector('#csv').disabled=!filtered.length;
}
function syncURL(){const p=new URLSearchParams();if(state.tab!=='all')p.set('tab',state.tab);if(state.query)p.set('q',state.query);history.replaceState(null,'',location.pathname+(p.size?'?'+p:''))}
function downloadCSV(){
 const cells=v=>'"'+String(v??'').replace(/^(?:\s*[=+\-@]|[\t\r])/ ,"'$&").replaceAll('"','""')+'"';
 const table=[['種類','件名','機関','資料日付','開催日','審議状況','原文URL','出典URL','取得日時'],...filtered.map(r=>[(r.isAgency?groups:kinds)[r.kind]||r.kind,r.title,r.organization,r.publishedAt,r.eventDate,r.status,r.url,r.sourceUrl,r.fetchedAt])];
 const blob=new Blob(['\uFEFF'+table.map(row=>row.map(cells).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(law?'commons-law':'commons-documents')+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function load(refresh=false){
 root.querySelector('#refresh').disabled=true;root.querySelector('#refresh').textContent='確認中…';
 try{
  const fetchJSON=async file=>{const r=await fetch(base+file,{cache:refresh?'reload':'default',signal:AbortSignal.timeout(30000)});if(!r.ok)throw new Error('HTTP '+r.status);return r.json()};
  const [records,directory]=await Promise.all([fetchJSON('records.json'),fetchJSON('agencies.json')]);
  if(!Array.isArray(records.records)||!Array.isArray(records.sources))throw new Error('データ形式');
  data=records;agencies=Array.isArray(directory)?directory:directory.agencies||[];loadError='';
 }catch(e){loadError=e.message}
 const rows=data.records.filter(relevant),sources=data.sources.filter(relevant),good=sources.filter(s=>['success','ok'].includes(s.status)).length,bad=sources.length-good;
 const units=law?[[rows.filter(r=>r.kind==='bill').length,'法案・立法リンク'],[rows.filter(r=>['law','revision'].includes(r.kind)).length,'法令・改正'],[rows.filter(r=>['meeting','parliament'].includes(r.kind)).length,'国会会議'],[good+'/'+sources.length,'情報源の取得成功']]:[[agencies.length,'登録機関'],[rows.length,'資料・索引リンク'],[[...new Set(rows.map(r=>r.organization))].filter(Boolean).length,'資料掲載機関'],[good+'/'+sources.length,'情報源の取得成功']];
 root.querySelector('#metrics').innerHTML=units.map(([n,label])=>'<div class="metric"><span>'+label+'</span><strong>'+(typeof n==='number'?n.toLocaleString():esc(n))+'</strong></div>').join('');
 const stale=data.generatedAt&&Date.now()-new Date(data.generatedAt)>24*3600000;
 root.querySelector('#notice').innerHTML=loadError?'<p class="note warning">データの読み込みに失敗しました。再読み込みするか、公式情報源を開いてください。</p>':'<p class="note '+(bad||stale?'warning':'')+'">'+(stale?'最終収集から24時間以上経過しています。 ':'')+(bad?bad+'情報源で取得失敗または一部取得。過去の取得分が残っている場合があります。 ':'')+(law?'公布法令・改正情報、会議録、新着パブコメを収集。期間と取得上限は収集状況に表示します。':'機関の公式索引と公開資料ページから収集。登録機関数は全機関の網羅率ではありません。')+' <button class="text-button" id="status-open">収集状況</button></p>';
 const open=root.querySelector('#status-open');if(open)open.onclick=()=>changeTab('sources');
 root.querySelector('#updated').textContent='データ生成 '+stamp(data.generatedAt)+'。定期収集は1時間ごとを予定し、処理の遅延があり得ます。「更新を確認」は公開済みデータを読み直します。';
 updateFacets();renderResults();root.querySelector('#refresh').disabled=false;root.querySelector('#refresh').textContent='更新を確認';
}
shell();load();
