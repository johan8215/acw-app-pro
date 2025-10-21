// ============================================================
// 💧 ACW Blue Glass App v4.6.9
// Frontend – Johan A. Giraldo & Sky (Oct 2025)
// ============================================================

console.log("🧠 ACW Blue Glass 4.6.9 – Stable Hybrid Fix Loaded");

// LOGIN HANDLER
async function loginUser() {
  const email = document.getElementById("email").value.trim().toLowerCase();
  const pass = document.getElementById("password").value.trim();
  const diag = document.getElementById("diag");
  diag.textContent = "⏳ Connecting...";

  if (!email || !pass) {
    diag.textContent = "⚠️ Please enter your email and password.";
    return;
  }

  // URL directa al backend
  const url = `${CONFIG.BASE_URL}?action=login&email=${encodeURIComponent(email)}&password=${encodeURIComponent(pass)}`;
  console.log("🌐 Fetching:", url);

  try {
    const res = await fetch(url, { method: "GET", mode: "cors" });
    const text = await res.text();
    console.log("🔹 Raw response:", text);

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      diag.textContent = "⚠️ Invalid JSON from server (#901)";
      console.error(e);
      return;
    }

    if (!data.ok) {
      diag.textContent = `❌ Login failed (${data.error || "unknown"})`;
      return;
    }

    diag.textContent = "✅ Login successful!";
    localStorage.setItem("acw_email", email);

    document.getElementById("login").style.display = "none";
    document.getElementById("welcome").style.display = "block";
    document.getElementById("welcomeName").textContent = data.name || email;
    document.getElementById("welcomeRole").textContent = data.role || "Employee";

    await loadSchedule(email);
  } catch (err) {
    console.error("❌ Connection error:", err);
    diag.textContent = "⚠️ Connection error. (Fetch)";
  }
}

// =======================================================
// 📅 LOAD SCHEDULE + CLOCK (Blue Glass Enhanced)
// =======================================================
async function loadSchedule(email) {
  const box = document.getElementById("schedule");
  box.innerHTML = "<p>⏳ Loading schedule...</p>";

  try {
    // ✅ URL con email (para compatibilidad con backend 4.6.9)
    const url = `${CONFIG.BASE_URL}?action=getSmartSchedule&email=${encodeURIComponent(email)}`;
    console.log("📡 Fetching schedule:", url);

    const res = await fetch(url, { mode: "cors" });
    const text = await res.text();
    console.log("🧾 Raw schedule:", text);

    const data = JSON.parse(text);
    if (!data.ok) {
      box.innerHTML = `<p style="color:#ff9999;">No schedule found (#${data.error || "unknown"})</p>`;
      return;
    }

    // 🧠 Renderiza semana + tabla
    let html = `
      <h4>Week: ${data.week}</h4>
      <table class="schedule-table">
        <tr><th>Day</th><th>Shift</th><th>Hours</th></tr>
    `;

    (data.days || []).forEach(d => {
      html += `<tr>
        <td>${d.name || "-"}</td>
        <td>${d.shift || "-"}</td>
        <td>${d.hours || 0}</td>
      </tr>`;
    });

    html += `</table><p><b>Total Hours: ${data.total || 0}</b></p>`;
    html += `<div id="clockBox" style="margin-top:10px;font-size:14px;color:#00ffcc;"></div>`;
    box.innerHTML = html;

    // 🕐 Inicia reloj dinámico
    startClock();

  } catch (err) {
    console.error("❌ Schedule fetch failed:", err);
    box.innerHTML = `<p style="color:#ff9999;">Connection error (schedule)</p>`;
  }
}

// =======================================================
// 🕐 LIVE CLOCK (igual al del sábado)
// =======================================================
function startClock() {
  const el = document.getElementById("clockBox");
  function update() {
    const now = new Date();
    const opts = { hour: "2-digit", minute: "2-digit", second: "2-digit" };
    el.textContent = "🕒 " + now.toLocaleTimeString("en-US", opts);
  }
  update();
  setInterval(update, 1000);
}
// SETTINGS / LOGOUT
function openSettings() {
  document.getElementById("settingsModal").style.display = "flex";
}
function closeSettings() {
  document.getElementById("settingsModal").style.display = "none";
}
function logoutUser() {
  localStorage.clear();
  location.reload();
}
