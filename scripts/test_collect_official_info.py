import importlib.util
import io
import json
from pathlib import Path
import socket
import tempfile
import unittest
import zipfile
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('collector', Path(__file__).with_name('collect_official_info.py'))
collector = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(collector)

SOURCE = {'id': 'test', 'name': '公式資料', 'url': 'https://www.example.go.jp/index.html', 'kind': 'whitepaper', 'organization': '試験省', 'verification': 'fixture-only', 'scopeNote': '登録索引のみ'}
FETCHED = '2026-09-14T12:00:00Z'


class URLTests(unittest.TestCase):
    def test_normalizes_fragments_tracking_and_relative_urls(self):
        self.assertEqual(collector.normalize_url('/paper.pdf?utm_source=a&year=2026#p1', SOURCE['url']), 'https://www.example.go.jp/paper.pdf?year=2026')

    def test_rejects_unsafe_urls(self):
        for url in ['javascript:alert(1)', 'file:///etc/passwd', 'http://127.0.0.1/x', 'http://[::1]/', 'https://www.example.go.jp.evil.example/a', 'https://admin@www.example.go.jp/a', 'https://www.example.go.jp:8000/a', 'https://www.example.go.jp/a\n', 'https://www.example.go.jp\\@evil.example/a', 'https://localhost/a']:
            with self.subTest(url=url), self.assertRaises(ValueError):
                collector.normalize_url(url)

    def test_private_dns_answer_is_rejected(self):
        addresses = [(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('10.0.0.8', 443))]
        with patch.object(socket, 'getaddrinfo', return_value=addresses), self.assertRaises(ValueError):
            collector.normalize_url('https://www.example.go.jp/', resolve=True)

    def test_private_dns_mixed_with_public_is_rejected(self):
        addresses = [(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('8.8.8.8', 443)), (socket.AF_INET, socket.SOCK_STREAM, 6, '', ('127.0.0.1', 443))]
        with patch.object(socket, 'getaddrinfo', return_value=addresses), self.assertRaises(ValueError):
            collector.normalize_url('https://www.example.go.jp/', resolve=True)

    def test_explicit_official_host_extension(self):
        self.assertEqual(collector.normalize_url('https://www.j-lis.go.jp/a'), 'https://www.j-lis.go.jp/a')
        self.assertEqual(collector.normalize_url('https://official.example.org/a', allowed_hosts=['official.example.org']), 'https://official.example.org/a')

    def test_unresolved_dns_only_delegates_to_configured_proxy(self):
        with patch.object(socket, 'getaddrinfo', side_effect=socket.gaierror('unresolved')), patch.object(collector, 'getproxies', return_value={}), self.assertRaises(socket.gaierror):
            collector.normalize_url(SOURCE['url'], resolve=True)
        with patch.object(socket, 'getaddrinfo', side_effect=socket.gaierror('unresolved')), patch.object(collector, 'getproxies', return_value={'https': 'http://managed-proxy.invalid:8080'}), patch.object(collector, 'proxy_bypass', return_value=False):
            self.assertEqual(collector.normalize_url(SOURCE['url'], resolve=True), SOURCE['url'])


class HTMLTests(unittest.TestCase):
    def test_all_non_nav_anchors_deduplicate_and_distinguish_index(self):
        html = '<title>資料 &amp; 白書</title><nav><a href="/nav">組織情報</a></nav><main><a href="/index2.html">令和8年白書一覧</a><a href="/a.pdf">令和8年白書 PDF</a><a href="/a.pdf#page=2">白書本体</a><a href="javascript:alert(1)">悪意リンク</a><script><a href="/fake.pdf">偽資料</a></script><a href="/img.png">写真</a><a href="/b.html">資料紹介ページ</a></main><footer><a href="/footer">別の情報</a></footer>'
        records, parser = collector.extract_html(SOURCE, html, SOURCE['url'], FETCHED)
        self.assertEqual(parser.title, '資料 & 白書')
        self.assertEqual(len(records), 4)
        self.assertEqual(records[0]['recordType'], 'index')
        self.assertEqual(next(r for r in records if r['url'].endswith('a.pdf'))['recordType'], 'document')
        self.assertTrue(all(r['publishedAt'] is None for r in records))

    def test_labels_cannot_turn_html_into_markup(self):
        records, _ = collector.extract_html(SOURCE, '<a href="/doc.pdf">&lt;img src=x onerror=alert(1)&gt;本文</a>', SOURCE['url'], FETCHED)
        self.assertEqual(records[1]['title'], '<img src=x onerror=alert(1)>本文')
        # JSON carries text only; the renderer must use textContent, never innerHTML.
        self.assertIsInstance(json.loads(json.dumps(records))[1]['title'], str)

    def test_bill_status_from_same_explicit_column_only(self):
        source = dict(SOURCE, kind='bill')
        html = '<p>成立した法律一覧</p><table><tr><th>提出回次</th><th>番号</th><th>議案件名</th><th>審議状況</th><th>本文情報</th></tr><tr><td>221</td><td>13</td><td>情報公開法の一部を改正する法律案</td><td>衆議院で閉会中審査</td><td><a href="/bill13.htm">本文</a></td></tr><tr><td>221</td><td>14</td><td>別の法律案</td><td>成立</td><td><a href="/bill14.htm">本文</a></td></tr></table><a href="/unrelated.htm">法律の成立を目指す検討会</a>'
        records, _ = collector.extract_html(source, html, source['url'], FETCHED)
        bill = next(r for r in records if r['url'].endswith('bill13.htm'))
        self.assertEqual(bill['title'], '情報公開法の一部を改正する法律案')
        self.assertEqual(bill['status'], '衆議院で閉会中審査')
        self.assertEqual(bill['billSession'], '221')
        unrelated = next(r for r in records if r['url'].endswith('unrelated.htm'))
        self.assertIsNone(unrelated['status'])

    def test_whitepaper_child_cap_is_visible(self):
        class FakeFetcher:
            allowed_hosts = ()
            def get(self, url):
                if url.endswith('index.html'):
                    return '<a href="/2026.html">2026年白書</a><a href="/2025.html">2025年白書</a>', url, 'text/html'
                return '<a href="/body.pdf">白書本文PDF</a>', url, 'text/html'
        records, diagnostic = collector.collect_html(SOURCE, FakeFetcher(), FETCHED, max_children=1)
        self.assertEqual(diagnostic['childPagesAvailable'], 2)
        self.assertEqual(diagnostic['childPagesFetched'], 1)
        self.assertTrue(diagnostic['truncated'])
        self.assertTrue(any(r['url'].endswith('body.pdf') for r in records))

    def test_current_session_fallback_link_is_followed_without_javascript(self):
        class FakeFetcher:
            allowed_hosts = ()
            def get(self, url):
                if url.endswith('index.html'):
                    return '<script>location.replace("/221.html")</script>自動的に移動しない場合<a href="/221.html">こちら</a>', url, 'text/html'
                return '<title>最新国会議案</title><a href="/bill.html">法律案本文</a>', url, 'text/html'
        records, _ = collector.collect_html(dict(SOURCE, kind='bill'), FakeFetcher(), FETCHED)
        self.assertTrue(any(r['url'].endswith('bill.html') for r in records))


class DateTests(unittest.TestCase):
    def test_explicit_japanese_date(self):
        self.assertEqual(collector.parse_date('令和8年9月14日'), '2026-09-14')
        self.assertEqual(collector.parse_date('平成元年1月8日'), '1989-01-08')
        self.assertIsNone(collector.parse_date('令和8年度白書'))
        self.assertIsNone(collector.parse_date('2026/02/30'))
        self.assertEqual(collector.parse_date('令和七年十二月十二日'), '2025-12-12')
        self.assertEqual(collector.parse_date('明治四十年四月二十四日'), '1907-04-24')

    def test_deadline_and_meeting_not_publication(self):
        for text in ['受付締切日時：2026/10/13 23:59', '開催日：令和8年9月14日', '2026年9月14日施行', '更新日：2026/09/14']:
            self.assertIsNone(collector.publication_date(text))
        self.assertEqual(collector.publication_date('案の公示日：2026/09/14 受付締切日時：2026/10/13 23:59'), '2026-09-14')

    def test_rdf_feed_explicit_publication_beats_broken_timestamp(self):
        feed = '''<rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/"><item><title>規則案について</title><link>https://public-comment.e-gov.go.jp/pcm/detail?CLASSNAME=A</link><description>案の公示日：2026/09/14 受付締切日時：2026/10/13 23:59</description><dc:date>2026-09-13T15:00:Z</dc:date></item></rdf:RDF>'''
        records = collector.parse_feed(dict(SOURCE, kind='feed'), feed, FETCHED)
        self.assertEqual(records[0]['publishedAt'], '2026-09-14')
        self.assertEqual(records[0]['commentDeadline'], '2026/10/13 23:59')
        self.assertIsNone(records[0]['status'])

    def test_rejects_entity_feeds(self):
        with self.assertRaises(ValueError):
            collector.parse_feed(SOURCE, '<!DOCTYPE x [<!ENTITY x "evil">]><rss/>', FETCHED)

    def test_law_dates_remain_distinct(self):
        payload = {'laws': [{'law_info': {'law_id': '501AC0000000001', 'law_num': '令和元年法律第1号', 'promulgation_date': '2019-05-01'}, 'revision_info': {'law_title': '試験法', 'updated': '2026-09-14T12:00:00Z', 'amendment_promulgate_date': '2026-08-01', 'amendment_enforcement_date': '2027-04-01', 'current_revision_status': 'UnEnforced'}}]}
        record = collector.parse_laws(SOURCE, payload, FETCHED)[0]
        self.assertEqual(record['publishedAt'], '2026-08-01')
        self.assertEqual(record['lawPromulgationDate'], '2019-05-01')
        self.assertEqual(record['effectiveDate'], '2027-04-01')
        self.assertIsNone(record['status'])

    def test_meeting_date_not_publication_or_current_status(self):
        payload = {'meetingRecord': [{'meetingURL': 'https://kokkai.ndl.go.jp/txt/122100001X00120260914', 'date': '2026-09-14', 'nameOfHouse': '衆議院', 'nameOfMeeting': '予算委員会', 'issue': '第1号'}]}
        record = collector.parse_meetings(SOURCE, payload, FETCHED)[0]
        self.assertEqual(record['eventDate'], '2026-09-14')
        self.assertIsNone(record['publishedAt'])
        self.assertIsNone(record['status'])

    def test_update_zip_preserves_uncertain_effective_date_and_batch_date(self):
        csv = '法令名,法令ID,本文URL,改正法令名,改正法令公布日,施行日,施行日備考,未施行\n試験法,501AC0000000001,https://laws.e-gov.go.jp/law/501AC0000000001/20270401_507AC0000000087,試験法の一部を改正する法律,令和七年十二月十二日,令和九十九年十二月三十一日,政令で定める日,○\n'
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w') as archive:
            archive.writestr('R080914.csv', csv.encode('utf-8-sig'))
            archive.writestr('ignored/law.xml', '<not-read/>')
        records, diagnostic = collector.parse_law_update_zip(SOURCE, buffer.getvalue(), FETCHED, '2026-09-14')
        self.assertEqual(records[0]['publishedAt'], '2025-12-12')
        self.assertEqual(records[0]['updateBatchDate'], '2026-09-14')
        self.assertEqual(records[0]['effectiveDateNote'], '政令で定める日')
        self.assertIsNone(records[0]['effectiveDate'])
        self.assertIsNone(records[0]['scheduledEffectiveDate'])

    def test_zip_does_not_extract_nested_files_as_metadata(self):
        buffer = io.BytesIO()
        with zipfile.ZipFile(buffer, 'w') as archive:
            archive.writestr('../../unsafe.csv', 'not metadata')
        with self.assertRaises(ValueError):
            collector.parse_law_update_zip(SOURCE, buffer.getvalue(), FETCHED, '2026-09-14')


class RetentionTests(unittest.TestCase):
    def test_failed_source_keeps_old_records_and_success_time(self):
        old = collector.make_record(SOURCE, '以前の資料', 'https://www.example.go.jp/a.pdf', '2026-09-01T00:00:00Z')
        records, status = collector.source_outcome(SOURCE, {'lastSuccessAt': '2026-09-01T00:00:00Z'}, [old], [], FETCHED, error='HTTP 503')
        self.assertEqual(records[0]['fetchedAt'], '2026-09-01T00:00:00Z')
        self.assertTrue(records[0]['stale'])
        self.assertEqual(status['lastSuccessAt'], '2026-09-01T00:00:00Z')
        self.assertEqual(status['status'], 'error')
        self.assertEqual(status['verification'], 'fixture-only')
        self.assertEqual(status['scopeNote'], '登録索引のみ')

    def test_partial_source_keeps_missing_old_child(self):
        old = collector.make_record(SOURCE, '以前の資料', 'https://www.example.go.jp/old.pdf', '2026-09-01T00:00:00Z')
        fresh = collector.make_record(SOURCE, '新しい資料', 'https://www.example.go.jp/new.pdf', FETCHED)
        records, status = collector.source_outcome(SOURCE, {}, [old], [fresh], FETCHED, {'errors': [{'url': '/old', 'error': '503'}]})
        self.assertEqual(status['status'], 'partial')
        self.assertEqual(len(records), 2)
        self.assertEqual(status['retainedCount'], 1)

    def test_cross_source_dedup_preserves_attribution(self):
        a = collector.make_record(SOURCE, '白書', 'https://www.example.go.jp/a.pdf', FETCHED, recordType='index')
        b = collector.make_record(dict(SOURCE, id='other', url='https://www.example.go.jp/other'), '白書本文', a['url'], FETCHED, recordType='document')
        records = collector.deduplicate([a, b])
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0]['recordType'], 'document')
        self.assertEqual(set(records[0]['sourceIds']), {'test', 'other'})

    def test_truncation_is_partial_even_when_requests_succeed(self):
        fresh = collector.make_record(SOURCE, '新しい資料', 'https://www.example.go.jp/new.pdf', FETCHED)
        records, status = collector.source_outcome(SOURCE, {}, [], [fresh], FETCHED, {'truncated': True})
        self.assertEqual(status['status'], 'partial')
        self.assertIn('上限', status['error'])


if __name__ == '__main__':
    unittest.main()
