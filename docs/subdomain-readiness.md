# AITECH サブドメイン公開の準備

準備日: 2026-10-04。`docs/subdomains.json` は公開先の設計台帳です。
このソース変更だけでは DNS、TLS 証明書、Cloudflare のドメイン割当は変更されません。
別の管理操作で Sites の 10 件のサブドメイン登録を確認済みですが、DNS 認証待ちです。
台帳の全項目を未開通として扱い、実際の開通状況は DNS と HTTPS の検査で別途確かめます。

## 収録範囲

- 308 個の静的配信向けホスト名。既存のゲーム・コモンズ・一覧ページ、APP 100、ARCADE 100、PARTY 20 の入口を含みます。
- 10 個の別 Sites 向けホスト名。別サービスへの設定を記録するだけで、今回の静的 Worker はこれらを処理しません。
- ホスト数は独立した製品数ではありません。同じゲームエンジンのモードや旧入口も含みます。MEGA ARCADE は既存画面の中からモードを選びます。
- `AItechjp/website` の WEB DESK は別リポジトリです。この Worker の配信物に含めていません。統合して公開したと誤認しないでください。
- Android アプリ専用として既存ビルドから除外された `onepiece-battle/` は引き続き除外します。コモンズのワンピースカード図鑑とは別です。

| 例 | 既存の配信パスまたは用途 |
| --- | --- |
| `tools.aitechd.com` | `/commons/` |
| `silent-camera.aitechd.com` | `/commons/camera/` |
| `sauna.aitechd.com` | `/commons/sauna/` |
| `hotels.aitechd.com` | `/commons/hotels/` |
| `black-site.aitechd.com` | `/game23.html` |
| `app-001.aitechd.com` ～ `app-100.aitechd.com` | `/app-tool.html?id=1` ～ `100` |
| `arcade-001.aitechd.com` ～ `arcade-100.aitechd.com` | `/arcade100/?game=g001` ～ `g100` |
| `commons.aitechd.com` | 既存 Commons Sites。現在の実装は `https://aitechd.com/commons/` への転送 |
| `camera.aitechd.com` | SHIZUKA の旧入口。Commons Sites のカメラへ転送し、さらに aitech 本体へ移動 |
| `saunanow.aitechd.com` | 独立したサウナ Sites。コモンズ版とのデータの同一性・更新状況は未確認 |

## 配信の仕組み

`cloudflare/wrangler.subdomains.jsonc` は既存の `dist/` を使う独立した
Cloudflare Worker Assets 設定です。既存の GitHub Pages と Cloudflare Pages
のワークフローは変更しません。ドメインの `routes` 設定は入れていません。
`workers_dev` とプレビュー URL も無効にしています。

登録済み静的ホストの HTTPS `GET /` または `HEAD /` だけを、同じホスト上の既存パスへ
相対 `302` で移します。例: `https://hotels.aitechd.com/` →
`https://hotels.aitechd.com/commons/hotels/`。サブドメインは維持されます。
`room` などの受け取ったクエリは保持し、台帳が指定した `id`・`game` などのキーは優先します。

HTML のパス名を自動的に短縮しません。ディレクトリ URL は内部で `index.html` を取得するため、
ブラウザには既存の `/commons/.../` が見え、CSS・モジュール・fetch の相対パスも保たれます。
既存の `.html` ファイル名を参照するクライアント処理もそのまま動かせます。
共有アセット、通常の深いリンク、POST、Range ヘッダーは書き換えません。
未登録ホストには新たな転送を適用せず、通常のアセット処理へ渡します。
任意の外部 URL を中継する機能はありません。

台帳と Worker ソースは `docs/`・`cloudflare/` に置き、既存ビルドの非公開除外を利用します。
Worker の JavaScript バンドルには必要な台帳が組み込まれます。

## 開通前に必要なこと

1. 現在の正常なビルド手順で、コモンズと公開用 vendor を含む `dist/` を作成します。
   リポジトリ全体を静的公開ディレクトリに指定しないでください。
2. `node tests/subdomains.mjs` と既存の公開物検査を実行します。
3. `npx wrangler@4.130.0 deploy --dry-run --config cloudflare/wrangler.subdomains.jsonc`
   で実際の配信物を確認します。これは DNS の開通ではありません。
4. Supabase の 6 API は別の作業で正確な HTTPS Origin を追加・デプロイ済みです。
   `docs/subdomain-cors.md` と検証結果を参照してください。ホスト追加時には用途に対応する Origin の確認が必要です。
5. アカウントで利用可能なホスティング方式・上限を確認し、選んだホスト名だけを Worker に割り当てて
   DNS と TLS を検証します。Sites 用に予約した 10 名を静的 Worker に上書きしないでください。
6. 実際の各ホストで初回表示、資産読込、API プリフライト、保存・復元、共有ルーム、カメラ権限を検査します。
   入口が HTTP 200 になるだけでは公開完了としません。

既存の `aitechd.com` の URL は維持します。オリジンを変えると `localStorage` が分離されるため、
以前のメモ・デッキ・匿名参加キー・最近のルームは新ホストに自動移行しません。
旧 URL で既存データに戻れるようにし、必要な機能では本人操作によるエクスポート／インポートを用意します。
匿名参加キーや認証情報を URL に載せて移行しないでください。

## 商用運用の確認状況

**この作業は商用利用の権利・法令・広告審査を完了したという意味ではありません。**
全台帳項目の `commercialReview` は `not-verified` のままです。

- 既存の利用規約、プライバシー、外部送信説明、`ads.txt` はあります。
  運営者の連絡先は掲載されていません。実際に利用者の問い合わせや削除依頼を受けられる窓口の確認が残ります。
- 有料販売・定期購入は実装していません。既存の「利用者から対価を受け取る申込みなし」という説明を維持しています。
  決済開始に必要な事業者情報や販売条件を推測して作成していません。
- デジモン、遊戯王、ポケモン、デュエマ、ワンピース、Z/X、NARUTO、ガッシュ等の
  第三者画像・名称・本文の商用利用許諾を確認していません。非公式と記載することは許諾の代わりにはなりません。
  ソース公開・外部リンク・AI 生成イラストも、それだけで権利確認完了とは扱いません。
- 今回の公開依頼に基づき、Sites の 10 サイトを一般公開状態にそろえました。
  ZX・SHIZUKA・Windbound・APEX HORIZON の Sites 外周の本人限定設定を解除しています。
  デッキ保存の本人認証、ゲーム内パスワード、部屋トークン等のアプリ内部の保護は維持しています。
  APEX HORIZON は過去の TLS 待ち失敗から既存版の公開を復旧しました。
- 既存の Google AdSense は apex と www の指定一覧ページだけで読み込みます。
  今回のサブドメインへの広告拡張はしていません。権利未確認のカードアプリにも追加しません。
  広告アカウントの承認状態、同意管理、各配信先の審査は未確認です。
- 情報集約ツールのデータ利用条件、外部 API の提供条件、店舗情報の鮮度、ホスティングの利用条件と容量は
  実際のサービス・配信先ごとの確認が残ります。公開範囲や実装能力の表示を超える保証はしません。

## 検証

`tests/subdomains.mjs` は、公開カタログとアプリ台帳の収録漏れ、実在する配信先ファイル、
100 件ずつのツールと ARCADE、20 件の PARTY、相対転送、クエリ維持、
未登録ホスト・外部 Sites の除外、POST・Range の保持、公開除外パスを検査します。
DNS、証明書、第三者権利、商用契約、全ゲームの実操作を検証するものではありません。

実装の参照資料:

- [Cloudflare: Static Assets の binding](https://developers.cloudflare.com/workers/static-assets/binding/)
- [Cloudflare: Worker-first routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/)
- [Cloudflare: HTML handling](https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/)
