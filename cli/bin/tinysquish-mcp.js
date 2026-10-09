#!/usr/bin/env node
// TinySquish MCP server (stdio). Compresses images on the machine it runs on; it opens no
// network connections and never uploads anything.
//
//   tinysquish-mcp                       any path the user can read/write
//   tinysquish-mcp --allow ~/Pictures    only inside these folders (repeatable)
//   TINYSQUISH_ALLOWED_DIRS=/a:/b        same, via environment (path-delimiter separated)
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const z = require('zod');
const sharp = require('sharp');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { run, parseSize } = require('../run');
const { version } = require('../../package.json');

const expand = (p) => path.resolve(p.replace(/^~(?=$|[\\/])/, os.homedir()));
const allowed = [];
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--allow' && process.argv[i + 1]) allowed.push(expand(process.argv[++i]));
}
if (process.env.TINYSQUISH_ALLOWED_DIRS) {
  allowed.push(...process.env.TINYSQUISH_ALLOWED_DIRS.split(path.delimiter).filter(Boolean).map(expand));
}

function checkPath(p, label) {
  const abs = expand(p);
  if (allowed.length) {
    // realpath so a symlink can't point outside the allowed folders
    let real = abs;
    try { real = fs.realpathSync(abs); } catch { /* output folder may not exist yet */ }
    const ok = allowed.some(dir => { const rel = path.relative(dir, real); return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel)); });
    if (!ok) throw new Error(`${label} ${p} is outside the allowed folders: ${allowed.join(', ')}`);
  }
  return abs;
}

const fmtBytes = (n) => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`;

const server = new McpServer({ name: 'tinysquish', version }, {
  instructions: 'TinySquish compresses, resizes and converts PNG, JPEG and WebP images on this machine. '
    + 'Pass absolute paths. Inputs are never modified: results are written as <name>-compressed.<ext> next to each '
    + 'input or into out_dir. Use max_size (e.g. "100kb") when a file must fit an upload limit, format "webp" for '
    + 'websites, and quality 90+ with PNG for lossless output.',
});

const result = z.object({
  input: z.string(), output: z.string().nullable().optional(), error: z.string().optional(), format: z.string().optional(),
  inBytes: z.number().optional(), outBytes: z.number().optional(), reductionPct: z.number().optional(),
  width: z.number().optional(), height: z.number().optional(), resized: z.boolean().optional(),
  keptOriginal: z.boolean().optional(), targetMet: z.boolean().nullable().optional(),
}).passthrough();

server.registerTool('compress_images', {
  title: 'Compress images',
  description: 'Compress, convert and/or resize PNG, JPEG and WebP images locally (nothing is uploaded). '
    + 'Accepts files and folders (scanned recursively). Writes new files and never modifies the inputs. '
    + 'Returns per-file sizes, dimensions and output paths.',
  inputSchema: {
    paths: z.array(z.string()).min(1).describe('Absolute paths of image files and/or folders'),
    quality: z.number().int().min(10).max(95).optional().describe('10–95, default 75. PNG: 90+ is lossless. With max_size this is the upper limit.'),
    format: z.enum(['original', 'jpeg', 'png', 'webp']).optional().describe('Output format, default "original"'),
    max_size: z.string().optional().describe('Fit every output under this size, e.g. "100kb", "1mb". Uses the best quality that fits and shrinks dimensions only if needed.'),
    resize_percent: z.number().min(1).max(400).optional().describe('Scale both sides by this percentage'),
    width: z.number().int().min(1).max(65535).optional().describe('Target width in px (height keeps the aspect ratio unless set)'),
    height: z.number().int().min(1).max(65535).optional().describe('Target height in px'),
    out_dir: z.string().optional().describe('Folder for the results (default: next to each input)'),
    suffix: z.string().optional().describe('Added to output file names, default "-compressed"'),
    overwrite: z.boolean().optional().describe('Replace existing output files instead of numbering them'),
    dry_run: z.boolean().optional().describe('Compress in memory and report sizes without writing files'),
  },
  outputSchema: {
    results: z.array(result),
    summary: z.object({ files: z.number(), failed: z.number(), inBytes: z.number(), outBytes: z.number() }),
  },
  annotations: { title: 'Compress images', readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
}, async (args) => {
  try {
    if (args.resize_percent && (args.width || args.height)) throw new Error('use either resize_percent or width/height');
    const suffix = args.suffix ?? '-compressed';
    if (!suffix && !args.out_dir) throw new Error('an empty suffix needs out_dir, so inputs are never overwritten');
    const opts = {
      quality: args.quality, format: args.format, resizePercent: args.resize_percent, width: args.width, height: args.height,
      maxBytes: args.max_size ? parseSize(args.max_size) : undefined, suffix, overwrite: !!args.overwrite, dryRun: !!args.dry_run,
      outDir: args.out_dir ? checkPath(args.out_dir, 'out_dir') : undefined,
      checkInput: allowed.length ? (file) => checkPath(file, 'path') : undefined,
    };
    const results = await run(args.paths.map(p => checkPath(p, 'path')), opts);
    const ok = results.filter(r => !r.error);
    const summary = { files: results.length, failed: results.length - ok.length,
      inBytes: ok.reduce((a, r) => a + r.inBytes, 0), outBytes: ok.reduce((a, r) => a + r.outBytes, 0) };
    const lines = results.map(r => r.error ? `✗ ${r.input}: ${r.error}`
      : `✓ ${r.input}: ${fmtBytes(r.inBytes)} → ${fmtBytes(r.outBytes)} (${r.reductionPct}% smaller)`
        + (r.output ? ` → ${r.output}` : ' (dry run)') + (r.resized ? ` [${r.width}×${r.height}]` : '')
        + (r.keptOriginal ? ' [original kept: could not be made smaller]' : '') + (r.targetMet === false ? ' [over max_size]' : ''));
    lines.push(`${ok.length}/${results.length} done: ${fmtBytes(summary.inBytes)} → ${fmtBytes(summary.outBytes)}`);
    return { content: [{ type: 'text', text: lines.join('\n') }], structuredContent: { results, summary }, isError: ok.length === 0 };
  } catch (e) {
    return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
  }
});

server.registerTool('image_info', {
  title: 'Image info',
  description: 'Read format, dimensions, file size and transparency of a local image without changing it.',
  inputSchema: { path: z.string().describe('Absolute path of an image file') },
  outputSchema: { path: z.string(), format: z.string(), width: z.number(), height: z.number(), bytes: z.number(), hasAlpha: z.boolean() },
  annotations: { title: 'Image info', readOnlyHint: true, openWorldHint: false },
}, async ({ path: p }) => {
  try {
    const abs = checkPath(p, 'path');
    const meta = await sharp(abs).metadata();
    const swap = (meta.orientation || 1) >= 5;
    const info = { path: abs, format: meta.format, width: swap ? meta.height : meta.width, height: swap ? meta.width : meta.height,
      bytes: fs.statSync(abs).size, hasAlpha: !!meta.hasAlpha };
    return { content: [{ type: 'text', text: `${info.format}, ${info.width}×${info.height}, ${fmtBytes(info.bytes)}${info.hasAlpha ? ', has transparency' : ''}` }],
      structuredContent: info };
  } catch (e) {
    return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
  }
});

server.connect(new StdioServerTransport()).catch((e) => {
  process.stderr.write(`tinysquish-mcp: ${e.message}\n`);
  process.exit(1);
});
