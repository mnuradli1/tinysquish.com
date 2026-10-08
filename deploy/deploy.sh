#!/usr/bin/env bash
# Deploy TinySquish static files to the nginx web root on this VPS.
#
#   deploy/deploy.sh                    backup → copy → verify live == repo → tests → IndexNow ping
#   deploy/deploy.sh --no-test          same, skip the browser regression tests
#   deploy/deploy.sh --rollback <tgz>   restore a backup made by a previous deploy
#
# Env: WEBROOT (default /var/www/tinysquish.com), SITE_URL (default https://tinysquish.com/),
#      BACKUP_DIR (default /var/backups/tinysquish). Needs passwordless sudo for the web root.
set -euo pipefail

WEBROOT="${WEBROOT:-/var/www/tinysquish.com}"
SITE_URL="${SITE_URL:-https://tinysquish.com/}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/tinysquish}"
REPO="$(cd "$(dirname "$0")/.." && pwd)"
FILES=(index.html style.css loader.js app.js sw.js UPNG.js pako.min.js favicon.svg fonts/dm-sans.woff2 fonts/OFL.txt
       robots.txt sitemap.xml llms.txt manifest.json og-image.png favicon.ico
       icons/icon-192.png icons/icon-512.png icons/icon-maskable-512.png icons/apple-touch-icon.png)
# IndexNow (Bing, Yandex, Seznam...): the key is public by design, it only proves domain ownership
INDEXNOW_KEY=14e88c1d684501e42acfa1154a3bcca2
FILES+=("$INDEXNOW_KEY.txt")

die() { echo "deploy: $*" >&2; exit 1; }

backup() {  # $1 = label; prints the archive path
  local out="$BACKUP_DIR/pre-$1-$(date +%Y%m%d%H%M%S).tgz"
  sudo mkdir -p "$BACKUP_DIR"
  sudo tar czf "$out" -C "$WEBROOT" .
  echo "$out"
}

if [ "${1:-}" = "--rollback" ]; then
  archive="${2:-}"
  [ -f "$archive" ] || die "backup not found: ${archive:-<missing path>} (see ls $BACKUP_DIR)"
  safety=$(backup "rollback")
  sudo tar xzf "$archive" -C "$WEBROOT"
  echo "Restored $archive into $WEBROOT"
  echo "State before the rollback saved to $safety"
  exit 0
fi

RUN_TESTS=1
[ "${1:-}" = "--no-test" ] && RUN_TESTS=0

cd "$REPO"
# Only committed code goes live, so a deploy can always be traced to a commit
[ -z "$(git status --porcelain)" ] || die "working tree is dirty; commit or stash first"
sha=$(git rev-parse --short HEAD)
for f in "${FILES[@]}"; do [ -f "$f" ] || die "missing $f"; done

page_changed=0
cmp -s index.html "$WEBROOT/index.html" || page_changed=1
if [ "$page_changed" = 1 ] && cmp -s sitemap.xml "$WEBROOT/sitemap.xml"; then
  echo "note: index.html changed but sitemap.xml didn't; consider bumping <lastmod>" >&2
fi

archive=$(backup "$sha")
echo "Backup: $archive"

for f in "${FILES[@]}"; do
  sudo install -D -o www-data -g www-data -m 644 "$f" "$WEBROOT/$f"
done
echo "Copied ${#FILES[@]} files from $sha to $WEBROOT"

bad=0
for f in "${FILES[@]}"; do
  if curl -fsS "${SITE_URL}$f" | cmp -s - "$f"; then echo "  live == repo  $f"
  else echo "  MISMATCH      $f" >&2; bad=1; fi
done
[ "$bad" = 0 ] || die "live files differ from the repo; rollback: $0 --rollback $archive"

if [ "$RUN_TESTS" = 1 ]; then
  python3 tests/seo-check.py "$SITE_URL" || die "SEO checks failed on live; rollback: $0 --rollback $archive"
  TINYSQUISH_URL="$SITE_URL" NODE_PATH="${NODE_PATH:-$HOME/node_modules}" node tests/browser-regressions.js \
    || die "regression tests failed on live; rollback: $0 --rollback $archive"
fi

# Tell IndexNow engines the page changed; only for real content changes, and never fatal
if [ "$page_changed" = 1 ] && [ "$SITE_URL" = "https://tinysquish.com/" ]; then
  code=$(curl -s -o /dev/null -w '%{http_code}' -X POST https://api.indexnow.org/indexnow \
    -H 'Content-Type: application/json; charset=utf-8' \
    -d "{\"host\":\"tinysquish.com\",\"key\":\"$INDEXNOW_KEY\",\"keyLocation\":\"${SITE_URL}$INDEXNOW_KEY.txt\",\"urlList\":[\"$SITE_URL\"]}") || code=000
  case "$code" in
    200|202) echo "IndexNow: notified ($code)" ;;
    *) echo "IndexNow: warning, HTTP $code (deploy is fine; retry later)" >&2 ;;
  esac
fi

echo "Deployed $sha. Rollback: $0 --rollback $archive"
