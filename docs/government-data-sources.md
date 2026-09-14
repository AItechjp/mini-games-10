# 行政機関・再就職先マップの出典

# Administrative network source notes

Deliverable: `agencies-network.json`.
Reviewed 2026-09-14. The IAA universe is the MIC list dated 2026-04-01, **all 86 corporations**; administrative hierarchy uses e-Gov's national agency directory plus the three explicitly sourced Cabinet bodies.

## Audited counts

- 149 visual nodes: 148 organizations and 1 `role` node (内閣総理大臣).
- 148 organizations: 62 Cabinet / ministry / administrative bodies + 86 IAAs.
- 86 IAAs: 7 行政執行法人, 26 国立研究開発法人 (including 3 特定国立研究開発法人), 53 中期目標管理法人.
- Primary-supervisor counts: 内閣府4 / 消費者庁1 / 総務省3 / 外務省2 / 財務省3 / 文部科学省21 / 厚生労働省16 / 農林水産省9 / 経済産業省9 / 国土交通省15 / 環境省2 / 防衛省1.
- 178 total edges: 61 structural / role edges, 86 primary-supervision edges, 31 additional supervision edges (20 jointly supervised corporations).
- 86 corporations matched to 82 distinct enabling statutes, downloaded through official e-Gov XML endpoint. All 82 downloads succeeded. Main-provision `主務大臣等` clauses were inspected; do not infer supervision from generic 財務大臣協議 provisions.
- JSON validation: unique node IDs, unique directed relations, every endpoint exists, exactly 86 primary-supervision edges. 会計検査院 has no incoming Cabinet relation.

## Primary sources

1. MIC: https://www.soumu.go.jp/main_content/001068482.pdf (令和8年4月1日).
   Found on https://www.soumu.go.jp/main_sosiki/gyoukan/kanri/satei2_01.html . Downloaded as `soumu-current.pdf`, extracted in two columns, visually checked as `soumu-current.png`.
2. e-Gov administrative directory: https://www.e-gov.go.jp/government-directory/ministries-and-agencies.html . Its 59 links were converted into organization nodes; 首相官邸 is the website endpoint for the 内閣 node, not a fabricated separate agency.
3. Cabinet Intelligence Council / Bureau: https://www.cas.go.jp/jp/gaiyou/jimu/nic_nib.html . Established 2026-07-31; Council under Cabinet, Bureau under Cabinet Secretariat. No invented sibling/parent chain.
4. National Security Council Establishment Act: https://laws.e-gov.go.jp/law/361AC0000000071 .
5. IAA enabling statutes are linked individually as `lawUrl`; machine source https://laws.e-gov.go.jp/api/1/lawdata/{LawId} . Law title/IDs from official law list https://laws.e-gov.go.jp/api/1/lawlists/1 . Full extracted shared-supervision clauses retained in `joint-supervision-provisions.json` for audit.
6. Special structural relations verified against Police Act (329AC0000000162), General Act of National Taxes (337AC0000000066), Cabinet Office Establishment Act (411AC0000000089), and Board of Audit Act (322AC0000000073).

## Material corrections / interpretation

- The live e-Gov IAA link directory has only 77 entries and retains defunct 国立国際医療研究センター and 国立女性教育会館. **Do not treat that link directory as the IAA universe.** MIC's current 86-entry consolidated list governs.
- 国立女性教育会館 has been replaced by 男女共同参画機構 (Cabinet Office primary supervision, MEXT for specified women's education work). New corporation number 9030005022482.
- 国立国際医療研究センター was merged into JIHS; JIHS is not one of MIC's 86 IAAs and is not silently treated as one.
- QST also has NRA supervision; NICT has specified co-supervision by MEXT / MAFF / MLIT / NPSC. NICT's 主務省令 paragraph names the Prime Minister as issuer for NPSC functions; this is **not** interpreted as additional Prime Minister supervision.
- Amami's broad enabling statute names many ministers for regional development provisions. For the **fund** only Article 62(4) applies: MLIT and MOF. The other ministers are not erroneously added.
- Water agency current statute no longer names MHLW as a principal authority; current co-supervisors are MAFF / METI for specified facilities. Old four-ministry charts are stale.
- The Prime Minister appears as a `role` node to avoid conflating legally named ministerial powers with blanket Cabinet Office delegation. These do not count as an extra organization. Common role edges identify JAXA, NPB, JSC, NIBIOHN, IPA.
- `hierarchy` means legal placement / management / jurisdiction as labeled. It does not imply unrestricted command power over independent commissions. `supervision` connects separate legal corporations and is not an internal-organization parent edge.
- Main top-level structural Cabinet lines are intentionally summarized. Police sits under the NPSC; National Tax Tribunal under NTA; Japan Art Academy under Agency for Cultural Affairs. Board of Audit remains outside Cabinet's organization.
- 日本学術会議 is treated as current 2026-09-14 organization. Scheduled 2026-10-01 conversion is noted without making future state current.

## Explicit scope limits

This is complete for the 86 MIC-listed national IAAs. It is **not** complete for every Japanese public body: all national internal bureaus/divisions/councils/regional branches, all local governments/local IAAs, special corporations, national universities/inter-university institutes, and private corporations are not covered. Industry/ordinance-specific delegation, every individual business permission, capital ownership, subsidy, procurement and employment relationships are outside this structural dataset.

All display names are short forms consistent with the source list, with legal classifications, corporation numbers, common acronym aliases, source dates, and direct citations attached. Data is processed by AItech, not an official government product.


# 再就職公表データの出典と収録範囲

2026-09-14 確認。内閣官房内閣人事局が2025-09-26に公表した令和6年度の全5表、1,733件を収録した。

- 公表ページ: https://www.cas.go.jp/jp/gaiyou/jimu/jinjikyoku/106-25-2/r07/kouhyou_0926.html
- 全体版PDF: https://www.cas.go.jp/jp/gaiyou/jimu/jinjikyoku/106-25-2/r07/files/all_20250926.pdf
- 公表一覧: https://www.cas.go.jp/jp/gaiyou/jimu/jinjikyoku/jinji_j.html

取得した公表一覧HTMLにおける最新の**年度公表**は令和6年度。より新しい四半期公表は令和8年1〜3月分まで掲載されているが、このデータには四半期公表を混在させていない。最新版の名称を「2026年度版」などと表示してはいけない。

## 収録数

| 原典表 | 対象 | 件数 | PDFページ |
|---|---|---:|---|
| 1-1 | 在職中の届出 | 117 | 6〜18 |
| 1-2 | 在職中の届出（特定地方警務官） | 153 | 19〜34 |
| 2 | 離職後の事前届出 | 3 | 35 |
| 3-1 | 離職後の事後届出 | 1,422 | 36〜186 |
| 3-2 | 離職後の事後届出（特定地方警務官） | 38 | 187〜190 |
| 合計 | 全公表行 | 1,733 | |

原典の集計区分別では府省等1,538件、特定地方警務官191件、行政執行法人4件。行政執行法人4件には役員以外も含む。特定地方警務官は元々地方採用の警察官等の公表区分であり、国の総合職採用者の一覧ではない。

同一氏名・元府省・離職日の複合キーは1,467種類。これは公的な人物IDによる名寄せではない。同一人物の地位変更や複数の就職先があり、1,733件を1,733人と表記してはいけない。

## 機械抽出と確認

原典XLSXをopenpyxlで読み、Excelシリアル日付をISO日付に変換。PDF全190ページをpdfplumberで解析し、各表番号・行番号で照合した。**全1,733件**の氏名、官職、再就職先、就職先地位、離職日、再就職日についてXLSXとPDFの一致を検証した。表ごとの連番・件数、公式集計の総数との一致も検証した。PDFの6ページを画像化して列位置と表示を確認した。

元府省は原典p1の集計順と詳細表の府省順に対応させた。全府省区切りの先頭・末尾官職を確認し、`ministry-boundaries.json`に照合根拠を保存した。国家公安委員会区分には警察庁の記録が含まれる。国税庁・消防庁・林野庁・原子力規制庁等は原典の元府省集計に従う。このフィールドを現在の監督関係のエッジとして扱ってはいけない。

表記は原典XLSXを優先し、改行・全角スペース等の空白だけを表示用に整理した。「䑓」「﨑」「髙」などの漢字は保存している。法人ノードIDの作成に限りNFKCと空白除去を使用するが、法人番号による同一性確認はしていない。

## 年度外の日付

原典には2019-06-26〜2025-05-29の再就職日が含まれる。過去の日付を誤りと判断して修正したり、2024-04-01〜2025-03-31で機械的に除外したりしていない。例えば、3-1表827番・飯髙悟氏の2019-06-26（PDF p120）と1-2表88番・中山健治氏の2025-05-29（p28）はXLSX/PDF双方で確認した値。表示は「2024年度公表対象」で統一すると正確。

## 解釈上の扱い

- 一覧は公表された再就職情報であり、違法なあっせん・働きかけの認定一覧ではない。
- 採用試験区分は原典にない。`careerTrack`と`recruitmentTrack`は全件`unknown`。官職が高いことから総合職・旧I種等の採用と断定しない。
- `senior`は「次官・長官・局長・審議官等」の官職名による表示フィルター。213件。キャリア採用の証明ではなく、地方局長を含む。特定地方警務官はこのフィルターから除外。
- 再就職先の公式法人種別は個別詳細行にはないため、個別レコードに創作して付与していない。公式区分別集計のみmetadataに収録。表示名からの推定分類を公式分類と混同しない。
- 「自営」「自営業」は同一の勤務先を意味しないため、`destinationId`ではレコード単位に分離している。
- 自衛隊員・特別職国家公務員の別公表、2025年度以降の四半期公表、さらに古い年度公表は未統合。

## 再生成

```sh
python import_reemployment.py --output reemployment.json
```

Python依存: `openpyxl`, `pdfplumber`。原典はローカルに保存されているためオフラインでも再生成できる。未取得ファイルだけ公開URLからダウンロードする。取得時、内閣官房サイトがデフォルトのPython User-Agentには404を返したため、公開サイト用の`Mozilla/5.0`を指定。各原典のSHA-256をJSONのsourcesに保存している。

主成果物は`reemployment.json`。構造は`{metadata, sources, records}`。`metadata.period`は文字列で、期間の機械可読値は`metadata.periodRange`。全行に`sourceUrl`、1始まりの`sourcePage`、`spreadsheetUrl`、`spreadsheetSheet`、1始まりの`spreadsheetRow`を持つ。


## 追加収録した外務省特別職

外務省の2024年度公表対象20件を原典全行と照合し追加。内閣人事局1,733件との重複はなく、画面上の合計は1,753件。採用区分は未確認。元の掲載IDを保持。

出典：https://www.mofa.go.jp/mofaj/files/100910566.pdf

再生成：scripts/import-government-reemployment.py と scripts/import-government-mofa.py。各データの records と sources を連結し、資料別件数を保ったまま統合する。
