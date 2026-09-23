// Minimal PWA service worker for Deriv Digits — installable + offline shell
// Cache version bump to invalidate old caches — v5 fixes PWA "page couldn't load" (no '/' precache, no 404 fallback)
const CACHE_VERSION = 'v5-2026-09-23';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

// Precache only icons — never precache '/' (avoids caching a 404 shell)
const PRECACHE_URLS = [
  '/icon-192.png',
  '/icon-512.png',
  '/icon-192-maskable.png',
  '/icon-512-maskable.png',
  '/icon.svg',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) =>
        Promise.allSettled(PRECACHE_URLS.map((u) => cache.add(u).catch(() => null)))
      )
      .then(() => self.skipWaiting())
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

  // Navigation requests: network first, fallback to cache (never fallback to '/' which may be 404)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          // Only cache successful HTML navigations
          if (res.ok) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((cached) => cached || new Response('<h1>Offline</h1><p>Connect to internet to load Daggy.</p>', { headers: { 'Content-Type': 'text/html' } })))
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
