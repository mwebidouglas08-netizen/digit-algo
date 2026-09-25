// Minimal PWA SW — network-only, never serve stale JS that caused React #300
// v8 forces cache bust for all old chunks (139hffbk3uawu.js etc.)
const CACHE_VERSION = 'v8-2026-09-23';
const STATIC_CACHE = `static-${CACHE_VERSION}`;

self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

// No fetch handler — let browser handle all fetches natively (fixes PWA 404 from stale cache)
// Keeping SW minimal ensures installability without serving stale 139hffbk3uawu.js that had hook bug

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
