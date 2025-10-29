/* ============================================================
   🧠 ACW-App v5.6.2 — Blue Glass White Connected
   Johan A. Giraldo (JAG15) & Sky — Oct 2025
   ============================================================
   - Login conectado a GAS (login, getSmartSchedule, directory)
   - Dashboard: welcome + schedule + live hours + total estable
   - Team View (manager/supervisor) + Employee Modal
   - Envíos sendtoday / sendtomorrow (fallback simple)
   - Change password
   - Restauración de sesión + toasts
   ============================================================ */

let currentUser = null;

/* ============== helpers UI ============== */
function $(sel, root=document){ return root.querySelector(sel); }
function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }
function isManagerRole(role){ return ["manager","supervisor"].includes(String(role||"").toLowerCase()); }

function safeText(el, txt){ if(el) el.textContent = txt; }
function setVisible(el, show){ if(!el) return; el.style.display = show ? "" : "none"; }

/* ============== LOGIN ============== */
async function loginUser() {
  const email = $("#email")?.value.trim();
  const password = $("#password")?.value.trim();
  const diag = $("#diag");
  const btn = $("#signInBtn") || $("#login button");

  if (!email || !password) { safeText(diag, "Please enter your email and password."); return; }

  try {
    if (btn){ btn.disabled = true; btn.innerHTML = "⏳ Loading your shift…"; }
    safeText(diag, "Connecting to Allston Car Wash servers ☀️");

    const res  = await fetch(`${CONFIG.BASE_URL}?action=login&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`, {cache:"no-store"});
    const data = await res.json();

    if (!data?.ok) throw new Error(data?.error || "Invalid email or password.");

    currentUser = data; // {ok,name,email,role,week}
    localStorage.setItem("acwUser", JSON.stringify(data));

    safeText(diag, "✅ Welcome, " + data.name + "!");
    await showWelcome(data.name, data.role);
    await loadSchedule(email);
  } catch (e) {
    safeText(diag, "❌ " + (e.message || "Login error"));
  } finally {
    if (btn){ btn.disabled = false; btn.innerHTML = "Sign In"; }
  }
}

/* ============== WELCOME DASHBOARD ============== */
async function showWelcome(name, role) {
  setVisible($("#login"), false);
  setVisible($("#welcome"), true);
  $("#welcomeName").innerHTML = `<b>${name}</b>`;
  safeText($("#welcomeRole"), role || "");

  if (isManagerRole(role)) addTeamButton();

  // Inserta teléfono del usuario (si existe)
  try {
    const r = await fetch(`${CONFIG.BASE_URL}?action=getEmployeesDirectory`, {cache:"no-store"});
    const j = await r.json();
    if (j.ok && Array.isArray(j.directory)) {
      const self = j.directory.find(e => (e.email||"").toLowerCase() === (currentUser?.email||"").toLowerCase());
      if (self?.phone) {
        $(".user-phone")?.remove();
        $("#welcomeName")?.insertAdjacentHTML("afterend",
          `<p class="user-phone">📞 <a href="tel:${self.phone}" style="color:#0078ff;font-weight:600;text-decoration:none;">${self.phone}</a></p>`
        );
      }
    }
  } catch {}
}

/* ============== LOAD SCHEDULE + LIVE ============== */
async function loadSchedule(email) {
  const schedDiv = $("#schedule");
  schedDiv.innerHTML = `<p style="color:#007bff;font-weight:500;">Loading your shift...</p>`;

  try {
    const r = await fetch(`${CONFIG.BASE_URL}?action=getSmartSchedule&email=${encodeURIComponent(email)}`, {cache:"no-store"});
    const d = await r.json();

    if (!d.ok || !Array.isArray(d.days)) {
      schedDiv.innerHTML = `<p style="color:#c00;">No schedule found for this week.</p>`;
      return;
    }

    let html = `<table><tr><th>Day</th><th>Shift</th><th>Hours</th></tr>`;
    d.days.forEach(day=>{
      const isToday = new Date().toLocaleString("en-US",{weekday:"short"}).slice(0,3).toLowerCase() === day.name.slice(0,3).toLowerCase();
      html += `<tr class="${isToday?"today":""}"><td>${day.name}</td><td>${day.shift||"-"}</td><td>${day.hours||"0"}</td></tr>`;
    });
    html += `</table><p class="total">Total Hours: <b>${(d.total??0).toFixed?.(1) ?? d.total ?? 0}</b></p>`;

    schedDiv.innerHTML = html;

    // Arranca live 1s después para asegurar que el DOM esté
    setTimeout(()=> startLiveTimer(d.days, Number(d.total||0)), 1000);

  } catch (e) {
    console.warn(e);
    schedDiv.innerHTML = `<p style="color:#c00;">Error loading schedule.</p>`;
  }
}

/* ============== SESSION RESTORE ============== */
window.addEventListener("load", () => {
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
  const color = active? "#33a0ff":"#e60000";
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
  Object.assign(badge.style,{display:"block",fontWeight:"600",color:"#33ff66",textShadow:"0 0 10px rgba(51,255,102,.5)",marginBottom:"6px"});
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
        // también pinta dentro de la tabla (Horas de hoy)
        paintLiveInTable(todayKey, diff);
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
    paintLiveInTable(todayKey, diff, /*static*/true);
  }catch(e){ console.warn("Live error:", e); }
}

function paintLiveInTable(todayKey, hours, staticMode=false){
  const table = $("#schedule table"); if (!table) return;
  const row = Array.from(table.rows).find(r=> r.cells?.[0]?.textContent.slice(0,3).toLowerCase()===todayKey);
  if (!row) return;
  row.cells[2].innerHTML = (staticMode? `` : `⏱️ `) + `${hours.toFixed(1)}h`;
  row.cells[2].style.color = staticMode ? "#999" : "#33a0ff";
  row.cells[2].style.fontWeight = staticMode ? "500" : "600";
}

/* ============== SETTINGS ============== */
function openSettings(){ setVisible($("#settingsModal"), true); }
function closeSettings(){ setVisible($("#settingsModal"), false); }
function openChangePassword(){ setVisible($("#changePasswordModal"), true); }
function closeChangePassword(){ setVisible($("#changePasswordModal"), false); }

function refreshApp() {
  try { if ("caches" in window) caches.keys().then(keys=>keys.forEach(k=>caches.delete(k))); } catch {}
  toast("⏳ Updating…", "info");
  setTimeout(()=>location.reload(), 900);
}
function logoutUser(){
  localStorage.removeItem("acwUser");
  toast("👋 Logged out", "info");
  setTimeout(()=>location.reload(), 500);
}

/* ============== CHANGE PASSWORD ============== */
async function submitChangePassword() {
  const oldPass = $("#oldPass")?.value.trim();
  const newPass = $("#newPass")?.value.trim();
  const confirm = $("#confirmPass")?.value.trim();
  const diag = $("#passDiag");

  if (!oldPass || !newPass || !confirm) return safeText(diag, "⚠️ Please fill out all fields.");
  if (newPass !== confirm)   return safeText(diag, "❌ New passwords do not match.");
  if (newPass.length < 6)    return safeText(diag, "⚠️ Password must be at least 6 characters.");

  try {
    safeText(diag, "⏳ Updating password...");
    const email = currentUser?.email;
    if (!email) throw new Error("Session expired. Please log in again.");

    const res = await fetch(`${CONFIG.BASE_URL}?action=changePassword&email=${encodeURIComponent(email)}&oldPass=${encodeURIComponent(oldPass)}&newPass=${encodeURIComponent(newPass)}`, {cache:"no-store"});
    const data = await res.json();

    if (data.ok) {
      safeText(diag, "✅ Password updated successfully!");
      toast("✅ Password updated", "success");
      setTimeout(() => { closeChangePassword(); $("#oldPass").value = $("#newPass").value = $("#confirmPass").value = ""; }, 1200);
    } else {
      safeText(diag, "❌ " + (data.error || "Invalid current password."));
    }
  } catch (err) {
    safeText(diag, "⚠️ " + err.message);
  }
}

/* ============== TEAM VIEW (gestión) ============== */
const TEAM_PAGE_SIZE = 8;
let __teamList=[], __teamPage=0;

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
async function loadEmployeeDirectory() {
  try {
    const r = await fetch(`${CONFIG.BASE_URL}?action=getEmployeesDirectory`, { cache: "no-store" });
    const j = await r.json();
    if (!j.ok) return;

    __teamList = j.directory || [];
    __teamPage = 0;
    renderTeamViewPage();
  } catch (e) {
    console.warn(e);
  }
}

function renderTeamViewPage() {
  // 🔄 Limpia anterior si existe
  $("#directoryWrapper")?.remove();

  // 🧱 Crea el contenedor principal centrado
  const box = document.createElement("div");
  box.id = "directoryWrapper";
  box.className = "directory-wrapper tv-wrapper";
  Object.assign(box.style, {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -48%) scale(0.98)",
    visibility: "hidden",
    opacity: "0",
    background: "rgba(255,255,255,0.97)",
    borderRadius: "16px",
    boxShadow: "0 0 35px rgba(0,128,255,0.3)",
    backdropFilter: "blur(10px)",
    padding: "22px 28px",
    width: "88%",
    maxWidth: "620px",
    zIndex: "9999",
    textAlign: "center",
    transition: "all 0.35s ease"
  });

  // 🧩 Contenido del Team View
  box.innerHTML = `
    <div class="tv-head" style="display:flex;justify-content:space-between;align-items:center;">
      <h3 style="margin:0;color:#0078ff;text-shadow:0 0 8px rgba(0,120,255,0.25);">Team View</h3>
      <button class="tv-close" onclick="toggleTeamOverview()" style="background:none;border:none;font-size:22px;cursor:pointer;">✖️</button>
    </div>
    <div class="tv-pager" style="margin:10px 0;">
      <button class="tv-nav" id="tvPrev" ${__teamPage === 0 ? "disabled" : ""}>‹ Prev</button>
      <span class="tv-index" style="font-weight:600;color:#0078ff;">Page ${__teamPage + 1} / ${Math.max(1, Math.ceil(__teamList.length / TEAM_PAGE_SIZE))}</span>
      <button class="tv-nav" id="tvNext" ${(__teamPage + 1) >= Math.ceil(__teamList.length / TEAM_PAGE_SIZE) ? "disabled" : ""}>Next ›</button>
    </div>
    <table class="directory-table tv-table" style="width:100%;font-size:15px;border-collapse:collapse;margin-top:10px;">
      <tr><th>Name</th><th>Hours</th><th>Live (Working)</th><th></th></tr>
      <tbody id="tvBody"></tbody>
    </table>
  `;

  document.body.appendChild(box);

  // 📊 Carga datos de empleados
  const start = __teamPage * TEAM_PAGE_SIZE;
  const slice = __teamList.slice(start, start + TEAM_PAGE_SIZE);
  const body = $("#tvBody", box);
  body.innerHTML = slice.map(emp => `
    <tr data-email="${emp.email}" data-name="${emp.name}" data-role="${emp.role || ''}" data-phone="${emp.phone || ''}">
      <td><b>${emp.name}</b></td>
      <td class="tv-hours">—</td>
      <td class="tv-live">—</td>
      <td><button class="open-btn" onclick="openEmployeePanel(this)">Open</button></td>
    </tr>`).join("");

  // 📄 Navegación por páginas
  $("#tvPrev", box).onclick = () => { __teamPage = Math.max(0, __teamPage - 1); renderTeamViewPage(); };
  $("#tvNext", box).onclick = () => { __teamPage = Math.min(Math.ceil(__teamList.length / TEAM_PAGE_SIZE) - 1, __teamPage + 1); renderTeamViewPage(); };

  // 🔢 Llenar horas totales
  slice.forEach(async emp => {
    try {
      const r = await fetch(`${CONFIG.BASE_URL}?action=getSmartSchedule&email=${encodeURIComponent(emp.email)}`, { cache: "no-store" });
      const d = await r.json();
      const tr = body.querySelector(`tr[data-email="${CSS.escape(emp.email)}"]`);
      if (tr) tr.querySelector(".tv-hours").textContent = (d && d.ok) ? (Number(d.total || 0)).toFixed(1) : "0";
    } catch { }
  });

  // 🔁 Actualiza Live Status
  updateTeamViewLiveStatus();

  // 🧠 Animación de aparición centrada (sin “baile”)
  setTimeout(() => {
    box.style.visibility = "visible";
    box.style.opacity = "1";
    box.style.transform = "translate(-50%, -50%) scale(1)";
  }, 100);
}
async function updateTeamViewLiveStatus(){
  try{
    const rows = $all(".tv-table tr[data-email]"); if (!rows.length) return;
    for (const row of rows){
      const email=row.dataset.email, liveCell=row.querySelector(".tv-live"), totalCell=row.querySelector(".tv-hours");
      const r = await fetch(`${CONFIG.BASE_URL}?action=getSmartSchedule&email=${encodeURIComponent(email)}`, {cache:"no-store"});
      const d = await r.json(); if (!d.ok || !d.days) continue;

      const todayKey = new Date().toLocaleString("en-US",{weekday:"short"}).slice(0,3).toLowerCase();
      const today = d.days.find(x=> x.name.slice(0,3).toLowerCase()===todayKey);
      if (!today?.shift) { liveCell.innerHTML="—"; continue; }

      if (today.shift.trim().endsWith(".")){
        const startTime = parseTime(today.shift.replace(/\.$/,"").trim());
        if(!startTime) continue;
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
  const modalId = `emp-${email.replace(/[@.]/g,"_")}`;
  if (document.getElementById(modalId)) return;

  let data = null;
  try{
    const r = await fetch(`${CONFIG.BASE_URL}?action=getSmartSchedule&email=${encodeURIComponent(email)}`, {cache:"no-store"});
    data = await r.json();
    if (!data.ok) throw new Error();
  }catch{
    alert("No schedule found for this employee.");
    return;
  }

  const m = document.createElement("div");
  m.className = "employee-modal emp-panel";
  m.id = modalId;

  m.innerHTML = `
    <div class="emp-box">
      <button class="emp-close">×</button>
      <div class="emp-header">
        <h3>${name}</h3>
        ${phone ? `<p class="emp-phone"><a href="tel:${phone}">${phone}</a></p>` : ""}
        <p class="emp-role">${role}</p>
      </div>

      <table class="schedule-mini">
        <tr><th>Day</th><th>Shift</th><th>Hours</th></tr>
        ${(data.days||[]).map(d => `
          <tr data-day="${d.name.slice(0,3)}" data-original="${(d.shift||"-").replace(/"/g,'&quot;')}">
            <td>${d.name}</td>
            <td ${isManagerRole(currentUser?.role) ? 'contenteditable="true"' : ''}>${d.shift||"-"}</td>
            <td>${d.hours||0}</td>
          </tr>`).join("")}
      </table>

      <p class="total">Total Hours: <b id="tot-${name.replace(/\s+/g,"_")}">${data.total||0}</b></p>
      <p class="live-hours"></p>

      ${isManagerRole(currentUser?.role) ? `
        <div class="emp-actions" style="margin-top:10px;">
          <button class="btn-update">✏️ Update Shift</button>
          <button class="btn-today">📤 Send Today</button>
          <button class="btn-tomorrow">📤 Send Tomorrow</button>
          <button class="btn-history">📚 History (5w)</button>
          <p id="empStatusMsg-${email.replace(/[@.]/g,"_")}" class="emp-status-msg" style="margin-top:6px;font-size:.9em;"></p>
        </div>
      ` : ``}

      <button class="emp-refresh" style="margin-top:8px;">⚙️ Check for Updates</button>
    </div>
  `; // ← ← ← Cierra el template string aquí (importante)

  document.body.appendChild(m);

  // binds
  m.querySelector(".emp-close").onclick = () => m.remove();
  const refBtn = m.querySelector(".emp-refresh");
  if (refBtn) {
    refBtn.onclick = () => {
      try { if ("caches" in window) caches.keys().then(k => k.forEach(n => caches.delete(n))); } catch {}
      m.classList.add("flash");
      setTimeout(() => location.reload(), 900);
    };
  }

  if (isManagerRole(currentUser?.role)) {
    m.querySelector(".btn-update").onclick   = () => updateShiftFromModal(email, m);
    m.querySelector(".btn-today").onclick    = () => sendShiftMessage(email, "sendtoday");
    m.querySelector(".btn-tomorrow").onclick = () => sendShiftMessage(email, "sendtomorrow");
    const hb = m.querySelector(".btn-history");
    if (hb) hb.onclick = () => openHistoryFor(email, name);  // botón History
  }

  enableModalLiveShift(m, data.days||[]);
}

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

/* ============== MANAGER ACTIONS (simple fallback) ============== */
async function updateShiftFromModal(targetEmail, modalEl){
  const msg = $(`#empStatusMsg-${targetEmail.replace(/[@.]/g,"_")}`) || $(".emp-status-msg", modalEl);
  const actor = currentUser?.email;
  if (!actor) { msg && (msg.textContent="⚠️ Session expired. Login again."); return; }

  const rows = $all(".schedule-mini tr[data-day]", modalEl);
  const changes = rows.map(r=>{
    const day = r.dataset.day; const newShift = r.cells[1].innerText.trim();
    const original = (r.getAttribute("data-original")||"").trim();
    return (newShift !== original) ? { day, newShift } : null;
  }).filter(Boolean);

  if (!changes.length){ msg && (msg.textContent="No changes to save."); toast("ℹ️ No changes", "info"); return; }

  msg && (msg.textContent="✏️ Saving to Sheets...");
  let ok=0;
  for (const c of changes){
    try{
      const u = `${CONFIG.BASE_URL}?action=updateShift&actor=${encodeURIComponent(actor)}&target=${encodeURIComponent(targetEmail)}&day=${encodeURIComponent(c.day)}&shift=${encodeURIComponent(c.newShift)}`;
      const r = await fetch(u, {cache:"no-store"}); const j = await r.json();
      if (j?.ok) ok++;
    }catch{}
  }
  if (ok===changes.length){ msg.textContent="✅ Updated on Sheets!"; toast("✅ Shifts updated","success"); rows.forEach(r=> r.setAttribute("data-original", r.cells[1].innerText.trim())); }
  else if (ok>0){ msg.textContent=`⚠️ Partial save: ${ok}/${changes.length}`; toast("⚠️ Some shifts failed","error"); }
  else { msg.textContent="❌ Could not update."; toast("❌ Update failed","error"); }
}

/* ============== SEND SHIFT MESSAGE ============== */
/* ============== SEND SHIFT MESSAGE (v5.6.3) ============== */
async function sendShiftMessage(targetEmail, action) {
  const msgBox = document.querySelector(
    `#empStatusMsg-${targetEmail.replace(/[@.]/g, "_")}`
  );
  if (msgBox) msgBox.textContent = "📤 Sending...";
  const actor = currentUser?.email;
  if (!actor) {
    if (msgBox) msgBox.textContent = "⚠️ Session expired";
    return;
  }

  try {
    const url = `${CONFIG.BASE_URL}?action=${action}&actor=${encodeURIComponent(
      actor
    )}&target=${encodeURIComponent(targetEmail)}`;
    const r = await fetch(url, { cache: "no-store" });
    const data = await r.json();

    if (data.ok) {
      const name = data.sent?.name || "Employee";
      const shift = data.sent?.shift || "-";
      const mode = data.sent?.mode?.toUpperCase?.() || action.toUpperCase();

      msgBox.textContent = `✅ ${name} (${mode}) → ${shift}`;
      msgBox.style.color = "#00b341";
      toast(`✅ WhatsApp sent to ${name}`, "success");

      // 🔔 Vibración ligera en móviles
      if (window.navigator.vibrate) window.navigator.vibrate(100);
    } else {
      const err = data.error || "unknown_error";
      msgBox.textContent = `⚠️ ${err}`;
      msgBox.style.color = "#ff4444";
      toast(`⚠️ Send failed (${err})`, "error");
    }
  } catch (err) {
    console.error("sendShiftMessage error:", err);
    msgBox.textContent = "❌ Network error";
    msgBox.style.color = "#ff4444";
  }
}

/* ============== TOASTS ============== */
(function ensureToast(){
  if ($("#toastContainer")) return;
  const c=document.createElement("div"); c.id="toastContainer";
  Object.assign(c.style,{position:"fixed",top:"18px",right:"18px",zIndex:"9999",display:"flex",flexDirection:"column",alignItems:"flex-end"});
  document.body.appendChild(c);
})();
function toast(msg, type="info"){
  const t=document.createElement("div"); t.className="acw-toast"; t.textContent=msg;
  t.style.background = type==="success" ? "linear-gradient(135deg,#00c851,#007e33)" :
                    type==="error" ? "linear-gradient(135deg,#ff4444,#cc0000)" :
                                     "linear-gradient(135deg,#007bff,#33a0ff)";
  Object.assign(t.style,{color:"#fff",padding:"10px 18px",marginTop:"8px",borderRadius:"8px",fontWeight:"600",
    boxShadow:"0 6px 14px rgba(0,0,0,.25)",opacity:"0",transform:"translateY(-10px)",transition:"all .35s ease"});
  $("#toastContainer").appendChild(t);
  requestAnimationFrame(()=>{ t.style.opacity="1"; t.style.transform="translateY(0)"; });
  setTimeout(()=>{ t.style.opacity="0"; t.style.transform="translateY(-10px)"; setTimeout(()=>t.remove(),380); }, 2600);
}

function openChangePassword() {
  const modal = $("#changePasswordModal");
  closeSettings(); // 🔹 cierra el Settings primero
  if (modal) {
    modal.classList.add("show");
    modal.style.display = "flex";
  }
}

function closeChangePassword() {
  const modal = $("#changePasswordModal");
  if (modal) {
    modal.classList.remove("show");
    setTimeout(() => (modal.style.display = "none"), 200);
  }
}

/* ============== GLOBAL BINDS ============== */
window.loginUser = loginUser;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.refreshApp = refreshApp;
window.logoutUser = logoutUser;
window.openChangePassword = openChangePassword;
window.closeChangePassword = closeChangePassword;
window.submitChangePassword = submitChangePassword;
window.openEmployeePanel = openEmployeePanel;
window.sendShiftMessage = sendShiftMessage;
window.updateShiftFromModal = updateShiftFromModal;
window.showWelcome = showWelcome;
window.renderTeamViewPage = renderTeamViewPage;

console.log(`✅ ACW-App loaded → ${CONFIG?.VERSION||"v5.6.2"} | Base: ${CONFIG?.BASE_URL||"<no-config>"}`);

/* ============================================================
   ⚙️ ACW-App Behavior Fix Pack v5.6.2
   Johan A. Giraldo (JAG15) & Sky — Nov 2025
   ============================================================ */

// 🧩 Corrige apertura del Team View con animación suave
const _oldRenderTV = window.renderTeamViewPage;
window.renderTeamViewPage = function(...args) {
  _oldRenderTV.apply(this, args);
  const box = document.querySelector("#directoryWrapper");
  if (box) setTimeout(() => box.classList.add("show"), 50);
};

// 🧩 Reasigna visibilidad del modal de settings
function openSettings() {
  const modal = document.getElementById("settingsModal");
  if (!modal) {
    console.warn("⚠️ Settings modal not found");
    return;
  }
  modal.style.display = "flex";
  modal.style.alignItems = "center";
  modal.style.justifyContent = "center";
}
function closeSettings() {
  const modal = document.getElementById("settingsModal");
  if (modal) modal.style.display = "none";
}

// 🔁 Asegura que las funciones globales sigan disponibles
window.openSettings = openSettings;
window.closeSettings = closeSettings;

/* ============================================================
   ACW — History Picker (Settings-card, 5 weeks) — Clean Build
   Reqs: CONFIG.BASE_URL (GAS), fetchWeekHistory (opcional)
   ============================================================ */

/** 1) Fallback seguro: obtiene 5 semanas por offset si no existe fetchWeekHistory() */
async function __acwHistory5w(email, weeks = 5){
  if (typeof fetchWeekHistory === "function") {
    try { return await fetchWeekHistory(email, weeks); } catch {}
  }
  function weekLabelByOffset(off=0){
    const now=new Date(), day=now.getDay();                 // 0=Sun
    const mon=new Date(now); mon.setHours(0,0,0,0);
    mon.setDate(mon.getDate()-((day+6)%7)-(off*7));         // lunes
    const sun=new Date(mon); sun.setDate(mon.getDate()+6);  // domingo
    const F = d=>d.toLocaleDateString("en-US",{month:"short",day:"numeric"});
    return `${F(mon)} – ${F(sun)}`;
  }

  const out = [];
  for (let i=0; i<weeks; i++){
    try{
      const r = await fetch(`${CONFIG.BASE_URL}?action=getSmartSchedule&email=${encodeURIComponent(email)}&offset=${i}`, {cache:"no-store"});
      const d = await r.json();
      out.push({
        label: d.weekLabel || weekLabelByOffset(i),
        total: Number(d.total||0),
        days:  Array.isArray(d.days) ? d.days : []
      });
    }catch{
      out.push({ label: weekLabelByOffset(i), total: 0, days: [] });
    }
  }
  return out;
}

/** 2) Abre tarjeta centrada tipo Settings */
function openHistoryPicker(email, name="My History"){
  // Cierra si ya está abierta
  document.getElementById("acwhOverlay")?.remove();

  // Overlay + Card
  const overlay = document.createElement("div");
  overlay.id = "acwhOverlay";
  overlay.className = "acwh-overlay";
  overlay.innerHTML = `
    <div class="acwh-card">
      <div class="acwh-head">
        <div style="width:22px"></div>
        <h3 class="acwh-title">History (5 weeks)</h3>
        <button class="acwh-close" aria-label="Close">×</button>
      </div>
      <div class="acwh-sub">${String(name||"").toUpperCase()}</div>
      <div id="acwhBody" class="acwh-list">
        <div class="acwh-row" style="justify-content:center;opacity:.7;">Loading…</div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  // Cerrar con botón o click fuera
  overlay.querySelector(".acwh-close").onclick = () => overlay.remove();
  overlay.addEventListener("click", e=>{ if(e.target===overlay) overlay.remove(); });

  // Render lista inicial
  renderHistoryPickerList(email, name, overlay);
}

/** 3) Lista de semanas (usa fallback seguro) */
async function renderHistoryPickerList(email, name, root){
  const body = root.querySelector("#acwhBody");
  body.className = "acwh-list";

  const hist = await __acwHistory5w(email, 5);

  body.innerHTML = hist.map((w,i)=>`
    <div class="acwh-row" data-idx="${i}">
      <div class="acwh-week">
        <div>${w.label}</div>
        <small>${i===0 ? "Week (current)" : `Week -${i}`}</small>
      </div>
      <div class="acwh-total">${Number(w.total||0).toFixed(1)}h</div>
      <button class="acwh-btn" data-idx="${i}">Open ›</button>
    </div>
  `).join("");

  // Abrir detalle desde la fila o el botón
  body.querySelectorAll(".acwh-row, .acwh-btn").forEach(el=>{
    el.onclick = ()=>{
      const idx = Number(el.dataset.idx || el.closest(".acwh-row")?.dataset.idx || 0);
      renderHistoryDetailCentered(hist[idx], email, name, idx, root);
    };
  });

  // Asegura títulos
  root.querySelector(".acwh-title").textContent = "History (5 weeks)";
  root.querySelector(".acwh-sub").textContent   = String(name||"").toUpperCase();
}

/** 4) Detalle de una semana en la MISMA tarjeta */
function renderHistoryDetailCentered(week, email, name, offset, root){
  const body = root.querySelector("#acwhBody");
  body.className = ""; // modo detalle

  // Header dinámico
  root.querySelector(".acwh-title").textContent = week.label;
  root.querySelector(".acwh-sub").textContent =
    `${offset===0 ? "Week (current)" : `Week -${offset}`} • ${String(name||"").toUpperCase()}`;

  // Tabla de días
  const rows = (week.days||[]).map(d=>{
    const off = /off/i.test(String(d.shift||""));
    const styleCell = off ? 'style="color:#999"' : '';
    const styleHours = off ? 'style="color:#999;text-align:right"' : 'style="text-align:right"';
    return `<tr>
      <td>${d.name||""}</td>
      <td ${styleCell}>${d.shift||'-'}</td>
      <td ${styleHours}>${Number(d.hours||0).toFixed(1)}</td>
    </tr>`;
  }).join("");

  body.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
      <button class="acwh-back">‹ Weeks</button>
      <div class="acwh-total">${Number(week.total||0).toFixed(1)}h</div>
    </div>
    <table class="acwh-table">
      <tr><th>Day</th><th>Shift</th><th>Hours</th></tr>
      ${rows}
    </table>
    <div class="acwh-total-line">Total: ${Number(week.total||0).toFixed(1)}h</div>
  `;

  body.querySelector(".acwh-back").onclick = () =>
    renderHistoryPickerList(email, name, root);
}

/** 5) Exports globales (compat con botones existentes) */
window.openHistoryPicker = openHistoryPicker;
window.openHistoryFor   = (...args)=> openHistoryPicker(...args);

/** 6) Botón “History (5w)” fijo + Hook único al dashboard */
function addHistoryButtonForMe(){
  if (document.getElementById("historyBtnMe")) return;
  const btn = document.createElement("button");
  btn.id="historyBtnMe";
  btn.textContent = "History (5w)";
  btn.style.cssText = "position:fixed;top:25px;left:40px;background:#fff;color:#0078ff;border:2px solid rgba(0,120,255,.4);border-radius:10px;padding:8px 16px;font-weight:600;box-shadow:0 4px 20px rgba(0,120,255,.4);cursor:pointer;z-index:9999;";
  btn.onclick = ()=> openHistoryPicker(currentUser?.email||"", `${currentUser?.name||"Me"}`);
  document.body.appendChild(btn);
}

// Hook único (no duplica si ya fue aplicado)
(function(){
  const prev = window.showWelcome || (async()=>{});
  if (!prev.__acwHookedHistory){
    const wrapped = async function(name, role){
      await prev.call(this, name, role);
      addHistoryButtonForMe();
    };
    wrapped.__acwHookedHistory = true;
    window.showWelcome = wrapped;
  }
})();
