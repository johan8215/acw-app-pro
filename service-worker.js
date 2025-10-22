/* ============================================================
   🧠 ACW-App v4.7.1 — Blue Glass Hybrid + Auto-Update Popup
   Johan A. Giraldo (JAG15) & Sky | Allston Car Wash © 2025
   ============================================================ */

/* ------------------------------------------------------------
   ⚙️ Force Refresh Cache (iOS 26 compatible)
   ------------------------------------------------------------ */
const CACHE_NAME = "acw-v471-blue-glass";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./config.js",
  "./manifest.json"
];

// 🧩 Install → precache
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
  console.log("📦 ACW-App v4.7.1 installed and pre-cached.");
});

// 🔁 Activate → clear old caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
  console.log("🔁 ACW-App v4.7.1 activated — old caches removed.");
});

/* ------------------------------------------------------------
   🌐 Fetch → Network First, Cache Fallback
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
   🚨 Auto-Update Popup (for Safari/iPad)
   ------------------------------------------------------------ */
self.addEventListener("message", event => {
  if (event.data === "checkForUpdate") {
    fetch("./manifest.json", { cache: "no-store" })
      .then(() => {
        event.source.postMessage({ type: "UPDATE_AVAILABLE" });
      })
      .catch(err => console.warn("Update check failed:", err));
  }
});

// 📜 Version Tag
console.log("✅ ACW-App Service Worker v4.7.1 — Auto-Update Ready");
