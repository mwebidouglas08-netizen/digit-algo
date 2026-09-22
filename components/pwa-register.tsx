'use client';

import { useEffect } from 'react';

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    // Only register in production (or when SW exists) — no error in dev if missing
    const register = async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        // Prompt update when new SW found
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              // New version ready — optionally notify
              // auto-activate
              reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });
        // Reload when new SW takes over
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });
      } catch (e) {
        // SW registration failed — app still works online
        console.warn('[PWA] SW registration failed', e);
      }
    };
    // Delay to not block first paint
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);
  return null;
}
