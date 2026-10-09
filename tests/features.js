// Feature tests: one block per user-facing feature not already covered by browser-regressions.js.
// Run from repo root: NODE_PATH=~/node_modules node tests/features.js
// Against live:      TINYSQUISH_URL=https://tinysquish.com/ NODE_PATH=~/node_modules node tests/features.js
// /api/visits is stubbed in every test so runs never touch the public visitor counter.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { URL_, TMP, check, makePng, makeImage, openApp, startServer, summary } = require('./lib');

const VISITS = { total: 1234, today: 5, pageviews: 9 };

// Stubs the counter API and records what the page sent
function stubVisits(log) {
  return async (page) => {
    await page.route('**/api/visits', async (route) => {
      const req = route.request();
      log.push({ method: req.method(), body: req.postData() });
      await route.fulfill({ json: VISITS });
    });
  };
}

async function open(browser, pathName = '', opts = {}) {
  const log = [];
  const r = await openApp(browser, '', pathName, { ...opts, beforeGoto: stubVisits(log) });
  return { ...r, log };
}

const done = (page, n, timeout = 30000) => page.waitForFunction((n) =>
  document.querySelectorAll('.download-btn').length === n && !document.querySelector('.file-status:not(.error)'), n, { timeout });

const setValue = (page, id, value, event = 'change') => page.evaluate(([id, v, ev]) => {
  const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event(ev, { bubbles: true }));
}, [id, String(value), event]);

const toasts = (page) => page.$$eval('.toast', els => els.map(e => e.textContent));

// Natural size of the most recent compressed image blob
const lastOutputSize = (page, type) => page.evaluate(async (type) => {
  const b = window.__blobs.filter(x => x.type === type).pop();
  const img = new Image(); img.src = b.u; await img.decode();
  return [img.naturalWidth, img.naturalHeight, b.size];
}, type);

(async () => {
  const server = await startServer();
  const browser = await chromium.launch();
  try {
    const scratch = await (await browser.newContext()).newPage();
    const png400 = await makeImage(scratch, 400, 300, 'image/png');
    const jpg400 = await makeImage(scratch, 400, 300, 'image/jpeg');
    const tiny = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

    // ---- F1. Drag & drop files onto the drop zone
    {
      const { ctx, page } = await open(browser);
      const dt = await page.evaluateHandle(async (files) => {
        const dt = new DataTransfer();
        for (const [name, b64, type] of files) dt.items.add(new File([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], name, { type }));
        return dt;
      }, [['drop-a.png', png400.toString('base64'), 'image/png'], ['drop-b.jpg', jpg400.toString('base64'), 'image/jpeg'],
          ['notes.txt', Buffer.from('hi').toString('base64'), 'text/plain']]);
      await page.dispatchEvent('#dropZone', 'dragenter', { dataTransfer: dt });
      const highlighted = await page.$eval('#dropZone', e => e.classList.contains('drag-over'));
      await page.dispatchEvent('#dropZone', 'drop', { dataTransfer: dt });
      await done(page, 2);
      const names = await page.$$eval('.file-name', els => els.map(e => e.textContent));
      check('F1. drag & drop adds the images (and skips non-images)', highlighted && names.join() === 'drop-a.png,drop-b.jpg', JSON.stringify({ highlighted, names }));
      await ctx.close();
    }

    // ---- F2. Folder upload, including subfolders, ignoring other files
    {
      const dir = path.join(TMP, 'album');
      fs.mkdirSync(path.join(dir, 'sub'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'one.png'), png400);
      fs.writeFileSync(path.join(dir, 'sub', 'two.jpg'), jpg400);
      fs.writeFileSync(path.join(dir, 'readme.txt'), 'not an image');
      const { ctx, page } = await open(browser);
      await page.setInputFiles('#folderInput', dir);
      await done(page, 2);
      const names = (await page.$$eval('.file-name', els => els.map(e => e.textContent))).sort();
      check('F2. folder upload finds images in subfolders and skips other files', names.join() === 'one.png,two.jpg', JSON.stringify(names));
      await ctx.close();
    }

    // ---- F3. 20-image limit
    {
      const { ctx, page } = await open(browser);
      await page.setInputFiles('#fileInput', Array.from({ length: 22 }, (_, i) => ({ name: `t${i}.png`, mimeType: 'image/png', buffer: tiny })));
      await done(page, 20);
      const first = await toasts(page);
      await page.setInputFiles('#fileInput', [{ name: 'extra.png', mimeType: 'image/png', buffer: tiny }]);
      await page.waitForTimeout(200);
      const second = await toasts(page);
      check('F3. batches stop at 20 images with a clear message', await page.$$eval('.file-item', e => e.length) === 20
        && first.some(t => t.includes('Only added 20 of 22')) && second.some(t => t.includes('Maximum 20 images')), JSON.stringify(second));
      await ctx.close();
    }

    // ---- F4. Unsupported and corrupt files
    {
      const { ctx, page } = await open(browser);
      await page.setInputFiles('#fileInput', [{ name: 'doc.txt', mimeType: 'text/plain', buffer: Buffer.from('text') }]);
      await page.waitForTimeout(200);
      const unsupported = (await toasts(page)).some(t => t.includes('No supported images found'));
      await page.setInputFiles('#fileInput', [{ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('definitely not a png') },
        { name: 'ok.png', mimeType: 'image/png', buffer: png400 }]);
      await page.waitForFunction(() => document.querySelector('.file-status.error') && document.querySelectorAll('.download-btn').length === 1, null, { timeout: 20000 });
      const t = await toasts(page);
      check('F4. unsupported files are rejected, a corrupt image shows Error and the rest still compress',
        unsupported && t.some(x => x.includes('Failed to compress broken.png')), JSON.stringify(t));
      await ctx.close();
    }

    // ---- F5. Resize by percentage
    {
      const { ctx, page } = await open(browser);
      await page.setInputFiles('#fileInput', [{ name: 'r.png', mimeType: 'image/png', buffer: png400 }]);
      await done(page, 1);
      await setValue(page, 'resizeMode', 'percent');
      await setValue(page, 'resizePercent', 50, 'input');
      await setValue(page, 'resizePercent', 50, 'change');
      await page.waitForFunction(() => (document.querySelector('.file-dims') || {}).textContent === '400×300 → 200×150' && document.querySelector('.download-btn'), null, { timeout: 20000 });
      const [w, h] = await lastOutputSize(page, 'image/png');
      check('F5. resize by percentage halves the output dimensions', w === 200 && h === 150, `${w}×${h}`);
      await ctx.close();
    }

    // ---- F6. Resize by dimensions, with and without the aspect-ratio lock
    {
      const { ctx, page } = await open(browser);
      await page.setInputFiles('#fileInput', [{ name: 'd.png', mimeType: 'image/png', buffer: png400 }]);
      await done(page, 1);
      await setValue(page, 'resizeMode', 'dimensions');
      const prefilled = await page.evaluate(() => [document.getElementById('resizeWidth').value, document.getElementById('resizeHeight').value]);
      await page.fill('#resizeWidth', '100');
      const lockedH = await page.inputValue('#resizeHeight');
      await page.waitForFunction(() => (document.querySelector('.file-dims') || {}).textContent === '400×300 → 100×75' && document.querySelector('.download-btn'), null, { timeout: 20000 });
      const locked = await lastOutputSize(page, 'image/png');
      await page.click('#aspectLockBtn');
      const pressed = await page.getAttribute('#aspectLockBtn', 'aria-pressed');
      await page.fill('#resizeHeight', '50');
      await page.waitForFunction(() => (document.querySelector('.file-dims') || {}).textContent === '400×300 → 100×50' && document.querySelector('.download-btn'), null, { timeout: 20000 });
      const free = await lastOutputSize(page, 'image/png');
      check('F6. resize by dimensions: prefilled, aspect lock keeps ratio, unlocked sets both sides',
        prefilled.join() === '400,300' && lockedH === '75' && locked.slice(0, 2).join() === '100,75' && pressed === 'false'
        && free.slice(0, 2).join() === '100,50', JSON.stringify({ prefilled, lockedH, locked, pressed, free }));
      await ctx.close();
    }

    // ---- F7. Convert JPEG to PNG, quality hint
    {
      const { ctx, page } = await open(browser);
      await page.setInputFiles('#fileInput', [{ name: 'photo.jpg', mimeType: 'image/jpeg', buffer: jpg400 }]);
      await done(page, 1);
      await setValue(page, 'formatSelect', 'image/png');
      await page.waitForFunction(() => window.__blobs.some(b => b.type === 'image/png') && document.querySelector('.download-btn'), null, { timeout: 20000 });
      await setValue(page, 'qualitySlider', 92, 'input');
      const hintHigh = await page.textContent('#qualityValue');
      await setValue(page, 'qualitySlider', 80, 'input');
      const hintLow = await page.textContent('#qualityValue');
      check('F7. JPEG converts to PNG; quality label shows the lossless hint only at 90%+',
        hintHigh === '92% · PNG lossless' && hintLow === '80%', JSON.stringify({ hintHigh, hintLow }));
      await ctx.close();
    }

    // ---- F8. Comparison modal: open from thumbnail and button, drag, close three ways
    {
      const { ctx, page } = await open(browser);
      await page.setInputFiles('#fileInput', [{ name: 'c.png', mimeType: 'image/png', buffer: png400 }]);
      await done(page, 1);
      const visible = () => page.$eval('#comparisonModal', e => e.classList.contains('visible'));
      await page.click('.file-thumb');
      const openedByThumb = await visible();
      // The modal centers the split on the next animation frame; drag only after that
      await page.waitForFunction(() => document.getElementById('comparisonOriginal').style.clipPath === 'inset(0px 50% 0px 0px)');
      const box = await page.$eval('#comparisonContainer', e => { const r = e.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; });
      await page.mouse.move(box[0] + box[2] / 2, box[1] + box[3] / 2);
      await page.mouse.down();
      await page.mouse.move(box[0] + box[2] / 4, box[1] + box[3] / 2, { steps: 5 });
      await page.mouse.up();
      const clip = await page.$eval('#comparisonOriginal', e => e.style.clipPath);
      await page.keyboard.press('Escape');
      const closedByEsc = !(await visible());
      await page.click('.compare-btn');
      await page.click('#modalCloseBtn');
      const closedByButton = !(await visible());
      await page.click('.compare-btn');
      await page.mouse.click(5, 5);
      const closedByOverlay = !(await visible());
      check('F8. comparison modal: thumbnail/button open it, drag moves the split, Esc/button/overlay close it',
        openedByThumb && /inset\(0px 7[45](\.\d+)?% 0px 0px\)/.test(clip) && closedByEsc && closedByButton && closedByOverlay,
        JSON.stringify({ openedByThumb, clip, closedByEsc, closedByButton, closedByOverlay }));
      await ctx.close();
    }

    // ---- F9. Single-file download, remove a file
    {
      const { ctx, page } = await open(browser);
      await page.setInputFiles('#fileInput', [{ name: 'keep.png', mimeType: 'image/png', buffer: png400 },
        { name: 'drop.png', mimeType: 'image/png', buffer: png400 }]);
      await done(page, 2);
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.download-btn')]);
      const file = path.join(TMP, 'single.png');
      await dl.saveAs(file);
      const header = fs.readFileSync(file).subarray(1, 4).toString();
      const shownKb = parseFloat(await page.textContent('.file-size-compressed'));
      const savedKb = fs.statSync(file).size / 1024;
      check('F9. single download saves "<name>-compressed.<ext>" with the compressed bytes',
        dl.suggestedFilename() === 'keep-compressed.png' && header === 'PNG' && Math.abs(savedKb - shownKb) < 0.1,
        `${dl.suggestedFilename()} ${savedKb.toFixed(1)} KB vs shown ${shownKb} KB`);
      await page.click('.file-item:nth-child(2) .remove-btn');
      const after = await page.evaluate(() => ({ names: [...document.querySelectorAll('.file-name')].map(e => e.textContent),
        count: document.getElementById('listCount').textContent, summary: document.getElementById('summaryCount').textContent }));
      check('F9b. removing a file updates the list and the summary', after.names.join() === 'keep.png' && after.count === '1 image'
        && after.summary === '1 image', JSON.stringify(after));
      await ctx.close();
    }

    // ---- F10. Never larger than the original (normal mode, keep format)
    {
      const small = await scratch.evaluate(async () => {
        const c = document.createElement('canvas'); c.width = 64; c.height = 64; c.getContext('2d').fillRect(0, 0, 32, 32);
        const b = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.3));
        return [...new Uint8Array(await b.arrayBuffer())];
      });
      const input = Buffer.from(small);
      const { ctx, page } = await open(browser);
      await setValue(page, 'qualitySlider', 95, 'input');
      await page.setInputFiles('#fileInput', [{ name: 'opt.jpg', mimeType: 'image/jpeg', buffer: input }]);
      await done(page, 1);
      const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.download-btn')]);
      const out = fs.readFileSync(await dl.path());
      check('F10. an image that would grow is kept byte-for-byte', out.equals(input), `${input.length} → ${out.length} bytes`);
      await ctx.close();
    }

    // ---- F11. Protections: blocked shortcuts and context menu, copy still allowed
    {
      const { ctx, page } = await open(browser);
      const r = await page.evaluate(() => {
        const press = (init) => { const e = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init }); document.body.dispatchEvent(e); return e.defaultPrevented; };
        const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true }); document.body.dispatchEvent(menu);
        return { save: press({ key: 's', ctrlKey: true }), source: press({ key: 'u', ctrlKey: true }), print: press({ key: 'p', ctrlKey: true }),
          devtools: press({ key: 'i', ctrlKey: true, shiftKey: true }), f12: press({ key: 'F12' }), copy: press({ key: 'c', ctrlKey: true }),
          contextMenu: menu.defaultPrevented };
      });
      check('F11. Ctrl+S/U/P, Ctrl+Shift+I, F12 and right-click are blocked; Ctrl+C still works',
        r.save && r.source && r.print && r.devtools && r.f12 && r.contextMenu && !r.copy, JSON.stringify(r));
      await ctx.close();
    }

    // ---- F12. Visitor counter: display, POST once per session with referrer host and page, then GET
    {
      const { ctx, page, log } = await open(browser, 'compress-png/', { referer: 'https://chatgpt.com/c/some-conversation' });
      await page.waitForSelector('#visitorCount:not([hidden])');
      const text = await page.textContent('#visitorCount');
      await page.reload();
      await page.waitForSelector('#visitorCount:not([hidden])');
      const posts = log.filter(x => x.method === 'POST').map(x => JSON.parse(x.body));
      const last = log[log.length - 1].method;
      check('F12. counter shows totals; first load POSTs {ref host, page}, reloads only GET',
        text === '1,234 visitors · 5 today' && posts.some(p => p.ref === 'chatgpt.com' && p.page === '/compress-png/') && last === 'GET',
        JSON.stringify({ text, posts, last }));
      await ctx.close();
    }

    // ---- F13. Indonesian toasts and counter
    {
      const { ctx, page } = await open(browser, 'id/');
      await page.waitForSelector('#visitorCount:not([hidden])');
      const counter = await page.textContent('#visitorCount');
      await page.setInputFiles('#fileInput', [{ name: 'a.png', mimeType: 'image/png', buffer: tiny }]);
      await done(page, 1);
      await page.click('#clearAllBtn');
      const toast = await page.textContent('.toast');
      check('F13. Indonesian pages translate toasts and the counter', counter === '1.234 pengunjung · 5 hari ini'
        && toast === '1 gambar dihapusBatalkan', JSON.stringify({ counter, toast }));
      await ctx.close();
    }

    // ---- F14. Download button waits for the whole batch
    {
      const big = await makeImage(scratch, 2400, 1800, 'image/png');
      const { ctx, page } = await open(browser);
      // Snapshot the button inside the page the moment "compressing" appears: encoding blocks the
      // main thread, so a separate evaluate() would only run after compression has finished
      await page.evaluate(() => {
        const obs = new MutationObserver(() => {
          if (!window.__busy && document.querySelector('.file-status.compressing')) {
            const b = document.getElementById('downloadAllBtn'); window.__busy = [b.disabled, b.textContent];
          }
        });
        obs.observe(document.getElementById('app-root'), { childList: true, subtree: true });
      });
      await page.setInputFiles('#fileInput', [{ name: 'big.png', mimeType: 'image/png', buffer: big }]);
      await done(page, 1, 60000);
      const busy = await page.evaluate(() => window.__busy);
      const ready = await page.evaluate(() => { const b = document.getElementById('downloadAllBtn'); return [b.disabled, b.textContent]; });
      check('F14. Download all is disabled ("Compressing…") until every file is done',
        busy[0] === true && ready.join() === 'false,Download all', JSON.stringify({ busy, ready }));
      await ctx.close();
    }

    // ---- F15. Mobile layout (375 px): no horizontal scroll, 44 px targets, download bar in view
    {
      const { ctx, page } = await open(browser, '', { context: { viewport: { width: 375, height: 740 }, hasTouch: true, isMobile: true } });
      await page.setInputFiles('#fileInput', Array.from({ length: 6 }, (_, i) => ({ name: `mobile-photo-${i}.png`, mimeType: 'image/png', buffer: png400 })));
      await done(page, 6);
      const r = await page.evaluate(() => {
        const small = [...document.querySelectorAll('.file-btn, .btn, .browse-btn, select')].filter(e => {
          const b = e.getBoundingClientRect(); return b.width && b.height < 44; }).map(e => e.id || e.className);
        const bar = document.getElementById('summaryBar').getBoundingClientRect();
        return { hscroll: document.documentElement.scrollWidth > innerWidth, small, barInView: bar.bottom <= innerHeight && bar.top >= 0 };
      });
      check('F15. mobile: no horizontal scroll, touch targets ≥ 44 px, sticky download bar visible', !r.hscroll && !r.small.length && r.barInView, JSON.stringify(r));
      await ctx.close();
    }

    // ---- F16. Offline: after one online visit the app loads and compresses with no network
    {
      const ctx = await browser.newContext({ acceptDownloads: true });
      const page = await ctx.newPage();
      await page.goto(URL_);
      await page.waitForSelector('#fileInput', { state: 'attached' });
      await page.evaluate(() => navigator.serviceWorker.ready);
      await page.reload();                                    // now controlled by the service worker
      await page.waitForSelector('#fileInput', { state: 'attached' });
      await page.waitForTimeout(500);
      await ctx.setOffline(true);
      await page.reload();
      const loaded = await page.waitForSelector('#fileInput', { state: 'attached', timeout: 10000 }).then(() => true, () => false);
      let compressed = false;
      if (loaded) {
        await page.setInputFiles('#fileInput', [{ name: 'offline.png', mimeType: 'image/png', buffer: png400 }]);
        compressed = await done(page, 1).then(() => true, () => false);
      }
      check('F16. works offline after the first visit (loads and compresses)', loaded && compressed, JSON.stringify({ loaded, compressed }));
      await ctx.close();
    }
  } finally {
    await browser.close();
    if (server) server.kill();
  }
  process.exit(summary() ? 1 : 0);
})();
