"""
TinySquish — public visitor counter.

Tiny stdlib-only HTTP service (loopback, fronted by nginx at /api/visits).
  GET  /api/visits  -> current counts
  POST /api/visits  -> record a visit, return counts

Privacy: no raw IPs are stored. A visitor is identified per day by an HMAC
of (day, ip, user-agent) with a secret salt; yesterday's hashes are deleted,
so visitors can't be tracked across days. Only aggregate counts are kept.

Traffic sources: the page may send {"ref": "<referrer host>", "page": "<path>"}.
The host is mapped to a fixed source name (google, chatgpt, perplexity, ...) or
"other" and only daily totals per (source, page) are stored, never the host itself.

    python3 visits.py --report [days]   # sources and pages over the last N days
"""

import hashlib
import hmac
import json
import os
import re
import secrets
import sys
import sqlite3
import threading
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

WIB = timezone(timedelta(hours=7))
BOT_MARKERS = ('bot', 'crawl', 'spider', 'slurp', 'headless', 'lighthouse',
               'curl', 'wget', 'python-requests', 'go-http-client')


# Ordered: the first matching suffix wins (gemini.google.com before google.*)
SOURCES = [
    ('chatgpt', ('chatgpt.com', 'chat.openai.com')),
    ('perplexity', ('perplexity.ai',)),
    ('claude', ('claude.ai',)),
    ('gemini', ('gemini.google.com',)),
    ('copilot', ('copilot.microsoft.com',)),
    ('google', ('google.',)),
    ('bing', ('bing.com',)),
    ('duckduckgo', ('duckduckgo.com',)),
    ('yandex', ('yandex.',)),
    ('brave', ('search.brave.com',)),
    ('ecosia', ('ecosia.org',)),
    ('github', ('github.com',)),
    ('hackernews', ('news.ycombinator.com',)),
    ('reddit', ('reddit.com',)),
    ('producthunt', ('producthunt.com',)),
    ('alternativeto', ('alternativeto.net',)),
    ('x', ('t.co', 'x.com', 'twitter.com')),
    ('facebook', ('facebook.com',)),
    ('linkedin', ('linkedin.com',)),
]
PAGE_RE = re.compile(r'^/[a-z0-9/-]{0,60}$')


def classify_source(host):
    host = (host or '').lower().strip('.')
    if not host:
        return 'direct'
    labels = host.split('.')
    for name, patterns in SOURCES:
        for pat in patterns:
            if pat.endswith('.'):
                # "google." matches google.com, www.google.co.id, … but not notgoogle.com
                if pat[:-1] in labels[:-1]:
                    return name
            elif host == pat or host.endswith('.' + pat):
                return name
    return 'other'


def clean_page(path):
    return path if isinstance(path, str) and PAGE_RE.match(path) else 'other'


def today_wib():
    return datetime.now(WIB).strftime('%Y-%m-%d')


def is_bot(user_agent):
    ua = (user_agent or '').lower()
    return not ua or any(marker in ua for marker in BOT_MARKERS)


class VisitStore:
    def __init__(self, path):
        self.lock = threading.Lock()
        self.db = sqlite3.connect(path, check_same_thread=False)
        self.db.executescript('''
            CREATE TABLE IF NOT EXISTS daily (
                day TEXT PRIMARY KEY,
                visitors INTEGER NOT NULL DEFAULT 0,
                pageviews INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE IF NOT EXISTS seen (
                day TEXT NOT NULL,
                fp TEXT NOT NULL,
                PRIMARY KEY (day, fp)
            );
            CREATE TABLE IF NOT EXISTS meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sources (
                day TEXT NOT NULL,
                source TEXT NOT NULL,
                page TEXT NOT NULL,
                hits INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (day, source, page)
            );
        ''')
        row = self.db.execute("SELECT value FROM meta WHERE key = 'salt'").fetchone()
        if row:
            self.salt = row[0]
        else:
            self.salt = secrets.token_hex(32)
            self.db.execute("INSERT INTO meta (key, value) VALUES ('salt', ?)", (self.salt,))
        self.db.commit()

    def record(self, ip, user_agent, day, ref=None, page=None):
        fp = hmac.new(self.salt.encode(), f'{day}|{ip}|{user_agent}'.encode(),
                      hashlib.sha256).hexdigest()
        with self.lock:
            is_new = self.db.execute(
                'INSERT OR IGNORE INTO seen (day, fp) VALUES (?, ?)', (day, fp)).rowcount == 1
            self.db.execute('''
                INSERT INTO daily (day, visitors, pageviews) VALUES (?, ?, 1)
                ON CONFLICT(day) DO UPDATE SET
                    visitors = visitors + excluded.visitors,
                    pageviews = pageviews + 1
            ''', (day, int(is_new)))
            self.db.execute('DELETE FROM seen WHERE day < ?', (day,))
            self.db.execute('''
                INSERT INTO sources (day, source, page, hits) VALUES (?, ?, ?, 1)
                ON CONFLICT(day, source, page) DO UPDATE SET hits = hits + 1
            ''', (day, classify_source(ref), clean_page(page)))
            self.db.commit()
        return self.stats(day)

    def stats(self, day):
        with self.lock:
            total, pageviews = self.db.execute(
                'SELECT COALESCE(SUM(visitors), 0), COALESCE(SUM(pageviews), 0) FROM daily').fetchone()
            row = self.db.execute('SELECT visitors FROM daily WHERE day = ?', (day,)).fetchone()
        return {'total': total, 'today': row[0] if row else 0, 'pageviews': pageviews}


def report(store, days=30, today=None):
    today = today or today_wib()
    since = (datetime.strptime(today, '%Y-%m-%d') - timedelta(days=days - 1)).strftime('%Y-%m-%d')
    with store.lock:
        by_source = store.db.execute(
            'SELECT source, SUM(hits) FROM sources WHERE day >= ? GROUP BY source ORDER BY 2 DESC', (since,)).fetchall()
        by_page = store.db.execute(
            'SELECT page, SUM(hits) FROM sources WHERE day >= ? GROUP BY page ORDER BY 2 DESC', (since,)).fetchall()
    lines = [f'Visits by source, {since} … {today}:'] + [f'  {n:>6}  {s}' for s, n in by_source]
    lines += ['', 'Visits by page:'] + [f'  {n:>6}  {p}' for p, n in by_page]
    return '\n'.join(lines)


def make_handler(store):
    class Handler(BaseHTTPRequestHandler):
        server_version = 'TinySquishVisits'
        sys_version = ''

        def _send(self, status, payload):
            body = json.dumps(payload).encode()
            self.send_response(status)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            if self.path != '/api/visits':
                return self._send(404, {'error': 'not found'})
            self._send(200, store.stats(today_wib()))

        def do_POST(self):
            if self.path != '/api/visits':
                return self._send(404, {'error': 'not found'})
            ua = self.headers.get('User-Agent', '')
            if is_bot(ua):
                return self._send(200, store.stats(today_wib()))
            # Bound to loopback behind nginx, so X-Real-IP is trustworthy.
            ip = self.headers.get('X-Real-IP') or self.client_address[0]
            ref = page = None
            try:
                length = min(int(self.headers.get('Content-Length') or 0), 1024)
                data = json.loads(self.rfile.read(length) or b'{}') if length else {}
                if isinstance(data, dict):
                    ref, page = data.get('ref'), data.get('page')
            except (ValueError, UnicodeDecodeError):
                pass  # a malformed body still counts the visit
            self._send(200, store.record(ip, ua, today_wib(), ref=ref if isinstance(ref, str) else None, page=page))

        def log_message(self, fmt, *args):
            pass  # don't log visitor IPs

    Handler.store = store
    return Handler


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    db_path = os.environ.get('TS_VISITS_DB', os.path.join(here, 'data', 'visits.db'))
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    if len(sys.argv) > 1 and sys.argv[1] == '--report':
        print(report(VisitStore(db_path), days=int(sys.argv[2]) if len(sys.argv) > 2 else 30))
        return
    host = os.environ.get('TS_VISITS_HOST', '127.0.0.1')
    port = int(os.environ.get('TS_VISITS_PORT', '8111'))
    server = ThreadingHTTPServer((host, port), make_handler(VisitStore(db_path)))
    print(f'TinySquish visits listening on {host}:{port} (db: {db_path})', flush=True)
    server.serve_forever()


if __name__ == '__main__':
    main()
