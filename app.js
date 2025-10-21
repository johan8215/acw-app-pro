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

// 🧮 LOAD SCHEDULE
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
  const container = document.getElementById("schedule");
  container.innerHTML = "";

  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr><th>Day</th><th>Shift</th><th>Hours</th></tr>
    </thead>
    <tbody>
      ${data.days
        .map(day => {
          const today = new Date().toLocaleDateString("en-US", { weekday: "short" });
          const isToday = today === day.name;
          const liveHours = calcLiveHours(day.shift, day.hours);
          const showLive = isToday && day.shift?.endsWith(".");
          const hoursDisplay = showLive ? `⏱️ ${liveHours}` : day.hours || "-";
          return `
            <tr${isToday ? ' class="today"' : ""}>
              <td>${day.name}</td>
              <td>${day.shift || "-"}</td>
              <td>${hoursDisplay}</td>
            </tr>
          `;
        })
        .join("")}
    </tbody>
  `;
  container.appendChild(table);

  const total = calcTotalHours(data.days);
  document.getElementById("totalHours").innerHTML = `Total Hours: <b>${total}</b>`;
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
