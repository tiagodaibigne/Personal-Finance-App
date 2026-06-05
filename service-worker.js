// service-worker.js
const CACHE_NAME = 'finance-pwa-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/src/styles/main.css',
  '/src/app.js',
  '/src/sheets/sheets.js',
  '/src/utils/auth.js',
  '/src/utils/fx.js',
  '/src/utils/state.js',
  '/src/components/dashboard.js',
  '/src/components/records.js',
  '/src/components/statistics.js',
  '/src/components/planning.js',
  '/src/components/more.js',
  '/src/components/transaction-modal.js',
  '/src/components/account-modal.js',
  '/src/components/toast.js',
];

// Install: cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: cache-first for static, network-first for API calls
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip Google API calls — always network
  if (url.hostname.includes('googleapis.com') ||
      url.hostname.includes('accounts.google.com') ||
      url.hostname.includes('frankfurter.app')) {
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (response.ok && request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
