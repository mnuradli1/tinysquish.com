import json
import threading
import unittest
import urllib.request
from http.server import ThreadingHTTPServer

from visits import VisitStore, classify_source, clean_page, is_bot, make_handler, report

CHROME = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36'
FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:131.0) Gecko/20100101 Firefox/131.0'


class VisitStoreTest(unittest.TestCase):
    def setUp(self):
        self.store = VisitStore(':memory:')

    def test_first_visit_counts_visitor_and_pageview(self):
        self.assertEqual(self.store.record('1.1.1.1', CHROME, '2026-10-08'),
                         {'total': 1, 'today': 1, 'pageviews': 1})

    def test_repeat_visit_same_day_only_adds_pageview(self):
        self.store.record('1.1.1.1', CHROME, '2026-10-08')
        self.assertEqual(self.store.record('1.1.1.1', CHROME, '2026-10-08'),
                         {'total': 1, 'today': 1, 'pageviews': 2})

    def test_different_visitor_counts_separately(self):
        self.store.record('1.1.1.1', CHROME, '2026-10-08')
        self.store.record('2.2.2.2', CHROME, '2026-10-08')
        self.assertEqual(self.store.record('1.1.1.1', FIREFOX, '2026-10-08')['today'], 3)

    def test_next_day_counts_again_and_prunes_old_hashes(self):
        self.store.record('1.1.1.1', CHROME, '2026-10-08')
        stats = self.store.record('1.1.1.1', CHROME, '2026-10-09')
        self.assertEqual(stats, {'total': 2, 'today': 1, 'pageviews': 2})
        days = {r[0] for r in self.store.db.execute('SELECT day FROM seen')}
        self.assertEqual(days, {'2026-10-09'})

    def test_no_raw_ip_stored(self):
        self.store.record('203.0.113.7', CHROME, '2026-10-08')
        dump = '\n'.join(self.store.db.iterdump())
        self.assertNotIn('203.0.113.7', dump)

    def test_salt_persists_across_restarts(self):
        import os, tempfile
        path = os.path.join(tempfile.mkdtemp(), 'v.db')
        VisitStore(path).record('1.1.1.1', CHROME, '2026-10-08')
        self.assertEqual(VisitStore(path).record('1.1.1.1', CHROME, '2026-10-08')['today'], 1)

    def test_bot_detection(self):
        self.assertTrue(is_bot('Googlebot/2.1'))
        self.assertTrue(is_bot('curl/8.5.0'))
        self.assertTrue(is_bot(''))
        self.assertFalse(is_bot(CHROME))


class SourceTest(unittest.TestCase):
    def test_classify_known_sources(self):
        cases = {'': 'direct', 'www.google.com': 'google', 'www.google.co.id': 'google',
                 'gemini.google.com': 'gemini', 'chatgpt.com': 'chatgpt', 'chat.openai.com': 'chatgpt',
                 'www.perplexity.ai': 'perplexity', 'claude.ai': 'claude', 'www.bing.com': 'bing',
                 'copilot.microsoft.com': 'copilot', 'duckduckgo.com': 'duckduckgo', 'github.com': 'github',
                 'news.ycombinator.com': 'hackernews', 'old.reddit.com': 'reddit', 't.co': 'x',
                 'evil.example.com': 'other', 'notgoogle.com': 'other'}
        for host, source in cases.items():
            self.assertEqual(classify_source(host), source, host)

    def test_page_paths_are_bounded(self):
        self.assertEqual(clean_page('/compress-png/'), '/compress-png/')
        self.assertEqual(clean_page('/id/kompres-foto-100kb/'), '/id/kompres-foto-100kb/')
        self.assertEqual(clean_page('/x?email=a@b.c'), 'other')
        self.assertEqual(clean_page('/' + 'a' * 200), 'other')
        self.assertEqual(clean_page(None), 'other')

    def test_record_aggregates_source_and_page_without_raw_host(self):
        store = VisitStore(':memory:')
        store.record('1.1.1.1', CHROME, '2026-10-09', ref='chatgpt.com', page='/compress-png/')
        store.record('2.2.2.2', CHROME, '2026-10-09', ref='chatgpt.com', page='/compress-png/')
        store.record('3.3.3.3', CHROME, '2026-10-09', ref='secret-intranet.corp', page='/')
        rows = set(store.db.execute('SELECT day, source, page, hits FROM sources'))
        self.assertEqual(rows, {('2026-10-09', 'chatgpt', '/compress-png/', 2), ('2026-10-09', 'other', '/', 1)})
        self.assertNotIn('secret-intranet', '\n'.join(store.db.iterdump()))

    def test_report_sums_recent_days(self):
        store = VisitStore(':memory:')
        store.record('1.1.1.1', CHROME, '2026-10-01', ref='www.google.com', page='/')
        store.record('1.1.1.1', CHROME, '2026-10-09', ref='perplexity.ai', page='/benchmark/')
        text = report(store, days=3, today='2026-10-09')
        self.assertIn('perplexity', text)
        self.assertNotIn('google', text)


class HttpTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), make_handler(VisitStore(':memory:')))
        cls.base = f'http://127.0.0.1:{cls.server.server_address[1]}'
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()

    def req(self, method, path='/api/visits', ua=CHROME, ip='9.9.9.9', body=None):
        r = urllib.request.Request(self.base + path, method=method, data=body,
                                   headers={'User-Agent': ua, 'X-Real-IP': ip, 'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(r) as resp:
                return resp.status, json.loads(resp.read()), resp.headers
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read()), e.headers

    def test_post_records_get_does_not(self):
        _, before, _ = self.req('GET')
        status, after, headers = self.req('POST', ip='8.8.8.8')
        self.assertEqual(status, 200)
        self.assertEqual(after['pageviews'], before['pageviews'] + 1)
        self.assertEqual(headers['Cache-Control'], 'no-store')
        _, again, _ = self.req('GET')
        self.assertEqual(again, after)

    def test_bot_post_not_counted(self):
        _, before, _ = self.req('GET')
        _, after, _ = self.req('POST', ua='Googlebot/2.1')
        self.assertEqual(after, before)

    def test_post_body_records_source(self):
        body = json.dumps({'ref': 'www.perplexity.ai', 'page': '/benchmark/'}).encode()
        status, _, _ = self.req('POST', ip='7.7.7.7', body=body)
        self.assertEqual(status, 200)
        store = self.server.RequestHandlerClass.store
        self.assertIn(('perplexity', '/benchmark/'), set(store.db.execute('SELECT source, page FROM sources')))

    def test_malformed_body_still_counts(self):
        _, before, _ = self.req('GET')
        status, after, _ = self.req('POST', ip='6.6.6.6', body=b'{not json')
        self.assertEqual((status, after['pageviews']), (200, before['pageviews'] + 1))

    def test_unknown_path_404(self):
        self.assertEqual(self.req('GET', '/api/nope')[0], 404)


if __name__ == '__main__':
    unittest.main()
