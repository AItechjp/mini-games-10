import {APPS,BY_ID,FEATURES,PROFILE_KEY,MAX_NOTE,appFromURL,canonical,matches,helpRows,guideText,noteKey,readProfile,updateProfile,readNote,saveNote,exportNote,importNote} from './model.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const root=document.documentElement;
let app,host,shadow,dialog,triggerHost,lastFocus,tab='guide',profile,profileError='',note=null,noteText='',dirty=false,noteError='',saveTimer,search='',helpSearch='',filter='all',imported=null,previewRevision=null,refreshTimer,opening=false,appliedPreference='';
const defaultProfile=()=>({version:1,favorites:[],recent:[],font:'normal',contrast:false,motion:'system'});
function storage(){return localStorage;}
function readPreferences(){try{profile=readProfile(storage());profileError='';}catch{profile??=defaultProfile();profileError='設定を端末に保存できません。この画面ではそのまま使えます。';}}
readPreferences();
const reduceMedia=matchMedia('(prefers-reduced-motion: reduce)');
const globalStyle=document.createElement('style');globalStyle.id='aitech-guide-motion';globalStyle.textContent='html[data-aitech-motion="reduce"] *,html[data-aitech-motion="reduce"] *::before,html[data-aitech-motion="reduce"] *::after{animation-duration:.001ms!important;animation-iteration-count:1!important;transition-duration:.001ms!important;scroll-behavior:auto!important}';document.head.append(globalStyle);
function preferences(){
 if(!host)return;const signature=JSON.stringify([app?.id,profile.font,profile.contrast,profile.motion,reduceMedia.matches]);if(signature===appliedPreference)return;appliedPreference=signature;host.toggleAttribute('data-contrast',profile.contrast);host.style.setProperty('--guide-size',({normal:16,large:18,larger:20})[profile.font]+'px');
 const reduce=profile.motion==='reduce'||reduceMedia.matches;root.toggleAttribute('data-aitech-motion',reduce);if(reduce)root.dataset.aitechMotion='reduce';
 document.dispatchEvent(new CustomEvent('aitech:display-settings',{detail:{reduceMotion:reduce}}));
}
reduceMedia.addEventListener?.('change',preferences);
function profileChange(fn){try{profile=updateProfile(storage(),fn);profileError='';preferences();return true;}catch{status('設定を保存できませんでした。保存済みの内容は保持しています。',true);return false;}}
function status(message,error=false){const el=shadow?.getElementById('status');if(el){el.textContent=message;el.classList.toggle('error',error);el.setAttribute('role',error?'alert':'status');}}
function loadNote(){
 clearTimeout(saveTimer);dirty=false;noteError='';
 try{note=readNote(storage(),app.id);noteText=note?.text??'';}catch(e){note=null;noteText='';noteError=e.message;}
}
function noteStatus(){
 const el=shadow?.getElementById('note-status');if(el)el.textContent=noteError|| (dirty?'保存中…':note?'保存済み · '+new Date(note.updated).toLocaleString('ja-JP'):'入力するとこのサイトのブラウザに保存します。');
 const count=shadow?.getElementById('note-count');if(count)count.textContent=noteText.length.toLocaleString()+' / '+MAX_NOTE.toLocaleString();
 const undo=shadow?.getElementById('undo');if(undo)undo.disabled=note?.previous===null||!note||dirty||!!noteError;
 const conflict=shadow?.getElementById('conflict');if(conflict)conflict.hidden=!noteError;
}
function persist(){
 clearTimeout(saveTimer);if(!dirty||!app)return !noteError;
 try{note=saveNote(storage(),app.id,noteText,note?.revision??null,Date.now(),crypto.randomUUID());dirty=false;noteError='';noteStatus();return true;}
 catch(e){noteError=e.message;noteStatus();return false;}
}
function editNote(text){noteText=text;dirty=true;noteError='';noteStatus();clearTimeout(saveTimer);saveTimer=setTimeout(persist,350);}
function download(name,text,type='text/plain;charset=utf-8'){
 const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
async function copyLink(){
 const url=canonical(app.id);try{await navigator.clipboard.writeText(url);status('アプリの入口URLをコピーしました。');}
 catch{const panel=shadow.getElementById('copy-fallback');panel.hidden=false;const input=panel.querySelector('input');input.value=url;input.focus();input.select();status('表示されたURLを選択してコピーしてください。');}
}
async function shareLink(){
 if(!navigator.share){await copyLink();return;}
 try{await navigator.share({title:app.name,text:app.goal,url:canonical(app.id)});status('共有メニューを開きました。');}
 catch(e){if(e?.name!=='AbortError')await copyLink();}
}
function appCard(item){return `<article class="app-card"><a href="${esc(canonical(item.id))}"><strong>${esc(item.name)}</strong><small>${esc(item.group)} · ${esc(item.goal)}</small></a><button class="icon" data-pin="${item.id}" aria-label="${esc(item.name)}をお気に入り${profile.favorites.includes(item.id)?'から削除':'に追加'}" aria-pressed="${profile.favorites.includes(item.id)}">${profile.favorites.includes(item.id)?'★':'☆'}</button></article>`;}
function connection(){return `<div class="connection"><strong id="network-status">${navigator.onLine?'ブラウザの接続状態：オンライン':'ブラウザの接続状態：オフライン'}</strong><p>${esc(app.network)}</p><p class="muted">接続状態はブラウザの報告です。取得・同期の成否は、各アプリの表示を確認してください。</p></div>`;}
function guideContent(){return `<p class="goal">${esc(app.goal)}</p><form class="search" id="help-form" role="search"><input type="search" id="help-search" aria-label="${esc(app.name)}の使い方を検索" placeholder="操作・困りごとを検索" value="${esc(helpSearch)}" maxlength="200"><button type="button" id="help-clear" aria-label="ヘルプ検索をクリア">×</button></form><div id="help-results"></div><section class="related"><h3>関連アプリ</h3><div class="cards">${(app.related??[]).map(id=>appCard(BY_ID[id])).join('')}</div></section>${connection()}<div class="actions"><button id="copy">入口URLをコピー</button><button id="share">共有する</button><button id="guide-export">ガイドを保存</button></div><p class="share-note">共有するのはアプリの入口です。対局・ルームの招待にはアプリ本来の招待機能を使ってください。</p><div id="copy-fallback" class="copy-fallback" hidden><input type="text" readonly aria-label="コピーする入口URL"></div>`;}
function helpResults(){
 const area=shadow.getElementById('help-results');if(!area)return;
 if(helpSearch.trim()){const rows=helpRows(app).filter(r=>matches(r.title+' '+r.text,helpSearch));area.innerHTML=`<p class="count" role="status">${rows.length}件</p>`+(rows.length?rows.map(r=>`<section class="notice"><h4>${esc(r.title)}</h4><p>${esc(r.text)}</p></section>`).join(''):'<p class="empty">言葉を短くするか、検索をクリアしてください。</p>');return;}
 area.innerHTML=`<ol class="steps">${app.steps.map((s,i)=>`<li><b>STEP 0${i+1}</b><span>${esc(s)}</span></li>`).join('')}</ol><div class="split"><section><h3>操作の早見表</h3><ul class="controls">${app.controls.map(s=>`<li>${esc(s)}</li>`).join('')}</ul></section><section><h3>困ったとき</h3>${app.faq.map(([q,a])=>`<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</section></div>`;
}
function appsContent(){return `<form class="search" id="apps-form" role="search"><input type="search" id="app-search" aria-label="33アプリから検索" placeholder="名前や用途で検索" value="${esc(search)}" maxlength="200"><button type="button" id="app-clear" aria-label="アプリ検索をクリア">×</button></form><div class="filters"><button data-filter="all" aria-pressed="${filter==='all'}">すべて</button><button data-filter="favorites" aria-pressed="${filter==='favorites'}">お気に入り</button><button data-filter="recent" aria-pressed="${filter==='recent'}">最近使ったアプリ</button></div><div id="app-results"></div><p class="muted">お気に入りと履歴は、このサイトのブラウザに保存します。</p>`;}
function appsResults(){
 const area=shadow.getElementById('app-results');if(!area)return;
 const list=filter==='recent'?profile.recent.map(id=>BY_ID[id]):APPS.filter(a=>filter!=='favorites'||profile.favorites.includes(a.id));
 const rows=list.filter(a=>matches(a.name+' '+a.goal+' '+a.group+' '+a.note,search));
 area.innerHTML=`<div class="list-title"><h3>${filter==='recent'?'最近使った順':filter==='favorites'?'お気に入り':'アプリ一覧'}</h3><span class="count" role="status">${rows.length}アプリ</span></div>`+(rows.length?`<div class="cards">${rows.map(appCard).join('')}</div>`:'<p class="empty">該当するアプリがありません。検索条件やお気に入りを確認してください。</p>');
}
function notesContent(){return `<h3>${esc(app.note)}</h3><p class="muted">この個人メモはルームへ投稿されません。対局・答案・写真そのものの保存機能とは別です。</p><label class="field"><span>個人メモ</span><textarea id="note" class="note" maxlength="${MAX_NOTE}" aria-describedby="note-status" placeholder="${esc(app.note)}"></textarea></label><div class="note-meta"><span id="note-status" role="status"></span><span id="note-count"></span></div><div id="conflict" class="notice error" hidden><p>入力内容はこの画面に残しています。書き出して保管するか、最新の保存内容を確認してください。</p><button id="latest-note">最新のメモを確認</button><button id="defer-note">入力をこの画面に残して閉じる</button></div><div class="actions"><button class="primary" id="note-save">今すぐ保存</button><button id="note-export">メモを書き出す</button><button id="note-import">メモを読み込む</button><button id="undo">前のメモへ戻す</button></div><input id="note-file" type="file" accept="application/json,.json" hidden><div id="import-preview" class="import-preview" hidden><h4 id="import-title">内容を確認</h4><pre id="import-text"></pre><div class="actions"><button id="import-append" class="primary">この内容を追記</button><button id="import-cancel">取り消す</button></div></div><p class="muted">ファイルに含まれるのは、このアプリの個人メモだけです。保存内容を戻す操作でも、直前の内容を一つ残します。</p>`;}
function settingsContent(){return `<h3>読みやすさと操作</h3><div class="settings"><label class="setting"><div><strong>説明パネルの文字サイズ</strong><p>アプリメニューの文字を読みやすくします。</p></div><select id="font" aria-label="説明パネルの文字サイズ">${[['normal','標準'],['large','大きめ'],['larger','さらに大きく']].map(([v,l])=>`<option value="${v}" ${profile.font===v?'selected':''}>${l}</option>`).join('')}</select></label><div class="setting"><div><strong>高コントラスト</strong><p>説明パネルの文字と境界をはっきり表示します。</p></div><button id="contrast" aria-pressed="${profile.contrast}">${profile.contrast?'オン':'オフ'}</button></div><label class="setting"><div><strong>装飾アニメーション</strong><p>ボタンなどの装飾アニメーションを減らします。ゲーム操作中の動きは維持します。</p></div><select id="motion" aria-label="装飾アニメーション"><option value="system" ${profile.motion==='system'?'selected':''}>端末の設定に従う</option><option value="reduce" ${profile.motion==='reduce'?'selected':''}>減らす</option></select></label><div class="notice"><h4>キーボードで操作</h4><p><span class="kbd">Alt + Shift + M</span> でアプリメニューを開けます。Tabで移動、Enterで決定。上部のタブは左右キーでも切り替えられます。Escで閉じ、開く前の位置へ戻ります。</p></div></div>${connection()}<div class="actions"><button id="reset-settings">表示設定を標準に戻す</button></div><p class="muted">表示設定を戻しても、個人メモ・お気に入り・アプリの保存データは削除しません。</p>`;}
function render(){
 if(!shadow)return;
 const names={guide:'使い方',apps:'アプリを探す',notes:'個人メモ',settings:'表示設定'};
 shadow.getElementById('app-title').textContent=app.name;shadow.getElementById('app-group').textContent=app.group+' / アプリメニュー';
 const pin=shadow.getElementById('pin-current');pin.textContent=profile.favorites.includes(app.id)?'★':'☆';pin.setAttribute('aria-pressed',String(profile.favorites.includes(app.id)));pin.setAttribute('aria-label',app.name+'をお気に入り'+(profile.favorites.includes(app.id)?'から削除':'に追加'));
 shadow.getElementById('tabs').innerHTML=Object.entries(names).map(([id,name])=>`<button id="tab-${id}" role="tab" data-tab="${id}" aria-selected="${tab===id}" aria-controls="panel" tabindex="${tab===id?0:-1}">${name}</button>`).join('');
 const panel=shadow.getElementById('panel');panel.setAttribute('aria-labelledby','tab-'+tab);panel.innerHTML=({guide:guideContent,apps:appsContent,notes:notesContent,settings:settingsContent})[tab]();
 if(tab==='guide')helpResults();if(tab==='apps')appsResults();if(tab==='notes'){shadow.getElementById('note').value=noteText;noteStatus();}
 shadow.getElementById('quality-open').hidden=!document.getElementById('aitech-assist-dialog');preferences();if(profileError)status(profileError,true);
}
function pin(id){
 if(!profileChange(p=>({...p,favorites:p.favorites.includes(id)?p.favorites.filter(x=>x!==id):[...p.favorites,id]})))return;
 const focused=shadow.activeElement?.dataset.pin;
 for(const b of shadow.querySelectorAll('[data-pin]')){const selected=profile.favorites.includes(b.dataset.pin);b.textContent=selected?'★':'☆';b.setAttribute('aria-pressed',String(selected));b.setAttribute('aria-label',BY_ID[b.dataset.pin].name+'をお気に入り'+(selected?'から削除':'に追加'));}
 const selected=profile.favorites.includes(app.id),button=shadow.getElementById('pin-current');button.textContent=selected?'★':'☆';button.setAttribute('aria-pressed',String(selected));button.setAttribute('aria-label',app.name+'をお気に入り'+(selected?'から削除':'に追加'));
 if(tab==='apps'&&filter==='favorites'){appsResults();if(focused)(shadow.querySelector('[data-pin]')||shadow.getElementById('app-search'))?.focus();}
 status(BY_ID[id].name+(profile.favorites.includes(id)?'をお気に入りに追加しました。':'をお気に入りから外しました。'));
}
function preview(text,title='読み込む内容を確認',revision=note?.revision??null){
 imported=text;previewRevision=revision;status('内容を確認してから追記してください。');const area=shadow.getElementById('import-preview');area.hidden=false;shadow.getElementById('import-title').textContent=title;shadow.getElementById('import-text').textContent=text;shadow.getElementById('import-append').focus();
}
async function onClick(event){
 const path=event.composedPath(),button=path.find(n=>n instanceof HTMLElement&&(n.tagName==='BUTTON'||n.tagName==='A'));if(!button)return;
 if(button.tagName==='A'){if(dirty&&!persist()){event.preventDefault();tab='notes';render();status('移動前に、保存できていないメモを書き出してください。',true);}return;}
 if(button.dataset.tab){persist();tab=button.dataset.tab;render();shadow.getElementById('tab-'+tab).focus();return;}
 if(button.dataset.pin){pin(button.dataset.pin);return;}
 if(button.dataset.filter){filter=button.dataset.filter;for(const b of shadow.querySelectorAll('[data-filter]'))b.setAttribute('aria-pressed',String(b.dataset.filter===filter));appsResults();return;}
 const id=button.id;
 if(id==='quality-open'){if(dirty&&!persist()){tab='notes';render();status('保存できていないメモを先に書き出してください。',true);return;}closeGuide();document.dispatchEvent(new CustomEvent('aitech:assist-request',{detail:{opener:triggerHost?.shadowRoot?.querySelector('button')}}));return;}
 if(id==='defer-note'){closeGuide(true);return;}
 if(id==='close'){closeGuide();return;}if(id==='pin-current'){pin(app.id);return;}
 if(id==='help-clear'){helpSearch='';shadow.getElementById('help-search').value='';helpResults();shadow.getElementById('help-search').focus();}
 if(id==='app-clear'){search='';shadow.getElementById('app-search').value='';appsResults();shadow.getElementById('app-search').focus();}
 if(id==='copy')await copyLink();if(id==='share')await shareLink();
 if(id==='guide-export'){download(app.id+'-guide.txt',guideText(app));status('操作ガイドを書き出しました。');}
 if(id==='note-save'){if(persist())status('個人メモを保存しました。');}
 if(id==='note-export'){download(app.id+'-notes.json',exportNote(app.id,noteText,new Date().toISOString()),'application/json');status('この画面の個人メモを書き出しました。');}
 if(id==='note-import')shadow.getElementById('note-file').click();
 if(id==='undo'&&note?.previous!==null&&note){editNote(note.previous);shadow.getElementById('note').value=noteText;if(persist())status('一つ前のメモに戻しました。');else status(noteError,true);}
 if(id==='latest-note'){try{const latest=readNote(storage(),app.id);preview(latest?.text??'','最新の保存内容（この画面の入力は残っています）',latest?.revision??null);}catch(e){status(e.message,true);}}
 if(id==='import-cancel'){imported=null;shadow.getElementById('import-preview').hidden=true;shadow.getElementById('note').focus();}
 if(id==='import-append'&&imported!==null){const joined=[...new Set([noteText,imported].filter(Boolean))].join('\n\n');if(joined.length>MAX_NOTE){status('追記すると文字数の上限を超えます。入力か読み込むメモを短くしてください。',true);return;}try{const latest=readNote(storage(),app.id);if((latest?.revision??null)!==previewRevision)throw new Error('確認中に別の画面で更新されました。最新のメモを確認してから追記してください。');note=latest;editNote(joined);shadow.getElementById('note').value=noteText;persist();imported=null;shadow.getElementById('import-preview').hidden=true;shadow.getElementById('note').focus();}catch(e){status(e.message,true);}}
 if(id==='contrast'){if(profileChange(p=>({...p,contrast:!p.contrast}))){button.textContent=profile.contrast?'オン':'オフ';button.setAttribute('aria-pressed',String(profile.contrast));}}
 if(id==='reset-settings'){if(profileChange(p=>({...p,font:'normal',contrast:false,motion:'system'}))){render();status('表示設定を標準に戻しました。');shadow.getElementById('reset-settings').focus();}}
}
function build(){
 host=document.createElement('div');host.id='aitech-app-guide';host.dataset.features=FEATURES.map(([id])=>id).join(' ');shadow=host.attachShadow({mode:'open'});
 shadow.innerHTML=`<link rel="stylesheet" href="${new URL('./panel.css',import.meta.url).href}"><style>dialog:not([open]){display:none}dialog{width:min(900px,calc(100vw - 32px));max-height:calc(100dvh - 32px)}.trigger{min-height:44px}</style><dialog aria-labelledby="app-title"><div class="shell"><header class="head"><div><p class="eyebrow" id="app-group"></p><h2 id="app-title"></h2><p>使い方・個人メモ・アプリの切り替え</p></div><div class="head-actions"><button class="icon" id="pin-current"></button><button class="icon" id="close" aria-label="アプリメニューを閉じる">×</button></div></header><nav id="tabs" class="tabs" role="tablist" aria-label="アプリメニュー"></nav><div class="body"><section id="panel" role="tabpanel" tabindex="0"></section><div class="actions"><button id="quality-open">画面設定・記録・比較を開く</button></div><footer class="footer-links"><a href="https://aitechd.com/games.html">ゲーム集</a><a href="https://aitechd.com/commons/">コモンズ</a></footer></div><div id="status" class="status" role="status" aria-live="polite"></div></div></dialog>`;
 document.body.append(host);dialog=shadow.querySelector('dialog');dialog.addEventListener('cancel',e=>{e.preventDefault();closeGuide();});
 host.addEventListener('click',onClick);
 for(const name of ['keydown','keyup','pointerdown','pointerup','pointermove'])host.addEventListener(name,event=>event.stopPropagation());
 shadow.addEventListener('submit',event=>event.preventDefault());
 shadow.addEventListener('input',event=>{const target=event.target;if(target.id==='help-search'){helpSearch=target.value;helpResults();}if(target.id==='app-search'){search=target.value;appsResults();}if(target.id==='note')editNote(target.value);});
 shadow.addEventListener('change',async event=>{
  const target=event.target;
  if(target.id==='font')profileChange(p=>({...p,font:target.value}));if(target.id==='motion')profileChange(p=>({...p,motion:target.value}));
  if(target.id==='note-file'){const file=target.files?.[0];if(!file)return;target.value='';if(file.size>150000){status('150KB以下のメモファイルを選んでください。',true);return;}try{preview(importNote(await file.text(),app.id));}catch(e){status(e.message,true);}}
 });
 shadow.addEventListener('keydown',event=>{
  if(event.target.closest('[role="tablist"]')&&['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();const ids=['guide','apps','notes','settings'],index=ids.indexOf(tab);tab=event.key==='Home'?ids[0]:event.key==='End'?ids.at(-1):ids[(index+(event.key==='ArrowRight'?1:3))%4];persist();render();shadow.getElementById('tab-'+tab).focus();}
 });
}
function installTrigger(){
 const common=document.getElementById('aitech-fullscreen')?.shadowRoot;
 const native=document.querySelector('[data-aitech-guide-slot]')||document.getElementById('fullscreen-btn')?.parentElement||document.querySelector('.header-actions');
 const parent=common||native;if(!parent)return;root.dataset.aitechGuideReady='';
 if(triggerHost?.parentNode===parent)return;triggerHost?.remove();triggerHost=document.createElement('span');triggerHost.dataset.aitechGuideTrigger='';
 const own=triggerHost.attachShadow({mode:'open'});own.innerHTML='<style>:host{display:inline-flex;margin-left:6px;vertical-align:middle}button{font:650 15px/1 system-ui;color:#fff;background:#172235;border:1px solid #8996ab;border-radius:8px;min-width:44px;min-height:44px;padding:10px;cursor:pointer;touch-action:manipulation}button:focus-visible{outline:3px solid #60cfff;outline-offset:3px}</style><button type="button" aria-label="アプリメニューを開く" title="使い方・個人メモ・表示設定">☰</button>';
 own.querySelector('button').addEventListener('click',event=>{event.stopPropagation();openGuide();});for(const name of ['keydown','keyup','pointerdown','pointerup'])triggerHost.addEventListener(name,event=>event.stopPropagation());
 if(common)parent.insertBefore(triggerHost,parent.querySelector('p'));else parent.append(triggerHost);
}
function openGuide(){
 if(!app||dialog?.open||opening||document.getElementById('aitech-assist-dialog')?.open)return;opening=true;
 try{lastFocus=document.activeElement;while(lastFocus?.shadowRoot?.activeElement)lastFocus=lastFocus.shadowRoot.activeElement;root.dataset.aitechGuideOpen='';document.exitPointerLock?.();document.dispatchEvent(new CustomEvent('aitech:guide-open',{detail:{appId:app.id}}));
  const fullscreen=document.fullscreenElement||document.webkitFullscreenElement;if(fullscreen&&!/^(CANVAS|VIDEO|IFRAME)$/.test(fullscreen.tagName)&&!fullscreen.contains(host))fullscreen.append(host);
  render();dialog.showModal();host.dataset.open='true';shadow.getElementById('close').focus();
 }catch{delete root.dataset.aitechGuideOpen;document.dispatchEvent(new CustomEvent('aitech:guide-close',{detail:{appId:app.id}}));status('メニューを開けませんでした。もう一度お試しください。',true);}finally{opening=false;}
}
function closeGuide(defer=false){if(dirty&&!persist()&&!defer){tab='notes';render();status('メモを保存できませんでした。書き出すか、保存を再試行してください。',true);shadow.getElementById('note').focus();return;}dialog.close();delete host.dataset.open;delete root.dataset.aitechGuideOpen;document.dispatchEvent(new CustomEvent('aitech:guide-close',{detail:{appId:app.id}}));if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});else triggerHost?.shadowRoot?.querySelector('button')?.focus({preventScroll:true});}
function refresh(){
 clearTimeout(refreshTimer);refreshTimer=undefined;if(document.hidden)return;
 const hint=document.querySelector('meta[name="aitech-app"]')?.content||document.querySelector('[data-aitech-app]')?.dataset.aitechApp;
 const next=appFromURL(location.href,hint);if(!next)return;
 if(app?.id!==next.id){if(app&&dirty&&!persist())return;app=next;loadNote();if(!host)build();host.dataset.app=app.id;profileChange(p=>({...p,recent:[app.id,...p.recent.filter(id=>id!==app.id)].slice(0,8)}));if(dialog.open)render();}
 installTrigger();preferences();
}
let observedURL=location.href;
const observer=new MutationObserver(records=>{const routeChanged=observedURL!==location.href;observedURL=location.href;if(!routeChanged&&triggerHost?.isConnected&&!records.some(r=>[...r.addedNodes,...r.removedNodes].some(n=>n.nodeType===1&&(n.matches?.('header,main,[data-aitech-app],[data-aitech-guide-slot],#aitech-fullscreen,#fullscreen-btn,.header-actions')||n.querySelector?.('[data-aitech-app],#aitech-fullscreen,#fullscreen-btn,.header-actions')))))return;if(!refreshTimer)refreshTimer=setTimeout(()=>{refreshTimer=undefined;refresh();},400);});observer.observe(document.body,{childList:true,subtree:true});
window.addEventListener('popstate',refresh);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();else persist();});
window.addEventListener('pagehide',persist);window.addEventListener('beforeunload',event=>{if(dirty&&!persist()){event.preventDefault();event.returnValue='';}});
window.addEventListener('storage',event=>{
 if(event.key===PROFILE_KEY){readPreferences();preferences();if(dialog?.open&&tab==='apps')appsResults();}
 if(app&&event.key===noteKey(app.id)){if(dirty||shadow?.activeElement?.id==='note'){noteError='別の画面でメモが更新されました。この画面の入力は残しています。';noteStatus();}else{loadNote();if(dialog?.open&&tab==='notes'){shadow.getElementById('note').value=noteText;noteStatus();}}}
});
for(const event of ['online','offline'])window.addEventListener(event,()=>{const el=shadow?.getElementById('network-status');if(el)el.textContent=navigator.onLine?'ブラウザの接続状態：オンライン':'ブラウザの接続状態：オフライン';});
document.addEventListener('keydown',event=>{if(event.altKey&&event.shiftKey&&event.code==='KeyM'&&!event.repeat&&!event.isComposing){event.preventDefault();event.stopImmediatePropagation();if(dialog?.open)closeGuide();else openGuide();}},true);
refresh();
