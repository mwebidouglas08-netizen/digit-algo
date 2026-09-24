// Minimal PWA SW — does NOT intercept navigations, just enables installability
// v6 fixes "This page couldn't load" in Edge PWA (no fetch handler for navigate)
const CACHE_VERSION = 'v6-2026-09-23';
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

// No fetch handler — let browser handle all fetches natively (prevents PWA offline 404)
// This ensures https://digit-algo.vercel.app/ always loads from network in PWA window
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
