/* ============================================================
   🧠 ACW-App v4.7.2 — Blue Glass White Edition
   Johan A. Giraldo (JAG15) & Sky — Oct 2025
   ============================================================ */

let currentUser = null;
let scheduleData = null;

/* 🔐 LOGIN */
async function loginUser() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const diag = document.getElementById("diag");
  const btn = document.querySelector("#login button");

  if (!email || !password) {
    diag.textContent = "Please enter your email and password.";
    return;
  }

  /* ============================================================
   👋 SHOW WELCOME DASHBOARD — with phone from Employees sheet
   ============================================================ */
function showWelcome(name, role) {
  // Oculta login y muestra dashboard
  document.getElementById("login").style.display = "none";
  document.getElementById("welcome").style.display = "block";

  // Asigna el nombre y rol
  document.getElementById("welcomeName").innerHTML = `<b>${name}</b>`;
  document.getElementById("welcomeRole").textContent = role;

  // 📞 Mostrar teléfono dinámico desde currentUser
  const schedDiv = document.getElementById("schedule");
  const phone = currentUser?.phone || "(no phone)";
  const phoneHTML = `<p class="user-phone">📞 ${phone}</p>`;

  // Evita duplicados si se recarga
  const existing = document.querySelector(".user-phone");
  if (existing) existing.remove();

  schedDiv.insertAdjacentHTML("beforebegin", phoneHTML);

  // Solo managers o supervisores ven el botón "Team View"
  if (role === "manager" || role === "supervisor") {
    addTeamButton();
  }
}

/* ============================================================
   🔐 LOGIN FUNCTION (completa y corregida)
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

    const res = await fetch(`${CONFIG.BASE_URL}?action=login&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`);
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

/* Restore session on reload */
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
   📅 LOAD SCHEDULE — Blue Glass White Edition
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

    // 🧮 Build the schedule table dynamically
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

  } catch (err) {
    console.error("Error loading schedule:", err);
    schedDiv.innerHTML = `<p style="color:#c00;">Error loading schedule. Please try again later.</p>`;
  }
}

/* 🧩 TEAM VIEW BUTTON */
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
  if (wrapper) return wrapper.remove();
  loadEmployeeDirectory();
}

async function loadEmployeeDirectory() {
  const res = await fetch(`${CONFIG.BASE_URL}?action=getEmployeesDirectory`);
  const data = await res.json();
  if (!data.ok) return;
  renderDirectory(data.directory);
}

function renderDirectory(list) {
  const box = document.createElement("div");
  box.id = "directoryWrapper";
  box.className = "directory-wrapper";
  box.innerHTML = `
    <h3>Team View</h3>
    <table class="directory-table">
      <tr><th>Name</th><th>Role</th><th>Email</th><th>Phone</th></tr>
      ${list.map(emp => `
        <tr>
          <td>${emp.name}</td>
          <td>${emp.role}</td>
          <td>${emp.email}</td>
          <td>${emp.phone || ""}</td>
        </tr>`).join("")}
    </table>`;
  document.body.appendChild(box);
}

/* 🔓 LOGOUT */
function logoutUser() {
  localStorage.removeItem("acwUser");
  location.reload();
}
