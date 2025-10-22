/* ============================================================
   🧠 ACW-App v4.7.4 — Blue Glass White Edition (Stable Clean Build)
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

  // Solo managers o supervisores ven el botón "Team View"
  if (["manager", "supervisor"].includes(role.toLowerCase())) addTeamButton();

  // 🔍 Buscar teléfono desde Employees list
  try {
    const res = await fetch(`${CONFIG.BASE_URL}?action=getEmployeesDirectory`);
    const data = await res.json();

    if (data.ok && data.directory) {
      const match = data.directory.find(e =>
        e.email?.toLowerCase() === (currentUser?.email || "").toLowerCase()
      );

      if (match && match.phone) {
        setTimeout(() => {
          const existing = document.querySelector(".user-phone");
          if (existing) existing.remove();

          // Teléfono clickeable con efecto azul
          const phoneHTML = `<p class="user-phone">📞 <a href="tel:${match.phone}" style="color:#0078ff;text-decoration:none;font-weight:600;">${match.phone}</a></p>`;
          const nameEl = document.getElementById("welcomeName");
          if (nameEl) nameEl.insertAdjacentHTML("afterend", phoneHTML);
        }, 300);
      }
    }
  } catch (err) {
    console.warn("Could not load phone number:", err);
  }
}

/* ============================================================
   📅 LOAD SCHEDULE — with Auto Live Timer (v4.7.5)
   ============================================================ */
async function loadSchedule(email) {
  const schedDiv = document.getElementById("schedule");
  schedDiv.innerHTML = `<p style="color:#007bff;font-weight:500;">Loading your shift...</p>`;

  try {
    const res = await fetch(`${CONFIG.BASE_URL}?action=getSmartSchedule&email=${encodeURIComponent(email)}`);
    const data = await res.json();

    if (!data.ok || !data.days) {
      schedDiv.innerHTML = `<p style="color:#c00;">No schedule found for this week.</p>`;
      return;
    }

    // 🧾 Construir la tabla principal
    let html = `
      <table>
        <tr><th>Day</th><th>Shift</th><th>Hours</th></tr>
    `;

    data.days.forEach(d => {
      const isToday = new Date()
        .toLocaleString("en-US", { weekday: "short" })
        .toLowerCase()
        .includes(d.name.slice(0, 3).toLowerCase());

      html += `
        <tr class="${isToday ? "today" : ""}">
          <td>${d.name}</td>
          <td>${d.shift || "-"}</td>
          <td>${d.hours || "0"}</td>
        </tr>`;
    });

    html += `
      </table>
      <p class="total">Total Hours: <b>${data.total || 0}</b></p>
    `;

    schedDiv.innerHTML = html;

    // ⏱️ Activar cronómetro 1 segundo después de mostrar la tabla
    setTimeout(() => {
      if (data.ok && data.days) {
        startLiveTimer(data.days, Number(data.total || 0));
      }
    }, 1000);

  } catch (err) {
    console.error("Error loading schedule:", err);
    schedDiv.innerHTML = `<p style="color:#c00;">Error loading schedule. Please try again later.</p>`;
  }
}

/* ============================================================
   ⚙️ SETTINGS + REFRESH
   ============================================================ */
function openSettings() {
  document.getElementById("settingsModal").style.display = "block";
}
function closeSettings() {
  document.getElementById("settingsModal").style.display = "none";
}
function refreshApp() {
  closeSettings?.();
  if ("caches" in window) caches.keys().then(names => names.forEach(n => caches.delete(n)));
  const btn = document.querySelector(".settings-section button:first-child");
  if (btn) {
    btn.innerHTML = "⏳ Updating...";
    btn.style.opacity = "0.7";
  }
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
   ⏱️ LIVE HOURS — Blue Glass White Edition (Stable)
   ============================================================ */
function startLiveTimer(days, total) {
  try {
    const todayName = new Date().toLocaleString("en-US", { weekday: "long" });
    const today = days.find(d => d.name.toLowerCase() === todayName.toLowerCase());
    if (!today || !today.shift || today.shift.includes("OFF")) return;

    const [startStr, endStr] = today.shift.split("-");
    if (!startStr || !endStr) return;

    const startTime = parseTime(startStr);
    const now = new Date();

    const diffHrs = (now - startTime) / (1000 * 60 * 60);
    let liveHrs = Math.max(0, diffHrs.toFixed(2));

    updateTotalDisplay(total + Number(liveHrs));
    showLiveHours(liveHrs);

    setInterval(() => {
      const now2 = new Date();
      const diff2 = (now2 - startTime) / (1000 * 60 * 60);
      liveHrs = Math.max(0, diff2.toFixed(2));
      updateTotalDisplay(total + Number(liveHrs));
      showLiveHours(liveHrs);
    }, 60000);
  } catch (err) {
    console.warn("⏱️ Live hours not active:", err);
  }
}

function showLiveHours(hours) {
  let liveEl = document.querySelector(".live-hours");
  if (!liveEl) {
    liveEl = document.createElement("p");
    liveEl.className = "live-hours";
    liveEl.style.fontSize = "1.2em";
    liveEl.style.color = "#0070ff";
    liveEl.style.marginTop = "6px";
    liveEl.style.textShadow = "0 0 10px rgba(0,120,255,0.4)";
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
  const d = new Date();
  d.setHours(h, m || 0, 0, 0);
  return d;
}

function updateTotalDisplay(value) {
  const totalEl = document.querySelector(".total");
  if (totalEl)
    totalEl.innerHTML = `Total Hours: <b>${value.toFixed(2)}</b> ⏱️`;
}

/* ============================================================
   👋 SHOW WELCOME DASHBOARD — with delayed phone render
   ============================================================ */
async function showWelcome(name, role) {
  document.getElementById("login").style.display = "none";
  document.getElementById("welcome").style.display = "block";
  document.getElementById("welcomeName").innerHTML = `<b>${name}</b>`;
  document.getElementById("welcomeRole").textContent = role;

  // Solo managers o supervisores ven el botón "Team View"
  if (role === "manager" || role === "supervisor") addTeamButton();

  // 🔍 Buscar teléfono desde Employees list
  try {
    const res = await fetch(`${CONFIG.BASE_URL}?action=getEmployeesDirectory`);
    const data = await res.json();

    if (data.ok && data.directory) {
      const match = data.directory.find(e =>
        e.email?.toLowerCase() === (currentUser?.email || "").toLowerCase()
      );

      if (match && match.phone) {
        setTimeout(() => {
          const existing = document.querySelector(".user-phone");
          if (existing) existing.remove();

          // clickable + glow azul
          const phoneHTML = `<p class="user-phone">📞 <a href="tel:${match.phone}" style="color:#0078ff;text-decoration:none;font-weight:600;">${match.phone}</a></p>`;
          const nameEl = document.getElementById("welcomeName");
          if (nameEl) nameEl.insertAdjacentHTML("afterend", phoneHTML);
        }, 300);
      }
    }
  } catch (err) {
    console.warn("Could not load phone number:", err);
  }
}

/* ============================================================
   👥 TEAM VIEW — Paged + Employee Panels (safe drop-in)
   ============================================================ */

const TEAM_PAGE_SIZE = 8;       // empleados por página
let __teamList = [];
let __teamPage = 0;

function addTeamButton() {
  if (document.getElementById("teamBtn")) return;
  const btn = document.createElement("button");
  btn.id = "teamBtn";
  btn.className = "team-btn";
  btn.textContent = "Team View";
  btn.onclick = toggleTeamOverview;
  document.body.appendChild(btn);
}

function toggleTeamOverview() {
  const wrapper = document.getElementById("directoryWrapper");
  if (wrapper) { wrapper.remove(); return; }
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
  // contenedor principal
  document.getElementById("directoryWrapper")?.remove();

  const box = document.createElement("div");
  box.id = "directoryWrapper";
  box.className = "directory-wrapper tv-wrapper";
  box.innerHTML = `
    <div class="tv-head">
      <h3>Team View</h3>
      <button class="tv-close" onclick="document.getElementById('directoryWrapper').remove()">✖️</button>
    </div>

    <div class="tv-pager">
      <button class="tv-nav" id="tvPrev" ${__teamPage===0?'disabled':''}>‹ Prev</button>
      <span class="tv-index">Page ${__teamPage+1} / ${Math.max(1, Math.ceil(__teamList.length/TEAM_PAGE_SIZE))}</span>
      <button class="tv-nav" id="tvNext" ${(__teamPage+1)>=Math.ceil(__teamList.length/TEAM_PAGE_SIZE)?'disabled':''}>Next ›</button>
    </div>

    <table class="directory-table tv-table">
      <tr><th>Name</th><th>Hours</th><th></th></tr>
      <tbody id="tvBody"></tbody>
    </table>
  `;
  document.body.appendChild(box);

  // página actual
  const start = __teamPage * TEAM_PAGE_SIZE;
  const slice = __teamList.slice(start, start + TEAM_PAGE_SIZE);
  const body = box.querySelector("#tvBody");

  body.innerHTML = slice.map(emp => `
    <tr data-email="${emp.email}" data-name="${emp.name}" data-role="${emp.role||''}" data-phone="${emp.phone||''}">
      <td><b>${emp.name}</b></td>
      <td class="tv-hours">—</td>
      <td><button class="open-btn" onclick="openEmployeePanel(this)">Open</button></td>
    </tr>
  `).join("");

  // navegación
  box.querySelector("#tvPrev").onclick = () => { __teamPage=Math.max(0,__teamPage-1); renderTeamViewPage(); };
  box.querySelector("#tvNext").onclick = () => { __teamPage=Math.min(Math.ceil(__teamList.length/TEAM_PAGE_SIZE)-1,__teamPage+1); renderTeamViewPage(); };

  // hidratar horas de la página (ligero, asincrónico)
  slice.forEach(async emp => {
    try {
      const r = await fetch(`${CONFIG.BASE_URL}?action=getSmartSchedule&email=${encodeURIComponent(emp.email)}`);
      const d = await r.json();
      const tr = body.querySelector(`tr[data-email="${CSS.escape(emp.email)}"]`);
      if (!tr) return;
      tr.querySelector(".tv-hours").textContent = (d && d.ok) ? (d.total ?? 0) : "0";
    } catch(e){}
  });
}

/* ============================================================
   🔍 Employee Panel — misma dimensión y estilo que tu tarjeta
   ============================================================ */
async function openEmployeePanel(btnEl) {
  const tr = btnEl.closest("tr");
  const email = tr.dataset.email;
  const name  = tr.dataset.name;
  const role  = tr.dataset.role || "";
  const phone = tr.dataset.phone || "";

  const modalId = `emp-${email.replace(/[@.]/g,'_')}`;
  if (document.getElementById(modalId)) return;

  // fetch horario
  let data = null;
  try {
    const res = await fetch(`${CONFIG.BASE_URL}?action=getSmartSchedule&email=${encodeURIComponent(email)}`);
    data = await res.json();
    if (!data.ok) throw new Error("No schedule");
  } catch(e) {
    alert("No schedule found for this employee.");
    return;
  }

  // modal
  const m = document.createElement("div");
  m.className = "employee-modal emp-panel";
  m.id = modalId;
  m.innerHTML = buildEmployeePanelHTML({name, role, phone, data});
  document.body.appendChild(m);

  // animación
  requestAnimationFrame(()=>{ m.classList.add("in"); });

  // ⏱️ cronómetro vivo dentro del modal
  startLiveTimerForModal(modalId, data);

  // acciones
  m.querySelector(".emp-close").onclick = () => m.remove();
  m.querySelector(".emp-refresh").onclick = () => checkForUpdatesInModal(m);
}

function buildEmployeePanelHTML({name, role, phone, data}) {
  const rows = (data.days||[]).map(d => `
    <tr>
      <td>${d.name}</td>
      <td>${d.shift || '-'}</td>
      <td>${d.hours || 0}</td>
    </tr>`).join("");

  return `
    <div class="emp-header">
      <button class="emp-close">×</button>
      <h3>${name}</h3>
      ${phone ? `<p class="emp-phone">📞 <a href="tel:${phone}">${phone}</a></p>` : ``}
      <p class="emp-role">${role || ""}</p>
    </div>

    <table class="schedule-mini">
      <tr><th>Day</th><th>Shift</th><th>Hours</th></tr>
      ${rows}
    </table>

    <p class="total">Total Hours: <b id="tot-${name.replace(/\s+/g,'_')}">${data.total || 0}</b></p>
    <p class="live-hours" id="lh-${name.replace(/\s+/g,'_')}"></p>

    <div class="modal-footer">
      <button class="emp-refresh">⚙️ Check for Updates</button>
    </div>
  `;
}

/* ============================================================
   ⏱️ Live timer por-modal (no toca tu tablero principal)
   ============================================================ */
function startLiveTimerForModal(modalId, sched) {
  const modal = document.getElementById(modalId);
  if (!modal || !sched?.days) return;

  const todayName = new Date().toLocaleString("en-US", { weekday: "long" });
  const today = sched.days.find(d => (d.name||"").toLowerCase() === todayName.toLowerCase());
  if (!today || !today.shift || /off/i.test(today.shift)) return;

  const parts = (today.shift||"").split("-");
  if (parts.length < 1) return;

  const start = parseShiftTime(parts[0]);
  if (!start) return;

  const totEl = modal.querySelector(".total b");
  const liveEl = modal.querySelector(".live-hours");
  const base = Number(totEl?.textContent || 0);

  const update = () => {
    const diff = Math.max(0, (Date.now() - start.getTime()) / 36e5);
    const live = Math.round(diff*100)/100;
    if (totEl) totEl.textContent = (base + live).toFixed(2);
    if (liveEl) liveEl.innerHTML = `Live shift: <b>${live.toFixed(2)}</b> h ⏱️`;
  };

  update();
  const iv = setInterval(()=>{
    if (!document.body.contains(modal)) return clearInterval(iv);
    update();
  }, 60000);
}

function parseShiftTime(raw) {
  // admite "7:30", "7:30 am", "7.30", "7"
  const s = raw.trim().toLowerCase().replace('.',':');
  const mMer = s.match(/(am|pm)$/);
  const time = s.replace(/\s?(am|pm)$/,'');
  let [h, m] = time.split(':').map(n=>parseInt(n,10));
  if (isNaN(h)) return null;
  if (isNaN(m)) m = 0;
  if (mMer && mMer[1]==='pm' && h!==12) h+=12;
  if (mMer && mMer[1]==='am' && h===12) h=0;
  const d = new Date(); d.setHours(h,m,0,0); return d;
}

/* ============================================================
   🔄 Refresh en modal (no molesta a nadie)
   ============================================================ */
function checkForUpdatesInModal(modalEl){
  try{
    if ("caches" in window) caches.keys().then(keys=>keys.forEach(k=>caches.delete(k)));
  }catch(e){}
  modalEl.classList.add("flash");
  setTimeout(()=>window.location.reload(true), 900);
}


/* ============================================================
   🧩 TEAM VIEW 2.0 — Interactive Employee View (v4.8)
   ============================================================ */
function renderDirectory(list) {
  const box = document.createElement("div");
  box.id = "directoryWrapper";
  box.className = "directory-wrapper";
  box.innerHTML = `
    <span class="directory-close" onclick="closeTeamView()">✖️</span>
    <h3>Team View</h3>
    <div class="employee-grid">
      ${list
        .map(
          (emp) => `
        <div class="employee-card">
          <h4>${emp.name}</h4>
          <p class="hours">Hours: <b>${emp.totalHours || "0"}</b></p>
          <button class="open-btn" onclick="openEmployeeView('${emp.email}')">Open</button>
        </div>`
        )
        .join("")}
    </div>`;
  document.body.appendChild(box);
}

/* 🔹 Modal flotante individual */
async function openEmployeeView(email) {
  try {
    const res = await fetch(`${CONFIG.BASE_URL}?action=getSmartSchedule&email=${encodeURIComponent(email)}`);
    const data = await res.json();

    if (!data.ok || !data.days) {
      alert("No schedule found for this employee.");
      return;
    }

    const modal = document.createElement("div");
    modal.className = "employee-modal";
    modal.innerHTML = `
      <div class="employee-modal-content">
        <span class="modal-close" onclick="this.closest('.employee-modal').remove()">✖️</span>
        <h3>${data.name || "Employee"}</h3>
        <button class="refresh-mini" onclick="reloadEmployeeView('${email}', this)">⚙️ Check for Updates</button>
        <table>
          <tr><th>Day</th><th>Shift</th><th>Hours</th></tr>
          ${data.days
            .map(
              (d) => `
            <tr>
              <td>${d.name}</td>
              <td>${d.shift || "-"}</td>
              <td>${d.hours || "0"}</td>
            </tr>`
            )
            .join("")}
        </table>
        <p class="total">Total Hours: <b>${data.total || 0}</b></p>
      </div>`;
    document.body.appendChild(modal);
  } catch (err) {
    console.error("Error opening employee view:", err);
  }
}

/* 🔁 Recarga el horario dentro del modal */
async function reloadEmployeeView(email, btn) {
  btn.innerHTML = "⏳ Updating...";
  try {
    const res = await fetch(`${CONFIG.BASE_URL}?action=getSmartSchedule&email=${encodeURIComponent(email)}`);
    const data = await res.json();

    if (!data.ok) throw new Error("No schedule found");

    const modal = btn.closest(".employee-modal-content");
    const table = modal.querySelector("table");
    const total = modal.querySelector(".total");

    table.innerHTML = `
      <tr><th>Day</th><th>Shift</th><th>Hours</th></tr>
      ${data.days
        .map(
          (d) => `
        <tr>
          <td>${d.name}</td>
          <td>${d.shift || "-"}</td>
          <td>${d.hours || "0"}</td>
        </tr>`
        )
        .join("")}
    `;
    total.innerHTML = `Total Hours: <b>${data.total || 0}</b>`;
  } catch (err) {
    alert("❌ Error updating schedule");
  } finally {
    btn.innerHTML = "⚙️ Check for Updates";
  }
}

function closeTeamView() {
  document.getElementById("directoryWrapper")?.remove();
}
