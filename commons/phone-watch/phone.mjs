import {chooseItems,normalizeQuery,digits} from './search.mjs';
const endpoint='https://dcvtubivtextycifngtk.supabase.co/functions/v1/commons-phone';
const key='sb_publishable_IcEN-3GgzcLCHiyNLyRiCQ_RpkAhCGI';
const $=id=>document.getElementById(id),fmt=value=>value?new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(value)):'取得履歴なし';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sourceUrl=value=>{try{const u=new URL(value);return u.protocol==='https:'&&['lfb.mof.go.jp','chizai-portal.inpit.go.jp','www.caa.go.jp'].includes(u.hostname)?u.href:'#'}catch{return '#'}};
let data=null,filter='all',limit=30,busy=false,lastFetch=0,offline=false;
function render(){
 if(!data)return;
 const options={query:$('query').value,filter,sort:$('sort').value};const all=chooseItems(data.items,options),shown=all.slice(0,limit),q=normalizeQuery(options.query);
 $('full-count').textContent=new Set(data.items.filter(r=>r.numberType==='full').map(r=>r.number)).size;
 $('masked-count').textContent=data.items.filter(r=>r.numberType==='masked').length;
 const healthy=data.sources.filter(s=>s.status==='ok').length;
 $('source-count').textContent=healthy+' / '+data.sources.length;
 $('connection').textContent=offline?'通信できません':healthy===data.sources.length?'情報源の取得済み':'一部の情報源が未取得';
 const times=data.sources.filter(s=>s.checkedAt).map(s=>s.checkedAt).sort();
 $('last-check').textContent=times.length?'掲載元取得 '+fmt(times.at(-1)):'取得履歴なし';
 $('result-count').textContent=all.length+'件';$('more').hidden=all.length<=limit;$('clear').hidden=!options.query;
 $('match-info').hidden=!options.query;
 if(options.query){const exact=all.filter(r=>r.numberType==='full'&&digits(r.number)===q).length,masked=all.filter(r=>r.numberType==='masked').length;$('match-info').textContent=!q?'数字を含む電話番号を入力してください。':exact?'全文字が一致する公的な注意喚起があります。出典・公表日と、着信の内容を確認してください。':masked?'伏字の一部と一致しています。入力した番号の危険性を特定する結果ではありません。':all.length?'入力した数字を含む掲載があります。全文字の一致ではありません。':'この掲載範囲には一致する番号がありません。安全が確認されたという意味ではありません。';}
 $('records').innerHTML=shown.length?shown.map(r=>`<article class="record"><div class="number-block"><span class="badge ${r.numberType==='masked'?'masked':''}">${r.numberType==='masked'?'一部伏字・番号の特定不可':'全文字公開・公的注意喚起'}</span><p class="number">${esc(r.number)}</p><p class="kind">${r.category==='lending'?'無登録貸金業・登録詐称への警告':'特殊詐欺への注意喚起'}</p></div><div><h3>${esc(r.title)}</h3><p class="description">${esc(r.summary)}</p><div class="meta"><span>公表日 <time>${esc(r.publishedAt||'原文で確認')}</time></span><span>${r.stale?'前回の取得':'取得'} ${esc(fmt(r.checkedAt))}</span></div>${r.publishedAt&&Date.now()-Date.parse(r.publishedAt)>365*86400000?'<p class="old">公表から1年以上経過した情報です。</p>':''}${r.stale?'<p class="old">今回は再確認できていません。前回取得分を表示しています。</p>':''}<a class="source-link" href="${esc(sourceUrl(r.sourceUrl))}" target="_blank" rel="noopener noreferrer">${esc(r.source)}で根拠を確認 ↗</a></div></article>`).join(''):'<p class="empty">'+(options.query?'一致する掲載はありません。未掲載でも安全とは判断できません。':'この条件で表示できる掲載はありません。')+'</p>';
 $('records').setAttribute('aria-busy','false');
 $('sources-list').innerHTML=data.sources.map(s=>`<div class="source-row"><div><a href="${esc(sourceUrl(s.url))}" target="_blank" rel="noopener noreferrer">${esc(s.name)} ↗</a><small>${s.recordCount}件の掲載</small></div><div class="source-status"><span class="${s.status==='ok'?'ok':'failed'}">${s.status==='ok'?'取得済み':esc(s.error||'取得できませんでした')}</span><small>最終取得 ${esc(fmt(s.checkedAt))}</small></div></div>`).join('');
}
async function refresh(){if(busy)return;busy=true;$('refresh').disabled=true;$('refresh').textContent='確認中…';try{const r=await fetch(endpoint,{headers:{apikey:key},cache:'no-store',signal:AbortSignal.timeout(85000)});const result=await r.json();if(!r.ok||!Array.isArray(result.items)||!Array.isArray(result.sources))throw new Error(result.error||'情報源を確認できませんでした。');data=result;offline=false;lastFetch=Date.now();$('error').hidden=true;render();}catch(e){offline=true;$('error').hidden=false;$('error').textContent=(navigator.onLine?'最新データを取得できませんでした。':'オフラインです。')+(data?'前回表示した情報を残しています。':'時間をおいて「今すぐ確認」を押してください。');if(data)render();else{$('records').innerHTML='<p class="empty">情報源に接続できず、一覧を取得できませんでした。</p>';$('records').setAttribute('aria-busy','false');$('connection').textContent='取得できませんでした';}}finally{busy=false;$('refresh').disabled=false;$('refresh').textContent='↻ 今すぐ確認';}}
for(const b of document.querySelectorAll('[data-filter]'))b.addEventListener('click',()=>{filter=b.dataset.filter;limit=30;for(const x of document.querySelectorAll('[data-filter]')){x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));}render();});
$('query').addEventListener('input',()=>{limit=30;render()});$('clear').addEventListener('click',()=>{$('query').value='';$('query').focus();render()});$('sort').addEventListener('change',()=>{limit=30;render()});$('more').addEventListener('click',()=>{limit+=30;render()});$('refresh').addEventListener('click',refresh);
setInterval(()=>{if(!document.hidden&&!busy)refresh()},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&Date.now()-lastFetch>60000)refresh()});window.addEventListener('online',refresh);
refresh();
