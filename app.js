/* ============================================================
   🧠 ACW-App v5.6.3 — SAFE BUILD (Blue Glass White)
   Johan A. Giraldo (JAG15) & Sky — Nov 2025
   ============================================================
   - CONFIG bootstrap + Sign-in reforzado (timeouts, errores claros)
   - Login → GAS (login, getSmartSchedule, getEmployeesDirectory)
   - Dashboard: welcome + schedule + live hours
   - Team View (estable) + Employee Modal
   - Update Shift (simple, confiable)
   - Send today / tomorrow (frontend → GAS)
   - Change password
   - Session restore + toasts
   ============================================================ */

"use strict";

/* ============== CONFIG (bootstrap seguro) ============== */
const CONFIG = (()=>{
  const fallback = {
    BASE_URL: "https://script.google.com/macros/s/AKfycbx-6DqfjydMMGp-K2z8FeBSH9t8Z1Ooa0Ene0u917RK7Eo6vu80aOTLmCf7lJtm-Ckh/exec",
    VERSION: "v5.6.3-safe"
  };
  try {
    if (window.CONFIG && window.CONFIG.BASE_URL) {
      return { VERSION: "v5.6.3-safe", ...window.CONFIG };
    }
  } catch {}
  return fallback;
})();

/* ============== Helpers básicos ============== */
function $(sel, root=document){ return root.querySelector(sel); }
function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }
function isManagerRole(role){ return ["manager","supervisor"].includes(String(role||"").toLowerCase()); }
function safeText(el, txt){ if(el) el.textContent = txt; }
function setVisible(el, show){ if(!el) return; el.style.display = show ? "" : "none"; }
const cssEscape = (window.CSS && CSS.escape) ? (s)=>CSS.escape(s) : (s)=>String(s).replace(/"/g,'\\"');

let currentUser = null;

/* ============== Network helpers ============== */
async function safeFetchJSON(url, opts={}, timeoutMs=12000){
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), timeoutMs);
  try{
    const res = await fetch(url, { cache:"no-store", redirect:"follow", signal:ctrl.signal, ...opts });
    const txt = await res.text();
    // Intenta parseo seguro
    let json = null;
    try { json = JSON.parse(txt); } catch { json = { ok:false, error:"Invalid JSON from server", _raw:txt }; }
    return json;
  } finally { clearTimeout(t); }
}

/* ============== LOGIN ============== */
async function loginUser() {
  const email = $("#email")?.value?.trim();
  const password = $("#password")?.value?.trim();
  const diag = $("#diag");
  const btn = $("#signInBtn") || $("#login button");

  if (!email || !password) { safeText(diag, "Please enter your email and password."); return; }

  try {
    if (btn){ btn.disabled = true; btn.dataset.old = btn.innerHTML; btn.innerHTML = "⏳ Loading your shift…"; }
    safeText(diag, "Connecting to Allston Car Wash servers ☀️");

    const url = `${CONFIG.BASE_URL}?action=login&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
    const data = await safeFetchJSON(url);

    if (!data?.ok) throw new Error(data?.error || "Invalid email or password.");

    currentUser = data; // {ok,name,email,role,week}
    localStorage.setItem("acwUser", JSON.stringify(data));

    safeText(diag, "✅ Welcome, " + data.name + "!");
    await showWelcome(data.name, data.role);
    await loadSchedule(email);
    safeText(diag, "");
  } catch (e) {
    safeText(diag, "❌ " + (e.message || "Login error"));
  } finally {
    if (btn){ btn.disabled = false; btn.innerHTML = btn.dataset.old || "Sign In"; }
  }
}

/* Enlaza enter/submit y botón de forma segura */
(function bindLoginUI(){
  window.addEventListener("DOMContentLoaded", ()=>{
    const form = $("#login") || document;
    const btn = $("#signInBtn");
    if (btn && !btn._bound){ btn._bound = true; btn.addEventListener("click", (ev)=>{ ev.preventDefault(); loginUser(); }); }
    if (form && !form._submitBound){
      form._submitBound = true;
      form.addEventListener("submit", (ev)=>{ ev.preventDefault(); loginUser(); });
    }
    // ENTER en campos
    const email = $("#email"), pass = $("#password");
    [email, pass].forEach(inp=>{
      if (inp && !inp._enterBound){
        inp._enterBound = true;
        inp.addEventListener("keydown", e=>{ if(e.key==="Enter"){ e.preventDefault(); loginUser(); } });
      }
    });
  });
})();

/* ============== WELCOME DASHBOARD ============== */
async function showWelcome(name, role) {
  setVisible($("#login"), false);
  setVisible($("#welcome"), true);
  if ($("#welcomeName")) $("#welcomeName").innerHTML = `<b>${name}</b>`;
  safeText($("#welcomeRole"), role || "");

  if (isManagerRole(role)) addTeamButton();

  // Inserta teléfono del usuario (si existe)
  try {
    const j = await safeFetchJSON(`${CONFIG.BASE_URL}?action=getEmployeesDirectory`);
    if (j.ok && Array.isArray(j.directory)) {
      const self = j.directory.find(e => (String(e.email||"").toLowerCase()) === (String(currentUser?.email||"").toLowerCase()));
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
  if (schedDiv) schedDiv.innerHTML = `<p style="color:#007bff;font-weight:500;">Loading your shift...</p>`;

  try {
    const d = await safeFetchJSON(`${CONFIG.BASE_URL}?action=getSmartSchedule&email=${encodeURIComponent(email)}`);

    if (!d.ok || !Array.isArray(d.days)) {
      if (schedDiv) schedDiv.innerHTML = `<p style="color:#c00;">No schedule found for this week.</p>`;
      return;
    }

    let html = `<table><tr><th>Day</th><th>Shift</th><th>Hours</th></tr>`;
    d.days.forEach(day=>{
      const isToday = new Date().toLocaleString("en-US",{weekday:"short"}).slice(0,3).toLowerCase() === day.name.slice(0,3).toLowerCase();
      html += `<tr class="${isToday?"today":""}"><td>${day.name}</td><td>${day.shift||"-"}</td><td>${day.hours||"0"}</td></tr>`;
    });
    html += `</table><p class="total">Total Hours: <b>${(d.total??0).toFixed?.(1) ?? Number(d.total||0)}</b></p>`;

    if (schedDiv) schedDiv.innerHTML = html;

    // Arranca live 1s después
    setTimeout(()=> startLiveTimer(d.days, Number(d.total||0)), 1000);

  } catch (e) {
    console.warn(e);
    if (schedDiv) schedDiv.innerHTML = `<p style="color:#c00;">Error loading schedule.</p>`;
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
  const oldPass = $("#oldPass")?.value?.trim();
  const newPass = $("#newPass")?.value?.trim();
  const confirm  = $("#confirmPass")?.value?.trim();
  const diag = $("#passDiag");

  if (!oldPass || !newPass || !confirm) return safeText(diag, "⚠️ Please fill out all fields.");
  if (newPass !== confirm)   return safeText(diag, "❌ New passwords do not match.");
  if (newPass.length < 6)    return safeText(diag, "⚠️ Password must be at least 6 characters.");

  try {
    safeText(diag, "⏳ Updating password...");
    const email = currentUser?.email;
    if (!email) throw new Error("Session expired. Please log in again.");

    const url = `${CONFIG.BASE_URL}?action=changePassword&email=${encodeURIComponent(email)}&oldPass=${encodeURIComponent(oldPass)}&newPass=${encodeURIComponent(newPass)}`;
    const data = await safeFetchJSON(url);

    if (data.ok) {
      safeText(diag, "✅ Password updated successfully!");
      toast("✅ Password updated", "success");
      setTimeout(() => { closeChangePassword(); $("#oldPass").value = $("#newPass").value = $("#confirmPass").value = ""; }, 900);
    } else {
      safeText(diag, "❌ " + (data.error || "Invalid current password."));
    }
  } catch (err) {
    safeText(diag, "⚠️ " + (err.message || "Network error"));
  }
}

/* ============== TEAM VIEW (estable) ============== */
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
async function loadEmployeeDirectory(){
  try{
    const j = await safeFetchJSON(`${CONFIG.BASE_URL}?action=getEmployeesDirectory`);
    if (!j.ok) return;

    __teamList = j.directory||[]; __teamPage=0; renderTeamViewPage();
  }catch(e){ console.warn(e); }
}
function renderTeamViewPage(){
  $("#directoryWrapper")?.remove();
  const box=document.createElement("div");
  box.id="directoryWrapper"; box.className="directory-wrapper tv-wrapper";
  box.style.display="flex"; box.style.flexDirection="column"; box.style.alignItems="center";

  box.innerHTML = `
    <div class="tv-head" style="display:flex;justify-content:space-between;align-items:center;width:100%;">
      <h3 style="margin:0;color:#0078ff;">Team View</h3>
      <button class="tv-close" onclick="toggleTeamOverview()" style="background:none;border:none;font-size:22px;cursor:pointer;">✖️</button>
    </div>
    <div class="tv-pager" style="margin:10px 0;">
      <button class="tv-nav" id="tvPrev" ${__teamPage===0?"disabled":""}>‹ Prev</button>
      <span class="tv-index" style="font-weight:600;color:#0078ff;">Page ${__teamPage+1} / ${Math.max(1, Math.ceil(__teamList.length/TEAM_PAGE_SIZE))}</span>
      <button class="tv-nav" id="tvNext" ${(__teamPage+1)>=Math.ceil(__teamList.length/TEAM_PAGE_SIZE)?"disabled":""}>Next ›</button>
    </div>
    <table class="directory-table tv-table" style="margin-top:10px;min-width:460px;text-align:center;width:100%;">
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
      const d = await safeFetchJSON(`${CONFIG.BASE_URL}?action=getSmartSchedule&email=${encodeURIComponent(emp.email)}`);
      const tr = body.querySelector(`tr[data-email="${cssEscape(emp.email)}"]`);
      if (tr) tr.querySelector(".tv-hours").textContent = (d && d.ok) ? (Number(d.total||0)).toFixed(1) : "0";
    }catch{}
  });

  updateTeamViewLiveStatus();
}
async function updateTeamViewLiveStatus(){
  try{
    const rows = $all(".tv-table tr[data-email]"); if (!rows.length) return;
    for (const row of rows){
      const email=row.dataset.email, liveCell=row.querySelector(".tv-live"), totalCell=row.querySelector(".tv-hours");
      const d = await safeFetchJSON(`${CONFIG.BASE_URL}?action=getSmartSchedule&email=${encodeURIComponent(email)}`);
      if (!d.ok || !d.days) continue;

      const todayKey = new Date().toLocaleString("en-US",{weekday:"short"}).slice(0,3).toLowerCase();
      const today = d.days.find(x=> x.name.slice(0,3).toLowerCase()===todayKey);
      if (!today?.shift) { liveCell.innerHTML="—"; continue; }

      if (today.shift.trim().endsWith(".")){
        const startTime = parseTime(today.shift.replace(/\.$/,"").trim());
        if(!startTime) continue;
        const diff = Math.max(0,(Date.now()-startTime.getTime())/36e5);
        liveCell.innerHTML = `🟢 ${diff.toFixed(1)}h`;
        liveCell.style.color="#33ff66"; liveCell.style.fontWeight="600";
        const base = parseFloat(totalCell.textContent)||0;
        totalCell.innerHTML = `${(base+diff).toFixed(1)} <span style="color:#33a0ff;font-size:.85em;">(+${diff.toFixed(1)})</span>`;
      }else{
        liveCell.innerHTML="—"; liveCell.style.color="#aaa"; liveCell.style.fontWeight="400";
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
    data = await safeFetchJSON(`${CONFIG.BASE_URL}?action=getSmartSchedule&email=${encodeURIComponent(email)}`);
    if (!data.ok) throw new Error();
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
      <p class="live-hours"></p>
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

  enableModalLiveShift(m, data.days);
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

/* ============== MANAGER ACTIONS (simple y confiable) ============== */
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
      const j = await safeFetchJSON(u);
      if (j?.ok) ok++;
    }catch(e){ console.warn("Update error:", e); }
  }
  if (ok===changes.length){ msg.textContent="✅ Updated on Sheets!"; toast("✅ Shifts updated","success"); rows.forEach(r=> r.setAttribute("data-original", r.cells[1].innerText.trim())); }
  else if (ok>0){ msg.textContent=`⚠️ Partial save: ${ok}/${changes.length}`; toast("⚠️ Some shifts failed","error"); }
  else { msg.textContent="❌ Could not update."; toast("❌ Update failed","error"); }
}

async function sendShiftMessage(targetEmail, action){
  const msg = $(`#empStatusMsg-${targetEmail.replace(/[@.]/g,"_")}`);
  msg && (msg.textContent="💬 Sending...");
  const actor = currentUser?.email; if (!actor){ msg && (msg.textContent="⚠️ Session expired"); return; }

  try{
    const url = `${CONFIG.BASE_URL}?action=${action}&actor=${encodeURIComponent(actor)}&target=${encodeURIComponent(targetEmail)}`;
    const j = await safeFetchJSON(url);
    if (j?.ok){ msg.textContent = action==="sendtoday" ? "✅ Sent Today" : "✅ Sent Tomorrow"; toast("✅ Shift message sent","success"); }
    else { msg.textContent = `⚠️ ${j?.error||"Failed to send"}`; toast("❌ Send failed","error"); }
  }catch(e){ msg && (msg.textContent="⚠️ Connection error"); toast("❌ Connection error","error"); }
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

/* ============== Global binds ============== */
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

console.log(`✅ ACW-App SAFE loaded → ${CONFIG?.VERSION||"v5.6.3-safe"} | Base: ${CONFIG?.BASE_URL||"<no-config>"}`);
