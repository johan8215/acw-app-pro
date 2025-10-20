console.log("✅ ACW Blue Glass v4.6.8 loaded");

const CONFIG = {
  APP_VERSION: "v4.6.8 Blue Glass CORS Fix",
  BASE_URL: "https://script.google.com/macros/s/AKfycbzI9UgpoA11o662UJ7zlVCCJjBcsb8mMB0GyGS4t8Ab0ttf53S9J78ksu1kX94ULP6r/exec"
};

/* ===== Login ===== */
async function loginUser(){
  const email = document.getElementById("email").value.trim().toLowerCase();
  const pass = document.getElementById("password").value.trim();
  const diag = document.getElementById("diag");
  diag.textContent = "";

  if(!email || !pass){
    diag.textContent = "⚠️ Enter your email and password.";
    return;
  }

  diag.textContent = "🔄 Connecting...";
  const url = `${CONFIG.BASE_URL}?action=login&email=${encodeURIComponent(email)}&password=${encodeURIComponent(pass)}`;

  try {
    const res = await fetch(url, { method:"GET", mode:"no-cors" });
    const text = await res.text();
    console.log("🔹 Raw:", text);

    if(!text || !text.includes("{")) {
      diag.textContent = "⚠️ Network/CORS error (#CORS)";
      return;
    }

    let data;
    try { data = JSON.parse(text); }
    catch { diag.textContent = "⚠️ Invalid JSON"; return; }

    if(!data.ok){
      diag.textContent = `❌ Login failed (${data.error || "unknown"})`;
      return;
    }

    // ✅ Login OK
    diag.textContent = "✅ Logged in!";
    document.getElementById("login").style.display="none";
    document.getElementById("welcome").style.display="block";
    document.getElementById("welcomeName").textContent = data.name || email;
    document.getElementById("welcomeRole").textContent = data.role || "Employee";
    await loadSchedule(email);

  } catch(err) {
    console.error("❌ Fetch error:", err);
    diag.textContent = "⚠️ Connection error (Fetch).";
  }
}

/* ===== Schedule ===== */
async function loadSchedule(email){
  const box = document.getElementById("schedule");
  box.textContent = "Loading schedule...";
  const url = `${CONFIG.BASE_URL}?action=getSchedule&email=${encodeURIComponent(email)}`;

  try {
    const res = await fetch(url, { method:"GET", mode:"no-cors" });
    const text = await res.text();
    console.log("📅 Raw schedule:", text);

    if(!text || !text.includes("{")) {
      box.textContent = "⚠️ CORS error loading schedule.";
      return;
    }

    const data = JSON.parse(text);
    if(!data.ok){ box.textContent = "No schedule found."; return; }

    let html = `<h4>Week of ${data.week}</h4><table><tr><th>Day</th><th>Shift</th><th>Hours</th></tr>`;
    let total = 0;
    (data.days||[]).forEach(d=>{
      total += d.hours||0;
      html += `<tr><td>${d.name}</td><td>${d.shift}</td><td>${d.hours}</td></tr>`;
    });
    html += `</table><p><b>Total Hours: ${total}</b></p>`;
    box.innerHTML = html;

  } catch {
    box.textContent = "⚠️ Error loading schedule.";
  }
}

/* ===== Settings / Logout ===== */
function openSettings(){ document.getElementById("settingsModal").style.display="flex"; }
function closeSettings(){ document.getElementById("settingsModal").style.display="none"; }
function logoutUser(){ location.reload(); }
