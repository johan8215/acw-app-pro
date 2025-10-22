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
   ⏱️ LIVE HOURS INDICATOR — Dynamic total updater
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
  if (totalEl) totalEl.innerHTML = `Total Hours: <b>${value.toFixed(2)}</b>`;
}
function showLiveHours(hours) {
  let liveEl = document.querySelector(".live-hours");
  if (!liveEl) {
    liveEl = document.createElement("p");
    liveEl.className = "live-hours";
    document.querySelector("#schedule")?.appendChild(liveEl);
  }
  const color = hours > 9 ? "#e60000" : "#0070ff";
  liveEl.innerHTML = `Live shift: <b style="color:${color}">${hours}</b> h ⏱️`;
}
const originalLoadSchedule = loadSchedule;
loadSchedule = async function (email) {
  await originalLoadSchedule(email);
  try {
    const res = await fetch(`${CONFIG.BASE_URL}?action=getSmartSchedule&email=${encodeURIComponent(email)}`);
    const data = await res.json();
    if (data.ok && data.days) startLiveTimer(data.days, Number(data.total || 0));
  } catch (e) {
    console.warn("Live timer skipped:", e);
  }
};

/* ============================================================
   🧩 TEAM VIEW ENHANCED — with Close button (modern)
   ============================================================ */
function renderDirectory(list) {
  const box = document.createElement("div");
  box.id = "directoryWrapper";
  box.className = "directory-wrapper";
  box.innerHTML = `
    <span class="directory-close" onclick="closeTeamView()">✖️</span>
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
function closeTeamView() {
  document.getElementById("directoryWrapper")?.remove();
}
