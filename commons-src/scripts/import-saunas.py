"""Import complete Overpass responses; retain unknown hours and unnamed records.

Usage: python scripts/import-saunas.py BOUNDARIES.json DIRECT.json SOUTH.json CENTRAL.json NORTH.json
DIRECT covers leisure=sauna in (20,122,46,154). The other responses cover
sauna=yes over the same bounds, partitioned at 35 and 40 degrees latitude.
Input errors, Overpass remarks, and missing coverage fail before writing output.
"""
import datetime
import json
import pathlib
import sys

root = pathlib.Path(__file__).resolve().parents[1]
if len(sys.argv) != 6:
    raise SystemExit(__doc__)
boundary = json.loads(pathlib.Path(sys.argv[1]).read_text())
polygons = []
for feature in boundary['features']:
    coords = feature['geometry']['coordinates']
    if feature['geometry']['type'] == 'Polygon':
        coords = [coords]
    for polygon in coords:
        xs, ys = zip(*polygon[0])
        polygons.append((min(xs), min(ys), max(xs), max(ys), polygon, feature['properties']))

def in_ring(x, y, ring):
    inside, previous = False, len(ring)-1
    for index, (xi, yi) in enumerate(ring):
        xj, yj = ring[previous]
        if (yi > y) != (yj > y) and x < (xj-xi)*(y-yi)/(yj-yi)+xi:
            inside = not inside
        previous = index
    return inside

def locate(lon, lat):
    for left, bottom, right, top, polygon, props in polygons:
        if left <= lon <= right and bottom <= lat <= top and in_ring(lon, lat, polygon[0]) and not any(in_ring(lon, lat, hole) for hole in polygon[1:]):
            return props
    return None

def url(value):
    if not value:
        return ''
    if value.startswith(('http://', 'https://')):
        return value
    return 'https://'+value if '.' in value and ' ' not in value and ':' not in value else ''

elements, dates = {}, []
for name in sys.argv[2:]:
    data = json.loads(pathlib.Path(name).read_text())
    assert not data.get('remark'), f'Incomplete upstream response: {name}'
    assert isinstance(data.get('elements'), list), f'Invalid response: {name}'
    dates.append(data['osm3s']['timestamp_osm_base'])
    for item in data['elements']:
        elements[f"{item['type']}/{item['id']}"] = item

facilities, outside, inactive = [], 0, 0
for ident, item in elements.items():
    tags, point = item.get('tags', {}), item.get('center', item)
    assert 'lat' in point and 'lon' in point, f'Missing coordinates: {ident}'
    prefecture = locate(point['lon'], point['lat'])
    if not prefecture:
        # Keep Japanese records near new coastal developments even when the
        # older boundary does not contain them. Do not guess a prefecture.
        near_japan = any(left-.02 <= point['lon'] <= right+.02 and bottom-.02 <= point['lat'] <= top+.02 for left,bottom,right,top,_,_ in polygons)
        japanese = near_japan and (tags.get('addr:country') == 'JP' or tags.get('name:ja') or any('\u3040' <= c <= '\u30ff' for c in tags.get('name', '')))
        if not japanese:
            outside += 1
            continue
    if any(tags.get(key) == 'yes' for key in ['disused', 'abandoned', 'demolished']) or tags.get('sauna') in ['no', 'none', 'closed']:
        inactive += 1
        continue
    hours = tags.get('opening_hours:sauna') or tags.get('sauna:opening_hours') or tags.get('opening_hours', '')
    pref = prefecture['nam_ja'] if prefecture else ''
    address = tags.get('addr:full') or ''.join(dict.fromkeys(tags.get(key, '') for key in ['addr:province','addr:state','addr:city','addr:suburb','addr:quarter','addr:neighbourhood','addr:street','addr:block_number','addr:housenumber'] if tags.get(key)))
    kind = '温浴施設' if tags.get('amenity') in ['public_bath','bathhouse'] else '宿泊施設' if tags.get('tourism') in ['hotel','hostel','guest_house','motel'] else 'スポーツ施設' if tags.get('leisure') in ['fitness_centre','sports_centre'] else 'サウナ'
    facilities.append({
        'id':ident, 'name':tags.get('name:ja') or tags.get('name') or '名称未登録',
        'prefecture':pref, 'prefectureCode':str(prefecture['id']).zfill(2) if prefecture else '',
        'address':address, 'lat':point['lat'], 'lon':point['lon'], 'hours':hours,
        'hoursScope':'sauna' if tags.get('opening_hours:sauna') or tags.get('sauna:opening_hours') else 'facility',
        'website':url(tags.get('website') or tags.get('contact:website', '')),
        'phone':tags.get('phone') or tags.get('contact:phone', ''),
        'access':tags.get('sauna:access') or tags.get('access', ''), 'kind':kind,
        'note':tags.get('opening_hours:description', ''),
        'sourceUrl':'https://www.openstreetmap.org/'+ident,
        'checkedOn':tags.get('check_date:opening_hours', ''),
    })

facilities.sort(key=lambda f:(f['prefectureCode'] or '99',f['name'],f['id']))
snapshot = {
    'fetchedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'sourceDate':min(dates), 'source':'OpenStreetMap',
    'sourceUrl':'https://www.openstreetmap.org/', 'license':'ODbL 1.0',
    'licenseUrl':'https://opendatacommons.org/licenses/odbl/1-0/',
    'queryComplete':True, 'rawCount':len(elements),
    'excludedOutsideJapan':outside, 'excludedInactive':inactive,
    'facilities':facilities,
}
assert len({f['id'] for f in facilities}) == len(facilities)
assert len(facilities) + outside + inactive == len(elements)
assert facilities, 'Refusing an empty publication'
payload=json.dumps(snapshot, ensure_ascii=False, separators=(',',':'))+'\n'
(root/'data/sauna-snapshot.json').write_text(payload)
(root/'public/sauna-data.json').write_text(payload)
print(json.dumps({'facilities':len(facilities),'hours':sum(bool(f['hours']) for f in facilities),'prefectures':len({f['prefecture'] for f in facilities if f['prefecture']}),'outsideJapan':outside,'inactive':inactive,'sourceDate':min(dates)},ensure_ascii=False))
