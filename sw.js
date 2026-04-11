/**
 * TinySquish — Service Worker
 * Purpose: Intercept requests to prevent easy offline saving & add cache control
 */

const CACHE_NAME = 'tinysquish-v1';
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
        './app.js'
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

      // Update cache
      const responseClone = modifiedResponse.clone();
      caches.open(CACHE_NAME).then(function(cache) {
        cache.put(event.request, responseClone);
      });

      return modifiedResponse;
    }).catch(function() {
      // Offline fallback from cache
      return caches.match(event.request).then(function(cached) {
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
