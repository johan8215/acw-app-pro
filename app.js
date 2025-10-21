/*********************************************************
 *  ALLSTON CAR WASH – ACW-App (v4.0 Red Glass Edition)
 *  Author: Johan A. Giraldo (JAG) & Sky (AI Assistant)
 *********************************************************/

const LANG = navigator.language.startsWith("es") ? "es" : "en";
const TXT = {
  en: {
    welcome: "Welcome,",
    settings: "Settings",
    change: "Change Password",
    logout: "Log Out",
    save: "Save",
    sendMsg: "Send Message",
    saveChanges: "Save Changes",
    close: "Close",
    typeMsg: "Type your message here…",
    shift: "Shift:"
  },
  es: {
    welcome: "Bienvenido,",
    settings: "Configuraciones",
    change: "Cambiar Contraseña",
    logout: "Cerrar Sesión",
    save: "Guardar",
    sendMsg: "Enviar Mensaje",
    saveChanges: "Guardar Cambios",
    close: "Cerrar",
    typeMsg: "Escribe tu mensaje aquí…",
    shift: "Horario:"
  }
}[LANG];

/* ===========================================================
   LOGIN + SCHEDULE
   =========================================================== */
async function loginUser() {
  const email = document.getElementById("email").value.trim().toLowerCase();
  const password = document.getElementById("password").value.trim();
  if (!email || !password) return alert("Please enter your email and password");

  try {
    const url = `${CONFIG.BASE_URL}?action=login&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.ok) {
      document.getElementById("login").style.display = "none";
      document.getElementById("welcome").style.display = "block";
      const displayName = data.name && data.name.trim() !== "" 
  ? data.name 
  : email.split("@")[0].toUpperCase();
document.getElementById("userName").textContent = displayName;
      document.getElementById("userRole").textContent = data.role;
      localStorage.setItem("acw_email", email);
      await getSchedule(email);

      // Mostrar panel manager si aplica
      if (["manager", "supervisor", "owner"].includes(data.role.toLowerCase())) {
        const teamDemo = [
          { name: "Wendy", shift: "7:30 - 3", hours: 7.5, phone: "16172543210" },
          { name: "Carlos", shift: "8:00 - 4", hours: 8, phone: "16175551234" },
          { name: "Luis", shift: "OFF", hours: 0, phone: "16174443322" },
        ];
        showManagerPanel(teamDemo);
      }

    } else {
      alert("Invalid credentials");
    }
  } catch (err) {
    console.error("❌ Login error:", err);
    alert("🚨 Connection error");
  }
}

/* ===========================================================
   📅 HORARIO CON CRONÓMETRO
   =========================================================== */
async function getSchedule(email) {
  try {
    const url = `${CONFIG.BASE_URL}?action=getSchedule&email=${encodeURIComponent(email)}`;
    const res = await fetch(url);
    const data = await res.json();

    if (!data.ok) {
      document.getElementById("schedule").innerHTML = `<p style="color:red;">No schedule found.</p>`;
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
        <tbody id="scheduleBody">`;

    window.activeShifts = [];

    for (const d of days) {
      const shift = (d.shift || "").trim();
      let hoursDisplay = d.hours || "";
      let rowStyle = /off/i.test(shift)
        ? "style='color:#888;'"
        : "style='color:#eaf1ff; font-weight:500;'";

      if (/^\d{1,2}[:.]?\d{0,2}\.?$/.test(shift)) {
        const startTime = shift.replace(/\./g, "").trim();
        window.activeShifts.push({ day: d.name, startTime });
        hoursDisplay = `<span class='activeTimer' data-time='${startTime}'>${calcActiveHours(startTime).toFixed(1)}h</span>`;
      } else if (/^\d{1,2}[:.]?\d{0,2}\s*[-–]\s*\d{1,2}/.test(shift)) {
        const parts = shift.split("-");
        const start = parts[0].replace(/\./g, "").trim();
        const end = parts[1].trim();
        const fixed = calcFixedHours(start, end);
        hoursDisplay = `${fixed.toFixed(1)}h`;
      }

      html += `<tr ${rowStyle}><td>${d.name}</td><td>${shift || "—"}</td><td>${hoursDisplay || "—"}</td></tr>`;
    }

    html += `</tbody></table><p class="total">Total Hours: <b>${data.total}</b></p>`;
    document.getElementById("schedule").innerHTML = html;

    updateTimers();
    setInterval(updateTimers, 60000);
  } catch (err) {
    console.error("❌ Error loading schedule:", err);
  }
}

/* ===========================================================
   CÁLCULOS HORARIOS
   =========================================================== */
function calcActiveHours(startTime) {
  const now = new Date();
  const [h, m = 0] = startTime.split(":").map(Number);
  const start = new Date();
  start.setHours(h);
  start.setMinutes(m);
  let diff = (now - start) / 3600000;
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
function updateTimers() {
  const timers = document.querySelectorAll(".activeTimer");
  timers.forEach(el => {
    const h = calcActiveHours(el.dataset.time);
    el.textContent = `${h.toFixed(1)}h`;
  });
}

/* ===========================================================
   EMPLOYEE MODAL (solo managers)
   =========================================================== */
let currentEmp = null;
function openEmployee(emp) {
  currentEmp = emp;
  const modal = document.getElementById("employeeModal");
  modal.style.display = "block";
  document.getElementById("empName").textContent = emp.name;
  document.getElementById("empShift").value = emp.shift || "";
  document.getElementById("empMessage").placeholder = TXT.typeMsg;
  document.getElementById("shiftLabel").textContent = TXT.shift;
  document.getElementById("sendMsgBtn").textContent = TXT.sendMsg;
  document.getElementById("saveShiftBtn").textContent = TXT.close;
}
function closeEmployeeModal() {
  document.getElementById("employeeModal").style.display = "none";
}
async function sendEmpMessage() {
  if (!currentEmp) return;
  const msg = document.getElementById("empMessage").value.trim();
  if (!msg) return alert("Please write a message first.");
  const phone = currentEmp.phone;
  const api = `https://api.callmebot.com/whatsapp.php?phone=${phone}&text=${encodeURIComponent(msg)}&apikey=${CONFIG.API_KEY}`;
  await fetch(api);
  alert("Message sent successfully!");
}

/* ===========================================================
   PANEL MANAGER
   =========================================================== */
function showManagerPanel(list) {
  if (!list.length) return;
  let html = `<div class='week-header'><h3>Team Schedule Overview</h3></div>
  <table class='schedule-table'>
  <thead><tr><th>Name</th><th>Shift</th><th>Hours</th><th></th></tr></thead><tbody>`;
  list.forEach(emp => {
    html += `<tr><td>${emp.name}</td><td>${emp.shift}</td><td>${emp.hours}</td>
      <td><button onclick='openEmployee(${JSON.stringify(emp)})'>Open</button></td></tr>`;
  });
  html += "</tbody></table>";
  document.getElementById("schedule").insertAdjacentHTML("beforeend", "<br><br>" + html);
}

/* ===========================================================
   LOGOUT
   =========================================================== */
function logoutUser() {
  localStorage.removeItem("acw_email");
  location.reload();
}

/* ===========================================================
   AUTO-LOGIN
   =========================================================== */
window.addEventListener("load", async () => {
  const savedEmail = localStorage.getItem("acw_email");
  if (!savedEmail) return;

  try {
    document.getElementById("login").style.display = "none";
    document.getElementById("welcome").style.display = "block";
    await getSchedule(savedEmail);

    const res = await fetch(`${CONFIG.BASE_URL}?action=getUser&email=${encodeURIComponent(savedEmail)}`);
    const data = await res.json();

    if (data.ok) {
      const displayName = data.name && data.name.trim() !== "" 
  ? data.name 
  : savedEmail.split("@")[0].toUpperCase();
document.getElementById("userName").textContent = displayName;
      document.getElementById("userRole").textContent = data.role;

      if (["manager", "supervisor", "owner"].includes((data.role || "").toLowerCase().trim())) {
        const teamList = data.team && data.team.length ? data.team : [
          { name: "Wendy", shift: "7:30 - 3", hours: 7.5, phone: "16172543210" },
          { name: "Carlos", shift: "8:00 - 4", hours: 8, phone: "16175551234" },
          { name: "Luis", shift: "OFF", hours: 0, phone: "16174443322" },
        ];
        showManagerPanel(teamList);
      }
    } else {
      document.getElementById("userName").textContent = savedEmail;
      document.getElementById("userRole").textContent = "Manager";
    }
  } catch (err) {
    console.error("Auto-login error:", err);
  }
});

/* ===========================================================
   SETTINGS CONTROL
   =========================================================== */
function openSettings() {
  document.getElementById("settingsModal").style.display = "block";
}
function closeSettings() {
  document.getElementById("settingsModal").style.display = "none";
}
function togglePasswordPanel() {
  const p = document.getElementById("passwordPanel");
  p.style.display = p.style.display === "none" ? "block" : "none";
}
