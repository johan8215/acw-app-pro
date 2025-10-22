// ============================================================
// 🧠 ACW-App v4.6.9 — Stable Blue Glass Edition
// Johan A. Giraldo (JAG15) & Sky — Oct 2025
// ============================================================

let currentUser = null;
let scheduleData = null;
let clockTimer = null;

// 🧩 LOGIN FUNCTION
async function loginUser() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const diag = document.getElementById("diag");
  diag.textContent = "";
  if (!email || !password) {
    diag.textContent = "Please enter your email and password.";
    return;
  }

  try {
    diag.textContent = "Signing in...";
    const res = await fetch(
      `${CONFIG.BASE_URL}?action=login&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`
    );
    const data = await res.json();

    if (!data.ok) throw new Error("Invalid email or password.");

    currentUser = data;
    diag.textContent = "";
    showWelcome(data.name, data.role);
    await loadSchedule(email);
  } catch (err) {
    diag.textContent = err.message;
  }
}

// 🧠 LOAD SCHEDULE
async function loadSchedule(email) {
  const diag = document.getElementById("diag");
  diag.textContent = "Loading schedule...";

  try {
    const res = await fetch(`${CONFIG.BASE_URL}?action=getSmartSchedule&email=${encodeURIComponent(email)}`);
    const data = await res.json();
    if (!data.ok) throw new Error("Could not load schedule.");

    scheduleData = data;
    diag.textContent = "";
    renderSchedule(data);
    startClock();
  } catch (err) {
    diag.textContent = "Error loading schedule.";
    console.error(err);
  }
}

// 🧾 RENDER SCHEDULE TABLE
function renderSchedule(data) {
  const box = document.getElementById("schedule");
  if (!data || !data.ok) {
    box.innerHTML = `<p style="color:#ff9999;">No schedule found</p>`;
    return;
  }

  const FALLBACK = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  let html = `
    <h4>Week: ${data.week}</h4>
    <table class="schedule-table">
      <tr><th>Day</th><th>Shift</th><th>Hours</th></tr>
  `;

  (data.days || []).forEach((d, i) => {
    const dayName = d.name || FALLBACK[i];
    const shift = d.shift || "-";
    const hours = d.hours || 0;
    html += `<tr><td>${dayName}</td><td>${shift}</td><td>${hours}</td></tr>`;
  });

  html += `</table>
    <p><b>Total Hours: ${calcTotalHours(data.days)}</b></p>
    <div id="clockBox" style="margin-top:10px;font-size:14px;color:#0070ff;"></div>`;
  box.innerHTML = html;
}

// 🕐 CALCULATE HOURS (live or fixed)
function calcLiveHours(shift, hours) {
  if (!shift) return 0;
  if (shift.includes("-")) return hours || 0;
  const match = shift.match(/(\d{1,2})(?::(\d{2}))?/);
  if (!match) return hours || 0;
  const startHour = parseInt(match[1], 10);
  const startMin = parseInt(match[2] || "0", 10);
  const now = new Date();
  const start = new Date();
  start.setHours(startHour);
  start.setMinutes(startMin);
  let diff = (now - start) / 3600000;
  if (diff < 0) diff += 24;
  return Math.round(diff * 10) / 10;
}

function calcTotalHours(days) {
  let total = 0;
  for (const d of days) total += calcLiveHours(d.shift, d.hours);
  return total.toFixed(1);
}

// 🕓 CLOCK (LIVE REFRESH)
function startClock() {
  if (clockTimer) clearInterval(clockTimer);
  const box = document.getElementById("clockBox");
  function tick() {
    const now = new Date();
    box.textContent = "🕒 " + now.toLocaleTimeString([], {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true
    });
  }
  tick();
  clockTimer = setInterval(tick, 1000);
}

// 👋 SHOW WELCOME DASHBOARD
function showWelcome(name, role) {
  document.getElementById("login").style.display = "none";
  document.getElementById("welcome").style.display = "block";
  document.getElementById("welcomeName").textContent = name;
  document.getElementById("welcomeRole").textContent = role;
}

// 🚪 LOGOUT
function logoutUser() {
  currentUser = null;
  scheduleData = null;
  if (clockTimer) clearInterval(clockTimer);
  document.getElementById("login").style.display = "block";
  document.getElementById("welcome").style.display = "none";
  document.getElementById("email").value = "";
  document.getElementById("password").value = "";
}

// ⚙️ SETTINGS MODAL
function openSettings() {
  document.getElementById("settingsModal").style.display = "block";
}
function closeSettings() {
  document.getElementById("settingsModal").style.display = "none";
}

console.log("✅ ACW Blue Glass v4.6.9 — app.js restored & fixed");
