/* ============================================================
   🧠 ACW-App v4.8.3 — Blue Glass+ Edition (Stable Modern Build)
   Johan A. Giraldo (JAG15) & Sky — Oct 2025
   ============================================================ */

let currentUser = null;
let scheduleData = null;

/* ============================================================
   🔐 LOGIN
   ============================================================ */
async function loginUser() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const diag = document.getElementById("diag");
  const btn = document.querySelector("#login button");

  if (!email || !password) {
    diag.textContent = "Please enter your email and password.";
    return;
  }

  try {
    btn.disabled = true;
    btn.innerHTML = "⏳ Loading your shift…";
    btn.style.boxShadow = "0 0 20px rgba(0,136,255,0.8)";
    diag.textContent = "Connecting to Allston Car Wash servers ☀️";

    const res = await fetch(
      `${CONFIG.BASE_URL}?action=login&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`
    );
    const data = await res.json();
    if (!data.ok) throw new Error("Invalid email or password.");

    currentUser = data;
    localStorage.setItem("acwUser", JSON.stringify(data));
    diag.textContent = "✅ Welcome, " + data.name + "!";
    showWelcome(data.name, data.role);
    await loadSchedule(email);
  } catch (err) {
    diag.textContent = "❌ " + err.message;
  } finally {
    btn.disabled = false;
    btn.innerHTML = "Sign In";
    btn.style.boxShadow = "none";
  }
}

/* ============================================================
   👋 SHOW WELCOME DASHBOARD — with delayed phone render
   ============================================================ */
async function showWelcome(name, role) {
  document.getElementById("login").style.display = "none";
  document.getElementById("welcome").style.display = "block";
  document.getElementById("welcomeName").innerHTML = `<b>${name}</b>`;
  document.getElementById("welcomeRole").textContent = role;

  if (["manager", "supervisor"].includes(role.toLowerCase())) addTeamButton();

  try {
    const res = await fetch(`${CONFIG.BASE_URL}?action=getEmployeesDirectory`);
    const data = await res.json();

    if (data.ok && data.directory) {
      const match = data.directory.find(e =>
        e.email?.toLowerCase() === (currentUser?.email || "").toLowerCase()
      );

      if (match && match.phone) {
        setTimeout(() => {
          document.querySelector(".user-phone")?.remove();
          const phoneHTML = `
            <p class="user-phone">📞 
              <a href="tel:${match.phone}" style="color:#0078ff;text-decoration:none;font-weight:600;">
                ${match.phone}
              </a>
            </p>`;
          document.getElementById("welcomeName")?.insertAdjacentHTML("afterend", phoneHTML);
        }, 300);
      }
    }
  } catch (err) {
    console.warn("Could not load phone number:", err);
  }
}

/* ============================================================
   📅 LOAD SCHEDULE — with Auto Live Timer
   ============================================================ */
async function loadSchedule(email) {
  const schedDiv = document.getElementById("schedule");
  schedDiv.innerHTML = `<p style="color:#007bff;font-weight:500;">Loading your shift...</p>`;

  try {
    const res = await fetch(`${CONFIG.BASE_URL}?action=getSmartSchedule&email=${encodeURIComponent(email)}`);
    const data = await res.json();
    if (!data.ok || !data.days) throw new Error("No schedule found");

    let html = `
      <table>
        <tr><th>Day</th><th>Shift</th><th>Hours</th></tr>`;
    data.days.forEach(d => {
      const isToday = new Date().toLocaleString("en-US", { weekday: "short" }).toLowerCase()
        .includes(d.name.slice(0, 3).toLowerCase());
      html += `
        <tr class="${isToday ? "today" : ""}">
          <td>${d.name}</td>
          <td>${d.shift || "-"}</td>
          <td>${d.hours || "0"}</td>
        </tr>`;
    });
    html += `</table><p class="total">Total Hours: <b>${data.total || 0}</b></p>`;
    schedDiv.innerHTML = html;

    setTimeout(() => startLiveTimer(data.days, Number(data.total || 0)), 1000);
  } catch (err) {
    schedDiv.innerHTML = `<p style="color:#c00;">❌ ${err.message}</p>`;
  }
}

/* ============================================================
   ⚙️ SETTINGS + REFRESH
   ============================================================ */
function openSettings() { document.getElementById("settingsModal").style.display = "block"; }
function closeSettings() { document.getElementById("settingsModal").style.display = "none"; }

function refreshApp() {
  closeSettings();
  if ("caches" in window) caches.keys().then(names => names.forEach(n => caches.delete(n)));
  const btn = document.querySelector(".settings-section button:first-child");
  if (btn) { btn.innerHTML = "⏳ Updating..."; btn.style.opacity = "0.7"; }
  setTimeout(() => window.location.reload(true), 1200);
}
function logoutUser() {
  localStorage.removeItem("acwUser");
  closeSettings();
  setTimeout(() => window.location.reload(true), 600);
}

/* ============================================================
   ♻️ RESTORE SESSION
   ============================================================ */
window.addEventListener("load", () => {
  const saved = localStorage.getItem("acwUser");
  if (saved) {
    const user = JSON.parse(saved);
    currentUser = user;
    showWelcome(user.name, user.role);
    loadSchedule(user.email);
  }
});

/* ============================================================
   ⏱️ LIVE HOURS — Blue Glass White Edition
   ============================================================ */
function startLiveTimer(days, total) {
  try {
    const todayName = new Date().toLocaleString("en-US", { weekday: "long" });
    const today = days.find(d => d.name.toLowerCase() === todayName.toLowerCase());
    if (!today || !today.shift || today.shift.includes("OFF")) return;

    const [startStr, endStr] = today.shift.split("-");
    if (!startStr || !endStr) return;

    const startTime = parseTime(startStr);
    const update = () => {
      const now = new Date();
      const diff = (now - startTime) / 36e5;
      const liveHrs = Math.max(0, diff.toFixed(2));
      updateTotalDisplay(total + Number(liveHrs));
      showLiveHours(liveHrs);
    };
    update();
    setInterval(update, 60000);
  } catch (err) {
    console.warn("⏱️ Live hours not active:", err);
  }
}

function showLiveHours(hours) {
  let liveEl = document.querySelector(".live-hours");
  if (!liveEl) {
    liveEl = document.createElement("p");
    liveEl.className = "live-hours";
    liveEl.style = "font-size:1.2em;color:#0070ff;margin-top:6px;text-shadow:0 0 10px rgba(0,120,255,0.4)";
    document.querySelector("#schedule")?.appendChild(liveEl);
  }
  const color = hours > 9 ? "#e60000" : "#0070ff";
  liveEl.innerHTML = `Live Shift: <b style="color:${color}">${hours}</b> h ⏱️`;
}

function parseTime(str) {
  const [time, meridian] = str.trim().split(" ");
  let [h, m] = time.split(":").map(Number);
  if (meridian?.toLowerCase() === "pm" && h !== 12) h += 12;
  if (meridian?.toLowerCase() === "am" && h === 12) h = 0;
  const d = new Date(); d.setHours(h, m || 0, 0, 0);
  return d;
}
function updateTotalDisplay(value) {
  document.querySelector(".total")?.innerHTML = `Total Hours: <b>${value.toFixed(2)}</b> ⏱️`;
}

/* ============================================================
   👥 TEAM VIEW — Paged + Animated Panels (v4.8.3)
   ============================================================ */

const TEAM_PAGE_SIZE = 8;
let __teamList = [], __teamPage = 0;

function addTeamButton() {
  if (document.getElementById("teamBtn")) return;
  const btn = document.createElement("button");
  btn.id = "teamBtn"; btn.className = "team-btn"; btn.textContent = "Team View";
  btn.onclick = toggleTeamOverview;
  document.body.appendChild(btn);
}

function toggleTeamOverview() {
  const wrap = document.getElementById("directoryWrapper");
  if (wrap) { wrap.classList.add("fade-out"); setTimeout(()=>wrap.remove(),200); return; }
  loadEmployeeDirectory();
}

async function loadEmployeeDirectory() {
  try {
    const res = await fetch(`${CONFIG.BASE_URL}?action=getEmployeesDirectory`);
    const data = await res.json();
    if (!data.ok) return;
    __teamList = data.directory || [];
    __teamPage = 0;
    renderTeamViewPage();
  } catch(e){ console.warn(e); }
}

function renderTeamViewPage() {
  document.getElementById("directoryWrapper")?.remove();

  const box = document.createElement("div");
  box.id = "directoryWrapper";
  box.className = "directory-wrapper tv-wrapper fade-in";
  const totalPages = Math.max(1, Math.ceil(__teamList.length / TEAM_PAGE_SIZE));
  box.innerHTML = `
    <div class="tv-head">
      <h3>Team View</h3>
      <button class="tv-close" onclick="closeTeamView()">✖️</button>
    </div>

    <div class="tv-pager">
      <button class="tv-nav" id="tvPrev" ${__teamPage===0?'disabled':''}>‹ Prev</button>
      <span class="tv-index">Page ${__teamPage+1} / ${totalPages}</span>
      <button class="tv-nav" id="tvNext" ${(__teamPage+1)>=totalPages?'disabled':''}>Next ›</button>
    </div>

    <table class="directory-table tv-table">
      <tr><th>Name</th><th>Hours</th><th></th></tr>
      <tbody id="tvBody"></tbody>
    </table>`;
  document.body.appendChild(box);

  const start = __teamPage * TEAM_PAGE_SIZE;
  const slice = __teamList.slice(start, start + TEAM_PAGE_SIZE);
  const body = box.querySelector("#tvBody");

  body.innerHTML = slice.map(emp => `
    <tr data-email="${emp.email}" data-name="${emp.name}" data-role="${emp.role||''}" data-phone="${emp.phone||''}">
      <td><b>${emp.name}</b></td>
      <td class="tv-hours">—</td>
      <td><button class="open-btn" onclick="openEmployeePanel(this)">Open</button></td>
    </tr>`).join("");

  box.querySelector("#tvPrev").onclick = () => { __teamPage--; renderTeamViewPage(); };
  box.querySelector("#tvNext").onclick = () => { __teamPage++; renderTeamViewPage(); };

  slice.forEach(async emp => {
    try {
      const r = await fetch(`${CONFIG.BASE_URL}?action=getSmartSchedule&email=${encodeURIComponent(emp.email)}`);
      const d = await r.json();
      const tr = body.querySelector(`tr[data-email="${CSS.escape(emp.email)}"]`);
      if (tr) tr.querySelector(".tv-hours").textContent = (d && d.ok) ? (d.total ?? 0) : "0";
    } catch(e){}
  });
}

function closeTeamView() {
  const w = document.getElementById("directoryWrapper");
  if (w) { w.classList.add("fade-out"); setTimeout(()=>w.remove(),200); }
}

/* ============================================================
   🧩 EMPLOYEE PANEL (Modal)
   ============================================================ */
async function openEmployeePanel(btnEl) {
  const tr = btnEl.closest("tr");
  const email = tr.dataset.email, name = tr.dataset.name, role = tr.dataset.role, phone = tr.dataset.phone;

  const modalId = `emp-${email.replace(/[@.]/g,'_')}`;
  if (document.getElementById(modalId)) return;

  let data;
  try {
    const res = await fetch(`${CONFIG.BASE_URL}?action=getSmartSchedule&email=${encodeURIComponent(email)}`);
    data = await res.json();
    if (!data.ok) throw new Error("No schedule");
  } catch {
    alert("No schedule found for this employee."); return;
  }

  const m = document.createElement("div");
  m.className = "employee-modal emp-panel fade-in"; m.id = modalId;
  m.innerHTML = buildEmployeePanelHTML({name, role, phone, data});
  document.body.appendChild(m);
  startLiveTimerForModal(modalId, data);
  m.querySelector(".emp-close").onclick = () => closeEmployeePanel(m);
  m.querySelector(".emp-refresh").onclick = () => refreshEmployeePanel(m);
}

function buildEmployeePanelHTML({name, role, phone, data}) {
  const rows = (data.days||[]).map(d => `
    <tr><td>${d.name}</td><td>${d.shift||'-'}</td><td>${d.hours||0}</td></tr>`).join("");
  return `
    <div class="emp-header">
      <button class="emp-close">×</button>
      <h3>${name}</h3>
      ${phone ? `<p class="emp-phone">📞 <a href="tel:${phone}">${phone}</a></p>` : ""}
      <p class="emp-role">${role||""}</p>
    </div>
    <table class="schedule-mini">
      <tr><th>Day</th><th>Shift</th><th>Hours</th></tr>${rows}
    </table>
    <p class="total">Total Hours: <b>${data.total||0}</b></p>
    <p class="live-hours"></p>
    <div class="modal-footer"><button class="emp-refresh">⚙️ Check for Updates</button></div>`;
}

function closeEmployeePanel(m) { m.classList.add("fade-out"); setTimeout(()=>m.remove(),200); }

async function refreshEmployeePanel(m) {
  const btn = m.querySelector(".emp-refresh");
  btn.innerHTML = "⏳ Updating...";
  try {
    const name = m.querySelector(".emp-header h3").textContent;
    const email = __teamList.find(e => e.name === name)?.email;
    if (!email) throw new Error("Missing email");
    const res = await fetch(`${CONFIG.BASE_URL}?action=getSmartSchedule&email=${encodeURIComponent(email)}`);
    const data = await res.json();
    if (!data.ok) throw new Error();
    m.querySelector(".schedule-mini").innerHTML = `
      <tr><th>Day</th><th>Shift</th><th>Hours</th></tr>
      ${data.days.map(d=>`<tr><td>${d.name}</td><td>${d.shift||'-'}</td><td>${d.hours||0}</td></tr>`).join("")}`;
    m.querySelector(".total b").textContent = data.total || 0;
  } catch {
    alert("❌ Error updating schedule");
  } finally {
    btn.innerHTML = "⚙️ Check for Updates";
  }
}

/* ============================================================
   ⏱️ LIVE TIMER FOR MODALS
   ============================================================ */
function startLiveTimerForModal(modalId, sched) {
  const modal = document.getElementById(modalId);
  if (!modal || !sched?.days) return;
  const todayName = new Date().toLocaleString("en-US", { weekday: "long" });
  const today = sched.days.find(d => (d.name||"").toLowerCase() === todayName.toLowerCase());
  if (!today || !today.shift || /off/i.test(today.shift)) return;
  const [startStr] = today.shift.split("-");
  const start = parseShiftTime(startStr);
  const totEl = modal.querySelector(".total b");
  const liveEl = modal.querySelector(".live-hours");
  const base = Number(totEl?.textContent || 0);
  const update = () => {
    const diff = Math.max(0, (Date.now() - start) / 36e5);
    const live = diff.toFixed(2);
    totEl.textContent = (base + Number(live)).toFixed(2);
    liveEl.innerHTML = `Live shift: <b>${live}</b> h ⏱️`;
  };
  update();
  const iv = setInterval(()=> {
    if (!document.body.contains(modal)) return clearInterval(iv);
    update();
  }, 60000);
}

function parseShiftTime(str) {
  const s = str.trim().toLowerCase().replace('.',':');
  const mer = s.match(/(am|pm)$/);
  const time = s.replace(/\s?(am|pm)$/,'');
  let [h,m] = time.split(':').map(Number);
  if (isNaN(h)) return null;
  if (isNaN(m)) m=0;
  if (mer && mer[1]==='pm' && h!==12) h+=12;
  if (mer && mer[1]==='am' && h===12) h=0;
  const d=new Date(); d.setHours(h,m,0,0); return d;
}
