import {apps,commonImprovements,specificImprovements} from '../quality/apps.mjs';
import {writeFile} from 'node:fs/promises';
const intro='# AItech 各アプリ20項目の改善一覧\n\n対象：ゲーム16本・コモンズ17本、合計33アプリ。\n\n各アプリに**共通15項目＋用途別5項目**を適用しています。合計660項目の適用です。共通部分と同じ用途の機能は、同じ仕組みを再利用しています。\n\n画面の「使い方・表示設定」から利用できます。Alt＋/でも開閉できます。ホワイトボードのPNG出力とカメラの撮影補助は、それぞれの操作欄にあります。\n\n記録は画面に表示された内容を手動で控えるものです。比較は選択時点の情報と選択日時を保持します。いずれもこのタブ内の一時保存で、コピー・テキスト保存に対応しています。\n\n';
const sections=apps.map((app,i)=>{
  const url=app.id==='aether'?'https://aether-card-duel.douga071132.chatgpt.site':new URL(app.path,'https://aitechd.com').href;
  const points=[...commonImprovements,...specificImprovements(app)];
  return `## ${i+1}. ${app.name}\n\n[アプリを開く](${url})\n\n`+points.map((p,n)=>`${n+1}. ${p}`).join('\n')+'\n';
});
await writeFile(process.argv[2]||'../AItech-20-improvements.md',intro+sections.join('\n'));
await writeFile('quality/release.json',JSON.stringify({release:'20260914-20',apps:33,perApp:20,common:15,specific:5,applications:660,scope:'current-catalogs',items:apps.map(a=>({id:a.id,name:a.name,path:a.path,kind:a.kind,improvements:[...commonImprovements,...specificImprovements(a)]}))},null,2));
console.log('33 apps / 660 applied items documented.');
