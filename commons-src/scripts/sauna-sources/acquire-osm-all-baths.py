#!/usr/bin/env python3
"""Acquire the complete OSM query result for baths/saunas inside Japan.

No result cap, no opening-hours/access/lifecycle exclusion. A query is complete
only when its final out-count sentinel matches all downloaded OSM objects and
the ISO3166-1=JP/admin_level=2 country area is present. Remarks and HTTP errors
fail closed. OSM tag completeness is not real-world facility completeness.

python acquire-osm-all-baths.py --endpoint https://overpass-api.de/api/interpreter

To reprocess without another network query:
python acquire-osm-all-baths.py --raw-input osm-all-baths-overpass-raw.json \
  --acquired-at ORIGINAL_ISO_TIMESTAMP --boundaries japan-prefectures.geojson

Missing prefecture polygons are downloaded from the documented public URL.
They only classify records already admitted by Japan's OSM national area.
"""
import argparse
import collections
import datetime
import hashlib
import json
import pathlib
import re
import sys
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent
PREFIXES = 'disused|abandoned|demolished|removed|was|former|closed|construction|proposed|planned|ruins|ruined|razed|destroyed'
QUERY = '''[out:json][timeout:180];
rel["boundary"="administrative"]["admin_level"="2"]["ISO3166-1"="JP"]->.country;
.country out tags;
.country map_to_area->.japan;
.japan out tags;
(
  nwr(area.japan)["leisure"="sauna"];
  nwr(area.japan)["sauna"]["sauna"!~"^(no|none|false|0)$"];
  nwr(area.japan)["amenity"~"^(public_bath|bathhouse|onsen|sento)$"];
  nwr(area.japan)["bath:type"];
  nwr(area.japan)[~"^(''' + PREFIXES + '''):leisure$"~"^sauna$"];
  nwr(area.japan)[~"^(''' + PREFIXES + '''):amenity$"~"^(public_bath|bathhouse|onsen|sento)$"];
  nwr(area.japan)[~"^(''' + PREFIXES + '''):bath:type$"~"."];
  nwr(area.japan)[~"^(''' + PREFIXES + '''):sauna$"~"."];
)->.facilities;
.facilities out center tags;
.facilities out count;
'''
WIKI = [
    'https://wiki.openstreetmap.org/wiki/Tag:leisure=sauna',
    'https://wiki.openstreetmap.org/wiki/Key:sauna',
    'https://wiki.openstreetmap.org/wiki/Tag:amenity=public_bath',
    'https://wiki.openstreetmap.org/wiki/Key:bath:type',
    'https://wiki.openstreetmap.org/wiki/Lifecycle_prefix',
    'https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL',
]
BOUNDARY_URL = 'https://raw.githubusercontent.com/dataofjapan/land/master/japan.geojson'
REVIEWED_PARTIAL_BATH_IDS = {
    'node/11276698757', 'node/13742099822', 'node/6815358199',
    'node/5114996121', 'node/5132411241', 'node/5733814621',
    'node/8204491922', 'node/8204492025',
}


def load_prefectures(path):
    data = json.loads(path.read_text())
    if data.get('type') != 'FeatureCollection' or len(data['features']) != 47:
        raise ValueError('Expected exactly 47 prefecture boundary features')
    polygons = []
    for feature in data['features']:
        coords = feature['geometry']['coordinates']
        if feature['geometry']['type'] == 'Polygon':
            coords = [coords]
        for polygon in coords:
            xs, ys = zip(*polygon[0])
            polygons.append((min(xs), min(ys), max(xs), max(ys), polygon, feature['properties']))
    return polygons


def in_ring(x, y, ring):
    inside, previous = False, len(ring) - 1
    for index, (xi, yi) in enumerate(ring):
        xj, yj = ring[previous]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            inside = not inside
        previous = index
    return inside


def assign_prefecture(facility, polygons):
    x, y = facility['lon'], facility['lat']
    facility.update({'prefecture': '', 'prefectureCode': '', 'prefectureSource': ''})
    for left, bottom, right, top, polygon, props in polygons:
        if left <= x <= right and bottom <= y <= top and in_ring(x, y, polygon[0]) and not any(in_ring(x, y, hole) for hole in polygon[1:]):
            facility.update({'prefecture': props['nam_ja'], 'prefectureCode': str(props['id']).zfill(2), 'prefectureSource': 'dataofjapan/land point-in-polygon'})
            return
    # The national OSM area is authoritative for inclusion. Older prefectural
    # polygons may miss new coasts: retain the record without guessing its prefecture.


def classification(tags):
    bath_values = {'public_bath', 'bathhouse', 'onsen', 'sento'}
    negative_sauna = {'no', 'none', 'false', '0', 'closed'}
    has_bath = tags.get('amenity') in bath_values or bool(tags.get('bath:type'))
    has_sauna = tags.get('leisure') == 'sauna' or bool(tags.get('sauna')) and tags['sauna'].lower() not in negative_sauna
    bath_lifecycle, sauna_lifecycle, facility_lifecycle = [], [], []
    for prefix in PREFIXES.split('|'):
        if tags.get(prefix) == 'yes':
            facility_lifecycle.append(prefix)
        if tags.get(prefix + ':amenity') in bath_values or tags.get(prefix + ':bath:type'):
            bath_lifecycle.append(prefix)
        if tags.get(prefix + ':leisure') == 'sauna' or tags.get(prefix + ':sauna', '').lower() not in negative_sauna | {''}:
            sauna_lifecycle.append(prefix)
    bath_operational = has_bath and not bath_lifecycle and not facility_lifecycle
    sauna_operational = has_sauna and not sauna_lifecycle and not facility_lifecycle
    inactive = bool(facility_lifecycle or bath_lifecycle or sauna_lifecycle) and not (bath_operational or sauna_operational)
    bath_types = {x.strip() for x in tags.get('bath:type', '').split(';') if x.strip()}
    non_target = {'foot_bath', 'hand_bath', 'finger_bath', 'トイレ', 'river', 'lake', 'sea', 'pool'}
    publishable = not (bath_types and bath_types <= non_target and not has_sauna)
    name = tags.get('name:ja') or tags.get('name', '')
    publishable_reason = '' if publishable else 'サウナ・全身の温浴施設の対象外: bath:type=' + tags['bath:type']
    non_target_name = re.search(r'足湯|足ゆ|足浴|手湯|指湯|\bfoot\s*baths?\b|\bhand\s*baths?\b|\bfinger\s*baths?\b', name, re.I)
    if non_target_name and not has_sauna:
        publishable = False
        publishable_reason = 'OSM名称が部分浴設備を明示: ' + non_target_name.group(0)
    permanent_name = re.search(r'閉業|閉店|閉館|廃業|廃止|営業終了|跡地|[（(]跡[）)]$|跡$', name)
    temporary_name = re.search(r'休業中|臨時休業|一時休業|休館中', name)
    inactive_reasons = []
    if inactive:
        inactive_reasons.append('施設または全対象設備の休廃業・建設計画タグ')
    if permanent_name:
        inactive = True
        inactive_reasons.append('OSM施設名の終了表示: ' + permanent_name.group(0))
    if temporary_name:
        inactive = True
        inactive_reasons.append('OSM施設名の一時休業表示: ' + temporary_name.group(0))
    return {
        'publishable': publishable,
        'publishableReason': publishable_reason,
        'inactive': inactive,
        'inactiveReasons': inactive_reasons,
        'temporarilyClosed': bool(temporary_name) and not permanent_name,
        'nameClosureEvidence': permanent_name.group(0) if permanent_name else temporary_name.group(0) if temporary_name else '',
        'featureStatus': {
            'bath': {'taggedActive': has_bath, 'lifecycle': bath_lifecycle},
            'sauna': {'taggedActive': has_sauna, 'lifecycle': sauna_lifecycle},
            'facilityLifecycle': facility_lifecycle,
        },
    }


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def write_json(path, value):
    tmp = path.with_suffix(path.suffix + '.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    tmp.replace(path)


def normalize(item):
    tags = item.get('tags', {})
    pt = item.get('center', item)
    if not isinstance(pt.get('lat'), (int, float)) or not isinstance(pt.get('lon'), (int, float)):
        raise ValueError('Missing coordinates: ' + str(item.get('id')))
    ident = f"{item['type']}/{item['id']}"
    lifecycle = {k: v for k, v in tags.items() if re.match('^(' + PREFIXES + ')(:|$)', k)}
    for k in ['end_date', 'opening_date', 'start_date', 'operational_status']:
        if k in tags:
            lifecycle[k] = tags[k]
    active_prefix = [p for p in PREFIXES.split('|') if tags.get(p) == 'yes' or any(k.startswith(p + ':') for k in tags)]
    hours = tags.get('opening_hours:sauna') or tags.get('sauna:opening_hours') or tags.get('opening_hours', '')
    bath_type = tags.get('bath:type', '')
    kind = '銭湯' if bath_type in ('sento', 'super_sento') else '温浴施設' if tags.get('amenity') in ('public_bath', 'bathhouse', 'onsen', 'sento') or bath_type else '宿泊施設' if tags.get('tourism') in ('hotel', 'hostel', 'guest_house', 'motel', 'chalet') else 'スポーツ施設' if tags.get('leisure') in ('fitness_centre', 'sports_centre', 'swimming_pool') else 'サウナ'
    addr = tags.get('addr:full') or ''.join(dict.fromkeys(tags.get(k, '') for k in ['addr:province', 'addr:state', 'addr:city', 'addr:suburb', 'addr:quarter', 'addr:neighbourhood', 'addr:street', 'addr:block_number', 'addr:housenumber'] if tags.get(k)))
    classification_result = classification(tags)
    if ident in REVIEWED_PARTIAL_BATH_IDS:
        classification_result['publishable'] = False
        classification_result['publishableReason'] = '施設名が足湯を明示。全身浴・サウナの存在が確認できるまで対象外（leisure=sauna等との不一致を含む）'
        classification_result['publishabilityEvidence'] = {'type': 'reviewed_name_tag_conflict_or_partial_bath', 'name': tags.get('name:ja') or tags.get('name', ''), 'sourceUrl': 'https://www.openstreetmap.org/' + ident, 'reviewedAt': '2026-09-19'}
    return {
        'id': ident, 'name': tags.get('name:ja') or tags.get('name') or '名称未登録',
        'address': addr, 'lat': pt['lat'], 'lon': pt['lon'], 'kind': kind,
        'hours': hours, 'hoursScope': 'sauna' if tags.get('opening_hours:sauna') or tags.get('sauna:opening_hours') else 'facility',
        'hoursTags': {k: v for k, v in tags.items() if 'opening_hours' in k},
        'bathType': bath_type, 'sauna': tags.get('sauna', ''),
        'access': tags.get('sauna:access') or tags.get('access', ''),
        'accessTags': {k: v for k, v in tags.items() if 'access' in k or k in ('reservation', 'membership', 'customers', 'tourism', 'fee', 'female', 'male', 'unisex', 'gender_segregated')},
        'lifecycle': active_prefix, 'lifecycleTags': lifecycle,
        'website': tags.get('website') or tags.get('contact:website', ''),
        'phone': tags.get('phone') or tags.get('contact:phone', ''),
        'note': tags.get('opening_hours:description', ''),
        'sourceUrl': 'https://www.openstreetmap.org/' + ident,
        'checkedOn': tags.get('check_date:opening_hours', ''),
        'checkedAt': tags.get('check_date:opening_hours', ''),
        **classification_result,
        'tags': tags,
    }


def main():
    global ROOT
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--endpoint', default='https://overpass-api.de/api/interpreter')
    parser.add_argument('--raw-input', type=pathlib.Path)
    parser.add_argument('--output-dir', type=pathlib.Path, default=pathlib.Path('.'))
    parser.add_argument('--boundaries', type=pathlib.Path, default=pathlib.Path('japan-prefectures.geojson'))
    parser.add_argument('--baseline', type=pathlib.Path, default=pathlib.Path('mini-games-10/commons-src/data/sauna-snapshot.json'))
    parser.add_argument('--acquired-at', help='Original acquisition ISO timestamp, required when reprocessing saved raw input')
    parser.add_argument('--prefecture-overrides', type=pathlib.Path, default=pathlib.Path('osm-prefecture-overrides.json'))
    parser.add_argument('--missing-audit', type=pathlib.Path, default=pathlib.Path('osm-missing-audit.json'))
    args = parser.parse_args()
    ROOT = args.output_dir.resolve()
    ROOT.mkdir(parents=True, exist_ok=True)
    query_path = ROOT / 'osm-all-baths.overpassql'
    query_path.write_text(QUERY)
    meta_path = ROOT / 'osm-all-baths-acquisition.json'
    metadata = {
        'startedAt': now(), 'endpoint': args.endpoint, 'query': QUERY,
        'querySha256': hashlib.sha256(QUERY.encode()).hexdigest(),
        'tagDocumentation': WIKI,
        'queryComplete': False,
        'scope': 'OSM objects matching the documented query inside the OSM Japan national administrative area; not all real-world facilities',
        'legacyCompatibilityTags': ['amenity=bathhouse', 'amenity=onsen', 'amenity=sento'],
        'retention': 'All opening-hours-missing, unnamed, access-restricted, customer-only, and lifecycle-tagged records are retained with source tags. Non-target bathing types are explicitly flagged publishable=false, not removed.',
    }
    write_json(meta_path, metadata)
    try:
        if args.raw_input:
            if not args.acquired_at:
                raise ValueError('--raw-input requires --acquired-at to avoid relabeling old source acquisition as new')
            raw = args.raw_input.read_bytes()
            metadata['rawInput'] = str(args.raw_input)
            metadata['acquiredAt'] = args.acquired_at
        else:
            req = urllib.request.Request(args.endpoint, data=urllib.parse.urlencode({'data': QUERY}).encode(), headers={'User-Agent': 'CommonsSaunaNow/1.0 (OpenStreetMap data import)', 'Accept': 'application/json'})
            with urllib.request.urlopen(req, timeout=210) as response:
                metadata['httpStatus'] = response.status
                raw = response.read()
            (ROOT / 'osm-all-baths-overpass-raw.json').write_bytes(raw)
            metadata['acquiredAt'] = now()
        metadata['responseBytes'] = len(raw)
        metadata['responseSha256'] = hashlib.sha256(raw).hexdigest()
        data = json.loads(raw)
        if data.get('remark'):
            raise ValueError('Overpass partial/error response: ' + data['remark'])
        source_date = data['osm3s']['timestamp_osm_base']
        source_area_date = data['osm3s'].get('timestamp_areas_base')
        elements = data['elements']
        if not elements or elements[-1].get('type') != 'count':
            raise ValueError('Missing final out-count sentinel')
        countries = [e for e in elements if e.get('type') == 'relation' and e.get('tags', {}).get('ISO3166-1') == 'JP' and e.get('tags', {}).get('admin_level') == '2']
        areas = [e for e in elements if e.get('type') == 'area' and e.get('tags', {}).get('ISO3166-1') == 'JP']
        if len(countries) != 1 or len(areas) != 1 or areas[0]['id'] != 3600000000 + countries[0]['id']:
            raise ValueError('Japan boundary relation/area validation failed')
        records = [e for e in elements if e.get('type') in ('node', 'way', 'relation') and e not in countries]
        counts = elements[-1]['tags']
        actual = collections.Counter(e['type'] for e in records)
        if int(counts['total']) != len(records) or any(int(counts[k + 's']) != actual[k] for k in ('node', 'way', 'relation')):
            raise ValueError('Downloaded object count does not match server sentinel')
        ids = [f"{x['type']}/{x['id']}" for x in records]
        if len(set(ids)) != len(ids):
            raise ValueError('Duplicate OSM IDs in complete response')
        facilities = sorted((normalize(x) for x in records), key=lambda x: x['id'])
        if not args.boundaries.exists():
            with urllib.request.urlopen(BOUNDARY_URL, timeout=60) as response:
                boundary_bytes = response.read()
            args.boundaries.parent.mkdir(parents=True, exist_ok=True)
            args.boundaries.write_bytes(boundary_bytes)
        if args.boundaries.exists():
            polygons = load_prefectures(args.boundaries)
            for facility in facilities:
                assign_prefecture(facility, polygons)
            metadata['prefectureBoundary'] = {'url': BOUNDARY_URL, 'sha256': hashlib.sha256(args.boundaries.read_bytes()).hexdigest(), 'features': 47, 'use': 'classification only; no geographic inclusion or exclusion; unmatched prefectures retained blank'}
        if args.prefecture_overrides.exists():
            override_data = json.loads(args.prefecture_overrides.read_text())
            if not override_data.get('queryComplete'):
                raise ValueError('Refusing incomplete prefecture lookup overrides')
            applied = 0
            for facility in facilities:
                override = override_data['overrides'].get(facility['id'])
                if not facility.get('prefecture') and override and override['lat'] == facility['lat'] and override['lon'] == facility['lon']:
                    for key in ['prefecture', 'prefectureCode', 'prefectureSource']:
                        facility[key] = override[key]
                    facility['prefectureSourceUrl'] = override['sourceUrl']
                    facility['prefectureSourceDate'] = override['sourceDate']
                    applied += 1
            metadata['prefectureOverrides'] = {'path': str(args.prefecture_overrides), 'sha256': hashlib.sha256(args.prefecture_overrides.read_bytes()).hexdigest(), 'sourceDate': override_data['sourceDate'], 'sourceAreaDate': override_data.get('sourceAreaDate'), 'applied': applied}
        if not facilities:
            raise ValueError('Refusing empty acquisition')
        summary = {
            'records': len(facilities), 'hours': sum(bool(x['hours']) for x in facilities),
            'hoursMissing': sum(not x['hours'] for x in facilities),
            'hoursWithExplicitTime': sum(bool(re.search(r'\d{1,2}:\d{2}|24/7', x['hours'])) for x in facilities),
            'rulesWithoutExplicitTime': sum(bool(x['hours']) and not re.search(r'\d{1,2}:\d{2}|24/7', x['hours']) for x in facilities),
            'namesMissing': sum(not (x['tags'].get('name:ja') or x['tags'].get('name')) for x in facilities),
            'lifecycleTagged': sum(bool(x['lifecycle']) for x in facilities),
            'publishable': sum(x['publishable'] for x in facilities),
            'nonTarget': sum(not x['publishable'] for x in facilities),
            'inactive': sum(x['inactive'] for x in facilities),
            'temporarilyClosed': sum(x['temporarilyClosed'] for x in facilities),
            'nameClosureEvidence': sum(bool(x['nameClosureEvidence']) for x in facilities),
            'publishableActive': sum(x['publishable'] and not x['inactive'] for x in facilities),
            'publishableActiveNamesMissing': sum(x['publishable'] and not x['inactive'] and not (x['tags'].get('name:ja') or x['tags'].get('name')) for x in facilities),
            'publishableActiveExplicitHours': sum(x['publishable'] and not x['inactive'] and bool(re.search(r'\d{1,2}:\d{2}|24/7', x['hours'])) for x in facilities),
            'publishableHours': sum(x['publishable'] and bool(x['hours']) for x in facilities),
            'prefectures': len({x.get('prefecture') for x in facilities if x.get('prefecture')}),
            'prefectureUnassigned': sum(not x.get('prefecture') for x in facilities),
            'accessCounts': dict(collections.Counter(x['access'] for x in facilities)),
            'kindCounts': dict(collections.Counter(x['kind'] for x in facilities)),
            'bathTypeCounts': dict(collections.Counter(x['bathType'] for x in facilities)),
            'saunaCounts': dict(collections.Counter(x['sauna'] for x in facilities)),
        }
        if args.baseline.exists():
            old = json.loads(args.baseline.read_text())['facilities']
            old_ids = {x['id'] for x in old}
            new_ids = set(ids)
            summary['baseline'] = {'path': str(args.baseline), 'records': len(old), 'hours': sum(bool(x['hours']) for x in old), 'retained': len(old_ids & new_ids), 'added': len(new_ids - old_ids), 'missingFromNewQuery': sorted(old_ids - new_ids)}
            if args.missing_audit.exists():
                audit_raw = args.missing_audit.read_bytes()
                audit = json.loads(audit_raw)
                if audit.get('queryComplete') and {x['id'] for x in audit['records']} == old_ids - new_ids and audit.get('snapshotSourceDate') == source_date:
                    metadata['baselineMissingAudit'] = {'path': str(args.missing_audit), 'sha256': hashlib.sha256(audit_raw).hexdigest(), 'sourceDate': audit['sourceDate'], 'sourceAreaDate': audit['sourceAreaDate'], 'summary': audit['summary'], 'records': audit['records']}
                    summary['baseline']['auditSummary'] = audit['summary']
        metadata.update({'finishedAt': now(), 'queryComplete': True, 'sourceDate': source_date, 'sourceAreaDate': source_area_date, 'boundary': countries[0], 'boundaryAreaId': areas[0]['id'], 'countSentinel': counts, 'summary': summary})
        payload = {'source': 'OpenStreetMap', 'sourceUrl': 'https://www.openstreetmap.org/', 'license': 'ODbL 1.0', 'licenseUrl': 'https://opendatacommons.org/licenses/odbl/1-0/', 'attribution': '© OpenStreetMap contributors', 'fetchedAt': metadata['acquiredAt'], 'processedAt': metadata['finishedAt'], 'sourceDate': source_date, 'sourceAreaDate': source_area_date, 'queryComplete': True, 'boundaryRelationId': countries[0]['id'], 'boundaryAreaId': areas[0]['id'], 'querySha256': metadata['querySha256'], 'summary': summary, 'facilities': facilities}
        write_json(ROOT / 'osm-all-baths.json', payload)
        write_json(meta_path, metadata)
        print(json.dumps(summary, ensure_ascii=False), flush=True)
    except Exception as error:
        metadata.update({'finishedAt': now(), 'queryComplete': False, 'error': type(error).__name__ + ': ' + str(error)})
        write_json(meta_path, metadata)
        raise


if __name__ == '__main__':
    main()
