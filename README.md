# 🐼 TinySquish

**Compress, resize and convert PNG, JPEG and WebP images in your browser. Nothing is uploaded.**

[tinysquish.com](https://tinysquish.com/) · [Benchmark](https://tinysquish.com/benchmark/) · [Bahasa Indonesia](https://tinysquish.com/id/) · MIT licensed

TinySquish is a free image compressor that runs entirely on your device. Images are decoded,
compressed and saved by JavaScript in the browser, so they never leave your computer or phone,
and the app keeps working offline after the first visit.

## Features

- **PNG, JPEG, WebP**: keep the format or convert between them
- **Quality slider** (10–95%): PNG becomes lossless at 90%+, palette-quantized below
- **Max size**: fit every image under 50 KB … 2 MB (best quality that fits, downscales only if needed)
- **Resize** by percentage or exact dimensions, aspect ratio locked by default
- **Batches** of up to 20 images, whole folders included, one ZIP download
- **Before/after slider** to check the result
- **Offline** via a service worker; **no cookies, no third-party analytics**
- English and Indonesian UI

## CLI, MCP server and agent skill

The same compressor for the terminal, scripts and AI agents. It runs on your machine:
no upload, no API key, no server. Needs Node.js 20+.

```bash
npx -y tinysquish photo.jpg --max 100kb          # fit an upload limit
npx -y tinysquish ./images -f webp -o ./web      # a folder → WebP
npx -y tinysquish ./shots --json                 # machine-readable results
npm install -g tinysquish                        # install once, then use offline
```

Inputs are never modified; results are written as `name-compressed.ext`. See `tinysquish --help`.

**MCP server** (tools `compress_images` and `image_info`, local stdio, no network):

```bash
claude mcp add tinysquish -- npx -y -p tinysquish tinysquish-mcp
```

```json
{ "mcpServers": { "tinysquish": { "command": "npx", "args": ["-y", "-p", "tinysquish", "tinysquish-mcp"] } } }
```

Add `"--allow", "/path/to/folder"` to the args to restrict which folders it may read and write.

**Agent skill**: [`skill/tinysquish/SKILL.md`](skill/tinysquish/SKILL.md), for Claude Code save it as
`~/.claude/skills/tinysquish/SKILL.md`. More: [tinysquish.com/cli](https://tinysquish.com/cli/).

The CLI follows the same rules as the web app (quality, lossless PNG from 90%, max size, never larger
than the original) but encodes with libvips via sharp, so sizes are similar, not byte-identical.

## How it works

| Format | Encoder |
|---|---|
| JPEG, WebP | The browser's own encoders through the Canvas API (`canvas.toBlob`) |
| PNG | [UPNG.js](https://github.com/photopea/UPNG.js) color quantization + [pako](https://github.com/nodeca/pako) DEFLATE |

There is no build step: the site is static HTML, CSS and vanilla JavaScript.

```
app.js            compressor UI and engine (injected into #app-root by loader.js)
loader.js         loads pako → UPNG → app.js, registers the service worker
sw.js             network-first service worker for offline use
style.css         all styles
tools/
  build-site.py   generates every HTML page, sitemap.xml and llms.txt from one template
  benchmark.js    reproducible size/PSNR benchmark → bench/results.json
  render-assets.js  renders og-image.png, icons and favicon.ico
  crawler-report.py search/AI crawler activity from the nginx log
cli/              npm package "tinysquish": core.js, run.js, bin/tinysquish(-mcp).js, tests
skill/            agent skill (SKILL.md)
server/visits.py  tiny anonymous visit counter (stdlib + SQLite, no raw IPs stored)
deploy/           nginx config, systemd unit, deploy.sh
tests/            browser regression tests (Playwright) and SEO checks
```

## Run it locally

```bash
python3 -m http.server 8000      # then open http://localhost:8000
```

Edit page content in `tools/build-site.py`, then regenerate:

```bash
python3 tools/build-site.py
```

## Tests

```bash
NODE_PATH=~/node_modules node tests/browser-regressions.js   # bug regressions (needs playwright + chromium)
NODE_PATH=~/node_modules node tests/features.js              # every user-facing feature, incl. offline
python3 tests/seo-check.py                                    # crawler view of every page
cd server && python3 -m unittest test_visits                  # visit counter
npm install && npm test                                       # CLI + MCP (node:test)
```

Both browser and SEO checks also run against production: `TINYSQUISH_URL=https://tinysquish.com/ …`
and `python3 tests/seo-check.py https://tinysquish.com/`.

## Benchmark

`tools/benchmark.js` drives the real app over the [Kodak photo suite](https://r0k.us/graphics/kodak/)
and UI screenshots and records size and PSNR per image. Latest results:
[tinysquish.com/benchmark](https://tinysquish.com/benchmark/) ([raw JSON](bench/results.json)).

```bash
NODE_PATH=~/node_modules node tools/benchmark.js /path/to/kodak
```

## Deploy

`deploy/deploy.sh` backs up the web root, copies the files, verifies that live matches the repo,
runs the SEO and browser tests against production and notifies IndexNow about changed pages.
`deploy/deploy.sh --rollback <backup.tgz>` restores a backup.

## License

[MIT](LICENSE) © Nur Adli. Bundled third-party code and fonts keep their own licenses, see
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

Bug or idea? [Open an issue](https://github.com/mnuradli1/tinysquish.com/issues).
