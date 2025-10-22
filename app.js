// ============================================================
// 🧠 ACW-App v4.7 — Blue Glass Edition (Full Build)
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

  const FALLBACK = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  let html = `
    <h4>Week: ${data.week}</h4>
    <table class="schedule-table">
      <tr><th>Day</th><th>Shift</th><th>Hours</th></tr>
  `;
  (data.days || []).forEach((d,i) => {
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
function calcLiveHours(shift,hours) {
  if (!shift) return 0;
  if (shift.includes("-")) return hours || 0;
  const match = shift.match(/(\d{1,2})(?::(\d{2}))?/);
  if (!match) return hours || 0;
  const startHour = parseInt(match[1],10);
  const startMin = parseInt(match[2] || "0",10);
  const now = new Date();
  const start = new Date();
  start.setHours(startHour);
  start.setMinutes(startMin);
  let diff = (now - start)/3600000;
  if (diff < 0) diff += 24;
  return Math.round(diff*10)/10;
}
function calcTotalHours(days) {
  let total = 0;
  for (const d of days) total += calcLiveHours(d.shift,d.hours);
  return total.toFixed(1);
}

// 🕓 CLOCK (LIVE REFRESH)
function startClock() {
  if (clockTimer) clearInterval(clockTimer);
  const box = document.getElementById("clockBox");
  function tick(){
    const now = new Date();
    box.textContent = "🕒 " + now.toLocaleTimeString([],{
      hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:true
    });
  }
  tick();
  clockTimer = setInterval(tick,1000);
}

// 👋 SHOW WELCOME DASHBOARD
function showWelcome(name, role) {
  document.getElementById("login").style.display = "none";
  document.getElementById("welcome").style.display = "block";
  document.getElementById("welcomeName").textContent = name;
  document.getElementById("welcomeRole").textContent = role;

  // Managers & Supervisors see the button
  if (role === "manager" || role === "supervisor") {
    addTeamButton();
  }
}

// 🧩 Add floating “Team Overview” button
function addTeamButton() {
  if (document.getElementById("teamBtn")) return; // prevent duplicates
  const btn = document.createElement("button");
  btn.id = "teamBtn";
  btn.className = "team-btn";
  btn.textContent = "Team Overview";
  btn.onclick = loadEmployeeDirectory;
  document.body.appendChild(btn);
}

// ============================================================
// 👥 TEAM OVERVIEW SYSTEM — v4.7 Blue Glass English Edition
// ============================================================
async function loadEmployeeDirectory() {
  try {
    const res = await fetch(`${CONFIG.BASE_URL}?action=getEmployeesDirectory`);
    const data = await res.json();
    if (!data.ok) return;
    renderDirectoryCards(data.directory);
  } catch (err) {
    console.error("Error loading directory:", err);
  }
}

function renderDirectoryCards(list) {
  const old = document.getElementById("directoryWrapper");
  if (old) old.remove();

  const wrapper = document.createElement("div");
  wrapper.id = "directoryWrapper";
  wrapper.className = "directory-wrapper";

  const header = document.createElement("div");
  header.className = "directory-header-bar";
  header.innerHTML = `
    <h3>Team Overview</h3>
    <button class="close-all-btn" onclick="closeAllEmployeeCards()">Close All</button>
  `;
  wrapper.appendChild(header);

  list.forEach(emp => {
    const card = document.createElement("div");
    card.className = "employee-card";
    card.innerHTML = `
      <div class="card-main">
        <div class="card-name">${emp.name}</div>
        <div class="card-role">${emp.role || ""}</div>
        <div class="card-email">${emp.email}</div>
        <button class="card-btn" onclick="openEmployeeCard('${emp.email}', '${emp.name}', '${emp.role}', '${emp.phone || ""}')">Open</button>
      </div>
    `;
    wrapper.appendChild(card);
  });

  document.body.appendChild(wrapper);
}

async function openEmployeeCard(email, name, role, phone) {
  try {
    const res = await fetch(`${CONFIG.BASE_URL}?action=getSmartSchedule&email=${encodeURIComponent(email)}`);
    const data = await res.json();
    if (!data.ok) {
      alert("No schedule found for this employee.");
      return;
    }

    if (document.getElementById(`modal-${email.replace(/[@.]/g,"_")}`)) return;

    const modal = document.createElement("div");
    modal.className = "employee-modal glass";
    modal.id = `modal-${email.replace(/[@.]/g,"_")}`;

    let html = `
      <div class="modal-header">
        <span class="modal-close" onclick="this.parentElement.parentElement.remove()">×</span>
        <h3>${name}</h3>
        <p>${role || ""}</p>
        <p>${phone || ""}</p>
      </div>
      <table class="schedule-mini">
        <tr><th>Day</th><th>Shift</th><th>Hours</th></tr>
    `;
    (data.days || []).forEach(d => {
      html += `<tr><td>${d.name}</td><td>${d.shift}</td><td>${d.hours}</td></tr>`;
    });
    html += `</table><p class="total">Total Hours: <b>${data.total}</b></p>`;
    modal.innerHTML = html;
    document.body.appendChild(modal);
  } catch (err) {
    console.error("Error opening employee card:", err);
  }
}

function closeAllEmployeeCards() {
  document.querySelectorAll(".employee-modal").forEach(m => m.remove());
  document.querySelector("#directoryWrapper")?.remove();
}

// ============================================================
// 🚪 LOGOUT & SETTINGS
// ============================================================
function logoutUser() {
  currentUser = null;
  scheduleData = null;
  if (clockTimer) clearInterval(clockTimer);
  document.getElementById("login").style.display = "block";
  document.getElementById("welcome").style.display = "none";
  document.getElementById("email").value = "";
  document.getElementById("password").value = "";
}

function openSettings() {
  document.getElementById("settingsModal").style.display = "block";
}
function closeSettings() {
  document.getElementById("settingsModal").style.display = "none";
}

console.log("✅ ACW Blue Glass v4.7 — app.js fully loaded & upgraded");
