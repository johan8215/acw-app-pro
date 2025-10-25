/* ============================================================
   🧠 ACW-App v5.6.0 — Blue Glass White Connected Edition
   Johan A. Giraldo (JAG15) & Sky — Oct 2025
   ============================================================
   ✅ Cambios clave
   - Update Shift contra Sheets con fallback de endpoints (3 rutas).
   - Send Today/Tomorrow con fallback a APIKEY/actor.
   - Team View + Employee Modal estables (live hours y total).
   - Toasts suaves (top-right + bottom-center).
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
  if (!email || !password) { diag.textContent = "Please enter your email and password."; return; }

  try {
    btn.disabled = true; btn.innerHTML = "⏳ Loading your shift…";
    diag.textContent = "Connecting to Allston Car Wash servers ☀️";

    const res = await fetch(`${CONFIG.BASE_URL}?action=login&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`);
    const data = await res.json();

    if (!data.ok) throw new Error("Invalid email or password.");
    currentUser = data; // {ok,name,email,role,week}
    localStorage.setItem("acwUser", JSON.stringify(data));

    diag.textContent = "✅ Welcome, " + data.name + "!";
    await showWelcome(data.name, data.role);
    await loadSchedule(email);
  } catch (e) {
    diag.textContent = "❌ " + (e.message || "Login error");
  } finally {
    btn.disabled = false; btn.innerHTML = "Sign In";
  }
}

/* ============== WELCOME DASHBOARD ============== */
async function showWelcome(name, role) {
  $("#login").style.display = "none";
  $("#welcome").style.display = "block";
  $("#welcomeName").innerHTML = `<b>${name}</b>`;
  $("#welcomeRole").textContent = role;

  if (["manager","supervisor"].includes(String(role||"").toLowerCase())) addTeamButton();

  // Inserta teléfono del usuario logueado (si existe en directorio)
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

/* ============== LOAD SCHEDULE + LIVE ============== */
async function loadSchedule(email) {
  const schedDiv = $("#schedule");
  schedDiv.innerHTML = `<p style="color:#007bff;font-weight:500;">Loading your shift...</p>`;
  try {
    const r = await fetch(`${CONFIG.BASE_URL}?action=getSmartSchedule&email=${encodeURIComponent(email)}`);
    const d = await r.json();
    if (!d.ok || !d.days) { schedDiv.innerHTML = `<p style="color:#c00;">No schedule found for this week.</p>`; return; }

    let html = `<table><tr><th>Day</th><th>Shift</th><th>Hours</th></tr>`;
    d.days.forEach(day=>{
      const isToday = new Date().toLocaleString("en-US",{weekday:"short"}).slice(0,3).toLowerCase() === day.name.slice(0,3).toLowerCase();
      html += `<tr class="${isToday?"today":""}"><td>${day.name}</td><td>${day.shift||"-"}</td><td>${day.hours||"0"}</td></tr>`;
    });
    html += `</table><p class="total">Total Hours: <b>${d.total||0}</b></p>`;
    schedDiv.innerHTML = html;

    setTimeout(()=> startLiveTimer(d.days, Number(d.total||0)), 900);
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

/* ============== LIVE TIMER (dashboard) ============== */
function parseTime(str){
  const clean = String(str||"").trim();
  const m = clean.match(/^(\d{1,2})(?::(\d{1,2}))?\s*(am|pm)?$/i);
  if(!m) return null;
  let h = +m[1], min = +(m[2]||0), s = (m[3]||"").toLowerCase();
  if (s==="pm" && h<12) h+=12;
  if (s==="am" && h===12) h=0;
  const d = new Date(); d.setHours(h, min, 0, 0); return d;
}
function updateTotalDisplay(value, active=false){
  const totalEl = $(".total");
  if (!totalEl || isNaN(value)) return;
  const color = active? "#33a0ff":"#fff";
  totalEl.innerHTML = `<span style="color:${color}">⚪ Total Hours: <b>${value.toFixed(1)}</b></span>`;
}
function showLiveHours(hours, active=true){
  let el = $(".live-hours");
  if (!el) {
    el = document.createElement("p");
    el.className = "live-hours";
    el.style.fontSize="1.05em"; el.style.marginTop="6px"; el.style.textShadow="0 0 10px rgba(0,120,255,.35)";
    $("#schedule")?.appendChild(el);
  }
  el.innerHTML = active ? `⏱️ <b style="color:#33a0ff">${hours.toFixed(1)}h</b>` : "";
}
function addOnlineBadge(){
  if ($("#onlineBadge")) return;
  const badge = document.createElement("span");
  badge.id="onlineBadge"; badge.textContent="🟢 Online";
  badge.style.display="block"; badge.style.fontWeight="600"; badge.style.color="#33ff66";
  badge.style.textShadow="0 0 10px rgba(51,255,102,.5)"; badge.style.marginBottom="6px";
  $("#welcomeName")?.parentNode?.insertBefore(badge, $("#welcomeName"));
}
function removeOnlineBadge(){ $("#onlineBadge")?.remove(); }

function startLiveTimer(days, total){
  try{
    const todayKey = new Date().toLocaleString("en-US",{weekday:"short"}).slice(0,3).toLowerCase();
    const today = days.find(d=> d.name.slice(0,3).toLowerCase()===todayKey);
    if(!today || !today.shift || /off/i.test(today.shift)) return;

    const shift = today.shift.trim();
    removeOnlineBadge();

    // Turno activo estilo "7:30."
    if (shift.endsWith(".")) {
      addOnlineBadge();
      const startStr = shift.replace(/\.$/,"").trim();
      const startTime = parseTime(startStr); if (!startTime) return;

      const tick = ()=>{
        const diff = Math.max(0,(Date.now()-startTime.getTime())/36e5);
        updateTotalDisplay(total+diff, true);
        showLiveHours(diff, true);
      };
      tick();
      clearInterval(window.__acwLiveTick__); window.__acwLiveTick__ = setInterval(tick, 60000);
      return;
    }

    // Turno cerrado "7:30 - 6"
    const p = shift.split("-"); if (p.length<2) return;
    const a = parseTime(p[0].trim()), b = parseTime(p[1].trim());
    if(!a || !b) return;
    const diff = Math.max(0,(b-a)/36e5);
    updateTotalDisplay(total,false);
    showLiveHours(diff,false);

    // Pinta ⏱️ en la fila del día
    const row = Array.from($("#schedule table").rows).find(r=> r.cells?.[0]?.textContent.slice(0,3).toLowerCase()===todayKey);
    if (row) row.cells[2].innerHTML = `${diff.toFixed(1)}h`;
  }catch(e){ console.warn("Live error:", e); }
}

/* ============== TEAM VIEW (gestión) ============== */
const TEAM_PAGE_SIZE = 8;
let __teamList=[], __teamPage=0;

function isManagerRole(role){ return ["manager","supervisor"].includes(String(role||"").toLowerCase()); }

function addTeamButton(){
  if ($("#teamBtn")) return;
  const btn = document.createElement("button");
  btn.id="teamBtn"; btn.className="team-btn"; btn.textContent="Team View";
  btn.onclick = toggleTeamOverview; document.body.appendChild(btn);
}
function toggleTeamOverview(){
  const w = $("#directoryWrapper");
  if (w){ w.classList.add("fade-out"); setTimeout(()=>w.remove(), 220); return; }
  loadEmployeeDirectory();
}
async function loadEmployeeDirectory(){
  try{
    const r = await fetch(`${CONFIG.BASE_URL}?action=getEmployeesDirectory`);
    const j = await r.json(); if (!j.ok) return;
    __teamList = j.directory||[]; __teamPage=0; renderTeamViewPage();
  }catch(e){ console.warn(e); }
}
function renderTeamViewPage(){
  $("#directoryWrapper")?.remove();
  const box=document.createElement("div");
  box.id="directoryWrapper"; box.className="directory-wrapper tv-wrapper";
  box.style.display="flex"; box.style.flexDirection="column"; box.style.alignItems="center"; box.style.animation="fadeIn .25s ease";

  box.innerHTML = `
    <div class="tv-head">
      <h3 style="margin-bottom:6px;">Team View</h3>
      <button class="tv-close" onclick="toggleTeamOverview()">✖️</button>
    </div>
    <div class="tv-pager">
      <button class="tv-nav" id="tvPrev" ${__teamPage===0?"disabled":""}>‹ Prev</button>
      <span class="tv-index">Page ${__teamPage+1} / ${Math.max(1, Math.ceil(__teamList.length/TEAM_PAGE_SIZE))}</span>
      <button class="tv-nav" id="tvNext" ${(__teamPage+1)>=Math.ceil(__teamList.length/TEAM_PAGE_SIZE)?"disabled":""}>Next ›</button>
    </div>
    <table class="directory-table tv-table" style="margin-top:10px;min-width:460px;text-align:center;">
      <tr><th>Name</th><th>Hours</th><th>Live (Working)</th><th></th></tr>
      <tbody id="tvBody"></tbody>
    </table>
  `;
  document.body.appendChild(box);

  const start = __teamPage*TEAM_PAGE_SIZE, slice = __teamList.slice(start, start+TEAM_PAGE_SIZE);
  const body = $("#tvBody", box);
  body.innerHTML = slice.map(emp=>`
    <tr data-email="${emp.email}" data-name="${emp.name}" data-role="${emp.role||''}" data-phone="${emp.phone||''}">
      <td><b>${emp.name}</b></td>
      <td class="tv-hours">—</td>
      <td class="tv-live">—</td>
      <td><button class="open-btn" onclick="openEmployeePanel(this)">Open</button></td>
    </tr>`).join("");

  $("#tvPrev",box).onclick = ()=>{ __teamPage=Math.max(0,__teamPage-1); renderTeamViewPage(); };
  $("#tvNext",box).onclick = ()=>{ __teamPage=Math.min(Math.ceil(__teamList.length/TEAM_PAGE_SIZE)-1,__teamPage+1); renderTeamViewPage(); };

  slice.forEach(async emp=>{
    try{
      const r = await fetch(`${CONFIG.BASE_URL}?action=getSmartSchedule&email=${encodeURIComponent(emp.email)}`);
      const d = await r.json();
      const tr = body.querySelector(`tr[data-email="${CSS.escape(emp.email)}"]`);
      if (tr) tr.querySelector(".tv-hours").textContent = (d && d.ok) ? (d.total??0).toFixed(1) : "0";
    }catch{}
  });

  updateTeamViewLiveStatus();
}
async function updateTeamViewLiveStatus(){
  try{
    const rows = $all(".tv-table tr[data-email]"); if (!rows.length) return;
    for (const row of rows){
      const email=row.dataset.email, liveCell=row.querySelector(".tv-live"), totalCell=row.querySelector(".tv-hours");
      const r = await fetch(`${CONFIG.BASE_URL}?action=getSmartSchedule&email=${encodeURIComponent(email)}`);
      const d = await r.json(); if (!d.ok || !d.days) continue;

      const todayKey = new Date().toLocaleString("en-US",{weekday:"short"}).slice(0,3).toLowerCase();
      const today = d.days.find(x=> x.name.slice(0,3).toLowerCase()===todayKey);
      if (!today?.shift) { liveCell.innerHTML="—"; continue; }

      if (today.shift.trim().endsWith(".")){
        const startStr = today.shift.replace(/\.$/,"").trim();
        const startTime = parseTime(startStr); if(!startTime) continue;
        const diff = Math.max(0,(Date.now()-startTime.getTime())/36e5);
        liveCell.innerHTML = `🟢 ${diff.toFixed(1)}h`;
        liveCell.style.color="#33ff66"; liveCell.style.fontWeight="600"; liveCell.style.textShadow="0 0 10px rgba(51,255,102,.6)";
        const base = parseFloat(totalCell.textContent)||0;
        totalCell.innerHTML = `${(base+diff).toFixed(1)} <span style="color:#33a0ff;font-size:.85em;">(+${diff.toFixed(1)})</span>`;
      }else{
        liveCell.innerHTML="—"; liveCell.style.color="#aaa"; liveCell.style.fontWeight="400"; liveCell.style.textShadow="none";
      }
    }
  }catch(e){ console.warn("Live col error:", e); }
}
setInterval(updateTeamViewLiveStatus, 120000);

/* ============== EMPLOYEE MODAL (gestión) ============== */
async function openEmployeePanel(btnEl){
  const tr = btnEl.closest("tr");
  const email = tr.dataset.email, name = tr.dataset.name, role = tr.dataset.role||"", phone = tr.dataset.phone||"";
  const modalId=`emp-${email.replace(/[@.]/g,"_")}`; if ($("#"+modalId)) return;

  let data=null;
  try{
    const r = await fetch(`${CONFIG.BASE_URL}?action=getSmartSchedule&email=${encodeURIComponent(email)}`);
    data = await r.json(); if (!data.ok) throw new Error();
  }catch{ alert("No schedule found for this employee."); return; }

  const m = document.createElement("div");
  m.className="employee-modal emp-panel"; m.id=modalId;
  m.innerHTML = `
    <div class="emp-box">
      <button class="emp-close">×</button>
      <div class="emp-header">
        <h3>${name}</h3>
        ${phone?`<p class="emp-phone"><a href="tel:${phone}">${phone}</a></p>`:""}
        <p class="emp-role">${role}</p>
      </div>
      <table class="schedule-mini">
        <tr><th>Day</th><th>Shift</th><th>Hours</th></tr>
        ${data.days.map(d=>`
          <tr data-day="${d.name.slice(0,3)}" data-original="${(d.shift||"-").replace(/"/g,'&quot;')}">
            <td>${d.name}</td>
            <td ${isManagerRole(currentUser?.role) ? 'contenteditable="true"' : ''}>${d.shift||"-"}</td>
            <td>${d.hours||0}</td>
          </tr>`).join("")}
      </table>
      <p class="total">Total Hours: <b id="tot-${name.replace(/\s+/g,"_")}">${data.total||0}</b></p>
      <p class="live-hours" id="lh-${name.replace(/\s+/g,"_")}"></p>
      ${isManagerRole(currentUser?.role) ? `
        <div class="emp-actions" style="margin-top:10px;">
          <button class="btn-update">✏️ Update Shift</button>
          <button class="btn-today">📤 Send Today</button>
          <button class="btn-tomorrow">📤 Send Tomorrow</button>
          <p id="empStatusMsg-${email.replace(/[@.]/g,"_")}" class="emp-status-msg" style="margin-top:6px;font-size:.9em;"></p>
        </div>` : ``}
      <button class="emp-refresh" style="margin-top:8px;">⚙️ Check for Updates</button>
    </div>
  `;
  document.body.appendChild(m);

  $(".emp-close",m).onclick = ()=> m.remove();
  $(".emp-refresh",m).onclick = ()=> { try{ if("caches" in window) caches.keys().then(k=>k.forEach(n=>caches.delete(n))); }catch{}; m.classList.add("flash"); setTimeout(()=>location.reload(), 900); };

  if (isManagerRole(currentUser?.role)) {
    $(".btn-update",m).onclick   = ()=> updateShiftFromModal(email, m);
    $(".btn-today",m).onclick    = ()=> sendShiftMessage(email, "sendtoday");
    $(".btn-tomorrow",m).onclick = ()=> sendShiftMessage(email, "sendtomorrow");
  }

  // badge/horas live dentro del modal (si aplica)
  enableModalLiveShift(m, data.days);
}

/* ============== Modal live (resumen) ============== */
function enableModalLiveShift(modal, days){
  try{
    const key = new Date().toLocaleString("en-US",{weekday:"short"}).slice(0,3).toLowerCase();
    const today = days.find(d=> d.name.slice(0,3).toLowerCase()===key);
    if (!today?.shift || /off/i.test(today.shift)) return;

    const table = $(".schedule-mini", modal);
    const row = $all("tr", table).find(r=> r.cells?.[0]?.textContent.slice(0,3).toLowerCase()===key);
    if (!row) return;
    const hoursCell = row.cells[2];

    const shift = today.shift.trim();
    const totalEl = $(".total b", modal);
    if (totalEl && !totalEl.dataset.baseHours) totalEl.dataset.baseHours = totalEl.textContent;

    if (shift.endsWith(".")){
      const startTime = parseTime(shift.replace(/\.$/,"").trim());
      const tick = ()=>{
        const diff = Math.max(0,(Date.now() - startTime.getTime())/36e5);
        hoursCell.innerHTML = `⏱️ ${diff.toFixed(1)}h`;
        hoursCell.style.color="#33a0ff"; hoursCell.style.fontWeight="600";
        if (totalEl){
          const base = parseFloat(totalEl.dataset.baseHours||totalEl.textContent)||0;
          totalEl.innerHTML = `${(base+diff).toFixed(1)} <span style="color:#33a0ff;font-size:.85em;">(+${diff.toFixed(1)})</span>`;
        }
      };
      tick();
      clearInterval(modal.__tick__); modal.__tick__ = setInterval(tick, 60000);
    } else {
      const p=shift.split("-"); if (p.length===2){
        const a=parseTime(p[0].trim()), b=parseTime(p[1].trim());
        if (a && b){ const diff=Math.max(0,(b-a)/36e5); hoursCell.textContent=`${diff.toFixed(1)}h`; hoursCell.style.color="#999"; }
      }
    }
  }catch(e){ console.warn("modal live err:", e); }
}

/* ============== MANAGER ACTIONS ============== */
async function updateShiftFromModal(targetEmail, modalEl){
  const msg = $(`#empStatusMsg-${targetEmail.replace(/[@.]/g,"_")}`) || $(".emp-status-msg", modalEl);
  const base = CONFIG.BASE_URL;
  const actor = currentUser?.email;
  if (!actor) { showToast("⚠️ Session expired. Login again.", "error"); return; }

  const rows = $all(".schedule-mini tr[data-day]", modalEl);
  // Detectar cambios vs data-original
  const changes = rows.map(r=>{
    const day = r.dataset.day; const newShift = r.cells[1].innerText.trim();
    const original = (r.getAttribute("data-original")||"").trim();
    return (newShift !== original) ? { day, newShift } : null;
  }).filter(Boolean);

  if (!changes.length){ msg && (msg.textContent="No changes to save."); showToast("ℹ️ No changes", "info"); return; }

  msg && (msg.textContent="✏️ Saving to Sheets..."); msg && (msg.style.color="#007bff");

  // Fallback de endpoints (al primero que responda ok)
  async function tryUpdate(one){
    const urls = [
      // 1) updateShiftAPI (actor/newShift) — tu función nueva
      `${base}?action=updateshiftapi&actor=${encodeURIComponent(actor)}&target=${encodeURIComponent(targetEmail)}&day=${encodeURIComponent(one.day)}&newShift=${encodeURIComponent(one.newShift)}`,
      // 2) updateShift (actor/shift)
      `${base}?action=updateShift&actor=${encodeURIComponent(actor)}&target=${encodeURIComponent(targetEmail)}&day=${encodeURIComponent(one.day)}&shift=${encodeURIComponent(one.newShift)}`,
      // 3) updateshift (todo minúscula por si el switch está mal)
      `${base}?action=updateshift&actor=${encodeURIComponent(actor)}&target=${encodeURIComponent(targetEmail)}&day=${encodeURIComponent(one.day)}&shift=${encodeURIComponent(one.newShift)}`
    ];
    for (const url of urls){
      try{
        const r = await fetch(url, { cache:"no-store", credentials:"omit" });
        const j = await r.json().catch(()=>({}));
        if (j && j.ok) return { ok:true, j, url };
      }catch{}
    }
    return { ok:false };
  }

  let okCount=0;
  for (const c of changes){
    const res = await tryUpdate(c);
    if (res.ok) okCount++;
  }

  if (okCount === changes.length){
    msg && (msg.textContent="✅ Updated on Sheets!"); msg && (msg.style.color="#33cc33");
    showToast("✅ Shift(s) updated", "success");
    // Actualiza data-original para evitar re-envíos
    rows.forEach(r=> r.setAttribute("data-original", r.cells[1].innerText.trim()));
  } else if (okCount>0){
    msg && (msg.textContent=`⚠️ Partial save: ${okCount}/${changes.length}`); msg && (msg.style.color:"#f4b400");
    showToast("⚠️ Some shifts failed", "error");
  } else {
    msg && (msg.textContent="❌ Could not update. Backend route missing."); msg && (msg.style.color="#e60000");
    showToast("❌ Update failed", "error");
  }
}

async function sendShiftMessage(targetEmail, action /* 'sendtoday' | 'sendtomorrow' */){
  const msg = $(`#empStatusMsg-${targetEmail.replace(/[@.]/g,"_")}`);
  msg && (msg.textContent="💬 Sending..."); msg && (msg.style.color="#007bff");

  const actor = currentUser?.email;
  if (!actor){ msg && (msg.textContent="⚠️ Session expired"); msg&&(msg.style.color="#e60000"); return; }

  const base = CONFIG.BASE_URL;
  const apikey = currentUser?.apikey || null; // si algún día lo agregas al login

  // Fallback: 1) sendShiftAPI (con apikey)  2) sendtoday/sendtomorrow (actor/target)
  const urls = [];
  if (apikey){
    const mode = action.replace(/^send/,"").toLowerCase(); // today|tomorrow
    urls.push(`${base}?action=sendShiftAPI&apikey=${encodeURIComponent(apikey)}&target=${encodeURIComponent(targetEmail)}&mode=${encodeURIComponent(mode)}`);
  }
  urls.push(`${base}?action=${action}&actor=${encodeURIComponent(actor)}&target=${encodeURIComponent(targetEmail)}`);

  let success=false, lastErr=null;
  for (const url of urls){
    try{
      const r = await fetch(url, { cache:"no-store", credentials:"omit" });
      const j = await r.json().catch(()=>({}));
      if (j && j.ok){ success=true; break; } else { lastErr = j?.error || "unknown_error"; }
    }catch(e){ lastErr = e.message; }
  }

  if (success){
    msg && (msg.textContent = action==="sendtoday" ? "✅ Sent Today" : "✅ Sent Tomorrow");
    msg && (msg.style.color="#33cc33");
    showToast(`✅ Shift sent ${action==="sendtoday"?"today":"tomorrow"}`, "success");
  } else {
    msg && (msg.textContent = `⚠️ ${lastErr||"Failed to send"}`); msg && (msg.style.color="#e60000");
    showToast("❌ Send failed", "error");
  }
}

/* ============== GLOBAL BINDS ============== */
window.loginUser = loginUser;
window.openEmployeePanel = openEmployeePanel;
window.sendShiftMessage = sendShiftMessage;
window.updateShiftFromModal = updateShiftFromModal;

/* ============== TOASTS (top-right + bottom-center mini) ============== */
// top-right stack
if (!$("#toastContainer")){
  const c=document.createElement("div");
  c.id="toastContainer";
  Object.assign(c.style,{
    position:"fixed",top:"18px",right:"18px",zIndex:"9999",display:"flex",flexDirection:"column",alignItems:"flex-end"
  });
  document.body.appendChild(c);
}
window.showToast = (msg, type="info")=>{
  const t=document.createElement("div");
  t.className="acw-toast"; t.textContent=msg;
  t.style.background = type==="success" ? "linear-gradient(135deg,#00c851,#007e33)" :
                    type==="error" ? "linear-gradient(135deg,#ff4444,#cc0000)" :
                                     "linear-gradient(135deg,#007bff,#33a0ff)";
  Object.assign(t.style,{
    color:"#fff",padding:"10px 18px",marginTop:"8px",borderRadius:"8px",fontWeight:"600",
    boxShadow:"0 6px 14px rgba(0,0,0,.25)",opacity:"0",transform:"translateY(-10px)",transition:"all .35s ease"
  });
  $("#toastContainer").appendChild(t);
  requestAnimationFrame(()=>{ t.style.opacity="1"; t.style.transform="translateY(0)"; });
  setTimeout(()=>{ t.style.opacity="0"; t.style.transform="translateY(-10px)"; setTimeout(()=>t.remove(),380); }, 2600);
};

// bottom centered mini
(function injectBottomToast(){
  if ($("#acw-toast-style")) return;
  const s=document.createElement("style");
  s.id="acw-toast-style";
  s.textContent= `
    #acwToast{ position:fixed;left:50%;bottom:18px;transform:translateX(-50%);min-width:220px;max-width:92vw;
      padding:10px 14px;border-radius:10px;background:rgba(20,20,20,.85);color:#fff;font-weight:600;font-size:.95em;
      box-shadow:0 10px 30px rgba(0,0,0,.25);backdrop-filter:blur(6px);z-index:99999;opacity:0;pointer-events:none;
      transition:opacity .2s ease;text-align:center}
    #acwToast.show{opacity:1}
    #acwToast .ok{color:#51e37b} #acwToast .err{color:#ff6b6b} #acwToast .info{color:#58aaff}
  `;
  document.head.appendChild(s);
})();
function toastBottom(html,type="info",ms=1500){
  let el=$("#acwToast");
  if(!el){ el=document.createElement("div"); el.id="acwToast"; document.body.appendChild(el); }
  el.innerHTML=`<span class="${type}">${html}</span>`;
  el.classList.add("show"); clearTimeout(el.__t); el.__t=setTimeout(()=>el.classList.remove("show"), ms);
}
console.log("✅ ACW-App v5.6.0 loaded. Base:", (typeof CONFIG!=="undefined"&&CONFIG.BASE_URL)?CONFIG.BASE_URL:"<no-config>");
