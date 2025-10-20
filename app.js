console.log("🚗 ACW Blue Glass v4.6.9 loaded");

document.addEventListener("DOMContentLoaded", () => {
  const remembered = localStorage.getItem("acw_email");
  if (remembered) document.getElementById("email").value = remembered;
});

/* ===========================================================
   🔐 LOGIN
   =========================================================== */
async function loginUser(){
  const email = document.getElementById("email").value.trim().toLowerCase();
  const pass = document.getElementById("password").value.trim();
  const diag = document.getElementById("diag");
  diag.textContent = "";

  if(!email || !pass){
    diag.textContent = "⚠️ Enter your email and password. (#100)";
    return;
  }

  const url = `${CONFIG.BASE_URL}?action=login&email=${encodeURIComponent(email)}&password=${encodeURIComponent(pass)}`;
  console.log("🔍", url);

  try{
    const res = await fetch(url);
    const data = await res.json();

    if(!data.ok){
      diag.textContent = `❌ Login failed (#${data.error || "unknown"})`;
      return;
    }

    diag.textContent = "✅ Login success (#200)";
    localStorage.setItem("acw_email", email);

    document.getElementById("login").style.display="none";
    document.getElementById("welcome").style.display="block";

    document.getElementById("welcomeName").textContent = data.name || email;
    document.getElementById("welcomeRole").textContent = data.role || "Employee";

    await loadSchedule(email);
  }
  catch(err){
    console.error("Connection error:", err);
    diag.textContent = "⚠️ Connection error. (#202)";
  }
}

/* ===========================================================
   📅 SCHEDULE
   =========================================================== */
async function loadSchedule(email){
  const box = document.getElementById("schedule");
  box.innerHTML = "<p>Loading schedule...</p>";

  const short = email.split("@")[0];
  const url = `${CONFIG.BASE_URL}?action=getSmartSchedule&short=${encodeURIComponent(short)}`;
  console.log("🧭 Fetching:", url);

  try{
    const res = await fetch(url);
    const data = await res.json();

    if(!data.ok){
      box.innerHTML = `<p style='color:#ff9999;'>No schedule found (#${data.error || "404"})</p>`;
      return;
    }

    let html = `
      <h3>${data.name}</h3>
      <p><b>Week:</b> ${data.week}</p>
      <table>
        <tr><th>Day</th><th>Shift</th><th>Hours</th></tr>`;
    let total = 0;
    (data.days || []).forEach(d=>{
      total += d.hours || 0;
      html += `<tr><td>${d.name}</td><td>${d.shift}</td><td>${d.hours}</td></tr>`;
    });
    html += `</table><p><b>Total Hours: ${total}</b></p>`;
    box.innerHTML = html;

  }catch(err){
    console.error(err);
    box.innerHTML = `<p style='color:#ff9999;'>Connection error (#500)</p>`;
  }
}

/* ===========================================================
   ⚙️ SETTINGS
   =========================================================== */
function openSettings(){ document.getElementById("settingsModal").style.display="flex"; }
function closeSettings(){ document.getElementById("settingsModal").style.display="none"; }
function logoutUser(){ localStorage.removeItem("acw_email"); location.reload(); }
