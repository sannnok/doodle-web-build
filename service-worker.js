// ProtoBuild.WebGL() rewrites this line with a per-build stamp after the build finishes —
// a new name every deploy is what makes "activate" below drop the previous build's cache.
const CACHE_NAME = "doodle-cache-20260924075857";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

// Cache-first for same-origin static assets, network-first for HTML,
// and NEVER cache cross-origin requests (Unity Services: Lobby, Relay, Auth, Analytics).
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // 1. Cross-origin requests (Unity Lobby, Relay, Auth REST APIs) must never be cached —
  //    a cached one hands back stale session state.
  if (url.origin !== self.location.origin) return;

  // 2. Navigation / HTML requests use network-first with cache fallback. Keyed without the
  //    query string, so every ?code=XXXX join link shares one entry instead of piling up.
  if (event.request.mode === "navigate" || url.pathname.endsWith("/index.html") || url.pathname.endsWith("/")) {
    const key = url.origin + url.pathname;
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(key, copy));
        }
        return response;
      }).catch(() => caches.match(key).then((cached) => cached || Response.error()))
    );
    return;
  }

  // 3. Same-origin static assets (wasm, data, js, textures) use cache-first
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;

      return fetch(event.request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
