#!/usr/bin/env python3
"""Collect a bounded, attributed index of Japanese official information.

Only Python's standard library is used. No document text is republished.
Usage: python scripts/collect_official_info.py --sources sources.json --output-dir data
"""
from __future__ import annotations

import argparse
import concurrent.futures
import csv
from datetime import date, datetime, timedelta, timezone
import hashlib
from html.parser import HTMLParser
import ipaddress
import io
import json
import os
from pathlib import Path
import re
import socket
import sys
import threading
import time
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener, getproxies, proxy_bypass
import xml.etree.ElementTree as ET
import zipfile

UTC = timezone.utc
JST = timezone(timedelta(hours=9))
MAX_BYTES = 8 * 1024 * 1024
MAX_ZIP_BYTES = 32 * 1024 * 1024
TIMEOUT = 15
USER_AGENT = 'AItech-Official-Information-Index/1.0 (+https://aitechd.com/)'
DEFAULT_HOST_SUFFIXES = ('.go.jp', '.lg.jp')
DOCUMENT_EXTENSIONS = ('.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.csv', '.zip', '.txt', '.xml')
UNWANTED_EXTENSIONS = ('.jpg', '.jpeg', '.png', '.gif', '.svg', '.css', '.js', '.ico', '.mp4', '.mp3', '.woff', '.woff2')
NAV_TEXT = re.compile(r'^(?:ホーム|トップ(?:ページ)?|ページ(?:の)?先頭(?:へ)?|サイトマップ|お問い合わせ|お問合せ|アクセス|アクセス(?:マップ|情報)|交通案内|採用(?:情報|案内|試験)?|調達(?:情報)?|入札(?:情報|公告)?|組織(?:案内|情報|図)?|リンク集|検索|English|ENGLISH|日本語|プライバシーポリシー|著作権|免責事項|利用規約|このページを印刷|印刷|戻る|前へ|次へ|文字サイズ|大|中|小|本文へ|メニュー|SNS|Facebook|X|Twitter|YouTube|RSS)$', re.I)
BILL_TITLE = re.compile(r'法律|法案|議案|国会|条約|政令|予算|決算|憲法|内閣法制局|決議|承認|同意|承諾|請願|審議|審査')
GENERIC_DOCUMENT_TITLE = re.compile(r'^(?:本文|概要|要旨|目次|資料|報告書|全体版|一括版)(?:[（(]?PDF[)）]?)?$', re.I)
NAV_CLASS = re.compile(r'(?:^|[-_\s])(?:nav|gnav|menu|breadcrumb|footer|header|social)(?:$|[-_\s])', re.I)
INDEX_TEXT = re.compile(r'一覧|目次|バックナンバー|過去の|トップ|審議会等|会議等|資料集|白書等')
DATE_PATTERN = re.compile(r'(?<!\d)(20\d{2})[年/.-](\d{1,2})[月/.-](\d{1,2})(?:日)?(?!\d)')
ERA_PATTERN = re.compile(r'(令和|平成|昭和|大正|明治)(元|[〇零一二三四五六七八九十百\d]{1,5})年\s*([〇零一二三四五六七八九十\d]{1,3})月\s*([〇零一二三四五六七八九十\d]{1,3})日')
DATE_LABEL = re.compile(r'(?:案の公示日|結果の公示日|公表日|公開日|掲載日|発行日|更新日|開催日|開催日時)\s*[：:]?\s*((?:20\d{2}[年/.-]\d{1,2}[月/.-]\d{1,2}日?)|(?:(?:令和|平成)(?:元|\d{1,2})年\s*\d{1,2}月\s*\d{1,2}日))')


def now_iso():
    return datetime.now(UTC).isoformat(timespec='seconds').replace('+00:00', 'Z')


def clean_text(value):
    return re.sub(r'\s+', ' ', value or '').strip()


def japanese_number(value):
    if value == '元':
        return 1
    if value.isascii() and value.isdigit():
        return int(value)
    digits = {'〇': 0, '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9}
    if '十' not in value and '百' not in value:
        return int(''.join(str(digits[c]) for c in value))
    total, current = 0, 0
    for char in value:
        if char in ('十', '百'):
            total += (current or 1) * (10 if char == '十' else 100)
            current = 0
        else:
            current = digits[char]
    return total + current


def parse_date(value):
    """Parse an explicit day; a year, fiscal year, deadline, or issue is not a date."""
    value = clean_text(value)
    match = DATE_PATTERN.search(value)
    if match:
        parts = tuple(map(int, match.groups()))
    else:
        match = ERA_PATTERN.search(value)
        if not match:
            return None
        era, year, month, day = match.groups()
        parts = ({'令和': 2018, '平成': 1988, '昭和': 1925, '大正': 1911, '明治': 1867}[era] + japanese_number(year), japanese_number(month), japanese_number(day))
    try:
        return date(*parts).isoformat()
    except ValueError:
        return None


def publication_date(text):
    """Only dates explicitly labelled as publication-related become publishedAt."""
    match = re.search(r'(?:案の公示日|結果の公示日|公表日|公開日|掲載日|発行日)\s*[：:]?\s*((?:20\d{2}[年/.-]\d{1,2}[月/.-]\d{1,2}日?)|(?:(?:令和|平成)(?:元|\d{1,2})年\s*\d{1,2}月\s*\d{1,2}日))', text or '')
    return parse_date(match.group(1)) if match else None


def normalize_url(url, base=None, allowed_hosts=(), resolve=False):
    """Validate every request and redirect; never accept local/private destinations."""
    if not isinstance(url, str) or re.search(r'[\x00-\x20\x7f\\]', url):
        raise ValueError('URL contains whitespace, a control character, or a backslash')
    parsed = urlsplit(urljoin(base, url) if base else url)
    if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('Only public HTTP(S) URLs without credentials are allowed')
    host = parsed.hostname.rstrip('.').encode('idna').decode('ascii').lower()
    if parsed.port not in (None, 80, 443):
        raise ValueError('Nonstandard destination ports are not allowed')
    try:
        ipaddress.ip_address(host)
    except ValueError:
        pass
    else:
        raise ValueError('IP-literal URLs are not allowed')
    exact = {h.lower().rstrip('.') for h in allowed_hosts}
    if not (host.endswith(DEFAULT_HOST_SUFFIXES) or host in exact):
        raise ValueError('Destination hostname is not on the official-source allowlist')
    if host in ('localhost', 'localhost.localdomain') or host.endswith(('.localhost', '.local', '.internal')):
        raise ValueError('Local destinations are not allowed')
    if resolve:
        try:
            addresses = socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == 'https' else 80), type=socket.SOCK_STREAM)
        except socket.gaierror:
            # Managed egress environments deliberately provide proxy-side DNS.
            # Delegate only an unresolved, allowlisted hostname to an already
            # configured transport proxy; never accept a private DNS answer.
            if not getproxies().get(parsed.scheme) or proxy_bypass(host):
                raise
        else:
            if not addresses or any(not ipaddress.ip_address(item[4][0]).is_global for item in addresses):
                raise ValueError('Destination resolves to a nonpublic address')
    query = urlencode([(k, v) for k, v in parse_qsl(parsed.query, keep_blank_values=True) if not k.lower().startswith('utm_') and k.lower() not in ('fbclid', 'gclid')], doseq=True)
    return urlunsplit((parsed.scheme, host, parsed.path or '/', query, ''))


class CheckedRedirect(HTTPRedirectHandler):
    def __init__(self, allowed_hosts):
        super().__init__()
        self.allowed_hosts = allowed_hosts

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        checked = normalize_url(newurl, req.full_url, self.allowed_hosts, resolve=True)
        return super().redirect_request(req, fp, code, msg, headers, checked)


class Fetcher:
    def __init__(self, allowed_hosts=(), timeout=TIMEOUT):
        self.allowed_hosts = tuple(allowed_hosts)
        self.timeout = timeout
        self.kokkai_lock = threading.Lock()
        self.kokkai_completed = 0.0

    def get(self, url):
        checked = normalize_url(url, allowed_hosts=self.allowed_hosts, resolve=True)
        if urlsplit(checked).hostname == 'kokkai.ndl.go.jp':
            with self.kokkai_lock:
                delay = 3.1 - (time.monotonic() - self.kokkai_completed)
                if delay > 0:
                    time.sleep(delay)
                try:
                    return self._get(checked)
                finally:
                    self.kokkai_completed = time.monotonic()
        return self._get(checked)

    def _get(self, url):
        req = Request(url, headers={'User-Agent': USER_AGENT, 'Accept': 'text/html,application/json,application/rss+xml,application/xml;q=0.9,*/*;q=0.5', 'Accept-Encoding': 'identity'})
        with build_opener(CheckedRedirect(self.allowed_hosts)).open(req, timeout=self.timeout) as response:
            length = response.headers.get('Content-Length')
            if length and int(length) > MAX_BYTES:
                raise ValueError('Response exceeds the 8 MiB limit')
            raw = response.read(MAX_BYTES + 1)
            if len(raw) > MAX_BYTES:
                raise ValueError('Response exceeds the 8 MiB limit')
            content_type = response.headers.get('Content-Type', '')
            encoding = response.headers.get_content_charset()
            if not encoding:
                match = re.search(br'charset\s*=\s*[\"\']?([A-Za-z0-9_-]+)', raw[:4096], re.I)
                encoding = match.group(1).decode('ascii') if match else None
            for candidate in dict.fromkeys([encoding, 'utf-8', 'cp932', 'euc_jp']):
                if not candidate:
                    continue
                try:
                    return raw.decode(candidate), response.geturl(), content_type
                except (UnicodeDecodeError, LookupError):
                    continue
            return raw.decode('utf-8', errors='replace'), response.geturl(), content_type

    def get_binary(self, url, max_bytes=MAX_ZIP_BYTES):
        """Bounded ZIP transfer; archives are inspected in memory, never extracted."""
        checked = normalize_url(url, allowed_hosts=self.allowed_hosts, resolve=True)
        req = Request(checked, headers={'User-Agent': USER_AGENT, 'Accept': 'application/zip,*/*;q=0.5', 'Accept-Encoding': 'identity'})
        with build_opener(CheckedRedirect(self.allowed_hosts)).open(req, timeout=max(self.timeout, 30)) as response:
            length = response.headers.get('Content-Length')
            if length and int(length) > max_bytes:
                raise ValueError('Archive exceeds the 32 MiB limit')
            raw = response.read(max_bytes + 1)
            if len(raw) > max_bytes:
                raise ValueError('Archive exceeds the 32 MiB limit')
            return raw, response.geturl(), response.headers.get('Content-Type', '')


class IndexParser(HTMLParser):
    """Capture every eligible anchor, preserving explicit table-column semantics."""
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.title = ''
        self.links = []
        self.meta_refresh = None
        self.stack = []
        self.anchor = None
        self.in_title = False
        self.row = None
        self.cell = None
        self.table_headers = []
        self.rows = []

    @property
    def excluded(self):
        return any(excluded for _, excluded in self.stack)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        excluded = tag in ('script', 'style', 'noscript', 'nav', 'header', 'footer', 'aside') or attrs.get('aria-hidden') == 'true' or 'hidden' in attrs or bool(NAV_CLASS.search(attrs.get('class', '') + ' ' + attrs.get('id', '')))
        if tag not in ('area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'):
            self.stack.append((tag, excluded))
        if tag == 'title':
            self.in_title = True
        if tag == 'meta' and attrs.get('http-equiv', '').lower() == 'refresh':
            match = re.search(r'url\s*=\s*[\"\']?([^\"\']+)', attrs.get('content', ''), re.I)
            if match:
                self.meta_refresh = match.group(1).strip()
        if tag == 'table':
            self.table_headers = []
        if tag == 'tr':
            self.row = {'cells': [], 'links': [], 'headers': list(self.table_headers)}
        if tag in ('td', 'th') and self.row is not None:
            self.cell = {'text': '', 'header': tag == 'th', 'links': []}
        if tag == 'a' and attrs.get('href') and not self.excluded:
            if self.anchor:
                self._finish_anchor()
            self.anchor = {'href': attrs['href'], 'text': '', 'hint': attrs.get('title', ''), 'row': self.row}
        if tag == 'img' and self.anchor and not self.excluded:
            self.anchor['text'] += ' ' + attrs.get('alt', '')

    def handle_data(self, data):
        if self.in_title:
            self.title += data
        if self.excluded:
            return
        if self.anchor:
            self.anchor['text'] += data
        if self.cell is not None:
            self.cell['text'] += data

    def _finish_anchor(self):
        if self.anchor:
            link = self.anchor
            self.anchor = None
            link['text'] = clean_text(link['text']) or clean_text(link['hint'])
            self.links.append(link)
            if self.row is not None:
                self.row['links'].append(link)
            if self.cell is not None:
                self.cell['links'].append(link)

    def handle_endtag(self, tag):
        if tag == 'a':
            self._finish_anchor()
        if tag == 'title':
            self.in_title = False
        if tag in ('td', 'th') and self.row is not None and self.cell is not None:
            self.cell['text'] = clean_text(self.cell['text'])
            self.row['cells'].append(self.cell)
            self.cell = None
        if tag == 'tr' and self.row is not None:
            texts = [cell['text'] for cell in self.row['cells']]
            if any('審議状況' in text for text in texts) and any('議案件名' in text or '件名' == text for text in texts):
                self.table_headers = texts
            self.rows.append(self.row)
            self.row = None
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index][0] == tag:
                del self.stack[index:]
                break

    def close(self):
        super().close()
        self._finish_anchor()
        self.title = clean_text(self.title)


def make_record(source, title, url, fetched_at, **extra):
    record = {'id': hashlib.sha256(url.encode()).hexdigest()[:20], 'title': clean_text(title), 'url': url, 'kind': source.get('kind', 'portal'), 'organization': source.get('organization', source.get('name', '')), 'publishedAt': None, 'fetchedAt': fetched_at, 'sourceId': source['id'], 'sourceIds': [source['id']], 'sourceName': source.get('name', ''), 'sourceUrl': source['url'], 'sourceUrls': [source['url']], 'recordType': 'page', 'status': None}
    record.update(extra)
    return record


def bill_context(link):
    row = link.get('row')
    if not row:
        return {}
    headers = row.get('headers', [])
    cells = row.get('cells', [])
    values = {}
    for index, header in enumerate(headers):
        if index < len(cells):
            values[header] = cells[index]['text']
    title_key = next((key for key in values if '議案件名' in key or key == '件名'), None)
    status_key = next((key for key in values if '審議状況' in key), None)
    if not title_key or not status_key:
        return {}
    return {'title': values[title_key], 'status': values[status_key] or None, 'statusSourceText': values[status_key] or None, 'statusField': status_key, 'billSession': values.get('提出回次'), 'billNumber': values.get('番号'), 'linkLabel': link['text']}


def extract_html(source, html, final_url, fetched_at, allowed_hosts=(), include_index=True):
    parser = IndexParser()
    parser.feed(html)
    parser.close()
    records = []
    if include_index:
        records.append(make_record(source, source.get('name') or parser.title or source['url'], final_url, fetched_at, recordType='index', pageTitle=parser.title))
    for link in parser.links:
        label = link['text']
        context = bill_context(link) if source.get('kind') == 'bill' else {}
        title = context.pop('title', '') or label
        if not title or NAV_TEXT.fullmatch(title) or link['href'].startswith('#'):
            continue
        try:
            url = normalize_url(link['href'], final_url, allowed_hosts)
        except (ValueError, UnicodeError):
            continue
        path = urlsplit(url).path.lower()
        if path.endswith(UNWANTED_EXTENSIONS) or url == final_url:
            continue
        is_document = path.endswith(DOCUMENT_EXTENSIONS)
        if GENERIC_DOCUMENT_TITLE.fullmatch(title) and source.get('kind') in ('whitepaper', 'committee'):
            title = source.get('name', '') + ' — ' + title
        if len(title) < 3:
            continue
        if source.get('kind') == 'bill' and not context.get('status') and not BILL_TITLE.search(title):
            continue
        row_text = ' '.join(cell['text'] for cell in (link.get('row') or {}).get('cells', []))
        item = make_record(source, title, url, fetched_at, recordType='document' if is_document else ('index' if INDEX_TEXT.search(title) else 'page'), discoveredOn=final_url, publishedAt=publication_date(label), **context)
        # A labelled row date is usable only when that row represents one item.
        if not item['publishedAt'] and row_text and len({a['href'] for a in (link.get('row') or {}).get('links', [])}) == 1:
            item['publishedAt'] = publication_date(row_text)
        # A meeting date is separate from its publication date.
        if source.get('kind') == 'committee':
            match = re.search(r'開催(?:日|日時)\s*[：:]?\s*(.+)', label)
            item['eventDate'] = parse_date(match.group(1)) if match else None
        records.append(item)
    return deduplicate(records), parser


def collect_html(source, fetcher, fetched_at, max_children=8):
    html, final_url, content_type = fetcher.get(source['url'])
    if 'pdf' in content_type:
        return [make_record(source, source['name'], final_url, fetched_at, recordType='document')], {'pagesFetched': 1}
    records, parser = extract_html(source, html, final_url, fetched_at, fetcher.allowed_hosts)
    # Current-session indexes use meta redirects or a plain fallback link next
    # to JavaScript. Follow the HTML fallback only; do not execute JavaScript.
    redirect_target = parser.meta_refresh
    if not redirect_target and len(html) < 8192 and len(parser.links) == 1 and parser.links[0]['text'] in ('こちら', '移動先', '移動先のページ') and '自動的に' in html:
        redirect_target = parser.links[0]['href']
    if redirect_target:
        next_url = normalize_url(redirect_target, final_url, fetcher.allowed_hosts)
        if next_url != final_url:
            html, final_url, _ = fetcher.get(next_url)
            records, parser = extract_html(source, html, final_url, fetched_at, fetcher.allowed_hosts)
    diagnostics = {'pagesFetched': 1, 'childPagesAvailable': 0, 'childPagesFetched': 0, 'childPageLimit': max_children, 'errors': []}
    if source.get('kind') == 'whitepaper':
        host = urlsplit(final_url).hostname
        candidates = [r for r in records if r['url'] != final_url and r['recordType'] != 'document' and urlsplit(r['url']).hostname == host and re.search(r'白書|報告書|年次報告|年報|令和\d|平成\d|20\d{2}', r['title'])]
        diagnostics['childPagesAvailable'] = len(candidates)
        diagnostics['truncated'] = len(candidates) > max_children
        for record in candidates[:max_children]:
            try:
                body, child_url, child_type = fetcher.get(record['url'])
                if 'pdf' not in child_type:
                    children, _ = extract_html(source, body, child_url, fetched_at, fetcher.allowed_hosts, include_index=False)
                    records.extend(children)
                diagnostics['childPagesFetched'] += 1
                diagnostics['pagesFetched'] += 1
            except Exception as exc:
                diagnostics['errors'].append({'url': record['url'], 'error': safe_error(exc)})
    return deduplicate(records), diagnostics


def local_name(tag):
    return tag.rsplit('}', 1)[-1]


def parse_feed(source, xml, fetched_at, allowed_hosts=()):
    if '<!DOCTYPE' in xml.upper() or '<!ENTITY' in xml.upper():
        raise ValueError('DTD and entity declarations are not accepted in feeds')
    root = ET.fromstring(xml)
    records = []
    for item in root.iter():
        if local_name(item.tag) not in ('item', 'entry'):
            continue
        values = {}
        for child in item:
            key = local_name(child.tag)
            if key == 'link':
                values[key] = child.attrib.get('href') or child.text or ''
            else:
                values[key] = ''.join(child.itertext())
        try:
            url = normalize_url(clean_text(values.get('link', '')), source['url'], allowed_hosts)
        except ValueError:
            continue
        title = clean_text(values.get('title'))
        if not title:
            continue
        description = clean_text(re.sub(r'<[^>]*>', ' ', values.get('description', values.get('summary', ''))))
        pub = publication_date(description)
        # Do not turn an update timestamp or submission deadline into publication.
        if not pub and values.get('published'):
            pub = parse_date(values['published'])
        record = make_record(source, title, url, fetched_at, recordType='page', publishedAt=pub, description=description[:1200], feedTimestamp=values.get('date') or values.get('pubDate') or values.get('updated'), status=None)
        deadline = re.search(r'受付締切日時\s*[：:]\s*(20\d{2}[/.-]\d{1,2}[/.-]\d{1,2}(?:\s+\d{1,2}:\d{2})?)', description)
        if deadline:
            record['commentDeadline'] = deadline.group(1)
        records.append(record)
    return deduplicate(records)


def parse_laws(source, data, fetched_at):
    records = []
    for law in data.get('laws', []):
        info = law.get('law_info') or {}
        revision = law.get('revision_info') or {}
        law_id = info.get('law_id')
        if not law_id or not re.fullmatch(r'[A-Za-z0-9_-]+', str(law_id)):
            continue
        records.append(make_record(source, revision.get('law_title') or info.get('law_num') or law_id, 'https://laws.e-gov.go.jp/law/' + law_id, fetched_at, kind='law', recordType='law', publishedAt=parse_date(revision.get('amendment_promulgate_date') or info.get('promulgation_date')), lawId=law_id, lawNumber=info.get('law_num'), lawPromulgationDate=parse_date(info.get('promulgation_date')), amendmentPromulgationDate=parse_date(revision.get('amendment_promulgate_date')), effectiveDate=parse_date(revision.get('amendment_enforcement_date')), scheduledEffectiveDate=parse_date(revision.get('amendment_scheduled_enforcement_date')), revisionUpdatedAt=revision.get('updated'), amendmentLawTitle=revision.get('amendment_law_title'), amendmentLawId=revision.get('amendment_law_id'), repealStatus=revision.get('repeal_status'), revisionStatus=revision.get('current_revision_status'), category=revision.get('category')))
    return deduplicate(records)


def parse_law_update_zip(source, raw, fetched_at, requested_date):
    """Read only the official CSV; never extract or parse the law XML files."""
    if len(raw) > MAX_ZIP_BYTES:
        raise ValueError('Archive exceeds the 32 MiB limit')
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        entries = archive.infolist()
        if len(entries) > 20000:
            raise ValueError('Archive contains too many entries')
        csv_entries = [entry for entry in entries if '/' not in entry.filename and entry.filename.lower().endswith('.csv')]
        if len(csv_entries) != 1 or csv_entries[0].file_size > MAX_BYTES:
            raise ValueError('Archive must contain one bounded top-level metadata CSV')
        metadata = archive.read(csv_entries[0]).decode('utf-8-sig')
        filename = csv_entries[0].filename
    batch_date = requested_date
    match = re.fullmatch(r'R(\d{2})(\d{2})(\d{2})\.csv', filename, re.I)
    if match:
        batch_date = date(2018 + int(match.group(1)), int(match.group(2)), int(match.group(3))).isoformat()
    rows = csv.DictReader(io.StringIO(metadata))
    required = {'法令名', '法令ID', '本文URL', '改正法令名', '改正法令公布日', '施行日', '施行日備考'}
    if not required.issubset(set(rows.fieldnames or [])):
        raise ValueError('Official update CSV has an unexpected schema')
    records = []
    for row in rows:
        try:
            url = normalize_url(row.get('本文URL', '').strip())
        except ValueError:
            continue
        note = clean_text(row.get('施行日備考'))
        effective = None if note else parse_date(row.get('施行日'))
        unpublished = clean_text(row.get('未施行'))
        records.append(make_record(source, row['法令名'], url, fetched_at, kind='revision', recordType='law', publishedAt=parse_date(row.get('改正法令公布日')), lawId=row.get('法令ID'), lawNumber=row.get('法令番号'), lawPromulgationDate=parse_date(row.get('公布日')), amendmentPromulgationDate=parse_date(row.get('改正法令公布日')), effectiveDate=effective, scheduledEffectiveDate=effective if unpublished else None, effectiveDateRaw=row.get('施行日'), effectiveDateNote=note or None, amendmentLawTitle=row.get('改正法令名'), amendmentLawNumber=row.get('改正法令番号'), unEnforcedMarker=unpublished or None, updateBatchDate=batch_date, updateType='official-daily-law-data-update', publicationNote='e-Gov法令データの更新日と、改正法令の公布日・施行日は別の日付です。'))
    return deduplicate(records), {'archiveMetadataFile': filename, 'updateBatchDate': batch_date, 'archiveBytes': len(raw), 'coverage': '直近の取得可能なe-Gov法令データ更新分。データ更新日を法改正の公布日とは扱いません。'}


def collect_law_updates(source, fetcher, fetched_at):
    parsed = urlsplit(source['url'])
    params = dict(parse_qsl(parsed.query))
    first_date = datetime.strptime(params.get('update_date', datetime.now(JST).strftime('%Y%m%d')), '%Y%m%d').date()
    attempts = []
    for days_back in range(7):
        target_date = first_date - timedelta(days=days_back)
        params['update_date'] = target_date.strftime('%Y%m%d')
        url = urlunsplit((parsed.scheme, parsed.netloc, parsed.path, urlencode(params), ''))
        try:
            raw, final_url, content_type = fetcher.get_binary(url)
        except HTTPError as exc:
            if exc.code in (404, 500):
                attempts.append({'date': target_date.isoformat(), 'status': 'http-error', 'url': url, 'error': f'HTTP {exc.code}'})
                continue
            raise
        if not raw.startswith(b'PK'):
            attempts.append({'date': target_date.isoformat(), 'status': 'unexpected-response', 'url': url, 'error': 'Response was not a ZIP archive'})
            continue
        records, diagnostics = parse_law_update_zip(dict(source, url=final_url), raw, fetched_at, target_date.isoformat())
        diagnostics.update({'archiveUrl': final_url, 'checkedDates': attempts + [{'date': target_date.isoformat(), 'status': 'available'}], 'errors': attempts})
        return records, diagnostics
    raise ValueError('No update archive was available in the past seven days')


def parse_meetings(source, data, fetched_at):
    records = []
    for meeting in data.get('meetingRecord', []):
        url = meeting.get('meetingURL')
        if not url:
            continue
        try:
            url = normalize_url(url)
        except ValueError:
            continue
        meeting_date = parse_date(meeting.get('date'))
        house = clean_text(meeting.get('nameOfHouse'))
        name = clean_text(meeting.get('nameOfMeeting'))
        issue = clean_text(str(meeting.get('issue', '')))
        title = ' '.join(filter(None, [meeting_date, house, name, issue]))
        records.append(make_record(source, title, url, fetched_at, kind='parliament', recordType='minutes', publishedAt=None, eventDate=meeting_date, house=house, meeting=name, issue=issue, session=meeting.get('session'), meetingId=meeting.get('issueID'), publicationNote='開催日。会議録の公開日とは異なります。'))
    return deduplicate(records)


def collect_source(source, fetcher, fetched_at, max_children):
    adapter = source.get('adapter', '')
    host_path = urlsplit(source['url'])
    if adapter == 'egov-updates':
        return collect_law_updates(source, fetcher, fetched_at)
    if adapter == 'egov-laws' or (host_path.hostname == 'laws.e-gov.go.jp' and '/api/2/laws' in host_path.path):
        text, _, _ = fetcher.get(source['url'])
        data = json.loads(text)
        if not isinstance(data.get('laws'), list):
            raise ValueError('e-Gov API response does not contain laws[]')
        return parse_laws(source, data, fetched_at), {'limit': 100, 'availableCount': data.get('total_count'), 'truncated': int(data.get('total_count', len(data['laws']))) > 100, 'coverage': '直近60日に公布された法令（改正法令を含む）、最大100件。既存法令本文の全改正履歴ではありません。'}
    if adapter == 'kokkai-meetings' or (host_path.hostname == 'kokkai.ndl.go.jp' and 'meeting_list' in host_path.path):
        text, _, _ = fetcher.get(source['url'])
        data = json.loads(text)
        if not isinstance(data.get('meetingRecord'), list):
            if int(data.get('numberOfRecords', -1)) == 0:
                data['meetingRecord'] = []
            else:
                raise ValueError('Diet API response does not contain meetingRecord[]')
        total = int(data.get('numberOfRecords', len(data['meetingRecord'])))
        return parse_meetings(source, data, fetched_at)[:100], {'limit': 100, 'availableCount': total, 'truncated': total > 100, 'coverage': '直近60日間に開催された会議録、最大100件。現在進行中の国会日程ではありません。'}
    if source.get('kind') == 'feed' or adapter == 'feed':
        text, _, _ = fetcher.get(source['url'])
        return parse_feed(source, text, fetched_at, fetcher.allowed_hosts), {'coverage': '配信元フィードに現在含まれる項目のみ。全履歴ではありません。'}
    return collect_html(source, fetcher, fetched_at, max_children)


def deduplicate(records):
    by_url = {}
    for record in records:
        key = record['url']
        if key not in by_url:
            by_url[key] = dict(record)
            continue
        existing = by_url[key]
        # Keep the most concrete record when a landing index repeats a document URL.
        rank = {'index': 0, 'page': 1, 'document': 2, 'law': 3, 'minutes': 3}
        if (not record.get('stale', False), rank.get(record.get('recordType'), 0)) > (not existing.get('stale', False), rank.get(existing.get('recordType'), 0)):
            winner, other = dict(record), existing
        else:
            winner, other = existing, record
        for field in ('sourceIds', 'sourceUrls'):
            winner[field] = list(dict.fromkeys(list(winner.get(field, [])) + list(other.get(field, []))))
        for field in ('publishedAt', 'status', 'statusSourceText', 'statusField', 'billNumber', 'billSession'):
            if not winner.get(field) and other.get(field):
                winner[field] = other[field]
        by_url[key] = winner
    return list(by_url.values())


def safe_error(exc):
    return clean_text(f'{type(exc).__name__}: {exc}')[:400]


def source_outcome(source, previous_status, old_records, fresh_records, fetched_at, diagnostics=None, error=None):
    """A failed source must not erase the last successfully retrieved index."""
    diagnostics = diagnostics or {}
    result = dict(source)  # Keep every registry metadata field.
    result.update({'fetchedAt': fetched_at, 'error': error, 'diagnostics': diagnostics})
    if error:
        kept = [dict(r, stale=True) for r in old_records]
        result.update({'status': 'error', 'count': len(kept), 'lastSuccessAt': previous_status.get('lastSuccessAt'), 'retainedCount': len(kept)})
        return kept, result
    partial = bool(diagnostics.get('errors') or diagnostics.get('truncated'))
    current = [dict(r, stale=False) for r in fresh_records]
    if partial:
        current = deduplicate(current + [dict(r, stale=True) for r in old_records])
    result.update({'status': 'partial' if partial else 'ok', 'count': len(current), 'lastSuccessAt': fetched_at, 'retainedCount': sum(bool(r.get('stale')) for r in current)})
    if partial:
        notes = []
        if diagnostics.get('errors'):
            notes.append(f"{len(diagnostics['errors'])} request(s) could not be fetched")
        if diagnostics.get('truncated'):
            notes.append('巡回・取得件数の上限に達したため一部のみ収録')
        result['error'] = '; '.join(notes)
    return current, result


def default_sources():
    today = datetime.now(JST).date()
    return [
        {'id': 'egov-laws', 'name': 'e-Gov 法令API 直近60日の公布法令', 'url': 'https://laws.e-gov.go.jp/api/2/laws?' + urlencode({'limit': 100, 'promulgation_date_from': (today - timedelta(days=59)).isoformat(), 'promulgation_date_to': today.isoformat(), 'order': '-law_info.promulgation_date', 'mission': 'New,Partial'}), 'kind': 'law', 'organization': 'デジタル庁', 'adapter': 'egov-laws', 'coverage': '直近60日の公布法令（改正法令を含む）、最大100件。更新日時と公布・施行日は別に表示。'},
        {'id': 'egov-updates', 'name': 'e-Gov 法令データ更新一覧', 'url': 'https://laws.e-gov.go.jp/bulkdownload?' + urlencode({'file_section': 3, 'update_date': today.strftime('%Y%m%d'), 'only_xml_flag': 'true'}), 'kind': 'revision', 'organization': 'デジタル庁', 'adapter': 'egov-updates', 'coverage': '過去7日から最初に取得成功した1日分の公式法令データ更新。更新日と改正公布日・施行日を区別。'},
        {'id': 'kokkai-meetings', 'name': '国会会議録 直近60日', 'url': 'https://kokkai.ndl.go.jp/api/meeting_list?' + urlencode({'from': (today - timedelta(days=59)).isoformat(), 'until': today.isoformat(), 'maximumRecords': 100, 'recordPacking': 'json'}), 'kind': 'parliament', 'organization': '国立国会図書館', 'adapter': 'kokkai-meetings', 'coverage': '公開済み会議録の直近60日、最大100件。現在進行中の会議・未公開会議録は含みません。'},
    ]


def load_sources(path, include_defaults=True):
    payload = json.loads(Path(path).read_text(encoding='utf-8'))
    sources = payload.get('sources', []) if isinstance(payload, dict) else payload
    if not isinstance(sources, list):
        raise ValueError('Sources JSON must be an array or an object containing sources[]')
    allowed_hosts = payload.get('allowedHosts', []) if isinstance(payload, dict) else []
    normalized = []
    seen_ids = set()
    for item in sources:
        source = dict(item)
        for key in ('id', 'name', 'url', 'kind', 'organization'):
            if not isinstance(source.get(key), str) or not source[key].strip():
                raise ValueError(f'Source is missing string field {key}')
        if source['id'] in seen_ids:
            raise ValueError('Duplicate source id: ' + source['id'])
        # Config can explicitly extend official hostname allowlist; page links cannot.
        source['url'] = normalize_url(source['url'].strip(), allowed_hosts=allowed_hosts)
        seen_ids.add(source['id'])
        normalized.append(source)
    if include_defaults:
        for source in default_sources():
            if source['id'] not in seen_ids and not any(source['adapter'] == item.get('adapter') for item in normalized):
                normalized.append(source)
    return normalized, allowed_hosts


def run(args):
    sources, allowed_hosts = load_sources(args.sources, not args.no_default_apis)
    output_dir = Path(args.output_dir)
    output_file = output_dir / 'records.json'
    previous = {}
    if output_file.exists():
        try:
            previous = json.loads(output_file.read_text(encoding='utf-8'))
        except (ValueError, OSError) as exc:
            raise ValueError('Existing records.json cannot be read; refusing to replace it: ' + str(exc))
    old_status = {s['id']: s for s in previous.get('sources', [])}
    old_records = previous.get('records', [])
    fetched_at = now_iso()
    fetcher = Fetcher(allowed_hosts, args.timeout)
    all_records = []
    statuses = []
    started = time.monotonic()
    # At most one source for the Diet API should normally be present. Fetcher
    # serializes all requests to that host and spaces completion/start by 3.1 s.
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(collect_source, source, fetcher, fetched_at, args.max_children): source for source in sources}
        for future in concurrent.futures.as_completed(futures):
            source = futures[future]
            previous_records = [r for r in old_records if source['id'] in r.get('sourceIds', [r.get('sourceId')])]
            try:
                current, diagnostics = future.result()
                records, status = source_outcome(source, old_status.get(source['id'], {}), previous_records, current, fetched_at, diagnostics)
            except Exception as exc:
                records, status = source_outcome(source, old_status.get(source['id'], {}), previous_records, [], fetched_at, error=safe_error(exc))
            all_records.extend(records)
            statuses.append(status)
            print(f"[{status['status']}] {source['id']}: {status['count']}" + (f" — {status['error']}" if status.get('error') else ''), file=sys.stderr, flush=True)
    records = deduplicate(all_records)
    records.sort(key=lambda r: (r.get('updateBatchDate') or r.get('revisionUpdatedAt') or r.get('publishedAt') or r.get('eventDate') or '', r['title']), reverse=True)
    order = {s['id']: index for index, s in enumerate(sources)}
    statuses.sort(key=lambda s: order[s['id']])
    result = {'schemaVersion': 1, 'generatedAt': fetched_at, 'records': records, 'sources': statuses, 'coverage': {'registeredSources': len(sources), 'successfulSources': sum(s['status'] == 'ok' for s in statuses), 'partialSources': sum(s['status'] == 'partial' for s in statuses), 'failedSources': sum(s['status'] == 'error' for s in statuses), 'uniqueRecords': len(records), 'scope': '登録した公式索引・API・RSSから取得できたリンク。日本の全機関・全資料の完全収集を保証しません。索引ページは資料本文と区別しています。', 'maxWhitepaperChildPagesPerSource': args.max_children, 'durationSeconds': round(time.monotonic() - started, 1)}}
    output_dir.mkdir(parents=True, exist_ok=True)
    temporary = output_dir / 'records.json.tmp'
    temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    os.replace(temporary, output_file)
    print(f'Saved {len(records)} unique records from {len(sources)} sources to {output_file}', file=sys.stderr)
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--sources', required=True, help='Source registry JSON file')
    parser.add_argument('--output-dir', required=True)
    parser.add_argument('--workers', type=int, default=6)
    parser.add_argument('--timeout', type=int, default=TIMEOUT)
    parser.add_argument('--max-children', type=int, default=8, help='Maximum one-level whitepaper child indexes per source')
    parser.add_argument('--no-default-apis', action='store_true')
    args = parser.parse_args()
    if not 1 <= args.workers <= 12 or not 1 <= args.timeout <= 60 or not 0 <= args.max_children <= 50:
        parser.error('workers must be 1–12, timeout 1–60, max-children 0–50')
    run(args)


if __name__ == '__main__':
    main()
