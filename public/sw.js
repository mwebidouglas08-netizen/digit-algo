// Minimal PWA service worker for Deriv Digits — installable + offline shell
// Cache version bump to invalidate old caches on deploy
const CACHE_VERSION = 'v1-2026-09-22';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

// Precache the app shell (add more if needed)
const PRECACHE_URLS = [
  '/',
  '/icon-192.png',
  '/icon-512.png',
  '/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first for navigation/API, cache-first for static assets
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET and chrome extensions, and Deriv websocket is not fetch
  if (req.method !== 'GET') return;
  if (url.protocol === 'chrome-extension:') return;
  // Deriv API over fetch - never cache, always network
  if (url.hostname.includes('deriv.')) return;
  if (url.pathname.startsWith('/api/')) return;

  // Navigation requests: network first, fallback to cache
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || caches.match('/')))
    );
    return;
  }

  // Static assets: cache first
  if (req.destination === 'script' || req.destination === 'style' || req.destination === 'image' || req.destination === 'font') {
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req).then((res) => {
          // only cache successful responses
          if (res.ok) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        });
      })
    );
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
