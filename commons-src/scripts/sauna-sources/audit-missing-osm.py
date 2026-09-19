#!/usr/bin/env python3
"""Audit old OSM IDs absent from the current Japanese bath/sauna query.

Usage: python audit-missing-osm.py --raw-input osm-missing-audit-raw.json
Omit --raw-input to repeat the exact-ID Overpass query. A missing current ID
does not demonstrate real-world closure. Nearby objects are candidates only.
"""
import argparse
import collections
import datetime
import hashlib
import json
import math
import pathlib
import urllib.parse
import urllib.request


def ident(item):
    return f"{item['type']}/{item['id']}"


def distance(a, b):
    dlat, dlon = math.radians(a['lat'] - b['lat']), math.radians(a['lon'] - b['lon'])
    return 12742000 * math.asin(min(1, math.sqrt(math.sin(dlat / 2)**2 + math.cos(math.radians(a['lat'])) * math.cos(math.radians(b['lat'])) * math.sin(dlon / 2)**2)))


def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--baseline', type=pathlib.Path, default=pathlib.Path('mini-games-10/commons-src/data/sauna-snapshot.json'))
    ap.add_argument('--snapshot', type=pathlib.Path, default=pathlib.Path('osm-all-baths.json'))
    ap.add_argument('--raw-input', type=pathlib.Path)
    ap.add_argument('--acquired-at', default=None, help='Original fetch time when known; left null for raw archives without recorded fetch time')
    ap.add_argument('--output-dir', type=pathlib.Path, default=pathlib.Path('.'))
    ap.add_argument('--endpoint', default='https://overpass-api.de/api/interpreter')
    args = ap.parse_args()
    root = args.output_dir
    old = {r['id']: r for r in json.loads(args.baseline.read_text())['facilities']}
    snapshot = json.loads(args.snapshot.read_text())
    new = {r['id']: r for r in snapshot['facilities']}
    missing = sorted(set(old) - set(new))
    selectors = ''.join(f"{kind}(id:{','.join(i.split('/')[1] for i in missing if i.startswith(kind + '/'))});" for kind in ('node', 'way', 'relation') if any(i.startswith(kind + '/') for i in missing))
    query = '[out:json][timeout:40];\nrel["boundary"="administrative"]["admin_level"="2"]["ISO3166-1"="JP"];map_to_area->.japan;\n(' + selectors + ')->.audit;\nmake phase name="current";out;\n.audit out center tags;.audit out count;\nmake phase name="insideJapan";out;\nnwr.audit(area.japan);out ids;out count;\nmake phase name="complete";out;\n'
    (root / 'osm-missing-audit.overpassql').write_text(query)
    if args.raw_input:
        raw = args.raw_input.read_bytes()
        acquired_at = args.acquired_at
    else:
        req = urllib.request.Request(args.endpoint, data=urllib.parse.urlencode({'data': query}).encode(), headers={'User-Agent': 'CommonsSaunaNow/1.0 (OpenStreetMap data import)'})
        with urllib.request.urlopen(req, timeout=65) as response:
            raw = response.read()
        acquired_at = datetime.datetime.now(datetime.timezone.utc).isoformat()
        (root / 'osm-missing-audit-raw.json').write_bytes(raw)
    data = json.loads(raw)
    if data.get('remark'):
        raise ValueError('Overpass remark: ' + data['remark'])
    stages, phase, stage_order = {}, None, []
    for item in data['elements']:
        if item['type'] == 'phase':
            phase = item['tags']['name']
            if phase in stages:
                raise ValueError('Duplicate audit phase')
            stages[phase] = []
            stage_order.append(phase)
        else:
            stages[phase].append(item)
    if stage_order != ['current', 'insideJapan', 'complete'] or stages['complete']:
        raise ValueError('Missing completion phase or unexpected sequence')
    objects = {}
    for phase in ('current', 'insideJapan'):
        items = stages[phase]
        if not items or items[-1]['type'] != 'count' or any(x['type'] not in ('node', 'way', 'relation') for x in items[:-1]):
            raise ValueError('Invalid count sentinel')
        if int(items[-1]['tags']['total']) != len(items) - 1:
            raise ValueError('Count mismatch')
        objects[phase] = {ident(x): x for x in items[:-1]}
        if len(objects[phase]) != len(items) - 1:
            raise ValueError('Duplicate IDs')
    if not set(objects['insideJapan']) <= set(objects['current']) <= set(missing):
        raise ValueError('Unexpected current or inside-country IDs')
    records = []
    for key in missing:
        current = objects['current'].get(key)
        reason = 'not_found_current_osm' if current is None else 'outside_osm_japan_national_area' if key not in objects['insideJapan'] else 'target_tags_removed'
        entry = {'id': key, 'previousName': old[key]['name'], 'reason': reason, 'currentVisible': current is not None, 'insideJapan': key in objects['insideJapan'] if current else None, 'sourceUrl': 'https://www.openstreetmap.org/' + key, 'currentTags': current.get('tags', {}) if current else None, 'realWorldClosureEstablished': False}
        candidates = sorted([(distance(old[key], x), x) for x in new.values()], key=lambda pair: pair[0])
        entry['nearbyCandidates'] = [{'id': x['id'], 'name': x['name'], 'distanceMeters': round(d, 1), 'sourceUrl': x['sourceUrl'], 'interpretation': 'nearby existing query record; identity/migration not proven by exact-ID query'} for d, x in candidates if d <= 30]
        if reason == 'not_found_current_osm':
            entry['explanation'] = '現行 Overpass exact-ID 応答に存在しない。削除・統合・表現変更の可能性があり、実施設の閉業とは断定しない。'
        elif reason == 'outside_osm_japan_national_area':
            entry['explanation'] = '現在も sauna タグがあるが、OSM の日本国境 area 3600382313 の対象外。'
        else:
            entry['explanation'] = '現行 OSM オブジェクトは国内に存在するが対象サウナ・浴場タグがない。'
        if key in ('node/13380724385', 'way/1240368237'):
            hotel = 'aomori' if key == 'node/13380724385' else 'nono_beppu'
            entry['officialRecovery'] = {'file': 'official-osm-gap-baths.json', 'sourceUrl': f'https://dormy-hotels.com/dormyinn/hotels/{hotel}/spa/', 'checkedAt': '2026-09-19', 'interpretation': '公式施設ページにサウナと大浴場、具体的営業時間あり。宿泊者限定として別の公式データに回収。'}
        if key == 'way/514449130':
            entry['explanation'] += '旧施設名と同名で約 1 m の relation/21027750 が現行抽出に存在。'
        records.append(entry)
    result = {'queryComplete': True, 'endpoint': args.endpoint, 'query': query, 'querySha256': hashlib.sha256(query.encode()).hexdigest(), 'responseSha256': hashlib.sha256(raw).hexdigest(), 'acquiredAt': acquired_at, 'processedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'sourceDate': data['osm3s']['timestamp_osm_base'], 'sourceAreaDate': data['osm3s'].get('timestamp_areas_base', ''), 'baselineSourceDate': json.loads(args.baseline.read_text()).get('sourceDate', ''), 'snapshotSourceDate': snapshot['sourceDate'], 'summary': {'requested': len(missing), 'current': len(objects['current']), 'insideJapan': len(objects['insideJapan']), 'reasons': dict(collections.Counter(x['reason'] for x in records)), 'officialRecovery': sum('officialRecovery' in x for x in records)}, 'records': records, 'limitations': 'Missing IDs establish only absence in the current OSM response, not business closure. Nearby candidates are not automatic identity merges. Official additions are separate from the complete OSM tag query.'}
    write(root / 'osm-missing-audit.json', result)
    print(json.dumps(result['summary'], ensure_ascii=False))


if __name__ == '__main__':
    main()
