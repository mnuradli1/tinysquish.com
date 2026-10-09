// Batch runner shared by the CLI and the MCP server: collects files, picks output paths,
// compresses with a small worker pool and reports one result per input.
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { compress } = require('./core');

const EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif', '.tif', '.tiff']);
const EXT_FOR = { jpeg: '.jpg', png: '.png', webp: '.webp' };

// "100kb", "1.5 MB", "500k", "204800" → bytes
function parseSize(text) {
  const m = /^\s*(\d+(?:\.\d+)?)\s*(b|k|kb|kib|m|mb|mib)?\s*$/i.exec(String(text));
  if (!m) throw new Error(`invalid size "${text}" (examples: 100kb, 1.5mb, 204800)`);
  const unit = (m[2] || 'b').toLowerCase()[0];
  const bytes = Math.round(parseFloat(m[1]) * (unit === 'm' ? 1048576 : unit === 'k' ? 1024 : 1));
  if (bytes < 1024) throw new Error(`max size must be at least 1 KB (got "${text}")`);
  return bytes;
}

// Files and folders (recursively) → image files. Our own outputs are skipped when scanning
// folders, so running twice doesn't compress "photo-compressed.jpg" again.
function collectInputs(paths, suffix = '-compressed') {
  const files = [];
  const walk = (p, fromDir) => {
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      for (const name of fs.readdirSync(p).sort()) {
        if (!name.startsWith('.')) walk(path.join(p, name), true);
      }
    } else if (EXTENSIONS.has(path.extname(p).toLowerCase())) {
      const base = path.basename(p, path.extname(p));
      if (!(fromDir && suffix && base.endsWith(suffix))) files.push(path.resolve(p));
    } else if (!fromDir) {
      throw new Error(`not a supported image: ${p}`);
    }
  };
  for (const p of paths) {
    if (!fs.existsSync(p)) throw new Error(`no such file or folder: ${p}`);
    walk(p, false);
  }
  return [...new Set(files)];
}

function outputPath(input, format, { outDir, suffix = '-compressed', overwrite = false }, taken) {
  const dir = outDir ? path.resolve(outDir) : path.dirname(input);
  const base = path.basename(input, path.extname(input)) + suffix;
  const ext = EXT_FOR[format];
  let candidate = path.join(dir, base + ext);
  for (let i = 2; taken.has(candidate.toLowerCase()) || (!overwrite && fs.existsSync(candidate)); i++) {
    candidate = path.join(dir, `${base} (${i})${ext}`);
  }
  if (candidate === input) throw new Error(`refusing to overwrite the input file ${input}`);
  taken.add(candidate.toLowerCase());
  return candidate;
}

/**
 * Compress many files. Never modifies inputs; writes "<name><suffix>.<ext>" next to each input
 * or into outDir. Returns one result per input (with `error` set when that file failed).
 */
async function run(paths, opts = {}, onResult = () => {}) {
  const inputs = collectInputs(paths, opts.suffix);
  if (opts.outDir) fs.mkdirSync(path.resolve(opts.outDir), { recursive: true });
  const taken = new Set();
  const results = new Array(inputs.length);
  let next = 0;
  const workers = Math.max(1, Math.min(opts.concurrency || os.availableParallelism?.() || 2, 4, inputs.length));
  await Promise.all(Array.from({ length: workers }, async () => {
    while (next < inputs.length) {
      const i = next++;
      const input = inputs[i];
      let result;
      try {
        const r = await compress(fs.readFileSync(input), opts);
        const output = opts.dryRun ? null : outputPath(input, r.format, opts, taken);
        if (output) fs.writeFileSync(output, r.data);
        result = { input, output, format: r.format, inBytes: r.inBytes, outBytes: r.outBytes,
          reductionPct: Math.round(1000 * (1 - r.outBytes / r.inBytes)) / 10,
          width: r.width, height: r.height, inWidth: r.inWidth, inHeight: r.inHeight,
          resized: r.resized, keptOriginal: r.keptOriginal, targetMet: r.targetMet };
      } catch (e) {
        result = { input, error: e.message };
      }
      results[i] = result;
      onResult(result);
    }
  }));
  return results;
}

module.exports = { run, collectInputs, parseSize, outputPath };
