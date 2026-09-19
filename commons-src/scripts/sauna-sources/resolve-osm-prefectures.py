#!/usr/bin/env python3
"""Resolve polygon misses from explicit OSM addresses or current OSM admin areas.

Uses no nearest-prefecture or language/location inference. All point lookups
must have their explicit marker plus a final completion marker in the response.
Run in the directory containing osm-all-baths.json and japan-prefectures.geojson.
"""
import datetime
import hashlib
import json
import pathlib
import re
import urllib.parse
import urllib.request

ROOT = pathlib.Path('.')
data = json.loads((ROOT / 'osm-all-baths.json').read_text())
polygons = json.loads((ROOT / 'japan-prefectures.geojson').read_text())
codes = {f['properties']['nam_ja']: str(f['properties']['id']).zfill(2) for f in polygons['features']}
names = {code: name for name, code in codes.items()}
missing = [f for f in data['facilities'] if not f.get('prefecture')]
overrides = {}
pending = []
for f in missing:
    direct = []
    for key in ['addr:province', 'addr:state', 'addr:full']:
        value = f['tags'].get(key, '')
        for name, code in codes.items():
            if value == name or key == 'addr:full' and value.startswith(name):
                direct.append((name, code, key))
    if direct and len({x[0] for x in direct}) == 1:
        name, code, key = direct[0]
        overrides[f['id']] = {'lat': f['lat'], 'lon': f['lon'], 'prefecture': name, 'prefectureCode': code, 'prefectureSource': 'OSM explicit ' + key, 'sourceUrl': f['sourceUrl'], 'sourceDate': data['sourceDate']}
    else:
        pending.append(f)
query = '[out:json][timeout:60];\n'
for f in pending:
    query += 'make lookup facilityId=' + json.dumps(f['id']) + ';out;\n'
    query += f'is_in({f["lat"]},{f["lon"]})->.containing;\n'
    query += 'area.containing["boundary"="administrative"]["admin_level"="4"]["ISO3166-2"~"^JP-"];out tags;\n'
query += 'make lookup facilityId="__complete__";out;\n'
(ROOT / 'osm-prefecture-lookups.overpassql').write_text(query)
endpoint = 'https://overpass-api.de/api/interpreter'
req = urllib.request.Request(endpoint, data=urllib.parse.urlencode({'data': query}).encode(), headers={'User-Agent': 'CommonsSaunaNow/1.0 (OpenStreetMap data import)', 'Accept': 'application/json'})
with urllib.request.urlopen(req, timeout=100) as response:
    raw = response.read()
(ROOT / 'osm-prefecture-lookups-raw.json').write_bytes(raw)
result = json.loads(raw)
assert not result.get('remark'), result.get('remark')
elements = result['elements']
assert elements[-1].get('tags', {}).get('facilityId') == '__complete__', 'Missing final completion marker'
markers = [x['tags']['facilityId'] for x in elements if x['type'] == 'lookup']
assert markers == [f['id'] for f in pending] + ['__complete__'], 'Marker sequence mismatch'
by_id = {f['id']: f for f in pending}
current = None
matches = {}
for item in elements:
    if item['type'] == 'lookup':
        current = item['tags']['facilityId']
        matches[current] = []
    else:
        assert item['type'] == 'area' and current in by_id
        tags = item['tags']
        assert re.fullmatch('JP-\\d{2}', tags.get('ISO3166-2', '')) and tags.get('admin_level') == '4'
        matches[current].append(item)
for ident, areas in matches.items():
    if ident == '__complete__' or len(areas) != 1:
        continue
    f = by_id[ident]
    area = areas[0]
    code = area['tags']['ISO3166-2'][3:]
    overrides[ident] = {'lat': f['lat'], 'lon': f['lon'], 'prefecture': names[code], 'prefectureCode': code, 'prefectureSource': 'OSM current administrative area point containment', 'sourceUrl': 'https://www.openstreetmap.org/relation/' + str(area['id'] - 3600000000), 'sourceDate': result['osm3s'].get('timestamp_areas_base'), 'areaId': area['id']}
payload = {'fetchedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'sourceDate': result['osm3s']['timestamp_osm_base'], 'sourceAreaDate': result['osm3s'].get('timestamp_areas_base'), 'queryComplete': True, 'endpoint': endpoint, 'query': query, 'responseSha256': hashlib.sha256(raw).hexdigest(), 'summary': {'initialUnassigned': len(missing), 'explicitAddress': len(missing) - len(pending), 'areaLookups': len(pending), 'resolved': len(overrides), 'unresolved': [f['id'] for f in missing if f['id'] not in overrides]}, 'overrides': overrides}
(ROOT / 'osm-prefecture-overrides.json').write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(payload['summary'], ensure_ascii=False), flush=True)
