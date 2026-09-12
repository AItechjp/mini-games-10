#!/usr/bin/env python3
"""Import attributed public Tor measurements. Does not probe onion services.

Usage: python scripts/import-onion-status.py INPUT.md --sha GITHUB_BLOB_SHA
INPUT must be the complete README.md fetched from alecmuffett/real-world-onion-sites.
Only the derived snapshot is shipped; titles, URLs, and factual measurements are
attributed to the original CC BY-SA dataset. Never infer uptime from publication.
"""
import argparse
import base64
import hashlib
import html
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
SOURCE = 'https://github.com/alecmuffett/real-world-onion-sites'
CATEGORIES = {
    'Blogs': 'ブログ', 'Civil Society and Community': '団体・コミュニティ',
    'Education': '教育', 'Government': '公的機関', 'News': 'ニュース',
    'News BBC World Service': 'ニュース', 'News Deutsche Welle World': 'ニュース',
    'News RFERL & VOA': 'ニュース', 'Search Engines': '検索',
    'Social Networks': 'SNS', 'Tech and Software': '技術・ソフトウェア',
    'Web and Internet': 'Webサービス', 'SecureDrop': '情報提供窓口',
}

def valid_onion(value):
    try:
        p = urlsplit(value)
        if p.scheme not in ('http', 'https') or p.username or p.password:
            return False
        host = p.hostname or ''
        if not re.fullmatch(r'(?:[a-z0-9-]+\.)*[a-z2-7]{56}\.onion', host):
            return False
        raw = base64.b32decode(host.split('.')[-2].upper())
        return raw[-1] == 3 and raw[32:34] == hashlib.sha3_256(b'.onion checksum' + raw[:32] + raw[-1:]).digest()[:2]
    except (ValueError, TypeError):
        return False

def classify(code, exit_code):
    # 9xx values are RWOS diagnostic codes, not HTTP responses.
    if exit_code != 0 or not 200 <= code < 600:
        return 'unreachable'
    return 'online' if code < 300 else 'redirect' if code < 400 else 'restricted' if code < 500 else 'error'

def safe_proof(value):
    try:
        p = urlsplit(html.unescape(value))
        return value if p.scheme == 'https' and p.hostname and not p.username and not p.password else None
    except ValueError:
        return None

def parse_document(document):
    category = ''
    entries = {}
    invalid = []
    for part in re.split(r'(?=^##(?:#)? )', document, flags=re.M):
        if part.startswith('## '):
            category = part.splitlines()[0][3:].strip()
            continue
        if not part.startswith('### ') or category not in CATEGORIES:
            continue
        title = re.match(r'### \[(.*?)\]\((https?://[^\s)]+)\)', part)
        if not title:
            continue
        name, url = html.unescape(title[1]), html.unescape(title[2])
        if not valid_onion(url):
            invalid.append(name)
            continue
        checks = []
        for attempt, code, exit_code, when in re.findall(r'title="attempts=(\d+) code=(\d+) exit=(\d+) time=([^"<>]+)"', part):
            try:
                date = datetime.fromisoformat(when)
                if date.tzinfo is None:
                    continue
                at = date.astimezone(timezone.utc).isoformat().replace('+00:00', 'Z')
                code, exit_code = int(code), int(exit_code)
                checks.append({'at': at, 'status': classify(code, exit_code), 'httpStatus': code if 100 <= code < 600 else None, 'exitCode': exit_code, 'attempts': int(attempt)})
            except ValueError:
                continue
        checks.sort(key=lambda x: x['at'], reverse=True)
        latest = checks[0] if checks else None
        proof = re.search(r'^\* proof: \[link\]\(([^\s)]+)\)', part, re.M)
        entry = {
            'id': hashlib.sha256(url.encode()).hexdigest()[:20], 'name': name,
            'category': category, 'categoryLabel': CATEGORIES[category], 'url': url,
            'host': urlsplit(url).hostname, 'proofUrl': safe_proof(proof[1]) if proof else None,
            'sourceUrl': SOURCE, 'status': latest['status'] if latest else 'unverified',
            'checkedAt': latest['at'] if latest else None,
            'httpStatus': latest['httpStatus'] if latest else None,
            'lastSuccessAt': next((x['at'] for x in checks if x['status'] in ('online', 'redirect')), None),
            'history': checks[:14],
        }
        entries[url] = entry
    return list(entries.values()), invalid

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('--sha', required=True)
    parser.add_argument('--imported-at', help='Actual retrieval timestamp, UTC ISO-8601')
    parser.add_argument('--output', type=Path, default=ROOT / 'data/onion-snapshot.json')
    args = parser.parse_args()
    document = args.input.read_text(encoding='utf-8')
    # Check complete connector bytes against GitHub's git-blob SHA; refuse a
    # truncated fetch or a transcription error before replacing valid data.
    raw = document.encode('utf-8')
    actual_sha = hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()
    if actual_sha != args.sha:
        raise SystemExit('Source blob SHA mismatch; previous snapshot preserved.')
    sites, invalid = parse_document(document)
    if len(sites) < 50 or not any(s['checkedAt'] for s in sites):
        raise SystemExit('Incomplete/unrecognized source; previous snapshot preserved.')
    if args.output.exists():
        previous = json.loads(args.output.read_text())
        if len(sites) < len(previous.get('sites', [])) * .7:
            raise SystemExit('Unexpected source shrinkage; previous snapshot preserved.')
    imported = args.imported_at or datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')
    # Parse to reject malformed timestamps supplied by callers.
    dt = datetime.fromisoformat(imported.replace('Z', '+00:00'))
    if not dt.tzinfo:
        raise SystemExit('Import timestamp must have a timezone.')
    snapshot = {
        'schemaVersion': 1, 'importedAt': imported,
        'sourceUpdatedAt': max(s['checkedAt'] for s in sites if s['checkedAt']),
        'source': {'name': 'Real-World Onion Sites', 'url': SOURCE, 'blobSha': args.sha,
                   'author': 'Alec Muffett', 'license': 'CC BY-SA',
                   'licenseUrl': SOURCE + '/blob/master/01-preamble.md'},
        'schedule': {'timezone': 'Asia/Tokyo', 'hour': 0, 'minute': 0, 'enabled': False},
        'sites': sorted(sites, key=lambda s: (s['categoryLabel'], s['name'].casefold())),
    }
    # Preserve schedule state when a registered daily task already exists.
    if args.output.exists():
        snapshot['schedule']['enabled'] = bool(previous.get('schedule', {}).get('enabled'))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    temp = args.output.with_suffix('.tmp')
    temp.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    temp.replace(args.output)
    print(json.dumps({'sites': len(sites), 'excludedInvalidAddresses': invalid,
                      'importedAt': imported, 'sourceUpdatedAt': snapshot['sourceUpdatedAt'],
                      'statuses': {k: sum(s['status'] == k for s in sites) for k in sorted(set(s['status'] for s in sites))}}, ensure_ascii=False))

if __name__ == '__main__':
    main()
