// Lumina LMS Minimal Service Worker
// Satisfies PWA manifest requirements and prevents 404 errors in logs.

const CACHE_NAME = 'lumina-v1';
console.log('SW loaded:', CACHE_NAME);

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass-through strategy - current implementation is just for log hygiene.
  event.respondWith(fetch(event.request));
});
