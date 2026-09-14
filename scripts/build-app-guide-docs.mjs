import {writeFile} from 'node:fs/promises';
import {APPS,featureDetails,canonical} from '../app-guide/model.mjs';
const implemented=process.argv.includes('--implemented');
let text='# AItech アプリ別の改善一覧\n\n';
text+='対象はゲーム16本とコモンズ17本の計33アプリ。各20項目、計660項目です。\n';
text+='共通する機能は共通の実装を使い、開始手順・操作・困りごと・メモの用途・関連リンクはアプリ別に用意します。既存機能の欠陥を660件発見したという意味ではなく、今回追加・改善する具体的な項目です。\n\n';
text+='定期実行は停止済みです。この一覧を対象とする一括の改善・公開として進めます。\n\n';
text+=implemented?'状態：実装済み。検証範囲と公開結果は末尾の記録を参照してください。\n\n':'状態：改善内容を具体化。これから実装・検証・公開します。\n\n';
for(const [i,app]of APPS.entries()){
 text+=`## ${i+1}. ${app.name}\n\n[アプリを開く](${canonical(app.id)})\n\n| No. | 改善項目 | 実装する内容 |\n| --- | --- | --- |\n`;
 for(const [j,f]of featureDetails(app).entries())text+=`| ${j+1} | ${f.title} | ${f.detail.replaceAll('|','／')} |\n`;
 text+='\n';
}
text+='## 対象データと検証の考え方\n\n個人メモの書き出しは、対局・答案・写真・ルーム投稿などのバックアップではありません。今回のメモと設定だけを扱い、既存の保存データや匿名参加キーは読み出しません。共有するのはアプリの入口です。ルームの招待には各アプリ本来の招待機能を使います。\n\n共通機能のデータ保護と操作を検証し、各アプリへの組み込み・導線・ゲームの停止処理を確認します。オンライン対戦の相手や制限時間は、案内を開いても止まりません。\n';
await writeFile(new URL('../docs/AItech-app-improvements-20.md',import.meta.url),text);
console.log(JSON.stringify({apps:APPS.length,items:APPS.length*20,implemented}));
