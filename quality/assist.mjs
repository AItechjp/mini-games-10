import {apps,appFor} from './apps.mjs';
const PREFS='aitech.display-preferences.v1';
const defaults={text:'normal',spacing:false,contrast:false,motion:'system',touch:false};
export function validPrefs(value){
  const p=value&&typeof value==='object'?value:{};
  return {text:['normal','large','largest'].includes(p.text)?p.text:'normal',spacing:p.spacing===true,contrast:p.contrast===true,motion:p.motion==='true'?'true':'system',touch:p.touch===true};
}
export const cleanText=s=>String(s??'').replace(/\u0000/g,'').trim().slice(0,12000);
export function safeLink(value,base){try{const u=new URL(value,base);return ['https:','http:'].includes(u.protocol)?u.href:null;}catch{return null;}}
// These utilities are importable by the release checks without a browser.
if(typeof document!=='undefined')start();
function start(){
  if(document.getElementById('aitech-assist'))return;
  const aether=document.documentElement.dataset.qualityApp==='aether';
  const find=()=>appFor(location.href,aether)||apps.find(a=>a.id===document.querySelector('[data-quality-app]')?.dataset.qualityApp);
  let app=find();
  if(!app){
    if(!location.pathname.startsWith('/commons/r/'))return;
    const watcher=new MutationObserver(()=>{if(find()){watcher.disconnect();start();}});
    watcher.observe(document.body,{childList:true,subtree:true});setTimeout(()=>watcher.disconnect(),60000);return;
  }
  const node=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
  const button=(text,fn)=>{const b=node('button','',text);b.type='button';b.addEventListener('click',fn);return b;};
  let prefs={...defaults},saveFailed=false;
  try{prefs=validPrefs(JSON.parse(localStorage.getItem(PREFS)||'null'));}catch{saveFailed=true;}
  const apply=()=>{document.documentElement.dataset.qualityReady='true';for(const [k,v]of Object.entries(prefs))document.documentElement.dataset['quality'+k[0].toUpperCase()+k.slice(1)]=String(v);};
  apply();
  const entry=node('aside','quality-entry');entry.id='aitech-assist';entry.setAttribute('aria-label','表示設定と使い方');
  const openButton=button('使い方・表示設定',open);const network=node('span','','');network.setAttribute('role','status');network.hidden=true;entry.append(openButton,network);
  const dialog=node('dialog','quality-dialog');dialog.id='aitech-assist-dialog';dialog.setAttribute('aria-labelledby','quality-heading');
  const header=node('header'),heading=node('h2','','');heading.id='quality-heading';const close=button('閉じる',()=>dialog.close());header.append(heading,close);
  const body=node('div','quality-body'),status=node('p','quality-status');status.setAttribute('role','status');dialog.append(header,body,status);
  document.body.append(entry,dialog);
  const place=()=>{const host=document.querySelector('header nav,header .header-actions,header,.topbar');if(host&&!dialog.contains(host)&&!host.contains(entry))host.append(entry);};
  place();
  // Some games replace their complete menu between the lobby and play screens.
  const placement=new MutationObserver(()=>{if(!entry.isConnected){document.body.append(entry);place();}else if(entry.parentElement===document.body)place();});
  placement.observe(document.body,{childList:true,subtree:true});
  let opener=null,activeId=app.id;const perApp=new Map();
  const session=()=>{if(!perApp.has(app.id))perApp.set(app.id,{records:[],memo:'',candidates:[]});return perApp.get(app.id);};
  function notify(text){status.textContent=text;}
  function save(){apply();try{localStorage.setItem(PREFS,JSON.stringify(prefs));saveFailed=false;notify('表示設定をこの端末に保存しました。');}catch{saveFailed=true;notify('表示設定を端末に保存できません。この画面では設定を使えます。');}}
  function networkState(){network.hidden=navigator.onLine;if(!navigator.onLine)network.textContent='オフラインです。通信が必要な操作は接続後に再試行してください。';}
  networkState();window.addEventListener('offline',networkState);window.addEventListener('online',()=>{network.hidden=false;network.textContent='接続が戻りました。必要な操作を再試行できます。';setTimeout(networkState,7000);});
  window.addEventListener('storage',e=>{if(e.key!==PREFS)return;try{prefs=validPrefs(JSON.parse(e.newValue||'null'));apply();if(dialog.open){render();notify('別タブの表示設定を反映しました。');}}catch{notify('別タブの設定を読み込めませんでした。');}});
  function open(){
    app=find()||app;activeId=app.id;opener=document.activeElement;
    if(document.pointerLockElement)document.exitPointerLock?.();
    render();dialog.showModal();close.focus();notify(saveFailed?'表示設定を端末に保存できません。この画面では利用できます。':'');
    document.dispatchEvent(new CustomEvent('aitech:assist',{detail:{open:true}}));
  }
  dialog.addEventListener('close',()=>{document.dispatchEvent(new CustomEvent('aitech:assist',{detail:{open:false}}));if(opener?.isConnected)opener.focus({preventScroll:true});});
  // Keep game window key handlers from consuming typing and Escape inside the panel.
  for(const event of ['keydown','keyup'])dialog.addEventListener(event,e=>e.stopPropagation());
  window.addEventListener('keydown',e=>{if(e.altKey&&!e.ctrlKey&&!e.metaKey&&e.code==='Slash'&&!e.repeat){e.preventDefault();e.stopImmediatePropagation();if(dialog.open)dialog.close();else open();}},true);
  function render(){
    heading.textContent=app.name;body.replaceChildren();
    const guide=node('details');guide.open=true;guide.append(node('summary','','使い方'),node('p','',app.help),node('p','quality-note',app.trouble));body.append(guide);
    const settings=node('details');settings.append(node('summary','','読みやすさ・押しやすさ'));
    const options=node('div','quality-options');
    const sizeLabel=node('label','','文字サイズ');const size=node('select');size.setAttribute('aria-label','文字サイズ');
    for(const [value,label]of [['normal','標準'],['large','大きい'],['largest','さらに大きい']]){const o=node('option','',label);o.value=value;size.append(o);}size.value=prefs.text;size.onchange=()=>{prefs.text=size.value;save();};sizeLabel.append(size);options.append(sizeLabel);
    for(const [key,label]of [['spacing','行間を広げる'],['contrast','高コントラスト'],['motion','UIの動きを抑える'],['touch','操作ボタンを大きく']]){const l=node('label','',label),c=node('input');c.type='checkbox';c.checked=key==='motion'?prefs.motion==='true':prefs[key];c.onchange=()=>{prefs[key]=key==='motion'?(c.checked?'true':'system'):c.checked;save();};l.append(c);options.append(l);}
    settings.append(options,node('p','quality-note','文字は説明文・ラベル、動きの設定は画面UIが対象です。ゲームの描画品質は各ゲームで設定します。設定は同じサイトのタブ間で共有されます。'));
    const reset=button('表示設定を初期化',()=>{prefs={...defaults};save();render();notify('表示設定だけを初期化しました。');});settings.append(reset);body.append(settings);
    if(app.kind==='compare')renderCompare();else if(app.kind==='record')renderRecord();else body.append(node('p','quality-note',app.kind==='canvas'?'PNG保存・背景・解像度は、ルーム内のキャンバスのツールバーから選べます。':'セルフタイマー・グリッドは、カメラ画面の撮影操作で選べます。'));
    body.append(node('p','quality-note','Alt + / で開閉 · Escで閉じる'));
  }
  async function copy(text){try{await navigator.clipboard.writeText(text);notify('コピーしました。');}catch{const fallback=node('textarea');fallback.readOnly=true;fallback.value=text;fallback.setAttribute('aria-label','手動コピー用のテキスト');body.append(fallback);fallback.focus();fallback.select();notify('コピーできませんでした。選択した文章を手動でコピーできます。');}}
  function download(text){const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));const a=node('a');a.href=url;a.download=`aitech-${app.id}-${new Date().toISOString().slice(0,10)}.txt`;body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);notify('テキストの保存を開始しました。');}
  function stamp(){return new Date().toLocaleString('ja-JP',{timeZone:'Asia/Tokyo',hour12:false})+'（日本時間）';}
  function visible(el){return !!el.getClientRects().length&&!el.closest('[hidden],[aria-hidden=true],#aitech-assist-dialog');}
  function snapshot(){const found=[...document.querySelectorAll(app.status||'main h1')].filter(visible);return [...new Set(found.map(n=>cleanText(n.innerText||n.textContent)).filter(Boolean))].join('\n').slice(0,12000);}
  function renderRecord(){
    const s=session();body.append(node('h3','','表示の記録・振り返り'));body.append(node('p','quality-note','表示中の内容をボタンで控えます。最大50件。メモもこのタブを閉じるまで保持します。対局の再開用セーブではありません。'));
    const history=node('div','quality-history');history.tabIndex=0;history.setAttribute('aria-label','表示記録');
    const draw=()=>{history.textContent=s.records.length?s.records.map(r=>r.at+'\n'+r.text).join('\n\n'):'まだ記録がありません。';};draw();
    const memoLabel=node('label','','振り返りメモ'),memo=node('textarea');memo.setAttribute('aria-label','振り返りメモ');memo.maxLength=5000;memo.value=s.memo;memo.oninput=()=>{s.memo=memo.value;};memoLabel.append(memo);
    const text=()=>app.name+'\n'+s.records.map(r=>r.at+'\n'+r.text).join('\n\n')+'\n\nメモ\n'+s.memo;
    const capture=button('現在の表示を記録',()=>{const t=snapshot();if(!t){notify('記録できる状況表示がありません。先にアプリを開始してください。');return;}s.records.push({at:stamp(),text:t});if(s.records.length>50)s.records.shift();draw();notify('表示内容を記録しました。 '+s.records.length+' / 50件');});
    const actions=node('div','quality-actions');actions.append(capture,button('記録をコピー',()=>copy(text())),button('テキスト保存',()=>download(text())));body.append(actions,history,memoLabel);
  }
  function renderCompare(){
    const s=session();body.append(node('h3','','候補を比較'));body.append(node('p','quality-note','最大8件。選択時点の画面の控えです。画面を閉じると候補も消えます。条件を変えた結果も比較できます。'));
    const search=node('input','quality-picker');search.type='search';search.placeholder='表示中の候補名で絞り込む';search.setAttribute('aria-label','比較に追加する候補を検索');
    const picker=node('select','quality-picker');picker.setAttribute('aria-label','比較に追加する候補');
    const candidates=[...document.querySelectorAll(app.selector)].filter(visible).map(el=>{
      const text=cleanText(el.innerText||el.textContent);const title=cleanText(el.querySelector('h2,h3,.btc-node-label,time')?.textContent||text.split('\n')[0]).slice(0,140);
      const links=[...el.querySelectorAll('a[href]')].map(a=>({label:cleanText(a.textContent)||'情報源',url:safeLink(a.getAttribute('href'),location.href)})).filter(x=>x.url);
      return {title,text,links,at:stamp(),key:title+'\n'+text};
    }).filter(c=>c.text);
    const fill=()=>{const q=search.value.normalize('NFKC').toLowerCase();picker.replaceChildren();const empty=node('option','',candidates.length?'候補を選択':'表示中の比較対象がありません');empty.value='';picker.append(empty);candidates.forEach((c,i)=>{if(!c.title.normalize('NFKC').toLowerCase().includes(q))return;const o=node('option','',c.title);o.value=String(i);picker.append(o);});};fill();search.oninput=fill;
    const rows=node('tbody'),table=node('table','quality-compare'),thead=node('thead'),tr=node('tr');for(const title of ['候補・選択日時','表示内容・情報源','操作'])tr.append(node('th','',title));thead.append(tr);table.append(thead,rows);
    const refresh=()=>{rows.replaceChildren();for(const [i,c]of s.candidates.entries()){const row=node('tr'),name=node('td');name.append(node('strong','',c.title),node('p','quality-note',c.at));const detail=node('td');detail.append(node('p','',c.text));for(const link of c.links){const a=node('a','',link.label);a.href=link.url;a.target='_blank';a.rel='noopener noreferrer';detail.append(a,document.createTextNode(' '));}const control=node('td');const remove=button('解除',()=>{s.candidates.splice(i,1);refresh();notify('候補から解除しました。');add.focus();});remove.setAttribute('aria-label',c.title+'を比較から解除');control.append(remove);row.append(name,detail,control);rows.append(row);}table.hidden=!s.candidates.length;add.disabled=s.candidates.length>=8;};
    const add=button('比較に追加',()=>{if(picker.value===''){notify('先に候補を選んでください。');return;}const c=candidates[Number(picker.value)];if(!c)return;if(s.candidates.some(v=>v.key===c.key)){notify('この候補は追加済みです。');return;}if(s.candidates.length>=8){notify('比較は8件までです。先に候補を解除してください。');return;}s.candidates.push(c);refresh();notify(c.title+'を追加しました。');});
    const text=()=>app.name+' — 比較候補\n選択時点の画面の控えです。最新情報は掲載元で確認してください。\n\n'+s.candidates.map(c=>c.title+'\n'+c.at+'\n'+c.text+'\n'+c.links.map(l=>l.label+': '+l.url).join('\n')).join('\n\n');
    const actions=node('div','quality-actions');actions.append(add,button('比較をコピー',()=>{if(s.candidates.length)copy(text());else notify('候補を追加してください。');}),button('比較をテキスト保存',()=>{if(s.candidates.length)download(text());else notify('候補を追加してください。');}));
    body.append(search,picker,actions,table);refresh();
  }
}
