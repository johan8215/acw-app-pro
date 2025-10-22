// ============================================================
// 🧠 ACW-App v4.7 — Blue Glass Edition (Final Build)
// Johan A. Giraldo (JAG15) & Sky — Oct 2025
// ============================================================

let currentUser = null;
let scheduleData = null;
let clockTimer = null;

/* ============================================================
   🔐 LOGIN
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
// 🧩 Restore session on load
window.addEventListener("load", () => {
  const savedUser = localStorage.getItem("acwUser");
  if (savedUser) {
    try {
      const user = JSON.parse(savedUser);
      currentUser = user;
      showWelcome(user.name, user.role);
      loadSchedule(user.email);
    } catch (e) {
      console.error("Failed to restore session:", e);
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
  let html = `<h4>Week: ${data.week}</h4>
  <table class="schedule-table">
  <tr><th>Day</th><th>Shift</th><th>Hours</th></tr>`;
  (data.days || []).forEach((d,i) => {
    const dayName = d.name || FALLBACK[i];
    html += `<tr><td>${dayName}</td><td>${d.shift||"-"}</td><td>${d.hours||0}</td></tr>`;
  });
  html += `</table><p><b>Total Hours: ${calcTotalHours(data.days)}</b></p>
  <div id="clockBox" style="margin-top:10px;font-size:14px;color:#0070ff;"></div>`;
  box.innerHTML = html;
}

/* ============================================================
   🕓 CLOCK & HOURS
   ============================================================ */
function calcLiveHours(shift,hours){
  if(!shift)return 0;
  if(shift.includes("-"))return hours||0;
  const m=shift.match(/(\d{1,2})(?::(\d{2}))?/);
  if(!m)return hours||0;
  const h=parseInt(m[1],10),min=parseInt(m[2]||"0",10);
  const now=new Date(),start=new Date();
  start.setHours(h);start.setMinutes(min);
  let diff=(now-start)/3600000;if(diff<0)diff+=24;
  return Math.round(diff*10)/10;
}
function calcTotalHours(days){
  return days.reduce((s,d)=>s+calcLiveHours(d.shift,d.hours),0).toFixed(1);
}
function startClock(){
  if(clockTimer)clearInterval(clockTimer);
  const box=document.getElementById("clockBox");
  const tick=()=>{const n=new Date();
    box.textContent="🕒 "+n.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:true});};
  tick();clockTimer=setInterval(tick,1000);
}

/* ============================================================
   👋 DASHBOARD
   ============================================================ */
function showWelcome(name,role){
  document.getElementById("login").style.display="none";
  document.getElementById("welcome").style.display="block";
  document.getElementById("welcomeName").textContent=name;
  document.getElementById("welcomeRole").textContent=role;
  if(role==="manager"||role==="supervisor") addTeamButton();
}

// ============================================================
// 👥 TEAM OVERVIEW — Blue Glass Floating Grid Edition (v4.8)
// ============================================================

let directoryVisible = false;

// 🧩 Add floating “Team Overview” button
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

// Load employee list
async function loadEmployeeDirectory() {
  try {
    const res = await fetch(`${CONFIG.BASE_URL}?action=getEmployeesDirectory`);
    const data = await res.json();
    if (!data.ok) return;
    renderDirectoryGrid(data.directory);
  } catch (err) {
    console.error("Error loading directory:", err);
  }
}

// 📊 Render multiple floating tables (auto-split by 8 employees each)
function renderDirectoryGrid(list) {
  // Remove old
  document.querySelectorAll(".team-grid").forEach(e => e.remove());

  const chunkSize = 8;
  for (let i = 0; i < list.length; i += chunkSize) {
    const group = list.slice(i, i + chunkSize);

    const grid = document.createElement("div");
    grid.className = "team-grid glass";

    let html = `
      <div class="grid-header">Team Overview</div>
      <table class="directory-table">
        <tr><th>Name</th><th>Role</th><th>Hours</th><th></th></tr>
    `;

    group.forEach(emp => {
      const active = emp.status === "active";
      html += `
        <tr class="${active ? "active-row" : "inactive-row"}">
          <td><b>${emp.name}</b></td>
          <td>${emp.role}</td>
          <td>${emp.hours || 0}</td>
          <td><button class="open-btn" onclick="openEmployeeCard('${emp.email}','${emp.name}','${emp.role}','${emp.phone}')">Open</button></td>
        </tr>`;
    });

    html += "</table>";
    grid.innerHTML = html;
    document.body.appendChild(grid);
  }
}

/* ============================================================
   🚪 LOGOUT & SETTINGS
   ============================================================ */
function logoutUser() {
  // 🧹 Clear saved session
  localStorage.removeItem("acwUser");

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

/* ============================================================
   📲 INSTALL APP PROMPT — Blue Glass Edition (iOS & Android)
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
