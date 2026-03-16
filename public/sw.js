// Lumina LMS — Workbox-style Service Worker
// Strategy:
//   Navigation requests  → NetworkFirst (try network, fallback to cache, then /offline)
//   Static assets        → CacheFirst  (_next/static, images)
//   Heartbeat API        → NetworkOnly (never cache)
//   Everything else      → StaleWhileRevalidate

const CACHE_NAME = 'lumina-v3';
const STATIC_CACHE = 'lumina-static-v3';

// Pages to pre-cache on install (the app shell + offline-accessible routes)
const PRE_CACHE_URLS = [
  '/',
  '/offline',
  '/offline-access',
  '/offline-landing',
  '/protected/catalog',
  '/protected/my-card',
  '/protected/my-borrowing-history',
];

// ─── Install ────────────────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // addAll will fail silently per-url; use individual add to avoid crashing
      return Promise.allSettled(
        PRE_CACHE_URLS.map((url) => cache.add(url).catch(() => null))
      );
    })
  );
  self.skipWaiting();
});

// ─── Activate ───────────────────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME && k !== STATIC_CACHE)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch ───────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Never intercept chrome-extension or non-http(s) requests
  if (!url.protocol.startsWith('http')) return;

  // 2. Never cache the heartbeat endpoint — always go to network
  if (url.pathname === '/api/heartbeat') {
    return; // fall through to browser default (network only)
  }

  // 3. CacheFirst for Next.js static assets & images (long-lived, hash-named)
  if (
    url.pathname.startsWith('/_next/static') ||
    url.pathname.startsWith('/_next/image') ||
    url.pathname.match(/\.(ico|png|jpg|jpeg|svg|woff2?|ttf)$/)
  ) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
    return;
  }

  // 4. NetworkFirst for navigation (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(request);
          // Update the cache with the fresh response
          const cache = await caches.open(CACHE_NAME);
          cache.put(request, networkResponse.clone());
          return networkResponse;
        } catch {
          // Network failed — try cache
          const cached = await caches.match(request);
          if (cached) return cached;
          // Last resort: serve /offline fallback
          const offlineFallback = await caches.match('/offline');
          return offlineFallback || new Response('Offline', { status: 503 });
        }
      })()
    );
    return;
  }

  // 5. StaleWhileRevalidate for API routes that can show stale data
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_NAME);
        const cached = await cache.match(request);
        const networkFetch = fetch(request).then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        }).catch(() => null);
        return cached || (await networkFetch) || new Response(JSON.stringify({ error: 'offline' }), {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        });
      })()
    );
    return;
  }
});
