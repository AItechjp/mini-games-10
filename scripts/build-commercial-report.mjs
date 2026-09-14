import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {APPS} from '../app-guide/catalog.mjs';
import {common,family,specific,familyFor} from '../docs/commercial100-spec.mjs';

// Mark only work performed in this release. Existing tests are evidence of existing
// behavior, not evidence that a new feature was authored in this request.
const fixes={
 'black-site':[6,7,8],smash:[1,2,3,4,5],aether:[1,2,3,4,5,6,7,8,9,10,11],
 'quick-hop':[1,15,16],startrail:[1,2],babanuki:[1,2],
 whiteboard:[18,19],chat:[17,18],
 'hotel-search':[16,17,18,19],'rental-search':[],
 'local-supermarkets':[16,17,18,19],'local-saunas':[16,17,18],'local-sento':[16,17,18],'local-fishmongers':[16,17,18],
 'sauna-now':[16,17],'restaurant-openings':[17,18,19],'sauna-openings':[17,18,19],
 camera:[1,2,3,4],weather:[3,4,5,6,7],bitcoin:[4,5,6,7,8,14,15],onion:[14,15,16,17,18,19],
};
const sources={
 'black-site':'game23-v3-part7.js / game23-v3-part8.js',smash:'smash.js',aether:'AETHER DUEL: dist/game.js',
 'quick-hop':'quick-hop/game.js',startrail:'startrail/game.mjs',babanuki:'babanuki.js',
 whiteboard:'commons-src/app/ui/common.tsx / room.tsx',chat:'commons-src/app/ui/common.tsx / room.tsx',
 'hotel-search':'commons/search/live-results.mjs','rental-search':'commons/search/live-results.mjs',
 'sauna-now':'commons-src/app/sauna/sauna-directory.tsx',
 'restaurant-openings':'commons-src/app/ui/opening-directory.tsx','sauna-openings':'commons-src/app/ui/opening-directory.tsx',
 camera:'commons-src/public/camera/camera.js',weather:'commons-src/lib/weather.ts / app/weather/weather.tsx',
 bitcoin:'commons-src/app/bitcoin/explorer.tsx',onion:'commons-src/app/onion/directory.tsx',
};
const release=JSON.parse(await readFile(new URL('../docs/commercial-publication.json',import.meta.url),'utf8'));
const audit={date:'2026-09-14',scope:'現在のカタログに掲載された33アプリ。旧URL・アーカイブは互換性を維持。',publication:release.status,release,definition:'各アプリ100の改善・確認項目。共通40、用途別40、個別20。同じ実装を共用する項目を含み、3300種類の独立した新機能ではありません。未検証・未実装の項目を完了とは扱いません。',apps:[]};
for(const app of APPS){
 const group=familyFor(app.id);if(common.length!==40||family[group].length!==40||specific[app.id]?.length!==20)throw Error('Invalid item count: '+app.id);
 const items=[...common,...family[group],...specific[app.id]].map((title,index)=>({number:index+1,category:index<40?'共通':index<80?'用途別':'個別',title,priority:/保存|二重|上書|権限|破損|拒否|停止|正整数|不正|勝者|禁止|敗者/.test(title)?'P0':/実機|30分|素材|監査|照合/.test(title)?'P2':'P1',status:'要対応・要検証',evidence:''}));
 for(const item of items){
  if(item.number<=5){item.status='今回改修';item.evidence='app-guide/ui.mjs';}
  if(['gomoku','shogi','go','othello','chess'].includes(app.id)&&item.number>=41&&item.number<=52){item.status='今回改修';item.evidence='board-games/keyboard.mjs / table.mjs';}
  if(['monopoly','life'].includes(app.id)&&item.number===69){item.status='今回改修';item.evidence='board-games/keyboard.mjs';}
  if(app.id==='quick-hop'&&item.number===76){item.status='今回改修';item.evidence='quick-hop/index.html / game.js';}
  if(fixes[app.id]?.includes(item.number-80)){item.status='今回改修';item.evidence=sources[app.id]??'commons-src/aitech/local-directory.tsx';}
 }
 audit.apps.push({id:app.id,name:app.name,url:new URL(app.path,'https://aitechd.com').href,items});
}
audit.total=audit.apps.reduce((n,a)=>n+a.items.length,0);
audit.changed=audit.apps.reduce((n,a)=>n+a.items.filter(i=>i.status==='今回改修').length,0);
await mkdir('docs',{recursive:true});
await writeFile('docs/AItech-100-improvements.json',JSON.stringify(audit,null,2));
let md='# AItech：全33アプリ・各100項目の改善と確認\n\n'+audit.definition+'\n\n対象：'+audit.scope+'\n\n**状態：改修と検証を進めた項目を記録。商用水準への到達・全3300項目の完了は未達成です。**\n\nP0＝保存・安全性・進行を阻害する問題、P1＝主要操作、P2＝実機・データ照合など。既存機能がある項目でも、この一括対応での完了判定がないものは「要対応・要検証」としています。\n\n';
md+=`公開状態：${release.status}\n\n[AItech](${release.main.url}) / [AETHER DUEL 第${release.aether.version}版](${release.aether.url}) / [公開・検証記録](${release.main.workflow})\n\n`;
md+='| アプリ | 今回改修として追跡する項目 | 全項目 |\n| --- | ---: | ---: |\n';
for(const a of audit.apps)md+=`| ${a.name} | ${a.items.filter(i=>i.status==='今回改修').length} | 100 |\n`;
md+=`\n計${audit.total}項目のうち、今回改修として追跡する適用箇所は${audit.changed}項目。共通修正を各アプリに適用した件数を含みます。独立した不具合数ではありません。\n\n`;
for(const [index,a] of audit.apps.entries()){
 md+=`## ${index+1}. ${a.name}\n\n[アプリを開く](${a.url})\n\n| No. | 優先度 | 改善・確認項目 | 状態 | 実装箇所 |\n| ---: | --- | --- | --- | --- |\n`;
 for(const i of a.items)md+=`| ${i.number} | ${i.priority} | ${i.title} | ${i.status} | ${i.evidence||'—'} |\n`;
 md+='\n';
}
md+='## 商用水準の判定に残る条件\n\n- 実機のAndroid・iPhone・PCで主要操作、長時間負荷、写真保存、オンライン2端末対戦を確認する。\n- 検索・店舗・開業・Onionは提供元、更新基盤、網羅性と鮮度を実データで照合する。現状の一覧は完全網羅ではない。\n- 素材の利用条件、ゲーム固有の例外ルール、学習資料の正答と現行法との差を個別確認する。\n- 個人メモの共通修正だけで各ゲームのグラフィックやルール全体が商用水準へ到達したとは判定しない。\n- 旧URL・旧アプリは維持しているが、33アプリとは別のアーカイブ全機能を再監査したという意味ではない。\n';
md+='\n## 公開と検証の記録\n\n';
md+=`AItechの公開コード：\`${release.main.commit}\`。AETHERの公開コード：\`${release.aether.commit}\`（第${release.aether.version}版）。\n\n`;
md+=release.main.httpsChecks==='passed'?`公開後の操作検査と、${release.main.htmlDocuments}ページ・計${release.main.browserChecks}回のPC／Android相当ブラウザでの表示・HTTPS検査が通過しました。実機での全機能・長時間操作を保証する検査ではありません。\n\n`:'公開後の操作検査は通過。全ページの表示・HTTPS検査を実行中です。\n\n';
for(const check of release.checks)md+=`- ${check}\n`;
md+='\n';for(const note of release.notes)md+=`- ${note}\n`;
await writeFile('docs/AItech-100-improvements.md',md);
console.log(JSON.stringify({apps:audit.apps.length,total:audit.total,changed:audit.changed,remaining:audit.total-audit.changed}));
