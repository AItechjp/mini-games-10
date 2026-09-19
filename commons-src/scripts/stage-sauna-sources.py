"""Adapt acquired source files for assemble-sauna-inventory.py.

Input files are the outputs of the collectors documented in docs/sauna-data.md.
Only these explicit inputs are processed; never silently use a partial response.
"""
import argparse
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
for key in ['osm', 'registry', 'unions', 'chains', 'chain-coverage']:
    parser.add_argument('--'+key, type=pathlib.Path, required=True)
args = parser.parse_args()
target = ROOT/'data/sauna-sources'
target.mkdir(exist_ok=True)


def load(path):
    return json.loads(path.read_text())


def save(name, data):
    (target/(name+'.json')).write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':'))+'\n')


osm = load(args.osm)
assert osm['queryComplete'] and all(r['prefecture'] for r in osm['facilities'])
osm['sourceKind'] = 'osm'
osm['sources'] = [{'name': 'OpenStreetMap 日本全国', 'url': 'https://www.openstreetmap.org/copyright', 'count': len(osm['facilities']), 'withHours': osm['summary']['hoursWithExplicitTime'], 'license': 'ODbL 1.0 / © OpenStreetMap contributors', 'sourceDate': osm['sourceDate'], 'scope': '日本の行政境界内にあるサウナ・浴場タグを全件取得。OSM未登録施設は含まない。足湯等・休廃業は統合時に対象外。', 'collectionComplete': True}]
save('osm', osm)

registry = load(args.registry)
registry['sourceKind'] = 'registry'
registry['sources'] = [{'name': s['prefecture']+' '+s['city']+' '+s['title'], 'url': s['sourceUrl'], 'count': s['inputRows'], 'withHours': s['hoursPresentCount'], 'license': s['license'], 'sourceDate': s['sourceDataDate'] or '', 'catalogUpdatedAt': s['sourceUpdatedAt'], 'scope': s['scope'], 'collectionComplete': s['collectionComplete'], 'sourceDataUrl': s['sourceDataUrl'], 'excludedCount': s['excludedCount']} for s in registry['sourceCoverage']]
registry['upstreamExcludedCount'] = registry['counts']['excluded']
assert all(s['collectionComplete'] for s in registry['sources'])
save('registry', registry)

unions = load(args.unions)
assert len(unions['facilities']) == unions['metadata']['recordCount']
unions['sourceKind'] = 'official'
unions['fetchedAt'] = unions['metadata']['fetchedAt']
unions['sources'] = [{'name': s['name'], 'url': s['url'], 'count': s['collectedCount'], 'withHours': s['collectedCount'], 'license': '公開されている営業事実のみ。紹介文・写真は収録しない。', 'sourceDate': '', 'scope': s['scope'], 'collectionComplete': s['completeWithinSource'], 'listedCount': s['listedCount']} for s in unions['metadata']['sources']]
assert sum(s['count'] for s in unions['sources']) == len(unions['facilities'])
assert all(s['collectionComplete'] and s['count'] == s['listedCount'] for s in unions['sources'])
save('unions', unions)

chain_rows, chain_coverage = load(args.chains), load(args.chain_coverage)
assert len(chain_rows) == chain_coverage['acquiredFacilityCount']
for row in chain_rows:
    row['fetchedAt'] = row['metadata']['fetchedAt']
    row['otherSources'] = [{'name': row['sourceName'], 'url': url} for url in row.get('sourceUrls', []) if url != row['sourceUrl']]
chains = {'sourceKind': 'official', 'fetchedAt': chain_coverage['fetchedAt'], 'coverage': chain_coverage, 'facilities': chain_rows, 'sources': [{'name': s['name'], 'url': s['sourceUrl'], 'count': s['acquiredFacilityCount'], 'withHours': s['acquiredFacilityCount'], 'license': '施設が公表する営業時間・所在地等の事実情報', 'sourceDate': '', 'scope': s['scope']+f" 取得 {s['acquiredFacilityCount']}/{s['listedFacilityCount']}施設。"+('保留あり。' if s['missingFacilityCount'] else ''), 'collectionComplete': s['missingFacilityCount'] == 0, 'listedCount': s['listedFacilityCount']} for s in chain_coverage['chains']]}
save('chains', chains)
print('Staged OSM, registry, union and operator sources.')
