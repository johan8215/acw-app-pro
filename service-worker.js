/* ============================================================
   🧠 ACW-App v4.7 — Blue Glass Hybrid Edition
   Johan A. Giraldo (JAG15) & Sky | Allston Car Wash © 2025
   ============================================================ */

/* ------------------------------------------------------------
   🧩 Force Update on Every Activation (iOS 26 friendly)
   ------------------------------------------------------------ */
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
  console.log("🔁 ACW-App v4.7 activated — all caches cleared.");
});

/* ------------------------------------------------------------
   🌐 Cache Network Fallback for offline use
   ------------------------------------------------------------ */
const CACHE_NAME = "acw-v47-blue-glass";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./config.js",
  "./manifest.json"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
  console.log("📦 ACW-App assets pre-cached.");
});

/* ------------------------------------------------------------
   ⚙️ Fetch Handler → Always Serve Fresh Then Cache
   ------------------------------------------------------------ */
self.addEventListener("fetch", event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

/* ------------------------------------------------------------
   🧭 Version Tag for Debugging
   ------------------------------------------------------------ */
console.log("✅ ACW-App Service Worker v4.7 — Blue Glass Hybrid Loaded");
