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

function renderSchedule(data) {
  const container = document.getElementById("schedule");
  if (!data || !data.days) {
    container.innerHTML = "<p>No schedule data found.</p>";
    return;
  }

  // 🔧 fallback para nombres de día
  const fallbackDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  let html = `
    <h2>${data.name}</h2>
    <p class="role">${data.role}</p>
    <p>Week: ${data.week}</p>
    <table>
      <thead>
        <tr><th>Day</th><th>Shift</th><th>Hours</th></tr>
      </thead>
      <tbody>
  `;

  data.days.forEach((day, i) => {
    const dayName = day.day || fallbackDays[i] || "-";
    const shift = day.shift || "-";
    const hours = day.hours || 0;

    html += `
      <tr>
        <td>${dayName}</td>
        <td>${shift}</td>
        <td>${hours}</td>
      </tr>
    `;
  });

  html += `
      </tbody>
    </table>
    <p class="total">Total Hours: <b>${data.total}</b></p>
  `;

  container.innerHTML = html;
}

// 🧮 CALCULATE LIVE HOURS (if shift ends with ".")
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

// 🧮 CALCULATE TOTAL INCLUDING ACTIVE SHIFT
function calcTotalHours(days) {
  let total = 0;
  for (const d of days) {
    total += calcLiveHours(d.shift, d.hours);
  }
  return total.toFixed(1);
}

// 🕓 CLOCK & REFRESH
function startClock() {
  if (clockTimer) clearInterval(clockTimer);
  const clockEl = document.getElementById("clock");
  clockEl.textContent = "";

  clockTimer = setInterval(() => {
    const now = new Date();
    clockEl.textContent = `🕓 ${now.toLocaleTimeString()}`;
    if (scheduleData) renderSchedule(scheduleData); // refresh live hours
  }, 60000);

  // first tick immediately
  const now = new Date();
  clockEl.textContent = `🕓 ${now.toLocaleTimeString()}`;
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

console.log("✅ ACW Blue Glass v4.6.9 — app.js loaded");
