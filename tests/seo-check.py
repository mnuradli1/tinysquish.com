#!/usr/bin/env python3
"""SEO / GEO checks on what a crawler sees WITHOUT running JavaScript.

AI crawlers (GPTBot, ClaudeBot, PerplexityBot) and link-preview bots don't execute JS,
so everything that matters has to be in the raw HTML and the static files next to it.

Usage: python3 tests/seo-check.py [base_url]     (default: serves the repo locally)
"""
import html
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
        return e.code, e.headers.get("Content-Type", ""), e.read()


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


def check_page(base, url, seen):
    """Per-page checks; returns the parsed page for cross-page checks."""
    local = url.replace(CANONICAL, base)
    status, ctype, body = fetch(local)
    path = url[len(CANONICAL) - 1:]
    ok200 = status == 200 and "text/html" in ctype
    check(f"{path}: 200 HTML", ok200, f"{status} {ctype}")
    if not ok200:
        return None
    page = Page()
    page.feed(body.decode("utf-8", "replace"))
    page.url, page.path = url, path
    page.words = len(re.findall(r"[A-Za-z0-9’']+", " ".join(page.text)))
    t = re.search(rb"<title>(.*?)</title>", body, re.S)
    page.title = html.unescape(t.group(1).decode().strip()) if t else ""
    page.desc = page.meta.get("description", "")
    page.alts = dict(re.findall(r'<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"', body.decode()))
    page.hrefs = set(re.findall(r'href="(/[^"#]*)"', body.decode()))

    problems = []
    if not 30 <= len(page.title) <= 65: problems.append(f"title {len(page.title)} chars")
    if not 70 <= len(page.desc) <= 160: problems.append(f"description {len(page.desc)} chars")
    if not page.lang: problems.append("no lang")
    if page.links.get("canonical") != url: problems.append(f"canonical={page.links.get('canonical')}")
    if page.meta.get("og:url") != url: problems.append("og:url mismatch")
    if len(page.h1) != 1: problems.append(f"h1 count {len(page.h1)}")
    if page.words < 250: problems.append(f"only {page.words} words")
    if page.meta.get("twitter:card") != "summary_large_image": problems.append("twitter:card")
    if not page.meta.get("og:image", "").startswith("https://"): problems.append("og:image")
    for field, value in (("title", page.title), ("description", page.desc)):
        if value in seen[field]:
            problems.append(f"duplicate {field} with {seen[field][value]}")
        seen[field][value] = path
    check(f"{path}: title, description, canonical, h1, >=250 words, social tags", not problems,
          "; ".join(problems) or f"{page.words} words")

    graph = []
    for block in page.jsonld:
        try:
            data = json.loads(block)
            graph += data.get("@graph", [data])
        except json.JSONDecodeError as e:
            check(f"{path}: JSON-LD parses", False, str(e))
    dumped = json.dumps(graph)
    check(f"{path}: JSON-LD present, no self-awarded ratings", graph and "aggregateRating" not in dumped and '"review"' not in dumped)
    faq = next((n for n in graph if n.get("@type") == "FAQPage"), None)
    if faq:
        visible = " ".join(" ".join(page.text).split())
        stale = [q["name"][:40] for q in faq["mainEntity"]
                 if q["name"] not in visible or " ".join(q["acceptedAnswer"]["text"].split()) not in visible]
        check(f"{path}: FAQ JSON-LD matches visible FAQ", not stale, f"{len(faq['mainEntity'])} Q&As, mismatched={stale}")
    page.graph = graph
    return page


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

    # ---- Site-level files
    s, ct, data = fetch(base + "robots.txt")
    txt = data.decode(errors="replace")
    check("robots.txt is text/plain with a Sitemap line", s == 200 and "text/plain" in ct and f"Sitemap: {CANONICAL}sitemap.xml" in txt, f"{s} {ct}")
    check("robots.txt doesn't block the site", not re.search(r"(?m)^Disallow:\s*/\s*$", txt))

    s, ct, data = fetch(base + "sitemap.xml")
    try:
        locs = [e.text for e in ET.fromstring(data).iter("{http://www.sitemaps.org/schemas/sitemap/0.9}loc")]
    except ET.ParseError:
        locs = []
    check("sitemap.xml is valid and lists the homepage", s == 200 and CANONICAL in locs, f"{s} {len(locs)} URLs")

    s, ct, data = fetch(base + "llms.txt")
    llms = data.decode(errors="replace")
    check("llms.txt is text/plain markdown with an H1", s == 200 and "text/plain" in ct and data.startswith(b"# "), f"{s} {ct}")
    check("llms.txt lists every sitemap URL", all(u in llms for u in locs), f"missing={[u for u in locs if u not in llms]}")

    s, ct, data = fetch(base + "bench/results.json")
    check("benchmark data is published as JSON", s == 200 and data.startswith(b"{"), f"{s}")

    # ---- Every page in the sitemap
    seen = {"title": {}, "description": {}}
    pages = {}
    for url in locs:
        p = check_page(base, url, seen)
        if p:
            pages[url] = p

    # hreflang must be reciprocal: if A says B is its "id" version, B must point back to A
    bad = []
    for url, p in pages.items():
        for lang, target in p.alts.items():
            if lang == "x-default":
                continue
            other = pages.get(target)
            if not other or other.alts.get(p.lang) != url:
                bad.append(f"{p.path} -> {lang}")
    check("hreflang alternates are reciprocal", not bad, str(bad) if bad else f"{sum(bool(p.alts) for p in pages.values())} pages with alternates")

    # Internal links resolve (crawlers and users shouldn't hit 404s)
    hrefs = sorted(set().union(*(p.hrefs for p in pages.values())))
    broken = [h for h in hrefs if fetch(base + h.lstrip("/"))[0] != 200]
    check("all internal links resolve", not broken, f"{len(hrefs)} links, broken={broken}")

    home = pages.get(CANONICAL)
    if home:
        types = {n.get("@type") for n in home.graph}
        check("homepage JSON-LD has WebApplication + FAQPage", {"WebApplication", "FAQPage"} <= types, str(sorted(types)))
        app = next((n for n in home.graph if n.get("@type") == "WebApplication"), {})
        check("WebApplication marks the app as free", app.get("offers", {}).get("price") == "0" and app.get("isAccessibleForFree") is True)

        og_img = home.meta.get("og:image", "")
        s, ct, data = fetch(og_img if live else og_img.replace(CANONICAL, base))
        check("og:image is a 1200x630 PNG", s == 200 and png_size(data) == (1200, 630), f"{s} {png_size(data) if data else ''}")
        manifest_href = home.links.get("manifest", "")
        s, ct, data = fetch(base + manifest_href.lstrip("/"))
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
        touch = home.links.get("apple-touch-icon", "")
        s, _, d = fetch(base + touch.lstrip("/"))
        check("apple-touch-icon is a 180x180 PNG", s == 200 and png_size(d) == (180, 180), f"{touch} {s}")
    s, ct, d = fetch(base + "favicon.ico")
    check("/favicon.ico exists", s == 200 and d[:4] == b"\x00\x00\x01\x00", f"{s} {ct}")

    # Unknown URLs: a real 404 status (live nginx) and a noindex page
    s, ct, d = fetch(base + "no-such-page-xyz/")
    s2, _, d404 = fetch(base + "404.html")
    check("404 page exists and is noindex", s2 == 200 and b'content="noindex"' in d404)
    if live:
        check("unknown URLs return HTTP 404 with the custom page", s == 404 and b"This page doesn" in d, f"{s}")

    if server:
        server.shutdown()
    failed = results.count(False)
    print(f"\n{len(results) - failed}/{len(results)} passed")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
