import {CAPACITY_MB as MB,CAPACITY_GB as GB,finite,quota,fresh,validateManual,validateSnapshot,validateBuild} from './model.mjs';
const $=id=>document.getElementById(id),esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const orgUsage='https://supabase.com/dashboard/org/uainhdoqowsfywvqesoc/usage';
const repo='https://api.github.com/repos/AItechjp/mini-games-10';
const fmt=new Intl.NumberFormat('ja-JP',{maximumFractionDigits:2});
const date=value=>new Date(value).toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});
const metrics=[
 {id:'db',label:'データベース容量',cap:500*MB,unit:'MB',scale:MB,scope:'500 MB / プロジェクト',note:'Postgresのデータ・インデックスなど。WAL・OS領域は含みません。',source:'pg_database_size',link:'https://supabase.com/dashboard/project/dcvtubivtextycifngtk/observability/database'},
 {id:'storage',label:'保存ファイル容量',cap:GB,unit:'GB',scale:GB,scope:'1 GB / 組織（共有）',note:'このプロジェクトの保存ファイル合計。残量は1 GBから引いた参考値です。他プロジェクト分は含みません。',source:'Storageファイルのサイズ集計',link:orgUsage,reference:true},
 {id:'egress',label:'通信量（キャッシュ以外）',cap:5*GB,unit:'GB',scale:GB,scope:'5 GB / 請求月・組織',note:'送信通信量の請求データは未接続です。',link:orgUsage,manual:true},
 {id:'cached',label:'キャッシュ通信量',cap:5*GB,unit:'GB',scale:GB,scope:'5 GB / 請求月・組織',note:'キャッシュ以外の通信量とは別の無料枠です。',link:orgUsage,manual:true},
 {id:'edge',label:'Edge Functions 実行回数',cap:500000,unit:'回',scale:1,scope:'50万回 / 請求月・組織',note:'全関数の合計。短期間のログを月間使用量に換算しません。',link:orgUsage,manual:true},
 {id:'messages',label:'Realtime メッセージ',cap:2000000,unit:'件',scale:1,scope:'200万件 / 請求月・組織',note:'送信・受信の課金対象メッセージ。REST APIへのアクセス数とは別です。',link:orgUsage,manual:true},
 {id:'peak',label:'Realtime 同時接続ピーク',cap:200,unit:'接続',scale:1,scope:'200同時接続 / 組織',note:'管理画面に表示された請求期間のピーク接続数を記録します。',link:orgUsage,manual:true},
 {id:'mau',label:'月間アクティブユーザー',cap:50000,unit:'人',scale:1,scope:'5万人 / 請求月・組織',note:'登録ユーザー総数や直近30日の最終ログイン数は、請求対象MAUと一致しません。',link:orgUsage,manual:true},
 {id:'site',label:'公開ファイルの合計容量',cap:GB,unit:'MB',scale:MB,scope:'1 GB / サイト',note:'公開される配信ファイルをビルド時に計測。Gitリポジトリのサイズとは別です。',source:'公開ビルドの全ファイル',link:'https://github.com/AItechjp/mini-games-10/actions/workflows/deploy-pages.yml'},
 {id:'bandwidth',label:'GitHub Pages 通信量',cap:100*GB,unit:'GB',scale:GB,scope:'100 GB / 月（ソフト上限）',note:'使用量を公開APIから取得できません。100 GBはソフト上限で、自動課金額を示す値ではありません。',link:'https://github.com/AItechjp/mini-games-10/settings/pages',manual:true},
];
let snapshot=null,buildData=null,manual={},busy=false,githubAttempt=0,githubText='',failures={},activeMetric=null;
const key='aitech_usage_manual_v1';
try {const saved=JSON.parse(localStorage.getItem(key)||'{}');if(saved&&typeof saved==='object'&&!Array.isArray(saved))for(const m of metrics.filter(m=>m.manual))if(validateManual(saved[m.id]).valid)manual[m.id]=saved[m.id];} catch {failures.storage='手入力値を端末から読み込めませんでした。';}
function record(m){
 if(m.id==='db'&&snapshot)return {used:snapshot.database_bytes,at:snapshot.checked_at,mode:'自動取得',stale:!fresh(snapshot.checked_at)};
 if(m.id==='storage'&&snapshot)return {used:snapshot.storage_bytes,at:snapshot.checked_at,mode:'自動取得',stale:!fresh(snapshot.checked_at)};
 if(m.id==='site'&&buildData)return {used:buildData.bytes,at:buildData.measuredAt,mode:'公開時に実測',stale:false};
 const entry=manual[m.id],check=validateManual(entry);
 if(check.valid&&check.active)return {used:entry.used,at:entry.observedAt,mode:'手入力',stale:check.stale,entry};
 return {used:null,mode:check.valid?'期間終了':'未取得',stale:false,expired:check.valid};
}
function number(value,m){return fmt.format(value/m.scale)+' '+m.unit;}
function card(m){
 const r=record(m),q=quota(r.used,m.cap),tone=r.stale?'warn':q?.level==='ok'?'':q?.level||'neutral';
 let remaining='残量を確認できません',percent='';
 if(q){remaining=q.exceeded>0?'上限超過 '+number(q.exceeded,m):(m.reference?'参考残量 ':'残り ')+number(q.remaining,m);percent=fmt.format(q.percent)+'% 使用';}
 const source=r.mode==='手入力'?'公式管理画面から手入力':m.source||'';
 return `<article class="meter" data-metric="${m.id}"><div class="metric-head"><h3>${esc(m.label)}</h3><span class="badge ${tone}">${r.stale?'更新待ち · ':''}${esc(r.mode)}</span></div><div class="usage-number">${q?esc(fmt.format(q.used/m.scale)):'—'} ${q?`<small>${esc(m.unit)}</small>`:''}</div><p class="cap">無料枠 ${esc(m.scope)}</p><div class="bar ${q?'':'unknown'}" ${q?`role="progressbar" aria-label="${esc(m.label)}の使用率" aria-valuenow="${q.bar}" aria-valuemin="0" aria-valuemax="100" aria-valuetext="${esc(percent)}"`:'aria-hidden="true"'}>${q?`<div class="bar-fill ${q.level}" style="width:${q.bar}%"></div>`:''}</div><div class="remaining"><strong>${r.stale&&q?'前回値：':''}${esc(remaining)}</strong><span>${esc(percent)}</span></div><p class="metric-note">${esc(m.note)}${r.expired?' 記録の請求期間が終了しました。新しい期間の値を入力してください。':''}</p>${r.at?`<p class="metric-time">${esc(source)} · ${esc(date(r.at))} JST${r.entry?`<br>期間 ${esc(r.entry.periodStart)} 〜 ${esc(r.entry.periodEnd)}`:''}</p>`:''}<div class="metric-links"><a href="${m.link}" target="_blank" rel="noopener noreferrer">公式管理画面 ↗</a>${m.manual?`<button type="button" data-edit="${m.id}">${manual[m.id]?'記録を編集':'管理画面の値を入力'}</button>`:''}</div></article>`;
}
function render(){
 $('supabase-meters').innerHTML=metrics.slice(0,2).map(card).join('');
 $('supabase-other').innerHTML=metrics.slice(2,8).map(card).join('');
 $('github-meters').innerHTML=metrics.slice(8).map(card).join('');
 const records=metrics.map(m=>({m,r:record(m)}));
 $('measured-count').textContent=String(records.filter(x=>finite(x.r.used)&&x.r.mode!=='手入力'&&!x.r.stale).length)+' / 3';
 const warnings=records.filter(({m,r})=>finite(r.used)&&!r.stale&&quota(r.used,m.cap)?.percent>=80).length;
 $('warning-count').textContent=String(warnings);$('warning-note').textContent=warnings?'使用量が上限に近づいています':'取得できた値のみの判定';
 $('unknown-count').textContent=String(records.filter(x=>!finite(x.r.used)).length)+' / 10';
 $('supabase-state').textContent=snapshot?`集計 ${date(snapshot.checked_at)} JST · 保存ファイル ${fmt.format(snapshot.storage_objects)} 件 · 毎分更新${fresh(snapshot.checked_at)?'':' · データが3分以上更新されていません'}`:'集計を取得できていません。残量は未取得です。';
 $('github-state').textContent=(githubText||'公開処理の状態を取得できていません。')+(buildData?` · 公開ビルド ${buildData.commit.slice(0,7)} · ${fmt.format(buildData.files)} ファイル · 最大ファイル ${fmt.format(buildData.largestFileBytes/MB)} MB`:'');
 const errors=Object.values(failures).filter(Boolean),stale=snapshot&&!fresh(snapshot.checked_at);
 $('notice').classList.toggle('error',errors.length>0||!!stale);
 $('notice').textContent=errors.length?errors.join(' '):stale?'集計の更新が遅れています。前回値を表示しているため、現在の残量は公式管理画面でも確認してください。':snapshot?'データベース・保存ファイルの実測値を取得しました。未取得の項目は公式管理画面から確認できます。':'実測値を取得しています…';
}
async function json(url,options={}) {const res=await fetch(url,{...options,signal:AbortSignal.timeout(14000),cache:'no-store'});if(!res.ok)throw new Error(`HTTP ${res.status}`);return res.json();}
async function loadDatabase(){try{const config=window.SUPABASE_CONFIG;if(!config?.url||!config?.publishableKey)throw new Error('config');const rows=await json(config.url+'/rest/v1/resource_usage_public?id=eq.1&select=database_bytes,storage_bytes,storage_objects,checked_at',{headers:{apikey:config.publishableKey}});if(!Array.isArray(rows)||!validateSnapshot(rows[0]))throw new Error('data');snapshot=rows[0];delete failures.database;}catch{failures.database='Supabaseの取得に失敗しました。取得済みの値がある場合はその日時の値を表示しています。';}}
async function loadBuild(){try{const data=await json('/commons/usage/build-usage.json');if(!validateBuild(data))throw new Error('data');buildData=data;delete failures.build;}catch{failures.build='公開ファイルの計測値を取得できませんでした。';}}
async function loadGithub(){if(Date.now()-githubAttempt<300000)return;githubAttempt=Date.now();try{const data=await json(repo+'/actions/workflows/deploy-pages.yml/runs?per_page=1');const run=data.workflow_runs?.[0];if(!run||typeof run.status!=='string')throw new Error('data');const state=run.status==='completed'?({success:'成功',failure:'失敗',cancelled:'キャンセル',skipped:'スキップ'}[run.conclusion]||run.conclusion):({in_progress:'実行中',queued:'待機中',waiting:'待機中'}[run.status]||run.status);githubText=`最新のGitHub Pages公開処理：${state}（${date(run.updated_at)} JST）。実行中・失敗の場合も、現在公開中のビルドは別途表示しています。`;delete failures.github;}catch{failures.github='GitHubの公開処理状態を取得できませんでした。実行履歴から確認できます。';}}
async function refresh(){if(busy)return;busy=true;$('refresh').disabled=true;$('refresh').textContent='取得中…';const pending=[loadDatabase(),loadBuild(),loadGithub()].map(p=>p.finally(render));await Promise.allSettled(pending);busy=false;$('refresh').disabled=false;$('refresh').textContent='最新の値を取得';render();}
function localInput(iso){const d=new Date(iso);return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16);}
function openManual(id){const m=metrics.find(m=>m.id===id&&m.manual);if(!m)return;activeMetric=m;const r=manual[id];$('manual-title').textContent=m.label;$('manual-unit').textContent=`（${m.unit}）`;$('manual-help').textContent=m.scope+'。期間の日付は日本時間です。';$('manual-value').value=r?String(r.used/m.scale):'';$('period-start').value=r?.periodStart||'';$('period-end').value=r?.periodEnd||'';$('observed-at').value=localInput(r?.observedAt||new Date().toISOString());$('form-error').textContent='';$('clear-manual').disabled=!r;$('manual-dialog').showModal();$('manual-value').focus();}
document.addEventListener('click',e=>{const button=e.target.closest('[data-edit]');if(button)openManual(button.dataset.edit);});
$('close-dialog').onclick=()=>$('manual-dialog').close();
$('manual-form').addEventListener('submit',e=>{e.preventDefault();if(!activeMetric)return;const m=activeMetric,raw=$('manual-value').value,observed=new Date($('observed-at').value);const entry={used:Number(raw)*m.scale,periodStart:$('period-start').value,periodEnd:$('period-end').value,observedAt:Number.isFinite(+observed)?observed.toISOString():''};const check=validateManual(entry);if(!raw.trim()||!check.valid||(m.scale===1&&!Number.isInteger(entry.used))){$('form-error').textContent=check.reason||'使用量を正しい数値で入力してください。回数・人数は整数です。';return;}const next={...manual,[m.id]:entry};try{localStorage.setItem(key,JSON.stringify(next));manual=next;delete failures.storage;$('manual-dialog').close();render();}catch{$('form-error').textContent='端末に保存できませんでした。ブラウザの保存設定を確認してください。';}});
$('clear-manual').onclick=()=>{if(!activeMetric)return;const next={...manual};delete next[activeMetric.id];try{localStorage.setItem(key,JSON.stringify(next));manual=next;$('manual-dialog').close();render();}catch{$('form-error').textContent='記録を削除できませんでした。';}};
$('refresh').onclick=refresh;
setInterval(()=>{render();if($('auto').checked&&!document.hidden)refresh();},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&$('auto').checked)refresh();});
window.addEventListener('storage',e=>{if(e.key!==key)return;try{const data=JSON.parse(e.newValue||'{}');manual={};for(const m of metrics.filter(m=>m.manual))if(validateManual(data?.[m.id]).valid)manual[m.id]=data[m.id];render();}catch{}});
render();refresh();
