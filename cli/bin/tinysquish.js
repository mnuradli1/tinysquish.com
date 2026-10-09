#!/usr/bin/env node
// TinySquish CLI: compress, resize and convert images locally. Nothing is uploaded.
'use strict';

const path = require('path');
const { parseArgs } = require('util');
const { run, parseSize } = require('../run');
const { normalizeFormat } = require('../core');
const { version } = require('../../package.json');

const HELP = `TinySquish ${version} — compress, resize and convert images locally (nothing is uploaded)

Usage: tinysquish <file|folder>... [options]

Options:
  -q, --quality <10-95>   quality, default 75 (PNG: 90+ lossless, lower = smaller palette).
                          With --max it is the upper limit.
  -f, --format <fmt>      original (default) | jpeg | png | webp
  -m, --max <size>        fit every image under a size, e.g. 100kb, 1mb
  -r, --resize <percent>  scale both sides, e.g. 50 or 50%
      --width <px>        target width (height keeps the aspect ratio unless --height is set)
      --height <px>       target height
  -o, --out <dir>         write results here (default: next to each input)
  -s, --suffix <text>     added to output names, default "-compressed"
      --overwrite         replace existing output files instead of numbering them
      --dry-run           compress in memory and report, write nothing
      --json              print results as JSON (for scripts and agents)
  -h, --help              show this help
  -v, --version           show the version

Inputs are never modified. Folders are scanned recursively.

Examples:
  tinysquish photo.jpg --max 100kb
  tinysquish ./screenshots -f webp -o ./web
  tinysquish banner.png --width 1200 -q 90
  tinysquish *.png --json`;

function fmtBytes(n) {
  return n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`;
}

function fail(msg) {
  process.stderr.write(`tinysquish: ${msg}\nRun "tinysquish --help" for usage.\n`);
  process.exit(2);
}

async function main() {
  let args;
  try {
    args = parseArgs({
      allowPositionals: true,
      options: {
        quality: { type: 'string', short: 'q' }, format: { type: 'string', short: 'f' },
        max: { type: 'string', short: 'm' }, resize: { type: 'string', short: 'r' },
        width: { type: 'string' }, height: { type: 'string' }, out: { type: 'string', short: 'o' },
        suffix: { type: 'string', short: 's' }, overwrite: { type: 'boolean' }, 'dry-run': { type: 'boolean' },
        json: { type: 'boolean' }, help: { type: 'boolean', short: 'h' }, version: { type: 'boolean', short: 'v' },
      },
    });
  } catch (e) {
    fail(e.message);
  }
  const { values: v, positionals } = args;
  if (v.help) return console.log(HELP);
  if (v.version) return console.log(version);
  if (!positionals.length) fail('no input files or folders');

  const int = (name, text, min, max) => {
    const n = Number(String(text).replace(/%$/, ''));
    if (!Number.isFinite(n) || n < min || n > max) fail(`--${name} must be between ${min} and ${max} (got "${text}")`);
    return Math.round(n);
  };
  const opts = { suffix: v.suffix ?? '-compressed', outDir: v.out, overwrite: !!v.overwrite, dryRun: !!v['dry-run'] };
  if (v.quality !== undefined) opts.quality = int('quality', v.quality, 10, 95);
  if (v.format !== undefined) { try { opts.format = normalizeFormat(v.format); } catch (e) { fail(e.message); } }
  if (v.max !== undefined) { try { opts.maxBytes = parseSize(v.max); } catch (e) { fail(e.message); } }
  if (v.resize !== undefined) opts.resizePercent = int('resize', v.resize, 1, 400);
  if (v.width !== undefined) opts.width = int('width', v.width, 1, 65535);
  if (v.height !== undefined) opts.height = int('height', v.height, 1, 65535);
  if (opts.resizePercent && (opts.width || opts.height)) fail('use either --resize or --width/--height');
  if (!opts.suffix && !opts.outDir) fail('an empty --suffix needs --out, so inputs are never overwritten');

  const cwd = process.cwd();
  const rel = (p) => (p && path.relative(cwd, p).startsWith('..') ? p : p && path.relative(cwd, p));
  let results;
  try {
    results = await run(positionals, opts, (r) => {
      if (v.json) return;
      if (r.error) return process.stderr.write(`✗ ${rel(r.input)}: ${r.error}\n`);
      const notes = [r.keptOriginal && 'kept original', r.resized && `${r.width}×${r.height}`,
        r.targetMet === false && 'over max size'].filter(Boolean).join(', ');
      console.log(`✓ ${rel(r.input)}  ${fmtBytes(r.inBytes)} → ${fmtBytes(r.outBytes)} (${r.reductionPct > 0 ? '−' : ''}${Math.abs(r.reductionPct)}%)`
        + (r.output ? `  → ${rel(r.output)}` : '') + (notes ? `  [${notes}]` : ''));
    });
  } catch (e) {
    fail(e.message);
  }
  const ok = results.filter(r => !r.error);
  if (v.json) {
    console.log(JSON.stringify({ results, summary: { files: results.length, failed: results.length - ok.length,
      inBytes: ok.reduce((a, r) => a + r.inBytes, 0), outBytes: ok.reduce((a, r) => a + r.outBytes, 0) } }, null, 2));
  } else if (results.length > 1) {
    const inB = ok.reduce((a, r) => a + r.inBytes, 0), outB = ok.reduce((a, r) => a + r.outBytes, 0);
    console.log(`\n${ok.length} of ${results.length} image(s): ${fmtBytes(inB)} → ${fmtBytes(outB)}`
      + (inB ? ` (${Math.round(100 * (1 - outB / inB))}% smaller)` : ''));
  }
  process.exitCode = ok.length === results.length ? 0 : 1;
}

main();
