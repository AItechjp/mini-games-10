# ババ抜き追加の進捗

- [x] CPU3人と対戦するババ抜きを実装
- [x] ゲーム集に6本目として追加（既存5作品を維持）
- [x] 1,000対局のルール検証・終局・順位・リプレイ・スマホ表示を確認
- [x] 正式な mini-games-10 リポジトリに統合
- [x] 公開用ビルドと統合後の動作確認
- [ ] GitHubへ反映
- [ ] aitechd.com の公開を確認

更新: 2026-09-12。統合・検証が完了し、接続済みGitHubから公開処理を進めています。
公開結果はGitHub Actionsの「Deploy GitHub Pages」と本番URLで確認できます。

公開用ビルドにゲーム本体と6本目の一覧を含むことを確認しました。
既存のCommons・学習・アーケード・オンライン・描画・FPS・五目並べ・大富豪のルール検証は通過しました。
既存の `game23-systems` 検証は、この環境で子プロセスを起動できず中断しています。
その検証は変更していません。公開時のLinux上の既存CIで実行されます。

## VS Codeで確認

1. `node scripts/build-static.mjs` で公開用ファイルを作成。
2. `node scripts/preview-babanuki.mjs` でプレビューを起動。
3. http://127.0.0.1:4179/games.html から「ババ抜きで遊ぶ」を開く。

ルール検証: `node tests/babanuki.mjs`（Node.js 22以降）。
編集後はビルドを再実行し、ブラウザを再読み込みします。
コード・差分はVS Codeのエクスプローラー／ソース管理で確認できます。

## 構成

- `babanuki.html` / `babanuki.css`: 4人卓とスマホ表示
- `babanuki-engine.js`: 配札・ペア除去・手番・あがり・終局
- `babanuki.js`: CPU進行・操作・順位表示・シャッフル・一時停止
- `games.html` / `babanuki-hub.css`: ゲーム集の6本目
- `tests/babanuki.mjs`: 1,000対局と境界条件の自動検証

オンライン対戦とセーブは含みません。プレイヤー1人とCPU3人の対戦です。
