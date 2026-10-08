"""
TinySquish — public visitor counter.

Tiny stdlib-only HTTP service (loopback, fronted by nginx at /api/visits).
  GET  /api/visits  -> current counts
  POST /api/visits  -> record a visit, return counts

Privacy: no raw IPs are stored. A visitor is identified per day by an HMAC
of (day, ip, user-agent) with a secret salt; yesterday's hashes are deleted,
so visitors can't be tracked across days. Only aggregate counts are kept.
"""

import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import threading
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

WIB = timezone(timedelta(hours=7))
BOT_MARKERS = ('bot', 'crawl', 'spider', 'slurp', 'headless', 'lighthouse',
               'curl', 'wget', 'python-requests', 'go-http-client')


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
        ''')
        row = self.db.execute("SELECT value FROM meta WHERE key = 'salt'").fetchone()
        if row:
            self.salt = row[0]
        else:
            self.salt = secrets.token_hex(32)
            self.db.execute("INSERT INTO meta (key, value) VALUES ('salt', ?)", (self.salt,))
        self.db.commit()

    def record(self, ip, user_agent, day):
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
            self.db.commit()
        return self.stats(day)

    def stats(self, day):
        with self.lock:
            total, pageviews = self.db.execute(
                'SELECT COALESCE(SUM(visitors), 0), COALESCE(SUM(pageviews), 0) FROM daily').fetchone()
            row = self.db.execute('SELECT visitors FROM daily WHERE day = ?', (day,)).fetchone()
        return {'total': total, 'today': row[0] if row else 0, 'pageviews': pageviews}


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
            self._send(200, store.record(ip, ua, today_wib()))

        def log_message(self, fmt, *args):
            pass  # don't log visitor IPs

    return Handler


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    db_path = os.environ.get('TS_VISITS_DB', os.path.join(here, 'data', 'visits.db'))
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    host = os.environ.get('TS_VISITS_HOST', '127.0.0.1')
    port = int(os.environ.get('TS_VISITS_PORT', '8111'))
    server = ThreadingHTTPServer((host, port), make_handler(VisitStore(db_path)))
    print(f'TinySquish visits listening on {host}:{port} (db: {db_path})', flush=True)
    server.serve_forever()


if __name__ == '__main__':
    main()
