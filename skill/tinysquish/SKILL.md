---
name: tinysquish
description: Compress, resize or convert images (PNG, JPEG, WebP) locally with the TinySquish CLI — nothing is uploaded. Use when the user wants images smaller, needs a file under an upload limit (e.g. "under 100 KB", "max 1 MB"), wants PNG/JPEG converted to WebP, wants images optimized for a website or README, or wants a whole folder batch-compressed or resized.
---

# TinySquish: local image compression

TinySquish compresses images on this machine with sharp/libvips. It never uploads files and
never modifies inputs: each result is written as `<name>-compressed.<ext>` next to the input
(or into `--out`). If the `tinysquish` MCP tools (`compress_images`, `image_info`) are available,
you may use them instead; they take the same options.

## Run it

```bash
npx -y tinysquish <files or folders> [options] --json
```

Use `--json` whenever you need to read the results; it prints
`{ results: [{ input, output, inBytes, outBytes, reductionPct, width, height, keptOriginal, targetMet, error }], summary }`.
Exit code 0 = all done, 1 = some files failed (see `error`), 2 = bad arguments.

| Option | Meaning |
|---|---|
| `-q, --quality 10-95` | default 75. PNG: 90+ is lossless, lower = fewer colors. With `--max` it is the upper limit |
| `-f, --format original\|jpeg\|png\|webp` | output format, default `original` |
| `-m, --max 100kb` | every output must fit under this size (best quality that fits; shrinks dimensions only if needed) |
| `-r, --resize 50%` · `--width 1200` · `--height 800` | resize (aspect ratio kept unless both sides are given) |
| `-o, --out DIR` | write results into DIR |
| `--dry-run` | report sizes without writing files |

## Recipes

| The user wants | Command |
|---|---|
| A photo under an upload limit | `npx -y tinysquish photo.jpg --max 100kb -f jpeg --json` |
| Images for a website | `npx -y tinysquish ./images -f webp -o ./images-web --json` |
| Smaller screenshots/diagrams, still PNG | `npx -y tinysquish ./docs/img -q 75 --json` |
| PNG with exact pixels (lossless) | `npx -y tinysquish logo.png -q 95 --json` |
| Thumbnails | `npx -y tinysquish ./photos --width 400 -f webp -o ./thumbs --json` |
| Just check how much would be saved | add `--dry-run` |

Choosing a format: JPEG or WebP for photos; PNG for screenshots, UI, logos and anything with
sharp edges or text; WebP when the result is for a website and transparency must be kept.
Converting to JPEG fills transparent areas with white.

## After running

1. Read the JSON. Report per file: original size → new size, the output path, and any notes:
   - `keptOriginal: true` — the image could not be made smaller, the output is an identical copy.
   - `targetMet: false` — the file could not reach `--max` even after shrinking; say so.
   - `width`/`height` differ from the input — the image was resized to meet `--max`.
2. Do not delete or replace the user's originals unless they ask. If they do, replace only after
   checking the outputs exist and `error` is absent.
3. EXIF metadata (camera, GPS) is not copied to outputs. Mention it if the user cares about metadata.

## Troubleshooting

- `npx` needs Node.js 20+. The first run downloads the package and its dependencies (about 50 MB on disk, mostly the sharp/libvips binary). For fully offline use, install it once with `npm install -g tinysquish` and run `tinysquish` directly.
- Unsupported input (e.g. HEIC, SVG): convert it with another tool first.
- Very large images can take a few seconds each with `--max` because several encodes are tried.
