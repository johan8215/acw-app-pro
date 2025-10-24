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
   ⏱️ ACW-App v5.3.6 — Live Shift + 🟢 Online Badge (Stable)
   Johan A. Giraldo | Allston Car Wash © 2025
   ============================================================ */
function startLiveTimer(days, total) {
  try {
    // Buscar el día actual
    const todayName = new Date().toLocaleString("en-US", { weekday: "short" }).slice(0,3).toLowerCase();
   const today = days.find(d => d.name.slice(0,3).toLowerCase() === todayName);
     console.log("🧭 Hoy detectado:", todayName, today);
    if (!today || !today.shift || /off/i.test(today.shift)) return;

    const shift = today.shift.trim();

    // El badge 🟢 solo aparece si el turno está activo (7:30.)
    removeOnlineBadge();

    if (shift.endsWith(".")) {
      addOnlineBadge();

      const startStr = shift.replace(".", "").trim();
      const startTime = parseTime(startStr);

      const update = () => {
        const now = new Date();
        const diffHrs = Math.max(0, (now - startTime) / 36e5);
        updateTotalDisplay(total + diffHrs, true);
        showLiveHours(diffHrs, true);
      };

      update();
      clearInterval(window.liveInterval);
      window.liveInterval = setInterval(update, 60000);
      return;
    }

    // Turno cerrado ("7:30 - 6") → sin cronómetro ni badge
    const parts = shift.split("-");
    if (parts.length < 2) return;

    const startStr = parts[0].trim();
    const endStr = parts[1].trim();
    if (!startStr || !endStr) return;

    const startTime = parseTime(startStr);
    const endTime = parseTime(endStr);
    const diffHrs = Math.max(0, (endTime - startTime) / 36e5);

    updateTotalDisplay(total, false);
    showLiveHours(diffHrs, false);
    removeOnlineBadge();
     // Mostrar también ⏱️ dentro de la tabla principal (o modal)
const tableEl = document.querySelector("#schedule table") || document.querySelector(".schedule-mini");
if (tableEl) injectLiveHoursInTable(days, tableEl);
  } catch (err) {
    console.warn("⏱️ Live shift inactive:", err);
  }
}

/* ============================================================
   💡 LIVE HOURS + TOTAL
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

  if (!active) {
    el.textContent = "";
    return;
  }

  el.innerHTML = `⏱️ <b style="color:#33a0ff">${hours.toFixed(1)}h</b>`;
}

function updateTotalDisplay(value, active = false) {
  const totalEl = document.querySelector(".total");
  if (!totalEl) return;

  // Verificar si el valor es válido
  if (isNaN(value) || value === null || value === undefined) {
    console.warn("⚠️ Invalid total value, keeping previous total.");
    return; // No actualizar si el valor no es válido
  }

  const current = totalEl.innerText.match(/[\d.]+/);
  const currentVal = current ? parseFloat(current[0]) : 0;

  // Solo actualizar si cambia realmente o si el texto está vacío
  if (Math.abs(currentVal - value) > 0.01 || totalEl.textContent.trim() === "") {
    const color = active ? "#33a0ff" : "#ffffff";
    totalEl.innerHTML = `<span style="color:${color}">⚪ Total Hours: <b>${value.toFixed(1)}</b></span>`;
  }
}

/* ============================================================
   🟢 ONLINE BADGE (arriba del nombre)
   ============================================================ */
function addOnlineBadge() {
  const nameEl = document.getElementById("welcomeName");
  if (!nameEl || document.getElementById("onlineBadge")) return;

  const badge = document.createElement("span");
  badge.id = "onlineBadge";
  badge.textContent = "🟢 Online";
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
  const clean = str.replace(/[^\d:apm]/gi, "").trim();
  const [time, meridian] = clean.split(" ");
  let [h, m] = (time || "").split(":").map(Number);
  if (meridian?.toLowerCase() === "pm" && h !== 12) h += 12;
  if (meridian?.toLowerCase() === "am" && h === 12) h = 0;
  const d = new Date();
  d.setHours(h, m || 0, 0, 0);
  return d;
}

/* ============================================================
   ⏱️ ACW-App v5.4.5 — Live Hours Visible in Table (Fixed)
   Johan A. Giraldo | Allston Car Wash © 2025
   ============================================================ */
function injectLiveHoursInTable(days, tableEl) {
  try {
    const todayName = new Date()
      .toLocaleString("en-US", { weekday: "short" })
      .slice(0, 3)
      .toLowerCase();
    const today = days.find(
      d => d.name.slice(0, 3).toLowerCase() === todayName
    );
    if (!today || !today.shift || /off/i.test(today.shift)) return;

    const shift = today.shift.trim();
    const allRows = Array.from(tableEl.querySelectorAll("tr"));
    const row = allRows.find(
      r =>
        r.cells[0]?.textContent.slice(0, 3).toLowerCase() === todayName
    );
    if (!row) return;

    const cellHours = row.cells[2];

    // Turno activo ("7:30.")
    if (shift.endsWith(".")) {
      const startStr = shift.replace(".", "").trim();
      const startTime = parseTime(startStr);

      const update = () => {
        const now = new Date();
        const diffHrs = Math.max(0, (now - startTime) / 36e5);
        cellHours.innerHTML = `⏱️ ${diffHrs.toFixed(1)}h`;
        cellHours.style.color = "#33a0ff";
        cellHours.style.fontWeight = "600";
      };

      update();
      clearInterval(window.cellTimer);
      window.cellTimer = setInterval(update, 60000);
    }
  } catch (err) {
    console.warn("Live hours in table inactive:", err);
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

      const todayName = new Date()
        .toLocaleString("en-US", { weekday: "short" })
        .slice(0, 3)
        .toLowerCase();
      const today = data.days.find(
        d => d.name.slice(0, 3).toLowerCase() === todayName
      );
      if (!today || !today.shift) continue;

      const shift = today.shift.trim();

      // Turno activo (ej. "7:30.")
      if (shift.endsWith(".")) {
        const startStr = shift.replace(".", "").trim();
        const startTime = parseTime(startStr);
        const now = new Date();
        const diffHrs = Math.max(0, (now - startTime) / 36e5);
        hoursCell.innerHTML = `🟢 ${diffHrs.toFixed(1)}h`;
        hoursCell.style.color = "#33ff66";
        hoursCell.style.fontWeight = "600";
        hoursCell.style.textShadow = "0 0 10px rgba(51,255,102,0.6)";
      } 
      // Turno completado o cerrado
      else if (shift.includes("-")) {
        hoursCell.textContent = (data.total ?? 0).toFixed(1);
        hoursCell.style.color = "#ffffff";
        hoursCell.style.fontWeight = "500";
      } 
      // Día libre u otro caso
      else {
        hoursCell.textContent = (data.total ?? 0).toFixed(1);
        hoursCell.style.color = "#aaa";
        hoursCell.style.fontWeight = "400";
      }
    }
  } catch (err) {
    console.warn("TeamView live badge error:", err);
  }
}

// 🔄 Actualiza cada 2 minutos automáticamente
setInterval(updateTeamViewLiveStatus, 120000);

/* ============================================================
   🧩 Employee Modal — Full Rebuild (v4.9.4 Stable Clone)
   + ⏱️ Live Shift Integration (v2.3 Instant Total)
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
    const res = await fetch(
      `${CONFIG.BASE_URL}?action=getSmartSchedule&email=${encodeURIComponent(email)}`
    );
    data = await res.json();
    if (!data.ok) throw new Error("No schedule");
  } catch (e) {
    alert("No schedule found for this employee.");
    return;
  }

  // === Crear modal estructurado ===
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
        ${data.days
          .map(
            (d) => `
          <tr data-day="${d.name.slice(0,3)}" data-shift="${d.shift}">
            <td>${d.name}</td>
            <td>${d.shift || "-"}</td>
            <td>${d.hours || 0}</td>
          </tr>`
          )
          .join("")}
      </table>
      <p class="total">Total Hours: <b id="tot-${name.replace(/\s+/g, "_")}">${data.total || 0}</b></p>
      <p class="live-hours" id="lh-${name.replace(/\s+/g, "_")}"></p>
      <button class="emp-refresh">⚙️ Check for Updates</button>
    </div>
  `;
  document.body.appendChild(m);

   /* === LIVE FIX: prevent total hours from disappearing === */
setTimeout(() => {
  const totalEl = m.querySelector(".total b");
  if (totalEl && totalEl.textContent.trim() === "") {
    totalEl.textContent = data.total || 0;
  }
}, 800);

/* Forzar persistencia visual del total */
const totalEl = m.querySelector(".total b");
if (totalEl) {
  const totalValue = totalEl.textContent;
  const observer = new MutationObserver(() => {
    if (totalEl.textContent.trim() === "") totalEl.textContent = totalValue;
  });
  observer.observe(totalEl, { childList: true, characterData: true, subtree: true });
}

  requestAnimationFrame(() => m.classList.add("in"));

  // Eventos
  m.querySelector(".emp-close").onclick = () => m.remove();
  m.querySelector(".emp-refresh").onclick = () => checkForUpdatesInModal(m);

  /* === Detectar si el empleado tiene un shift activo hoy === */
  const today = new Date();
  const currentDay = today.toLocaleString("en-US", { weekday: "short" }); // "Mon", "Tue", etc.
  const rowToday = m.querySelector(`tr[data-day^="${currentDay}"]`);
  if (rowToday) {
    const shift = rowToday.dataset.shift || rowToday.cells[1]?.textContent || "";
    const [startStr, endStr] = shift.split("-").map(s => s.trim());
    if (startStr && endStr)
      startLiveShift(m, startStr, endStr, m.querySelector(".total"));

       /* === Mostrar 🟢 Working si tiene turno activo === */
  if (rowToday && rowToday.dataset.shift && rowToday.dataset.shift.endsWith(".")) {
    const header = m.querySelector(".emp-header h3");
    if (header && !m.querySelector(".emp-working")) {
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
  }
     // === Activar monitoreo en vivo dentro del modal ===
enableModalLiveShift(m, data.days);
  }
}

/* ============================================================
   ⏱️ Employee Modal Live Tracker (Working + Live Hours)
   v5.4.2 — Prevent overwriting total (Stable)
   ============================================================ */
function enableModalLiveShift(modal, days) {
  try {
    const todayName = new Date()
      .toLocaleString("en-US", { weekday: "short" })
      .slice(0, 3)
      .toLowerCase();

    const today = days.find(
      d => d.name.slice(0, 3).toLowerCase() === todayName
    );
    if (!today || !today.shift || /off/i.test(today.shift)) return;

    const shift = today.shift.trim();
    const table = modal.querySelector(".schedule-mini");
    const row = Array.from(table.querySelectorAll("tr")).find(
      r => r.cells[0]?.textContent.slice(0, 3).toLowerCase() === todayName
    );
    if (!row) return;
    const cellHours = row.cells[2];

    // 🔒 evita que otro proceso borre el contenido
    cellHours.dataset.locked = "true";

    // Turno activo (ej. "7:30.")
    if (shift.endsWith(".")) {
      const startStr = shift.replace(".", "").trim();
      const startTime = parseTime(startStr);

      const update = () => {
        const now = new Date();
        const diffHrs = Math.max(0, (now - startTime) / 36e5);
        cellHours.innerHTML = `⏱️ ${diffHrs.toFixed(1)}h`;
        cellHours.style.color = "#33a0ff";
        cellHours.style.fontWeight = "600";

        // Mostrar 🟢 Working si aún no existe
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
      };

      update();
      clearInterval(modal.liveTimer);
      modal.liveTimer = setInterval(update, 60000);
    } 
    // 🔚 Turno cerrado → mostrar horas totales y quitar "Working"
    else {
      const parts = shift.split("-");
      if (parts.length === 2) {
        const startStr = parts[0].trim();
        const endStr = parts[1].trim();
        const startTime = parseTime(startStr);
        const endTime = parseTime(endStr);
        const diffHrs = Math.max(0, (endTime - startTime) / 36e5);
        cellHours.innerHTML = `${diffHrs.toFixed(1)}h`;
        cellHours.style.color = "#999";
        cellHours.style.fontWeight = "500";
      }

      // Eliminar 🟢 Working si existía
      const badge = modal.querySelector(".emp-working");
      if (badge) badge.remove();
    }

    // ✅ Refuerzo: si otra función intenta limpiar la celda, la restauramos
    const observer = new MutationObserver(() => {
      if (cellHours.dataset.locked === "true" && cellHours.textContent.trim() === "") {
        cellHours.textContent = cellHours.dataset.lastValue || cellHours.textContent;
      } else {
        cellHours.dataset.lastValue = cellHours.textContent;
      }
    });
    observer.observe(cellHours, { childList: true, characterData: true, subtree: true });

  } catch (err) {
    console.warn("Modal live tracker inactive:", err);
  }
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
