import {APPS,BY_ID,FEATURES} from './catalog.mjs';
export {APPS,BY_ID,FEATURES};
export const PROFILE_KEY='aitech.app-guide.profile.v1';
export const MAX_NOTE=20000;
export const noteKey=id=>{if(!BY_ID[id])throw new Error('不明なアプリです。');return `aitech.app-guide.note.v1.${id}`;};
export const normalize=value=>String(value??'').normalize('NFKC').toLocaleLowerCase('ja').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-96));
export const matches=(value,query)=>normalize(query).trim().split(/\s+/u).every(term=>normalize(value).includes(term));
export const searchApps=query=>APPS.filter(a=>matches([a.name,a.group,a.goal,a.note].join(' '),query));
export const canonical=id=>new URL(BY_ID[id].path,'https://aitechd.com/').href;
export function appFromURL(value,hint){
 if(hint&&BY_ID[hint])return BY_ID[hint];
 const url=new URL(value,'https://aitechd.com'),p=url.pathname.replace(/index\.html$/,'').replace(/\/$/,'')||'/';
 if(url.hostname==='aether-card-duel.douga071132.chatgpt.site')return BY_ID.aether;
 if(p==='/board-games')return BY_ID[url.searchParams.get('game')]?.path.startsWith('/board-games/')?BY_ID[url.searchParams.get('game')]:BY_ID.gomoku;
 if(p==='/trump')return BY_ID[url.searchParams.get('game')==='speed'?'speed':'memory'];
 if(p==='/classic.html'){const game=url.searchParams.get('game');return !game||game==='daifugo'?BY_ID.daifugo:game==='gomoku'?BY_ID.gomoku:null;}
 if(p==='/yobi-quiz.html'||p==='/yobi-ronbun.html')return BY_ID.yobi;
 return APPS.find(a=>new URL(a.path,'https://aitechd.com').pathname.replace(/\/$/,'')===p)??null;
}
const fresh=()=>({version:1,favorites:[],recent:[],font:'normal',contrast:false,motion:'system'});
export function cleanProfile(value){
 if(!value||typeof value!=='object'||value.version!==1)throw new Error('表示設定を読み込めませんでした。保存済みの値は保持しています。');
 return {version:1,favorites:[...new Set(Array.isArray(value.favorites)?value.favorites.filter(id=>BY_ID[id]):[])],recent:[...new Set(Array.isArray(value.recent)?value.recent.filter(id=>BY_ID[id]):[])].slice(0,8),font:['normal','large','larger'].includes(value.font)?value.font:'normal',contrast:value.contrast===true,motion:['system','reduce'].includes(value.motion)?value.motion:'system'};
}
export function readProfile(storage){const raw=storage.getItem(PROFILE_KEY);return raw===null?fresh():cleanProfile(JSON.parse(raw));}
export function updateProfile(storage,change){const current=readProfile(storage),next=cleanProfile(change(current));storage.setItem(PROFILE_KEY,JSON.stringify(next));return next;}
export function cleanNote(value,id){
 if(!value||value.version!==1||value.appId!==id||typeof value.text!=='string'||value.text.length>MAX_NOTE||typeof value.revision!=='string'||!value.revision||!Number.isFinite(value.updated)||value.updated<0||!(value.previous===null||typeof value.previous==='string'&&value.previous.length<=MAX_NOTE))throw new Error('メモの保存形式を確認できません。元のデータは変更していません。');
 return {version:1,appId:id,text:value.text,revision:value.revision,updated:value.updated,previous:value.previous};
}
export function readNote(storage,id){const raw=storage.getItem(noteKey(id));return raw===null?null:cleanNote(JSON.parse(raw),id);}
export function saveNote(storage,id,text,revision,now,nextRevision){
 if(typeof text!=='string'||text.length>MAX_NOTE)throw new Error(`メモは${MAX_NOTE.toLocaleString()}文字以内で入力してください。`);
 const current=readNote(storage,id);
 if((current?.revision??null)!==revision){const e=new Error('別の画面でメモが更新されました。この画面の入力を残しています。最新のメモを確認してください。');e.name='NoteConflict';throw e;}
 if(current?.text===text)return current;
 const next=cleanNote({version:1,appId:id,text,revision:nextRevision,updated:now,previous:current?.text??null},id);
 storage.setItem(noteKey(id),JSON.stringify(next));return next;
}
export function exportNote(id,text,now){if(!BY_ID[id]||typeof text!=='string'||text.length>MAX_NOTE)throw new Error('書き出すメモを確認してください。');return JSON.stringify({format:'aitech-personal-note/1',appId:id,appName:BY_ID[id].name,text,exportedAt:now},null,2);}
export function importNote(raw,id){
 if(typeof raw!=='string'||raw.length>150000)throw new Error('ファイルが大きすぎます。');
 let value;try{value=JSON.parse(raw)}catch{throw new Error('このアプリから書き出したJSONファイルを選んでください。');}
 if(!value||value.format!=='aitech-personal-note/1'||value.appId!==id||typeof value.text!=='string'||value.text.length>MAX_NOTE)throw new Error('このアプリ用のメモファイルではありません。元のメモは変更していません。');
 return value.text;
}
export function helpRows(app){return [...app.steps.map((text,i)=>({title:`はじめ方 ${i+1}`,text})),...app.controls.map((text,i)=>({title:`操作 ${i+1}`,text})),...app.faq.map(([title,text])=>({title,text}))];}
export function guideText(app){return `${app.name}\n${canonical(app.id)}\n\n${app.goal}\n\nはじめ方\n${app.steps.map((x,i)=>`${i+1}. ${x}`).join('\n')}\n\n操作\n${app.controls.join('\n')}\n\n困ったとき\n${app.faq.map(([q,a])=>`${q}\n${a}`).join('\n\n')}\n\n接続について\n${app.network}\n`}
export function featureDetails(app){
 const details=[
  `${app.steps.join(' → ')}という開始手順を、その場で確認できるようにする。`,
  `${app.controls[0]}を含む操作を、PC・タッチの早見表にまとめる。`,
  `${app.name}の開始手順・操作・困りごとを複数語で検索できるようにする。`,
  `「${app.faq[0][0]}」など、このアプリの困りごとから解決方法を探せるようにする。`,
  `${app.name}を使いながら、33アプリを名前・用途から検索して移動できるようにする。`,
  `${app.name}をお気に入りへ登録・解除し、次回すぐに開けるようにする。`,
  `${app.name}を含む直近8アプリへ、最近使った順で戻れるようにする。`,
  `${(app.related??[]).map(id=>BY_ID[id]?.name).filter(Boolean).join('・')}への導線を用意する。`,
  `「${app.note}」を書ける個人メモを用意する。`,
  `${app.note}を自動保存し、保存失敗・別画面との競合を見える形で案内する。`,
  `${app.name}の個人メモだけをJSONに書き出し、バックアップできるようにする。`,
  `${app.name}用のメモだけを読み込み、内容確認後に追記できるようにする。`,
  `${app.name}の個人メモを、一つ前に保存した内容へ戻せるようにする。`,
  `部屋コードや閲覧中の入力を含めず、${app.name}の入口URLをコピーできるようにする。`,
  `${app.name}の入口を端末の共有メニューへ渡せるようにする。`,
  `${app.name}の開始手順・操作・復旧案内をテキストで保存できるようにする。`,
  `${app.name}の説明パネルを、3段階の文字サイズと高コントラスト表示で読めるようにする。`,
  `${app.name}でCSSによる装飾アニメーションを減らせるようにする。`,
  `${app.name}の通信が必要な機能と、ブラウザの接続状態を確認できるようにする。`,
  `${app.name}のアプリメニューを、44px以上の操作領域・キーボード操作・フォーカス復帰に対応させる。`,
 ];return FEATURES.map(([id,title],i)=>({id,title,detail:details[i]}));
}
