/**
 * TinySquish — Core Application Engine
 * Dynamically injected by loader.js — not available via "Save Page As"
 */

window.__initTinySquish = function() {
  'use strict';

  // ===== ORIGIN VERIFICATION =====
  // Prevent running from saved local copies
  if (window.location.protocol === 'file:') return;

  // ===== INJECT APP HTML =====
  var root = document.getElementById('app-root');
  root.innerHTML = '';

  root.innerHTML = [
    '<header class="header">',
    '<div class="brand"><span class="brand-icon">\uD83D\uDC3C</span><span class="brand-name">TinySquish</span></div>',
    '<p class="brand-tagline">Compress images in your browser \u2014 nothing is uploaded</p>',
    '</header>',
    '<main class="container">',
    '<div class="drop-zone" id="dropZone">',
    '<span class="drop-zone-icon">\uD83D\uDDBC\uFE0F</span>',
    '<h2><span class="dz-title-empty">Drop images here</span><span class="dz-title-more">Add more images</span></h2>',
    '<p>or choose from your device</p>',
    '<div class="browse-buttons">',
    '<button class="browse-btn" id="btnChooseFiles">Choose Files</button>',
    '<button class="browse-btn browse-btn-folder" id="btnChooseFolder">\uD83D\uDCC2 Folder</button>',
    '</div>',
    '<p class="formats-hint">PNG, JPEG, WebP \u2022 Up to 20 images</p>',
    '<input type="file" id="fileInput" accept="image/png,image/jpeg,image/webp" multiple>',
    '<input type="file" id="folderInput" webkitdirectory multiple>',
    '</div>',
    '<div class="options-bar" id="optionsBar">',
    '<div class="option-group">',
    '<label>Quality</label>',
    '<input type="range" class="quality-slider" id="qualitySlider" min="10" max="95" value="75">',
    '<span class="quality-value" id="qualityValue">75%</span>',
    '</div>',
    '<div class="option-group">',
    '<label>Format</label>',
    '<select class="format-select" id="formatSelect">',
    '<option value="original">Keep Original</option>',
    '<option value="image/jpeg">JPEG</option>',
    '<option value="image/png">PNG</option>',
    '<option value="image/webp">WebP</option>',
    '</select>',
    '</div>',
    '<div class="action-buttons">',
    '<button class="btn btn-ghost" id="clearAllBtn">Clear all</button>',
    '</div>',
    '</div>',
    '<div class="resize-panel" id="resizePanel">',
    '<div class="resize-header">',
    '<div class="option-group">',
    '<label>Resize</label>',
    '<select class="format-select" id="resizeMode">',
    '<option value="off">Off</option>',
    '<option value="percent">By Percentage</option>',
    '<option value="dimensions">By Dimensions</option>',
    '</select>',
    '</div>',
    '<span class="resize-preview" id="resizePreview"></span>',
    '</div>',
    '<div class="resize-controls" id="resizeControls">',
    '<div class="resize-percent-controls" id="resizePercentControls">',
    '<div class="option-group">',
    '<label>Scale</label>',
    '<input type="range" class="quality-slider" id="resizePercent" min="10" max="200" value="50">',
    '<span class="quality-value" id="resizePercentValue">50%</span>',
    '</div>',
    '</div>',
    '<div class="resize-dim-controls" id="resizeDimControls" style="display:none">',
    '<div class="option-group">',
    '<label>W</label>',
    '<input type="number" class="dim-input" id="resizeWidth" min="1" max="99999" placeholder="Width">',
    '</div>',
    '<div class="option-group">',
    '<label>H</label>',
    '<input type="number" class="dim-input" id="resizeHeight" min="1" max="99999" placeholder="Height">',
    '</div>',
    '<div class="option-group">',
    '<button class="btn-lock" id="aspectLockBtn" title="Lock aspect ratio" aria-label="Lock aspect ratio">\uD83D\uDD12</button>',
    '</div>',
    '</div>',
    '</div>',
    '</div>',
    '<div class="file-list" id="fileList"></div>',
    '<div class="summary-bar" id="summaryBar">',
    '<div class="summary-text">',
    '<p class="summary-main"><span class="summary-saved" id="summarySaved">0%</span> <span id="summarySavedLabel">smaller</span></p>',
    '<p class="summary-detail"><span id="summaryOriginal">0 KB</span> \u2192 <span id="summaryCompressed">0 KB</span> \u00B7 <span id="summaryCount">0</span></p>',
    '</div>',
    '<button class="btn btn-primary btn-lg" id="downloadAllBtn" disabled>Download all</button>',
    '</div>',
    '</main>',
    '<div class="modal-overlay" id="comparisonModal">',
    '<div class="modal">',
    '<div class="modal-header">',
    '<h3 id="modalTitle">Before / After</h3>',
    '<button class="modal-close" id="modalCloseBtn">\u2715</button>',
    '</div>',
    '<div class="comparison-container" id="comparisonContainer">',
    '<img id="compressedPreview" src="" alt="Compressed">',
    '<div class="comparison-original" id="comparisonOriginal">',
    '<img id="originalPreview" src="" alt="Original">',
    '</div>',
    '<div class="comparison-slider" id="comparisonSlider"></div>',
    '</div>',
    '<div class="comparison-labels">',
    '<span>Original <span class="size" id="modalOriginalSize"></span></span>',
    '<span>Compressed <span class="size" id="modalCompressedSize"></span></span>',
    '</div>',
    '</div>',
    '</div>',
    '<div class="toast-container" id="toastContainer"></div>',
    '<footer class="footer"><p>\uD83D\uDC3C TinySquish \u2014 100% local processing, zero uploads</p>',
    '<p class="visitor-count" id="visitorCount" hidden></p></footer>',
    '<div class="devtools-warning" id="devtoolsWarning">',
    '<div style="font-size:2.5rem">\uD83D\uDEE1\uFE0F</div>',
    '<h2>Developer Tools Detected</h2>',
    '<p>Please close Developer Tools to continue using TinySquish.</p>',
    '</div>',
    '<div class="watermark">TINYSQUISH</div>'
  ].join('');

  // ===== STATE =====
  var state = { files: [], nextId: 0 };

  // ===== RESIZE STATE =====
  var resizeState = {
    mode: 'off',        // 'off' | 'percent' | 'dimensions'
    percent: 50,
    width: 0,
    height: 0,
    aspectLocked: true,
    aspectRatio: 1
  };

  // ===== UTILITY =====
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function(c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function getExt(mime) {
    return { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' }[mime] || 'bin';
  }

  function toast(msg, type) {
    var el = document.createElement('div');
    el.className = 'toast ' + (type || 'info');
    el.textContent = msg;
    document.getElementById('toastContainer').appendChild(el);
    setTimeout(function() { el.remove(); }, 3000);
  }

  // ===== DROP ZONE =====
  var dropZone = document.getElementById('dropZone');
  var fileInput = document.getElementById('fileInput');
  var folderInput = document.getElementById('folderInput');

  document.getElementById('btnChooseFiles').addEventListener('click', function(e) {
    e.stopPropagation();
    fileInput.click();
  });

  document.getElementById('btnChooseFolder').addEventListener('click', function(e) {
    e.stopPropagation();
    folderInput.click();
  });

  ['dragenter', 'dragover'].forEach(function(evt) {
    dropZone.addEventListener(evt, function(e) { e.preventDefault(); dropZone.classList.add('drag-over'); });
  });

  ['dragleave', 'drop'].forEach(function(evt) {
    dropZone.addEventListener(evt, function(e) { e.preventDefault(); dropZone.classList.remove('drag-over'); });
  });

  // Recursive folder reading
  function readEntryAsFile(entry) {
    return new Promise(function(resolve, reject) { entry.file(resolve, reject); });
  }

  function readEntriesFromReader(reader) {
    return new Promise(function(resolve, reject) { reader.readEntries(resolve, reject); });
  }

  async function getAllFilesFromEntry(entry) {
    var results = [];
    if (entry.isFile) {
      try {
        var file = await readEntryAsFile(entry);
        if (file.type.match(/^image\/(png|jpeg|webp)$/)) results.push(file);
      } catch(e) {}
    } else if (entry.isDirectory) {
      var reader = entry.createReader();
      var entries;
      do {
        entries = await readEntriesFromReader(reader);
        for (var i = 0; i < entries.length; i++) {
          var childFiles = await getAllFilesFromEntry(entries[i]);
          results = results.concat(childFiles);
        }
      } while (entries.length > 0);
    }
    return results;
  }

  dropZone.addEventListener('drop', async function(e) {
    var items = e.dataTransfer.items;
    if (items && items.length > 0 && items[0].webkitGetAsEntry) {
      var allFiles = [];
      var entries = [];
      for (var i = 0; i < items.length; i++) {
        var entry = items[i].webkitGetAsEntry();
        if (entry) entries.push(entry);
      }
      if (entries.some(function(e) { return e.isDirectory; })) {
        toast('Scanning folder for images...', 'info');
      }
      for (var j = 0; j < entries.length; j++) {
        var files = await getAllFilesFromEntry(entries[j]);
        allFiles = allFiles.concat(files);
      }
      allFiles.length > 0 ? addFiles(allFiles) : toast('No supported images found.', 'error');
    } else {
      var dropped = Array.from(e.dataTransfer.files).filter(function(f) { return f.type.match(/^image\/(png|jpeg|webp)$/); });
      addFiles(dropped);
    }
  });

  dropZone.addEventListener('click', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.closest('button')) return;
    fileInput.click();
  });

  fileInput.addEventListener('change', function() {
    var files = Array.from(fileInput.files).filter(function(f) { return f.type.match(/^image\/(png|jpeg|webp)$/); });
    addFiles(files);
    fileInput.value = '';
  });

  folderInput.addEventListener('change', function() {
    var files = Array.from(folderInput.files).filter(function(f) { return f.type.match(/^image\/(png|jpeg|webp)$/); });
    files.length > 0 ? addFiles(files) : toast('No supported images found in this folder.', 'error');
    folderInput.value = '';
  });

  // ===== FILE MANAGEMENT =====
  function addFiles(files) {
    if (!files.length) { toast('No supported images found. Use PNG, JPEG, or WebP.', 'error'); return; }
    var remaining = 20 - state.files.length;
    if (remaining <= 0) { toast('Maximum 20 images. Remove some first.', 'error'); return; }
    var toAdd = files.slice(0, remaining);
    if (files.length > remaining) toast('Only added ' + remaining + ' of ' + files.length + ' (max 20).', 'info');
    toAdd.forEach(function(file) {
      var id = state.nextId++;
      state.files.push({
        id: id, file: file, originalUrl: URL.createObjectURL(file),
        compressedBlob: null, compressedUrl: null,
        originalSize: file.size, compressedSize: 0, status: 'pending'
      });
    });
    // Preload dimensions for all added files
    toAdd.forEach(function(file) {
      var fo = state.files[state.files.length - toAdd.length + toAdd.indexOf(file)];
      var img = new Image();
      img.onload = function() {
        fo._origW = img.naturalWidth;
        fo._origH = img.naturalHeight;
        // Set aspect ratio from first file if not set yet
        if (state.files.indexOf(fo) === 0) {
          resizeState.aspectRatio = fo._origW / fo._origH;
          if (resizeState.mode === 'dimensions' && !resizeState.width && !resizeState.height) {
            resizeState.width = fo._origW;
            resizeState.height = fo._origH;
            document.getElementById('resizeWidth').value = fo._origW;
            document.getElementById('resizeHeight').value = fo._origH;
          }
        }
        updateResizePreview();
      };
      img.src = fo.originalUrl;
    });
    updateUI();
    toast('Added ' + toAdd.length + ' image' + (toAdd.length > 1 ? 's' : ''), 'success');
    runQueue();
  }

  function removeFile(id) {
    var idx = state.files.findIndex(function(f) { return f.id === id; });
    if (idx === -1) return;
    var f = state.files[idx];
    if (f.originalUrl) URL.revokeObjectURL(f.originalUrl);
    if (f.compressedUrl) URL.revokeObjectURL(f.compressedUrl);
    state.files.splice(idx, 1);
    updateUI();
  }

  function clearAll() {
    state.files.forEach(function(f) {
      if (f.originalUrl) URL.revokeObjectURL(f.originalUrl);
      if (f.compressedUrl) URL.revokeObjectURL(f.compressedUrl);
    });
    state.files = [];
    updateUI();
    toast('All files cleared', 'info');
  }

  // ===== RESIZE ENGINE =====
  function calcResizeDims(origW, origH) {
    if (resizeState.mode === 'percent') {
      var scale = resizeState.percent / 100;
      return { w: Math.max(1, Math.round(origW * scale)), h: Math.max(1, Math.round(origH * scale)) };
    }
    if (resizeState.mode === 'dimensions') {
      return { w: Math.max(1, resizeState.width || origW), h: Math.max(1, resizeState.height || origH) };
    }
    return { w: origW, h: origH };
  }

  function resizeCanvas(img, targetW, targetH) {
    var currentW = img.naturalWidth || img.width;
    var currentH = img.naturalHeight || img.height;

    // Start with source image on a canvas
    var src = document.createElement('canvas');
    src.width = currentW;
    src.height = currentH;
    var srcCtx = src.getContext('2d');
    srcCtx.drawImage(img, 0, 0);

    // Step down in halves for quality (>2x downscale)
    while (currentW / 2 >= targetW && currentH / 2 >= targetH) {
      var halfW = Math.round(currentW / 2);
      var halfH = Math.round(currentH / 2);
      var tmp = document.createElement('canvas');
      tmp.width = halfW;
      tmp.height = halfH;
      var tmpCtx = tmp.getContext('2d');
      tmpCtx.imageSmoothingEnabled = true;
      tmpCtx.imageSmoothingQuality = 'high';
      tmpCtx.drawImage(src, 0, 0, halfW, halfH);
      src = tmp;
      currentW = halfW;
      currentH = halfH;
    }

    // Final step to exact target
    var final_ = document.createElement('canvas');
    final_.width = targetW;
    final_.height = targetH;
    var finalCtx = final_.getContext('2d');
    finalCtx.imageSmoothingEnabled = true;
    finalCtx.imageSmoothingQuality = 'high';
    finalCtx.drawImage(src, 0, 0, targetW, targetH);
    return final_;
  }

  function updateResizePreview() {
    var preview = document.getElementById('resizePreview');
    if (resizeState.mode === 'off' || !state.files.length) {
      preview.textContent = '';
      return;
    }
    var fo = state.files[0];
    if (!fo._origW) {
      preview.textContent = '';
      return;
    }
    var dims = calcResizeDims(fo._origW, fo._origH);
    preview.textContent = fo._origW + '\u00D7' + fo._origH + ' \u2192 ' + dims.w + '\u00D7' + dims.h;
  }

  // ===== COMPRESSION ENGINE =====
  function loadImage(src) {
    return new Promise(function(resolve, reject) {
      var img = new Image();
      img.onload = function() { resolve(img); };
      img.onerror = reject;
      img.src = src;
    });
  }

  async function compressImage(fileObj) {
    var gen = settingsGen;
    var quality = parseInt(document.getElementById('qualitySlider').value) / 100;
    var targetFormat = document.getElementById('formatSelect').value;
    var outputMime = targetFormat === 'original' ? fileObj.file.type : targetFormat;
    fileObj.status = 'compressing';
    updateFileItem(fileObj);
    try {
      var img = await loadImage(fileObj.originalUrl);
      var origW = img.naturalWidth, origH = img.naturalHeight;

      // Store original dimensions for display and aspect ratio
      fileObj._origW = origW;
      fileObj._origH = origH;

      // Calculate resize dimensions
      var w = origW, h = origH;
      var resized = false;
      if (resizeState.mode !== 'off') {
        resizeState.aspectRatio = origW / origH;
        var dims = calcResizeDims(origW, origH);
        w = dims.w;
        h = dims.h;
        if (w !== origW || h !== origH) resized = true;
      }
      fileObj._outW = w;
      fileObj._outH = h;

      // Create canvas — use multi-step resize if dimensions changed
      var canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      var ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      var blob;

      if (outputMime === 'image/png' && typeof UPNG !== 'undefined') {
        // === PNG: UPNG.js indexed-color quantization (TinyPNG-like) ===
        ctx.clearRect(0, 0, w, h);
        if (resized) {
          var rc = resizeCanvas(img, w, h);
          ctx.drawImage(rc, 0, 0);
        } else {
          ctx.drawImage(img, 0, 0);
        }
        var rgba = ctx.getImageData(0, 0, w, h).data.buffer;
        // Map quality slider to palette color count (0 = lossless in UPNG):
        // 90–95% → lossless, 65–89% → 256, 50% → 197, 25% → 98, 10% → 39
        var colors = quality >= 0.9 ? 0 : quality >= 0.65 ? 256 : Math.max(16, Math.round(256 * (quality / 0.65)));
        var pngData = UPNG.encode([rgba], w, h, colors);
        blob = new Blob([pngData], { type: 'image/png' });

        // If still bigger, try with fewer colors (never when lossless was requested)
        if (colors > 0 && blob.size >= fileObj.originalSize) {
          var fewer = Math.max(16, Math.round(colors * 0.5));
          var pngData2 = UPNG.encode([rgba], w, h, fewer);
          var blob2 = new Blob([pngData2], { type: 'image/png' });
          blob = blob2.size < blob.size ? blob2 : blob;
        }
      } else {
        // === JPEG / WebP (or PNG fallback without UPNG) ===
        if (outputMime === 'image/jpeg') {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, w, h);
        } else {
          ctx.clearRect(0, 0, w, h);
        }
        if (resized) {
          var rc = resizeCanvas(img, w, h);
          ctx.drawImage(rc, 0, 0);
        } else {
          ctx.drawImage(img, 0, 0);
        }
        blob = await new Promise(function(resolve, reject) {
          canvas.toBlob(function(b) { b ? resolve(b) : reject(new Error('fail')); }, outputMime, quality);
        });

        // If bigger, retry at lower quality
        if (blob.size >= fileObj.originalSize) {
          var blob2 = await new Promise(function(r) {
            canvas.toBlob(function(b) { r(b); }, outputMime, Math.max(0.1, quality - 0.15));
          });
          if (blob2 && blob2.size < blob.size) blob = blob2;
        }
      }

      // Final safety: never return a file bigger than the original (skip if resized)
      if (!resized && blob.size >= fileObj.originalSize && targetFormat === 'original') {
        blob = fileObj.file;
      }

      // Settings changed mid-compression: drop this result, the queue redoes the file
      if (gen !== settingsGen) { fileObj.status = 'pending'; updateFileItem(fileObj); return; }

      fileObj.compressedBlob = blob;
      if (fileObj.compressedUrl) URL.revokeObjectURL(fileObj.compressedUrl);
      fileObj.compressedUrl = URL.createObjectURL(fileObj.compressedBlob);
      fileObj.compressedSize = fileObj.compressedBlob.size;
      fileObj.status = 'done';
    } catch(err) {
      if (gen !== settingsGen) { fileObj.status = 'pending'; updateFileItem(fileObj); return; }
      fileObj.status = 'error';
      toast('Failed to compress ' + fileObj.file.name, 'error');
    }
    updateFileItem(fileObj);
  }

  // ===== AUTO-COMPRESS QUEUE =====
  // Files compress as soon as they're added, and again whenever an output setting changes.
  // settingsGen invalidates results computed with settings that are no longer current.
  var settingsGen = 0, queueRunning = false, recompressTimer = null;

  async function runQueue() {
    if (queueRunning) return;
    queueRunning = true;
    var next;
    while ((next = state.files.find(function(f) { return f.status === 'pending'; }))) {
      await compressImage(next);
      updateSummary();
      updateDownloadBtn();
    }
    queueRunning = false;
  }

  function recompressAll(delay) {
    clearTimeout(recompressTimer);
    recompressTimer = setTimeout(function() {
      if (!state.files.length) return;
      settingsGen++;
      state.files.forEach(function(f) {
        if (f.status !== 'compressing') { f.status = 'pending'; updateFileItem(f); }
      });
      runQueue();
    }, delay || 0);
  }

  // ===== DOWNLOAD =====
  function downloadFile(fileObj) {
    if (!fileObj.compressedBlob) return;
    var a = document.createElement('a');
    a.href = fileObj.compressedUrl;
    a.download = fileObj.file.name.replace(/\.[^.]+$/, '') + '-compressed.' + getExt(fileObj.compressedBlob.type);
    a.click();
  }

  // ===== ZIP =====
  function crc32(data) {
    var crc = 0xFFFFFFFF;
    if (!crc32.t) {
      crc32.t = new Uint32Array(256);
      for (var i = 0; i < 256; i++) { var c = i; for (var j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); crc32.t[i] = c; }
    }
    for (var k = 0; k < data.length; k++) crc = crc32.t[(crc ^ data[k]) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  // Same-named inputs would overwrite each other on extraction → "name (2).ext".
  // Compared case-insensitively because Windows/macOS filesystems are.
  function uniqueName(name, used) {
    var base = name.replace(/\.[^.]+$/, ''), ext = name.slice(base.length), candidate = name;
    for (var i = 2; used[candidate.toLowerCase()]; i++) candidate = base + ' (' + i + ')' + ext;
    used[candidate.toLowerCase()] = true;
    return candidate;
  }

  async function buildZip(files) {
    var localFiles = [], centralDir = [], offset = 0, used = {};
    for (var n = 0; n < files.length; n++) {
      var fo = files[n];
      var name = uniqueName(fo.file.name.replace(/\.[^.]+$/, '') + '-compressed.' + getExt(fo.compressedBlob.type), used);
      var nameBytes = new TextEncoder().encode(name);
      var fileData = new Uint8Array(await fo.compressedBlob.arrayBuffer());
      var crc = crc32(fileData);

      var lh = new Uint8Array(30 + nameBytes.length);
      var lv = new DataView(lh.buffer);
      // Flag bit 11: names are UTF-8 (otherwise unzippers read them as CP437)
      lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true);
      lv.setUint32(14, crc, true); lv.setUint32(18, fileData.length, true);
      lv.setUint32(22, fileData.length, true); lv.setUint16(26, nameBytes.length, true);
      lh.set(nameBytes, 30);

      var cd = new Uint8Array(46 + nameBytes.length);
      var cv = new DataView(cd.buffer);
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true);
      cv.setUint32(16, crc, true); cv.setUint32(20, fileData.length, true);
      cv.setUint32(24, fileData.length, true); cv.setUint16(28, nameBytes.length, true);
      cv.setUint32(38, 0x20, true); cv.setUint32(42, offset, true);
      cd.set(nameBytes, 46);

      localFiles.push(lh, fileData);
      centralDir.push(cd);
      offset += lh.length + fileData.length;
    }
    var cdSize = 0;
    centralDir.forEach(function(c) { cdSize += c.length; });
    var eocd = new Uint8Array(22);
    var ev = new DataView(eocd.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(8, files.length, true); ev.setUint16(10, files.length, true);
    ev.setUint32(12, cdSize, true); ev.setUint32(16, offset, true);
    return new Blob(localFiles.concat(centralDir).concat([eocd]), { type: 'application/zip' });
  }

  document.getElementById('downloadAllBtn').addEventListener('click', async function() {
    var compressed = state.files.filter(function(f) { return f.status === 'done'; });
    if (!compressed.length) return;
    toast('Building ZIP...', 'info');
    try {
      var zipBlob = await buildZip(compressed);
      var a = document.createElement('a');
      a.href = URL.createObjectURL(zipBlob);
      a.download = 'tinysquish-compressed.zip';
      a.click();
      // Revoking synchronously can cancel the download in Safari/Firefox — give it time to start
      var zipUrl = a.href;
      setTimeout(function() { URL.revokeObjectURL(zipUrl); }, 60000);
      toast('ZIP downloaded!', 'success');
    } catch(err) { toast('Failed to create ZIP', 'error'); }
  });

  document.getElementById('clearAllBtn').addEventListener('click', clearAll);

  // ===== COMPARISON =====
  function showComparison(id) {
    var fo = state.files.find(function(f) { return f.id === id; });
    if (!fo || !fo.compressedUrl) return;
    document.getElementById('modalTitle').textContent = fo.file.name;
    document.getElementById('originalPreview').src = fo.originalUrl;
    document.getElementById('compressedPreview').src = fo.compressedUrl;
    document.getElementById('modalOriginalSize').textContent = '(' + formatSize(fo.originalSize) + ')';
    document.getElementById('modalCompressedSize').textContent = '(' + formatSize(fo.compressedSize) + ')';
    document.getElementById('comparisonModal').classList.add('visible');
    requestAnimationFrame(function() {
      var ctr = document.getElementById('comparisonContainer');
      setSlider(ctr.offsetWidth * 0.5);
    });
  }

  function closeModal() { document.getElementById('comparisonModal').classList.remove('visible'); }
  document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
  document.getElementById('comparisonModal').addEventListener('click', function(e) { if (e.target.id === 'comparisonModal') closeModal(); });
  window.addEventListener('keydown', function(e) { if (e.key === 'Escape') closeModal(); });

  var sliderDrag = false;
  var ctr = document.getElementById('comparisonContainer');
  function setSlider(x) {
    var rect = ctr.getBoundingClientRect();
    var pos = Math.max(0, Math.min(x, rect.width));
    var pct = (pos / rect.width) * 100;
    document.getElementById('comparisonSlider').style.left = pct + '%';
    document.getElementById('comparisonOriginal').style.clipPath = 'inset(0 ' + (100 - pct) + '% 0 0)';
  }
  ctr.addEventListener('mousedown', function(e) { sliderDrag = true; setSlider(e.clientX - ctr.getBoundingClientRect().left); });
  window.addEventListener('mousemove', function(e) { if (sliderDrag) setSlider(e.clientX - ctr.getBoundingClientRect().left); });
  window.addEventListener('mouseup', function() { sliderDrag = false; });
  ctr.addEventListener('touchstart', function(e) { sliderDrag = true; setSlider(e.touches[0].clientX - ctr.getBoundingClientRect().left); }, { passive: true });
  window.addEventListener('touchmove', function(e) { if (sliderDrag) setSlider(e.touches[0].clientX - ctr.getBoundingClientRect().left); }, { passive: true });
  window.addEventListener('touchend', function() { sliderDrag = false; });

  // ===== QUALITY SLIDER =====
  document.getElementById('qualitySlider').addEventListener('input', function(e) {
    document.getElementById('qualityValue').textContent = e.target.value + '%';
  });
  document.getElementById('qualitySlider').addEventListener('change', function() { recompressAll(); });
  document.getElementById('formatSelect').addEventListener('change', function() { recompressAll(); });

  // ===== RESIZE CONTROLS =====
  var resizeModeSelect = document.getElementById('resizeMode');
  var resizePercentSlider = document.getElementById('resizePercent');
  var resizePercentValueEl = document.getElementById('resizePercentValue');
  var resizeWidthInput = document.getElementById('resizeWidth');
  var resizeHeightInput = document.getElementById('resizeHeight');
  var aspectLockBtn = document.getElementById('aspectLockBtn');
  var resizePercentControls = document.getElementById('resizePercentControls');
  var resizeDimControls = document.getElementById('resizeDimControls');
  var resizeControlsEl = document.getElementById('resizeControls');

  resizeModeSelect.addEventListener('change', function() {
    resizeState.mode = this.value;
    resizeControlsEl.style.display = this.value === 'off' ? 'none' : 'flex';
    resizePercentControls.style.display = this.value === 'percent' ? '' : 'none';
    resizeDimControls.style.display = this.value === 'dimensions' ? '' : 'none';
    // Pre-populate dimension fields from first image
    if (this.value === 'dimensions' && state.files.length > 0) {
      var fo = state.files[0];
      if (fo._origW && (!resizeState.width || !resizeState.height)) {
        resizeState.aspectRatio = fo._origW / fo._origH;
        resizeState.width = fo._origW;
        resizeState.height = fo._origH;
        resizeWidthInput.value = fo._origW;
        resizeHeightInput.value = fo._origH;
      }
    }
    updateResizePreview();
    recompressAll();
  });

  resizePercentSlider.addEventListener('input', function() {
    resizeState.percent = parseInt(this.value);
    resizePercentValueEl.textContent = this.value + '%';
    updateResizePreview();
  });
  resizePercentSlider.addEventListener('change', function() { recompressAll(); });

  resizeWidthInput.addEventListener('input', function() {
    resizeState.width = parseInt(this.value) || 0;
    if (resizeState.aspectLocked && resizeState.aspectRatio > 0 && resizeState.width > 0) {
      resizeState.height = Math.max(1, Math.round(resizeState.width / resizeState.aspectRatio));
      resizeHeightInput.value = resizeState.height;
    }
    updateResizePreview();
    recompressAll(500);
  });

  resizeHeightInput.addEventListener('input', function() {
    resizeState.height = parseInt(this.value) || 0;
    if (resizeState.aspectLocked && resizeState.aspectRatio > 0 && resizeState.height > 0) {
      resizeState.width = Math.max(1, Math.round(resizeState.height * resizeState.aspectRatio));
      resizeWidthInput.value = resizeState.width;
    }
    updateResizePreview();
    recompressAll(500);
  });

  aspectLockBtn.addEventListener('click', function() {
    resizeState.aspectLocked = !resizeState.aspectLocked;
    this.textContent = resizeState.aspectLocked ? '\uD83D\uDD12' : '\uD83D\uDD13';
    this.title = resizeState.aspectLocked ? 'Lock aspect ratio' : 'Unlock aspect ratio';
  });

  // ===== UI RENDERING =====
  function updateUI() {
    var optionsBar = document.getElementById('optionsBar');
    var resizePanel = document.getElementById('resizePanel');
    var fileList = document.getElementById('fileList');
    state.files.length > 0 ? optionsBar.classList.add('visible') : optionsBar.classList.remove('visible');
    state.files.length > 0 ? resizePanel.classList.add('visible') : resizePanel.classList.remove('visible');
    // Once files are in, the drop zone shrinks to one row so results move up
    dropZone.classList.toggle('compact', state.files.length > 0);
    if (!state.files.length) document.getElementById('summaryBar').classList.remove('visible');
    fileList.innerHTML = '';
    state.files.forEach(function(f) { fileList.appendChild(createFileEl(f)); });
    updateSummary();
    updateDownloadBtn();
  }

  function createFileEl(fo) {
    var el = document.createElement('div');
    el.className = 'file-item';
    el.id = 'file-' + fo.id;
    var savings = fo.compressedSize > 0 ? Math.round((1 - fo.compressedSize / fo.originalSize) * 100) : 0;
    var sc = savings > 50 ? 'great' : 'good';
    var safeName = escapeHtml(fo.file.name);
    var html = '<img class="file-thumb" src="' + fo.originalUrl + '" alt="' + safeName + '">';
    html += '<div class="file-info"><div class="file-name">' + safeName + '</div><div class="file-meta">';
    html += '<span class="file-size-original">' + formatSize(fo.originalSize) + '</span>';
    if (fo._origW && fo._outW && (fo._outW !== fo._origW || fo._outH !== fo._origH)) {
      html += '<span class="file-dims">' + fo._origW + '\u00D7' + fo._origH + ' \u2192 ' + fo._outW + '\u00D7' + fo._outH + '</span>';
    }
    if (fo.status === 'done') html += ' <span>\u2192</span> <span class="file-size-compressed">' + formatSize(fo.compressedSize) + '</span> <span class="file-savings ' + sc + '">-' + savings + '%</span>';
    if (fo.status === 'compressing') html += '<span class="file-status compressing"><span class="spinner"></span> Compressing...</span>';
    if (fo.status === 'error') html += '<span class="file-status error">Error</span>';
    if (fo.status === 'pending') html += '<span class="file-status">Waiting\u2026</span>';
    html += '</div></div><div class="file-actions">';
    if (fo.status === 'done') html += '<button class="file-btn compare-btn" data-id="' + fo.id + '" title="Compare" aria-label="Compare original and compressed">\uD83D\uDD0D</button><button class="file-btn download-btn" data-id="' + fo.id + '" title="Download" aria-label="Download compressed image">\u2B07\uFE0F</button>';
    html += '<button class="file-btn delete remove-btn" data-id="' + fo.id + '" title="Remove" aria-label="Remove image">\u2715</button></div>';
    if (fo.status === 'compressing') html += '<div class="file-progress" style="width:60%"></div>';
    if (fo.status === 'done') html += '<div class="file-progress" style="width:100%;background:var(--success);"></div>';
    el.innerHTML = html;

    // Event delegation
    el.querySelector('.remove-btn').addEventListener('click', function() { removeFile(fo.id); });
    if (fo.status === 'done') {
      el.querySelector('.compare-btn').addEventListener('click', function() { showComparison(fo.id); });
      el.querySelector('.download-btn').addEventListener('click', function() { downloadFile(fo); });
      el.querySelector('.file-thumb').addEventListener('click', function() { showComparison(fo.id); });
      el.querySelector('.file-thumb').style.cursor = 'pointer';
      el.querySelector('.file-thumb').title = 'Click to compare';
    }
    return el;
  }

  function updateFileItem(fo) {
    var existing = document.getElementById('file-' + fo.id);
    if (existing) existing.replaceWith(createFileEl(fo));
  }

  function updateSummary() {
    var done = state.files.filter(function(f) { return f.status === 'done'; });
    var bar = document.getElementById('summaryBar');
    if (!done.length) { bar.classList.remove('visible'); return; }
    bar.classList.add('visible');
    var totOrig = 0, totComp = 0;
    done.forEach(function(f) { totOrig += f.originalSize; totComp += f.compressedSize; });
    var saved = totOrig > 0 ? Math.round((1 - totComp / totOrig) * 100) : 0;
    document.getElementById('summaryCount').textContent = done.length + ' image' + (done.length === 1 ? '' : 's');
    document.getElementById('summaryOriginal').textContent = formatSize(totOrig);
    document.getElementById('summaryCompressed').textContent = formatSize(totComp);
    document.getElementById('summarySaved').textContent = Math.abs(saved) + '%';
    document.getElementById('summarySavedLabel').textContent = saved < 0 ? 'larger' : 'smaller';
  }

  function updateDownloadBtn() {
    // Wait for the whole batch so the ZIP never silently misses files still in the queue
    var btn = document.getElementById('downloadAllBtn');
    var busy = state.files.some(function(f) { return f.status === 'pending' || f.status === 'compressing'; });
    btn.disabled = busy || !state.files.some(function(f) { return f.status === 'done'; });
    btn.textContent = busy ? 'Compressing\u2026' : 'Download all';
  }

  // ===== VISITOR COUNTER =====
  // Only aggregate counts — images never leave the browser.
  // Count once per browser session; later loads just read the numbers.
  function loadVisitorCount() {
    var el = document.getElementById('visitorCount');
    var counted = false;
    try { counted = sessionStorage.getItem('ts_counted') === '1'; } catch(e) {}
    fetch('/api/visits', { method: counted ? 'GET' : 'POST', cache: 'no-store' })
      .then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function(d) {
        try { sessionStorage.setItem('ts_counted', '1'); } catch(e) {}
        var fmt = function(n) { return Number(n).toLocaleString('en-US'); };
        el.textContent = '👀 ' + fmt(d.total) + ' visitor' + (d.total === 1 ? '' : 's') + ' · ' + fmt(d.today) + ' today';
        el.hidden = false;
      })
      .catch(function() {}); // offline or API down: keep the counter hidden
  }
  loadVisitorCount();

  // Expose for thumbnail click in comparison
  window._tsShowComparison = showComparison;
  window._tsDownloadFile = downloadFile;
};
