// Reproducible compression benchmark that drives the real app (same code path users get).
//
//   NODE_PATH=~/node_modules node tools/benchmark.js <kodak-dir>
//
// <kodak-dir> holds kodim01.png … kodim24.png from https://r0k.us/graphics/kodak/ (the Kodak
// Lossless True Color Image Suite). A second set of UI screenshots is rendered from the site
// itself. Results go to bench/results.json, which the /benchmark/ page is generated from.
const { chromium } = require('playwright');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const KODAK = process.argv[2];
if (!KODAK || !fs.existsSync(path.join(KODAK, 'kodim01.png'))) {
  console.error('usage: node tools/benchmark.js <dir with kodim01.png … kodim24.png>');
  process.exit(1);
}
const PORT = 8795;
const BASE = `http://127.0.0.1:${PORT}/`;
const WORK = fs.mkdtempSync(path.join(os.tmpdir(), 'tinysquish-bench-'));

const SETTINGS = [
  { id: 'png-75', label: 'Keep PNG, quality 75% (256-color palette)', format: 'original', quality: 75 },
  { id: 'png-95', label: 'Keep PNG, quality 95% (lossless)', format: 'original', quality: 95 },
  { id: 'jpeg-75', label: 'Convert to JPEG, quality 75%', format: 'image/jpeg', quality: 75 },
  { id: 'webp-75', label: 'Convert to WebP, quality 75%', format: 'image/webp', quality: 75 },
  { id: 'jpeg-max-50kb', label: 'Convert to JPEG, max size 50 KB', format: 'image/jpeg', quality: 75, maxKb: 50 },
];

function unzip(zipPath) {
  // Python's zipfile is always present here; returns { name: base64 }
  const out = execFileSync('python3', ['-I', '-c',
    'import zipfile,sys,json,base64; z=zipfile.ZipFile(sys.argv[1]); print(json.dumps({n: base64.b64encode(z.read(n)).decode() for n in z.namelist()}))',
    zipPath], { maxBuffer: 1 << 28 });
  return JSON.parse(out.toString());
}

async function renderScreenshots(browser) {
  // UI-style images (flat colors, text): where palette PNG compression shines
  const shots = [];
  for (const [name, w, h, full] of [['ui-desktop', 1440, 900, false], ['ui-desktop-full', 1280, 800, true],
                                     ['ui-mobile-full', 390, 844, true], ['ui-tablet', 820, 1180, false]]) {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.goto(BASE);
    await page.waitForSelector('#fileInput', { state: 'attached' });
    await page.waitForTimeout(300);
    const file = path.join(WORK, name + '.png');
    await page.screenshot({ path: file, fullPage: full });
    shots.push(file);
    await page.close();
  }
  return shots;
}

async function runSetting(browser, files, setting) {
  const out = [];
  // The app takes 20 images per batch
  for (let i = 0; i < files.length; i += 12) {
    const chunk = files.slice(i, i + 12);
    const ctx = await browser.newContext({ acceptDownloads: true, serviceWorkers: 'block' });
    const page = await ctx.newPage();
    await page.goto(BASE);
    await page.waitForSelector('#fileInput', { state: 'attached' });
    await page.evaluate((s) => {
      const set = (id, v, ev) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event(ev)); };
      set('qualitySlider', String(s.quality), 'change');
      set('formatSelect', s.format, 'change');
      set('maxSizeSelect', s.maxKb ? String(s.maxKb) : '', 'change');
    }, setting);
    await page.setInputFiles('#fileInput', chunk);
    await page.waitForFunction((n) => document.querySelectorAll('.download-btn').length === n
      && !document.querySelector('.file-status:not(.error)'), chunk.length, { timeout: 300000 });
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#downloadAllBtn')]);
    const zipPath = path.join(WORK, `${setting.id}-${i}.zip`);
    await dl.saveAs(zipPath);
    const entries = unzip(zipPath);
    for (const f of chunk) {
      const base = path.basename(f, '.png');
      const name = Object.keys(entries).find(n => n.startsWith(base + '-compressed.'));
      out.push({ file: path.basename(f), input: fs.readFileSync(f), output: Buffer.from(entries[name], 'base64'), outName: name });
    }
    await ctx.close();
  }
  return out;
}

async function measure(page, pairs) {
  // PSNR over RGB, decoded by the browser exactly as a visitor would see the files
  return page.evaluate(async (pairs) => {
    const decode = (b64, type) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = `data:${type};base64,${b64}`; });
    const pixels = (img, w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h); return x.getImageData(0, 0, w, h).data; };
    const results = [];
    for (const p of pairs) {
      const a = await decode(p.in, 'image/png'), b = await decode(p.out, p.type);
      // Outputs shrunk by "max size" are compared after scaling back up, i.e. what the viewer loses
      const A = pixels(a, a.width, a.height), B = pixels(b, a.width, a.height);
      let se = 0;
      for (let i = 0; i < A.length; i += 4) for (let c = 0; c < 3; c++) { const d = A[i + c] - B[i + c]; se += d * d; }
      const mse = se / (a.width * a.height * 3);
      results.push({ psnr: mse === 0 ? null : 10 * Math.log10(255 * 255 / mse), inW: a.width, inH: a.height, outW: b.width, outH: b.height });
    }
    return results;
  }, pairs);
}

const median = (xs) => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const round = (x, d = 1) => x == null ? null : Math.round(x * 10 ** d) / 10 ** d;

(async () => {
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: ROOT, stdio: 'ignore' });
  await new Promise(r => setTimeout(r, 800));
  const browser = await chromium.launch();
  try {
    const sets = {
      kodak: { label: 'Kodak photo suite (24 × 768×512 PNG photos)', files: fs.readdirSync(KODAK).filter(f => /^kodim\d+\.png$/.test(f)).sort().map(f => path.join(KODAK, f)) },
      ui: { label: 'UI screenshots (4 PNG screenshots of this site)', files: await renderScreenshots(browser) },
    };
    const scratch = await browser.newPage();
    const results = [];
    for (const [setId, set] of Object.entries(sets)) {
      for (const setting of SETTINGS) {
        process.stdout.write(`${setId} / ${setting.id} … `);
        const rows = await runSetting(browser, set.files, setting);
        const type = (n) => n.endsWith('.webp') ? 'image/webp' : n.endsWith('.jpg') ? 'image/jpeg' : 'image/png';
        const m = await measure(scratch, rows.map(r => ({ in: r.input.toString('base64'), out: r.output.toString('base64'), type: type(r.outName) })));
        const per = rows.map((r, i) => ({ file: r.file, inBytes: r.input.length, outBytes: r.output.length,
          reductionPct: round(100 * (1 - r.output.length / r.input.length)), psnr: round(m[i].psnr, 2),
          inW: m[i].inW, inH: m[i].inH, outW: m[i].outW, outH: m[i].outH }));
        const totalIn = per.reduce((a, r) => a + r.inBytes, 0), totalOut = per.reduce((a, r) => a + r.outBytes, 0);
        const psnrs = per.map(r => r.psnr).filter(x => x != null);
        results.push({ set: setId, setting: setting.id, label: setting.label, images: per.length, totalIn, totalOut,
          reductionPct: round(100 * (1 - totalOut / totalIn)), medianReductionPct: round(median(per.map(r => r.reductionPct))),
          meanPsnr: psnrs.length ? round(psnrs.reduce((a, b) => a + b, 0) / psnrs.length, 2) : null,
          minPsnr: psnrs.length ? round(Math.min(...psnrs), 2) : null, lossless: psnrs.length === 0,
          maxOutBytes: Math.max(...per.map(r => r.outBytes)), resized: per.filter(r => r.outW !== r.inW).length,
          perImage: per });
        console.log(`${results.at(-1).reductionPct}% smaller, PSNR ${results.at(-1).meanPsnr ?? 'lossless'}`);
      }
    }
    const commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: ROOT }).toString().trim();
    const report = { generated: new Date().toISOString().slice(0, 10), commit, browser: `Chromium ${browser.version()}`,
      sets: Object.fromEntries(Object.entries(sets).map(([k, v]) => [k, { label: v.label, images: v.files.length }])),
      settings: SETTINGS, results };
    fs.mkdirSync(path.join(ROOT, 'bench'), { recursive: true });
    fs.writeFileSync(path.join(ROOT, 'bench/results.json'), JSON.stringify(report, null, 1) + '\n');
    console.log('wrote bench/results.json');
  } finally {
    await browser.close();
    server.kill();
    fs.rmSync(WORK, { recursive: true, force: true });
  }
})();
