"""Assemble complete acquired bath inventories without inventing schedules.

Usage: python scripts/assemble-sauna-inventory.py --sources data/sauna-sources
Every input is a reviewed, normalized source snapshot; no top-N selection is used.
The original individually reviewed schedules have priority over all imports.
"""
import argparse
import collections
import datetime
import hashlib
import json
import math
import pathlib
import re
import unicodedata
import urllib.parse

ROOT = pathlib.Path(__file__).resolve().parents[1]
PREFECTURES = '北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県'.split()


def norm(value):
    return re.sub(r'[\s・･「」『』()（）\-－−‐]', '', unicodedata.normalize('NFKC', value or '')).lower()


def city_from(address, prefecture):
    rest = address.removeprefix(prefecture)
    match = re.match(r'(.+?[市区町村])', rest)
    return match[1] if match else ''


def address_key(address, prefecture):
    value = unicodedata.normalize('NFKC', address).removeprefix(prefecture)
    value = re.sub(r'\s', '', value)
    value = re.sub(r'丁目|番地?|号|[－−‐]', '-', value)
    return value.rstrip('-')


def clean_url(value):
    return value if isinstance(value, str) and re.match(r'^https?://[^\s]+$', value) else ''


def record_id(prefix, row):
    text = '|'.join(str(row.get(k, '')) for k in ['name', 'prefecture', 'address', 'sourceUrl'])
    return prefix + '-' + hashlib.sha256(text.encode()).hexdigest()[:18]


def kind_from(row):
    kind = str(row.get('kind') or row.get('type') or '')
    if kind in ['sauna', 'sento', 'spa', 'hotel', 'sports', 'other']:
        return kind
    if re.search('宿泊|ホテル|旅館', kind):
        return 'hotel'
    if re.search('スポーツ|ジム|fitness', kind):
        return 'sports'
    if re.search('銭湯|普通公衆|普通浴場|一般公衆', kind):
        return 'sento'
    if kind == 'サウナ':
        return 'sauna'
    return 'spa'


def schedule_text(row):
    value = row.get('hoursText') or row.get('openingHoursText') or row.get('hours') or ''
    if isinstance(value, list):
        value = ' / '.join(map(str, value))
    if not isinstance(value, str):
        return ''
    return value.strip()


def normalize_row(row, source_kind, snapshot):
    name = str(row.get('name') or '').strip()
    pref = row.get('prefecture') or next((p for p in PREFECTURES if str(row.get('address', '')).startswith(p)), '')
    address = str(row.get('address') or '').strip()
    source_url = clean_url(row.get('sourceUrl') or row.get('source_url') or row.get('url'))
    kind = kind_from(row)
    is_osm = source_kind == 'osm'
    is_registry = source_kind == 'registry'
    hours_text = schedule_text(row)
    # Machine-readable OSM expressions and published clock times are separate.
    # A prose timetable must never be interpreted as a seven-day schedule.
    hours = str(row.get('hours') or '') if is_osm else str(row.get('hoursExpression') or '')
    weekday_only = ''
    if is_osm and hours and not re.search(r'\d{1,2}:\d{2}|24/7', hours):
        weekday_only, hours = hours, ''
    if is_osm:
        hours_text = row.get('hoursText') or ''
    checked = (row.get('hoursVerifiedAt') or row.get('checkedAt') or row.get('checkedOn') or '') if is_osm or is_registry else (row.get('checkedAt') or row.get('retrievedAt') or row.get('fetchedAt') or row.get('acquiredAt') or snapshot.get('generatedAt') or snapshot.get('fetchedAt') or snapshot.get('acquiredAt') or '')
    acquired = row.get('retrievedAt') or row.get('fetchedAt') or row.get('acquiredAt') or snapshot.get('generatedAt') or snapshot.get('fetchedAt') or snapshot.get('acquiredAt') or ''
    source_date = row.get('sourceDataDate') or row.get('sourceDate') or snapshot.get('sourceDate') or ''
    result = {
        'id': str(row.get('id') or record_id(source_kind, row)),
        'name': name or '名称が登録されていない施設', 'prefecture': pref,
        'city': row.get('city') or city_from(address, pref), 'address': address,
        'kind': kind, 'categories': ['sento' if kind == 'sento' else 'saunas'],
        'hours': hours, 'hoursText': hours_text, 'closedText': row.get('closedText') or row.get('holidays') or '',
        'phone': row.get('phone') or '', 'website': clean_url(row.get('website')),
        'sourceUrl': source_url, 'sourceName': row.get('sourceName') or row.get('sourceLabel') or ('OpenStreetMap' if is_osm else '施設の営業案内'),
        'sourceType': source_kind if source_kind in ['osm', 'registry'] else 'official',
        'checkedAt': checked, 'acquiredAt': acquired, 'sourceDate': source_date,
        'access': row.get('access') or '', 'scope': row.get('hoursScope') or row.get('scope') or 'facility',
        'hoursEvidence': source_kind if source_kind in ['osm', 'registry'] else 'official',
        'inventoryOnly': not bool(hours or hours_text),
        'status': row.get('status') or 'unverified',
    }
    for key in ['lat', 'lon']:
        value = row.get(key, row.get('lng') if key == 'lon' else None)
        if value is not None and value != '':
            try:
                result[key] = float(value)
            except (ValueError, TypeError):
                pass
    for key in ['accessLabel', 'otherSources', 'flags', 'license', 'sourceDataUrl', 'note', 'closurePeriods', 'closedMonthDays', 'scheduleChanges', 'lastEntry', 'lastEntryBeforeClose']:
        if row.get(key):
            result[key] = row[key]
    if not is_osm:
        result['manualCalendar'] = True
    tags = row.get('tags', {})
    conditions = []
    access = result['access']
    if access in ['facility_users_or_members', 'members_only']:
        result['access'] = 'members'
        conditions.append('会員・施設利用者向け')
    if tags.get('reservation') in ['yes', 'required', 'only']:
        result['access'] = 'permit'
        conditions.append('予約が必要')
    if tags.get('membership') in ['yes', 'required', 'only']:
        result['access'] = 'members'
        conditions.append('会員向け')
    if tags.get('male') == 'no' or tags.get('female') in ['only', 'designated']:
        conditions.append('女性向けの利用条件あり')
    if tags.get('female') == 'no' or tags.get('male') in ['only', 'designated']:
        conditions.append('男性向けの利用条件あり')
    if re.search('限定|会員|予約|専用|利用.*条件', tags.get('note', '')):
        conditions.append(tags['note'])
    if conditions:
        result['accessLabel'] = ' / '.join(conditions)
    if row.get('temporarilyClosed'):
        result['status'] = 'inactive'
        result['note'] = '休業の案内があります。再開状況は施設の案内をご確認ください。'
    if re.search('休業中|休館中|再開未定|再開の目処', tags.get('note', '')):
        result['status'] = 'inactive'
        result['note'] = tags['note']
    if weekday_only:
        result['closedText'] = '地図の営業日情報: '+re.sub(r'Mo|Tu|We|Th|Fr|Sa|Su|off', lambda m: {'Mo':'月','Tu':'火','We':'水','Th':'木','Fr':'金','Sa':'土','Su':'日','off':'休業'}[m[0]], weekday_only)
    if 'temporarily_closed' in row.get('flags', []):
        result['status'] = 'inactive'
        result['note'] = '休業の案内があります。再開状況は施設の案内をご確認ください。'
    return result


def same_facility(a, b):
    if a['id'] == b['id']:
        return True
    if not a['prefecture'] or a['prefecture'] != b['prefecture']:
        return False
    an, bn = norm(a['name']), norm(b['name'])
    if not an or an != bn:
        return False
    # An identical generic bath name in a different city is a different venue.
    if a['city'] and b['city'] and a['city'] != b['city']:
        return False
    ap, bp = re.sub(r'\D', '', a['phone']), re.sub(r'\D', '', b['phone'])
    if ap and ap == bp:
        return True
    if a.get('website') and b.get('website'):
        def site_key(url):
            parsed = urllib.parse.urlsplit(url)
            return (parsed.netloc.lower().removeprefix('www.'), parsed.path.rstrip('/'), parsed.query)
        if site_key(a['website']) == site_key(b['website']):
            return True
    if a['address'] and address_key(a['address'], a['prefecture']) == address_key(b['address'], b['prefecture']):
        return True
    generic = {'名称未登録', '名称が登録されていない施設', '露天風呂', '男湯', '女湯', 'サウナ', '温泉', 'onsen', 'publicbath', 'bath', 'sauna'}
    if an in generic:
        return False
    different_osm_types = a['id'].split('/')[0] != b['id'].split('/')[0]
    if different_osm_types and all(x.get(k) is not None for x in [a, b] for k in ['lat', 'lon']):
        distance = math.hypot((a['lat']-b['lat'])*111000, (a['lon']-b['lon'])*91000)
        if distance < 60:
            return True
    return False


def enrich(preferred, incoming):
    if not preferred.get('hours') and not preferred.get('hoursText') and (incoming.get('hours') or incoming.get('hoursText')):
        original_source = {'name': preferred['sourceName'], 'url': preferred['sourceUrl']}
        for key in ['hours', 'hoursText', 'closedText', 'checkedAt', 'sourceDate', 'sourceName', 'sourceUrl', 'sourceType', 'manualCalendar', 'hoursEvidence', 'scope']:
            if key in incoming:
                preferred[key] = incoming[key]
        preferred['inventoryOnly'] = False
        preferred.setdefault('otherSources', []).append(original_source)
    for key in ['address', 'city', 'phone', 'website', 'lat', 'lon', 'access', 'accessLabel']:
        if not preferred.get(key) and incoming.get(key):
            preferred[key] = incoming[key]
    sources = preferred.setdefault('otherSources', [])
    for source in [{'name': incoming['sourceName'], 'url': incoming['sourceUrl']}, *incoming.get('otherSources', [])]:
        if source['url'] != preferred['sourceUrl'] and not any(x['url'] == source['url'] for x in sources):
            sources.append(source)
    ids = preferred.setdefault('mergedIds', [])
    for ident in [incoming['id'], *incoming.get('mergedIds', [])]:
        if ident not in ids:
            ids.append(ident)
    return preferred


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sources', type=pathlib.Path, default=ROOT/'data/sauna-sources')
    args = parser.parse_args()
    reviewed = json.loads((ROOT/'data/sauna-nationwide.json').read_text())
    output, index = [], collections.defaultdict(list)
    sources, excluded, duplicate_pairs, raw_count = [], [], [], len(reviewed)
    upstream_exclusions = []
    snapshots = []
    for filename in sorted(args.sources.glob('*.json')):
        data = json.loads(filename.read_text())
        snapshots.append((data['sourceKind'], data, filename))
    # Official hours outrank OSM and a license registry, but curated > everything.
    snapshots.sort(key=lambda x: {'official': 1, 'osm': 2, 'registry': 3}[x[0]])

    def insert(row):
        key = (row['prefecture'], norm(row['name']))
        for i in index[key]:
            if same_facility(output[i], row):
                duplicate_pairs.append({'kept': output[i]['id'], 'merged': row['id']})
                enrich(output[i], row)
                return
        index[key].append(len(output))
        output.append(row)

    for row in reviewed:
        insert(row)
    sources.append({'name': '個別に確認した施設・運営会社の営業案内', 'url': 'https://aitechd.com/commons/sauna/', 'count': len(reviewed), 'withHours': len(reviewed), 'license': '各施設の公開する事実情報', 'sourceDate': '2026-09-19', 'scope': '47都道府県の既存調査124施設。各行に実際の出典URL。'})
    for source_kind, data, filename in snapshots:
        rows = data['facilities']
        raw_count += len(rows)
        if data.get('upstreamExcludedCount'):
            upstream_exclusions.append({'source': filename.name, 'count': data['upstreamExcludedCount']})
        sources.extend(data.get('sources', []))
        for raw in rows:
            reason = None
            if raw.get('publishable') is False:
                reason = '掲載対象の確認待ち'
            elif (raw.get('inactive') and not raw.get('temporarilyClosed')) or raw.get('status') in ['closed', 'inactive', 'demolished'] or any(flag in ['closed', 'inactive', 'demolished', 'permanently_closed'] for flag in raw.get('flags', [])):
                reason = '休廃業の記載'
            elif raw.get('access') == 'no':
                reason = '利用不可の記載'
            elif re.search(r'高齢者限定|福祉.*専用|老人.*専用', raw.get('tags', {}).get('note', '')):
                reason = '福祉専用の利用条件'
            row = normalize_row(raw, source_kind, data)
            if row['prefecture'] not in PREFECTURES:
                reason = '都道府県の対応待ち'
            if not row['sourceUrl']:
                reason = '出典URL欠落'
            if reason:
                excluded.append({'id': row['id'], 'reason': reason})
                continue
            insert(row)
    # A lower-priority registry may add coordinates to a reviewed record after
    # its matching OSM node was visited. Reconcile again using that new evidence.
    while True:
        previous = output
        output, index = [], collections.defaultdict(list)
        for row in previous:
            insert(row)
        if len(output) == len(previous):
            break
    output.sort(key=lambda r: (PREFECTURES.index(r['prefecture']), r['city'], r['name'], r['id']))
    with_hours = sum(bool(r.get('hours') or r.get('hoursText')) for r in output)
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    upstream_count = sum(x['count'] for x in upstream_exclusions)
    coverage = {'rawRecords': raw_count+upstream_count, 'normalizedRecords': raw_count, 'uniqueFacilities': len(output), 'withHours': with_hours, 'withoutHours': len(output)-with_hours, 'sourceCount': len(sources), 'acquiredAt': now, 'sources': sources, 'excluded': len(excluded)+upstream_count, 'duplicates': len(duplicate_pairs), 'prefectures': {p: {'count': sum(r['prefecture'] == p for r in output), 'withHours': sum(r['prefecture'] == p and bool(r.get('hours') or r.get('hoursText')) for r in output)} for p in PREFECTURES}}
    assert raw_count == len(output)+len(excluded)+len(duplicate_pairs)
    assert len({r['id'] for r in output}) == len(output), 'Duplicate IDs'
    assert len({r['prefecture'] for r in output}) == 47
    snapshot = {'schemaVersion': 1, 'coverageClaim': '取得を完了した公開データの全件を統合。日本の実在全施設を網羅したことを保証する名簿ではありません。', 'license': 'OSM由来のデータベースはODbL 1.0。行政オープンデータのライセンスと出典はsources参照。', 'coverage': coverage, 'facilities': output}
    serialized = json.dumps(snapshot, ensure_ascii=False, separators=(',', ':'))+'\n'
    (ROOT/'data/sauna-inventory.json').write_text(serialized)
    (ROOT/'public/sauna-inventory.json').write_text(serialized)
    (ROOT/'data/sauna-inventory-audit.json').write_text(json.dumps({'duplicates': duplicate_pairs, 'excluded': excluded, 'upstreamExclusions': upstream_exclusions}, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({k:v for k,v in coverage.items() if k not in ['sources','prefectures']}, ensure_ascii=False))


if __name__ == '__main__':
    main()
