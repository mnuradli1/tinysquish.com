import json
import threading
import unittest
import urllib.request
from http.server import ThreadingHTTPServer

from visits import VisitStore, is_bot, make_handler

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


class HttpTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(('127.0.0.1', 0), make_handler(VisitStore(':memory:')))
        cls.base = f'http://127.0.0.1:{cls.server.server_address[1]}'
        threading.Thread(target=cls.server.serve_forever, daemon=True).start()

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()

    def req(self, method, path='/api/visits', ua=CHROME, ip='9.9.9.9'):
        r = urllib.request.Request(self.base + path, method=method,
                                   headers={'User-Agent': ua, 'X-Real-IP': ip})
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

    def test_unknown_path_404(self):
        self.assertEqual(self.req('GET', '/api/nope')[0], 404)


if __name__ == '__main__':
    unittest.main()
