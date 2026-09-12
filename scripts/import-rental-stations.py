"""Refresh public station names and search identifiers; never copies property listings."""
import concurrent.futures
import datetime
import json
import re
import urllib.parse
import urllib.request
from html.parser import HTMLParser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

class Links(HTMLParser):
    def __init__(self, body):
        super().__init__()
        self.links = []
        self.current = None
        self.feed(body)
    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            self.current = [dict(attrs).get('href', ''), '']
    def handle_data(self, data):
        if self.current is not None:
            self.current[1] += data
    def handle_endtag(self, tag):
        if tag == 'a' and self.current is not None:
            self.links.append(self.current)
            self.current = None

def get(url):
    request = urllib.request.Request(url, headers={'User-Agent': 'AITECH-station-directory/1.0'})
    with urllib.request.urlopen(request, timeout=20) as response:
        return Links(response.read().decode('utf-8'))

lines = {}
for prefecture in ['gifu', 'aichi']:
    url = f'https://suumo.jp/chintai/{prefecture}/ensen/'
    for href, name in get(url).links:
        if re.fullmatch(r'/chintai/' + prefecture + r'/en_[A-Za-z0-9_]+/', href):
            lines['https://suumo.jp' + href] = (prefecture, name.strip())

def read_line(item):
    url, (prefecture, name) = item
    stations = []
    for href, label in get(url).links:
        match = re.match(r'/chintai/' + prefecture + r'/ek_(\d+)/\?(.+)', href)
        if not match:
            continue
        params = urllib.parse.parse_qs(match[2])
        if 'md' in params or 'rn' not in params:
            continue
        code = match[1]
        label = re.sub(r'\s*\([\d,]+\).*$', '', label).strip()
        if not label or len(label) > 35:
            continue
        stations.append({'id': prefecture + '-' + code, 'name': label,
                         'prefecture': prefecture, 'code': code,
                         'line': name, 'ek': params['rn'][0] + code})
    if not stations:
        raise RuntimeError('No station identifiers found: ' + url)
    return stations

by_id = {}
failed = []
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    futures = {pool.submit(read_line, item): item[0] for item in lines.items()}
    for future in concurrent.futures.as_completed(futures):
        try:
            for station in future.result():
                row = by_id.setdefault(station['id'], {k:v for k,v in station.items() if k not in ('line','ek')})
                row.setdefault('lines', {})[station['line']] = station['ek']
        except Exception as error:
            failed.append({'url': futures[future], 'error': str(error)})

if failed:
    print(json.dumps({'failed': failed}, ensure_ascii=False))
    raise SystemExit('Incomplete station refresh; no published data overwritten')
data = {'updatedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'source': 'SUUMO 沿線・駅検索', 'sourceUrls': list(lines),
        'coverage': 'SUUMOの岐阜県・愛知県の沿線選択ページに掲載された路線の駅。募集物件の全量データではありません。',
        'lineCount': len(lines), 'stations': sorted(by_id.values(), key=lambda row: (row['prefecture'], row['name']))}
target = ROOT / 'commons/search/stations.json'
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')))
print(json.dumps({'stations':len(by_id), 'lines':len(lines), 'byPrefecture': {p:sum(s['prefecture']==p for s in by_id.values()) for p in ['gifu','aichi']}}))
