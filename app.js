/* ============================================================
   🧠 ACW-App v4.7.3 — Blue Glass White Edition
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

/* ============================================================
   👋 SHOW WELCOME DASHBOARD — (fetch phone from Employees)
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
        const existing = document.querySelector(".user-phone");
        if (existing) existing.remove();
        const phoneHTML = `<p class="user-phone">📞 ${match.phone}</p>`;
        const schedDiv = document.getElementById("schedule");
        schedDiv.insertAdjacentHTML("beforebegin", phoneHTML);
      }
    }
  } catch (err) {
    console.warn("Could not load phone number:", err);
  }
}

/* ============================================================
   📅 LOAD SCHEDULE
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

/* ============================================================
   👥 TEAM VIEW
   ============================================================ */
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

/* ============================================================
   ⚙️ SETTINGS + REFRESH
   ============================================================ */
function openSettings() {
  document.getElementById("settingsModal").style.display = "block";
}

function closeSettings() {
  document.getElementById("settingsModal").style.display = "none";
}

/* 🔄 Check for Updates */
function refreshApp() {
  closeSettings?.();
  if ("caches" in window) {
    caches.keys().then(names => {
      for (let name of names) caches.delete(name);
    });
  }
  const btn = document.querySelector(".settings-section button:first-child");
  if (btn) {
    btn.innerHTML = "⏳ Updating...";
    btn.style.opacity = "0.7";
  }
  setTimeout(() => {
    window.location.reload(true);
  }, 1200);
}

/* 🚪 Logout limpia sesión y refresca app */
function logoutUser() {
  localStorage.removeItem("acwUser");
  closeSettings();
  setTimeout(() => {
    window.location.reload(true);
  }, 600);
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
