#!/usr/bin/env python3
"""Which search engines and AI crawlers fetch tinysquish.com, and what they read.

    python3 tools/crawler-report.py [days=14]

Reads the site's own nginx log (/var/log/nginx/tinysquish.access.log and its rotations,
via `sudo zcat` because nginx logs are root/adm-only). Humans are summarized separately.
"""
import re
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone

LOG = "/var/log/nginx/tinysquish.access.log"
LINE = re.compile(r'^\S+ \S+ \S+ \[([^\]]+)\] "(\S+) (\S+)[^"]*" (\d{3}) \S+ "[^"]*" "([^"]*)"')

# Order matters: more specific names first
BOTS = [
    ("OAI-SearchBot", "OpenAI search"), ("ChatGPT-User", "ChatGPT (user fetch)"), ("GPTBot", "OpenAI GPTBot"),
    ("Claude-SearchBot", "Claude search"), ("Claude-User", "Claude (user fetch)"), ("ClaudeBot", "Anthropic ClaudeBot"),
    ("Perplexity-User", "Perplexity (user fetch)"), ("PerplexityBot", "PerplexityBot"),
    ("Google-Extended", "Google-Extended"), ("Googlebot", "Googlebot"), ("Google-InspectionTool", "Google inspection"),
    ("bingbot", "Bingbot"), ("Applebot", "Applebot"), ("DuckDuckBot", "DuckDuckBot"), ("YandexBot", "YandexBot"),
    ("Amazonbot", "Amazonbot"), ("Bytespider", "Bytespider"), ("CCBot", "Common Crawl"),
    ("meta-externalagent", "Meta AI"), ("facebookexternalhit", "Facebook preview"), ("Twitterbot", "X preview"),
    ("Slackbot", "Slack preview"), ("WhatsApp", "WhatsApp preview"), ("Discordbot", "Discord preview"),
    ("AhrefsBot", "Ahrefs"), ("SemrushBot", "Semrush"),
]
GENERIC_BOT = re.compile(r"bot|crawl|spider|slurp|curl|wget|python|go-http|headless|lighthouse", re.I)


def kind(path):
    p = path.split("?")[0]
    if p in ("/robots.txt", "/sitemap.xml", "/llms.txt"):
        return p
    if p.endswith("/") or p.endswith(".html"):
        return "page"
    return "asset"


def main():
    days = int(sys.argv[1]) if len(sys.argv) > 1 else 14
    since = datetime.now(timezone.utc) - timedelta(days=days)
    raw = subprocess.run(["bash", "-c", f"sudo -n zcat -f {LOG} {LOG}.* 2>/dev/null"],
                         capture_output=True, text=True, errors="replace").stdout
    bots = defaultdict(Counter)
    pages_by_bot = defaultdict(Counter)
    humans = Counter()
    for line in raw.splitlines():
        m = LINE.match(line)
        if not m:
            continue
        when = datetime.strptime(m.group(1), "%d/%b/%Y:%H:%M:%S %z")
        if when < since:
            continue
        _, path, status, ua = m.group(2), m.group(3), m.group(4), m.group(5)
        name = next((label for key, label in BOTS if key.lower() in ua.lower()), None)
        if name is None and GENERIC_BOT.search(ua or "x"):
            name = "Other bots/tools"
        k = kind(path)
        if name:
            bots[name][k] += 1
            if k == "page":
                pages_by_bot[name][path.split("?")[0]] += 1
        elif k == "page" and status == "200":
            humans[path.split("?")[0]] += 1

    print(f"Crawlers on tinysquish.com, last {days} days\n")
    print(f"{'crawler':26} {'pages':>6} {'robots':>7} {'sitemap':>8} {'llms.txt':>9} {'assets':>7}")
    for name, c in sorted(bots.items(), key=lambda kv: -sum(kv[1].values())):
        print(f"{name:26} {c['page']:>6} {c['/robots.txt']:>7} {c['/sitemap.xml']:>8} {c['/llms.txt']:>9} {c['asset']:>7}")
    print("\nPages fetched by AI crawlers:")
    for name, c in pages_by_bot.items():
        if any(w in name for w in ("OpenAI", "ChatGPT", "Claude", "Anthropic", "Perplexity", "Google-Extended", "Meta AI")):
            print(f"  {name}: " + ", ".join(f"{p} ({n})" for p, n in c.most_common(8)))
    print(f"\nHuman page views (non-bot user agents): {sum(humans.values())}")
    for path, n in humans.most_common(15):
        print(f"  {n:>5}  {path}")


if __name__ == "__main__":
    main()
