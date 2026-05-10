// Service worker placeholder to prevent 404 errors in local development
// This file can be used to implement offline capabilities in the future.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Optional: Unregister itself if not needed
  // self.registration.unregister();
});
