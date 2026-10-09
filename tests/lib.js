// Shared helpers for the Playwright suites (browser-regressions.js, features.js).
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
// Local runs serve the repo on this port; TINYSQUISH_URL points the suites at production instead
const PORT = Number(process.env.TINYSQUISH_PORT || 8789);
const URL_ = process.env.TINYSQUISH_URL || `http://127.0.0.1:${PORT}/`;
const TMP = fs.mkdtempSync(path.join(require('os').tmpdir(), 'tinysquish-test-'));
const results = [];
const check = (name, ok, info = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };

// Records every blob URL created/revoked, so tests can reach compressed output and revoke timing.
const INIT = `
  window.__blobs = []; window.__revoked = [];
  const c = URL.createObjectURL.bind(URL), r = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = (b) => { const u = c(b); window.__blobs.push({ u, type: b.type, size: b.size }); return u; };
  URL.revokeObjectURL = (u) => { window.__revoked.push(u); r(u); };
`;

async function makePng(page, w, h, seed) {
  // >256 distinct colors so 256-color quantization is lossy but still smaller than the original.
  const b64 = await page.evaluate(async ([w, h, seed]) => {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d'); const id = ctx.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      // Gradient + seeded noise: thousands of colors, poorly compressible losslessly
      const n = ((Math.imul(i + seed * 7919, 2654435761) >>> 24) & 63) - 32;
      id.data[i] = (x + n) & 255; id.data[i + 1] = (y + n) & 255; id.data[i + 2] = (x + y + seed) & 255; id.data[i + 3] = 255;
    }
    ctx.putImageData(id, 0, 0);
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = ''; for (const v of buf) s += String.fromCharCode(v); return btoa(s);
  }, [w, h, seed]);
  return Buffer.from(b64, 'base64');
}

async function makeImage(page, w, h, mime) {
  const b64 = await page.evaluate(async ([w, h, mime]) => {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d'); const id = ctx.createImageData(w, h);
    for (let i = 0; i < id.data.length; i += 4) {
      const p = i / 4, x = p % w, y = (p / w) | 0, n = (Math.imul(p, 2654435761) >>> 26) - 32;
      id.data[i] = (x / w * 255 + n) & 255; id.data[i + 1] = (y / h * 255 + n) & 255; id.data[i + 2] = ((x + y) & 255); id.data[i + 3] = 255;
    }
    ctx.putImageData(id, 0, 0);
    const blob = await new Promise(r => cv.toBlob(r, mime, 0.95));
    const buf = new Uint8Array(await blob.arrayBuffer());
    let s = ''; for (const v of buf) s += String.fromCharCode(v); return btoa(s);
  }, [w, h, mime]);
  return Buffer.from(b64, 'base64');
}

async function openApp(browser, init = '', path = '', opts = {}) {
  const ctx = await browser.newContext({ acceptDownloads: true, serviceWorkers: 'block', ...(opts.context || {}) });
  const page = await ctx.newPage();
  await page.addInitScript(INIT + init);
  if (opts.beforeGoto) await opts.beforeGoto(page, ctx);
  await page.goto(URL_ + path, opts.referer ? { referer: opts.referer } : undefined);
  await page.waitForSelector('#fileInput', { state: 'attached', timeout: 10000 });
  return { ctx, page };
}

async function compressWithQuality(page, files, q) {
  await page.evaluate((q) => { const s = document.getElementById('qualitySlider'); s.value = q; s.dispatchEvent(new Event('input')); }, q);
  await page.setInputFiles('#fileInput', files);  // compression starts automatically
  await page.waitForFunction((n) => document.querySelectorAll('.download-btn').length >= n, files.length, { timeout: 20000 });
}

// Returns {exact, uniqueColors} comparing the latest compressed PNG blob against the input pixels.
async function inspectLastPng(page, origB64) {
  return page.evaluate(async (origB64) => {
    const decode = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
    const pixels = (img) => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, c.width, c.height).data; };
    const outUrl = window.__blobs.filter(b => b.type === 'image/png').pop().u;
    const a = pixels(await decode('data:image/png;base64,' + origB64)), b = pixels(await decode(outUrl));
    let exact = a.length === b.length; for (let i = 0; exact && i < a.length; i++) if (a[i] !== b[i]) exact = false;
    const set = new Set(); for (let i = 0; i < b.length; i += 4) set.add((b[i] << 16) | (b[i + 1] << 8) | b[i + 2]);
    return { exact, uniqueColors: set.size };
  }, origB64);
}


async function startServer() {
  if (process.env.TINYSQUISH_URL) return null;
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  return server;
}

function summary() {
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  return failed;
}

module.exports = { ROOT, URL_, TMP, check, results, INIT, makePng, makeImage, openApp, compressWithQuality, inspectLastPng, startServer, summary };
