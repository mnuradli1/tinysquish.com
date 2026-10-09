// Browser regression tests (Playwright + Chromium).
// Run from repo root: NODE_PATH=~/node_modules node tests/browser-regressions.js
// Against live:      TINYSQUISH_URL=https://tinysquish.com/ NODE_PATH=~/node_modules node tests/browser-regressions.js
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const path = require('path');

const { URL_, TMP, check, makePng, makeImage, openApp, compressWithQuality, inspectLastPng, startServer, summary } = require('./lib');

(async () => {
  const server = await startServer();
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

    // ---- Design FINDING-002: changing a setting after compression recompresses every file
    {
      const { ctx, page } = await openApp(browser);
      await compressWithQuality(page, [{ name: 'r.png', mimeType: 'image/png', buffer: pngA },
        { name: 's.png', mimeType: 'image/png', buffer: pngB }], 50);
      const before = await page.textContent('#summaryCompressed');
      await page.selectOption('#formatSelect', 'image/jpeg');
      await page.waitForFunction(() => [...document.querySelectorAll('.file-name')].length === 2
        && document.querySelectorAll('.download-btn').length === 2
        && !document.querySelector('.file-status'), null, { timeout: 20000 });
      await page.waitForTimeout(300);
      const after = await page.textContent('#summaryCompressed');
      const jpegs = await page.evaluate(() => window.__blobs.filter(b => b.type === 'image/jpeg').length);
      check('6. changing format after compression recompresses all files', jpegs >= 2 && before !== after, `${before} -> ${after}, jpegs=${jpegs}`);
      await ctx.close();
    }

    // ---- FINDING-002 race: a setting change mid-compression must win over the in-flight result
    {
      const { ctx, page } = await openApp(browser);
      await page.setInputFiles('#fileInput', [{ name: 'a.png', mimeType: 'image/png', buffer: pngA },
        { name: 'b.png', mimeType: 'image/png', buffer: pngB }, { name: 'c.png', mimeType: 'image/png', buffer: pngA }]);
      await page.selectOption('#formatSelect', 'image/webp');   // fires while file 1 is compressing
      await page.waitForFunction(() => document.querySelectorAll('.download-btn').length === 3 && !document.querySelector('.file-status'), null, { timeout: 20000 });
      const zipNames = await (async () => {
        const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#downloadAllBtn')]);
        const p = path.join(TMP, 'race.zip'); await dl.saveAs(p);
        return JSON.parse(execFileSync('python3', ['-I', '-c', 'import zipfile,sys,json; print(json.dumps(zipfile.ZipFile(sys.argv[1]).namelist()))', p]).toString());
      })();
      check('6b. setting change mid-compression: every output uses the new format', zipNames.length === 3 && zipNames.every(n => n.endsWith('.webp')), JSON.stringify(zipNames));
      await ctx.close();
    }

    // ---- Clear all can be undone; blob URLs are only released once the undo window closes
    {
      const { ctx, page } = await openApp(browser);
      await compressWithQuality(page, [{ name: 'u1.png', mimeType: 'image/png', buffer: pngA },
        { name: 'u2.png', mimeType: 'image/png', buffer: pngB }], 50);
      await page.click('#clearAllBtn');
      const afterClear = await page.$$eval('.file-item', els => els.length);
      await page.click('.toast-action');
      await page.waitForFunction(() => document.querySelectorAll('.download-btn').length === 2);
      const restored = await page.evaluate(async () => {
        const url = document.getElementById('compressedPreview') && window.__blobs.filter(b => b.type === 'image/png').pop().u;
        try { await (await fetch(url)).blob(); return { ok: true, revoked: window.__revoked.length }; } catch (e) { return { ok: false }; }
      });
      check('7. Clear all + Undo restores files with live blob URLs', afterClear === 0 && restored.ok
        && !(await page.isDisabled('#downloadAllBtn')), JSON.stringify({ afterClear, restored }));
      // Clear → add another file → change format → Undo: restored files must use the new format too
      await page.click('#clearAllBtn');
      await page.setInputFiles('#fileInput', [{ name: 'u3.png', mimeType: 'image/png', buffer: pngA }]);
      await page.selectOption('#formatSelect', 'image/webp');
      await page.click('.toast-action');
      await page.waitForFunction(() => document.querySelectorAll('.download-btn').length === 3 && !document.querySelector('.file-status'), null, { timeout: 20000 });
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#downloadAllBtn')]);
      const undoZip = path.join(TMP, 'undo.zip'); await dl.saveAs(undoZip);
      const undoNames = JSON.parse(execFileSync('python3', ['-I', '-c', 'import zipfile,sys,json; print(json.dumps(zipfile.ZipFile(sys.argv[1]).namelist()))', undoZip]).toString());
      check('7c. Undo after a setting change recompresses restored files', undoNames.length === 3 && undoNames.every(n => n.endsWith('.webp')), JSON.stringify(undoNames));
      const before = await page.evaluate(() => window.__revoked.length);
      await page.click('#clearAllBtn');
      await page.waitForTimeout(6800);
      const revoked = await page.evaluate((b) => window.__revoked.length - b, before);
      check('7b. without Undo, blob URLs are revoked after the undo window', revoked >= 6 && !(await page.$('.toast-action')), `revoked=${revoked}`);
      await ctx.close();
    }

    // ---- Max size: every output fits the target, across input and output formats
    {
      const big = await makeImage(scratch, 1600, 1200, 'image/png');     // noisy, ~5 MB PNG
      const jpg = await makeImage(scratch, 1600, 1200, 'image/jpeg');    // ~1 MB JPEG
      const small = await makeImage(scratch, 120, 80, 'image/jpeg');     // already tiny
      for (const [fmt, kb] of [['original', 100], ['image/webp', 50], ['image/png', 200], ['image/jpeg', 100]]) {
        const { ctx, page } = await openApp(browser);
        // Settings are hidden until files exist, so preset them directly
        await page.evaluate(([fmt, kb]) => {
          for (const [id, v] of [['formatSelect', fmt], ['maxSizeSelect', kb]]) {
            const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('change'));
          }
        }, [fmt, String(kb)]);
        await page.setInputFiles('#fileInput', [{ name: 'big.png', mimeType: 'image/png', buffer: big },
          { name: 'photo.jpg', mimeType: 'image/jpeg', buffer: jpg }, { name: 'small.jpg', mimeType: 'image/jpeg', buffer: small }]);
        await page.waitForFunction(() => document.querySelectorAll('.download-btn').length === 3
          && !document.querySelector('.file-status.compressing, .file-status:not(.error)'), null, { timeout: 60000 });
        const r = await page.evaluate(() => ({
          sizes: [...document.querySelectorAll('.file-size-compressed')].map(e => e.textContent),
          missed: document.querySelectorAll('.file-status.error').length }));
        const bytes = r.sizes.map(t => parseFloat(t) * (t.includes('MB') ? 1048576 : t.includes('KB') ? 1024 : 1));
        check(`8. max size ${kb} KB (${fmt}): all outputs fit`, r.missed === 0 && bytes.every(b => b <= kb * 1024), JSON.stringify(r.sizes));
        if (fmt === 'original') {
          const orig = await page.$$eval('.file-size-original', els => els.map(e => e.textContent));
          const ob = orig.map(t => parseFloat(t) * (t.includes('MB') ? 1048576 : t.includes('KB') ? 1024 : 1));
          check('8b. with max size + keep original, no output is larger than its original', bytes.every((b, i) => b <= ob[i]), JSON.stringify({ orig, out: r.sizes }));
        }
        await ctx.close();
      }
    }

    // ---- Landing pages: presets, Indonesian UI, content-only pages
    {
      let { ctx, page } = await openApp(browser, '', 'png-to-webp/');
      await page.setInputFiles('#fileInput', [{ name: 'p.png', mimeType: 'image/png', buffer: pngA }]);
      await page.waitForFunction(() => document.querySelectorAll('.download-btn').length === 1);
      const webp = await page.evaluate(() => ({ fmt: document.getElementById('formatSelect').value,
        out: window.__blobs.filter(b => b.type === 'image/webp').length }));
      check('9. /png-to-webp/ presets WebP output', webp.fmt === 'image/webp' && webp.out >= 1, JSON.stringify(webp));
      await ctx.close();

      ({ ctx, page } = await openApp(browser, '', 'compress-image-to-100kb/'));
      check('9b. /compress-image-to-100kb/ presets Max size 100 KB', await page.$eval('#maxSizeSelect', e => e.value) === '100');
      await ctx.close();

      ({ ctx, page } = await openApp(browser, '', 'id/kompres-foto-100kb/'));
      await page.setInputFiles('#fileInput', [{ name: 'p.png', mimeType: 'image/png', buffer: pngA }]);
      await page.waitForFunction(() => document.querySelectorAll('.download-btn').length === 1);
      const id = await page.evaluate(() => ({ drop: document.querySelector('.dz-title-more').textContent,
        count: document.getElementById('listCount').textContent, dl: document.getElementById('downloadAllBtn').textContent,
        max: document.getElementById('maxSizeSelect').value }));
      check('10. /id/ pages show the app in Indonesian (+ 100 KB preset)', id.drop === 'Tambah gambar' && id.count === '1 gambar'
        && id.dl === 'Unduh semua' && id.max === '100', JSON.stringify(id));
      await ctx.close();

      const errs = [];
      ctx = await browser.newContext({ serviceWorkers: 'block' });
      page = await ctx.newPage();
      page.on('pageerror', e => errs.push(e.message));
      await page.goto(URL_ + 'about/'); await page.waitForTimeout(800);
      check('11. content-only page (/about/) loads without JS errors', errs.length === 0 && !(await page.$('#app-root')), JSON.stringify(errs));
      await ctx.close();
    }
  } finally {
    await browser.close();
    if (server) server.kill();
  }
  process.exit(summary() ? 1 : 0);
})();
