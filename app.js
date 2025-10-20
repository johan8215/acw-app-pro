/* ===========================================================
   🚗 ACW-App v4.6.8 — Smart Hybrid Blue Glass Edition
   Author: Johan A. Giraldo (JAG15) & Sky
   Backend: 4.6.8 Smart Hybrid Blue Glass (Apps Script)
   =========================================================== */

const CONFIG = {
  BASE_URL: "https://script.google.com/macros/s/AKfycbzI9UgpoA11o662UJ7zlVCCJjBcsb8mMB0GyGS4t8Ab0ttf53S9J78ksu1kX94ULP6r/exec",
  VERSION: "v4.6.8",
  LANG_DEFAULT: "en"
};

/* ===========================================================
   🧠 Login handler
   =========================================================== */
async function loginUser() {
  const emailEl = document.getElementById("email");
  const passEl  = document.getElementById("password");
  const diag    = document.getElementById("diag");

  const email = (emailEl?.value || "").trim().toLowerCase();
  const pass  = (passEl?.value || "").trim();

  diag.textContent = "";

  if (!email || !pass) {
    diag.textContent = "⚠️ Please enter your email and password.";
    return;
  }

  diag.textContent = "🔄 Connecting…";

  try {
    const res = await fetch(`${CONFIG.BASE_URL}?action=login&email=${encodeURIComponent(email)}&password=${encodeURIComponent(pass)}`);
    const data = await res.json();

    console.log("🔹 Login response:", data);

    if (!data.ok) {
      diag.textContent = `❌ Login failed (${data.error || "unknown"})`;
      return;
    }

    localStorage.setItem("acw_email", email);
    localStorage.setItem("acw_name", data.name || "");
    localStorage.setItem("acw_role", data.role || "employee");

    diag.textContent = "✅ Login success! Loading schedule…";

    document.getElementById("login").style.display = "none";
    document.getElementById("welcome").style.display = "block";

    document.getElementById("welcomeName").textContent = data.name || email;
    document.getElementById("welcomeRole").textContent = capitalizeRole(data.role);

    await loadSchedule(email);
  } catch (err) {
    console.error("⚠️ Connection error:", err);
    diag.textContent = "⚠️ Connection error. (#202)";
  }
}

/* ===========================================================
   🗓️ Load schedule from Smart WebApp
   =========================================================== */
async function loadSchedule(email) {
  const box = document.getElementById("schedule");
  box.innerHTML = `<p style="color:#bcd6ff;">Loading schedule…</p>`;

  try {
    // Send short name instead of full email for Weekly Schedule lookup
    const short = email.split("@")[0].trim();
    const res = await fetch(`${CONFIG.BASE_URL}?action=getSmartSchedule&short=${encodeURIComponent(short)}`);
    const data = await res.json();

    console.log("📦 Schedule response:", data);

    if (!data.ok) {
      box.innerHTML = `<p style="color:#ff9999;">No schedule found (${data.error || "unknown"})</p>`;
      return;
    }

    let html = `
      <div class="week-header">
        <h3>Week of ${data.week || ""}</h3>
        <p><b>${data.name}</b></p>
      </div>
      <table class="schedule-table">
        <thead><tr><th>Day</th><th>Shift</th><th>Hours</th></tr></thead><tbody>
    `;

    let total = 0;
    (data.days || []).forEach(d => {
      total += d.hours || 0;
      html += `<tr><td>${d.name}</td><td>${d.shift || "—"}</td><td>${d.hours || 0}</td></tr>`;
    });

    html += `</tbody></table><p class="total">Total Hours: <b>${total.toFixed(1)}</b></p>`;
    box.innerHTML = html;
  } catch (err) {
    console.error("⚠️ Schedule error:", err);
    box.innerHTML = `<p style="color:#ff9999;">Connection error while loading schedule (#302)</p>`;
  }
}

/* ===========================================================
   ⚙️ Settings and logout
   =========================================================== */
function openSettings() { document.getElementById("settingsModal").style.display = "flex"; }
function closeSettings() { document.getElementById("settingsModal").style.display = "none"; }
function logoutUser() { localStorage.clear(); location.reload(); }

/* ===========================================================
   🧩 Helper functions
   =========================================================== */
function capitalizeRole(role) {
  const r = String(role || "").toLowerCase();
  return r.charAt(0).toUpperCase() + r.slice(1);
}

window.addEventListener("DOMContentLoaded", () => {
  const saved = localStorage.getItem("acw_email");
  if (saved) {
    document.getElementById("email").value = saved;
  }
});
