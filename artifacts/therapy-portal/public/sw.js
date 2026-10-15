const CACHE_PREFIX = 'aws-static-shell-';
const CACHE_NAME = CACHE_PREFIX + 'v2';
const SCOPE_ROOT = new URL(self.registration.scope);
const STATIC_ASSET = /\.(?:js|css|woff2?|ttf|otf|png|jpe?g|webp|avif|svg|ico)$/i;

self.addEventListener('install', (event) => {
  // The offline shell contains only static application assets, never client data.
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys
        .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
        .map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API responses, JSON, HTML documents, or any authenticated/client data.
  if (url.pathname.includes('/api/') || request.headers.has('authorization')) return;

  const isStaticAsset = STATIC_ASSET.test(url.pathname);
  const isNavigation = request.mode === 'navigate';
  if (!isStaticAsset && !isNavigation) return;

  if (isNavigation) {
    // Network-first for the public SPA shell. If offline, return a cached generic
    // shell only; every API request remains uncached and will fail safely offline.
    event.respondWith(
      fetch(request).then((response) => {
        const type = response.headers.get('content-type') || '';
        if (response.ok && type.includes('text/html')) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(new Request(SCOPE_ROOT.href), copy)).catch(() => undefined);
        }
        return response;
      }).catch(async () => {
        const cached = await caches.match(new Request(SCOPE_ROOT.href));
        return cached || new Response('AWS is offline. Reconnect to access your secure client portal.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
        });
      }),
    );
    return;
  }

  // Cache-first for hash-named static bundles and public artwork only.
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) {
        event.waitUntil(fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') return cache.put(request, response.clone());
        }).catch(() => undefined));
        return cached;
      }
      const response = await fetch(request);
      const contentType = response.headers.get('content-type') || '';
      if (response.ok && response.type === 'basic' && !contentType.includes('application/json')) {
        await cache.put(request, response.clone()).catch(() => undefined);
      }
      return response;
    }),
  );
});
