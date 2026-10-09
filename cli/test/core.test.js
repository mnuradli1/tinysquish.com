'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const sharp = require('sharp');
const { compress, pngPaletteQuality } = require('../core');
const { image } = require('./helpers');

const raw = (buf) => sharp(buf).ensureAlpha().raw().toBuffer();

test('quality → PNG settings mirror the web app (lossless 90+, full palette 65–89, fewer colors below)', () => {
  assert.equal(pngPaletteQuality(95), null);
  assert.equal(pngPaletteQuality(90), null);
  assert.equal(pngPaletteQuality(89), 100);
  assert.equal(pngPaletteQuality(65), 100);
  assert.equal(pngPaletteQuality(50), 77);
  assert.equal(pngPaletteQuality(10), 15);
});

test('lower PNG quality really uses fewer colors', async () => {
  const input = await image.smoothPng(300, 200);
  const colors = async (q) => { const r = await sharp((await compress(input, { quality: q })).data).raw().toBuffer({ resolveWithObject: true });
    const set = new Set(); for (let i = 0; i < r.data.length; i += r.info.channels) set.add(r.data[i] << 16 | r.data[i + 1] << 8 | r.data[i + 2]); return set.size; };
  const [c75, c30] = [await colors(75), await colors(30)];
  assert.ok(c75 <= 256 && c30 < c75, `75%: ${c75} colors, 30%: ${c30} colors`);
});

test('PNG at 75% becomes a smaller palette PNG', async () => {
  const input = await image.png();
  const r = await compress(input, { quality: 75 });
  const meta = await sharp(r.data).metadata();
  assert.equal(r.format, 'png');
  assert.ok(r.outBytes < r.inBytes, `${r.outBytes} < ${r.inBytes}`);
  assert.ok(meta.isPalette || meta.paletteBitDepth, 'output uses a palette');
});

test('PNG at 95% is pixel-exact or keeps the original', async () => {
  const input = await image.png(200, 150, true);
  const r = await compress(input, { quality: 95 });
  assert.deepEqual(await raw(r.data), await raw(input));
});

test('converts to JPEG (white background) and WebP (keeps alpha)', async () => {
  const input = await image.png(200, 150, true);
  const jpg = await compress(input, { format: 'jpg' });
  const webp = await compress(input, { format: 'webp' });
  assert.equal((await sharp(jpg.data).metadata()).format, 'jpeg');
  const [r, g, b] = await sharp(jpg.data).extract({ left: 5, top: 5, width: 1, height: 1 }).raw().toBuffer();
  assert.ok(r > 240 && g > 240 && b > 240, 'transparent area turned white');
  const wm = await sharp(webp.data).metadata();
  assert.equal(wm.format, 'webp');
  assert.ok(wm.hasAlpha);
});

for (const [name, make, format] of [['PNG', () => image.png(1200, 900), 'original'], ['JPEG', () => image.jpeg(1600, 1200), 'original'],
  ['PNG → WebP', () => image.png(1600, 1200), 'webp'], ['JPEG → PNG', () => image.jpeg(1200, 900), 'png']]) {
  test(`max size: ${name} fits under 60 KB`, async () => {
    const r = await compress(await make(), { format, maxBytes: 60 * 1024 });
    assert.equal(r.targetMet, true);
    assert.ok(r.outBytes <= 60 * 1024, `${r.outBytes} bytes`);
  });
}

test('max size uses the highest quality that fits (no needless downscale)', async () => {
  const input = await image.jpeg(800, 600);
  const r = await compress(input, { maxBytes: 200 * 1024 });
  assert.equal(r.resized, false);
  assert.ok(r.outBytes <= 200 * 1024);
});

test('an image that would grow is returned unchanged', async () => {
  const input = await sharp({ create: { width: 64, height: 64, channels: 3, background: '#336699' } }).jpeg({ quality: 30 }).toBuffer();
  const r = await compress(input, { quality: 95 });
  assert.equal(r.keptOriginal, true);
  assert.ok(r.data.equals(input));
});

test('resize by percent and by width (aspect kept) and by both sides', async () => {
  const input = await image.png(400, 300);
  assert.deepEqual([(await compress(input, { resizePercent: 50 })).width, (await compress(input, { resizePercent: 50 })).height], [200, 150]);
  const w = await compress(input, { width: 100 });
  assert.deepEqual([w.width, w.height], [100, 75]);
  const meta = await sharp((await compress(input, { width: 100, height: 50 })).data).metadata();
  assert.deepEqual([meta.width, meta.height], [100, 50]);
});

test('EXIF orientation is applied and metadata is not copied', async () => {
  const input = await image.jpeg(300, 200).then(b => sharp(b).withMetadata({ orientation: 6, exif: { IFD0: { Make: 'TestCam' } } }).jpeg().toBuffer());
  const r = await compress(input, { format: 'webp' });
  const meta = await sharp(r.data).metadata();
  assert.deepEqual([meta.width, meta.height], [200, 300], 'rotated to portrait');
  assert.equal(meta.exif, undefined);
});

test('rejects bad options and non-images', async () => {
  const input = await image.png(50, 50);
  await assert.rejects(compress(input, { quality: 5 }), /quality/);
  await assert.rejects(compress(input, { format: 'bmp' }), /format/);
  await assert.rejects(compress(Buffer.from('not an image')), /./);
});
