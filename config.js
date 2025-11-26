// ===========================================================
// 🧠 ACW-App Config v5.6.2 — Blue Glass White Connected Edition
// Johan A. Giraldo (JAG15) | Allston Car Wash © 2025
// ===========================================================

const CONFIG = {
  BASE_URL: "https://script.google.com/macros/s/AKfycbx-6DqfjydMMGp-K2z8FeBSH9t8Z1Ooa0Ene0u917RK7Eo6vu80aOTLmCf7lJtm-Ckh/exec".trim(),
  VERSION: "v5.6.2 — Blue Glass White Connected Edition"
};

// 🔁 Asegura visibilidad global
window.CONFIG = CONFIG;

// 🧩 Log no bloqueante
setTimeout(() => {
  console.log(`✅ ACW-App connected → ${CONFIG.VERSION}`);
  console.log(`🌐 Backend: ${CONFIG.BASE_URL}`);
}, 100);
