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
    '<header class="header"><div class="logo">',
    '<h1><span class="logo-icon">\uD83D\uDC3C</span> TinySquish</h1>',
    '<p>Smart image compression \u2014 100% in your browser</p>',
    '</div></header>',
    '<main class="container">',
    '<div class="drop-zone" id="dropZone">',
    '<span class="drop-zone-icon">\uD83D\uDCC1</span>',
    '<h2>Drop your images here</h2>',
    '<p>or click to browse files</p>',
    '<div class="browse-buttons">',
    '<button class="browse-btn" id="btnChooseFiles">Choose Files</button>',
    '<button class="browse-btn browse-btn-folder" id="btnChooseFolder">\uD83D\uDCC2 Choose Folder</button>',
    '</div>',
    '<p class="formats-hint">Supports PNG, JPEG, WebP \u2014 Drop files or entire folders \u2014 Up to 20 images</p>',
    '<input type="file" id="fileInput" accept="image/png,image/jpeg,image/webp" multiple>',
    '<input type="file" id="folderInput" webkitdirectory multiple>',
    '</div>',
    '<div class="options-bar" id="optionsBar">',
    '<div class="option-group">',
    '<label>Quality:</label>',
    '<input type="range" class="quality-slider" id="qualitySlider" min="10" max="95" value="75">',
    '<span class="quality-value" id="qualityValue">75%</span>',
    '</div>',
    '<div class="option-group">',
    '<label>Convert to:</label>',
    '<select class="format-select" id="formatSelect">',
    '<option value="original">Keep Original</option>',
    '<option value="image/jpeg">JPEG</option>',
    '<option value="image/png">PNG</option>',
    '<option value="image/webp">WebP</option>',
    '</select>',
    '</div>',
    '<div class="action-buttons">',
    '<button class="btn btn-primary" id="compressAllBtn">\uD83D\uDDDC\uFE0F Compress All</button>',
    '<button class="btn btn-success" id="downloadAllBtn" disabled>\uD83D\uDCE6 Download ZIP</button>',
    '<button class="btn btn-danger" id="clearAllBtn">\u2715 Clear</button>',
    '</div>',
    '</div>',
    '<div class="file-list" id="fileList"></div>',
    '<div class="summary-bar" id="summaryBar">',
    '<div class="summary-stat"><div class="value" id="summaryCount">0</div><div class="label">Images</div></div>',
    '<div class="summary-divider"></div>',
    '<div class="summary-stat"><div class="value" id="summaryOriginal">0 KB</div><div class="label">Original</div></div>',
    '<div class="summary-divider"></div>',
    '<div class="summary-stat"><div class="value" id="summaryCompressed">0 KB</div><div class="label">Compressed</div></div>',
    '<div class="summary-divider"></div>',
    '<div class="summary-stat"><div class="value" id="summarySaved">0%</div><div class="label">Saved</div></div>',
    '</div>',
    '</main>',
    '<div class="modal-overlay" id="comparisonModal">',
    '<div class="modal">',
    '<div class="modal-header">',
    '<h3 id="modalTitle">Before / After Comparison</h3>',
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
    '<footer class="footer"><p>TinySquish \u2014 All processing happens locally in your browser. No data is uploaded.</p></footer>',
    '<div class="devtools-warning" id="devtoolsWarning">',
    '<div style="font-size:3rem">\uD83D\uDEE1\uFE0F</div>',
    '<h2>Developer Tools Detected</h2>',
    '<p>Please close Developer Tools to continue using TinySquish.</p>',
    '</div>',
    '<div class="watermark">TINYSQUISH \u00B7 PROTECTED</div>'
  ].join('');

  // ===== STATE =====
  var state = { files: [], nextId: 0 };

  // ===== UTILITY =====
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(2) + ' MB';
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
    if (e.target.tagName !== 'BUTTON') fileInput.click();
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
    updateUI();
    toast('Added ' + toAdd.length + ' image' + (toAdd.length > 1 ? 's' : ''), 'success');
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

  // ===== COMPRESSION ENGINE =====
  function loadImage(src) {
    return new Promise(function(resolve, reject) {
      var img = new Image();
      img.onload = function() { resolve(img); };
      img.onerror = reject;
      img.src = src;
    });
  }

  function quantize(imageData, quality) {
    var data = imageData.data;
    var shift = quality >= 0.5 ? 1 : quality >= 0.25 ? 2 : quality >= 0.125 ? 3 : 4;
    var w = imageData.width, h = imageData.height;
    for (var y = 0; y < h; y++) {
      for (var x = 0; x < w; x++) {
        var i = (y * w + x) * 4;
        if (data[i + 3] === 0) continue;
        for (var c = 0; c < 3; c++) {
          var oldVal = data[i + c];
          var newVal = (oldVal >> shift) << shift;
          data[i + c] = newVal;
          var error = oldVal - newVal;
          if (x + 1 < w) data[i + 4 + c] = Math.min(255, Math.max(0, data[i + 4 + c] + error * 7 / 16));
          if (y + 1 < h) {
            if (x > 0) data[((y+1)*w+x-1)*4+c] = Math.min(255, Math.max(0, data[((y+1)*w+x-1)*4+c] + error * 3 / 16));
            data[((y+1)*w+x)*4+c] = Math.min(255, Math.max(0, data[((y+1)*w+x)*4+c] + error * 5 / 16));
            if (x + 1 < w) data[((y+1)*w+x+1)*4+c] = Math.min(255, Math.max(0, data[((y+1)*w+x+1)*4+c] + error / 16));
          }
        }
      }
    }
  }

  async function compressImage(fileObj) {
    var quality = parseInt(document.getElementById('qualitySlider').value) / 100;
    var targetFormat = document.getElementById('formatSelect').value;
    var outputMime = targetFormat === 'original' ? fileObj.file.type : targetFormat;
    fileObj.status = 'compressing';
    updateFileItem(fileObj);
    try {
      var img = await loadImage(fileObj.originalUrl);
      var canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      var ctx = canvas.getContext('2d');
      if (outputMime === 'image/png') { ctx.clearRect(0, 0, canvas.width, canvas.height); }
      else { ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, canvas.width, canvas.height); }
      ctx.drawImage(img, 0, 0);
      if (outputMime === 'image/png') {
        var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        quantize(imageData, quality);
        ctx.putImageData(imageData, 0, 0);
      }
      var blob = await new Promise(function(resolve, reject) {
        canvas.toBlob(function(b) { b ? resolve(b) : reject(new Error('fail')); }, outputMime, outputMime === 'image/png' ? undefined : quality);
      });
      if (blob.size >= fileObj.originalSize && targetFormat === 'original') {
        var blob2 = await new Promise(function(r) {
          canvas.toBlob(function(b) { r(b); }, outputMime, Math.max(0.1, quality - 0.15));
        });
        fileObj.compressedBlob = (blob2 && blob2.size < fileObj.originalSize) ? blob2 : blob;
      } else {
        fileObj.compressedBlob = blob;
      }
      if (fileObj.compressedUrl) URL.revokeObjectURL(fileObj.compressedUrl);
      fileObj.compressedUrl = URL.createObjectURL(fileObj.compressedBlob);
      fileObj.compressedSize = fileObj.compressedBlob.size;
      fileObj.status = 'done';
    } catch(err) {
      fileObj.status = 'error';
      toast('Failed to compress ' + fileObj.file.name, 'error');
    }
    updateFileItem(fileObj);
  }

  // ===== COMPRESS ALL =====
  document.getElementById('compressAllBtn').addEventListener('click', async function() {
    var pending = state.files.filter(function(f) { return f.status === 'pending' || f.status === 'error'; });
    if (!pending.length) { toast('No files to compress', 'info'); return; }
    this.disabled = true;
    for (var i = 0; i < pending.length; i++) await compressImage(pending[i]);
    this.disabled = false;
    updateSummary();
    updateDownloadBtn();
    toast('All images compressed!', 'success');
  });

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

  async function buildZip(files) {
    var localFiles = [], centralDir = [], offset = 0;
    for (var n = 0; n < files.length; n++) {
      var fo = files[n];
      var name = fo.file.name.replace(/\.[^.]+$/, '') + '-compressed.' + getExt(fo.compressedBlob.type);
      var nameBytes = new TextEncoder().encode(name);
      var fileData = new Uint8Array(await fo.compressedBlob.arrayBuffer());
      var crc = crc32(fileData);

      var lh = new Uint8Array(30 + nameBytes.length);
      var lv = new DataView(lh.buffer);
      lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true);
      lv.setUint32(14, crc, true); lv.setUint32(18, fileData.length, true);
      lv.setUint32(22, fileData.length, true); lv.setUint16(26, nameBytes.length, true);
      lh.set(nameBytes, 30);

      var cd = new Uint8Array(46 + nameBytes.length);
      var cv = new DataView(cd.buffer);
      cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true);
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
      URL.revokeObjectURL(a.href);
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
    document.getElementById('comparisonOriginal').style.width = pct + '%';
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

  // ===== UI RENDERING =====
  function updateUI() {
    var optionsBar = document.getElementById('optionsBar');
    var fileList = document.getElementById('fileList');
    state.files.length > 0 ? optionsBar.classList.add('visible') : optionsBar.classList.remove('visible');
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
    var html = '<img class="file-thumb" src="' + fo.originalUrl + '" alt="' + fo.file.name + '">';
    html += '<div class="file-info"><div class="file-name">' + fo.file.name + '</div><div class="file-meta">';
    html += '<span class="file-size-original">' + formatSize(fo.originalSize) + '</span>';
    if (fo.status === 'done') html += ' <span>\u2192</span> <span class="file-size-compressed">' + formatSize(fo.compressedSize) + '</span> <span class="file-savings ' + sc + '">-' + savings + '%</span>';
    if (fo.status === 'compressing') html += '<span class="file-status compressing"><span class="spinner"></span> Compressing...</span>';
    if (fo.status === 'error') html += '<span class="file-status error">Error</span>';
    if (fo.status === 'pending') html += '<span class="file-status">Ready</span>';
    html += '</div></div><div class="file-actions">';
    if (fo.status === 'done') html += '<button class="file-btn compare-btn" data-id="' + fo.id + '" title="Compare">\uD83D\uDD0D</button><button class="file-btn download-btn" data-id="' + fo.id + '" title="Download">\u2B07\uFE0F</button>';
    html += '<button class="file-btn delete remove-btn" data-id="' + fo.id + '" title="Remove">\u2715</button></div>';
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
    document.getElementById('summaryCount').textContent = done.length;
    document.getElementById('summaryOriginal').textContent = formatSize(totOrig);
    document.getElementById('summaryCompressed').textContent = formatSize(totComp);
    document.getElementById('summarySaved').textContent = (totOrig > 0 ? Math.round((1 - totComp / totOrig) * 100) : 0) + '%';
  }

  function updateDownloadBtn() {
    document.getElementById('downloadAllBtn').disabled = !state.files.some(function(f) { return f.status === 'done'; });
  }

  // Expose for thumbnail click in comparison
  window._tsShowComparison = showComparison;
  window._tsDownloadFile = downloadFile;
};
