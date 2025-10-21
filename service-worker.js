/* ============================================================
   ⚙️ ACW-App Service Worker — v4.6.9 Blue Glass Edition
   Enables offline mode and caching
   Johan A. Giraldo (JAG15) | Oct 2025
============================================================ */

const CACHE_NAME = "acw-app-v4.6.9";
const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./config.js",
  "./manifest.json"
];

// ✅ Install and cache files
self.addEventListener("install", (e) => {
  console.log("💾 Installing ACW service worker...");
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

// ✅ Activate and clear old caches
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("🧹 Removing old cache:", key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// ✅ Serve from cache (fallback to network)
self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return (
        response ||
        fetch(e.request).catch(() =>
          new Response("Offline mode — check your connection.")
        )
      );
    })
  );
});

console.log("✅ ACW Service Worker loaded — v4.6.9");
