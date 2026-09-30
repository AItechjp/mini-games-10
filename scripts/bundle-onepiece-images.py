#!/usr/bin/env python3
"""Bundle and validate every printing in the Japanese ONE PIECE catalog.

Requires Pillow and aiohttp. Retains source dimensions, resumes from a validated
cache, and changes catalog references only after all image downloads succeed.
"""
import asyncio
import hashlib
import io
import json
from pathlib import Path
import time

import aiohttp
from PIL import Image

ROOT = Path(__file__).resolve().parents[1] / 'onepiece-battle'
ENCODING = 'webp-q88-v1'


def write_json(path, value):
    temp = path.with_suffix('.json.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')))
    temp.replace(path)


def encode(raw, path):
    with Image.open(io.BytesIO(raw)) as picture:
        picture.load()
        if picture.width < 200 or picture.height < 280:
            raise ValueError('Source image is too small')
        picture.save(path.with_suffix('.tmp'), format='WEBP', quality=88, method=4)
    path.with_suffix('.tmp').replace(path)


def inspect(path):
    with Image.open(path) as picture:
        picture.load()
        if picture.width < 200 or picture.height < 280:
            raise ValueError('Invalid cached image dimensions')
        return picture.size


async def main():
    index = json.loads((ROOT / 'catalog.json').read_text())
    parts = {p: json.loads((ROOT / p).read_text()) for p in index['parts']}
    urls = sorted({c['image'] for cards in parts.values() for c in cards})
    target = ROOT / 'art' / 'catalog'
    target.mkdir(parents=True, exist_ok=True)
    semaphore = asyncio.Semaphore(12)
    results, failures = {}, []

    async with aiohttp.ClientSession(trust_env=True, timeout=aiohttp.ClientTimeout(total=40)) as session:
        async def download(url):
            async with semaphore:
                if not url.startswith('https://www.onepiece-cardgame.com/images/cardlist/card/'):
                    failures.append({'url': url, 'error': 'Unexpected source origin'})
                    return
                name = hashlib.sha256((ENCODING + url).encode()).hexdigest()[:24] + '.webp'
                path = target / name
                for attempt in range(3):
                    try:
                        if path.exists():
                            try:
                                size = await asyncio.to_thread(inspect, path)
                            except (OSError, ValueError):
                                path.unlink()
                        if not path.exists():
                            async with session.get(url) as response:
                                response.raise_for_status()
                                raw = await response.read()
                            await asyncio.to_thread(encode, raw, path)
                            size = await asyncio.to_thread(inspect, path)
                        results[url] = {'source': url, 'path': './art/catalog/' + name,
                            'width': size[0], 'height': size[1], 'bytes': path.stat().st_size,
                            'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
                        break
                    except Exception as error:
                        if attempt == 2:
                            failures.append({'url': url, 'error': str(error)})
                        else:
                            await asyncio.sleep(attempt + 1)
                count = len(results) + len(failures)
                if count % 100 == 0 or count == len(urls):
                    print(f'{count}/{len(urls)} images checked; {len(failures)} failures', flush=True)
        await asyncio.gather(*(download(url) for url in urls))
    if failures:
        print(json.dumps(failures, ensure_ascii=False), flush=True)
        raise SystemExit(1)
    for part, cards in parts.items():
        for card in cards:
            card['localImage'] = results[card['image']]['path']
        write_json(ROOT / part, cards)
    coverage = index['coverage']
    coverage['localImages'] = len(results)
    coverage['imageAvailability'] = 'All catalog printing images bundled as WebP at original source dimensions, including parallel and reprint illustrations.'
    coverage['imagesBundledAt'] = time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())
    coverage['bundledImageBytes'] = sum(r['bytes'] for r in results.values())
    write_json(ROOT / 'catalog.json', index)
    write_json(ROOT / 'art' / 'catalog-manifest.json', {
        'sourceCatalogDate': index['fetchedAt'], 'encoding': ENCODING,
        'count': len(results), 'images': [results[url] for url in urls]})
    # Do not publish old cache generations after a catalog or encoding update.
    keep = {Path(r['path']).name for r in results.values()}
    for path in target.glob('*.webp'):
        if path.name not in keep:
            path.unlink()
    print(json.dumps({'images': len(results), 'bytes': coverage['bundledImageBytes']}), flush=True)


if __name__ == '__main__':
    asyncio.run(main())
