#!/usr/bin/env python3
"""Verify and normalize the complete 20-row MOFA special-service FY2024 release."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import unicodedata
import pdfplumber
from import_reemployment import clean, compact, iso_date, fetch, institution_id

ROOT=Path(__file__).parent
SOURCE='https://www.mofa.go.jp/mofaj/files/100910566.pdf'
LANDING='https://www.mofa.go.jp/mofaj/press/release/pressit_000001_02773.html'

def key(r):
    return tuple(compact(unicodedata.normalize('NFKC',str(r[k]))) for k in ('name','retirementDate','reemploymentDate','destination'))

def run(existing):
    path=fetch(SOURCE,ROOT/'mofa-100910566.pdf')
    previous=json.loads(existing.read_text())['records']
    by_number={int(r['sourceRow']):r for r in previous}
    main=json.loads((ROOT/'reemployment.json').read_text())['records']
    main_keys={key(r):r['id'] for r in main}
    output=[]
    assert len(previous)==20
    with pdfplumber.open(path) as pdf:
        assert len(pdf.pages)==2
        for page_no,page in enumerate(pdf.pages,1):
            for table in page.extract_tables():
                for row in table:
                    if not row or not re.fullmatch(r'\d+',row[0]):continue
                    n=int(row[0]);old=by_number[n]
                    # The last parenthesis is a separate business description in this source.
                    full=compact(row[5])
                    m=re.fullmatch(r'(.+?)（(.+)）',full)
                    destination,business=(m.group(1),m.group(2)) if m else (clean(row[5]),'')
                    assert compact(old['person'])==compact(row[1]),(n,'name')
                    assert compact(old['formerRole'])==compact(row[3]),(n,'title')
                    assert compact(old['toOrg']) in {compact(destination),full},(n,'destination')
                    assert compact(unicodedata.normalize('NFKC',old['role']))==compact(unicodedata.normalize('NFKC',row[6])),(n,'role')
                    assert old['retiredAt']==iso_date(row[4]),(n,'retirement')
                    assert old['joinedAt']==iso_date(row[7]),(n,'reemployment')
                    assert old['source']==f'{SOURCE}#page={page_no}',(n,'page')
                    record={
                        'id':old['id'], 'name':clean(row[1]),'ministry':'外務省',
                        'formerTitle':clean(row[3]),'destination':destination,
                        'destinationTitle':clean(row[6]), 'destinationBusiness':business,
                        'retirementDate':iso_date(row[4]),'reemploymentDate':iso_date(row[7]),
                        'ageAtRetirement':int(row[2]),
                        'sourceUrl':SOURCE,'sourcePage':page_no,'sourceRow':n,
                        'sourceTable':'mofa-special-fy2024','sourceNumber':n,
                        'sourceLandingUrl':LANDING,
                        'careerTrack':'unknown','recruitmentTrack':'unknown',
                        'senior':False,
                        'seniorClassificationBasis':'原データの次官・長官・局長・審議官フィルターには含めない。特命全権大使は特別職フィルターで表示。採用区分未確認。',
                        'isAmbassador':True,
                        'recordKind':'official_special_reemployment_disclosure',
                        'notificationType':'特別職国家公務員の再就職状況（外務省）',
                        'isSpecialLocalPolice':False,'isSpecialService':True,
                        'originType':'特別職国家公務員',
                        'jobSearchApproval':'記載なし','publicEmploymentCenterAssistance':'記載なし',
                        'destinationId':institution_id(destination,old['id']),
                        'period':'2024年度','publishedAt':'2025-09-26',
                        'sourceDataset':'mofa-special-fy2024',
                    }
                    assert key(record) not in main_keys,(n,'duplicate',main_keys.get(key(record)))
                    output.append(record)
    assert len(output)==20 and {r['sourceNumber'] for r in output}==set(range(1,21))
    assert len({key(r) for r in output})==20
    result={
        'metadata':{
            'title':'外務省 特別職国家公務員の再就職状況（2024年度）',
            'releaseId':'mofa-special-fy2024','period':'2024年度（2024-04-01〜2025-03-31）',
            'periodRange':{'from':'2024-04-01','to':'2025-03-31'},
            'publishedAt':'2025-09-26','checkedAt':'2026-09-14',
            'totalRecords':20,'expectedRecords':20,'extractionComplete':True,
            'uniquePersonKeys':len({(compact(r['name']),r['retirementDate']) for r in output}),
            'duplicatesWithCabinet1733':0,'combinedTotalRecords':1753,
            'coverageLabel':'外務省の特別職公表20件を追加。内閣人事局1733件と合わせ1753件。',
            'scope':'この外務省公表PDFの全20件。すべて特命全権大使。全府省の特別職再就職を網羅したものではない。',
            'careerTrackCoverage':'採用試験区分は公表PDFに記載がなく全20件未確認。',
            'validation':'既存20件の氏名・官職・再就職先・地位・両日付・PDFページを原典の全20行と照合。一致を確認。内閣人事局1733件と氏名・退職日・再就職日・就職先で照合し重複0件。',
            'normalizationNotes':['整理番号12の就職先は原典どおり「自営」、業務内容「ピアノの演奏・指導」を分離した。','整理番号12の役職は原典どおりASCIIの「-」。','整理番号6は外務省への再就職であり、民間企業への移動ではない。','外務省への直接の帰属は退職時の公表区分。元の採用省庁や採用試験を示さない。','senior=Falseは既存の官職名フィルター定義に合わせた値。大使を含める場合はisAmbassadorまたはoriginTypeを使用。'],
            'limitations':['退職日から2年を経過した後に再就職した場合は原典の対象外。','特別職の公表は国家公務員法の一般職届出表とは公表根拠が異なる。','公表は違法なあっせん・働きかけの認定ではない。'],
        },
        'sources':[{'id':'mofa-special-fy2024','title':'特別職国家公務員の再就職状況の公表について（令和6年4月1日〜令和7年3月31日）','publisher':'外務省','url':SOURCE,'landingUrl':LANDING,'publishedAt':'2025-09-26','pages':2,'rowCount':20,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}],
        'records':output,
    }
    (ROOT/'supplemental-mofa.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
    print(json.dumps(result['metadata'],ensure_ascii=False,indent=2))

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--existing',type=Path,required=True)
    run(parser.parse_args().existing)
