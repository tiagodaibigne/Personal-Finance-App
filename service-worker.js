// Personal Budgeting App — service worker
// Enables the app to LAUNCH offline by serving a cached copy of the page when
// there is no connection. Uses network-first for the app page so that new
// deployments still appear when you are online (avoids stale-cache problems),
// and cache-first for fonts (which rarely change).

// Bump this version string on each deploy to retire old caches cleanly.
var CACHE = 'pba-cache-v99';

// The core file(s) that make up the app shell.
var APP_SHELL = [
  './',
  './index.html'
];

// On install: pre-cache the app shell so the very first offline launch works.
self.addEventListener('install', function (e) {
  self.skipWaiting(); // activate the new worker immediately
  e.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return cache.addAll(APP_SHELL).catch(function () { /* ignore individual failures */ });
    })
  );
});

// On activate: delete any old version caches.
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  var url = new URL(req.url);

  // Only handle GET requests.
  if (req.method !== 'GET') return;

  // Never intercept Google API / auth / sheets calls — these need the live
  // network and must not be served from cache. Let the browser handle them.
  if (/googleapis\.com|accounts\.google\.com|apis\.google\.com|sheets\.googleapis/.test(url.href)) {
    return; // default network handling
  }

  // Google Fonts: cache-first (fonts are static; this makes the app look right offline).
  if (/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(url.href)) {
    e.respondWith(
      caches.match(req).then(function (cached) {
        if (cached) return cached;
        return fetch(req).then(function (res) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
          return res;
        }).catch(function () { return cached; });
      })
    );
    return;
  }

  // App page and same-origin assets: NETWORK-FIRST.
  // Try the live network (so new deploys show up); if offline, serve the cached copy.
  var isPage = req.mode === 'navigate' || url.origin === self.location.origin;
  if (isPage) {
    e.respondWith(
      fetch(req).then(function (res) {
        // Update the cache with the freshest copy.
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
        return res;
      }).catch(function () {
        // Offline: serve cached page, falling back to the cached index.
        return caches.match(req).then(function (cached) {
          return cached || caches.match('./index.html') || caches.match('./');
        });
      })
    );
    return;
  }
});
