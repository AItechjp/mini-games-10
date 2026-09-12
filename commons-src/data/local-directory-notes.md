# 岐阜・愛知の店舗一覧

4つの公開ルートは `/commons/local/{supermarkets,saunas,sento,fishmongers}/`。
店舗データは `public/local-data.json`。既存のコモンズ認証を引き継ぐ。

## 収録範囲

地域内の全店舗の網羅は未達成。情報源の取得完了と地域全店舗の収録を区別する。
公式チェーン、温浴施設一覧、OSM、公開された魚介類販売許可の事業所情報を収録。
サウナの施設時間は専用サウナの受付時間とは限らない。ジム・宿泊・予約の条件を表示する。
許可施設にはスーパー内売場・卸売が含まれ、許可だけでは現在の営業・一般客の利用を確定しない。
未確認営業時間・未対応の規則・利用条件あり・取得から90日経過は「要確認」。
営業時間の再判定は30秒ごと。店舗台帳そのものの自動更新ジョブは未接続。

## 更新手順

1. `local-source-manifest.json` の情報源一覧を再確認し、追加の一覧ページ・新しい台帳・閉店・開店予定を確認する。固定URLの再取得だけでは新店を網羅できない。
2. `local-aichi-bath-records.json` と `local-official-extra.json` の公式情報を再確認する。
3. `python scripts/fetch-local-captures.py /tmp/aitech-local-captures` で取得。失敗時は公開データを上書きしない。
4. beautifulsoup4 を用意し、`python scripts/assemble-local.py /tmp/aitech-local-captures` で組み立てる。県別・種類別・情報源別の件数を前回と比較する。許可台帳の廃止・有効期限と一般小売可否も確認する。
5. `node scripts/test-local-hours.mjs` と型検査、4画面のブラウザ確認を実施し、`node aitech/build.mjs` で静的ファイルを更新する。
6. 既存のGitHub Pagesワークフローで公開する。独立したホテル・賃貸等のコモンズのファイルは保持する。

事業所名・所在地・事業所電話番号以外の申請者・代表者・自宅住所等を出力しない。
生の許可台帳・取得用ディレクトリをリポジトリや公開フォルダへ入れない。
公開したOSM由来データにはODbL、自治体データには各データセットのCC BY表示を付ける。
