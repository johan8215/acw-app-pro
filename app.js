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
  box.innerHTML = "⏳ Loading schedule...";
  const url = `${CONFIG.BASE_URL}?action=getSchedule&email=${encodeURIComponent(email)}`;

  try {
    const res = await fetch(url, { method: "GET", mode: "cors" });
    const txt = await res.text();
    console.log("📦 Schedule raw:", txt);
    const data = JSON.parse(txt);

    if (!data.ok) {
      box.innerHTML = `<p style="color:#ff9999">No schedule found. (${data.error || "?"})</p>`;
      return;
    }

    let html = `<h4>📅 Week of ${data.week}</h4><table><tr><th>Day</th><th>Shift</th><th>Hours</th></tr>`;
    let total = 0;
    (data.days || []).forEach((d) => {
      total += d.hours || 0;
      html += `<tr><td>${d.name}</td><td>${d.shift}</td><td>${d.hours}</td></tr>`;
    });
    html += `</table><p><b>Total Hours: ${total}</b></p>`;
    box.innerHTML = html;
  } catch (err) {
    console.error("⚠️ Error loading schedule:", err);
    box.innerHTML = `<p style="color:#ff9999;">⚠️ Connection error (schedule)</p>`;
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
