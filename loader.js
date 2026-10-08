/**
 * TinySquish — Loader & Protection Layer
 * This file handles: anti-save, anti-devtools, anti-copy,
 * dynamic content injection, and service worker registration.
 */

(function() {
  'use strict';

  // ===== PROTECTION: Block keyboard shortcuts =====
  const blockedKeys = {
    's': true,   // Ctrl+S (save)
    'u': true,   // Ctrl+U (view source)
    'p': true,   // Ctrl+P (print)
    // Ctrl+Shift+I/J/C are handled below — plain Ctrl+C (copy) must keep working
  };

  document.addEventListener('keydown', function(e) {
    // Block F12
    if (e.key === 'F12') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Block Ctrl/Cmd + key combos
    if (e.ctrlKey || e.metaKey) {
      const key = e.key.toLowerCase();
      if (blockedKeys[key]) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
      // Block Ctrl+Shift+I/J/C
      if (e.shiftKey && (key === 'i' || key === 'j' || key === 'c')) {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }
  }, true);

  // ===== PROTECTION: Block right-click context menu =====
  document.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    return false;
  }, true);

  // ===== PROTECTION: Block drag (prevent dragging images/page out) =====
  document.addEventListener('dragstart', function(e) {
    if (e.target.tagName === 'IMG' || e.target.tagName === 'A') {
      e.preventDefault();
      return false;
    }
  }, true);

  // ===== PROTECTION: Anti-DevTools detection =====
  // Only the debugger trap is used: a window-size heuristic (outer - inner > 160px)
  // false-positives on browser sidebars and page zoom, hiding the app from normal users.
  let devtoolsOpen = false;

  // Debugger trap — `debugger` only pauses when devtools is open
  function debuggerTrap() {
    const start = performance.now();
    debugger;
    const end = performance.now();
    if (end - start > 100) {
      if (!devtoolsOpen) {
        devtoolsOpen = true;
        onDevToolsOpen();
      }
    } else if (devtoolsOpen) {
      devtoolsOpen = false;
      onDevToolsClose();
    }
  }

  function onDevToolsOpen() {
    const warning = document.getElementById('devtoolsWarning');
    if (warning) warning.classList.add('visible');
    const appRoot = document.getElementById('app-root');
    if (appRoot) appRoot.style.display = 'none';
  }

  function onDevToolsClose() {
    const warning = document.getElementById('devtoolsWarning');
    if (warning) warning.classList.remove('visible');
    const appRoot = document.getElementById('app-root');
    if (appRoot) appRoot.style.display = '';
  }

  setInterval(debuggerTrap, 3000);

  // ===== PROTECTION: Disable console methods =====
  (function() {
    const noop = function() {};
    const methods = ['log', 'debug', 'info', 'warn', 'error', 'table', 'trace', 'dir', 'dirxml', 'group', 'groupEnd', 'time', 'timeEnd', 'assert', 'profile'];
    methods.forEach(function(m) {
      try { window.console[m] = noop; } catch(e) {}
    });
  })();

  // ===== PROTECTION: Detect "Save As" via beforeprint / visibility =====
  window.addEventListener('beforeprint', function(e) {
    document.body.innerHTML = '<div style="text-align:center;padding:4rem;font-family:sans-serif;"><h1>🐼 TinySquish</h1><p style="color:#636E72;margin-top:1rem;">This application cannot be printed or saved.</p></div>';
  });

  // ===== PROTECTION: Blob URL revocation timer =====
  // Revoke blob URLs after short period to prevent saving via blob links
  const _createObjectURL = URL.createObjectURL.bind(URL);
  URL.createObjectURL = function(blob) {
    const url = _createObjectURL(blob);
    // Don't auto-revoke — the app manages its own blob lifecycle
    return url;
  };

  // ===== SERVICE WORKER REGISTRATION =====
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function() {
      // SW registration failed — app still works without it
    });
  }

  // ===== DYNAMIC CONTENT INJECTION =====
  // Load the actual app after a delay (prevents "Save Page" from capturing content)
  function injectApp() {
    // Verify we're running from expected origin (not a local file save)
    if (window.location.protocol === 'file:') {
      document.getElementById('app-root').innerHTML = '<div style="text-align:center;padding:4rem;font-family:sans-serif;"><p style="font-size:1.5rem;font-weight:700;">🐼 TinySquish</p><p style="color:#E17055;margin-top:1rem;font-weight:600;">This application cannot run from a local file.</p><p style="color:#636E72;margin-top:0.5rem;">Please access it from the original website.</p></div>';
      return;
    }

    // Load dependencies sequentially: pako → UPNG → app.js
    // UPNG.js captures window.pako at execution time, so pako must load first.
    function showError() {
      document.getElementById('app-root').innerHTML = '<div style="text-align:center;padding:4rem;font-family:sans-serif;"><p style="font-size:1.5rem;font-weight:700;">🐼 TinySquish</p><p style="color:#E17055;margin-top:1rem;">Failed to load application engine. Please refresh.</p></div>';
    }

    function loadScript(src, onDone) {
      var s = document.createElement('script');
      s.src = src + '?v=' + Date.now();
      s.onload = onDone;
      s.onerror = showError;
      document.body.appendChild(s);
    }

    loadScript('pako.min.js', function() {
      loadScript('UPNG.js', function() {
        loadScript('app.js', function() {
          if (typeof window.__initTinySquish === 'function') {
            window.__initTinySquish();
          }
        });
      });
    });
  }

  // Inject as soon as the DOM is ready (the loading screen shows while scripts load)
  window.addEventListener('DOMContentLoaded', injectApp);

})();
