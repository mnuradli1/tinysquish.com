#!/usr/bin/env python3
"""SEO / GEO checks on what a crawler sees WITHOUT running JavaScript.

AI crawlers (GPTBot, ClaudeBot, PerplexityBot) and link-preview bots don't execute JS,
so everything that matters has to be in the raw HTML and the static files next to it.

Usage: python3 tests/seo-check.py [base_url]     (default: serves the repo locally)
"""
import http.server
import json
import re
import struct
import sys
import threading
import urllib.request
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path

CANONICAL = "https://tinysquish.com/"
results = []


def check(name, ok, info=""):
    results.append(ok)
    print(f"{'PASS' if ok else 'FAIL'}  {name}" + (f"  — {info}" if info else ""))


def fetch(url):
    if not url.startswith("http"):
        return 0, "", b""
    req = urllib.request.Request(url, headers={"User-Agent": "seo-check"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return r.status, r.headers.get("Content-Type", ""), r.read()
    except urllib.error.HTTPError as e:
        return e.code, e.headers.get("Content-Type", ""), b""


class Page(HTMLParser):
    """Collects meta/link tags, headings, JSON-LD and visible text (outside script/style/noscript)."""

    def __init__(self):
        super().__init__()
        self.meta, self.links, self.h1, self.jsonld, self.text = {}, {}, [], [], []
        self.lang = None
        self._skip = 0
        self._in = None
        self._buf = ""

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "html":
            self.lang = a.get("lang")
        if tag == "meta":
            key = a.get("name") or a.get("property")
            if key:
                self.meta[key] = a.get("content", "")
        if tag == "link" and a.get("rel"):
            self.links[a["rel"]] = a.get("href", "")
        if tag in ("script", "style", "noscript"):
            self._skip += 1
            if tag == "script" and a.get("type") == "application/ld+json":
                self._in, self._buf = "jsonld", ""
        if tag == "h1":
            self._in, self._buf = "h1", ""

    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript"):
            self._skip -= 1
            if self._in == "jsonld":
                self.jsonld.append(self._buf)
                self._in = None
        if tag == "h1" and self._in == "h1":
            self.h1.append(self._buf.strip())
            self._in = None

    def handle_data(self, data):
        if self._in:
            self._buf += data
        if not self._skip:
            self.text.append(data)


def png_size(data):
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        return None
    return struct.unpack(">II", data[16:24])


def main():
    base = sys.argv[1] if len(sys.argv) > 1 else None
    server = None
    if not base:
        root = Path(__file__).resolve().parent.parent
        handler = lambda *a, **k: http.server.SimpleHTTPRequestHandler(*a, directory=str(root), **k)
        http.server.SimpleHTTPRequestHandler.log_message = lambda *a: None
        server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
        threading.Thread(target=server.serve_forever, daemon=True).start()
        base = f"http://127.0.0.1:{server.server_address[1]}/"
    base = base.rstrip("/") + "/"
    live = base == CANONICAL

    status, ctype, body = fetch(base)
    check("homepage returns 200 HTML", status == 200 and "text/html" in ctype, f"{status} {ctype}")
    page = Page()
    page.feed(body.decode("utf-8", "replace"))
    words = len(re.findall(r"[A-Za-z0-9’']+", " ".join(page.text)))

    title = re.search(rb"<title>(.*?)</title>", body, re.S)
    title = title.group(1).decode().strip() if title else ""
    desc = page.meta.get("description", "")
    check("title is 30-65 chars", 30 <= len(title) <= 65, f"{len(title)}: {title}")
    check("meta description is 70-160 chars", 70 <= len(desc) <= 160, f"{len(desc)}")
    check("html lang set", bool(page.lang), str(page.lang))
    check("canonical is the absolute apex URL", page.links.get("canonical") == CANONICAL, page.links.get("canonical", ""))
    check("exactly one <h1> in raw HTML", len(page.h1) == 1, str(page.h1))
    check(">= 300 words of crawlable text without JS", words >= 300, f"{words} words")

    # Structured data must parse and mirror visible content (Google requires FAQ answers be on the page)
    graph = []
    for block in page.jsonld:
        try:
            data = json.loads(block)
            graph += data.get("@graph", [data])
        except json.JSONDecodeError as e:
            check("JSON-LD parses", False, str(e))
    types = {n.get("@type") for n in graph}
    check("JSON-LD has WebApplication + FAQPage", {"WebApplication", "FAQPage"} <= types, str(sorted(types)))
    app = next((n for n in graph if n.get("@type") == "WebApplication"), {})
    check("WebApplication marks the app as free", app.get("offers", {}).get("price") == "0" and app.get("isAccessibleForFree") is True)
    check("no self-awarded ratings/reviews in JSON-LD", "aggregateRating" not in json.dumps(graph) and '"review"' not in json.dumps(graph))
    faq = next((n for n in graph if n.get("@type") == "FAQPage"), {})
    questions = [q.get("name", "") for q in faq.get("mainEntity", [])]
    visible = " ".join(" ".join(page.text).split())
    missing = [q for q in questions if q not in visible]
    check("every FAQ question in JSON-LD is visible on the page", questions and not missing, f"{len(questions)} questions, missing={missing}")
    answers = [q.get("acceptedAnswer", {}).get("text", "") for q in faq.get("mainEntity", [])]
    stale = [a[:40] for a in answers if " ".join(a.split()) not in visible]
    check("every FAQ answer in JSON-LD matches the visible answer", answers and not stale, f"mismatched={stale}")

    # Social previews / generative engines pick up these
    og_img = page.meta.get("og:image", "")
    check("og:title / og:description / og:url set", all(page.meta.get(k) for k in ("og:title", "og:description", "og:url")))
    check("twitter:card is summary_large_image", page.meta.get("twitter:card") == "summary_large_image")
    check("og:image is an absolute https URL", og_img.startswith("https://"), og_img)
    img_url = og_img.replace(CANONICAL, base) if not live else og_img
    s, ct, data = fetch(img_url)
    check("og:image is a 1200x630 PNG", s == 200 and png_size(data) == (1200, 630), f"{s} {png_size(data) if data else ''}")
    check("og:image:alt set", bool(page.meta.get("og:image:alt")))

    s, ct, data = fetch(base + "robots.txt")
    txt = data.decode(errors="replace")
    check("robots.txt is text/plain with a Sitemap line", s == 200 and "text/plain" in ct and f"Sitemap: {CANONICAL}sitemap.xml" in txt, f"{s} {ct}")
    check("robots.txt doesn't block the site", not re.search(r"(?m)^Disallow:\s*/\s*$", txt))

    s, ct, data = fetch(base + "sitemap.xml")
    try:
        locs = [e.text for e in ET.fromstring(data).iter("{http://www.sitemaps.org/schemas/sitemap/0.9}loc")]
    except ET.ParseError:
        locs = []
    check("sitemap.xml is valid and lists the canonical URL", s == 200 and CANONICAL in locs, f"{s} {locs}")

    s, ct, data = fetch(base + "llms.txt")
    check("llms.txt is text/plain markdown with an H1", s == 200 and "text/plain" in ct and data.startswith(b"# "), f"{s} {ct}")

    manifest_href = page.links.get("manifest", "")
    s, ct, data = fetch(base + manifest_href) if manifest_href else (0, "", b"")
    try:
        mf = json.loads(data)
    except json.JSONDecodeError:
        mf = {}
    check("manifest.json linked and valid", s == 200 and mf.get("name") and mf.get("start_url"), f"{manifest_href} {s}")
    sizes = set()
    for ic in mf.get("icons", []):
        s2, _, d2 = fetch(base + ic["src"].lstrip("/"))
        if s2 == 200 and png_size(d2):
            sizes.add(png_size(d2))
    check("manifest icons 192 + 512 exist", {(192, 192), (512, 512)} <= sizes, str(sorted(sizes)))
    touch = page.links.get("apple-touch-icon", "")
    s, _, d = fetch(base + touch) if touch else (0, "", b"")
    check("apple-touch-icon is a 180x180 PNG", s == 200 and png_size(d) == (180, 180), f"{touch} {s}")
    s, ct, d = fetch(base + "favicon.ico")
    check("/favicon.ico exists", s == 200 and d[:4] == b"\x00\x00\x01\x00", f"{s} {ct}")

    if server:
        server.shutdown()
    failed = results.count(False)
    print(f"\n{len(results) - failed}/{len(results)} passed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
