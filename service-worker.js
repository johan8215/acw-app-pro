/* ============================================================
   ⚙️ ACW-App — Blue Glass White Edition
   Fixed Service Worker (prevents FetchEvent.respondWith error)
   ============================================================ */

const CACHE_NAME = "acw-blue-glass-v6";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./config.js",
  "./manifest.json",
  "./acw-icon-512.png"
];

// Instalar y guardar archivos base en caché
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

// Manejo de peticiones
self.addEventListener("fetch", (event) => {
  const url = event.request.url;

  // ⚠️ No interceptar llamadas externas (Google Script, APIs, etc.)
  if (!url.startsWith(self.location.origin)) {
    return; // las deja pasar directo a la red
  }

  event.respondWith(
    caches.match(event.request).then((response) => {
      return (
        response ||
        fetch(event.request).catch(() =>
          new Response("Offline or not found", { status: 503 })
        )
      );
    })
  );
});

// Actualizar versión de caché
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
});
