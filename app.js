/* ============================================================
   🧠 ACW-App v5.6.1 — Blue Glass White Connected Edition
   Johan A. Giraldo (JAG15) & Sky — Oct 2025
   ============================================================
   ✅ Cambios clave
   - Login funcional con Google Apps Script conectado.
   - Dashboard, Schedule y Team View estables.
   - Toasts (top-right + bottom-center).
   - Guarda sesión y roles; solo Manager/Supervisor editan.
   ============================================================ */

let currentUser = null;

/* ============== helpers UI ============== */
function $(sel, root=document){ return root.querySelector(sel); }
function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }

/* ============== LOGIN ============== */
async function loginUser() {
  const email = $("#email")?.value.trim();
  const password = $("#password")?.value.trim();
  const diag = $("#diag");
  const btn = $("#login button");
  if (!email || !password) {
    diag.textContent = "Please enter your email and password.";
    return;
  }

  try {
    btn.disabled = true;
    btn.innerHTML = "⏳ Loading your shift…";
    diag.textContent = "Connecting to Allston Car Wash servers ☀️";

    const res = await fetch(`${CONFIG.BASE_URL}?action=login&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`);
    const data = await res.json();

    if (!data.ok) throw new Error("Invalid email or password.");

    currentUser = data;
    localStorage.setItem("acwUser", JSON.stringify(data));

    diag.textContent = "✅ Welcome, " + data.name + "!";
    await showWelcome(data.name, data.role);
    await loadSchedule(email);
  } catch (e) {
    diag.textContent = "❌ " + (e.message || "Login error");
  } finally {
    btn.disabled = false;
    btn.innerHTML = "Sign In";
  }
}

/* ============== WELCOME DASHBOARD ============== */
async function showWelcome(name, role) {
  $("#login").style.display = "none";
  $("#welcome").style.display = "block";
  $("#welcomeName").innerHTML = `<b>${name}</b>`;
  $("#welcomeRole").textContent = role;

  if (["manager","supervisor"].includes(String(role||"").toLowerCase()))
    addTeamButton();

  try {
    const r = await fetch(`${CONFIG.BASE_URL}?action=getEmployeesDirectory`);
    const j = await r.json();
    if (j.ok && Array.isArray(j.directory)) {
      const self = j.directory.find(e => (e.email||"").toLowerCase() === (currentUser?.email||"").toLowerCase());
      if (self?.phone) {
        setTimeout(()=>{
          $(".user-phone")?.remove();
          $("#welcomeName")?.insertAdjacentHTML("afterend",
            `<p class="user-phone">📞 <a href="tel:${self.phone}" style="color:#0078ff;font-weight:600;text-decoration:none;">${self.phone}</a></p>`
          );
        }, 250);
      }
    }
  } catch {}
}

/* ============== LOAD SCHEDULE ============== */
async function loadSchedule(email) {
  const schedDiv = $("#schedule");
  schedDiv.innerHTML = `<p style="color:#007bff;font-weight:500;">Loading your shift...</p>`;

  try {
    const r = await fetch(`${CONFIG.BASE_URL}?action=getSmartSchedule&email=${encodeURIComponent(email)}`);
    const d = await r.json();

    if (!d.ok || !d.days) {
      schedDiv.innerHTML = `<p style="color:#c00;">No schedule found for this week.</p>`;
      return;
    }

    let html = `<table><tr><th>Day</th><th>Shift</th><th>Hours</th></tr>`;
    d.days.forEach(day=>{
      const isToday = new Date().toLocaleString("en-US",{weekday:"short"}).slice(0,3).toLowerCase() === day.name.slice(0,3).toLowerCase();
      html += `<tr class="${isToday?"today":""}"><td>${day.name}</td><td>${day.shift||"-"}</td><td>${day.hours||"0"}</td></tr>`;
    });
    html += `</table><p class="total">Total Hours: <b>${d.total||0}</b></p>`;
    schedDiv.innerHTML = html;
  } catch (e) {
    schedDiv.innerHTML = `<p style="color:#c00;">Error loading schedule.</p>`;
  }
}

/* ============== SESSION RESTORE ============== */
window.addEventListener("load", ()=>{
  try {
    const saved = localStorage.getItem("acwUser");
    if (saved) {
      currentUser = JSON.parse(saved);
      showWelcome(currentUser.name, currentUser.role);
      loadSchedule(currentUser.email);
    }
  } catch {}
});

/* ============== TEAM VIEW (gestión) ============== */
function isManagerRole(role){
  return ["manager","supervisor"].includes(String(role||"").toLowerCase());
}

function addTeamButton(){
  if ($("#teamBtn")) return;
  const btn = document.createElement("button");
  btn.id="teamBtn";
  btn.className="team-btn";
  btn.textContent="Team View";
  btn.onclick = loadEmployeeDirectory;
  document.body.appendChild(btn);
}

async function loadEmployeeDirectory(){
  try{
    const r = await fetch(`${CONFIG.BASE_URL}?action=getEmployeesDirectory`);
    const j = await r.json();
    if (!j.ok) return;
    const team = j.directory || [];

    let html = `
      <div id="teamModal" class="container glass">
        <h3>Team View</h3>
        <table><tr><th>Name</th><th>Role</th><th>Phone</th></tr>`;
    team.forEach(emp=>{
      html += `<tr><td>${emp.name}</td><td>${emp.role}</td><td>${emp.phone||"-"}</td></tr>`;
    });
    html += `</table><button onclick="closeTeamView()">Close</button></div>`;

    $("#welcome").style.display = "none";
    document.body.insertAdjacentHTML("beforeend", html);
  }catch(e){
    console.warn(e);
  }
}

function closeTeamView(){
  $("#teamModal")?.remove();
  $("#welcome").style.display = "block";
}

/* ============== TOASTS ============== */
if (!$("#toastContainer")){
  const c=document.createElement("div");
  c.id="toastContainer";
  Object.assign(c.style,{
    position:"fixed",top:"18px",right:"18px",zIndex:"9999",
    display:"flex",flexDirection:"column",alignItems:"flex-end"
  });
  document.body.appendChild(c);
}

function showToast(msg, type="info"){
  const t=document.createElement("div");
  t.className="acw-toast";
  t.textContent=msg;
  t.style.background = type==="success" ? "linear-gradient(135deg,#00c851,#007e33)" :
                      type==="error" ? "linear-gradient(135deg,#ff4444,#cc0000)" :
                                       "linear-gradient(135deg,#007bff,#33a0ff)";
  Object.assign(t.style,{
    color:"#fff",padding:"10px 18px",marginTop:"8px",borderRadius:"8px",fontWeight:"600",
    boxShadow:"0 6px 14px rgba(0,0,0,.25)",opacity:"0",transform:"translateY(-10px)",
    transition:"all .35s ease"
  });
  $("#toastContainer").appendChild(t);
  requestAnimationFrame(()=>{ t.style.opacity="1"; t.style.transform="translateY(0)"; });
  setTimeout(()=>{ t.style.opacity="0"; t.style.transform="translateY(-10px)";
    setTimeout(()=>t.remove(),380); }, 2600);
}

/* ============== GLOBAL BINDS ============== */
window.loginUser = loginUser;
window.loadEmployeeDirectory = loadEmployeeDirectory;
window.closeTeamView = closeTeamView;
window.showToast = showToast;

console.log(`✅ ACW-App v5.6.1 loaded. Base: ${CONFIG.BASE_URL}`);
