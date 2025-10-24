/* ============================================================
   🎨 ACW-App v5.4.7 — Blue Glass White Edition (Unified Stable)
   Johan A. Giraldo | JAG15 | Allston Car Wash © 2025
   ============================================================ */

let currentUser = null;

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
   (ÚNICA definición; sin duplicados)
   ============================================================ */
async function showWelcome(name, role) {
  document.getElementById("login").style.display = "none";
  document.getElementById("welcome").style.display = "block";
  document.getElementById("welcomeName").innerHTML = `<b>${name}</b>`;
  document.getElementById("welcomeRole").textContent = role;

  if (["manager", "supervisor"].includes((role || "").toLowerCase())) {
    addTeamButton();
  }

  // Render teléfono desde directorio
  try {
    const res = await fetch(`${CONFIG.BASE_URL}?action=getEmployeesDirectory`);
    const data = await res.json();
    if (data.ok && data.directory) {
      const match = data.directory.find(e =>
        e.email?.toLowerCase() === (currentUser?.email || "").toLowerCase()
      );
      if (match?.phone) {
        setTimeout(() => {
          document.querySelector(".user-phone")?.remove();
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
   📅 LOAD SCHEDULE — with Auto Live Timer + Safe Total
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

    // Tabla principal
    let html = `
      <table id="mainSchedule">
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
    html += `</table>
      <p class="total">⚪ Total Hours: <b id="mainTotal">${(Number(data.total)||0).toFixed(1)}</b></p>
    `;

    schedDiv.innerHTML = html;

    // Observador para evitar que el total desaparezca
    const totalEl = document.getElementById("mainTotal");
    if (totalEl) {
      const fixedVal = totalEl.textContent;
      const obs = new MutationObserver(() => {
        if (totalEl.textContent.trim() === "") totalEl.textContent = fixedVal;
      });
      obs.observe(totalEl, { childList: true, characterData: true, subtree: true });
    }

    // Iniciar live timer e inyectar horas vivas en la celda del día
    setTimeout(() => {
      if (data.ok && data.days) {
        startLiveTimer(data.days, Number(data.total || 0));
        const tableEl = document.getElementById("mainSchedule");
        if (tableEl) injectLiveHoursInTable(data.days, tableEl);
      }
    }, 600);

  } catch (err) {
    console.error("Error loading schedule:", err);
    schedDiv.innerHTML = `<p style="color:#c00;">Error loading schedule. Please try again later.</p>`;
  }
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
   ⏱️ Live Shift + 🟢 Online Badge
   ============================================================ */
function startLiveTimer(days, total) {
  try {
    const todayKey = new Date().toLocaleString("en-US", { weekday: "short" }).slice(0,3).toLowerCase();
    const today = days.find(d => d.name.slice(0,3).toLowerCase() === todayKey);
    if (!today || !today.shift || /off/i.test(today.shift)) {
      removeOnlineBadge();
      safeUpdateTotal(total, false);
      return;
    }

    const shift = today.shift.trim();
    removeOnlineBadge();

    // Turno activo: "7:30."
    if (shift.endsWith(".")) {
      addOnlineBadge();
      const startStr = shift.replace(".", "").trim();
      const startTime = parseTime(startStr);

      const update = () => {
        const now = new Date();
        const diffHrs = Math.max(0, (now - startTime) / 36e5);
        safeUpdateTotal(total + diffHrs, true);
        showLiveHours(diffHrs, true);
      };

      update();
      clearInterval(window.liveInterval);
      window.liveInterval = setInterval(update, 60000);
      return;
    }

    // Turno cerrado: "7:30 - 6"
    const parts = shift.split("-");
    if (parts.length === 2) {
      const startTime = parseTime(parts[0].trim());
      const endTime   = parseTime(parts[1].trim());
      const diffHrs   = Math.max(0, (endTime - startTime) / 36e5);
      showLiveHours(diffHrs, false);
      safeUpdateTotal(total, false);
      removeOnlineBadge();
    }
  } catch (err) {
    console.warn("⏱️ Live shift inactive:", err);
  }
}

/* ============================================================
   💡 LIVE HOURS + TOTAL (seguros)
   ============================================================ */
function showLiveHours(hours, active = true) {
  let el = document.querySelector(".live-hours");
  if (!el) {
    el = document.createElement("p");
    el.className = "live-hours";
    el.style.fontSize = "1.1em";
    el.style.marginTop = "6px";
    el.style.textShadow = "0 0 10px rgba(0,120,255,0.4)";
    document.querySelector("#schedule")?.appendChild(el);
  }
  el.innerHTML = active ? `⏱️ <b style="color:#33a0ff">${hours.toFixed(1)}h</b>` : "";
}

// Wrapper seguro para evitar parpadeos o vacíos
function safeUpdateTotal(value, active) {
  if (isNaN(value)) return;
  const totalEl = document.getElementById("mainTotal");
  if (!totalEl) return;
  const prev = parseFloat(totalEl.textContent || "0");
  if (Math.abs(prev - value) < 0.01 && totalEl.textContent.trim() !== "") return;

  totalEl.textContent = value.toFixed(1);
  const p = totalEl.closest(".total");
  if (p) {
    const color = active ? "#33a0ff" : "#ffffff";
    p.innerHTML = `<span style="color:${color}">⚪ Total Hours: <b id="mainTotal">${value.toFixed(1)}</b></span>`;
  }
}

function updateTotalDisplay(value, active = false) {
  // compat antigua
  safeUpdateTotal(value, active);
}

/* ============================================================
   🟢 ONLINE BADGE (arriba del nombre)
   ============================================================ */
function addOnlineBadge() {
  const nameEl = document.getElementById("welcomeName");
  if (!nameEl || document.getElementById("onlineBadge")) return;

  const badge = document.createElement("span");
  badge.id = "onlineBadge";
  badge.textContent = "🟢 Working";
  badge.style.display = "block";
  badge.style.fontWeight = "600";
  badge.style.color = "#33ff66";
  badge.style.textShadow = "0 0 10px rgba(51,255,102,0.5)";
  badge.style.marginBottom = "6px";

  nameEl.parentNode.insertBefore(badge, nameEl);
}
function removeOnlineBadge() {
  document.getElementById("onlineBadge")?.remove();
}

/* ============================================================
   🕓 Parsear hora AM/PM o 24h
   ============================================================ */
function parseTime(str) {
  const clean = String(str).replace(/[^\d:apm ]/gi, "").trim();
  const parts = clean.split(" ");
  const time = parts[0] || "";
  const meridian = (parts[1] || "").toLowerCase();
  let [h, m] = time.split(":").map(n => parseInt(n || "0", 10));
  if (isNaN(h)) h = 0;
  if (isNaN(m)) m = 0;
  if (meridian === "pm" && h !== 12) h += 12;
  if (meridian === "am" && h === 12) h = 0;
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

/* ============================================================
   ⏱️ Live Hours en celda del día (tabla principal o modal)
   ============================================================ */
function injectLiveHoursInTable(days, tableEl) {
  try {
    const todayKey = new Date().toLocaleString("en-US", { weekday: "short" }).slice(0,3).toLowerCase();
    const today = days.find(d => d.name.slice(0,3).toLowerCase() === todayKey);
    if (!today || !today.shift || /off/i.test(today.shift)) return;

    const row = Array.from(tableEl.querySelectorAll("tr")).find(
      r => r.cells?.[0]?.textContent.slice(0,3).toLowerCase() === todayKey
    );
    if (!row) return;
    const cellHours = row.cells[2];
    const shift = today.shift.trim();

    if (shift.endsWith(".")) {
      const startTime = parseTime(shift.replace(".", "").trim());
      const update = () => {
        const now = new Date();
        const diffHrs = Math.max(0, (now - startTime) / 36e5);
        cellHours.innerHTML = `⏱️ ${diffHrs.toFixed(1)}h`;
        cellHours.style.color = "#33a0ff";
        cellHours.style.fontWeight = "600";
      };
      update();
      clearInterval(tableEl._cellTimer);
      tableEl._cellTimer = setInterval(update, 60000);
    }
  } catch (err) {
    console.warn("Live hours in table inactive:", err);
  }
}

/* ============================================================
   👥 TEAM VIEW — Paged + Employee Panels
   ============================================================ */
const TEAM_PAGE_SIZE = 8;
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
  } catch (e) { console.warn(e); }
}

function renderTeamViewPage() {
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

  box.querySelector("#tvPrev").onclick = () => { __teamPage=Math.max(0,__teamPage-1); renderTeamViewPage(); };
  box.querySelector("#tvNext").onclick = () => { __teamPage=Math.min(Math.ceil(__teamList.length/TEAM_PAGE_SIZE)-1,__teamPage+1); renderTeamViewPage(); };

  slice.forEach(async emp => {
    try {
      const r = await fetch(`${CONFIG.BASE_URL}?action=getSmartSchedule&email=${encodeURIComponent(emp.email)}`);
      const d = await r.json();
      const tr = body.querySelector(`tr[data-email="${CSS.escape(emp.email)}"]`);
      if (!tr) return;
      tr.querySelector(".tv-hours").textContent = (d && d.ok) ? (Number(d.total||0)).toFixed(1) : "0.0";
    } catch(e){}
  });

  // Primer render: estado en vivo
  updateTeamViewLiveStatus();
}

/* ============================================================
   🟢 Team View Live Badges — Online + Working
   ============================================================ */
async function updateTeamViewLiveStatus() {
  try {
    const rows = document.querySelectorAll(".tv-table tr[data-email]");
    if (!rows.length) return;

    for (const row of rows) {
      const email = row.dataset.email;
      const hoursCell = row.querySelector(".tv-hours");

      const res = await fetch(`${CONFIG.BASE_URL}?action=getSmartSchedule&email=${encodeURIComponent(email)}`);
      const data = await res.json();
      if (!data.ok || !data.days) continue;

      const todayKey = new Date().toLocaleString("en-US", { weekday: "short" }).slice(0,3).toLowerCase();
      const today = data.days.find(d => d.name.slice(0,3).toLowerCase() === todayKey);
      if (!today || !today.shift) continue;

      const shift = today.shift.trim();

      if (shift.endsWith(".")) {
        const startStr = shift.replace(".", "").trim();
        const startTime = parseTime(startStr);
        const now = new Date();
        const diffHrs = Math.max(0, (now - startTime) / 36e5);
        hoursCell.innerHTML = `🟢 ${diffHrs.toFixed(1)}h`;
        hoursCell.style.color = "#33ff66";
        hoursCell.style.fontWeight = "600";
        hoursCell.classList.add("glow");
      } else if (shift.includes("-")) {
        hoursCell.textContent = (Number(data.total||0)).toFixed(1);
        hoursCell.style.color = "#ffffff";
        hoursCell.style.fontWeight = "500";
        hoursCell.classList.remove("glow");
      } else {
        hoursCell.textContent = (Number(data.total||0)).toFixed(1);
        hoursCell.style.color = "#aaa";
        hoursCell.style.fontWeight = "400";
        hoursCell.classList.remove("glow");
      }
    }
  } catch (err) {
    console.warn("TeamView live badge error:", err);
  }
}
// Auto-refresh Team View en vivo
setInterval(updateTeamViewLiveStatus, 120000);

/* ============================================================
   🧩 Employee Modal — Full Rebuild + Live
   ============================================================ */
async function openEmployeePanel(btnEl) {
  const tr = btnEl.closest("tr");
  const email = tr.dataset.email;
  const name = tr.dataset.name;
  const role = tr.dataset.role || "";
  const phone = tr.dataset.phone || "";

  const modalId = `emp-${email.replace(/[@.]/g, "_")}`;
  if (document.getElementById(modalId)) return;

  let data = null;
  try {
    const res = await fetch(`${CONFIG.BASE_URL}?action=getSmartSchedule&email=${encodeURIComponent(email)}`);
    data = await res.json();
    if (!data.ok) throw new Error("No schedule");
  } catch (e) {
    alert("No schedule found for this employee.");
    return;
  }

  const m = document.createElement("div");
  m.className = "employee-modal emp-panel";
  m.id = modalId;
  m.innerHTML = `
    <div class="emp-box">
      <button class="emp-close">×</button>
      <div class="emp-header">
        <h3>${name}</h3>
        ${phone ? `<p class="emp-phone"><a href="tel:${phone}">${phone}</a></p>` : ""}
        <p class="emp-role">${role}</p>
      </div>
      <table class="schedule-mini">
        <tr><th>Day</th><th>Shift</th><th>Hours</th></tr>
        ${data.days.map(d => `
          <tr data-day="${d.name.slice(0,3)}" data-shift="${d.shift}">
            <td>${d.name}</td>
            <td>${d.shift || "-"}</td>
            <td>${d.hours || 0}</td>
          </tr>`).join("")}
      </table>
      <p class="total">⚪ Total Hours: <b>${(Number(data.total)||0).toFixed(1)}</b></p>
      <p class="live-hours"></p>
      <button class="emp-refresh">⚙️ Check for Updates</button>
    </div>
  `;
  document.body.appendChild(m);

  requestAnimationFrame(() => m.classList.add("in"));

  m.querySelector(".emp-close").onclick = () => {
    clearInterval(m._liveTimer);
    m.remove();
  };
  m.querySelector(".emp-refresh").onclick = () => checkForUpdatesInModal(m);

  // Live en tabla del modal y badge Working si aplica
  enableModalLiveShift(m, data.days);
}

/* ============================================================
   ⏱️ Employee Modal Live Tracker (Working + Live Hours)
   ============================================================ */
function enableModalLiveShift(modal, days) {
  try {
    const todayKey = new Date().toLocaleString("en-US", { weekday: "short" }).slice(0,3).toLowerCase();
    const today = days.find(d => d.name.slice(0,3).toLowerCase() === todayKey);
    if (!today || !today.shift || /off/i.test(today.shift)) return;

    const table = modal.querySelector(".schedule-mini");
    const row = Array.from(table.querySelectorAll("tr")).find(
      r => r.cells?.[0]?.textContent.slice(0,3).toLowerCase() === todayKey
    );
    if (!row) return;
    const cellHours = row.cells[2];
    const shift = today.shift.trim();

    if (shift.endsWith(".")) {
      // badge
      if (!modal.querySelector(".emp-working")) {
        const header = modal.querySelector(".emp-header h3");
        const badge = document.createElement("span");
        badge.className = "emp-working";
        badge.textContent = "🟢 Working";
        badge.style.display = "block";
        badge.style.fontWeight = "600";
        badge.style.color = "#33ff66";
        badge.style.textShadow = "0 0 10px rgba(51,255,102,0.5)";
        badge.style.marginBottom = "4px";
        header.parentNode.insertBefore(badge, header);
      }

      const startTime = parseTime(shift.replace(".", "").trim());
      const update = () => {
        const now = new Date();
        const diffHrs = Math.max(0, (now - startTime) / 36e5);
        cellHours.innerHTML = `⏱️ ${diffHrs.toFixed(1)}h`;
        cellHours.style.color = "#33a0ff";
        cellHours.style.fontWeight = "600";
      };
      update();
      clearInterval(modal._liveTimer);
      modal._liveTimer = setInterval(update, 60000);

    } else if (shift.includes("-")) {
      const [s, e] = shift.split("-").map(s => s.trim());
      const startTime = parseTime(s);
      const endTime   = parseTime(e);
      const diffHrs   = Math.max(0, (endTime - startTime) / 36e5);
      cellHours.innerHTML = `${diffHrs.toFixed(1)}h`;
      cellHours.style.color = "#999";
      cellHours.style.fontWeight = "500";
      modal.querySelector(".emp-working")?.remove();
      clearInterval(modal._liveTimer);
    }
  } catch (err) {
    console.warn("Modal live tracker inactive:", err);
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
   🔄 Refresh en modal (no molesta a nadie)
   ============================================================ */
function checkForUpdatesInModal(modalEl){
  try{
    if ("caches" in window) caches.keys().then(keys=>keys.forEach(k=>caches.delete(k)));
  }catch(e){}
  modalEl.classList.add("flash");
  setTimeout(()=>window.location.reload(true), 900);
}

function closeTeamView() {
  document.getElementById("directoryWrapper")?.remove();
}
