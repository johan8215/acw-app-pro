/* ===========================================================
   🚀 APP.JS — ACW-App v4.6.5 (Blue Glass Edition)
   Author: Johan A. Giraldo (JAG15) & Sky
   =========================================================== */

/* 🔍 Test: confirm load */
alert("✅ app.js loaded correctly!");
console.log("✅ app.js connected and running");

/* ===== Error codes for diagnostics ===== */
const ERR = {
  MISSING_FIELDS: 100,
  EMAIL_NOT_FOUND: 101,
  ACCESS_DENIED: 303,
  CONNECT_FAIL: 202,
  UNKNOWN: 999
};

/* ===== Language setup ===== */
const LANG = (navigator.language || "").toLowerCase().startsWith("es")
  ? "es"
  : (CONFIG.LANG_DEFAULT || "en");

const TXT = {
  en: {
    please: "Please enter your email and password.",
    invalid: "Invalid credentials.",
    noSchedule: "No schedule found.",
    connErr: "Connection error."
  },
  es: {
    please: "Ingresa tu email y contraseña.",
    invalid: "Credenciales inválidas.",
    noSchedule: "No se encontró horario.",
    connErr: "Error de conexión."
  }
}[LANG];

const DAY_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/* ===== Prefill remembered email ===== */
document.addEventListener("DOMContentLoaded", () => {
  const remembered = localStorage.getItem("acw_email") || localStorage.getItem("acw_email_hint");
  if (remembered) {
    const el = document.getElementById("email");
    if (el) el.value = remembered;
  }
});

/* ===== LOGIN ===== */
async function loginUser() {
  const emailEl = document.getElementById("email");
  const passEl = document.getElementById("password");
  const diag = document.getElementById("diag");

  const email = (emailEl?.value || "").trim().toLowerCase();
  const password = (passEl?.value || "").trim();

  localStorage.setItem("acw_email_hint", email);

  if (!email || !password) {
    diag.textContent = `⚠️ ${TXT.please} (#${ERR.MISSING_FIELDS})`;
    return;
  }

  const url = `${CONFIG.BASE_URL}?action=login&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
  console.log("🔍 Fetching:", url);

  try {
    const res = await fetch(url, { method: "GET" });
    const text = await res.text();
    console.log("🔹 Raw response:", text);

    let data;
    try { data = JSON.parse(text); }
    catch { diag.textContent = `⚠️ Invalid JSON (#901)`; return; }

    if (!data.ok) {
      const code =
        data.error === "email_not_found" ? ERR.EMAIL_NOT_FOUND :
        data.error === "access_denied" ? ERR.ACCESS_DENIED : ERR.UNKNOWN;
      diag.textContent = `❌ Login failed (#${code}) → ${data.error || "unknown"}`;
      return;
    }

    // ✅ Login success
    localStorage.setItem("acw_email", email);
    localStorage.setItem("acw_name", data.name || "");
    localStorage.setItem("acw_role", data.role || "employee");

    diag.textContent = "✅ Login success (#200)";
    document.getElementById("login").style.display = "none";
    document.getElementById("welcome").style.display = "block";
    document.getElementById("welcomeName").textContent = `Welcome, ${data.name || email.split("@")[0]}`;
    document.getElementById("welcomeRole").textContent = capitalizeRole(data.role || "employee");
    await getSchedule(email);

  } catch (err) {
    console.error("⚠️ Fetch error:", err);
    diag.textContent = `⚠️ Connection error (#${ERR.CONNECT_FAIL})`;
  }
}

/* ===== Helpers ===== */
function capitalizeRole(role) {
  const r = String(role || "").toLowerCase();
  return r ? r.charAt(0).toUpperCase() + r.slice(1) : "Employee";
}

/* ===== Schedule ===== */
async function getSchedule(email) {
  const box = document.getElementById("schedule");
  box.innerHTML = `<p style="color:#bcd6ff">Loading…</p>`;

  try {
    const res = await fetch(`${CONFIG.BASE_URL}?action=getSchedule&email=${encodeURIComponent(email)}`);
    const data = await res.json();

    if (!data.ok) {
      box.innerHTML = `<p style="color:#ffb3b3;">${TXT.noSchedule}</p>`;
      return;
    }

    const map = new Map((data.days || []).map(d => [String(d.name || "").slice(0, 3), d]));
    const fixed = DAY_ORDER.map(d => {
      const x = map.get(d) || {};
      return {
        name: d,
        shift: (x.shift || "OFF").toString(),
        hours: (x.hours ?? calcHoursFromShift(x.shift) || 0)
      };
    });

    let total = 0;
    let html = `
      <div class="week-header">
        <h3>Week of ${data.week || ""}</h3>
        <p><b>${data.name || ""}</b></p>
      </div>
      <table class="schedule-table">
        <thead><tr><th>Day</th><th>Shift</th><th>Hours</th></tr></thead><tbody>`;

    for (const d of fixed) {
      const hrs = typeof d.hours === "number" ? (total += d.hours, d.hours) : "—";
      html += `<tr><td>${d.name}</td><td>${d.shift}</td><td>${hrs}</td></tr>`;
    }

    html += `</tbody></table><p class="total">Total Hours: <b>${Math.round(total * 10) / 10}</b></p>`;
    box.innerHTML = html;

  } catch {
    box.innerHTML = `<p style="color:#ffb3b3;">${TXT.connErr} (#${ERR.CONNECT_FAIL})</p>`;
  }
}

function calcHoursFromShift(shift) {
  const s = String(shift || "").trim();
  if (/off/i.test(s)) return 0;
  const m = s.replace(/\s+/g, "").replace(/\./g, ":").match(/^(\d{1,2})(?::(\d{2}))?[-–](\d{1,2})(?::(\d{2}))?$/i);
  if (!m) return 0;
  const sh = +m[1] || 0, sm = +m[2] || 0, eh = +m[3] || 0, em = +m[4] || 0;
  let start = sh + sm / 60, end = eh + em / 60, diff = end - start;
  if (diff < 0) diff += 12;
  return Math.round(diff * 10) / 10;
}
