// Renders the static SEO/PWA images with the site's own font and palette.
// Run from the repo root: NODE_PATH=~/node_modules node tools/render-assets.js
// Writes: og-image.png, favicon.ico, icons/{icon-192,icon-512,icon-maskable-512,apple-touch-icon}.png
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
// Inlined: pages created with setContent() may not load file:// fonts
const FONT = 'data:font/woff2;base64,' + fs.readFileSync(path.join(ROOT, 'fonts/dm-sans.woff2')).toString('base64');
const BASE_CSS = `
  @font-face { font-family: 'DM Sans'; src: url('${FONT}') format('woff2'); font-weight: 100 1000; }
  * { margin: 0; box-sizing: border-box; }
  body { font-family: 'DM Sans', sans-serif; }
`;

// Panda on the site background; `scale` is the emoji size relative to the canvas
const iconHtml = (scale) => `<style>${BASE_CSS}
  html, body { width: 100%; height: 100%; }
  body { background: #f6f5f1; display: flex; align-items: center; justify-content: center; }
  span { font-size: ${scale * 100}vmin; line-height: 1; }
</style><span>🐼</span>`;

const ogHtml = `<style>${BASE_CSS}
  body { width: 1200px; height: 630px; background: #f6f5f1; color: #1a1a1a;
         padding: 72px 80px; display: flex; flex-direction: column; justify-content: space-between; }
  .brand { display: flex; align-items: center; gap: 18px; font-size: 44px; font-weight: 800; letter-spacing: -1px; }
  h1 { font-size: 72px; line-height: 1.05; font-weight: 800; letter-spacing: -2px; max-width: 900px; }
  p { font-size: 30px; color: #5a5a58; margin-top: 20px; }
  .bar { display: flex; align-items: center; justify-content: space-between; background: #1a1a1a; color: white;
         border-radius: 20px; padding: 26px 34px; }
  .saved { font-size: 48px; font-weight: 800; color: #86efac; }
  .saved small { font-size: 28px; color: rgba(255,255,255,.85); font-weight: 500; margin-left: 8px; }
  .detail { font-size: 24px; color: rgba(255,255,255,.7); margin-top: 4px; }
  .btn { background: #15803d; border-radius: 999px; padding: 18px 34px; font-size: 26px; font-weight: 700; }
</style>
<div class="brand"><span>🐼</span>TinySquish</div>
<div><h1>Compress images in your browser</h1><p>PNG · JPEG · WebP — free, works offline, nothing is uploaded</p></div>
<div class="bar"><div><div class="saved">91%<small>smaller</small></div><div class="detail">1.86 MB → 174.1 KB · 2 images</div></div><div class="btn">Download all</div></div>`;

// ICO container holding one PNG image (supported by every current browser)
function pngToIco(png, size) {
  const header = Buffer.alloc(6 + 16);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
  header.writeUInt8(size, 6); header.writeUInt8(size, 7); header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14); header.writeUInt32LE(22, 18);
  return Buffer.concat([header, png]);
}

(async () => {
  const browser = await chromium.launch();
  const shot = async (html, w, h) => {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(() => document.fonts.ready);
    const buf = await page.screenshot({ type: 'png' });
    await page.close();
    return buf;
  };
  fs.mkdirSync(path.join(ROOT, 'icons'), { recursive: true });
  const out = {
    'og-image.png': await shot(ogHtml, 1200, 630),
    'icons/icon-192.png': await shot(iconHtml(0.72), 192, 192),
    'icons/icon-512.png': await shot(iconHtml(0.72), 512, 512),
    'icons/icon-maskable-512.png': await shot(iconHtml(0.56), 512, 512), // inside the 80% safe zone
    'icons/apple-touch-icon.png': await shot(iconHtml(0.68), 180, 180),
    'favicon.ico': pngToIco(await shot(iconHtml(0.9), 32, 32), 32),
  };
  for (const [file, buf] of Object.entries(out)) {
    fs.writeFileSync(path.join(ROOT, file), buf);
    console.log(`${file}  ${buf.length} B`);
  }
  await browser.close();
})();
