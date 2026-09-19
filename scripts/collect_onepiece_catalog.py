#!/usr/bin/env python3
"""Collect published Japanese ONE PIECE card records via the existing public catalog API.

Requires Python 3.10+ and aiohttp. Images remain official remote URLs; no image bytes
are downloaded. Run --help for cache/resume options.
"""
import argparse
import asyncio
import concurrent.futures
import datetime
import json
import pathlib
import re
import threading
import time
import urllib.parse

import aiohttp

ENDPOINT = 'https://dcvtubivtextycifngtk.supabase.co/functions/v1/commons-tcg'
# Publishable browser key already used by commons/card-library/tcg-app.mjs.
PUBLIC_KEY = 'sb_publishable_IcEN-3GgzcLCHiyNLyRiCQ_RpkAhCGI'
SOURCE = 'https://www.onepiece-cardgame.com/cardlist/'
COLOR_NAMES = {'赤': 'red', '緑': 'green', '青': 'blue', '紫': 'purple', '黒': 'black', '黄': 'yellow'}


def write_json(path, value, pretty=False):
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False, indent=2 if pretty else None,
                               separators=None if pretty else (',', ':')), encoding='utf-8')
    temp.replace(path)


def normalize(card, starter_cards):
    c = dict(card)
    c['type'] = c.get('type', '').lower()
    c['nameJa'] = c.get('name', '')
    c['set'] = c.get('set', '').split('\n')[0]
    stats = c.get('stats', '')
    parts = stats.split(' · ')
    c['colors'] = list(dict.fromkeys(re.findall('[赤緑青紫黒黄]', parts[0])))
    feature = parts[1] if len(parts) > 1 and not re.match('コスト|ライフ|パワー', parts[1]) else ''
    c['traits'] = [x for x in feature.split('/') if x and x != '-']
    for key, label in [('cost', 'コスト'), ('life', 'ライフ'), ('power', 'パワー')]:
        match = re.search(label + r'\s*([0-9]+)', stats)
        c[key] = int(match.group(1)) if match else None
    c['counter'] = None
    c['attribute'] = None
    starter = starter_cards.get(c.get('number'))
    if starter:
        for field in ['cost', 'life', 'power', 'counter', 'attribute', 'colors', 'traits', 'trigger']:
            if field in starter:
                c[field] = starter[field]
    c['colorNames'] = c['colors']
    c['colorCodes'] = [COLOR_NAMES[x] for x in c['colors'] if x in COLOR_NAMES]
    c['automaticEffects'] = bool(starter)
    return c


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=pathlib.Path, default=pathlib.Path('onepiece-catalog'),
                        help='Output directory for catalog.json, coverage and reusable page cache.')
    parser.add_argument('--starters', type=pathlib.Path,
                        help='Optional starter-cards.json with verified detailed ST-01/ST-02 stats.')
    parser.add_argument('--workers', type=int, choices=range(1, 5), default=4,
                        help='Concurrent connections, maximum 4 (default: 4).')
    parser.add_argument('--resume', action='store_true',
                        help='Resume the prior snapshot using existing valid page/series cache files.')
    parser.add_argument('--image-manifest', action='store_true',
                        help='Also write a compact image-manifest.json with the discovered image URLs.')
    args = parser.parse_args()
    root = args.output.resolve()
    cache = root / 'api-pages'
    cache.mkdir(parents=True, exist_ok=True)
    starters = {}
    if args.starters:
        raw = json.loads(args.starters.read_text(encoding='utf-8'))
        starters = {c.get('number', c.get('id')): c for c in (raw.values() if isinstance(raw, dict) else raw)}
    local = threading.local()
    connections = []
    lock = threading.Lock()
    last_request = [0.0]

    async def new_session():
        return aiohttp.ClientSession(trust_env=True,
            headers={'apikey': PUBLIC_KEY, 'x-region': 'ap-southeast-2'},
            timeout=aiohttp.ClientTimeout(total=32))

    async def fetch_url(url):
        async with local.session.get(url) as response:
            response.raise_for_status()
            return await response.json()

    def request(params, path):
        if args.resume and path.exists():
            try:
                return json.loads(path.read_text(encoding='utf-8'))
            except (ValueError, OSError):
                pass
        for attempt in range(2):
            with lock:
                delay = max(0, 0.7 - (time.monotonic() - last_request[0]))
                if delay:
                    time.sleep(delay)
                last_request[0] = time.monotonic()
            try:
                if not hasattr(local, 'loop'):
                    local.loop = asyncio.new_event_loop()
                    local.session = local.loop.run_until_complete(new_session())
                    connections.append((local.loop, local.session))
                url = ENDPOINT + '?' + urllib.parse.urlencode({'game': 'onepiece', **params})
                data = local.loop.run_until_complete(fetch_url(url))
                write_json(path, data)
                return data
            except Exception:
                if attempt:
                    raise
                time.sleep(1)

    sets_data = request({'kind': 'sets'}, root / 'series-cache.json')
    sets = sets_data['sets']
    sets.sort(key=lambda s: (s['id'] not in ('550001', '550002'), s['id']))

    def collect_series(series):
        sid = series['id']
        cards, failures = [], []
        total = None
        try:
            first = request({'kind': 'search', 'set': sid, 'page': 1}, cache / f'{sid}-1.json')
            total = first['total']
            size = first['pageSize']
            pages = (total + size - 1) // size
            if pages > 200:
                raise ValueError('Series exceeds the 200-page collection bound.')
            for page in range(1, pages + 1):
                try:
                    data = first if page == 1 else request(
                        {'kind': 'search', 'set': sid, 'page': page}, cache / f'{sid}-{page}.json')
                    expected = min(size, total - (page - 1) * size)
                    if data['total'] != total or len(data['cards']) != expected:
                        raise ValueError('Page count changed or does not match the published series total.')
                    if any(not c.get('name') or not c.get('image', '').startswith(
                            'https://www.onepiece-cardgame.com/') for c in data['cards']):
                        raise ValueError('A card lacks a name or an official source image URL.')
                    cards.extend(data['cards'])
                except Exception as error:
                    failures.append({'page': page, 'error': str(error)})
        except Exception as error:
            failures.append({'page': 1, 'error': str(error)})
        name = series['name'].replace('\n', ' ')
        for c in cards:
            c['seriesId'] = sid
            c['seriesName'] = name
        info = {'id': sid, 'name': name, 'total': total, 'retrieved': len(cards),
                'complete': total is not None and len(cards) == total and not failures,
                'failures': failures}
        write_json(cache / f'set-{sid}.json', {'set': info, 'cards': cards})
        return info, cards

    results, all_cards = [], []

    def save_snapshot():
        printings = {}
        for c in all_cards:
            key = (c['id'], c['image'])
            if key not in printings:
                printings[key] = {**normalize(c, starters), 'seriesIds': [c['seriesId']]}
            elif c['seriesId'] not in printings[key]['seriesIds']:
                printings[key]['seriesIds'].append(c['seriesId'])
        cards = sorted(printings.values(), key=lambda c: (c['number'], c['id'], c['image']))
        coverage = {'seriesTotal': len(sets), 'seriesRetrieved': len(results),
            'seriesComplete': sum(s['complete'] for s in results),
            'sourceListings': sum(s['retrieved'] for s in results), 'printings': len(cards),
            'uniqueCards': len({c['number'] for c in cards}),
            'imageUrls': len({c['image'] for c in cards}), 'localImages': 0,
            'failures': [s for s in results if not s['complete']],
            'complete': len(results) == len(sets) and all(s['complete'] for s in results),
            'scope': 'All published series returned by the official Japanese selector. Includes parallel/reprint and published upcoming cards; does not assert every physical/historical variant.',
            'imageAvailability': 'Actual official image URLs collected. Image bytes are not downloaded by this script.'}
        data = {'fetchedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                'sourceUrl': SOURCE,
                'retrievalMethod': 'Existing public commons-tcg API backed by official Japanese card markup.',
                'coverage': coverage, 'sets': sorted(results, key=lambda s: s['id']), 'cards': cards}
        write_json(root / 'catalog.json', data)
        write_json(root / 'catalog-coverage.json', {k: v for k, v in data.items() if k != 'cards'}, True)
        if args.image_manifest:
            write_json(root / 'image-manifest.json', {'fetchedAt': data['fetchedAt'],
                'sourceUrl': SOURCE, 'coverage': coverage,
                'images': [{'id': c['id'], 'number': c['number'], 'name': c['name'],
                            'url': c['image'], 'sourceUrl': c['sourceUrl'],
                            'seriesIds': c['seriesIds']} for c in cards]})
        return coverage

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
            for future in concurrent.futures.as_completed([pool.submit(collect_series, s) for s in sets]):
                info, cards = future.result()
                results.append(info)
                all_cards.extend(cards)
                coverage = save_snapshot()
                print(f"{len(results)}/{len(sets)} series; {coverage['printings']} printings; "
                      f"{len(coverage['failures'])} failed series", flush=True)
    finally:
        for loop, session in connections:
            loop.run_until_complete(session.close())
            loop.close()
    return 0 if coverage['complete'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
