// ============================================================
// 🧠 ACW-App v4.8.2 — White-Blue Stable Build
// Johan A. Giraldo (JAG15) & Sky — Oct 2025
// ============================================================

let currentUser = null;
let scheduleData = null;
let clockTimer = null;

/* ============================================================
   🔐 LOGIN & SESSION RESTORE
   ============================================================ */
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
    localStorage.setItem("acwUser", JSON.stringify(data));

    diag.textContent = "";
    showWelcome(data.name, data.role);
    await loadSchedule(email);
  } catch (err) {
    diag.textContent = err.message;
  }
}

// 🧩 Restore session automatically
window.addEventListener("load", () => {
  const saved = localStorage.getItem("acwUser");
  if (saved) {
    try {
      const user = JSON.parse(saved);
      currentUser = user;
      showWelcome(user.name, user.role);
      loadSchedule(user.email);
    } catch (e) {
      console.error("Session restore failed:", e);
      localStorage.removeItem("acwUser");
    }
  }
});

/* ============================================================
   📅 LOAD & RENDER SCHEDULE
   ============================================================ */
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
    <div id="clockBox" class="clock"></div>`;
  box.innerHTML = html;
}

/* ============================================================
   ⏰ CLOCK & HOURS
   ============================================================ */
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

/* ============================================================
   👋 DASHBOARD
   ============================================================ */
function showWelcome(name, role) {
  document.getElementById("login").style.display = "none";
  document.getElementById("welcome").style.display = "block";
  document.getElementById("welcomeName").textContent = name;
  document.getElementById("welcomeRole").textContent = role;

  if (role === "manager" || role === "supervisor") {
    addTeamButton();
  }
}

/* ============================================================
   👥 TEAM OVERVIEW — Floating White/Blue Table
   ============================================================ */
function addTeamButton() {
  if (document.getElementById("teamBtn")) return;
  const btn = document.createElement("button");
  btn.id = "teamBtn";
  btn.className = "team-btn";
  btn.textContent = "Team Overview";
  btn.onclick = toggleTeamOverview;
  document.body.appendChild(btn);
}

let directoryVisible = false;
function toggleTeamOverview() {
  if (directoryVisible) {
    document.getElementById("directoryWrapper")?.remove();
    directoryVisible = false;
    return;
  }
  loadEmployeeDirectory();
  directoryVisible = true;
}

async function loadEmployeeDirectory() {
  try {
    const res = await fetch(`${CONFIG.BASE_URL}?action=getEmployeesDirectory`);
    const data = await res.json();
    if (!data.ok) return;
    renderDirectoryTable(data.directory);
  } catch (err) {
    console.error("Error loading directory:", err);
  }
}

function renderDirectoryTable(list) {
  document.getElementById("directoryWrapper")?.remove();
  const wrapper = document.createElement("div");
  wrapper.id = "directoryWrapper";
  wrapper.className = "directory-wrapper";

  let html = `
    <h3 style="margin-top:0;margin-bottom:10px;color:#0070ff;">Team Overview</h3>
    <table class="directory-table">
      <tr><th>Name</th><th>Role</th><th>Email</th><th>Phone</th><th>Status</th><th></th></tr>
  `;
  list.forEach(emp => {
    const active = emp.status === "active";
    html += `
      <tr class="${active ? "active-row" : "inactive-row"}">
        <td><b>${emp.name}</b></td>
        <td>${emp.role}</td>
        <td>${emp.email}</td>
        <td>${emp.phone || ""}</td>
        <td style="color:${active ? "#00b37d" : "#888"};">${emp.status}</td>
        <td><button class="open-btn" onclick="openEmployeeCard('${emp.email}','${emp.name}','${emp.role}','${emp.phone}')">Open</button></td>
      </tr>`;
  });
  html += "</table>";
  wrapper.innerHTML = html;
  document.body.appendChild(wrapper);
}

async function openEmployeeCard(email,name,role,phone){
  try {
    const res = await fetch(`${CONFIG.BASE_URL}?action=getSmartSchedule&email=${encodeURIComponent(email)}`);
    const data = await res.json();
    if (!data.ok) return alert("No schedule found for this employee.");

    const modal = document.createElement("div");
    modal.className = "employee-modal";
    modal.innerHTML = `
      <div class="modal-header">
        <span class="modal-close" onclick="this.parentElement.parentElement.remove()">×</span>
        <h3>${name}</h3>
        <p>${role||""}</p>
        <p>${phone||""}</p>
      </div>
      <table class="schedule-mini">
        <tr><th>Day</th><th>Shift</th><th>Hours</th></tr>
        ${data.days.map(d=>`<tr><td>${d.name}</td><td>${d.shift}</td><td>${d.hours}</td></tr>`).join("")}
      </table>
      <p class="total">Total Hours: <b>${data.total}</b></p>
    `;
    document.body.appendChild(modal);
  } catch(err) {
    console.error("Error opening card:", err);
  }
}

/* ============================================================
   🚪 LOGOUT & SETTINGS
   ============================================================ */
function logoutUser(){
  currentUser=null;
  scheduleData=null;
  if(clockTimer)clearInterval(clockTimer);
  localStorage.removeItem("acwUser");
  document.getElementById("login").style.display="block";
  document.getElementById("welcome").style.display="none";
  document.getElementById("email").value="";
  document.getElementById("password").value="";
}
function openSettings(){document.getElementById("settingsModal").style.display="block";}
function closeSettings(){document.getElementById("settingsModal").style.display="none";}

/* ============================================================
   📲 INSTALL APP BUTTON
   ============================================================ */
let deferredPrompt;
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallButton();
});

function showInstallButton() {
  if (document.getElementById("installBtn")) return;
  const btn = document.createElement("button");
  btn.id = "installBtn";
  btn.className = "install-btn";
  btn.textContent = "Add App";
  btn.onclick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      btn.remove();
    } else {
      alert("Add this app to your Home Screen from Safari’s share menu.");
    }
  };
  document.body.appendChild(btn);
}

console.log("✅ ACW-App v4.8.2 — White-Blue Stable Build Loaded");
