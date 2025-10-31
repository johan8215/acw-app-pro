/* ============================================================
   🧠 ACW-App v5.6.3 Turbo — Blue Glass White Connected
   Johan A. Giraldo (JAG15) & Sky — Nov 2025
   ============================================================
   Mejoras clave:
   - Caché en memoria con TTL (desduplica y acelera)
   - Team View sin intervalos cuando está cerrado
   - Carga por página con concurrencia limitada
   - AbortController para cancelar al cerrar
   - Menos repaints/DOM touches
   ============================================================ */

let currentUser = null;

/* =================== Utils / Core =================== */
function $(sel, root=document){ return root.querySelector(sel); }
function $all(sel, root=document){ return Array.from(root.querySelectorAll(sel)); }
function isManagerRole(role){ return ["manager","supervisor"].includes(String(role||"").toLowerCase()); }
function safeText(el, txt){ if(el) el.textContent = txt; }
function setVisible(el, show){ if(!el) return; el.style.display = show ? "" : "none"; }
function cssEscape(s){ try{return CSS.escape(s);}catch{ return String(s).replace(/[^a-zA-Z0-9_\-]/g,"_"); } }

/* Hoy cacheado + refresco a medianoche */
const Today = (()=> {
  let key = new Date().toLocaleString("en-US",{weekday:"short"}).slice(0,3).toLowerCase();
  // programa cambio a medianoche
  const now = new Date();
  const next = new Date(now); next.setHours(24,0,0,0);
  setTimeout(()=>{ key = new Date().toLocaleString("en-US",{weekday:"short"}).slice(0,3).toLowerCase(); }, next-now+50);
  return { get key(){ return key; } };
})();

/* Caché en memoria con TTL + de-dupe */
const Net = (()=> {
  const store = new Map(); // key -> {expires, value} | inflight: Promise
  function get(key){
    const it = store.get(key);
    if (!it) return null;
    if (it.value && it.expires > Date.now()) return it.value;
    if (it.inflight) return it.inflight; // de-dupe concurrente
    store.delete(key);
    return null;
  }
  function set(key, value, ttl){
    store.set(key, { value, expires: Date.now()+ttl });
    return value;
  }
  function setInflight(key, p){
    store.set(key, { inflight: p, expires: 0 });
  }
  function clearInflight(key){
    const it = store.get(key);
    if (it && it.inflight) store.delete(key);
  }
  return { get, set, setInflight, clearInflight };
})();

/* fetch JSON con TTL y dedupe */
async function fetchJSON(url, { ttl=0, signal } = {}){
  if (ttl>0){
    const cached = Net.get(url);
    if (cached) return cached;
  }
  const inflight = fetch(url, { cache:"no-store", signal }).then(r=>r.json());
  if (ttl>0) Net.setInflight(url, inflight);
  try{
    const data = await inflight;
    if (ttl>0) Net.set(url, data, ttl);
    return data;
  }finally{
    if (ttl>0) Net.clearInflight(url);
  }
}

/* API helpers con TTL inteligentes */
const API = {
  dirTTL: 5*60*1000,         // 5 min
  schedTTL0: 60*1000,        // semana actual 60s (para live y TeamView)
  schedTTLOld: 5*60*1000,    // semanas -1..-4 más relajado

  getDirectory(controller){
    const u = `${CONFIG.BASE_URL}?action=getEmployeesDirectory`;
    return fetchJSON(u, { ttl: API.dirTTL, signal: controller?.signal });
  },
  getSchedule(email, offset=0, controller){
    const ttl = offset===0 ? API.schedTTL0 : API.schedTTLOld;
    const u = `${CONFIG.BASE_URL}?action=getSmartSchedule&email=${encodeURIComponent(email)}&offset=${offset}`;
    return fetchJSON(u, { ttl, signal: controller?.signal });
  }
};

/* Concurrencia limitada simple (p-limit) */
function runLimited(items, limit, iteratee){
  const queue = [...items];
  let running = 0;
  return new Promise((resolve) => {
    const results = new Array(items.length);
    let idx = 0, done = 0;
    function next(){
      while (running < limit && idx < items.length){
        const cur = idx++;
        running++;
        Promise.resolve(iteratee(items[cur], cur))
          .then(res => { results[cur]=res; })
          .finally(()=>{
            running--; done++;
            if (done===items.length) return resolve(results);
            next();
          });
      }
    }
    next();
  });
}

/* =================== LOGIN =================== */
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

/* =================== WELCOME DASHBOARD =================== */
async function showWelcome(name, role) {
  setVisible($("#login"), false);
  setVisible($("#welcome"), true);
  $("#welcomeName").innerHTML = `<b>${name}</b>`;
  safeText($("#welcomeRole"), role || "");

  if (isManagerRole(role)) addTeamButton();

  // Teléfono del usuario (usando caché de directorio)
  try {
    const dir = await API.getDirectory();
    if (dir?.ok && Array.isArray(dir.directory)) {
      const self = dir.directory.find(e => (e.email||"").toLowerCase() === (currentUser?.email||"").toLowerCase());
      if (self?.phone) {
        $(".user-phone")?.remove();
        $("#welcomeName")?.insertAdjacentHTML("afterend",
          `<p class="user-phone">📞 <a href="tel:${self.phone}" style="color:#0078ff;font-weight:600;text-decoration:none;">${self.phone}</a></p>`
        );
      }
    }
  } catch {}
}

/* =================== LOAD SCHEDULE + LIVE =================== */
async function loadSchedule(email) {
  const schedDiv = $("#schedule");
  schedDiv.innerHTML = `<p style="color:#007bff;font-weight:500;">Loading your shift...</p>`;

  try {
    const d = await API.getSchedule(email, 0);
    if (!d?.ok || !Array.isArray(d.days)) {
      schedDiv.innerHTML = `<p style="color:#c00;">No schedule found for this week.</p>`;
      return;
    }

    let html = `<table><tr><th>Day</th><th>Shift</th><th>Hours</th></tr>`;
    const todayKey = Today.key;
    d.days.forEach(day=>{
      const isToday = todayKey === day.name.slice(0,3).toLowerCase();
      html += `<tr class="${isToday?"today":""}"><td>${day.name}</td><td>${day.shift||"-"}</td><td>${day.hours||"0"}</td></tr>`;
    });
    const totalFmt = (d.total??0);
    html += `</table><p class="total">Total Hours: <b>${Number(totalFmt).toFixed(1)}</b></p>`;
    schedDiv.innerHTML = html;

    // Arranca live tras DOM listo
    clearInterval(window.__acwLiveTick__); // evita duplicados
    setTimeout(()=> startLiveTimer(d.days, Number(d.total||0)), 300);

  } catch (e) {
    console.warn(e);
    schedDiv.innerHTML = `<p style="color:#c00;">Error loading schedule.</p>`;
  }
}

/* =================== SESSION RESTORE =================== */
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

/* =================== LIVE TIMER (dashboard) =================== */
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
  const html = `⚪ Total Hours: <b>${value.toFixed(1)}</b>`;
  if (totalEl.__lastHTML !== html){
    totalEl.__lastHTML = html;
    totalEl.innerHTML = `<span style="color:${color}">${html}</span>`;
  }
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
    const todayKey = Today.key;
    const today = days.find(d=> d.name.slice(0,3).toLowerCase()===todayKey);
    if(!today || !today.shift || /off/i.test(today.shift)) return;

    const shift = today.shift.trim();
    removeOnlineBadge();

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

/* =================== SETTINGS =================== */
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
(function ensureShareCSS(){
  if (document.getElementById('acw-share-css')) return;
  const s = document.createElement('style'); s.id = 'acw-share-css';
  s.textContent = `
    /* Botón Share junto a la X */
    .acwh-head{ display:flex; align-items:center; justify-content:space-between; gap:8px; }
    .acwh-head .acwh-share{
      background:#ff4d4f; color:#fff; border:0; border-radius:10px;
      padding:6px 10px; font-weight:700; cursor:pointer;
      box-shadow:0 2px 8px rgba(255,77,79,.35);
    }
    .acwh-head .acwh-share:active{ transform:translateY(1px); }

    /* MODO NÍTIDO PARA CAPTURA */
    #acwhOverlay[data-share="1"]{
      background: transparent !important;
      backdrop-filter: none !important;
      filter: none !important;
    }
    #acwhOverlay[data-share="1"] .acwh-card{
      background:#ffffff !important;
      opacity:1 !important;
      filter:none !important;
      backdrop-filter:none !important;
      box-shadow:none !important; /* evita velo gris */
    }
    /* por si algún hijo tiene opacidades/filtros */
    #acwhOverlay[data-share="1"] .acwh-card *{
      opacity:1 !important;
      filter:none !important;
    }
  `;
  document.head.appendChild(s);
})();

/* =================== CHANGE PASSWORD =================== */
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

/* =================== TEAM VIEW (gestión) =================== */
const TEAM_PAGE_SIZE = 8;
let __teamList=[], __teamPage=0;
let __tvController = null;      // Abort controller del TV
let __tvIntervalId = null;      // Interval solo cuando está abierto

function addTeamButton(){
  if ($("#teamBtn")) return;
  const btn = document.createElement("button");
  btn.id="teamBtn"; btn.className="team-btn"; btn.textContent="Team View";
  btn.onclick = toggleTeamOverview; document.body.appendChild(btn);
}
function toggleTeamOverview(){
  const w = $("#directoryWrapper");
  if (w){
    w.classList.add("fade-out");
    setTimeout(()=>{ w.remove(); }, 180);
    if (__tvIntervalId){ clearInterval(__tvIntervalId); __tvIntervalId=null; }
    if (__tvController){ __tvController.abort(); __tvController=null; }
    return;
  }
  loadEmployeeDirectory();
}
async function loadEmployeeDirectory() {
  try {
    __tvController?.abort();
    __tvController = new AbortController();

    const j = await API.getDirectory(__tvController);
    if (!j?.ok) return;

    __teamList = j.directory || [];
    __teamPage = 0;
    renderTeamViewPage();
  } catch (e) {
    if (e.name!=="AbortError") console.warn(e);
  }
}

function renderTeamViewPage() {
  $("#directoryWrapper")?.remove();

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

  $("#tvPrev", box).onclick = () => { __teamPage = Math.max(0, __teamPage - 1); renderTeamViewPage(); };
  $("#tvNext", box).onclick = () => { __teamPage = Math.min(Math.ceil(__teamList.length / TEAM_PAGE_SIZE) - 1, __teamPage + 1); renderTeamViewPage(); };

  // Horas totales del slice con concurrencia limitada (4)
  const todayKey = Today.key;
  runLimited(slice, 4, async (emp)=>{
    try{
      const d = await API.getSchedule(emp.email, 0, __tvController);
      const tr = body.querySelector(`tr[data-email="${cssEscape(emp.email)}"]`);
      if (!tr) return;
      tr.querySelector(".tv-hours").textContent = (d && d.ok) ? (Number(d.total || 0)).toFixed(1) : "0";

      // Live
      const liveCell = tr.querySelector(".tv-live");
      const today = d?.days?.find(x=> x.name.slice(0,3).toLowerCase()===todayKey);
      if (!today?.shift){ liveCell.textContent="—"; return; }

      if (today.shift.trim().endsWith(".")){
        const startTime = parseTime(today.shift.replace(/\.$/,"").trim());
        if (!startTime) return;
        const diff = Math.max(0,(Date.now()-startTime.getTime())/36e5);
        liveCell.innerHTML = `🟢 ${diff.toFixed(1)}h`;
        liveCell.style.color="#33ff66"; liveCell.style.fontWeight="600"; liveCell.style.textShadow="0 0 10px rgba(51,255,102,.6)";
        const totalCell = tr.querySelector(".tv-hours");
        const base = parseFloat(totalCell.textContent)||0;
        totalCell.innerHTML = `${(base+diff).toFixed(1)} <span style="color:#33a0ff;font-size:.85em;">(+${diff.toFixed(1)})</span>`;
      } else {
        liveCell.textContent = "—";
        liveCell.style.color="#aaa"; liveCell.style.fontWeight="400"; liveCell.style.textShadow="none";
      }
    }catch(e){}
  });

  // Interval SOLO mientras Team View está visible (cada 2 min)
  if (__tvIntervalId){ clearInterval(__tvIntervalId); __tvIntervalId=null; }
  __tvIntervalId = setInterval(async ()=>{
    const rows = $all(".tv-table tr[data-email]", box);
    const sliceNow = rows.map(r=>({
      email: r.dataset.email, rowEl: r
    }));
    // actualiza live del slice usando caché de 60s
    await runLimited(sliceNow, 4, async (info)=>{
      const d = await API.getSchedule(info.email, 0, __tvController);
      const today = d?.days?.find(x=> x.name.slice(0,3).toLowerCase()===Today.key);
      const liveCell = info.rowEl.querySelector(".tv-live");
      const totalCell= info.rowEl.querySelector(".tv-hours");
      if (!today?.shift){ liveCell.textContent="—"; return; }
      if (today.shift.trim().endsWith(".")){
        const startTime = parseTime(today.shift.replace(/\.$/,"").trim());
        if (!startTime) return;
        const diff = Math.max(0,(Date.now()-startTime.getTime())/36e5);
        liveCell.innerHTML = `🟢 ${diff.toFixed(1)}h`;
        liveCell.style.color="#33ff66"; liveCell.style.fontWeight="600"; liveCell.style.textShadow="0 0 10px rgba(51,255,102,.6)";
        const base = parseFloat(totalCell.textContent)||0;
        if (!/span/.test(totalCell.innerHTML)){
          totalCell.innerHTML = `${(base+diff).toFixed(1)} <span style="color:#33a0ff;font-size:.85em;">(+${diff.toFixed(1)})</span>`;
        }
      } else {
        liveCell.textContent = "—";
        liveCell.style.color="#aaa"; liveCell.style.fontWeight="400"; liveCell.style.textShadow="none";
      }
    });
  }, 120000);

  // Animación de aparición
  setTimeout(() => {
    box.style.visibility = "visible";
    box.style.opacity = "1";
    box.style.transform = "translate(-50%, -50%) scale(1)";
  }, 60);
}

/* =================== EMPLOYEE MODAL =================== */
async function openEmployeePanel(btnEl){
  const tr = btnEl.closest("tr");
  const email = tr.dataset.email, name = tr.dataset.name, role = tr.dataset.role||"", phone = tr.dataset.phone||"";
  const modalId = `emp-${email.replace(/[@.]/g,"_")}`;
  if (document.getElementById(modalId)) return;

  let data = null;
  try{
    data = await API.getSchedule(email, 0);
    if (!data?.ok) throw new Error();
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
  `;
  document.body.appendChild(m);

  // binds
  m.querySelector(".emp-close").onclick = () => m.remove();
  const refBtn = m.querySelector(".emp-refresh");
  if (refBtn) {
    refBtn.onclick = () => {
      try { if ("caches" in window) caches.keys().then(k => k.forEach(n => caches.delete(n))); } catch {}
      m.classList.add("flash");
      setTimeout(() => location.reload(), 600);
    };
  }

  if (isManagerRole(currentUser?.role)) {
    m.querySelector(".btn-update").onclick   = () => updateShiftFromModal(email, m);
    m.querySelector(".btn-today").onclick    = () => sendShiftMessage(email, "sendtoday");
    m.querySelector(".btn-tomorrow").onclick = () => sendShiftMessage(email, "sendtomorrow");
    const hb = m.querySelector(".btn-history");
    if (hb) hb.onclick = () => openHistoryFor(email, name);
  }

  enableModalLiveShift(m, data.days||[]);
}

function enableModalLiveShift(modal, days){
  try{
    const key = Today.key;
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

/* =================== MANAGER ACTIONS =================== */
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

/* =================== SEND SHIFT MESSAGE =================== */
async function sendShiftMessage(targetEmail, action) {
  const msgBox = document.querySelector(`#empStatusMsg-${targetEmail.replace(/[@.]/g, "_")}`);
  if (msgBox) msgBox.textContent = "📤 Sending...";
  const actor = currentUser?.email;
  if (!actor) { if (msgBox) msgBox.textContent = "⚠️ Session expired"; return; }

  try {
    const url = `${CONFIG.BASE_URL}?action=${action}&actor=${encodeURIComponent(actor)}&target=${encodeURIComponent(targetEmail)}`;
    const r = await fetch(url, { cache: "no-store" });
    const data = await r.json();

    if (data.ok) {
      const name = data.sent?.name || "Employee";
      const shift = data.sent?.shift || "-";
      const mode = data.sent?.mode?.toUpperCase?.() || action.toUpperCase();

      if (msgBox){ msgBox.textContent = `✅ ${name} (${mode}) → ${shift}`; msgBox.style.color = "#00b341"; }
      toast(`✅ WhatsApp sent to ${name}`, "success");
      if (window.navigator.vibrate) window.navigator.vibrate(100);
    } else {
      const err = data.error || "unknown_error";
      if (msgBox){ msgBox.textContent = `⚠️ ${err}`; msgBox.style.color = "#ff4444"; }
      toast(`⚠️ Send failed (${err})`, "error");
    }
  } catch (err) {
    console.error("sendShiftMessage error:", err);
    if (msgBox){ msgBox.textContent = "❌ Network error"; msgBox.style.color = "#ff4444"; }
  }
}

/* =================== TOASTS =================== */
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

/* =================== HISTORY (ligero y en caché) =================== */
async function __acwHistory5w(email, weeks = 5){
  // 5 semanas en paralelo (usa cache de API.getSchedule con TTL)
  const tasks = Array.from({length:weeks}, (_,i)=> i);
  const mkLabel = (off=0)=>{
    const now=new Date(), day=now.getDay();
    const mon=new Date(now); mon.setHours(0,0,0,0);
    mon.setDate(mon.getDate()-((day+6)%7)-(off*7));
    const sun=new Date(mon); sun.setDate(mon.getDate()+6);
    const F=d=>d.toLocaleDateString("en-US",{month:"short",day:"numeric"});
    return `${F(mon)} – ${F(sun)}`;
  };
  const settled = await runLimited(tasks, 3, async (off)=>{
    try{
      const d = await API.getSchedule(email, off);
      if (d?.ok) return { label: d.weekLabel || mkLabel(off), total: Number(d.total||0), days: Array.isArray(d.days)?d.days:[] };
    }catch{}
    return { label: mkLabel(off), total: 0, days: [] };
  });
  return settled;
}
function openHistoryPicker(email, name="My History"){
  document.getElementById("acwhOverlay")?.remove();
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
   __attachHistoryShare(overlay);
  overlay.querySelector(".acwh-close").onclick = () => overlay.remove();
  overlay.addEventListener("click", e=>{ if(e.target===overlay) overlay.remove(); });
  renderHistoryPickerList(email, name, overlay);
}

// Botón Share pegado a la X (se crea una sola vez por overlay)
function __attachHistoryShare(root = document){
  const head = root.querySelector('.acwh-head');
  if (!head) return;

  let btn = head.querySelector('.acwh-share');
  if (!btn){
    btn = document.createElement('button');
    btn.className = 'acwh-share';
    btn.type = 'button';
    btn.textContent = 'Share';
    // lo insertamos justo antes de la X
    head.insertBefore(btn, head.querySelector('.acwh-close') || null);
  }

  // acción del botón
btn.onclick = async ()=>{
  const overlay = root.closest('#acwhOverlay') || root;
  const card     = overlay.querySelector('.acwh-card') || overlay;
  const title    = overlay.querySelector('.acwh-title')?.textContent?.trim() || 'History';
  const who      = overlay.querySelector('.acwh-sub')?.textContent?.trim() || (currentUser?.name || 'ACW');

  // Activa modo nítido (quita vidrio/oscurecidos) solo para la captura
  overlay.setAttribute('data-share','1');
  await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))); // asegura estilos aplicados

  try{
    await __shareElAsImage(card, `${who} — ${title}.png`);
  } finally {
    overlay.removeAttribute('data-share'); // vuelve a normal
  }
};
// === SHARE (fallback claro y seguro) ===
async function __ensureH2C(){
  if (window.html2canvas) return;
  await new Promise((ok, fail)=>{
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
    s.onload = ok; s.onerror = ()=>fail(new Error('html2canvas load failed'));
    document.head.appendChild(s);
  });
}

async function __shareElAsImage(el, filename='acw.png'){
  try{
    await __ensureH2C();
    const canvas = await html2canvas(el, {
      backgroundColor: '#ffffff',               // fondo claro (no oscurece)
      scale: Math.min(2, window.devicePixelRatio || 1.5), // nítido pero estable
      useCORS: true
    });
    const blob = await new Promise(res => canvas.toBlob(res, 'image/png', 0.95));
    const file = new File([blob], filename, { type: 'image/png' });

    // 1) Share nativo (si existe)
    try{
      if (navigator.canShare && navigator.canShare({ files:[file] })){
        await navigator.share({ files:[file] });
        toast('✅ Shared image','success'); 
        return;
      }
    }catch{}

    // 2) Copiar al portapapeles (si existe)
    try{
      if (navigator.clipboard && window.ClipboardItem){
        await navigator.clipboard.write([ new ClipboardItem({ 'image/png': blob }) ]);
        toast('📋 Image copied to clipboard','success'); 
        return;
      }
    }catch{}

    // 3) Abrir en pestaña (fallback)
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    toast('ℹ️ Opened image in new tab','info');
  }catch(e){
    console.warn('share error', e);
    toast('❌ Share failed','error');
  }
}
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
  body.querySelectorAll(".acwh-row, .acwh-btn").forEach(el=>{
    el.onclick = ()=>{
      const idx = Number(el.dataset.idx || el.closest(".acwh-row")?.dataset.idx || 0);
      renderHistoryDetailCentered(hist[idx], email, name, idx, root);
    };
  });
  root.querySelector(".acwh-title").textContent = "History (5 weeks)";
  root.querySelector(".acwh-sub").textContent   = String(name||"").toUpperCase();
   __attachHistoryShare(root);
}
function renderHistoryDetailCentered(week, email, name, offset, root){
  const body = root.querySelector("#acwhBody");
  body.className = "";
  root.querySelector(".acwh-title").textContent = week.label;
  root.querySelector(".acwh-sub").textContent =
    `${offset===0 ? "Week (current)" : `Week -${offset}`} • ${String(name||"").toUpperCase()}`;
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
  body.querySelector(".acwh-back").onclick = () => renderHistoryPickerList(email, name, root);
   __attachHistoryShare(root);
}
(function(){
  const id='acw-share-css';
  if (document.getElementById(id)) return;
  const s=document.createElement('style'); s.id=id;
  s.textContent = `
    .acwh-head{ display:flex; align-items:center; justify-content:space-between; gap:8px; }
    .acwh-head .acwh-share{
      background:#ff4d4f; border:none; color:#fff; font-weight:700;
      padding:6px 10px; border-radius:12px; box-shadow:0 2px 6px rgba(0,0,0,.15);
    }
    .acwh-head .acwh-share:active{ transform:scale(.98); }
  `;
  document.head.appendChild(s);
})();

/* =================== GLOBAL BINDS =================== */
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
window.openHistoryPicker = openHistoryPicker;
window.openHistoryFor   = (...args)=> openHistoryPicker(...args);

console.log(`✅ ACW-App loaded → ${CONFIG?.VERSION||"v5.6.3 Turbo"} | Base: ${CONFIG?.BASE_URL||"<no-config>"}`);

/* =================== UI micro-fix (TV show class) =================== */
(function(){
  const prev = typeof window.renderTeamViewPage==='function' ? window.renderTeamViewPage : null;
  if (!prev) return;
  window.renderTeamViewPage = function(...args){
    prev.apply(this, args);
    const box = document.querySelector('#directoryWrapper');
    if (box) box.classList.add('show');
  };
})();
// === HOTFIX Settings modal (v5.6.3) ===
(function () {
  function openSettingsFix() {
    const modal = document.getElementById("settingsModal");
    if (!modal) { console.warn("⚠️ Settings modal not found"); return; }

    // Cierra overlays que podrían taparlo
    document.getElementById("acwhOverlay")?.remove();      // History
    document.getElementById("directoryWrapper")?.remove(); // Team View

    // Mostrar por encima de todo
    modal.style.display = "flex";         // <- sobrescribe .modal{display:none}
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
    modal.style.zIndex = 12000;           // por encima de history/team view
    requestAnimationFrame(() => modal.classList.add("show"));

    // Cerrar al click fuera
    const onClick = (e) => { if (e.target === modal) closeSettingsFix(); };
    modal.addEventListener("click", onClick, { once: true });

    // Cerrar con ESC
    const onKey = (ev) => { if (ev.key === "Escape") closeSettingsFix(); };
    document.addEventListener("keydown", onKey, { once: true });

    function closeSettingsFix() {
      modal.classList.remove("show");
      setTimeout(() => (modal.style.display = "none"), 150);
    }
    // Exporta close actualizado
    window.closeSettings = closeSettingsFix;
  }
  // Exporta open actualizado
  window.openSettings = openSettingsFix;
})();
// === HOTFIX Settings modal (v5.6.3) ===
(function () {
  function openSettingsFix() {
    const modal = document.getElementById("settingsModal");
    if (!modal) { console.warn("⚠️ Settings modal not found"); return; }

    // Cierra overlays que podrían taparlo
    document.getElementById("acwhOverlay")?.remove();      // History
    document.getElementById("directoryWrapper")?.remove(); // Team View

    // Mostrar por encima de todo
    modal.style.display = "flex";         // <- sobrescribe .modal{display:none}
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
    modal.style.zIndex = 12000;           // por encima de history/team view
    requestAnimationFrame(() => modal.classList.add("show"));

    // Cerrar al click fuera
    const onClick = (e) => { if (e.target === modal) closeSettingsFix(); };
    modal.addEventListener("click", onClick, { once: true });

    // Cerrar con ESC
    const onKey = (ev) => { if (ev.key === "Escape") closeSettingsFix(); };
    document.addEventListener("keydown", onKey, { once: true });

    function closeSettingsFix() {
      modal.classList.remove("show");
      setTimeout(() => (modal.style.display = "none"), 150);
    }
    // Exporta close actualizado
    window.closeSettings = closeSettingsFix;
  }
  // Exporta open actualizado
  window.openSettings = openSettingsFix;
})();
// === ACW v5.6.3 — Change Password hard-fix (pegar al FINAL) ===
(function () {
  function injectStyleOnce(id, css){
    if (document.getElementById(id)) return;
    const s = document.createElement('style'); s.id = id; s.textContent = css;
    document.head.appendChild(s);
  }
  injectStyleOnce('acw-cp2-css', `
    #changePasswordModal{position:fixed; inset:0; display:none; align-items:center; justify-content:center;
      background:rgba(0,0,0,.45); backdrop-filter:blur(8px); z-index:13000;}
    #changePasswordModal.show{ display:flex !important; }
    #changePasswordModal .modal-content.glass{
      background:rgba(255,255,255,.97); border-radius:14px; box-shadow:0 0 40px rgba(0,120,255,.3);
      padding:24px 26px; width:340px; max-width:92vw; animation:popIn .22s ease; position:relative; text-align:center;
    }
    #changePasswordModal .close{ position:absolute; right:10px; top:8px; background:none; border:none; font-size:22px; cursor:pointer; }
    #changePasswordModal input{
      display:block; margin:8px auto; width:90%; max-width:280px; padding:10px;
      border:1px solid rgba(0,120,255,.25); border-radius:6px; outline:none;
    }
  `);

  function ensureChangePasswordModal(){
    let cp = document.getElementById('changePasswordModal');
    if (!cp){
      cp = document.createElement('div');
      cp.id = 'changePasswordModal';
      cp.className = 'modal';
      cp.innerHTML = `
        <div class="modal-content glass">
          <button class="close" aria-label="Close">×</button>
          <h3 style="margin:0 0 8px">Change Password</h3>
          <input id="oldPass" type="password" placeholder="Current password" autocomplete="current-password">
          <input id="newPass" type="password" placeholder="New password" autocomplete="new-password">
          <input id="confirmPass" type="password" placeholder="Confirm new password" autocomplete="new-password">
          <p id="passDiag" class="error"></p>
          <div style="display:flex;gap:8px;justify-content:center;margin-top:6px;">
            <button id="cpSaveBtn">Save</button>
            <button id="cpCancelBtn" type="button">Cancel</button>
          </div>
        </div>`;
      document.body.appendChild(cp);
      cp.querySelector('.close').onclick = closeChangePassword2;
      cp.querySelector('#cpCancelBtn').onclick = closeChangePassword2;
      cp.addEventListener('click', (e)=>{ if (e.target === cp) closeChangePassword2(); });
      cp.querySelector('#cpSaveBtn').onclick = submitChangePassword;
    }
    return cp;
  }

  let _settingsWasVisible = null;

  function openChangePassword2(){
    const cp = ensureChangePasswordModal();
    const settings = document.getElementById('settingsModal');
    if (settings){
      _settingsWasVisible = (settings.style.display !== 'none' && settings.offsetParent !== null);
      settings.style.display = 'none';
      settings.classList.remove('show');
    }
    cp.style.zIndex = '13000';
    cp.classList.add('show');
    const onKey = (ev)=>{ if (ev.key === 'Escape') closeChangePassword2(); };
    document.addEventListener('keydown', onKey, { once:true });
    setTimeout(()=> document.getElementById('oldPass')?.focus(), 50);
  }

  function closeChangePassword2(){
    const cp = document.getElementById('changePasswordModal');
    const settings = document.getElementById('settingsModal');
    if (cp){ cp.classList.remove('show'); cp.style.display = 'none'; }
    if (settings && _settingsWasVisible){
      settings.style.display = 'flex';
      settings.classList.add('show');
      settings.style.alignItems = 'center';
      settings.style.justifyContent = 'center';
      settings.style.zIndex = '12000';
    }
    _settingsWasVisible = null;
  }

  window.openChangePassword = openChangePassword2;
  window.closeChangePassword = closeChangePassword2;

  const btn = document.getElementById('changePassBtn');
  if (btn) btn.onclick = openChangePassword2;
})();
