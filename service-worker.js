// service-worker.js
// ACW Blue Glass SW v4.6.9
const CACHE_NAME = "acw-blueglass-v469";
const ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/config.js",
  "/manifest.json",
  // si tienes íconos, descomenta:
  // "/icons/icon-192.png",
  // "/icons/icon-512.png",
];

// Instala y precachea assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Activa y limpia caches viejos
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k === CACHE_NAME ? null : caches.delete(k))))
    )
  );
  self.clients.claim();
});

// Estrategia:
// - Estáticos (mismo origen): Cache First, luego red
// - Navegación (HTML): Stale-While-Revalidate básico
// - API de Google Script: no la cacheamos (siempre red)
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Nunca interceptar llamadas al backend (Apps Script)
  if (url.hostname.includes("script.google.com")) return;

  // Navegación (document)
  if (request.mode === "navigate") {
    event.respondWith(
      caches.match("/index.html").then((cached) => {
        const fetchPromise = fetch(request).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Estáticos del mismo origen: Cache First
  if (url.origin === self.location.origin && request.method === "GET") {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        });
      })
    );
  }
});
