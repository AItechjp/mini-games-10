#!/usr/bin/env python3
"""Reproducibly import the complete FY2024 Cabinet personnel reemployment release.

Run: python import_reemployment.py --output reemployment.json
Requires openpyxl, pdfplumber. Downloads only public Cabinet Secretariat sources.
The 2025-09-26 release is deliberately pinned; do not silently label it current.
"""
from __future__ import annotations
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import re
import unicodedata
from urllib.request import Request, urlopen

import openpyxl
from openpyxl.utils.datetime import from_excel
import pdfplumber

BASE = "https://www.cas.go.jp/jp/gaiyou/jimu/jinjikyoku/106-25-2/r07/"
PDF_URL = BASE + "files/all_20250926.pdf"
LANDING_URL = BASE + "kouhyou_0926.html"
GROUPS = [
    ("1-1", 6, "在職中の届出", 117, 1, False),
    ("1-2", 19, "在職中の届出（特定地方警務官）", 153, 1, True),
    ("2", 35, "離職後の事前届出", 3, 2, False),
    ("3-1", 36, "離職後の事後届出", 1422, 3, False),
    ("3-2", 187, "離職後の事後届出（特定地方警務官）", 38, 3, True),
]

def clean(value):
    return re.sub(r"\s+", " ", str(value)).strip() if value is not None else ""

def compact(value):
    return re.sub(r"\s", "", str(value))

def iso_date(value):
    if isinstance(value, (int, float)):
        return from_excel(value).date().isoformat()
    if isinstance(value, datetime):
        return value.date().isoformat()
    text = clean(value)
    m = re.fullmatch(r"([RHS])(\d+)\.(\d+)\.(\d+)", text)
    if m:
        era, year, month, day = m.groups()
        return f"{int(year)+{'R':2018,'H':1988,'S':1925}[era]:04}-{int(month):02}-{int(day):02}"
    if text in ("", "-", "－"):
        return None
    raise ValueError(f"Unrecognized date: {text!r}")

def fetch(url, path):
    if path.exists():
        return path
    # This public website returned 404 to Python's default UA during collection.
    request = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(request, timeout=45) as response:
        content = response.read()
    if path.suffix == ".pdf" and not content.startswith(b"%PDF"):
        raise ValueError("Source download is not PDF")
    if path.suffix == ".xlsx" and not content.startswith(b"PK"):
        raise ValueError("Source download is not XLSX")
    path.write_bytes(content)
    return path

def senior_title(title):
    # Display filter only. A matching title never verifies recruitment track.
    # Avoid e.g. 長官官房: require an actual title boundary after 長官.
    return bool(re.search(r"事務次官|事務総長|(?:^|[省庁府])(?:長官|次長)(?=$|[ （(兼併])|局長(?=$|[ （(兼併代])|審議官(?=$|[ （(兼併])|大臣官房長(?=$|[ （(兼併])", title))

def institution_id(name, record_id):
    # Generic 'self-employed'/'private' labels do not identify one institution.
    if name in {"自営", "自営業", "非公表", "-", "－", ""}:
        return "destination-" + record_id
    key = compact(unicodedata.normalize("NFKC", name))
    return "destination-" + hashlib.sha256(key.encode()).hexdigest()[:16]

def run(cache, output):
    cache.mkdir(parents=True, exist_ok=True)
    pdf_path = fetch(PDF_URL, cache / "all-r07.pdf")
    fetch(LANDING_URL, cache / "annual-page.html")
    pdf = pdfplumber.open(pdf_path)
    assert len(pdf.pages) == 190, "Release layout changed; inspect before importing"
    summary = pdf.pages[0].extract_tables()[0]
    agencies = [r for r in summary if r[0] and re.fullmatch(r"[\d,-]+", r[1] or "")
                and r[0] not in ["府省等計", "行政執行法人計", "合 計"]
                and not r[0].startswith("特定")]
    group_by_page = {page: group for group, page, *_ in GROUPS}
    pdf_rows = {}
    current_group = None
    for page_no, page in enumerate(pdf.pages, 1):
        if page_no < 6:
            continue
        if page_no in group_by_page:
            current_group = group_by_page[page_no]
        for table in page.extract_tables():
            for cells in table:
                if cells and re.fullmatch(r"\d+", cells[0] or ""):
                    key = (current_group, int(cells[0]))
                    assert key not in pdf_rows, key
                    pdf_rows[key] = (page_no, cells)
    assert len(pdf_rows) == 1733
    records, sources, bounds = [], [], []
    sources.append({"id": "cabinet-reemployment-fy2024", "title": "令和6年度 国家公務員の再就職状況（全体版）", "publisher": "内閣官房内閣人事局", "url": PDF_URL, "landingUrl": LANDING_URL, "publishedAt": "2025-09-26", "sha256": hashlib.sha256(pdf_path.read_bytes()).hexdigest(), "pages":190})
    for group, first_page, label, expected, summary_col, local_police in GROUPS:
        filename = f"siryou{group}_20250926.xlsx"
        source_url = BASE + "files/" + filename
        workbook = openpyxl.load_workbook(fetch(source_url, cache / filename), data_only=True)
        sheet = workbook.active
        rows = [(n, r) for n, r in enumerate(sheet.values, 1) if isinstance(r[0], (int, float))]
        assert len(rows) == expected, (group, len(rows), expected)
        ministry_for_number = {}
        pos = 0
        if not local_police:
            for entry in agencies:
                count = int(entry[summary_col].replace(",", "")) if entry[summary_col] != "-" else 0
                if count:
                    # Detail records follow the official summary's ministry order.
                    # Both boundary titles are retained for transparent verification.
                    bounds.append({"group": group, "ministry": entry[0], "first": pos+1, "last": pos+count, "firstTitle": clean(rows[pos][1][3]), "lastTitle": clean(rows[pos+count-1][1][3]), "basis":"official PDF summary p1 and ordered detail table"})
                for n in range(pos+1, pos+count+1):
                    ministry_for_number[n] = entry[0]
                pos += count
            assert pos == len(rows)
        for excel_row, row in rows:
            number = int(row[0])
            page, pdf_cells = pdf_rows[(group, number)]
            offset = 1 if group.startswith("1-") else 0
            for column in (0, 1, 3, 11+offset, 13+offset):
                assert compact(row[column]) == compact(pdf_cells[column]), (group, number, column)
            retirement = iso_date(row[9+offset])
            reemployment = iso_date(row[10+offset])
            assert retirement == iso_date(pdf_cells[9+offset]), (group,number,"retirement")
            assert reemployment == iso_date(pdf_cells[10+offset]), (group,number,"reemployment")
            name, title, destination = clean(row[1]), clean(row[3]), clean(row[11+offset])
            record_id = f"fy2024-{group}-{number:04}"
            ministry = "特定地方警務官" if local_police else ministry_for_number[number]
            administrative_agency = ministry in {r[0] for r in agencies[26:]}
            rec = {
                "id": record_id, "name": name, "ministry": ministry,
                "formerTitle": title, "destination": destination,
                "destinationTitle": clean(row[13+offset]),
                "destinationBusiness": clean(row[12+offset]),
                "retirementDate": retirement, "reemploymentDate": reemployment,
                "ageAtRetirement": int(row[2]),
                "sourceUrl": PDF_URL, "sourcePage": page,
                "sourceTable": group, "sourceNumber": number,
                "spreadsheetUrl": source_url, "spreadsheetSheet": sheet.title,
                "spreadsheetRow": excel_row,
                "careerTrack": "unknown", "recruitmentTrack": "unknown",
                "senior": senior_title(title) and not local_police,
                "seniorClassificationBasis": "官職名で次官・長官・局長・審議官等を抽出。採用区分の判定ではない。",
                "recordKind": "official_reemployment_disclosure",
                "notificationType": label,
                "isSpecialLocalPolice": local_police,
                "originType": "特定地方警務官" if local_police else ("行政執行法人" if administrative_agency else "国の府省等"),
                "jobSearchApproval": clean(row[14+offset]),
                "publicEmploymentCenterAssistance": clean(row[15+offset]),
                "destinationId": institution_id(destination, record_id),
                "period": "2024年度", "publishedAt": "2025-09-26",
            }
            records.append(rec)
        sources.append({"id":f"cabinet-reemployment-fy2024-{group}", "title":label, "url":source_url,"publishedAt":"2025-09-26", "rowCount":len(rows), "sha256":hashlib.sha256((cache/filename).read_bytes()).hexdigest()})
    assert len(records) == 1733
    category_names = ["国又は地方公共団体の機関", "独立行政法人", "国立大学法人", "特殊法人", "認可法人", "公益社団法人又は公益財団法人", "一般社団法人又は一般財団法人", "学校法人・社会福祉法人・更生保護法人", "その他の非営利法人", "営利法人", "自営業", "その他"]
    category_totals = [65,15,23,19,3,135,344,63,189,585,185,107]
    metadata = {
        "title": "国家公務員の再就職先マップ",
        "releaseId": "cabinet-reemployment-fy2024-20250926",
        "publisher": "内閣官房内閣人事局",
        "publishedAt": "2025-09-26", "checkedAt": "2026-09-14",
        "period": "令和6年度（2024年度）公表対象",
        "periodRange": {"from":"2024-04-01", "to":"2025-03-31"},
        "totalRecords":len(records), "expectedRecords":1733, "extractionComplete":True,
        "uniquePersonKeys":len({(compact(r['name']),r['ministry'],r['retirementDate']) for r in records}),
        "namedDestinations":len({r['destinationId'] for r in records if r['destination'] not in {'自営','自営業','非公表','-','－',''}}),
        "scope": "内閣人事局の令和6年度公表全5表の全1733件。府省等1538件、特定地方警務官191件、行政執行法人4件。",
        "coverageLabel": "2024年度公表対象 1,733 / 1,733件収録",
        "careerTrackCoverage": "採用試験区分の記載がないため全件未確認。キャリア官僚限定の網羅一覧ではない。",
        "careerTrackConfirmedRecords":0,
        "seniorTitleRecords":sum(r['senior'] for r in records),
        "seniorLabel":"次官・長官・局長・審議官等（官職名から抽出）",
        "legalInterpretation": "公表された再就職は、違法なあっせんや働きかけの認定を意味しない。",
        "limitations": [
            "全国の全退職者・全期間の全再就職を収録したものではない。対象は公表制度の範囲内。",
            "同一人物の複数の再就職や同一法人内での地位変更を含むため、件数と人数は異なる。",
            "氏名のみで人物を同一視せず、元府省・離職日も照合する。固有の個人IDは原典にない。",
            "対象年度外の過去の再就職日や、2025年4・5月の就職予定日を含む記録も原典どおり収録。",
            "採用試験区分（総合職・旧I種等）は公表表に記載がなく、官職名からキャリア採用と断定しない。",
            "2025年度以降の四半期公表分や、別制度の特別職・自衛隊員の公表は未統合。",
            "府省等は原典集計の区分を使用。国家公安委員会には警察庁の記録が含まれ、各外局も原典区分に従う。",
            "法人番号は原典にないため付与していない。同名組織の別法人・名称変更は未照合。",
        ],
        "ministryCounts":dict(Counter(r['ministry'] for r in records)),
        "destinationCategoryCounts":[{"category":name,"count":n,"sourceUrl":PDF_URL,"sourcePage":2} for name,n in zip(category_names,category_totals)],
        "validation": "全1733件の氏名・官職・再就職先・地位・離職日・再就職日を公式XLSXとPDFで照合。全表連番と公式集計件数の一致を確認。",
    }
    output.write_text(json.dumps({"metadata":metadata,"sources":sources,"records":records},ensure_ascii=False,indent=2),encoding="utf-8")
    (cache/"ministry-boundaries.json").write_text(json.dumps(bounds,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps({k:metadata[k] for k in ['totalRecords','uniquePersonKeys','namedDestinations','seniorTitleRecords']},ensure_ascii=False))

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--cache",type=Path,default=Path(__file__).parent)
    parser.add_argument("--output",type=Path,default=Path(__file__).parent/"reemployment.json")
    args = parser.parse_args()
    run(args.cache,args.output)
