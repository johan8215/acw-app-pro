/* ============================================================
   ⚙️ ACW-App SW v5.6.2 — Safe Cache (No API Interference)
   ============================================================ */

const CACHE_NAME = "acw-blue-glass-v562";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./config.js",
  "./manifest.json",
  "./acw-icon-512.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // 🔒 No interceptar el backend
  if (url.host.includes("script.google.com")) return;

  if (e.request.method === "GET" && url.origin === self.location.origin) {
    e.respondWith(
      caches.match(e.request).then((cached) => {
        const fetchPromise = fetch(e.request)
          .then((networkResp) => {
            caches.open(CACHE_NAME)
              .then((cache) => cache.put(e.request, networkResp.clone()))
              .catch(()=>{});
            return networkResp;
          })
          .catch(() => cached);
        return cached || fetchPromise;
      })
    );
  }
});
