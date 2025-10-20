console.log("🧠 ACW Blue Glass 4.6.9 Fix Loaded");

// LOGIN HANDLER
async function loginUser() {
  const email = document.getElementById("email").value.trim().toLowerCase();
  const pass = document.getElementById("password").value.trim();
  const diag = document.getElementById("diag");
  diag.textContent = "⏳ Connecting...";

  if (!email || !pass) {
    diag.textContent = "⚠️ Please enter your email and password.";
    return;
  }

  const url = `${CONFIG.BASE_URL}?action=login&email=${encodeURIComponent(email)}&password=${encodeURIComponent(pass)}`;
  console.log("🌐 Fetching:", url);

  try {
    const res = await fetch(url, {
      method: "GET",
      mode: "cors",
      headers: { "Content-Type": "application/json" },
    });

    const text = await res.text();
    console.log("🔹 Raw response:", text);

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      diag.textContent = "⚠️ Invalid JSON (#901)";
      console.error(e);
      return;
    }

    if (!data.ok) {
      diag.textContent = `❌ Login failed (${data.error || "unknown"})`;
      return;
    }

    diag.textContent = "✅ Login successful!";
    localStorage.setItem("acw_email", email);
    document.getElementById("login").style.display = "none";
    document.getElementById("welcome").style.display = "block";
    document.getElementById("welcomeName").textContent = data.name || email;
    document.getElementById("welcomeRole").textContent = data.role || "Employee";
    await loadSchedule(email);
  } catch (err) {
    console.error("❌ Connection error:", err);
    diag.textContent = "⚠️ Connection error. (Fetch)";
  }
}

// LOAD SCHEDULE
async function loadSchedule(email) {
  const box = document.getElementById("schedule");
  box.innerHTML = "<p>⏳ Loading schedule...</p>";

  try {
    // ⚙️ URL con el email del usuario logueado
    const url = `${CONFIG.BASE_URL}?action=getSmartSchedule&email=${encodeURIComponent(email)}`;
    console.log("📡 Fetching schedule:", url);

    const res = await fetch(url, { mode: "cors" });
    const data = await res.json();

    console.log("🧾 SmartSchedule response:", data);

    if (!data.ok) {
      box.innerHTML = `<p style="color:#ff9999;">No schedule found (#${data.error || 'unknown'})</p>`;
      return;
    }

    // ✅ Mostrar los datos del horario
    let html = `<h4>Week: ${data.week}</h4>`;
    html += `<table class="schedule-table">
      <tr><th>Day</th><th>Shift</th><th>Hours</th></tr>`;

    (data.days || []).forEach(d => {
      html += `<tr><td>${d.day}</td><td>${d.shift || '-'}</td><td>${d.hours}</td></tr>`;
    });

    html += `</table><p><b>Total Hours: ${data.total}</b></p>`;
    box.innerHTML = html;
  } catch (err) {
    console.error("❌ Schedule fetch failed:", err);
    box.innerHTML = `<p style="color:#ff9999;">Connection error</p>`;
  }
}

// SETTINGS / LOGOUT
function openSettings() {
  document.getElementById("settingsModal").style.display = "flex";
}
function closeSettings() {
  document.getElementById("settingsModal").style.display = "none";
}
function logoutUser() {
  localStorage.clear();
  location.reload();
}
