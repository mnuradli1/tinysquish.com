// Test images generated on the fly: a noisy gradient (photo-like, poorly compressible losslessly)
'use strict';
const sharp = require('sharp');
const fs = require('fs');
const os = require('os');
const path = require('path');

function noisyRaw(w, h, alpha = false) {
  const ch = alpha ? 4 : 3, buf = Buffer.alloc(w * h * ch);
  for (let p = 0; p < w * h; p++) {
    const x = p % w, y = (p / w) | 0, n = (Math.imul(p, 2654435761) >>> 26) - 32;
    buf[p * ch] = (x / w * 255 + n) & 255; buf[p * ch + 1] = (y / h * 255 + n) & 255; buf[p * ch + 2] = (x + y) & 255;
    if (alpha) buf[p * ch + 3] = x < w / 2 ? 0 : 255;
  }
  return sharp(buf, { raw: { width: w, height: h, channels: ch } });
}

// Smooth gradient: like real photos/UI, a lower palette quality really needs fewer colors
function smoothPng(w, h) {
  const buf = Buffer.alloc(w * h * 3);
  for (let p = 0; p < w * h; p++) {
    const x = p % w, y = (p / w) | 0;
    buf[p * 3] = Math.round(x / w * 255); buf[p * 3 + 1] = Math.round(y / h * 255); buf[p * 3 + 2] = Math.round((x + y) / (w + h) * 255);
  }
  return sharp(buf, { raw: { width: w, height: h, channels: 3 } }).png().toBuffer();
}

const image = {
  smoothPng,
  png: (w = 400, h = 300, alpha = false) => noisyRaw(w, h, alpha).png().toBuffer(),
  jpeg: (w = 400, h = 300, q = 95) => noisyRaw(w, h).jpeg({ quality: q }).toBuffer(),
  webp: (w = 400, h = 300) => noisyRaw(w, h).webp({ quality: 95 }).toBuffer(),
};

const tmpdir = () => fs.mkdtempSync(path.join(os.tmpdir(), 'tinysquish-cli-'));

module.exports = { image, tmpdir };
