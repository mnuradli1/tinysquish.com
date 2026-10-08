/**
 * TinySquish — Service Worker
 * Purpose: Intercept requests to prevent easy offline saving & add cache control
 */

const CACHE_NAME = 'tinysquish-v8';
const ORIGIN_CHECK = true;

// Install — cache core assets
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll([
        './',
        './index.html',
        './style.css',
        './loader.js',
        './pako.min.js',
        './UPNG.js',
        './app.js',
        './fonts/dm-sans.woff2'
      ]);
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(name) { return name !== CACHE_NAME; })
             .map(function(name) { return caches.delete(name); })
      );
    })
  );
  self.clients.claim();
});

// Fetch — serve from network first, fallback to cache
// Also add headers to prevent easy saving
self.addEventListener('fetch', function(event) {
  const url = new URL(event.request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Never intercept the API (POST can't be cached; counts must be live)
  if (event.request.method !== 'GET' || url.pathname.startsWith('/api/')) return;

  // loader.js appends ?v=<timestamp> to scripts; key the cache by path only,
  // otherwise every visit adds new entries and offline lookups never hit.
  const cacheKey = url.origin + url.pathname;

  event.respondWith(
    fetch(event.request).then(function(response) {
      // Clone response and add protective headers
      const headers = new Headers(response.headers);
      headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      headers.set('Pragma', 'no-cache');
      headers.set('X-Content-Type-Options', 'nosniff');

      // For JS files, set short cache
      if (url.pathname.endsWith('.js')) {
        headers.set('Cache-Control', 'max-age=60');
      }

      const modifiedResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: headers
      });

      // Update cache (only good responses — don't overwrite with a 404/500)
      if (response.ok) {
        const responseClone = modifiedResponse.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(cacheKey, responseClone);
        });
      }

      return modifiedResponse;
    }).catch(function() {
      // Offline fallback from cache
      return caches.match(cacheKey).then(function(cached) {
        if (cached) return cached;
        // Return error page for navigation
        if (event.request.mode === 'navigate') {
          return new Response(
            '<html><body style="text-align:center;padding:4rem;font-family:sans-serif;"><h1>Offline</h1><p>Please check your connection.</p></body></html>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        }
      });
    })
  );
});
