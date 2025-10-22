/* ============================================================
   🧼 ACW-App Service Worker — Stable Mode (No Popup)
   Johan A. Giraldo | Oct 2025
============================================================ */

const CACHE_NAME = "acw-app-v4.8.2";
const ASSETS = [
  "/",
  "/index.html",
  "/style.css",
  "/app.js",
  "/config.js",
  "/manifest.json",
  "/acw-icon-512.png"
];

// 🧩 Install: cache essential files
self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// ♻️ Activate: clear old caches
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// 🌐 Fetch: serve cached or network fallback
self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(resp => resp || fetch(e.request))
  );
});

// 🚫 NO AUTO-RELOAD POPUPS — Stable build
// (Removed postMessage logic completely)
