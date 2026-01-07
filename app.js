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

// =================== FOOTER VERSION (Paso 3) ===================
async function renderFooter(){
  const year = new Date().getFullYear();

  const el1 = document.getElementById("footerLine1");
  const el2 = document.getElementById("footerLine2");

  if (el1) el1.innerHTML = `Powered by <b>JAG15</b> | Allston Car Wash © ${year}`;

  // Web version (CONFIG)
  const webVer = (window.CONFIG?.VERSION || window.CONFIG?.WEB_VERSION || "v?");
  const edition = (window.CONFIG?.EDITION || "").trim();

  // iOS native version (TestFlight) via Capacitor
  let native = "";
  try{
    if (window.Capacitor?.isNativePlatform && window.Capacitor?.Plugins?.App){
      const info = await window.Capacitor.Plugins.App.getInfo();
      // info.version = 1.0, info.build = 3
      native = `iOS ${info.version} (${info.build}) • `;
    }
  }catch{}

  const line2 = `${native}${webVer}${edition ? ` — ${edition}` : ""}`.trim();
  if (el2) el2.textContent = line2;
}

window.addEventListener("load", () => {
  renderFooter().catch(()=>{});
});

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
/* =====================  API helpers + Alias Resolver  ===================== */
const API = {
  // TTLs
  dirTTL: 5*60*1000,        // 5 min
  schedTTL0: 60*1000,       // semana actual
  schedTTLOld: 5*60*1000,   // semanas anteriores
  _aliasCache: new Map(),

  /* ------- Lecturas con cache ------- */
  getDirectory(controller){
    const u = `${CONFIG.BASE_URL}?action=getEmployeesDirectory`;
    return fetchJSON(u, { ttl: API.dirTTL, signal: controller?.signal });
  },

  // Resolver alias SOLO con el directorio (evita recursión)
  async resolveAlias({email, phone}={}, controller){
    const key = (email || phone || "").toLowerCase();
    if (this._aliasCache.has(key)) return this._aliasCache.get(key);

    const d = await this.getDirectory(controller);
    const list = d?.directory || d?.employees || d?.rows || (Array.isArray(d) ? d : []);
    const norm = v => (v||"").toString().trim();
    const nPhone = v => norm(v).replace(/\D/g,"");

    const rec = list.find(x =>
      (email && norm(x.email).toLowerCase() === norm(email).toLowerCase()) ||
      (phone && nPhone(x.phone) && nPhone(x.phone) === nPhone(phone))
    );
    if (!rec) throw new Error("ALIAS_NOT_FOUND_IN_DIRECTORY");

    const full = norm(rec.name || rec.employee || rec.fullname || "");
    const alias = deriveAliasFromFullName(full);
    if (!alias) throw new Error("ALIAS_EMPTY");

    const res = { alias, foundBy: "directory" };
    this._aliasCache.set(key, res);
    return res;
  },
};
// Prioriza datos de la semana activa (J/K/B) y luego Directorio
API.resolvePhone = async function({ email }, controller){
  try{
    const sched = await this.getSchedule(email, 0, controller);
    const raw = sched?.raw || {};
    // De la semana (lo que el backend va a devolver)
    const byWeek = raw.rowCallMeBot || raw.rowPhone || raw.phone || raw.contact || null;
    if (byWeek) return String(byWeek).trim();
  }catch{}
  try{
    const d = await this.getDirectory(controller);
    const rec = (d?.directory || d?.employees || []).find(r => (r.email||"").toLowerCase() === String(email).toLowerCase());
    if (rec?.phone) return String(rec.phone).trim();
  }catch{}
  return null;
};

// Igual, pero para la API Key (columna K)
API.resolveApiKey = async function({ email }, controller){
  try{
    const sched = await this.getSchedule(email, 0, controller);
    const raw = sched?.raw || {};
    const byWeek = raw.rowApiKey || raw.apikey || null;
    if (byWeek) return String(byWeek).trim();
  }catch{}
  try{
    const d = await this.getDirectory(controller);
    const rec = (d?.directory || d?.employees || []).find(r => (r.email||"").toLowerCase() === String(email).toLowerCase());
    if (rec?.apiKey) return String(rec.apiKey).trim();
  }catch{}
  return null;
};

API.sendShift = async function({ targetEmail, action, actor }){
  const base = CONFIG.BASE_URL, enc = encodeURIComponent;

  // alias (ayuda al row lookup)
  let alias = null;
  try { alias = (await this.resolveAlias({ email: targetEmail }))?.alias || null; } catch {}

  // teléfono y apikey desde la semana activa (fallback Directorio)
  let phone = null, apikey = null;
  try { phone  = await this.resolvePhone({ email: targetEmail }); } catch {}
  try { apikey = await this.resolveApiKey({ email: targetEmail }); } catch {}

  const extra = `${phone?`&phone=${enc(phone)}`:""}${apikey?`&apikey=${enc(apikey)}`:""}${actor?`&actor=${enc(actor)}`:""}`;

  const tries = [
    `${base}?action=${action}&email=${enc(targetEmail)}${extra}`,
    `${base}?action=${action}&target=${enc(targetEmail)}${extra}`,
    alias ? `${base}?action=${action}&alias=${enc(alias)}${extra}` : null
  ].filter(Boolean);

  for (const url of tries){
    try{
      const j = await fetchJSON(url, { ttl: 0 });
      if (j?.ok) return { ok:true, data:j, used:url };
      if (j?.error === "row_not_found_for_alias") throw new Error(`No encuentro la fila "${alias}" en la semana activa`);
    }catch(e){
      if (String(e?.message||"").includes("fila")) throw e;
    }
  }
  return { ok:false, error:"all_variants_failed" };
};

// Normaliza “Mon/Tue/…/Sun” y también “Lun/Mar/Mié/…/Dom”
API._dayFix = function(d){
  const k = String(d||"").slice(0,3).toLowerCase();
  const map = {
    mon:"Mon", tue:"Tue", wed:"Wed", thu:"Thu", fri:"Fri", sat:"Sat", sun:"Sun",
    lun:"Mon", mar:"Tue", mié:"Wed", mie:"Wed", jue:"Thu", vie:"Fri", sáb:"Sat", sab:"Sat", dom:"Sun"
  };
  return map[k] || (String(d||"").slice(0,3)||"Mon");
};

API.updateShift = async function({ targetEmail, day, newShift, actor }){
  const base = CONFIG.BASE_URL; const enc = encodeURIComponent;
  const day3 = this._dayFix(day);
  // limpia texto de contenteditable
  const shift = String(newShift||"").replace(/\s+/g," ").trim();

  // alias (si existe ayuda a “row lookup”)
  let alias = null;
  try { alias = (await this.resolveAlias({ email: targetEmail }))?.alias || null; } catch {}

  const tries = [
    `${base}?action=updateShift&actor=${enc(actor)}&target=${enc(targetEmail)}&day=${enc(day3)}&shift=${enc(shift)}`,
    alias ? `${base}?action=updateShift&actor=${enc(actor)}&alias=${enc(alias)}&day=${enc(day3)}&shift=${enc(shift)}` : null,
    alias ? `${base}?action=updateShiftAPI&actor=${enc(actor)}&alias=${enc(alias)}&day=${enc(day3)}&shift=${enc(shift)}` : null,
    alias ? `${base}?action=updateShiftAPI_v1&actor=${enc(actor)}&alias=${enc(alias)}&day=${enc(day3)}&shift=${enc(shift)}` : null
  ].filter(Boolean);

  for (const url of tries){
    try{
      const j = await fetchJSON(url, { ttl: 0 });
      if (j?.ok) return { ok:true, data:j, used:url };
    }catch{}
  }
  return { ok:false, error:"all_variants_failed" };
};
/* ===== Utilidades ===== */
function deriveAliasFromFullName(full){
  if (!full) return "";
  full = full.replace(/\s+/g," ").trim();
  // quitar iniciales tipo "J." al final del nombre
  let parts = full.split(" ").filter(p => !/^[A-ZÁÉÍÓÚÜÑ]\.?$/.test(p));
  if (parts.length === 0) return "";
  const JOINERS = new Set(["DE","DEL","DE","LA","DELA","DE LAS","DE LOS","DA","DOS","VON","VAN","DI","DAL"]);
  let last = parts[parts.length-1];
  let prev = (parts[parts.length-2] || "");
  if (JOINERS.has(prev.toUpperCase())) last = `${prev} ${last}`;
  return last.toUpperCase().replace(/[^A-ZÁÉÍÓÚÜÑ ]/g,"").trim(); // alias como en la columna A
}
function buildAliasVariants(fullName){
  if (!fullName) return [];
  const raw = fullName.replace(/\s+/g, " ").trim();
  const parts = raw.split(" ").filter(p => !/^[A-ZÁÉÍÓÚÜÑ]\.?$/.test(p));
  const first = (parts[0]||"").toUpperCase();
  let last   = (parts[parts.length-1]||"").toUpperCase();

  const JOINERS = new Set(["DE","DEL","DE LA","DE LOS","DE LAS","DA","VON","VAN","DI","DAL"]);
  const prev = (parts[parts.length-2]||"").toUpperCase();
  if (JOINERS.has(prev)) last = `${prev} ${last}`;

  const fi = first[0] || "";
  const NBSP = "\u00A0";

  const base = [
    last,
    `${fi}. ${last}`,
    `${fi}.${last}`,
    `${fi}${NBSP}.${NBSP}${last}`,
    `${fi}${NBSP}${last}`,
    `${fi} ${last}`,
    `${first} ${last}`,
    parts.join(" ").toUpperCase()
  ];
  return Array.from(new Set(base.filter(Boolean).map(s => s.trim())));
}

async function getAliasCandidates(targetEmail){
  const [sched, dirRec] = await Promise.all([
    API.getSchedule(targetEmail, 0).catch(()=>({})),
    (async ()=> {
      try{
        const d = await API.getDirectory();
        const list = d?.directory || d?.employees || [];
        return list.find(r => (r.email||"").toLowerCase() === String(targetEmail).toLowerCase()) || null;
      }catch{ return null; }
    })()
  ]);

  const set = new Set();
  if (sched?.rowAlias) set.add(String(sched.rowAlias).trim());
  if (dirRec?.name) buildAliasVariants(dirRec.name).forEach(a => set.add(a));
  if (dirRec?.name){
    const last = (dirRec.name.split(" ").pop()||"").toUpperCase();
    if (last) set.add(last);
  }
  return Array.from(set).filter(Boolean);
}
// === Alias helpers ===
function buildAliasVariants(fullName){
  if (!fullName) return [];
  const raw = fullName.replace(/\s+/g, " ").trim();
  // partes sin iniciales sueltas tipo "J."
  const parts = raw.split(" ").filter(p => !/^[A-ZÁÉÍÓÚÜÑ]\.?$/.test(p));
  const first = (parts[0]||"").toUpperCase();
  let last   = (parts[parts.length-1]||"").toUpperCase();

  // preposiciones
  const JOINERS = new Set(["DE","DEL","DE LA","DE LOS","DE LAS","DA","VON","VAN","DI","DAL"]);
  const prev = (parts[parts.length-2]||"").toUpperCase();
  if (JOINERS.has(prev)) last = `${prev} ${last}`;

  const fi = first[0] || "";
  const NBSP = "\u00A0"; // espacio no-cortable

  // Candidatos con y sin punto, con espacio normal, NBSP, y sin espacio
  const base = [
    last,                           // GIRALDO
    `${fi}. ${last}`,               // J. GIRALDO
    `${fi}.${last}`,                // J.GIRALDO
    `${fi}${NBSP}.${NBSP}${last}`,  // J. GIRALDO (NBSP alrededor del punto)
    `${fi}${NBSP}${last}`,          // J GIRALDO (NBSP)
    `${fi} ${last}`,                // J GIRALDO
    `${first} ${last}`,             // JOHAN GIRALDO
    parts.join(" ").toUpperCase()   // nombre completo en mayúsculas
  ];

  // Devuelve únicos, sin vacíos
  return Array.from(new Set(base.filter(Boolean).map(s => s.trim())));
}
async function getDirRecordByEmail(email){
  try{
    const d = await API.getDirectory();
    const list = d?.directory || d?.employees || [];
    return list.find(r => (r.email||"").toLowerCase() === String(email).toLowerCase()) || null;
  }catch{ return null; }
}
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
    // 🔹 Activa los botones Next week + History para este usuario
    if (typeof initMyExtraButtons === "function") {
      initMyExtraButtons();
    }
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
/* ===== Helpers de horas (ponlos una sola vez, fuera de la función) ===== */
function parseHours(cell){
  if (!cell) return 0;
  const t = String(cell).trim().toUpperCase();
  if (/^(OFF|OFFR|CERRADO|N\/A|APP)$/.test(t)) return 0;
  const core = t.split(/\s+(DONE|READY|SENT|UPDATE|UPDATED)\b/i)[0].trim();
  const clean = core.replace(/\.+\s*$/,"").replace(/[–—]|to/gi,"-").replace(/\s*-\s*/,"-");
  const m = clean.match(/^([0-9]{1,2}(?::[0-9]{2})?\s*(?:AM|PM)?)\s*-\s*([0-9]{1,2}(?::[0-9]{2})?\s*(?:AM|PM)?)$/i);
  if (!m) return 0;
  const start = toMin(m[1]), end0 = toMin(m[2]); let end=end0;
  if (!/[AP]M/i.test(m[1]) && !/[AP]M/i.test(m[2]) && end < start) end += 12*60; // cruza mediodía
  return Math.max(0, end - start) / 60;
}
function toMin(s){
  s = s.trim().toUpperCase();
  let ampm = (s.match(/\b(AM|PM)\b/)||[])[1]||"";
  s = s.replace(/\s*(AM|PM)\s*$/,'');
  let [h,m] = s.split(":"); h=+h; m=+(m||0);
  if (ampm==="AM" && h===12) h=0;
  if (ampm==="PM" && h!==12) h+=12;
  return h*60+m;
}

/* =================== LOAD SCHEDULE + LIVE =================== */
async function loadSchedule(email) {
  const schedDiv = $("#schedule");
  schedDiv.innerHTML = `<p style="color:#007bff;font-weight:500;">Loading your shift...</p>`;

  try {
    const d = await API.getSchedule(email, 0);

    // 🔧 Soporta distintas formas de JSON
    const daysArr = d?.days || d?.week?.days || d?.schedule || [];
    if (!Array.isArray(daysArr) || daysArr.length === 0) {
      schedDiv.innerHTML = `<p style="color:#c00;">No schedule found for this week.</p>`;
      return;
    }

    // Normaliza
    const normDays = daysArr.map(x => {
      const name  = x?.name || x?.day || "";
      const shift = x?.shift ?? x?.text ?? x ?? "";
      const hours = Number(x?.hours ?? 0) || parseHours(String(shift));
      return { name, shift, hours };
    });

    const total = (typeof d?.total === "number")
      ? d.total
      : normDays.reduce((a,b)=> a + (Number(b.hours)||0), 0);

    // Render
    const todayKey = Today.key;
    let html = `<table><tr><th>Day</th><th>Shift</th><th>Hours</th></tr>`;
    normDays.forEach(day=>{
      const isToday = todayKey === String(day.name||"").slice(0,3).toLowerCase();
      html += `<tr class="${isToday?"today":""}">
        <td>${day.name||""}</td>
        <td>${day.shift||"-"}</td>
        <td>${Number(day.hours||0).toFixed(1)}</td>
      </tr>`;
    });
    html += `</table><p class="total">Total Hours: <b>${(Math.round(total*10)/10).toFixed(1)}</b></p>`;
    schedDiv.innerHTML = html;

    // 🔹 ACTIVAR botones personales: Next week + History (5w)
    if (typeof initMyExtraButtons === "function") {
      try {
        initMyExtraButtons();
      } catch (e) {
        console.warn("initMyExtraButtons error:", e);
      }
    }

    // Live: usar la lista normalizada y el total calculado
    clearInterval(window.__acwLiveTick__);
    setTimeout(()=> startLiveTimer(normDays, Number(total||0)), 300);

  } catch (e) {
    console.warn(e);
    schedDiv.innerHTML = `<p style="color:#c00;">Error loading schedule.</p>`;
  }
}

/* =================== SESSION RESTORE =================== */
window.addEventListener("load", () => {
  try { renderFooter(); } catch {}

  try {
    const saved = localStorage.getItem("acwUser");
    if (saved) {
      currentUser = JSON.parse(saved);
      showWelcome(currentUser.name, currentUser.role);
      loadSchedule(currentUser.email).then(() => {
        if (typeof initMyExtraButtons === "function") {
          initMyExtraButtons();
        }
      });
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

/* =================== EMPLOYEE MODAL (Next week + History para todos) =================== */
async function openEmployeePanel(btnEl){
  const tr    = btnEl.closest("tr");
  const email = tr?.dataset.email;
  const name  = tr?.dataset.name || email || "";
  const role  = tr?.dataset.role || "";
  const phone = tr?.dataset.phone || "";
  const isMgr = isManagerRole(currentUser?.role);

  if (!email) {
    alert("No email found for this employee.");
    return;
  }

  const modalId = `emp-${email.replace(/[@.]/g,"_")}`;
  if (document.getElementById(modalId)) return;

  let current = null;
  let next    = null;

  try{
    // Semana actual (offset 0) + semana siguiente (offset -1, futuro)
    const [d0, d1] = await Promise.all([
      API.getSchedule(email, 0),
      API.getSchedule(email, -1).catch(() => null)
    ]);

    current = d0;
    next    = d1;

    if (!current || !current.ok) throw new Error("no_current");
  }catch(e){
    console.warn("openEmployeePanel error:", e);
    alert("No schedule found for this employee.");
    return;
  }

  function hasContent(days){
    if (!Array.isArray(days)) return false;
    return days.some(d => {
      const s = (d.shift || "").toString().trim().toUpperCase();
      return s && s !== "-" && s !== "N/A";
    });
  }

  const currentDays = current.days || [];
  const nextDays    = (next && next.ok && hasContent(next.days)) ? (next.days || []) : [];

  // Filas semana actual (editable solo para manager/supervisor)
  const currentRowsHtml = currentDays.map(d => `
    <tr data-day="${(d.name || "").slice(0,3)}"
        data-original="${(d.shift || "-").replace(/"/g,'&quot;')}">
      <td>${d.name || ""}</td>
      <td ${isMgr ? 'contenteditable="true"' : ''}>
        ${d.shift || "-"}
      </td>
      <td>${d.hours || 0}</td>
    </tr>
  `).join("");

  // Bloque semana siguiente (solo lectura, colapsable)
  let nextToggleHtml = "";
  let nextBlockHtml  = "";
  let nextWeekLabel  = "";

  if (nextDays.length){
    nextWeekLabel = next.week || next.weekLabel || "";
    const nextRowsHtml = nextDays.map(d => `
      <tr>
        <td>${d.name || ""}</td>
        <td>${d.shift || "-"}</td>
        <td>${d.hours || 0}</td>
      </tr>
    `).join("");

    nextToggleHtml = `
      <button class="btn-toggle-next" style="margin-top:10px;">
        ⬇️ Next week${nextWeekLabel ? ` (${nextWeekLabel})` : ""}
      </button>
    `;

    nextBlockHtml = `
      <div class="emp-week-block future-week"
           style="display:none;margin-top:6px;border-top:1px dashed #ddd;padding-top:6px;">
        <div class="emp-week-title" style="font-weight:600;margin-bottom:4px;">
          Next week${nextWeekLabel ? ` (${nextWeekLabel})` : ""}
        </div>
        <table class="schedule-mini schedule-next">
          <tr><th>Day</th><th>Shift</th><th>Hours</th></tr>
          ${nextRowsHtml}
        </table>
      </div>
    `;
  }

  // Bloque de acciones:
  // - Manager/Supervisor: Update / Send Today / Send Tomorrow + History
  // - Employee normal: SOLO History (5w)
  const actionsHtml = `
    <div class="emp-actions" style="margin-top:10px;">
      ${isMgr ? `
        <button class="btn-update">✏️ Update Shift</button>
        <button class="btn-today">📤 Send Today</button>
        <button class="btn-tomorrow">📤 Send Tomorrow</button>
      ` : ``}
      <button class="btn-history">📚 History (5w)</button>
      <p id="empStatusMsg-${email.replace(/[@.]/g,"_")}"
         class="emp-status-msg"
         style="margin-top:6px;font-size:.9em;"></p>
    </div>
  `;

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

      <div class="emp-week-block current-week">
        <div class="emp-week-title" style="font-weight:600;margin-bottom:4px;">
          This week${current.week ? ` (${current.week})` : ""}
        </div>
        <table class="schedule-mini">
          <tr><th>Day</th><th>Shift</th><th>Hours</th></tr>
          ${currentRowsHtml}
        </table>

        <p class="total">
          Total Hours:
          <b id="tot-${name.replace(/\s+/g,"_")}">${current.total || 0}</b>
        </p>
        <p class="live-hours"></p>
      </div>

      ${nextToggleHtml}
      ${nextBlockHtml}

      ${actionsHtml}

      <button class="emp-refresh" style="margin-top:8px;">⚙️ Check for Updates</button>
    </div>
  `;
  document.body.appendChild(m);

  // Cerrar modal
  m.querySelector(".emp-close").onclick = () => m.remove();

  // Refresh app completo (limpiar caches + reload)
  const refBtn = m.querySelector(".emp-refresh");
  if (refBtn) {
    refBtn.onclick = () => {
      try {
        if ("caches" in window) {
          caches.keys().then(keys => keys.forEach(n => caches.delete(n)));
        }
      } catch {}
      m.classList.add("flash");
      setTimeout(() => location.reload(), 600);
    };
  }

  // 🔹 History (5w) — disponible para TODOS los roles
  const historyBtn = m.querySelector(".btn-history");
  if (historyBtn) {
    historyBtn.onclick = () => openHistoryFor(email, name);
  }

  // 🔹 Botones solo para Manager/Supervisor
  if (isMgr) {
    const uBtn = m.querySelector(".btn-update");
    const tBtn = m.querySelector(".btn-today");
    const tmBtn= m.querySelector(".btn-tomorrow");

    if (uBtn)  uBtn.onclick  = () => updateShiftFromModal(email, m);
    if (tBtn)  tBtn.onclick  = () => sendShiftMessage(email, "sendtoday");
    if (tmBtn) tmBtn.onclick = () => sendShiftMessage(email, "sendtomorrow");
  }

  // 🔹 Toggle Next week (para todos, si existe bloque future-week)
  const btnToggleNext = m.querySelector(".btn-toggle-next");
  const nextBlock     = m.querySelector(".emp-week-block.future-week");
  if (btnToggleNext && nextBlock){
    btnToggleNext.onclick = () => {
      const visible = nextBlock.style.display !== "none";
      nextBlock.style.display = visible ? "none" : "block";
      btnToggleNext.textContent = visible
        ? `⬇️ Next week${nextWeekLabel ? ` (${nextWeekLabel})` : ""}`
        : `⬆️ Hide next week`;
    };
  }

  // Live hours solo para la semana actual
  enableModalLiveShift(m, currentDays);
}

function enableModalLiveShift(modal, days){
  try{
    const key = Today.key;
    const today = days.find(d=> (d.name || "").slice(0,3).toLowerCase() === key);
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
      if (!startTime) return;
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
      const p = shift.split("-");
      if (p.length === 2){
        const a = parseTime(p[0].trim()), b = parseTime(p[1].trim());
        if (a && b){
          const diff = Math.max(0,(b-a)/36e5);
          hoursCell.textContent = `${diff.toFixed(1)}h`;
          hoursCell.style.color="#999";
        }
      }
    }
  }catch(e){ console.warn("modal live err:", e); }
}

/* =================== MY EXTRAS: Next week + History (5w) =================== */
async function initMyExtraButtons(){
  try{
    // ✅ Corregido: usamos solo currentUser (no window.currentUser)
    if (!currentUser || !currentUser.email) return;

    // 1) Crear contenedor de botones si no existe
    let extra = document.getElementById("myExtraActions");
    if (!extra){
      extra = document.createElement("div");
      extra.id = "myExtraActions";
      extra.style.marginTop = "12px";

      extra.innerHTML = `
        <div style="margin-top:10px;">
          <button id="btnMyNextWeek" style="margin-right:8px;">
            ⏭️ Next week
          </button>
          <button id="btnMyHistory">
            📚 History (5w)
          </button>
        </div>
        <div id="myNextWeekBlock"
             style="display:none;margin-top:8px;border-top:1px dashed #ddd;padding-top:6px;">
        </div>
      `;

      // Lo pegamos debajo del #schedule
      const sched = document.getElementById("schedule");
      if (sched && sched.parentNode){
        sched.parentNode.appendChild(extra);
      } else {
        // fallback: al body
        document.body.appendChild(extra);
      }
    }

    const nextBtn   = document.getElementById("btnMyNextWeek");
    const histBtn   = document.getElementById("btnMyHistory");
    const nextBlock = document.getElementById("myNextWeekBlock");

    if (!nextBtn || !histBtn || !nextBlock) return;

    // 2) Botón History (5w) – usa la misma función del modal
    histBtn.onclick = () => {
      try{
        const name = currentUser.name || currentUser.email;
        openHistoryFor(currentUser.email, name);
      }catch(e){
        console.warn("openHistoryFor error:", e);
        alert("History is not available right now.");
      }
    };

    // 3) Botón Next week – llama al mismo GAS (offset -1)
    nextBtn.onclick = async () => {
      // Toggle visible / hidden
      const isVisible = nextBlock.style.display !== "none";
      if (isVisible){
        nextBlock.style.display = "none";
        return;
      }

      nextBlock.style.display = "block";

      // Si ya lo cargamos antes, no volvemos a pedir al GAS
      if (nextBlock.dataset.loaded === "1") return;

      nextBlock.innerHTML = `<p style="color:#0078ff;">Loading next week…</p>`;

      try{
        const data = await API.getSchedule(currentUser.email, -1);
        if (!data || !data.ok || !Array.isArray(data.days) || !data.days.length){
          nextBlock.innerHTML = `<p style="color:#777;">No next week schedule yet.</p>`;
          nextBlock.dataset.loaded = "1";
          return;
        }

        const label = data.week || data.weekLabel || "";
        const rowsHtml = data.days.map(d => `
          <tr>
            <td>${d.name || ""}</td>
            <td>${d.shift || "-"}</td>
            <td>${d.hours || 0}</td>
          </tr>
        `).join("");

        nextBlock.innerHTML = `
          <div class="emp-week-block future-week">
            <div class="emp-week-title">
              Next week${label ? ` (${label})` : ""}
            </div>
            <table class="schedule-mini">
              <tr><th>Day</th><th>Shift</th><th>Hours</th></tr>
              ${rowsHtml}
            </table>
          </div>
        `;
        nextBlock.dataset.loaded = "1";
      }catch(e){
        console.warn("Next week error:", e);
        nextBlock.innerHTML = `<p style="color:#c00;">Error loading next week.</p>`;
      }
    };

  }catch(e){
    console.warn("initMyExtraButtons err:", e);
  }
}

/* =================== MANAGER ACTIONS =================== */
async function updateShiftFromModal(targetEmail, modalEl){
  const boxId = `#empStatusMsg-${targetEmail.replace(/[@.]/g,"_")}`;
  const msg = document.querySelector(boxId) || modalEl.querySelector(".emp-status-msg");
  const actor = currentUser?.email;
  if (!actor){ msg && (msg.textContent="⚠️ Session expired. Login again."); return; }

  const rows = Array.from(modalEl.querySelectorAll(".schedule-mini tr[data-day]"));
  const changes = rows.map(r=>{
    const day = r.dataset.day;
    const newShift = r.cells[1].innerText.replace(/\s+/g," ").trim();
    const original = (r.getAttribute("data-original")||"").replace(/\s+/g," ").trim();
    return (newShift!==original) ? { day, newShift } : null;
  }).filter(Boolean);

  if (!changes.length){ msg && (msg.textContent="No changes to save."); toast("ℹ️ No changes","info"); return; }

  msg && (msg.textContent="✏️ Saving to Sheets...");
  let ok=0;
  for (const c of changes){
    const res = await API.updateShift({ targetEmail, day:c.day, newShift:c.newShift, actor });
    if (res.ok) ok++;
  }
  if (ok===changes.length){
    msg.textContent = "✅ Updated on Sheets!";
    toast("✅ Shifts updated","success");
    rows.forEach(r=> r.setAttribute("data-original", r.cells[1].innerText.replace(/\s+/g," ").trim()));
  }else if (ok>0){
    msg.textContent = `⚠️ Partial save: ${ok}/${changes.length}`;
    toast("⚠️ Some shifts failed","error");
  }else{
    msg.textContent = "❌ Could not update.";
    toast("❌ Update failed","error");
  }
}
/* =================== SEND SHIFT MESSAGE =================== */
async function sendShiftMessage(targetEmail, action){
  const msgBox = document.querySelector(`#empStatusMsg-${targetEmail.replace(/[@.]/g,"_")}`);
  if (msgBox) { msgBox.style.color=""; msgBox.textContent="📤 Sending..."; }

  try{
    const res = await API.sendShift({ targetEmail, action, actor: currentUser?.email||"" });
    if (res.ok){
      const j = res.data;
      const name = j.sent?.name || j.name || targetEmail;
      const shift = j.sent?.shift || j.shift || "-";
      const mode = (j.sent?.mode || action).toUpperCase();
      if (msgBox){ msgBox.style.color="#00b341"; msgBox.textContent=`✅ ${name} (${mode}) → ${shift}`; }
      toast(`✅ Sent (${mode}) to ${name}`, "success");
      if (navigator.vibrate) navigator.vibrate(50);
    }else{
      if (msgBox){ msgBox.style.color="#ff4444"; msgBox.textContent="❌ Send failed (variants)"; }
      toast("❌ Send failed", "error");
    }
  }catch(e){
    if (msgBox){ msgBox.style.color="#ff4444"; msgBox.textContent=`❌ ${e.message||"Error"}`; }
    toast("❌ Send error", "error");
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
    const card    = overlay.querySelector('.acwh-card') || overlay;
    const title   = overlay.querySelector('.acwh-title')?.textContent?.trim() || 'History';
    const who     = overlay.querySelector('.acwh-sub')?.textContent?.trim() || (currentUser?.name || 'ACW');

    // Modo nítido SOLO durante la captura
    overlay.setAttribute('data-share','1');
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));

    try{
      await __shareElAsImage(card, `${who} — ${title}.png`);
    } finally {
      overlay.removeAttribute('data-share');
    }
  };
} // <-- este cierre faltaba

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
      backgroundColor: '#ffffff',
      scale: Math.min(3, window.devicePixelRatio || 2),
      useCORS: true
    });
    const blob = await new Promise(res => canvas.toBlob(res, 'image/png', 0.95));
    const file = new File([blob], filename, { type: 'image/png' });

    try{
      if (navigator.canShare && navigator.canShare({ files:[file] })){
        await navigator.share({ files:[file] });
        toast('✅ Shared image','success');
        return;
      }
    }catch{}

    try{
      if (navigator.clipboard && window.ClipboardItem){
        await navigator.clipboard.write([ new ClipboardItem({ 'image/png': blob }) ]);
        toast('📋 Image copied to clipboard','success');
        return;
      }
    }catch{}

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

// === ACW v5.6.3 — getSchedule robusto (email -> alias) ===
API.getSchedule = async function(identifier, offset = 0, controller){
  const base = CONFIG.BASE_URL;
  const ttl = offset === 0 ? (API.schedTTL0 || 60_000) : (API.schedTTLOld || 300_000);
  const signal = controller?.signal;

  function toMin(s){
    s = String(s||"").trim().toUpperCase();
    let ap = (s.match(/\b(AM|PM)\b/)||[])[1]||"";
    s = s.replace(/\s*(AM|PM)\s*$/,'');
    let [h,m] = s.split(":"); h = +h; m = +(m||0);
    if (ap==="AM" && h===12) h=0;
    if (ap==="PM" && h!==12) h+=12;
    return h*60+m;
  }
  function _parseHours(cell){
    if (!cell) return 0;
    const t = String(cell).trim().toUpperCase();
    if (/^(OFF|OFFR|CERRADO|N\/A|APP)$/.test(t)) return 0;
    const core  = t.split(/\s+(DONE|READY|SENT|UPDATE|UPDATED)\b/i)[0].trim();
    const clean = core.replace(/\.+\s*$/,"").replace(/[–—]|to/gi,"-").replace(/\s*-\s*/,"-");
    const m = clean.match(/^([0-9]{1,2}(?::[0-9]{2})?\s*(?:AM|PM)?)\s*-\s*([0-9]{1,2}(?::[0-9]{2})?\s*(?:AM|PM)?)$/i);
    if (!m) return 0;
    let a = toMin(m[1]), b = toMin(m[2]);
    if (!/[AP]M/i.test(m[1]) && !/[AP]M/i.test(m[2]) && b<a) b+=720;
    return Math.max(0, b-a)/60;
  }
  function normalize(j){
    if (!j) return { ok:false, days:[], total:0 };
    let daysArr = j.days || j.week?.days || j.schedule || j.rows;
    if (!Array.isArray(daysArr)) {
      const keys = ["mon","tue","wed","thu","fri","sat","sun","Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
      if (keys.some(k => j && k in j)) {
        daysArr = keys.filter(k=>k in j).map(k=>({ name:k, shift:j[k] }));
      }
    }
    const days = Array.isArray(daysArr)
      ? daysArr.map(x=>{
          const name  = x?.name || x?.day || "";
          const shift = x?.shift ?? x?.text ?? x ?? "";
          const hours = Number(x?.hours ?? 0) || _parseHours(shift);
          return { name, shift, hours };
        })
      : [];
    const total = (typeof j.total === "number") ? j.total : days.reduce((s,r)=>s+(Number(r.hours)||0),0);
    return { ok: days.length>0, days, total, rowAlias: j.rowAlias||j.alias||null, weekLabel: j.weekLabel||j.label };
  }
  async function fetchN(u){
    try{ const raw = await fetchJSON(u, { ttl, signal }); const n = normalize(raw); return { ...n, raw }; }
    catch{ return { ok:false, days:[], total:0 }; }
  }

  // 1) por email
  let res = await fetchN(`${base}?action=getSmartSchedule&email=${encodeURIComponent(identifier)}&offset=${offset}`);
  if (res.ok) return res;

  // 2) fallback por alias (desde Directory)
  let alias = null;
  try { alias = (await API.resolveAlias({ email: identifier }, controller))?.alias; } catch {}
  if (alias){
    for (const action of ["getSmartSchedule","getScheduleByAlias","getSchedule"]){
      res = await fetchN(`${base}?action=${action}&alias=${encodeURIComponent(alias)}&offset=${offset}`);
      if (res.ok) return res;
    }
  }
  return res; // ok:false
};


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
/* === ACW — History "Clean Skin" (solo estilos) === */
(function(){
  const id = 'acw-history-skin';
  if (document.getElementById(id)) return;
  const css = `
  #acwhOverlay{
    --acw-accent: #0a84ff;      /* azul títulos */
    --acw-danger: #e53935;      /* rojo totales */
    --acw-card:   #ffffff;      /* fondo tarjeta */
    --acw-border: rgba(0,0,0,.08);
    --acw-radius: 16px;
    --acw-shadow: 0 8px 28px rgba(0,0,0,.08);
    --acw-text:   #2a2a2a;
    background: rgba(0,0,0,.22);
    backdrop-filter: blur(1.5px);
  }
  #acwhOverlay .acwh-card{
    background: var(--acw-card);
    color: var(--acw-text);
    border: 1px solid var(--acw-border);
    border-radius: var(--acw-radius);
    box-shadow: var(--acw-shadow);
    padding: 16px 18px;
  }
  #acwhOverlay .acwh-title{
    color: var(--acw-accent);
    line-height: 1.05;
  }
  #acwhOverlay .acwh-sub{ color:#97a1ad; }

  /* filas de la lista */
  #acwhOverlay .acwh-list .acwh-row{
    background:#fff;
    border:1px solid var(--acw-border);
    border-radius: 14px;
    padding: 12px 14px;
    display:flex; align-items:center; justify-content:space-between;
    gap:12px; margin:10px 0;
  }
  #acwhOverlay .acwh-week{ color:#2b2b2b; }
  #acwhOverlay .acwh-total{ color: var(--acw-danger); font-weight:700; }

  /* botón Open */
  #acwhOverlay .acwh-btn{
    background:#e00000; color:#fff; border:0; border-radius:14px;
    padding:10px 14px; font-weight:700;
  }

  /* botón Share (encima a la derecha) */
  #acwhOverlay .acwh-head{ display:flex; align-items:center; justify-content:space-between; gap:8px; }
  #acwhOverlay .acwh-head .acwh-share{
    background:#ff6b6f; color:#fff; border:0; border-radius:12px;
    padding:6px 10px; font-weight:700; box-shadow:0 2px 8px rgba(255,107,111,.28);
  }
  #acwhOverlay .acwh-head .acwh-share:active{ transform:translateY(1px); }

  /* tabla detalle semana */
  #acwhOverlay table.acwh-table th{ color: var(--acw-accent); }
  #acwhOverlay .acwh-total-line{ color: var(--acw-danger); font-weight:700; text-align:right; }

  /* durante captura (data-share="1") todo sin velos */
  #acwhOverlay[data-share="1"]{ background: transparent !important; backdrop-filter:none !important; }
  #acwhOverlay[data-share="1"] .acwh-card,
  #acwhOverlay[data-share="1"] .acwh-card *{ opacity:1 !important; filter:none !important; box-shadow:none !important; }
  `;
  const s = document.createElement('style'); s.id = id; s.textContent = css;
  document.head.appendChild(s);
})();

/* === ACW History UI skin v1 — Blue Glass White (safe drop-in) === */
(function patchHistUI(){
  // 1) Skin + colores
  const id='acw-hist-skin';
  if(!document.getElementById(id)){
    const css = `
      #acwhOverlay .acwh-card{
        background:rgba(255,255,255,.98);
        border-radius:16px;
        box-shadow:0 12px 40px rgba(0,120,255,.22);
      }
      #acwhOverlay .acwh-title{ color:#0b6dff; letter-spacing:.2px; }
      #acwhOverlay .acwh-sub{ color:rgba(0,0,0,.38); margin-top:2px; }

      /* MISMO ROJO QUE OPEN */
      #acwhOverlay .acwh-head .acwh-share{
        background:#e60000 !important;
        color:#fff; border:0; border-radius:12px;
        padding:6px 12px; font-weight:700; cursor:pointer;
        box-shadow:0 8px 18px rgba(230,0,0,.32);
      }
      #acwhOverlay .acwh-head .acwh-share:active{ transform:translateY(1px); }

      #acwhOverlay .acwh-total,
      #acwhOverlay .acwh-total-line{ color:#e60000; font-weight:700; }
      #acwhOverlay .acwh-total-line{ text-align:right; margin-top:10px; }

      /* Tabla limpia y alineada */
      #acwhOverlay .acwh-table{
        width:100%; border-collapse:separate; border-spacing:0; table-layout:fixed;
      }
      #acwhOverlay .acwh-table thead th{
        padding:10px 12px; color:#0b6dff; font-weight:700;
      }
      #acwhOverlay .acwh-table thead th.right{ text-align:right; }
      #acwhOverlay .acwh-table tbody td{
        padding:10px 12px; border-top:1px solid rgba(0,0,0,.06);
      }
      /* Números y horas perfectamente alineados */
      #acwhOverlay .acwh-table td.c-shift,
      #acwhOverlay .acwh-table td.c-hours{
        font-variant-numeric: tabular-nums; letter-spacing:.2px;
      }
      #acwhOverlay .acwh-table td.c-hours{ text-align:right; }
      #acwhOverlay .acwh-table tr.off td{ color:#9aa3ad; }

      /* Modo captura (mantén tu data-share=1) */
      #acwhOverlay[data-share="1"]{ background:transparent !important; backdrop-filter:none !important; filter:none !important; }
      #acwhOverlay[data-share="1"] .acwh-card{
        background:#fff !important; box-shadow:none !important; opacity:1 !important; filter:none !important;
      }
      #acwhOverlay[data-share="1"] .acwh-card *{ opacity:1 !important; filter:none !important; }
    `;
    const s=document.createElement('style'); s.id=id; s.textContent=css; document.head.appendChild(s);
  }

  // 2) Detalle con columnas fijas (mismo tamaño que te gustó)
  const renderFixed = function(week, email, name, offset, root){
    const body = root.querySelector("#acwhBody");
    body.className = "";
    root.querySelector(".acwh-title").textContent = week.label;
    root.querySelector(".acwh-sub").textContent =
      `${offset===0 ? "Week (current)" : `Week -${offset}`} • ${String(name||"").toUpperCase()}`;

    const rows = (week.days||[]).map(d=>{
      const off = /off/i.test(String(d.shift||""));
      return `<tr class="${off?'off':''}">
        <td class="c-day">${d.name||""}</td>
        <td class="c-shift">${d.shift||'-'}</td>
        <td class="c-hours">${Number(d.hours||0).toFixed(1)}</td>
      </tr>`;
    }).join("");

    body.innerHTML = `
      <div class="acwh-headrow" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
        <button class="acwh-back">‹ Weeks</button>
        <div class="acwh-total">${Number(week.total||0).toFixed(1)}h</div>
      </div>
      <table class="acwh-table">
        <colgroup>
          <col style="width:38%">
          <col style="width:40%">
          <col style="width:22%">
        </colgroup>
        <thead>
          <tr><th>Day</th><th>Shift</th><th class="right">Hours</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="acwh-total-line">Total: ${Number(week.total||0).toFixed(1)}h</div>
    `;
    body.querySelector(".acwh-back").onclick = () => renderHistoryPickerList(email, name, root);
    __attachHistoryShare(root);
  };

  // Sobrescribe de forma segura
  window.renderHistoryDetailCentered = renderFixed;
})();
/* === ACW Schedule table alignment v1 — Blue Glass White (safe drop-in) === */
(function scheduleSkin(){
  const id='acw-sched-skin';
  if (document.getElementById(id)) return;

  const css = `
    #schedule table{
      width:100%; table-layout:fixed; border-collapse:separate; border-spacing:0;
    }
    #schedule table th, #schedule table td{
      padding:10px 12px; border-top:1px solid rgba(0,0,0,.06);
    }
    /* Anchos fijos */
    #schedule table th:nth-child(1), #schedule table td:nth-child(1){ width:38%; }
    #schedule table th:nth-child(2), #schedule table td:nth-child(2){
      width:44%; white-space:nowrap; font-variant-numeric:tabular-nums;
    }
    #schedule table th:nth-child(3), #schedule table td:nth-child(3){
      width:18%; text-align:right; font-variant-numeric:tabular-nums;
    }
    /* Hoy visible y OFF gris */
    #schedule table tr.today td{ background:rgba(11,109,255,.06); }
    #schedule table td.off{ color:#9aa3ad; }
  `;
  const s=document.createElement('style'); s.id=id; s.textContent=css; document.head.appendChild(s);

  // Normaliza el guion para que no parta línea (NBSP–NBSP)
  function formatShift(str){
    const t = String(str||'-').trim();
    return t.replace(/\s-\s/g, '\u00A0–\u00A0');
  }

  // Post-procesa la tabla después de que se renderiza
  function fixTable(){
    const table = document.querySelector('#schedule table');
    if(!table) return;
    const rows = Array.from(table.rows);
    rows.forEach((r,i)=>{
      if (i===0) return; // header
      const shiftCell = r.cells[1], hoursCell = r.cells[2];
      if (shiftCell){
        const raw = shiftCell.textContent;
        shiftCell.textContent = formatShift(raw);
        if (/^\s*off\s*$/i.test(raw)) shiftCell.classList.add('off');
      }
      if (hoursCell){ /* ya queda derecha y tabular por CSS */ }
    });
  }

  // Hook: vuelve a aplicar tras loadSchedule
  const orig = window.loadSchedule;
  if (typeof orig === 'function'){
    window.loadSchedule = async function(...args){
      await orig.apply(this, args);
      requestAnimationFrame(fixTable);
    };
  } else {
    requestAnimationFrame(fixTable);
  }
})();
// Share = rojo fuerte (igual que Open)
(function(){
  const id='acw-share-red';
  if (document.getElementById(id)) return;
  const s=document.createElement('style'); s.id=id;
  s.textContent = `
    .acwh-head .acwh-share{
      background:#e60000 !important;
      box-shadow:0 2px 10px rgba(230,0,0,.35);
      color:#fff; border:0; border-radius:10px;
    }
    .acwh-head .acwh-share:active{ transform:translateY(1px); }
  `;
  document.head.appendChild(s);
})();

// === Constante de tu Weekly estable (R1)
const WEEKLY_ID = "1HjPzkLLts7NlCou_94QSqwXezizc8MGQfob24RTdE9A";

// --- Helpers comunes
function dayKeyOf(s){
  const k = String(s||"").trim().toLowerCase();
  const M = {
    monday:"Mon", tuesday:"Tue", wednesday:"Wed", thursday:"Thu", friday:"Fri", saturday:"Sat", sunday:"Sun",
    lunes:"Mon", martes:"Tue", miércoles:"Wed", miercoles:"Wed", jueves:"Thu", viernes:"Fri", sábado:"Sat", sabado:"Sat", domingo:"Sun",
    mon:"Mon", tue:"Tue", wed:"Wed", thu:"Thu", fri:"Fri", sat:"Sat", sun:"Sun"
  };
  return M[k] || (k.slice(0,3).charAt(0).toUpperCase()+k.slice(1,3));
}
async function _try(u){ try{const r=await fetch(u,{cache:"no-store"}); return await r.json();}catch(e){return {ok:false,error:String(e)};} }
const _qs = o => Object.entries(o).map(([k,v])=>`${k}=${encodeURIComponent(v)}`).join("&");

// === SEND SHIFT (robusto con alias) ===
async function sendShiftMessage(targetEmail, action){
  const box = document.querySelector(`#empStatusMsg-${targetEmail.replace(/[@.]/g,"_")}`);
  if (box){ box.textContent = "📤 Sending..."; box.style.color = "#333"; }

  const base  = CONFIG.BASE_URL;
  const actor = currentUser?.email || "";
  const aliases = await getAliasCandidates(targetEmail);

  const tries = [];
  for (const a of aliases){
    tries.push(`${base}?action=${action}&alias=${encodeURIComponent(a)}${actor?`&actor=${encodeURIComponent(actor)}`:""}`);
  }
  // fallback por email si tu GAS lo acepta
  tries.push(`${base}?action=${action}&target=${encodeURIComponent(targetEmail)}${actor?`&actor=${encodeURIComponent(actor)}`:""}`);

  let last=null, ok=false, used="";
  for (const u of tries){
    try{
      const r = await fetch(u, {cache:"no-store"}); last = await r.json();
      if (last?.ok){ ok=true; used=u; break; }
      if (last?.error && !/row_not_found_for_alias|missing/i.test(String(last.error))) break;
    }catch{}
  }

  if (ok){
    const who  = last?.sent?.name || aliases[0] || targetEmail;
    const what = last?.sent?.shift || (action==="sendtomorrow"?"tomorrow":"today");
    if (box){ box.textContent = `✅ ${who} (${action.toUpperCase()}) → ${what}`; box.style.color = "#00b341"; }
    toast(`✅ Message sent to ${who}`, "success");
    console.log("SEND_OK via:", used);
  }else{
    const err = last?.error || "row_not_found_for_alias";
    if (box){ box.textContent = `❌ ${err}`; box.style.color = "#e53935"; }
    toast(`⚠️ Send failed (${err})`, "error");
    console.warn("SEND_FAIL tried aliases:", aliases);
  }
}

// === UPDATE SHIFT (robusto con alias) ===
async function updateShiftFromModal(targetEmail, modalEl){
  const msg = document.querySelector(`#empStatusMsg-${targetEmail.replace(/[@.]/g,"_")}`) || modalEl.querySelector(".emp-status-msg");
  const actor = currentUser?.email;
  if (!actor){ msg && (msg.textContent="⚠️ Session expired. Login again."); return; }

  const rows = Array.from(modalEl.querySelectorAll(".schedule-mini tr[data-day]"));
  const changes = rows.map(r=>{
    const d3 = r.dataset.day;
    const newS = r.cells[1].innerText.replace(/\s+/g," ").trim();
    const oldS = (r.getAttribute("data-original")||"").replace(/\s+/g," ").trim();
    return (newS!==oldS) ? { d3, newS } : null;
  }).filter(Boolean);

  if (!changes.length){ msg && (msg.textContent="No changes to save."); toast("ℹ️ No changes","info"); return; }

  const MAP_FULL = { Mon:"MONDAY", Tue:"TUESDAY", Wed:"WEDNESDAY", Thu:"THURSDAY", Fri:"FRIDAY", Sat:"SATURDAY", Sun:"SUNDAY" };
  const base = CONFIG.BASE_URL;

  // alias exactos (rowAlias + variantes de Directorio)
  const [sched, rec] = await Promise.all([
    API.getSchedule(targetEmail, 0).catch(()=>({})),
    getDirRecordByEmail(targetEmail)
  ]);
  const aliasList = [];
  if (sched?.rowAlias) aliasList.push(String(sched.rowAlias).trim().toUpperCase());
  if (rec?.name) aliasList.push(...buildAliasVariants(rec.name));
  const uniqAlias = Array.from(new Set(aliasList.filter(Boolean)));

  msg && (msg.textContent="✏️ Saving to Sheets...");

  let ok=0;
  for (const ch of changes){
    const dayFull = MAP_FULL[ch.d3] || ch.d3;
    const urls = [];

    // por email (target)
    urls.push(`${base}?action=updateShift&actor=${encodeURIComponent(actor)}&target=${encodeURIComponent(targetEmail)}&day=${encodeURIComponent(dayFull)}&shift=${encodeURIComponent(ch.newS)}`);

    // por alias (todas las variantes)
    uniqAlias.forEach(a=>{
      urls.push(`${base}?action=updateShift&actor=${encodeURIComponent(actor)}&alias=${encodeURIComponent(a)}&day=${encodeURIComponent(dayFull)}&shift=${encodeURIComponent(ch.newS)}`);
      urls.push(`${base}?action=updateShiftAPI_v1&actor=${encodeURIComponent(actor)}&alias=${encodeURIComponent(a)}&day=${encodeURIComponent(dayFull)}&shift=${encodeURIComponent(ch.newS)}`);
    });

    let saved=false, last=null;
    for (const u of urls){
      last = await fetch(u, {cache:"no-store"}).then(r=>r.json()).catch(()=>null);
      if (last?.ok){ saved=true; break; }
      if (last?.error && !/missing|alias|day/i.test(String(last.error))) break;
    }
    if (saved) ok++;
  }

  if (ok===changes.length){
    msg && (msg.textContent="✅ Updated on Sheets!");
    toast("✅ Shifts updated","success");
    rows.forEach(r=> r.setAttribute("data-original", r.cells[1].innerText.replace(/\s+/g," ").trim()));
  } else if (ok>0){
    msg && (msg.textContent=`⚠️ Partial save: ${ok}/${changes.length}`);
    toast("⚠️ Some shifts failed","error");
  } else {
    msg && (msg.textContent="❌ Could not update.");
    toast("❌ Update failed","error");
  }
}

// === BOTÓN: Open in Sheets ===
function ensureOpenInSheetsBtn(modalEl){
  if (modalEl.querySelector('.btn-open-sheets')) return;
  const btn = document.createElement('button');
  btn.className = 'btn-open-sheets';
  btn.textContent = '📄 Open in Sheets';
  btn.onclick = ()=> window.open(`https://docs.google.com/spreadsheets/d/${WEEKLY_ID}/edit`,'_blank');
  modalEl.querySelector('.emp-actions')?.appendChild(btn);
}

// engancha el botón cuando abras el panel del empleado
(()=> {
  const prev = window.openEmployeePanel;
  window.openEmployeePanel = async function(btnEl){
    await prev.call(this, btnEl);
    const modal = document.querySelector('.employee-modal .emp-box')?.parentElement;
    if (modal) ensureOpenInSheetsBtn(modal);
  };
})();

// por si usas handlers globales
window.sendShiftMessage = sendShiftMessage;
window.updateShiftFromModal = updateShiftFromModal;

// =================== BOTÓN: Open in Sheets ===================
function ensureOpenInSheetsBtn(modalEl){
  if (modalEl.querySelector('.btn-open-sheets')) return;
  const btn = document.createElement('button');
  btn.className = 'btn-open-sheets';
  btn.textContent = '📄 Open in Sheets';
  btn.onclick = ()=> window.open(`https://docs.google.com/spreadsheets/d/${WEEKLY_ID}/edit`,'_blank');
  modalEl.querySelector('.emp-actions')?.appendChild(btn);
}

// engancha el botón cuando abras el panel del empleado
(() => {
  const prev = window.openEmployeePanel;
  window.openEmployeePanel = async function(btnEl){
    await prev.call(this, btnEl);
    const modal = document.querySelector('.employee-modal .emp-box')?.parentElement;
    if (modal) ensureOpenInSheetsBtn(modal);
  };
})();

/* =========================================================
   PATCH v5.6.3 — Global API key + Send robust (Nov 18 2025)
   - NO resuelve ni envía apikey por persona
   - llama sendtoday/sendtomorrow con target/alias correctos
   ========================================================= */
(function(){
  if (typeof API === "undefined") return;

  // ya no usamos apiKey individual
  API.resolveApiKey = async ()=> null;

  // override sendShift limpio
  API.sendShift = async function({ targetEmail, action, actor }){
    const base = CONFIG.BASE_URL, enc = encodeURIComponent;

    let alias = null;
    try { alias = (await this.resolveAlias({ email: targetEmail }))?.alias || null; }
    catch {}

    const tries = [
      `${base}?action=${action}&target=${enc(targetEmail)}${actor?`&actor=${enc(actor)}`:""}`,
      alias ? `${base}?action=${action}&alias=${enc(alias)}${actor?`&actor=${enc(actor)}`:""}` : null,
      // compatibilidad por si algún cache viejo manda email=
      `${base}?action=${action}&email=${enc(targetEmail)}${actor?`&actor=${enc(actor)}`:""}`
    ].filter(Boolean);

    let lastErr = null;
    for (const url of tries){
      try{
        const j = await fetchJSON(url, { ttl:0 });
        if (j?.ok) return { ok:true, data:j, used:url };
        lastErr = j?.error || "send_failed";
      }catch(e){
        lastErr = e?.message || String(e);
      }
    }
    return { ok:false, error:lastErr || "all_variants_failed" };
  };

  // fuerza que el botón use el sendShift nuevo
  window.sendShiftMessage = async function(targetEmail, action){
    const box = document.querySelector(`#empStatusMsg-${targetEmail.replace(/[@.]/g,"_")}`);
    if (box){ box.textContent="📤 Sending..."; box.style.color="#333"; }

    try{
      const res = await API.sendShift({ targetEmail, action, actor: currentUser?.email||"" });
      if (res.ok){
        const j = res.data;
        const name  = j.sent?.name || targetEmail;
        const shift = j.sent?.shift || "-";
        if (box){ box.style.color="#00b341"; box.textContent=`✅ ${name} (${action.toUpperCase()}) → ${shift}`; }
        toast(`✅ Sent to ${name}`, "success");
      }else{
        if (box){ box.style.color="#e53935"; box.textContent=`❌ ${res.error||"Send failed"}`; }
        toast("❌ Send failed", "error");
      }
    }catch(e){
      if (box){ box.style.color="#e53935"; box.textContent=`❌ ${e.message||"Error"}`; }
      toast("❌ Send error", "error");
    }
  };

  console.log("✅ PATCH v5.6.3 applied: Global API key for sendtoday/sendtomorrow");
})();

/* ============================================================
   🧑‍💻 Team Editor Glass v2 — Back / Front / Cashiers
   - Encima de la tabla
   - Horas por día + Total semana
   - Contador diario (Back/Front/Cashiers + hoy)
   - Send Today / Tomorrow solo si hay turno ese día
   - Refresh y no se cierra al tocar afuera
   JAG15 & Sky — Nov 2025
   ============================================================ */
/* === Agrupa Back / Front / Cashiers por rangos de nombre === */
function __buildTeamGroupsV2(list){
  const LABELS_POS = {
    backStart:  "J. GIRALDO",
    backEnd:    "S. BARRERA",
    frontStart: "E. REYES",
    frontEnd:   "S. ZULETA",
    cashStart:  "K. ORTIZ",
    cashEnd:    "C. BUSTAMANTE"
  };

  function variantsFromString(str){
    if (!str) return [];
    const v = buildAliasVariants(str);
    v.push(String(str).toUpperCase());
    return Array.from(new Set(v.map(x => x.toUpperCase().trim())));
  }

  function variantsFromEmp(emp){
    const baseName = emp.name || emp.alias || emp.employee || "";
    let v = buildAliasVariants(baseName);
    const alias = (emp.alias || "").toUpperCase();
    if (alias) v.push(alias);
    return Array.from(new Set(v.map(x => x.toUpperCase().trim())));
  }

  const labelVars = {};
  Object.keys(LABELS_POS).forEach(k => {
    labelVars[k] = variantsFromString(LABELS_POS[k]);
  });

  const idx = {};
  list.forEach((emp, i)=>{
    const ev = variantsFromEmp(emp);
    for (const key in LABELS_POS){
      if (idx[key] != null) continue;
      const lv = labelVars[key];
      if (ev.some(v => lv.includes(v))) {
        idx[key] = i;
      }
    }
  });

  function segment(aKey, bKey){
    const a = idx[aKey], b = idx[bKey];
    if (typeof a !== "number" || typeof b !== "number") return [];
    const start = Math.min(a,b), end = Math.max(a,b);
    return list.slice(start, end + 1);
  }

  const back  = segment("backStart","backEnd");
  const front = segment("frontStart","frontEnd");
  const cash  = segment("cashStart","cashEnd");

  return { back, front, cash };
}
// Clasifica un turno de HOY: on / done / later / none
function __classifyTodayShift(shift){
  const raw = String(shift || "").trim();
  if (!raw || /^-+$/.test(raw)) return "none";
  if (/off/i.test(raw)) return "none";

  const clean = raw.split(/\s+(DONE|READY|SENT|UPDATE|UPDATED)\b/i)[0].trim();
  const parts = clean.split("-");
  const now = new Date();

  if (parts.length >= 2){
    let sStr = parts[0].replace(/\.+\s*$/,"").trim();
    let eStr = parts[1].replace(/\.+\s*$/,"").trim();
    const start = parseTime(sStr);
    const end   = parseTime(eStr);
    if (!start || !end) return "unknown";
    if (now < start) return "later";
    if (now >= start && now <= end) return "on";
    if (now > end) return "done";
    return "unknown";
  } else {
    let sStr = clean.replace(/\.+\s*$/,"").trim();
    const start = parseTime(sStr);
    if (!start) return "unknown";
    return (now >= start) ? "on" : "later";
  }
}

// === SEND GLOBAL (solo con turno ese día) ===
async function __teamEditorSendGlobal(action, overlay){
  const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const todayKey = Today.key;                  // mon/tue/...
  const dayIdxMap = { mon:0,tue:1,wed:2,thu:3,fri:4,sat:5,sun:6 };

  const todayIdx = dayIdxMap[todayKey] ?? 0;
  const sendIdx  = action === "sendtomorrow" ? (todayIdx + 1) % 7 : todayIdx;
  const sendDay3 = DAYS[sendIdx];

  const rows = Array.from(overlay.querySelectorAll(".te-table tbody tr[data-email]"));
  const emails = [];

  rows.forEach(row=>{
    const cell = row.querySelector(`.te-day[data-day="${sendDay3}"]`);
    if (!cell) return;
    const txt = String(cell.innerText || "").trim();
    if (!txt || txt === "-" || /off/i.test(txt)) return; // no turno → no enviar
    emails.push(row.dataset.email);
  });

  if (!emails.length){
    toast("ℹ️ No hay turnos para enviar en ese día.", "info");
    return;
  }

  const label = action === "sendtomorrow" ? "Mañana" : "Hoy";
  toast(`📤 Enviando ${label} a ${emails.length} empleados…`, "info");

  let ok = 0;
  await runLimited(emails, 3, async (email)=>{
    try{
      const res = await API.sendShift({ targetEmail: email, action, actor: currentUser?.email || "" });
      if (res.ok) ok++;
    }catch{}
  });

  toast(`✅ ${label}: ${ok}/${emails.length} enviados.`, "success");
}

// === SAVE CHANGES (usa API.updateShift) ===
async function __teamEditorSaveChanges(overlay){
  const cells = Array.from(overlay.querySelectorAll(".te-day[contenteditable='true']"));
  const changes = [];

  cells.forEach(cell=>{
    const newShift = cell.innerText.replace(/\s+/g," ").trim();
    const original = String(cell.dataset.original || "").replace(/\s+/g," ").trim();
    if (newShift === original) return;
    const tr = cell.closest("tr");
    if (!tr) return;
    changes.push({
      email: tr.dataset.email,
      day: cell.dataset.day,
      newShift
    });
  });

  if (!changes.length){
    toast("ℹ️ No hay cambios que guardar.", "info");
    return;
  }

  toast(`✏️ Guardando ${changes.length} cambios en Sheets…`, "info");

  let ok = 0;
  for (const ch of changes){
    const res = await API.updateShift({
      targetEmail: ch.email,
      day: ch.day,
      newShift: ch.newShift,
      actor: currentUser?.email || ""
    });
    if (res.ok) ok++;
  }

  if (ok === changes.length){
    toast("✅ Todos los cambios se guardaron en Sheets.", "success");
    cells.forEach(cell=>{
      const txt = cell.innerText.replace(/\s+/g," ").trim();
      cell.dataset.original = txt;
    });
  } else if (ok > 0){
    toast(`⚠️ Guardado parcial: ${ok}/${changes.length}.`, "error");
  } else {
    toast("❌ No se pudo guardar ningún cambio.", "error");
  }
}

// === MAIN: abrir Team Editor (Glass v2) ===
async function openTeamEditor(){
  if (!isManagerRole(currentUser?.role)){
    toast("Solo managers/supervisores pueden usar el Team Editor.", "error");
    return;
  }
  if (document.getElementById("teamEditorOverlay")) return;

  const overlay = document.createElement("div");
  overlay.id = "teamEditorOverlay";
  overlay.className = "team-editor-overlay";
  overlay.innerHTML = `
    <div class="team-editor-card">
      <div class="te-head">
        <div class="te-titles">
          <h3>Team Editor</h3>
          <p>Blue Glass White · Weekly hours</p>
          <p id="teTodayStats" class="te-today"></p>
        </div>
        <div class="te-actions">
          <button class="te-btn te-save">✏️ Save changes</button>
          <button class="te-btn te-refresh">🔁 Refresh</button>
          <button class="te-btn te-send-today">Send Today (Global)</button>
          <button class="te-btn te-send-tomorrow">Send Tomorrow (Global)</button>
          <button class="te-close" aria-label="Close">×</button>
        </div>
      </div>
      <div id="teamEditorBody" class="te-body">
        <p class="te-loading">Loading team hours…</p>
      </div>
      <div class="te-footer">
        <div id="teTotals" class="te-totals"></div>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const body     = overlay.querySelector("#teamEditorBody");
  const totalsEl = overlay.querySelector("#teTotals");
  const todayEl  = overlay.querySelector("#teTodayStats");

  const close = ()=> overlay.remove();
  overlay.querySelector(".te-close").onclick = close;
  // 👉 NO cerramos al tocar afuera, para que el scroll no cierre nada

  overlay.querySelector(".te-send-today").onclick    = ()=> __teamEditorSendGlobal("sendtoday", overlay);
  overlay.querySelector(".te-send-tomorrow").onclick = ()=> __teamEditorSendGlobal("sendtomorrow", overlay);
  overlay.querySelector(".te-save").onclick          = ()=> __teamEditorSaveChanges(overlay);
  overlay.querySelector(".te-refresh").onclick       = ()=> { overlay.remove(); openTeamEditor(); };

  try{
    const dir = await API.getDirectory();
    let list = dir?.directory || dir?.employees || [];
    if (!Array.isArray(list) || !list.length){
      body.innerHTML = `<p style="color:#c00;">No hay datos en el directorio.</p>`;
      return;
    }

    // Solo filas con email válido
        // Quita solo filas de encabezado (Emails, Active/Inactive staff) pero NO exige email
    list = list.filter(emp => {
      const name = String(emp.name || emp.employee || "").trim();
      if (!name) return false;

      const upper = name.toUpperCase();
      if (upper === "EMAILS") return false;
      if (upper.includes("ACTIVE STAFF")) return false;
      if (upper.includes("INACTIVE STAFF")) return false;

      return true;
    });

    const enriched = list.map((emp, idx)=>({
      ...emp,
      index: idx,
      alias: deriveAliasFromFullName(emp.name || emp.alias || emp.employee || "") ||
             emp.alias || emp.name || ""
    }));

    const groups = __buildTeamGroupsV2(enriched);

    // Si no encontró NINGÚN rango, mete todos en Back
    const hasAny =
      (groups.back?.length || 0) +
      (groups.front?.length || 0) +
      (groups.cash?.length || 0);

    if (!hasAny){
      console.warn("TeamEditor: no se encontraron rangos, usando 'Back = todos'.");
      groups.back = enriched.slice();
    }

    // Otros = empleados que no cayeron en Back / Front / Cashiers
    const usedEmails = new Set([
      ...(groups.back  || []).map(e=>e.email),
      ...(groups.front || []).map(e=>e.email),
      ...(groups.cash  || []).map(e=>e.email),
    ]);
    groups.others = enriched.filter(emp => !usedEmails.has(emp.email));

        // 👉 Para ACW: todos los "Others" cuentan como Back
    if (groups.others && groups.others.length){
      groups.back = (groups.back || []).concat(groups.others);
      groups.others = [];  // ya no usamos grupo "Others"
    }

    const DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
    const todayKey = Today.key;                      // mon/tue/...
    const dayIdxMap = { mon:0,tue:1,wed:2,thu:3,fri:4,sat:5,sun:6 };
    const todayIdx  = dayIdxMap[todayKey] ?? 0;
    const today3    = DAYS[todayIdx];

    // Traer horarios para TODOS (para que el conteo sea 28, etc.)
    await runLimited(enriched, 4, async (emp)=>{
      try{
        const sched = await API.getSchedule(emp.email, 0);
        emp.schedule = sched;
      }catch{
        emp.schedule = { ok:false, days:[], total:0 };
      }
    });

        // 👉 Títulos simples, ahora con "Others"
    const LABELS = {
      back:  "Back",
      front: "Front",
      cash:  "Cashiers",
      others:"Others"
    };

    const groupToday = {
      back:{scheduled:0,on:0,done:0},
      front:{scheduled:0,on:0,done:0},
      cash:{scheduled:0,on:0,done:0},
      others:{scheduled:0,on:0,done:0}
    };
    const todayStats = { scheduled:0, on:0, done:0 };

    function bumpStats(emp, groupKey){
      const days = emp.schedule?.days || [];
      const dayObj = days.find(x => API._dayFix(x.name).slice(0,3) === today3);
      const shift = dayObj?.shift || "";
      if (!shift || shift === "-" || /off/i.test(shift)) return;

      groupToday[groupKey].scheduled++;
      todayStats.scheduled++;

      const st = __classifyTodayShift(shift);
      if (st === "on"){
        groupToday[groupKey].on++;
        todayStats.on++;
      }else if (st === "done"){
        groupToday[groupKey].done++;
        todayStats.done++;
      }
    }

       let html = "";

    ["back","front","cash"].forEach(key=>{
      const arr = groups[key];
      if (!arr || !arr.length) return;

      html += `
        <section class="te-section" data-group="${key}">
          <div class="te-section-head">
            <h4>${LABELS[key]}</h4>
            <span class="te-section-count" id="teCount-${key}"></span>
          </div>
          <div class="te-table-wrap">
            <table class="te-table">
              <thead>
                <tr>
                  <th class="te-col-name">Name</th>
                  ${DAYS.map(d=>`<th>${d}</th>`).join("")}
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
      `;

      // 👉 Fila divisoria Crew cuando cambia de Drivers a Crew
      let crewDividerInserted = false;
      const dividerLabel =
        key === "back"  ? "Crew (Back)" :
        key === "front" ? "Crew (Front)" :
        "Crew";

      arr.forEach(emp=>{
        const days = emp.schedule?.days || [];
        bumpStats(emp, key);

        const label = (emp.alias || emp.name || emp.email || "").replace(/[<>]/g,"");
        let rowTotalHours = 0;

        // Si este es el primer empleado con rol Crew en este grupo, mete divisor
        const roleStr = String(emp.role || "").toLowerCase();
        if (!crewDividerInserted && /crew/.test(roleStr) && (key === "back" || key === "front")){
          crewDividerInserted = true;
          html += `
            <tr class="te-divider">
              <td colspan="${DAYS.length + 2}">${dividerLabel}</td>
            </tr>
          `;
        }

        const rowCells = DAYS.map(d=>{
          const dayObj = days.find(x => API._dayFix(x.name).slice(0,3) === d);
          let shift = dayObj?.shift || "-";
          const off   = /off/i.test(String(shift)) || !shift || shift === "-";

          let h = 0;
          if (!off){
            h = (typeof dayObj?.hours === "number" ? dayObj.hours : parseHours(shift)) || 0;
            rowTotalHours += h;
          }

          const safe = String(shift || "-").replace(/"/g,"&quot;");
          const dayHoursLabel = h ? `<div class="te-day-h">${h.toFixed(1)}h</div>` : "";

          return `
            <td class="te-day${off?" te-off":""}"
                data-day="${d}"
                contenteditable="true"
                data-original="${safe}">
              ${shift || "-"}${dayHoursLabel}
            </td>`;
        }).join("");

        html += `
          <tr data-email="${emp.email}" data-name="${label}">
            <td class="te-name">${label}</td>
            ${rowCells}
            <td class="te-total-hours">${rowTotalHours ? rowTotalHours.toFixed(1) : ""}</td>
          </tr>
        `;
      });

      html += `
              </tbody>
            </table>
          </div>
        </section>
      `;
    });

    body.innerHTML = html || `<p style="color:#c00;">No hay empleados en el directorio.</p>`;
    // Conteos por grupo visibles
    ["back","front","cash"].forEach(key=>{
      const g = groupToday[key];
      const el = document.getElementById(`teCount-${key}`);
      if (!el) return;
      if (!g.scheduled){
        el.textContent = "0 hoy";
      }else{
        el.textContent =
          `${g.scheduled} hoy` +
          (g.on ? ` · On: ${g.on}` : "") +
          (g.done ? ` · Done: ${g.done}` : "");
      }
    });

    const todayLabel = API._dayFix(todayKey).slice(0,3);
    if (todayEl){
      if (!todayStats.scheduled){
        todayEl.textContent = `Today (${todayLabel}): 0 empleados con turno.`;
      }else{
        todayEl.textContent =
          `Today (${todayLabel}) — On: ${todayStats.on} · Done: ${todayStats.done} · Total hoy: ${todayStats.scheduled}`;
      }
    }

    const sumBack   = groupToday.back.scheduled;
    const sumFront  = groupToday.front.scheduled;
    const sumCash   = groupToday.cash.scheduled;
    const sumOthers = groupToday.others.scheduled;
    const totalAll  = sumBack + sumFront + sumCash + sumOthers;

    totalsEl.textContent =
      `Back: ${sumBack} · Front: ${sumFront} · Cashiers: ${sumCash} · Otros: ${sumOthers} · Total activos hoy: ${totalAll}`;

  }catch(e){
    console.warn("TeamEditor error", e);
    body.innerHTML = `<p style="color:#c00;">Error cargando el Team Editor.</p>`;
  }
}
// Exponer global
window.openTeamEditor = openTeamEditor;

// === Botón Team Editor junto a Team View (solo managers) ===
(function patchTeamEditorButton(){
  const prev = window.addTeamButton;
  window.addTeamButton = function(){
    if (typeof prev === "function") prev();
    if (document.getElementById("teamEditorBtn")) return;
    const btn = document.createElement("button");
    btn.id = "teamEditorBtn";
    btn.className = "team-btn team-editor-btn";
    btn.textContent = "Team Editor";
    btn.onclick = openTeamEditor;
    document.body.appendChild(btn);
  };
})();
/* ============================================================
   ACW v5.6.3 — CLEAN PATCH PACK (Viejo pero limpio)
   - Settings modal fix (z-index + close)
   - Change Password modal hard-fix
   - History Share (html2canvas)
   - Schedule table alignment skin
   ============================================================ */
(function ACW_CLEAN_PATCH(){
  if (window.__ACW_CLEAN_PATCH__) return;
  window.__ACW_CLEAN_PATCH__ = true;

  /* ---------- 1) SETTINGS MODAL FIX ---------- */
  (function(){
    function openSettingsFix(){
      const modal = document.getElementById("settingsModal");
      if (!modal) return;

      // cierra overlays que tapan
      document.getElementById("acwhOverlay")?.remove();
      document.getElementById("directoryWrapper")?.remove();

      modal.style.display = "flex";
      modal.style.alignItems = "center";
      modal.style.justifyContent = "center";
      modal.style.zIndex = 12000;
      requestAnimationFrame(()=> modal.classList.add("show"));

      const close = ()=> {
        modal.classList.remove("show");
        setTimeout(()=> modal.style.display="none", 150);
      };

      modal.addEventListener("click", (e)=>{ if (e.target === modal) close(); }, { once:true });
      document.addEventListener("keydown", (ev)=>{ if (ev.key === "Escape") close(); }, { once:true });

      window.closeSettings = close;
    }
    window.openSettings = openSettingsFix;
  })();

  /* ---------- 2) CHANGE PASSWORD HARD FIX ---------- */
  (function(){
    const cssId = "acw-cp-clean-css";
    if (!document.getElementById(cssId)){
      const s = document.createElement("style");
      s.id = cssId;
      s.textContent = `
        #changePasswordModal{position:fixed; inset:0; display:none; align-items:center; justify-content:center;
          background:rgba(0,0,0,.45); backdrop-filter:blur(8px); z-index:13000;}
        #changePasswordModal.show{ display:flex !important; }
        #changePasswordModal .modal-content.glass{
          background:rgba(255,255,255,.97); border-radius:14px; box-shadow:0 0 40px rgba(0,120,255,.3);
          padding:24px 26px; width:340px; max-width:92vw; position:relative; text-align:center;
        }
        #changePasswordModal .close{ position:absolute; right:10px; top:8px; background:none; border:none; font-size:22px; cursor:pointer; }
        #changePasswordModal input{
          display:block; margin:8px auto; width:90%; max-width:280px; padding:10px;
          border:1px solid rgba(0,120,255,.25); border-radius:6px; outline:none;
        }
      `;
      document.head.appendChild(s);
    }

    function ensureCP(){
      let cp = document.getElementById("changePasswordModal");
      if (cp) return cp;
      cp = document.createElement("div");
      cp.id = "changePasswordModal";
      cp.className = "modal";
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
        </div>
      `;
      document.body.appendChild(cp);

      const close = ()=>{ cp.classList.remove("show"); cp.style.display="none"; };
      cp.querySelector(".close").onclick = close;
      cp.querySelector("#cpCancelBtn").onclick = close;
      cp.addEventListener("click",(e)=>{ if (e.target===cp) close(); });
      cp.querySelector("#cpSaveBtn").onclick = window.submitChangePassword;

      return cp;
    }

    window.openChangePassword = function(){
      const cp = ensureCP();
      document.getElementById("settingsModal")?.classList.remove("show");
      document.getElementById("settingsModal") && (document.getElementById("settingsModal").style.display="none");

      cp.style.display="flex";
      cp.classList.add("show");
      setTimeout(()=> document.getElementById("oldPass")?.focus(), 50);
      document.addEventListener("keydown", (ev)=>{ if (ev.key==="Escape") window.closeChangePassword(); }, { once:true });
    };

    window.closeChangePassword = function(){
      const cp = document.getElementById("changePasswordModal");
      if (cp){ cp.classList.remove("show"); cp.style.display="none"; }
    };
  })();

  /* ---------- 3) HISTORY SHARE (html2canvas) ---------- */
  (function(){
    async function ensureH2C(){
      if (window.html2canvas) return;
      await new Promise((ok, fail)=>{
        const s=document.createElement("script");
        s.src="https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
        s.onload=ok; s.onerror=()=>fail(new Error("html2canvas load failed"));
        document.head.appendChild(s);
      });
    }

    window.__shareElAsImage = async function(el, filename="acw.png"){
      try{
        await ensureH2C();
        const canvas = await html2canvas(el, { backgroundColor:"#ffffff", scale: Math.min(3, window.devicePixelRatio||2), useCORS:true });
        const blob = await new Promise(res=> canvas.toBlob(res,"image/png",0.95));
        const file = new File([blob], filename, { type:"image/png" });

        try{
          if (navigator.canShare && navigator.canShare({ files:[file] })){
            await navigator.share({ files:[file] });
            toast?.("✅ Shared image","success");
            return;
          }
        }catch{}

        try{
          if (navigator.clipboard && window.ClipboardItem){
            await navigator.clipboard.write([ new ClipboardItem({ "image/png": blob }) ]);
            toast?.("📋 Image copied","success");
            return;
          }
        }catch{}

        const url = URL.createObjectURL(blob);
        window.open(url,"_blank");
        toast?.("ℹ️ Opened image","info");
      }catch(e){
        console.warn("share error", e);
        toast?.("❌ Share failed","error");
      }
    };
  })();

  /* ---------- 4) SCHEDULE TABLE ALIGNMENT ---------- */
  (function(){
    const id="acw-sched-clean-css";
    if (document.getElementById(id)) return;
    const s=document.createElement("style"); s.id=id;
    s.textContent=`
      #schedule table{ width:100%; table-layout:fixed; border-collapse:separate; border-spacing:0; }
      #schedule th, #schedule td{ padding:10px 12px; border-top:1px solid rgba(0,0,0,.06); }
      #schedule th:nth-child(1), #schedule td:nth-child(1){ width:38%; }
      #schedule th:nth-child(2), #schedule td:nth-child(2){ width:44%; white-space:nowrap; font-variant-numeric:tabular-nums; }
      #schedule th:nth-child(3), #schedule td:nth-child(3){ width:18%; text-align:right; font-variant-numeric:tabular-nums; }
      #schedule tr.today td{ background:rgba(11,109,255,.06); }
      #schedule td.off{ color:#9aa3ad; }
    `;
    document.head.appendChild(s);
  })();

  console.log("✅ ACW CLEAN PATCH PACK applied");
})();
