/* ============================================================
   ⚙️ SERVICE WORKER — ACW-App Blue Glass White Edition
   Silent cache, no popup
   ============================================================ */

const CACHE_NAME = "acw-blue-glass-v472";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./config.js",
  "./manifest.json",
  "./acw-icon-512.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log("📦 Caching assets");
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  console.log("♻️ Old cache cleared");
});
