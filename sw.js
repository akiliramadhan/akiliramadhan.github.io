// AKILI WAKALA CONNECT — Service Worker (Offline Support)
const CACHE_NAME = 'akili-wakala-connect-v1';
const APP_SHELL = [
  './',
  './index.html'
];

// Install: cache the app shell
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(APP_SHELL).catch(() => {
        // If exact filenames differ, still proceed without failing install
        return Promise.resolve();
      });
    })
  );
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => {
      return Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first for navigation (HTML), falling back to cache when offline.
// Cache-first for other same-origin static assets.
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only handle GET requests
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Only manage same-origin requests; let cross-origin (Firebase, CDNs) pass straight through to network
  if (url.origin !== self.location.origin) {
    return;
  }

  // For page navigations (loading the app itself), try network first so users always get
  // the latest version when online, but fall back to the cached copy when offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const resClone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('./')))
    );
    return;
  }

  // For other same-origin GET requests, try cache first, then network, and cache the result.
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const resClone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
          }
          return res;
        })
        .catch(() => cached);
    })
  );
});
