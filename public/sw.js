// Minimal PWA SW — network-first for everything, never serve stale 404
// v7 fixes "App failed to load" React #300 by ensuring fresh JS on every PWA open
const CACHE_VERSION = 'v7-2026-09-23';
const STATIC_CACHE = `static-${CACHE_VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      Promise.allSettled([
        cache.add('/icon-192.png').catch(() => null),
        cache.add('/icon-512.png').catch(() => null),
        cache.add('/icon.svg').catch(() => null),
      ])
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Network-first for ALL — ensures PWA never serves stale JS that caused React #300
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.protocol === 'chrome-extension:' || url.hostname.includes('deriv.')) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(STATIC_CACHE).then((c) => c.put(req, copy)).catch(() => null);
        }
        return res;
      })
      .catch(() => caches.match(req).then((c) => c || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })))
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
