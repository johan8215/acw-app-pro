/* ACW-App SW – cache light */
const CACHE_NAME = "acw-blueglass-v465";
const FILES = ["./","./index.html","./style.css","./config.js","./app.js","./manifest.json"];

self.addEventListener("install",e=>{
  e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(FILES)));
  self.skipWaiting();
});
self.addEventListener("activate",e=>{
  e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>k!==CACHE_NAME&&caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch",e=>{
  e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));
});