// Browser regression tests (Playwright + Chromium).
// Run from repo root: NODE_PATH=~/node_modules node tests/browser-regressions.js
// Against live:      TINYSQUISH_URL=https://tinysquish.com/ NODE_PATH=~/node_modules node tests/browser-regressions.js
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = 8789;
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

async function openApp(browser, init = '') {
  const ctx = await browser.newContext({ acceptDownloads: true, serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.addInitScript(INIT + init);
  await page.goto(URL_);
  await page.waitForSelector('#fileInput', { state: 'attached', timeout: 10000 });
  return { ctx, page };
}

async function compressWithQuality(page, files, q) {
  await page.evaluate((q) => { const s = document.getElementById('qualitySlider'); s.value = q; s.dispatchEvent(new Event('input')); }, q);
  await page.setInputFiles('#fileInput', files);
  await page.click('#compressAllBtn');
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

(async () => {
  const server = process.env.TINYSQUISH_URL ? null
    : spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  if (server) await new Promise(r => setTimeout(r, 800));
  const browser = await chromium.launch();
  try {
    // ---- Bug 1: browser sidebar (outerWidth - innerWidth > 160) must not hide the app
    {
      const { ctx, page } = await openApp(browser,
        `Object.defineProperty(window, 'outerWidth', { get: () => window.innerWidth + 320 });`);
      await page.waitForTimeout(2500);
      const hidden = await page.evaluate(() => document.getElementById('app-root').style.display === 'none'
        || document.getElementById('devtoolsWarning').classList.contains('visible'));
      check('1. sidebar >160px does not trigger devtools block', !hidden);
      await ctx.close();
    }

    const scratch = await (await browser.newContext()).newPage();
    const pngA = await makePng(scratch, 300, 200, 0);
    const pngB = await makePng(scratch, 300, 200, 77);

    // ---- Bug 1 guard: debugger trap still hides the app while devtools is attached, and restores it
    {
      const { ctx, page } = await openApp(browser);
      const hidden = () => page.evaluate(() => document.getElementById('app-root').style.display === 'none');
      const cdp = await ctx.newCDPSession(page);
      cdp.on('Debugger.paused', () => setTimeout(() => cdp.send('Debugger.resume').catch(() => {}), 200));
      await cdp.send('Debugger.enable');
      await page.waitForTimeout(3500);
      const whileOpen = await hidden();
      await cdp.send('Debugger.disable');
      await page.waitForTimeout(3500);
      check('1b. debugger trap hides app when devtools open, restores when closed', whileOpen && !(await hidden()));
      await ctx.close();
    }

    // ---- Bugs 2 + 3: ZIP blob not revoked synchronously; duplicate names stay distinct
    {
      const { ctx, page } = await openApp(browser);
      await compressWithQuality(page, [
        { name: 'photo.png', mimeType: 'image/png', buffer: pngA },
        { name: 'photo.png', mimeType: 'image/png', buffer: pngB },
        { name: 'Photo.PNG', mimeType: 'image/png', buffer: pngA },
        { name: 'kopi é.png', mimeType: 'image/png', buffer: pngB },
      ], 50);
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#downloadAllBtn')]);
      const zipPath = path.join(TMP, 'out.zip');
      await dl.saveAs(zipPath);
      await page.waitForTimeout(300);
      const revokedEarly = await page.evaluate(() => {
        const z = window.__blobs.filter(b => b.type === 'application/zip').pop();
        return window.__revoked.includes(z.u);
      });
      check('2. ZIP blob URL not revoked right after click', !revokedEarly);
      const names = JSON.parse(execFileSync('python3', ['-I', '-c',
        'import zipfile,sys,json; z=zipfile.ZipFile(sys.argv[1]); print(json.dumps([[i.filename, i.flag_bits & 0x800] for i in z.infolist()]))', zipPath]).toString());
      const lower = names.map(n => n[0].toLowerCase());
      check('3. ZIP entry names unique (case-insensitive)', new Set(lower).size === names.length && names.length === 4,
        JSON.stringify(names.map(n => n[0])));
      check('3b. ZIP entries flagged UTF-8, non-ASCII name intact', names.every(n => n[1]) && names.some(n => n[0] === 'kopi é-compressed.png'));
      await ctx.close();
    }

    // ---- Bug 4: high quality PNG is lossless; mid quality still quantizes
    {
      let { ctx, page } = await openApp(browser);
      await compressWithQuality(page, [{ name: 'g.png', mimeType: 'image/png', buffer: pngA }], 95);
      let r = await inspectLastPng(page, pngA.toString('base64'));
      check('4a. PNG at 95% is pixel-exact (lossless)', r.exact, `uniqueColors=${r.uniqueColors}`);
      await ctx.close();

      ({ ctx, page } = await openApp(browser));
      await compressWithQuality(page, [{ name: 'g.png', mimeType: 'image/png', buffer: pngA }], 75);
      r = await inspectLastPng(page, pngA.toString('base64'));
      check('4b. PNG at 75% still quantized to <=256 colors', r.uniqueColors <= 256, `uniqueColors=${r.uniqueColors}`);
      await ctx.close();
    }

    // ---- Design FINDING-001: comparison overlay must not rescale the original image
    {
      const { ctx, page } = await openApp(browser);
      await compressWithQuality(page, [{ name: 'c.png', mimeType: 'image/png', buffer: pngA }], 50);
      await page.click('.compare-btn');
      await page.waitForTimeout(300);
      const boxes = await page.evaluate(() => ['originalPreview', 'compressedPreview'].map(id => {
        const r = document.getElementById(id).getBoundingClientRect(); return [r.x, r.y, r.width, r.height].map(Math.round);
      }));
      check('5. compare modal: original and compressed images share one box', JSON.stringify(boxes[0]) === JSON.stringify(boxes[1]),
        JSON.stringify(boxes));
      await ctx.close();
    }
  } finally {
    await browser.close();
    if (server) server.kill();
  }
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})();
