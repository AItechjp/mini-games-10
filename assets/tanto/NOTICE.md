# 短答ノートの収録資料

このデータは無料・広告なしの非営利学習ページ `yobi-quiz.html` 専用です。

- 出題元：法務省 司法試験・司法試験予備試験の公表資料。各設問の `source` に公式PDFのURLと `page` にPDFページ番号を保存。
- 問題本文の取得補助：osanamikoji/bar-exam-data の法務省PDF転記資料。
  https://github.com/osanamikoji/bar-exam-data
- 正答のデータ：藤堂真登・石川真之介、ShigyoBench。
  https://huggingface.co/datasets/todo1111/shigyobench
  使用リビジョン：eb4ca6a824aa428e80ecac38c30f290f1755e672。
  一般教養の正答は旧版 0b3ff5837d941d039ab0ba1880fc751d635de5fd の該当レコードを使用。
  ライセンス：Creative Commons Attribution-NonCommercial 4.0 International。
  https://creativecommons.org/licenses/by-nc/4.0/
- 試験問題自体の権利は法務省その他の権利者に帰属。第三者による一般教養の引用文や図表はこのデータに転載せず、公式冊子を参照。

加工内容：科目分類、改行整形、論点の検索タグ、練習用の解答形式、出典を追加。一般教養の重複レコードを統合。本文の対応や正答の形式・解答欄数が確認できない設問を除外。公式正答PDFと追加照合したものは `answerSource` に出典を記録し、確認できた部分点だけを適用。正答訂正は manifest.json に記録。

旧年度は当時の法令・判例を前提とする問題であり、現在の法令に書き換えていない。全問についての現行法レビュー、専門家監修、全肢解説は未実施。guide.json は独自に記述した論点別学習メモで、設問ごとの解説ではない。収録数、欠落設問、確認範囲は manifest.json に公開。

再構築（Python 標準ライブラリ。PDF正答表の照合だけ pdfplumber が必要）：

1. 一時作業ディレクトリ sources/ に manifest.json（bar-exam-data）、shigyobench.jsonl、旧版 shigyo-old.jsonl を取得。
2. scripts/prepare-tanto-sources.py にそのディレクトリを引数で渡す。
3. scripts/build-tanto-bank.py を実行。
4. 公式正答表と answer-sources.json がある場合、scripts/verify-tanto-answers.py を実行。
5. scripts/build-tanto-guide.py と node tests/yobi-past-source.mjs を実行。

サイトの他の広告ページから独立しており、この教材ページに広告スクリプトを接続しない。商用利用には、各資料の権利・ライセンスに適合する別の許諾が必要。
