/**
 * TinySquish — Core Application Engine
 * Dynamically injected by loader.js — not available via "Save Page As"
 */

window.__initTinySquish = function() {
  'use strict';

  // ===== ORIGIN VERIFICATION =====
  // Prevent running from saved local copies
  if (window.location.protocol === 'file:') return;

  // ===== I18N =====
  // UI language follows <html lang>; pages under /id/ get Indonesian.
  var LANG = document.documentElement.lang === 'id' ? 'id' : 'en';
  var STRINGS = {
    en: {
      dropTitle: 'Drop images here', dropMore: 'Add more images', orChoose: 'or choose from your device',
      chooseFiles: 'Choose Files', folder: 'Folder', formatsHint: 'PNG, JPEG, WebP \u2022 Up to 20 images',
      settings: 'Output settings', quality: 'Quality', pngLossless: ' \u00B7 PNG lossless',
      format: 'Format', keepOriginal: 'Keep original', maxSize: 'Max size', noLimit: 'No limit',
      resize: 'Resize', off: 'Off', byPercent: 'By percentage', byDims: 'By dimensions', scale: 'Scale',
      w: 'W', h: 'H', width: 'Width', height: 'Height', lock: 'Lock aspect ratio', unlock: 'Unlock aspect ratio',
      clearAll: 'Clear all', images: function(n) { return n + ' image' + (n === 1 ? '' : 's'); },
      smaller: 'smaller', larger: 'larger', downloadAll: 'Download all', compressing: 'Compressing\u2026',
      waiting: 'Waiting\u2026', error: 'Error', beforeAfter: 'Before / After', closeCompare: 'Close comparison',
      original: 'Original', compressed: 'Compressed', compare: 'Compare', compareAria: 'Compare original and compressed',
      download: 'Download', downloadAria: 'Download compressed image', remove: 'Remove', removeAria: 'Remove image',
      clickCompare: 'Click to compare', targetMissed: function(t) { return 'Couldn\u2019t reach ' + t; },
      devtoolsTitle: 'Developer Tools Detected', devtoolsBody: 'Please close Developer Tools to continue using TinySquish.',
      scanning: 'Scanning folder for images\u2026', noneFound: 'No supported images found.',
      noneInFolder: 'No supported images found in this folder.', noneSupported: 'No supported images found. Use PNG, JPEG, or WebP.',
      max20: 'Maximum 20 images. Remove some first.',
      onlyAdded: function(r, n) { return 'Only added ' + r + ' of ' + n + ' (max 20).'; },
      cleared: function(n) { return 'Cleared ' + n + ' image' + (n === 1 ? '' : 's'); }, undo: 'Undo',
      failed: function(name) { return 'Failed to compress ' + name; }, buildingZip: 'Building ZIP\u2026',
      zipDone: 'ZIP downloaded!', zipFailed: 'Failed to create ZIP',
      visitors: function(total, today) { return total + ' visitor' + (total === '1' ? '' : 's') + ' \u00B7 ' + today + ' today'; }
    },
    id: {
      dropTitle: 'Taruh gambar di sini', dropMore: 'Tambah gambar', orChoose: 'atau pilih dari perangkat Anda',
      chooseFiles: 'Pilih File', folder: 'Folder', formatsHint: 'PNG, JPEG, WebP \u2022 Maksimal 20 gambar',
      settings: 'Pengaturan hasil', quality: 'Kualitas', pngLossless: ' \u00B7 PNG lossless',
      format: 'Format', keepOriginal: 'Format asli', maxSize: 'Ukuran maks', noLimit: 'Tanpa batas',
      resize: 'Ubah ukuran', off: 'Tidak', byPercent: 'Persentase', byDims: 'Dimensi', scale: 'Skala',
      w: 'L', h: 'T', width: 'Lebar', height: 'Tinggi', lock: 'Kunci rasio aspek', unlock: 'Buka kunci rasio aspek',
      clearAll: 'Hapus semua', images: function(n) { return n + ' gambar'; },
      smaller: 'lebih kecil', larger: 'lebih besar', downloadAll: 'Unduh semua', compressing: 'Mengompres\u2026',
      waiting: 'Menunggu\u2026', error: 'Gagal', beforeAfter: 'Sebelum / Sesudah', closeCompare: 'Tutup perbandingan',
      original: 'Asli', compressed: 'Hasil', compare: 'Bandingkan', compareAria: 'Bandingkan gambar asli dan hasil',
      download: 'Unduh', downloadAria: 'Unduh gambar hasil', remove: 'Hapus', removeAria: 'Hapus gambar',
      clickCompare: 'Klik untuk membandingkan', targetMissed: function(t) { return 'Tidak bisa mencapai ' + t; },
      devtoolsTitle: 'Developer Tools Terdeteksi', devtoolsBody: 'Tutup Developer Tools untuk lanjut memakai TinySquish.',
      scanning: 'Memindai folder\u2026', noneFound: 'Tidak ada gambar yang didukung.',
      noneInFolder: 'Tidak ada gambar yang didukung di folder ini.', noneSupported: 'Tidak ada gambar yang didukung. Gunakan PNG, JPEG, atau WebP.',
      max20: 'Maksimal 20 gambar. Hapus beberapa dulu.',
      onlyAdded: function(r, n) { return 'Hanya ' + r + ' dari ' + n + ' yang ditambahkan (maks 20).'; },
      cleared: function(n) { return n + ' gambar dihapus'; }, undo: 'Batalkan',
      failed: function(name) { return 'Gagal mengompres ' + name; }, buildingZip: 'Membuat ZIP\u2026',
      zipDone: 'ZIP diunduh!', zipFailed: 'Gagal membuat ZIP',
      visitors: function(total, today) { return total + ' pengunjung \u00B7 ' + today + ' hari ini'; }
    }
  };
  var T = STRINGS[LANG];

  // Page presets (landing pages set these on <body>): output format and max size in KB
  var PRESET = { format: document.body.dataset.presetFormat || 'original', maxKb: document.body.dataset.presetMaxKb || '' };
  var MAX_SIZES = [50, 100, 200, 300, 500, 1000, 2000];

  // ===== INJECT APP HTML =====
  // ===== ICONS =====
  // Inline stroke icons: render the same on every OS (emoji didn't) and follow currentColor
  var ICON_PATHS = {
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
    folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    compare: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M12 3v18"/>',
    download: '<path d="M12 4v11"/><path d="m7 10 5 5 5-5"/><path d="M5 20h14"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    unlock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.5-2"/>',
    drag: '<path d="m9 8-4 4 4 4M15 8l4 4-4 4"/>'
  };
  function icon(name, size) {
    size = size || 18;
    return '<svg class="icon" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICON_PATHS[name] + '</svg>';
  }

  var root = document.getElementById('app-root');
  root.innerHTML = '';

  root.innerHTML = [
    // Header, explainer content and footer are static in index.html so crawlers see them
    '<div class="container">',
    '<div class="drop-zone" id="dropZone">',
    '<span class="drop-zone-icon">' + icon('image', 40) + '</span>',
    '<h2><span class="dz-title-empty">' + T.dropTitle + '</span><span class="dz-title-more">' + T.dropMore + '</span></h2>',
    '<p>' + T.orChoose + '</p>',
    '<div class="browse-buttons">',
    '<button class="browse-btn" id="btnChooseFiles">' + T.chooseFiles + '</button>',
    '<button class="browse-btn browse-btn-folder" id="btnChooseFolder">' + icon('folder', 16) + ' ' + T.folder + '</button>',
    '</div>',
    '<p class="formats-hint">' + T.formatsHint + '</p>',
    '<input type="file" id="fileInput" accept="image/png,image/jpeg,image/webp" multiple>',
    '<input type="file" id="folderInput" webkitdirectory multiple>',
    '</div>',
    '<section class="options-bar" id="optionsBar" aria-label="' + T.settings + '">',
    '<div class="setting setting-quality">',
    '<label for="qualitySlider">' + T.quality + ' <span class="quality-value" id="qualityValue">75%</span></label>',
    '<input type="range" class="quality-slider" id="qualitySlider" min="10" max="95" value="75">',
    '</div>',
    '<div class="setting">',
    '<label for="formatSelect">' + T.format + '</label>',
    '<select class="format-select" id="formatSelect">',
    '<option value="original">' + T.keepOriginal + '</option>',
    '<option value="image/jpeg">JPEG</option>',
    '<option value="image/png">PNG</option>',
    '<option value="image/webp">WebP</option>',
    '</select>',
    '</div>',
    '<div class="setting">',
    '<label for="maxSizeSelect">' + T.maxSize + '</label>',
    '<select class="format-select" id="maxSizeSelect">',
    '<option value="">' + T.noLimit + '</option>',
    MAX_SIZES.map(function(kb) { return '<option value="' + kb + '">' + (kb >= 1000 ? kb / 1000 + ' MB' : kb + ' KB') + '</option>'; }).join(''),
    '</select>',
    '</div>',
    '<div class="setting">',
    '<label for="resizeMode">' + T.resize + '</label>',
    '<select class="format-select" id="resizeMode">',
    '<option value="off">' + T.off + '</option>',
    '<option value="percent">' + T.byPercent + '</option>',
    '<option value="dimensions">' + T.byDims + '</option>',
    '</select>',
    '</div>',
    '<div class="resize-controls" id="resizeControls">',
    '<div class="resize-percent-controls" id="resizePercentControls">',
    '<div class="option-group">',
    '<label for="resizePercent">' + T.scale + '</label>',
    '<input type="range" class="quality-slider" id="resizePercent" min="10" max="200" value="50">',
    '<span class="quality-value" id="resizePercentValue">50%</span>',
    '</div>',
    '</div>',
    '<div class="resize-dim-controls" id="resizeDimControls" style="display:none">',
    '<div class="option-group">',
    '<label for="resizeWidth">' + T.w + '</label>',
    '<input type="number" class="dim-input" id="resizeWidth" min="1" max="99999" placeholder="' + T.width + '">',
    '</div>',
    '<div class="option-group">',
    '<label for="resizeHeight">' + T.h + '</label>',
    '<input type="number" class="dim-input" id="resizeHeight" min="1" max="99999" placeholder="' + T.height + '">',
    '</div>',
    '<div class="option-group">',
    '<button class="btn-lock" id="aspectLockBtn" title="' + T.lock + '" aria-label="' + T.lock + '" aria-pressed="true">' + icon('lock', 16) + '</button>',
    '</div>',
    '</div>',
    '<span class="resize-preview" id="resizePreview"></span>',
    '</div>',
    '</section>',
    '<div class="list-header" id="listHeader">',
    '<span class="list-count" id="listCount"></span>',
    '<button class="btn btn-ghost" id="clearAllBtn">' + T.clearAll + '</button>',
    '</div>',
    '<div class="file-list" id="fileList"></div>',
    '<div class="summary-bar" id="summaryBar">',
    '<div class="summary-text">',
    '<p class="summary-main"><span class="summary-saved" id="summarySaved">0%</span> <span id="summarySavedLabel">' + T.smaller + '</span></p>',
    '<p class="summary-detail"><span id="summaryOriginal">0 KB</span> \u2192 <span id="summaryCompressed">0 KB</span> \u00B7 <span id="summaryCount">0</span></p>',
    '</div>',
    '<button class="btn btn-primary btn-lg" id="downloadAllBtn" disabled>' + T.downloadAll + '</button>',
    '</div>',
    '</div>',
    '<div class="modal-overlay" id="comparisonModal">',
    '<div class="modal">',
    '<div class="modal-header">',
    '<h3 id="modalTitle">' + T.beforeAfter + '</h3>',
    '<button class="modal-close" id="modalCloseBtn" aria-label="' + T.closeCompare + '">' + icon('close', 18) + '</button>',
    '</div>',
    '<div class="comparison-container" id="comparisonContainer">',
    '<img id="compressedPreview" src="" alt="' + T.compressed + '">',
    '<div class="comparison-original" id="comparisonOriginal">',
    '<img id="originalPreview" src="" alt="' + T.original + '">',
    '</div>',
    '<div class="comparison-slider" id="comparisonSlider"><span class="comparison-handle">' + icon('drag', 16) + '</span></div>',
    '</div>',
    '<div class="comparison-labels">',
    '<span>' + T.original + ' <span class="size" id="modalOriginalSize"></span></span>',
    '<span>' + T.compressed + ' <span class="size" id="modalCompressedSize"></span></span>',
    '</div>',
    '</div>',
    '</div>',
    '<div class="toast-container" id="toastContainer" role="status" aria-live="polite"></div>',
    '<div class="devtools-warning" id="devtoolsWarning">',
    '<div style="font-size:2.5rem">\uD83D\uDEE1\uFE0F</div>',
    '<h2>' + T.devtoolsTitle + '</h2>',
    '<p>' + T.devtoolsBody + '</p>',
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

  // action (optional): { label, ms, onClick, onExpire } adds a button and a longer life
  function toast(msg, type, action) {
    var el = document.createElement('div');
    var ms = action ? action.ms : 3000;
    el.className = 'toast ' + (type || 'info');
    el.textContent = msg;
    if (action) {
      el.style.animationDelay = '0s, ' + (ms - 250) / 1000 + 's';
      var btn = document.createElement('button');
      btn.className = 'toast-action';
      btn.textContent = action.label;
      btn.addEventListener('click', function() {
        clearTimeout(timer);
        el.remove();
        action.onClick();
      });
      el.appendChild(btn);
    }
    document.getElementById('toastContainer').appendChild(el);
    var timer = setTimeout(function() {
      el.remove();
      if (action && action.onExpire) action.onExpire();
    }, ms);
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
        toast(T.scanning, 'info');
      }
      for (var j = 0; j < entries.length; j++) {
        var files = await getAllFilesFromEntry(entries[j]);
        allFiles = allFiles.concat(files);
      }
      allFiles.length > 0 ? addFiles(allFiles) : toast(T.noneFound, 'error');
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
    files.length > 0 ? addFiles(files) : toast(T.noneInFolder, 'error');
    folderInput.value = '';
  });

  // ===== FILE MANAGEMENT =====
  function addFiles(files) {
    if (!files.length) { toast(T.noneSupported, 'error'); return; }
    var remaining = 20 - state.files.length;
    if (remaining <= 0) { toast(T.max20, 'error'); return; }
    var toAdd = files.slice(0, remaining);
    if (files.length > remaining) toast(T.onlyAdded(remaining, files.length), 'info');
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
    runQueue();
  }

  function removeFile(id) {
    var idx = state.files.findIndex(function(f) { return f.id === id; });
    if (idx === -1) return;
    revokeFileUrls(state.files[idx]);
    state.files.splice(idx, 1);
    updateUI();
  }

  function revokeFileUrls(f) {
    if (f.originalUrl) URL.revokeObjectURL(f.originalUrl);
    if (f.compressedUrl) URL.revokeObjectURL(f.compressedUrl);
  }

  // Clearing a whole batch is easy to hit by accident, so it's undoable for a few seconds;
  // blob URLs stay alive until the undo window closes.
  function clearAll() {
    var cleared = state.files;
    if (!cleared.length) return;
    var genAtClear = settingsGen;
    state.files = [];
    updateUI();
    toast(T.cleared(cleared.length), 'info', {
      label: T.undo,
      ms: 6000,
      onClick: function() {
        var merged = cleared.concat(state.files);
        merged.slice(20).forEach(revokeFileUrls);
        state.files = merged.slice(0, 20);
        updateUI();
        // Settings changed while cleared: the restored results are stale
        settingsGen !== genAtClear ? recompressAll() : runQueue();
      },
      onExpire: function() { cleared.forEach(revokeFileUrls); }
    });
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

  // Draws the image at w×h (multi-step downscale when shrinking); JPEG gets a white background
  function renderCanvas(img, w, h, mime) {
    var canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (mime === 'image/jpeg') {
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, w, h);
    }
    var natural = w === img.naturalWidth && h === img.naturalHeight;
    ctx.drawImage(natural ? img : resizeCanvas(img, w, h), 0, 0);
    return canvas;
  }

  function usesUpng(mime) { return mime === 'image/png' && typeof UPNG !== 'undefined'; }

  // colors: 0 = lossless, otherwise palette size (UPNG quantization + dithering)
  function encodePng(canvas, colors) {
    var rgba = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data.buffer;
    return new Blob([UPNG.encode([rgba], canvas.width, canvas.height, colors)], { type: 'image/png' });
  }

  function encodeLossy(canvas, mime, q) {
    return new Promise(function(resolve, reject) {
      canvas.toBlob(function(b) { b ? resolve(b) : reject(new Error('encode failed')); }, mime, q);
    });
  }

  // Quality slider → PNG palette size: 90–95% lossless, 65–89% 256 colors, below that fewer
  function pngColorsFor(quality) {
    return quality >= 0.9 ? 0 : quality >= 0.65 ? 256 : Math.max(16, Math.round(256 * (quality / 0.65)));
  }

  // Normal mode: encode at the slider quality, with one cheaper retry if the result grew
  async function encodeAtQuality(canvas, mime, quality, originalSize) {
    if (usesUpng(mime)) {
      var colors = pngColorsFor(quality);
      var blob = encodePng(canvas, colors);
      if (colors > 0 && blob.size >= originalSize) {
        var fewer = encodePng(canvas, Math.max(16, Math.round(colors * 0.5)));
        if (fewer.size < blob.size) blob = fewer;
      }
      return blob;
    }
    var out = await encodeLossy(canvas, mime, quality);
    if (out.size >= originalSize) {
      var lower = await encodeLossy(canvas, mime, Math.max(0.1, quality - 0.15));
      if (lower.size < out.size) out = lower;
    }
    return out;
  }

  // Max-size mode: the slider quality is the ceiling. Find the best quality that fits; when even
  // the floor quality is too big, shrink the dimensions and try again.
  var LOSSY_FLOOR = 0.4;
  async function encodeToFit(img, w, h, mime, quality, target) {
    var best = null;
    for (var attempt = 0; attempt < 8; attempt++) {
      var canvas = renderCanvas(img, w, h, mime);
      var fit = null, smallest;
      if (usesUpng(mime)) {
        // Palette ladder from the slider's setting down to 32 colors
        var start = pngColorsFor(quality);
        var ladder = [start].concat([256, 128, 64, 32].filter(function(c) { return start === 0 || c < start; }));
        for (var i = 0; i < ladder.length && !fit; i++) {
          smallest = encodePng(canvas, ladder[i]);
          if (smallest.size <= target) fit = smallest;
        }
      } else {
        var top = await encodeLossy(canvas, mime, quality);
        if (top.size <= target) fit = top;
        else {
          smallest = await encodeLossy(canvas, mime, LOSSY_FLOOR);
          if (smallest.size <= target) {
            // Binary search the highest quality that still fits
            var lo = LOSSY_FLOOR, hi = quality;
            fit = smallest;
            for (var step = 0; step < 6; step++) {
              var mid = (lo + hi) / 2;
              var b = await encodeLossy(canvas, mime, mid);
              if (b.size <= target) { fit = b; lo = mid; } else hi = mid;
            }
          }
        }
      }
      if (fit) return { blob: fit, w: w, h: h, ok: true };
      if (!best || smallest.size < best.blob.size) best = { blob: smallest, w: w, h: h, ok: false };
      // Size scales roughly with pixel count, so shrink both sides by sqrt of the overshoot
      var scale = Math.sqrt(target / smallest.size) * 0.92;
      var nw = Math.max(16, Math.floor(w * scale)), nh = Math.max(16, Math.round(h * nw / w));
      if (nw === w) break;
      w = nw; h = nh;
    }
    return best;
  }

  async function compressImage(fileObj) {
    var gen = settingsGen;
    var quality = parseInt(document.getElementById('qualitySlider').value) / 100;
    var targetFormat = document.getElementById('formatSelect').value;
    var outputMime = targetFormat === 'original' ? fileObj.file.type : targetFormat;
    var target = (parseInt(document.getElementById('maxSizeSelect').value) || 0) * 1024;
    fileObj.status = 'compressing';
    updateFileItem(fileObj);
    try {
      var img = await loadImage(fileObj.originalUrl);
      var origW = img.naturalWidth, origH = img.naturalHeight;
      fileObj._origW = origW;
      fileObj._origH = origH;

      var w = origW, h = origH;
      if (resizeState.mode !== 'off') {
        resizeState.aspectRatio = origW / origH;
        var dims = calcResizeDims(origW, origH);
        w = dims.w;
        h = dims.h;
      }

      var blob, missed = false;
      if (target) {
        var r = await encodeToFit(img, w, h, outputMime, quality, target);
        blob = r.blob; w = r.w; h = r.h; missed = !r.ok;
      } else {
        blob = await encodeAtQuality(renderCanvas(img, w, h, outputMime), outputMime, quality, fileObj.originalSize);
      }
      var resized = w !== origW || h !== origH;

      // Never return a file bigger than the original when nothing else was asked for
      // (same format, same dimensions); with a max size the original also has to fit.
      if (!resized && targetFormat === 'original' && blob.size >= fileObj.originalSize &&
          (!target || fileObj.originalSize <= target)) {
        blob = fileObj.file;
        missed = false;
      }

      // Settings changed mid-compression: drop this result, the queue redoes the file
      if (gen !== settingsGen) { fileObj.status = 'pending'; updateFileItem(fileObj); return; }

      fileObj._outW = w;
      fileObj._outH = h;
      fileObj._target = target;
      fileObj._targetMissed = missed;
      fileObj.compressedBlob = blob;
      if (fileObj.compressedUrl) URL.revokeObjectURL(fileObj.compressedUrl);
      fileObj.compressedUrl = URL.createObjectURL(fileObj.compressedBlob);
      fileObj.compressedSize = fileObj.compressedBlob.size;
      fileObj.status = 'done';
    } catch(err) {
      if (gen !== settingsGen) { fileObj.status = 'pending'; updateFileItem(fileObj); return; }
      fileObj.status = 'error';
      toast(T.failed(fileObj.file.name), 'error');
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
      settingsGen++;  // also while the list is empty, so an undone Clear all knows it's stale
      if (!state.files.length) return;
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
    toast(T.buildingZip, 'info');
    try {
      var zipBlob = await buildZip(compressed);
      var a = document.createElement('a');
      a.href = URL.createObjectURL(zipBlob);
      a.download = 'tinysquish-compressed.zip';
      a.click();
      // Revoking synchronously can cancel the download in Safari/Firefox — give it time to start
      var zipUrl = a.href;
      setTimeout(function() { URL.revokeObjectURL(zipUrl); }, 60000);
      toast(T.zipDone, 'success');
    } catch(err) { toast(T.zipFailed, 'error'); }
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
    // Matches compressImage: PNG output is lossless from 90% up
    document.getElementById('qualityValue').textContent = e.target.value + '%' + (e.target.value >= 90 ? T.pngLossless : '');
  });
  document.getElementById('qualitySlider').addEventListener('change', function() { recompressAll(); });
  document.getElementById('formatSelect').addEventListener('change', function() { recompressAll(); });
  document.getElementById('maxSizeSelect').addEventListener('change', function() { recompressAll(); });

  // Landing-page presets (e.g. /png-to-webp/ picks WebP, /compress-image-to-100kb/ picks 100 KB)
  if (PRESET.format) document.getElementById('formatSelect').value = PRESET.format;
  if (PRESET.maxKb) document.getElementById('maxSizeSelect').value = PRESET.maxKb;

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
    this.innerHTML = icon(resizeState.aspectLocked ? 'lock' : 'unlock', 16);
    this.setAttribute('aria-pressed', String(resizeState.aspectLocked));
    this.title = resizeState.aspectLocked ? T.lock : T.unlock;
  });

  // ===== UI RENDERING =====
  function updateUI() {
    var optionsBar = document.getElementById('optionsBar');
    var fileList = document.getElementById('fileList');
    state.files.length > 0 ? optionsBar.classList.add('visible') : optionsBar.classList.remove('visible');
    document.getElementById('listHeader').classList.toggle('visible', state.files.length > 0);
    document.getElementById('listCount').textContent = T.images(state.files.length);
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
    if (fo.status === 'done') html += ' <span>\u2192</span> <span class="file-size-compressed">' + formatSize(fo.compressedSize) + '</span> <span class="file-savings ' + sc + '">' + (savings > 0 ? '\u2212' + savings : savings < 0 ? '+' + (-savings) : 0) + '%</span>';
    if (fo.status === 'done' && fo._targetMissed) html += '<span class="file-status error">' + T.targetMissed(formatSize(fo._target)) + '</span>';
    if (fo.status === 'compressing') html += '<span class="file-status compressing"><span class="spinner"></span> ' + T.compressing + '</span>';
    if (fo.status === 'error') html += '<span class="file-status error">' + T.error + '</span>';
    if (fo.status === 'pending') html += '<span class="file-status">' + T.waiting + '</span>';
    html += '</div></div><div class="file-actions">';
    if (fo.status === 'done') html += '<button class="file-btn compare-btn" data-id="' + fo.id + '" title="' + T.compare + '" aria-label="' + T.compareAria + '">' + icon('compare') + '</button><button class="file-btn download-btn" data-id="' + fo.id + '" title="' + T.download + '" aria-label="' + T.downloadAria + '">' + icon('download') + '</button>';
    html += '<button class="file-btn delete remove-btn" data-id="' + fo.id + '" title="' + T.remove + '" aria-label="' + T.removeAria + '">' + icon('close') + '</button></div>';
    if (fo.status === 'compressing') html += '<div class="file-progress indeterminate"></div>';
    if (fo.status === 'done') html += '<div class="file-progress" style="width:100%"></div>';
    el.innerHTML = html;

    // Event delegation
    el.querySelector('.remove-btn').addEventListener('click', function() { removeFile(fo.id); });
    if (fo.status === 'done') {
      el.querySelector('.compare-btn').addEventListener('click', function() { showComparison(fo.id); });
      el.querySelector('.download-btn').addEventListener('click', function() { downloadFile(fo); });
      el.querySelector('.file-thumb').addEventListener('click', function() { showComparison(fo.id); });
      el.querySelector('.file-thumb').style.cursor = 'pointer';
      el.querySelector('.file-thumb').title = T.clickCompare;
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
    document.getElementById('summaryCount').textContent = T.images(done.length);
    document.getElementById('summaryOriginal').textContent = formatSize(totOrig);
    document.getElementById('summaryCompressed').textContent = formatSize(totComp);
    document.getElementById('summarySaved').textContent = Math.abs(saved) + '%';
    document.getElementById('summarySavedLabel').textContent = saved < 0 ? T.larger : T.smaller;
  }

  function updateDownloadBtn() {
    // Wait for the whole batch so the ZIP never silently misses files still in the queue
    var btn = document.getElementById('downloadAllBtn');
    var busy = state.files.some(function(f) { return f.status === 'pending' || f.status === 'compressing'; });
    btn.disabled = busy || !state.files.some(function(f) { return f.status === 'done'; });
    btn.textContent = busy ? T.compressing : T.downloadAll;
  }

  // ===== VISITOR COUNTER =====
  // Only aggregate counts — images never leave the browser.
  // Count once per browser session; later loads just read the numbers.
  function loadVisitorCount() {
    var el = document.getElementById('visitorCount');
    var counted = false;
    try { counted = sessionStorage.getItem('ts_counted') === '1'; } catch(e) {}
    // Only the referring site's host name is sent (e.g. "www.google.com"), never the full URL
    var ref = '';
    try { ref = document.referrer ? new URL(document.referrer).hostname : ''; } catch(e) {}
    if (ref === location.hostname) ref = '';
    fetch('/api/visits', counted ? { cache: 'no-store' } : {
      method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ref: ref, page: location.pathname })
    })
      .then(function(r) { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(function(d) {
        try { sessionStorage.setItem('ts_counted', '1'); } catch(e) {}
        var fmt = function(n) { return Number(n).toLocaleString(LANG === 'id' ? 'id-ID' : 'en-US'); };
        el.textContent = T.visitors(fmt(d.total), fmt(d.today));
        el.hidden = false;
      })
      .catch(function() {}); // offline or API down: keep the counter hidden
  }
  loadVisitorCount();

  // Expose for thumbnail click in comparison
  window._tsShowComparison = showComparison;
  window._tsDownloadFile = downloadFile;
};
