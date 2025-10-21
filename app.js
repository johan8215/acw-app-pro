// ============================================================
// 💧 ACW-App v4.7 — Blue White Glass Final (Legacy Sync)
// Johan A. Giraldo (JAG15) & Sky – Oct 2025
// ============================================================

console.log("🧠 ACW Blue White Glass v4.7 Loaded");

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
      diag.textContent = "⚠️ Invalid JSON (#901)";
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
// 📅 LOAD SCHEDULE + CLOCK + DAILY TIMER
// =======================================================
async function loadSchedule(email) {
  const box = document.getElementById("schedule");
  box.innerHTML = "<p>⏳ Loading schedule...</p>";

  try {
    const url = `${CONFIG.BASE_URL}?action=getSmartSchedule&email=${encodeURIComponent(email)}`;
    console.log("📡 Fetching schedule:", url);

    const res = await fetch(url, { mode: "cors" });
    const data = await res.json();
    console.log("🧾 SmartSchedule:", data);

    if (!data.ok) {
      box.innerHTML = `<p style="color:#ff3333;">No schedule found (#${data.error || 'unknown'})</p>`;
      return;
    }

    const todayIndex = new Date().getDay(); // 0=Sun, 1=Mon, ...
    const daysOrder = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];

    let html = `
      <h4>Week of ${data.week}</h4>
      <h3>${data.name}</h3>
      <table class="schedule-table">
        <tr><th>Day</th><th>Shift</th><th>Hours</th></tr>
    `;

    (data.days || []).forEach((d, i) => {
      const isToday = daysOrder[i] === daysOrder[todayIndex];
      const shift = d.shift || "-";
      const hours = d.hours || 0;
      const clock = isToday && shift !== "OFF" && shift !== "-" ? `<span id="timerToday" style="color:#0078ff;font-weight:500;">⏱️</span>` : "";
      html += `<tr><td>${d.name}</td><td>${shift}</td><td>${hours} ${clock}</td></tr>`;
    });

    html += `</table><p id="totalHours"><b>Total Hours:</b> ${data.total}</p>`;
    html += `<div id="clockBox" style="margin-top:10px;font-size:14px;color:#0078ff;"></div>`;
    box.innerHTML = html;

    startClock();
    startDailyTimer();

  } catch (err) {
    console.error("❌ Schedule fetch failed:", err);
    box.innerHTML = `<p style="color:#ff3333;">Connection error (schedule)</p>`;
  }
}

// =======================================================
// 🕒 LIVE CLOCK (Bottom Clock)
// =======================================================
function startClock() {
  const el = document.getElementById("clockBox");
  if (!el) return;
  function tick() {
    const now = new Date();
    el.textContent = "🕒 " + now.toLocaleTimeString([], {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true
    });
  }
  tick();
  clearInterval(window.__acwClock);
  window.__acwClock = setInterval(tick, 1000);
}

// =======================================================
// ⏱️ DAILY TIMER — contador en horas/min del día activo
// =======================================================
function startDailyTimer() {
  const el = document.getElementById("timerToday");
  if (!el) return;
  let seconds = 0;
  setInterval(() => {
    seconds++;
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    el.textContent = `⏱️ ${hrs}h ${mins}m`;
  }, 60000); // actualiza cada minuto
}

// =======================================================
// SETTINGS / LOGOUT (inside app)
// =======================================================
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
