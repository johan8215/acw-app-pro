// ============================================================
// 🧠 ACW-App v4.7 — Blue Glass Edition (Final Build)
// Johan A. Giraldo (JAG15) & Sky — Oct 2025
// ============================================================

let currentUser = null;
let scheduleData = null;
let clockTimer = null;

/* ============================================================
   🔐 LOGIN
   ============================================================ */
async function loginUser() {
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value.trim();
  const diag = document.getElementById("diag");
  diag.textContent = "";

  if (!email || !password) {
    diag.textContent = "Please enter your email and password.";
    return;
  }

  try {
    diag.textContent = "Signing in...";
    const res = await fetch(
      `${CONFIG.BASE_URL}?action=login&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`
    );
    const data = await res.json();
    if (!data.ok) throw new Error("Invalid email or password.");

    currentUser = data;
    diag.textContent = "";
    showWelcome(data.name, data.role);
    await loadSchedule(email);
  } catch (err) {
    diag.textContent = err.message;
  }
}

/* ============================================================
   📅 LOAD & RENDER SCHEDULE
   ============================================================ */
async function loadSchedule(email) {
  const diag = document.getElementById("diag");
  diag.textContent = "Loading schedule...";
  try {
    const res = await fetch(`${CONFIG.BASE_URL}?action=getSmartSchedule&email=${encodeURIComponent(email)}`);
    const data = await res.json();
    if (!data.ok) throw new Error("Could not load schedule.");
    scheduleData = data;
    diag.textContent = "";
    renderSchedule(data);
    startClock();
  } catch (err) {
    diag.textContent = "Error loading schedule.";
    console.error(err);
  }
}

function renderSchedule(data) {
  const box = document.getElementById("schedule");
  if (!data || !data.ok) {
    box.innerHTML = `<p style="color:#ff9999;">No schedule found</p>`;
    return;
  }
  const FALLBACK = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  let html = `<h4>Week: ${data.week}</h4>
  <table class="schedule-table">
  <tr><th>Day</th><th>Shift</th><th>Hours</th></tr>`;
  (data.days || []).forEach((d,i) => {
    const dayName = d.name || FALLBACK[i];
    html += `<tr><td>${dayName}</td><td>${d.shift||"-"}</td><td>${d.hours||0}</td></tr>`;
  });
  html += `</table><p><b>Total Hours: ${calcTotalHours(data.days)}</b></p>
  <div id="clockBox" style="margin-top:10px;font-size:14px;color:#0070ff;"></div>`;
  box.innerHTML = html;
}

/* ============================================================
   🕓 CLOCK & HOURS
   ============================================================ */
function calcLiveHours(shift,hours){
  if(!shift)return 0;
  if(shift.includes("-"))return hours||0;
  const m=shift.match(/(\d{1,2})(?::(\d{2}))?/);
  if(!m)return hours||0;
  const h=parseInt(m[1],10),min=parseInt(m[2]||"0",10);
  const now=new Date(),start=new Date();
  start.setHours(h);start.setMinutes(min);
  let diff=(now-start)/3600000;if(diff<0)diff+=24;
  return Math.round(diff*10)/10;
}
function calcTotalHours(days){
  return days.reduce((s,d)=>s+calcLiveHours(d.shift,d.hours),0).toFixed(1);
}
function startClock(){
  if(clockTimer)clearInterval(clockTimer);
  const box=document.getElementById("clockBox");
  const tick=()=>{const n=new Date();
    box.textContent="🕒 "+n.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:true});};
  tick();clockTimer=setInterval(tick,1000);
}

/* ============================================================
   👋 DASHBOARD
   ============================================================ */
function showWelcome(name,role){
  document.getElementById("login").style.display="none";
  document.getElementById("welcome").style.display="block";
  document.getElementById("welcomeName").textContent=name;
  document.getElementById("welcomeRole").textContent=role;
  if(role==="manager"||role==="supervisor") addTeamButton();
}

/* ============================================================
   👥 TEAM OVERVIEW SYSTEM — Blue Glass Edition
   ============================================================ */
let directoryVisible=false;
function addTeamButton(){
  if(document.getElementById("teamBtn"))return;
  const btn=document.createElement("button");
  btn.id="teamBtn";btn.className="team-btn";btn.innerHTML="👥";
  btn.title="Team Overview";btn.onclick=toggleTeamOverview;
  document.body.appendChild(btn);
}
function toggleTeamOverview(){
  if(directoryVisible){document.getElementById("directoryWrapper")?.remove();directoryVisible=false;return;}
  loadEmployeeDirectory();directoryVisible=true;
}
async function loadEmployeeDirectory(){
  try{
    const res=await fetch(`${CONFIG.BASE_URL}?action=getEmployeesDirectory`);
    const data=await res.json();
    if(!data.ok)return;
    renderDirectoryTable(data.directory);
  }catch(err){console.error("Error loading directory:",err);}
}
function renderDirectoryTable(list){
  document.getElementById("directoryWrapper")?.remove();
  const wrapper=document.createElement("div");
  wrapper.id="directoryWrapper";wrapper.className="directory-wrapper blue-glass";
  let html=`<div class="directory-header-bar">
    <h3>Team Overview</h3>
    <button class="close-all-btn" onclick="toggleTeamOverview()">×</button>
  </div>
  <table class="directory-table">
  <tr><th>Name</th><th>Role</th><th>Email</th><th>Phone</th><th>Status</th><th></th></tr>`;
  list.forEach(emp=>{
    const active=emp.status==="active";
    html+=`<tr class="${active?"active-row":"inactive-row"}">
      <td><b>${emp.name}</b></td>
      <td>${emp.role}</td>
      <td>${emp.email}</td>
      <td>${emp.phone||""}</td>
      <td style="color:${active?"#00ffb2":"#999"};">${emp.status}</td>
      <td><button class="open-btn"
      onclick="openEmployeeCard('${emp.email}','${emp.name}','${emp.role}','${emp.phone||""}')">Open</button></td>
    </tr>`;
  });
  html+="</table>";wrapper.innerHTML=html;document.body.appendChild(wrapper);
}
async function openEmployeeCard(email,name,role,phone){
  try{
    const res=await fetch(`${CONFIG.BASE_URL}?action=getSmartSchedule&email=${encodeURIComponent(email)}`);
    const data=await res.json();if(!data.ok)return alert("No schedule found for this employee.");
    const id=`modal-${email.replace(/[@.]/g,"_")}`;
    if(document.getElementById(id))return;
    const modal=document.createElement("div");
    modal.className="employee-modal main-glass";modal.id=id;
    modal.innerHTML=`<div class="modal-header">
      <span class="modal-close" onclick="this.parentElement.parentElement.remove()">×</span>
      <h3>${name}</h3><p>${role||""}</p><p>${phone||""}</p>
    </div>
    <table class="schedule-mini">
      <tr><th>Day</th><th>Shift</th><th>Hours</th></tr>
      ${data.days.map(d=>`<tr><td>${d.name}</td><td>${d.shift}</td><td>${d.hours}</td></tr>`).join("")}
    </table>
    <p class="total">Total Hours: <b>${data.total}</b></p>`;
    document.body.appendChild(modal);
    modal.style.opacity="0";modal.style.transform="translateY(30px)";
    setTimeout(()=>{modal.style.opacity="1";modal.style.transform="translateY(0)";},50);
  }catch(err){console.error("Error opening employee card:",err);}
}

/* ============================================================
   🚪 LOGOUT & SETTINGS
   ============================================================ */
function logoutUser(){
  currentUser=null;scheduleData=null;
  if(clockTimer)clearInterval(clockTimer);
  document.getElementById("login").style.display="block";
  document.getElementById("welcome").style.display="none";
  document.getElementById("email").value="";document.getElementById("password").value="";
}
function openSettings(){document.getElementById("settingsModal").style.display="block";}
function closeSettings(){document.getElementById("settingsModal").style.display="none";}

/* ============================================================
   📲 INSTALL APP PROMPT — Blue Glass Edition (iOS & Android)
   ============================================================ */
let deferredPrompt;
window.addEventListener("beforeinstallprompt",e=>{
  e.preventDefault();deferredPrompt=e;showInstallButton();
});
function showInstallButton(){
  if(document.getElementById("installBtn"))return;
  const btn=document.createElement("button");
  btn.id="installBtn";btn.className="install-btn";btn.innerHTML="📲";
  btn.onclick=async()=>{
    if(deferredPrompt){
      deferredPrompt.prompt();
      const{outcome}=await deferredPrompt.userChoice;
      console.log("User response to install:",outcome);
      deferredPrompt=null;btn.remove();
    }else{
      alert("Add this app to your Home Screen from Safari’s share menu.");
    }
  };
  document.body.appendChild(btn);
}

console.log("✅ ACW Blue Glass v4.7 — Full Build Loaded");
