# Commons public organization networks

Routes: `/commons/government-network/` and `/commons/reemployment-network/`.

Organization data: all 86 corporations in the Ministry of Internal Affairs and Communications list dated 2025-04-01, checked against its printed ministry totals, corporate numbers and classifications. Main supervising ministry only, as specified by the source. Source: https://www.soumu.go.jp/main_content/001000284.pdf (retained alongside this README).

Agency data: e-Gov's ministry/agency directory fetched 2026-09-14, 58 listed organizations plus a Cabinet root. Prime Minister's Office website is used for the Cabinet root rather than being treated as a separate agency. The police, National Tax Tribunal and Japan Art Academy are nested under their corresponding parent institutions. The Board of Audit is independent of the Cabinet. This is not an exhaustive directory of internal bureaus, local branches, local governments or local independent administrative corporations. The directory's retrieval date is not asserted to be the legal effective date of every entry.

Reemployment: all 20 records (19 persons) from MOFA's special-service disclosure for 2024-04-01 through 2025-03-31, published 2025-09-26. Source: https://www.mofa.go.jp/mofaj/files/100910566.pdf . PDF row and page references are retained. MOFA discloses that jobs taken more than two years after retirement are excluded. Each record's career recruitment category is unverified; ambassador rank must not be used as a proxy. The corresponding filter intentionally yields zero confirmed records. These records do not establish illegality or facilitated placement, and are historical, not current employment claims.

Outstanding coverage: other ministries' reemployment records, substantiated career recruitment classifications, current organization changes after source dates, joint supervision, internal and local branches. Cabinet Personnel Bureau annual and quarterly disclosure URLs returned HTTP 404 in this session, so no national reemployment completeness claim is made.

Validation: `node tests/government-network.mjs`; `node --check commons/government-network/network.js`; Commons typecheck and static distribution build. Independent routes are preserved by `commons-src/aitech/build.mjs`.
