/*********************************************************
 *  ALLSTON CAR WASH – ACW-App (v3.8 Connected Stable)
 *  Author: Johan A. Giraldo (JAG) & Sky (AI Assistant)
 *  Date: October 2025
 *********************************************************/

/* ===========================================================
   🔐 LOGIN (email + password)
   =========================================================== */
async function loginUser() {
  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value.trim();

  if (!email || !password) {
    alert("Please enter your email and password");
    return;
  }

  try {
    const url = `${CONFIG.BASE_URL}?action=login&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
    console.log("🔗 Logging in:", url);

    const res = await fetch(url);
    const data = await res.json();
    console.log("✅ Login response:", data);

    if (data.ok) {
      document.getElementById("login").style.display = "none";
      document.getElementById("welcome").style.display = "block";
      document.getElementById("userName").textContent = data.name;
      document.getElementById("userRole").textContent = data.role;
      localStorage.setItem("acw_email", email);
      getSchedule(email);
    } else {
      alert("Invalid credentials");
    }
  } catch (err) {
    alert("🚨 Connection error");
    console.error("❌ Login error:", err);
  }
}

/* ===========================================================
   📅 OBTENER HORARIO DEL EMPLEADO (con cronómetro ⏱️ mejorado)
   =========================================================== */
async function getSchedule(email) {
  try {
    const url = `${CONFIG.BASE_URL}?action=getSchedule&email=${encodeURIComponent(email)}`;
    console.log("📡 Fetching schedule from:", url);

    const res = await fetch(url);
    const data = await res.json();
    console.log("📦 Schedule data:", data);

    if (!data.ok) {
      document.getElementById("schedule").innerHTML =
        `<p style="color:red;">No schedule found for this account.</p>`;
      return;
    }

    const name = data.name || "Employee";
    const week = data.week || "N/A";
    const days = data.days || [];

    let html = `
      <div class="week-header">
        <h3>Week of ${week}</h3>
        <p><b>${name}</b></p>
      </div>
      <table class="schedule-table">
        <thead><tr><th>Day</th><th>Shift</th><th>Hours</th></tr></thead>
        <tbody id="scheduleBody">
    `;

    window.activeShifts = [];

    for (const d of days) {
      const shift = (d.shift || "").trim();
      let hoursDisplay = d.hours || "";
      let rowStyle = /off/i.test(shift)
        ? "style='color:#888;'"
        : "style='color:#eaf1ff; font-weight:500;'";

      // 🟢 Modo 1: turno activo “7:30.”
      if (/^\d{1,2}[:.]?\d{0,2}\.?$/.test(shift)) {
        const startTime = shift.replace(/\./g, "").trim();
        window.activeShifts.push({ day: d.name, startTime });
        hoursDisplay = `<span class='activeTimer' data-time='${startTime}'>⏱️ ${calcActiveHours(startTime).toFixed(1)}h</span>`;
      }
      // 🟣 Modo 2: turno cerrado “7:30. - 5” (detiene reloj y calcula fijo)
      else if (/^\d{1,2}[:.]?\d{0,2}\s*[-–]\s*\d{1,2}/.test(shift)) {
        const parts = shift.split("-");
        const start = parts[0].replace(/\./g, "").trim();
        const end = parts[1].trim();
        const fixed = calcFixedHours(start, end);
        hoursDisplay = `${fixed.toFixed(1)}h`;
      }

      html += `<tr ${rowStyle}>
        <td>${d.name}</td>
        <td>${shift || "—"}</td>
        <td>${hoursDisplay || "—"}</td>
      </tr>`;
    }

    html += `
        </tbody>
      </table>
      <p id="totalHours" class="total">🕓 Total Hours: <b>${data.total}</b></p>
    `;

    document.getElementById("schedule").innerHTML = html;
    updateTimers(); // primera actualización inmediata
    setInterval(updateTimers, 60000); // refresca cada minuto

  } catch (err) {
    console.error("❌ Error loading schedule:", err);
    document.getElementById("schedule").innerHTML =
      `<p style="color:red;">Error connecting to server.</p>`;
  }
}

/* ===========================================================
   ⏱️ CALCULO DE HORAS (activo / fijo)
   =========================================================== */
function calcActiveHours(startTime) {
  const now = new Date();
  const [h, m = 0] = startTime.split(":").map(Number);
  const start = new Date();
  start.setHours(h);
  start.setMinutes(m);
  let diff = (now - start) / (1000 * 60 * 60);
  if (diff < 0) diff += 12;
  return diff > 0 ? Math.round(diff * 10) / 10 : 0;
}

function calcFixedHours(a, b) {
  const parse = s => {
    s = s.replace(/\./g, ":").trim();
    const [h, m = 0] = s.split(":").map(Number);
    return h + m / 60;
  };
  let diff = parse(b) - parse(a);
  if (diff < 0) diff += 12;
  return Math.round(diff * 10) / 10;
}

/* ===========================================================
   ⏱️ ACTUALIZADOR DE CRONÓMETROS + TOTAL
   =========================================================== */
function updateTimers() {
  const now = new Date();
  const timers = document.querySelectorAll(".activeTimer");
  let dynamicTotal = 0;

  timers.forEach(el => {
    const startStr = el.dataset.time;
    if (!startStr) return;
    const h = calcActiveHours(startStr);
    dynamicTotal += h;
    el.textContent = `⏱️ ${h.toFixed(1)}h`;
  });

  // 🧮 Recalcula el total semanal sumando los valores dinámicos
  const fixedCells = document.querySelectorAll("#scheduleBody td:nth-child(3):not(.activeTimer)");
  fixedCells.forEach(cell => {
    const val = parseFloat(cell.textContent);
    if (!isNaN(val)) dynamicTotal += val;
  });

  const totalEl = document.getElementById("totalHours");
  if (totalEl) totalEl.innerHTML = `🕓 Total Hours: <b>${dynamicTotal.toFixed(1)}</b>`;
}

/* ===========================================================
   ⚙️ CAMBIO DE CONTRASEÑA
   =========================================================== */
async function changeUserPassword() {
  const email = document.getElementById("email")?.value || localStorage.getItem("acw_email");
  const newPass = document.getElementById("newPassword").value.trim();
  const confirm = document.getElementById("confirmPassword").value.trim();
  const msg = document.getElementById("settingsMsg");

  if (!newPass || !confirm) {
    msg.textContent = "⚠️ Please fill out both fields.";
    msg.style.color = "#ffcc00";
    return;
  }

  if (newPass !== confirm) {
    msg.textContent = "❌ Passwords do not match.";
    msg.style.color = "#ff6666";
    return;
  }

  msg.textContent = "⏳ Updating password...";
  msg.style.color = "#bcd4ff";

  try {
    const response = await fetch(`${CONFIG.BASE_URL}?action=changePassword&email=${encodeURIComponent(email)}&new=${encodeURIComponent(newPass)}`, { method: "GET" });
    const data = await response.json();
    console.log("🔄 Password change response:", data);

    if (data.ok || data.success) {
      msg.textContent = "✅ Password updated successfully!";
      msg.style.color = "#7CFC00";
      document.getElementById("newPassword").value = "";
      document.getElementById("confirmPassword").value = "";
      setTimeout(() => { msg.textContent = ""; }, 3000);
    } else {
      msg.textContent = "⚠️ Failed to update. Try again.";
      msg.style.color = "#ff6666";
    }

  } catch (err) {
    msg.textContent = "🚨 Connection error. Try again later.";
    msg.style.color = "#ff6666";
    console.error("❌ Error:", err);
  }
}

/* ===========================================================
   🚪 LOGOUT USER (cierra sesión limpia)
   =========================================================== */
function logoutUser() {
  localStorage.removeItem("acw_email");
  location.reload();
}

/* ===========================================================
   🔁 AUTO-LOGIN (mantiene la sesión activa)
   =========================================================== */
window.addEventListener("load", () => {
  const savedEmail = localStorage.getItem("acw_email");
  if (savedEmail) {
    document.getElementById("login").style.display = "none";
    document.getElementById("welcome").style.display = "block";
    getSchedule(savedEmail);
  }
});
/* ===========================================================
   ⚙️ SETTINGS MODAL CONTROL
   =========================================================== */
function openSettings() {
  const modal = document.getElementById("settingsModal");
  if (modal) modal.style.display = "block";
}

function closeSettings() {
  const modal = document.getElementById("settingsModal");
  if (modal) modal.style.display = "none";
}

function togglePasswordPanel() {
  const panel = document.getElementById("passwordPanel");
  if (!panel) return;
  panel.style.display = (panel.style.display === "none" || panel.style.display === "")
    ? "block"
    : "none";
}

/* ===========================================================
   🚪 LOGOUT (ubicado dentro del modal)
   =========================================================== */
function logoutUser() {
  localStorage.removeItem("acw_email");
  document.getElementById("settingsModal").style.display = "none";
  document.getElementById("welcome").style.display = "none";
  document.getElementById("login").style.display = "block";
}
