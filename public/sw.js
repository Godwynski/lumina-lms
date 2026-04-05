// Lumina LMS Minimal Service Worker
// Satisfies PWA manifest requirements and prevents 404 errors in logs.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Pass-through strategy — no offline caching.
// All network requests are forwarded directly to the server.
self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
