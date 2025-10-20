console.log("✅ ACW Blue Glass loaded");

async function loginUser(){
  const email = document.getElementById("email").value.trim().toLowerCase();
  const pass = document.getElementById("password").value.trim();
  const diag = document.getElementById("diag");
  diag.textContent = "";

  if(!email || !pass){
    diag.textContent = "⚠️ Enter your email and password.";
    return;
  }

  const url = `${CONFIG.BASE_URL}?action=login&email=${encodeURIComponent(email)}&password=${encodeURIComponent(pass)}`;

  try{
    const res = await fetch(url);
    const data = await res.json();

    if(!data.ok){
      diag.textContent = `❌ Login failed (${data.error || 'unknown'})`;
      return;
    }

    diag.textContent = "✅ Logged in!";
    document.getElementById("login").style.display="none";
    document.getElementById("welcome").style.display="block";
    document.getElementById("welcomeName").textContent = data.name || email;
    document.getElementById("welcomeRole").textContent = data.role || "Employee";

    await loadSchedule(email);
  }catch(err){
    diag.textContent = "⚠️ Connection error.";
  }
}

async function loadSchedule(email){
  const box = document.getElementById("schedule");
  box.textContent = "Loading schedule...";
  const url = `${CONFIG.BASE_URL}?action=getSchedule&email=${encodeURIComponent(email)}`;
  try{
    const res = await fetch(url);
    const data = await res.json();
    if(!data.ok){ box.textContent = "No schedule found."; return; }

    let html = `<h4>Week of ${data.week}</h4><table><tr><th>Day</th><th>Shift</th><th>Hours</th></tr>`;
    let total = 0;
    (data.days||[]).forEach(d=>{
      total += d.hours||0;
      html += `<tr><td>${d.name}</td><td>${d.shift}</td><td>${d.hours}</td></tr>`;
    });
    html += `</table><p><b>Total Hours: ${total}</b></p>`;
    box.innerHTML = html;
  }catch{
    box.textContent = "⚠️ Error loading schedule.";
  }
}

function openSettings(){ document.getElementById("settingsModal").style.display="flex"; }
function closeSettings(){ document.getElementById("settingsModal").style.display="none"; }
function logoutUser(){ location.reload(); }
