// TinySquish core for Node: same rules as the web app (app.js), encoded with sharp/libvips.
// Everything happens locally; nothing is sent over the network.
//
//   const { compress } = require('tinysquish');
//   const r = await compress(buffer, { quality: 75, format: 'webp', maxBytes: 100 * 1024 });
//   r.data, r.format, r.width, r.height, r.inBytes, r.outBytes, r.keptOriginal, r.targetMet
'use strict';

const sharp = require('sharp');

const OUTPUT_FORMATS = ['original', 'jpeg', 'png', 'webp'];
const INPUT_FORMATS = ['jpeg', 'png', 'webp', 'gif', 'avif', 'tiff'];
const LOSSY_FLOOR = 40;     // max-size search never goes below this quality before downscaling
const MIN_SIDE = 16;

function normalizeFormat(f) {
  const v = String(f || 'original').toLowerCase();
  if (v === 'jpg') return 'jpeg';
  if (!OUTPUT_FORMATS.includes(v)) throw new Error(`format must be one of ${OUTPUT_FORMATS.join(', ')} (got "${f}")`);
  return v;
}

// Quality slider → PNG settings, mirroring the web app: 90–95 lossless, 65–89 a full 256-color
// palette, lower values allow fewer colors. libimagequant (via sharp) picks the color count from
// its own 0–100 quality target, so below 65 we scale that target instead of a fixed count.
// Returns null for lossless, otherwise the libimagequant quality.
function pngPaletteQuality(quality) {
  return quality >= 90 ? null : quality >= 65 ? 100 : Math.max(10, Math.round(100 * (quality / 65)));
}

function targetDims(w, h, opts) {
  if (opts.resizePercent) {
    const s = opts.resizePercent / 100;
    return [Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s))];
  }
  if (opts.width && opts.height) return [opts.width, opts.height];
  if (opts.width) return [opts.width, Math.max(1, Math.round(opts.width * h / w))];
  if (opts.height) return [Math.max(1, Math.round(opts.height * w / h)), opts.height];
  return [w, h];
}

// One encode at a given size. Lossy formats use `quality`; PNG uses `palette`:
// null = lossless, { q } = libimagequant quality, { colours: 16 } = a 4-bit palette.
// Note: passing `palette: true` to sharp makes it ignore quality/effort/dither, so we don't.
function encode(input, w, h, format, { quality, palette, effort = 7 }) {
  // rotate() applies EXIF orientation; metadata (EXIF, GPS) is not copied, like the browser re-encode
  let p = sharp(input, { failOn: 'error' }).rotate().resize(w, h, { fit: 'fill' });
  if (format === 'jpeg') return p.flatten({ background: '#ffffff' }).jpeg({ quality, mozjpeg: true }).toBuffer();
  if (format === 'webp') return p.webp({ quality, effort: 4 }).toBuffer();
  if (!palette) return p.png({ compressionLevel: 9, adaptiveFiltering: true }).toBuffer();
  return p.png({ quality: palette.q ?? 100, colours: palette.colours ?? 256, effort, dither: 1, compressionLevel: 9 }).toBuffer();
}

async function encodeAtQuality(input, w, h, format, quality, inBytes) {
  if (format === 'png') {
    const q = pngPaletteQuality(quality);
    let out = await encode(input, w, h, format, { palette: q && { q } });
    if (q && out.length >= inBytes) {
      const fewer = await encode(input, w, h, format, { palette: { q: Math.max(10, Math.round(q / 2)) } });
      if (fewer.length < out.length) out = fewer;
    }
    return out;
  }
  let out = await encode(input, w, h, format, { quality });
  if (out.length >= inBytes) {
    const lower = await encode(input, w, h, format, { quality: Math.max(10, quality - 15) });
    if (lower.length < out.length) out = lower;
  }
  return out;
}

// Max-size mode: the quality is the ceiling. Best quality that fits; shrink dimensions only
// when even the floor quality (or a 32-color palette) is too big.
async function encodeToFit(input, w, h, format, quality, target) {
  let best = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    let fit = null, smallest;
    if (format === 'png') {
      // Palette ladder from the slider's setting down to a 16-color palette (faster effort while searching)
      const start = pngPaletteQuality(quality);
      const ladder = [start && { q: start }, ...[100, 80, 60, 40, 20].filter(q => start === null || q < start).map(q => ({ q })),
        { colours: 16 }];
      for (const palette of ladder) {
        smallest = await encode(input, w, h, format, { palette, effort: 4 });
        if (smallest.length <= target) { fit = smallest; break; }
      }
    } else {
      const top = await encode(input, w, h, format, { quality });
      if (top.length <= target) fit = top;
      else {
        smallest = await encode(input, w, h, format, { quality: LOSSY_FLOOR });
        if (smallest.length <= target) {
          let lo = LOSSY_FLOOR, hi = quality;
          fit = smallest;
          while (hi - lo > 1) {
            const mid = Math.round((lo + hi) / 2);
            const b = await encode(input, w, h, format, { quality: mid });
            if (b.length <= target) { fit = b; lo = mid; } else hi = mid;
          }
        }
      }
    }
    if (fit) return { data: fit, w, h, ok: true };
    if (!best || smallest.length < best.data.length) best = { data: smallest, w, h, ok: false };
    // Size scales roughly with pixel count: shrink both sides by the square root of the overshoot
    const scale = Math.sqrt(target / smallest.length) * 0.92;
    const nw = Math.max(MIN_SIDE, Math.floor(w * scale));
    const nh = Math.max(MIN_SIDE, Math.round(h * nw / w));
    if (nw === w) break;
    w = nw; h = nh;
  }
  return best;
}

/**
 * Compress one image.
 * @param {Buffer} input  image bytes (PNG, JPEG, WebP; GIF/AVIF/TIFF accepted as input, first frame only)
 * @param {object} [opts]
 * @param {number} [opts.quality=75]        10–95; the ceiling in max-size mode
 * @param {string} [opts.format='original'] original | jpeg | png | webp
 * @param {number} [opts.maxBytes]          fit the output under this many bytes
 * @param {number} [opts.resizePercent]     scale both sides, e.g. 50
 * @param {number} [opts.width]             target width (height follows the aspect ratio unless given)
 * @param {number} [opts.height]            target height
 */
async function compress(input, opts = {}) {
  const quality = Math.round(opts.quality == null ? 75 : Number(opts.quality));
  if (!(quality >= 10 && quality <= 95)) throw new Error(`quality must be between 10 and 95 (got ${opts.quality})`);
  const wanted = normalizeFormat(opts.format);
  const meta = await sharp(input).metadata();
  if (!INPUT_FORMATS.includes(meta.format)) throw new Error(`unsupported image format: ${meta.format || 'unknown'}`);
  const inFormat = meta.format;
  // Orientations 5–8 rotate by 90°, so the displayed width/height swap
  const [ow, oh] = (meta.orientation || 1) >= 5 ? [meta.height, meta.width] : [meta.width, meta.height];
  const format = wanted === 'original'
    ? (['jpeg', 'png', 'webp'].includes(inFormat) ? inFormat : 'png')
    : wanted;
  let [w, h] = targetDims(ow, oh, opts);

  let data, targetMet = null;
  if (opts.maxBytes) {
    const r = await encodeToFit(input, w, h, format, quality, opts.maxBytes);
    ({ data, w, h } = r);
    targetMet = r.ok;
  } else {
    data = await encodeAtQuality(input, w, h, format, quality, input.length);
  }

  // Never hand back a bigger file when nothing else was asked for (same format, same size);
  // in max-size mode the original also has to fit.
  const resized = w !== ow || h !== oh;
  let keptOriginal = false;
  if (!resized && format === inFormat && wanted === 'original' && data.length >= input.length &&
      (!opts.maxBytes || input.length <= opts.maxBytes)) {
    data = input;
    keptOriginal = true;
    if (opts.maxBytes) targetMet = true;
  }

  return { data, format, width: w, height: h, inWidth: ow, inHeight: oh, inFormat,
    inBytes: input.length, outBytes: data.length, keptOriginal, resized, targetMet };
}

module.exports = { compress, pngPaletteQuality, normalizeFormat, OUTPUT_FORMATS, INPUT_FORMATS };
