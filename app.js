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

/* ===== Team View (paginado) ===== */
.tv-wrapper { max-width: 860px; }
.tv-head { display:flex; align-items:center; justify-content:center; position:relative; }
.tv-head h3 { margin:0; font-size:22px; color:#c00; text-shadow:0 0 8px rgba(0,136,255,.35); }
.tv-close {
  position:absolute; right:8px; top:0; border:none; background:transparent;
  font-size:22px; color:#0078ff; cursor:pointer;
}
.tv-close:hover { color:#e60000; transform:scale(1.1); }

.tv-pager { display:flex; align-items:center; justify-content:center; gap:12px; margin:10px 0 6px; }
.tv-nav {
  background:#fff; color:#0078ff; border:1px solid rgba(0,120,255,.3);
  padding:6px 10px; border-radius:8px; cursor:pointer;
  box-shadow:0 4px 16px rgba(0,120,255,.25);
}
.tv-nav[disabled]{ opacity:.4; cursor:not-allowed; }
.tv-index { color:#555; font-weight:600; }

.tv-table th { color:#0078ff; border-bottom:2px solid rgba(0,120,255,.2); }
.tv-table td { padding:10px 6px; }

.open-btn {
  background:#e60000; color:#fff; border:none; border-radius:6px; padding:6px 12px; cursor:pointer;
}
.open-btn:hover { background:#ff3333; }

/* ===== Employee Panel (igual tamaño a tu tarjeta) ===== */
.employee-modal.emp-panel {
  position: fixed; top: 50%; left: 50%; transform: translate(-50%, -46%) scale(.98);
  width: 420px; max-width: 90vw; background: rgba(255,255,255,.97);
  border-radius: 14px; padding: 20px; box-shadow: 0 0 45px rgba(0,128,255,.35); z-index: 10000;
  opacity: 0; transition: all .25s ease;
}
.employee-modal.emp-panel.in { opacity: 1; transform: translate(-50%, -50%) scale(1); }

.emp-header { text-align:center; position:relative; }
.emp-close {
  position:absolute; right:8px; top:0; border:none; background:transparent; font-size:22px; color:#777; cursor:pointer;
}
.emp-close:hover { color:#000; }
.emp-phone a { color:#0078ff; text-decoration:none; font-weight:600; }
.emp-phone a:hover { text-decoration:underline; }

.modal-footer { text-align:center; margin-top:12px; }
.emp-refresh {
  background:#fff; color:#0078ff; border:1px solid rgba(0,120,255,.3); border-radius:8px;
  padding:8px 12px; cursor:pointer; box-shadow:0 4px 16px rgba(0,120,255,.25);
}
.emp-refresh:hover { background:#f7fbff; }

.employee-modal .schedule-mini { width:100%; border-collapse:collapse; margin-top:10px; }
.employee-modal .schedule-mini th { background:#f5f7fb; color:#111; padding:6px; }
.employee-modal .schedule-mini td { border-bottom:1px solid #e9eef6; padding:6px; }
