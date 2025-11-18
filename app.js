/* ============================================================
   🧠 ACW-App v5.6.3-CLEAN — Blue Glass White Connected (Nov 2025)
   Johan A. Giraldo (JAG15) & Sky
   ------------------------------------------------------------
   - Caché en memoria con TTL + de-dupe (fetchJSON)
   - Today key auto-refresh a medianoche
   - Login + Restore sesión + Welcome con teléfono
   - Schedule normalizado + live hours (turno con ".")
   - Team View (paginado, concurrencia limitada, interval sólo abierto)
   - Employee Modal (Update Shift, Send Today/Tomorrow, History 5w, 🧩 Fix Row)
   - Alias robusto (override local > resolver > directorio > rowAlias)
   - History 5w + botón Share con captura nítida (html2canvas)
   - UI skins “Blue Glass White” para History y Schedule
   - Settings / Change Password hotfix
   - Sin duplicados (guard ÚNICO)
   Pareja recomendada: **ACW LOGIN v4.6.9 R1**
   ============================================================ */
(function(){
  if (window.__ACW_V563_CLEAN__) return; // evita doble carga
  window.__ACW_V563_CLEAN__ = true;

  const CONFIG = window.CONFIG || {};
  let currentUser = null;

  /* =================== Utils / Core =================== */
  const $ = (sel, root=document)=> root.querySelector(sel);
  const $all = (sel, root=document)=> Array.from(root.querySelectorAll(sel));
  const isManagerRole = (role)=> ["manager","supervisor"].includes(String(role||"").toLowerCase());
  const safeText = (el, txt)=> { if(el) el.textContent = txt; };
  const setVisible = (el, show)=> { if(!el) return; el.style.display = show ? "" : "none"; };
  const cssEscape = (s)=> { try{return CSS.escape(s);}catch{ return String(s).replace(/[^a-zA-Z0-9_\-]/g,"_"); } };

  /* Hoy cacheado + refresco a medianoche */
  const Today = (()=> {
    let key = new Date().toLocaleString("en-US",{weekday:"short"}).slice(0,3).toLowerCase();
    const now  = new Date();
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
      if (it.inflight) return it.inflight;
      store.delete(key); return null;
    }
    function set(key, value, ttl){ store.set(key, { value, expires: Date.now()+ttl }); return value; }
    function setInflight(key, p){ store.set(key, { inflight: p, expires: 0 }); }
    function clearInflight(key){ const it=store.get(key); if (it && it.inflight) store.delete(key); }
    return { get, set, setInflight, clearInflight };
  })();

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

  /* =====================  Alias helpers  ===================== */
  function deriveAliasFromFullName(full){
    if (!full) return "";
    full = full.replace(/\s+/g," ").trim();
    let parts = full.split(" ").filter(p => !/^[A-ZÁÉÍÓÚÜÑ]\.?$/.test(p));
    if (parts.length === 0) return "";
    const JOINERS = new Set(["DE","DEL","LA","DE LA","DELA","DE LAS","DE LOS","DA","DOS","VON","VAN","DI","DAL"]);
    let last = parts[parts.length-1];
    let prev = (parts[parts.length-2] || "");
    if (JOINERS.has(prev.toUpperCase())) last = `${prev} ${last}`;
    return last.toUpperCase().replace(/[^A-ZÁÉÍÓÚÜÑ ]/g,"").trim();
  }
  function deriveAliasCandidates(full){
    full = (full||"").replace(/\s+/g," ").trim();
    const JOINERS = new Set(["DE","DEL","LA","DE LA","DELA","DE LAS","DE LOS","DA","DOS","VON","VAN","DI","DAL"]);
    let parts = full.split(" ").filter(Boolean);
    if (parts.length < 2) return [];
    let last = parts[parts.length-1];
    const prev = (parts[parts.length-2]||"");
    if (JOINERS.has(prev.toUpperCase())) { last = `${prev} ${last}`; parts = parts.slice(0,-2); }
    else { parts = parts.slice(0,-1); }
    const LAST = last.toUpperCase().replace(/[^A-ZÁÉÍÓÚÜÑ ]/g,"").trim();
    const initials = parts
      .map(p => (p.replace(/[^A-Za-zÁÉÍÓÚÜÑ]/g,"").charAt(0) || "").toUpperCase())
      .filter(Boolean);
    const F  = initials[0] || "";
    const FI = (initials[0]||"") + (initials[1]||"");
    const variants = new Set([
      LAST,
      F && `${F}. ${LAST}`,   F && `${F} ${LAST}`,
      FI && `${FI}. ${LAST}`, FI && `${FI} ${LAST}`,
      (initials[1] ? `${initials[0]}.${initials[1]}. ${LAST}` : null),
      (initials[1] ? `${initials[0]}. ${initials[1]}. ${LAST}` : null),
    ].filter(Boolean));
    return Array.from(variants);
  }
  function expandAliasCandidates(full){
    const base = deriveAliasCandidates(full || "") || [];
    const LAST = deriveAliasFromFullName(full||"") || "";
    const initials = (full||"").trim().split(/\s+/).slice(0,-1)
      .map(w=>w.replace(/[^A-Za-zÁÉÍÓÚÜÑ]/g,'').charAt(0).toUpperCase()).filter(Boolean);
    const F  = initials[0] || "";
    const FI = (initials[0]||"")+(initials[1]||"");
    const withComma = new Set([
      LAST&&F  ? `${LAST}, ${F}.` : null, LAST&&F  ? `${LAST}, ${F}`  : null,
      LAST&&FI ? `${LAST}, ${FI}.` : null, LAST&&FI ? `${LAST}, ${FI}` : null
    ].filter(Boolean));
    const noDot = new Set(base.map(v=>v.replace(/\./g,'').replace(/\s{2,}/g,' ').trim()));
    return Array.from(new Set([...(base||[]), ...withComma, ...noDot].filter(Boolean)));
  }

  /* Alias overrides (persisten en localStorage) */
  const AliasOverrides = {
    _key: 'acwAliasOverrides',
    get(email){ try{ const m=JSON.parse(localStorage.getItem(this._key)||'{}'); return m[(email||'').toLowerCase()]||''; }catch{ return ''; } },
    set(email, alias){ try{ const k=(email||'').toLowerCase(); const m=JSON.parse(localStorage.getItem(this._key)||'{}'); m[k]=String(alias||'').trim(); localStorage.setItem(this._key, JSON.stringify(m)); }catch{} }
  };

  /* ===================== API helpers ===================== */
  const API = {
    dirTTL:     5*60*1000,
    schedTTL0:  60*1000,
    schedTTLOld:5*60*1000,
    _aliasCache: new Map(),

    getDirectory(controller){
      const u = `${CONFIG.BASE_URL}?action=getEmployeesDirectory`;
      return fetchJSON(u, { ttl: this.dirTTL, signal: controller?.signal });
    },

    // Resolver alias: consulta directorio, genera candidatos, valida contra backend
    async resolveAlias({ email, phone } = {}, controller){
      const key = (email || phone || "").toLowerCase();
      if (this._aliasCache.has(key)) return this._aliasCache.get(key);

      const d = await this.getDirectory(controller).catch(()=>null);
      const list = d?.directory || d?.employees || d?.rows || (Array.isArray(d)?d:[]);
      const norm   = v => (v||"").toString().trim();
      const nPhone = v => norm(v).replace(/\D/g,"");
      const rec = list.find(x =>
        (email && norm(x.email).toLowerCase() === norm(email).toLowerCase()) ||
        (phone && nPhone(x.phone) && nPhone(x.phone) === nPhone(phone))
      );
      if (!rec) throw new Error("ALIAS_NOT_FOUND_IN_DIRECTORY");

      const full = norm(rec.name || rec.employee || rec.fullname || "");
      const primary = deriveAliasFromFullName(full);
      const extra   = expandAliasCandidates(full);
      const candidates = Array.from(new Set([primary, ...extra].filter(Boolean)));

      const base   = CONFIG.BASE_URL;
      const signal = controller?.signal;
      const check = async (a) => {
        for (const action of ["getSmartSchedule","getScheduleByAlias","getSchedule"]) {
          try{
            const r = await fetchJSON(`${base}?action=${action}&alias=${encodeURIComponent(a)}&offset=0`,
                                      { ttl: this.schedTTL0, signal });
            const days = r?.days || r?.week?.days || r?.schedule || [];
            if (Array.isArray(days) && days.length) return true;
          }catch{}
        }
        return false;
      };

      let matched = null;
      for (const a of candidates) { if (await check(a)) { matched = a; break; } }

      const result = { alias: matched || primary, candidates, foundBy: "directory", matched: !!matched };
      this._aliasCache.set(key, result);
      return result;
    },

    // getSchedule robusto (email → alias[candidatos]) + normalización
    async getSchedule(identifier, offset = 0, controller){
      const base   = CONFIG.BASE_URL;
      const ttl    = offset===0 ? this.schedTTL0 : this.schedTTLOld;
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
        if (!/[AP]M/i.test(m[1]) && !/[AP]M/i.test(m[2]) && b<a) b+=720; // cruza mediodía
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
        return { ok: days.length>0, days, total, rowAlias: j.rowAlias||j.alias||null, weekLabel: j.weekLabel||j.label || null };
      }
      async function fetchN(u){
        try{ const raw = await fetchJSON(u, { ttl, signal }); const n = normalize(raw); return { ...n, raw }; }
        catch{ return { ok:false, days:[], total:0 }; }
      }

      // 1) por email directo
      let res = await fetchN(`${base}?action=getSmartSchedule&email=${encodeURIComponent(identifier)}&offset=${offset}`);
      if (res.ok) return res;

      // 2) por alias (resolver candidatos)
      let aliasInfo = null;
      try { aliasInfo = await API.resolveAlias({ email: identifier }, controller); } catch {}
      const candidates = [];
      if (aliasInfo?.candidates) candidates.push(...aliasInfo.candidates);
      if (aliasInfo?.alias)      candidates.push(aliasInfo.alias);
      const unique = Array.from(new Set(candidates));
      for (const a of unique){
        for (const action of ["getSmartSchedule","getScheduleByAlias","getSchedule"]){
          res = await fetchN(`${base}?action=${action}&alias=${encodeURIComponent(a)}&offset=${offset}`);
          if (res.ok) return res;
        }
      }
      return res; // ok:false
    }
  };

  /* ================= Concurrencia limitada ================= */
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

  /* =================== Time / Hours helpers =================== */
  function parseTime(str){
    const clean = String(str||"").trim();
    const m = clean.match(/^(\d{1,2})(?::(\d{1,2}))?\s*(am|pm)?$/i);
    if(!m) return null;
    let h = +m[1], min = +(m[2]||0), s = (m[3]||"").toLowerCase();
    if (s==="pm" && h<12) h+=12;
    if (s==="am" && h===12) h=0;
    const d = new Date(); d.setHours(h, min, 0, 0); return d;
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
  function parseHours(cell){
    if (!cell) return 0;
    const t = String(cell).trim().toUpperCase();
    if (/^(OFF|OFFR|CERRADO|N\/A|APP)$/.test(t)) return 0;
    const core = t.split(/\s+(DONE|READY|SENT|UPDATE|UPDATED)\b/i)[0].trim();
    const clean = core.replace(/\.+\s*$/,"").replace(/[–—]|to/gi,"-").replace(/\s*-\s*/,"-");
    const m = clean.match(/^([0-9]{1,2}(?::[0-9]{2})?\s*(?:AM|PM)?)\s*-\s*([0-9]{1,2}(?::[0-9]{2})?\s*(?:AM|PM)?)$/i);
    if (!m) return 0;
    const start = toMin(m[1]), end0 = toMin(m[2]); let end=end0;
    if (!/[AP]M/i.test(m[1]) && !/[AP]M/i.test(m[2]) && end < start) end += 12*60;
    return Math.max(0, end - start) / 60;
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
    $("#welcomeName")?.insertAdjacentHTML("afterbegin", `<b>${name||""}</b>`);
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
    if (schedDiv) schedDiv.innerHTML = `<p style="color:#007bff;font-weight:500;">Loading your shift...</p>`;

    try {
      const d = await API.getSchedule(email, 0);
      const daysArr = d?.days || d?.week?.days || d?.schedule || [];
      if (!Array.isArray(daysArr) || daysArr.length === 0) {
        if (schedDiv) schedDiv.innerHTML = `<p style="color:#c00;">No schedule found for this week.</p>`;
        return;
      }

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
      if (schedDiv) schedDiv.innerHTML = html;

      // Live
      clearInterval(window.__acwLiveTick__);
      setTimeout(()=> startLiveTimer(normDays, Number(total||0)), 300);

    } catch (e) {
      console.warn(e);
      if (schedDiv) schedDiv.innerHTML = `<p style="color:#c00;">Error loading schedule.</p>`;
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

  function paintLiveInTable(todayKey, hours, staticMode=false){
    const table = $("#schedule table"); if (!table) return;
    const row = Array.from(table.rows).find(r=> r.cells?.[0]?.textContent.slice(0,3).toLowerCase()===todayKey);
    if (!row) return;
    row.cells[2].innerHTML = (staticMode? `` : `⏱️ `) + `${hours.toFixed(1)}h`;
    row.cells[2].style.color = staticMode ? "#999" : "#33a0ff";
    row.cells[2].style.fontWeight = staticMode ? "500" : "600";
  }

  function startLiveTimer(days, total){
    try{
      const todayKey = Today.key;
      const today = days.find(d=> d.name.slice(0,3).toLowerCase()===todayKey);
      if(!today || !today.shift || /off/i.test(today.shift)) return;

      const shift = today.shift.trim();
      removeOnlineBadge();

      if (shift.endsWith(".")) {
        addOnlineBadge();
        const startTime = parseTime(shift.replace(/\.$/,"").trim());
        if (!startTime) return;

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

  /* =================== SETTINGS / REFRESH / LOGOUT =================== */
  function openSettings(){ setVisible($("#settingsModal"), true); }
  function closeSettings(){ setVisible($("#settingsModal"), false); }
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

  // Hotfix visual para Settings modal (si existe)
  (function () {
    function openSettingsFix() {
      const modal = document.getElementById("settingsModal");
      if (!modal) { console.warn("⚠️ Settings modal not found"); return; }
      document.getElementById("acwhOverlay")?.remove();
      document.getElementById("directoryWrapper")?.remove();
      modal.style.display = "flex";
      modal.style.alignItems = "center";
      modal.style.justifyContent = "center";
      modal.style.zIndex = 12000;
      requestAnimationFrame(() => modal.classList.add("show"));
      const onClick = (e) => { if (e.target === modal) closeSettingsFix(); };
      modal.addEventListener("click", onClick, { once: true });
      const onKey = (ev) => { if (ev.key === "Escape") closeSettingsFix(); };
      document.addEventListener("keydown", onKey, { once: true });
      function closeSettingsFix() {
        modal.classList.remove("show");
        setTimeout(() => (modal.style.display = "none"), 150);
      }
      window.closeSettings = closeSettingsFix;
    }
    window.openSettings = openSettingsFix;
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
        cp.querySelector('.close').onclick = closeChangePassword;
        cp.querySelector('#cpCancelBtn').onclick = closeChangePassword;
        cp.addEventListener('click', (e)=>{ if (e.target === cp) closeChangePassword(); });
        cp.querySelector('#cpSaveBtn').onclick = submitChangePassword;
      }
      return cp;
    }

    function openChangePassword(){
      const cp = ensureChangePasswordModal();
      const settings = document.getElementById('settingsModal');
      if (settings){
        settings.style.display = 'none';
        settings.classList.remove('show');
      }
      cp.style.zIndex = '13000';
      cp.classList.add('show');
      const onKey = (ev)=>{ if (ev.key === 'Escape') closeChangePassword(); };
      document.addEventListener('keydown', onKey, { once:true });
      setTimeout(()=> document.getElementById('oldPass')?.focus(), 50);
    }
    function closeChangePassword(){
      const cp = document.getElementById('changePasswordModal');
      const settings = document.getElementById('settingsModal');
      if (cp){ cp.classList.remove('show'); cp.style.display = 'none'; }
      if (settings){
        settings.style.display = 'flex';
        settings.classList.add('show');
        settings.style.alignItems = 'center';
        settings.style.justifyContent = 'center';
        settings.style.zIndex = '12000';
      }
    }
    window.openChangePassword = openChangePassword;
    window.closeChangePassword = closeChangePassword;
  })();

  /* =================== TEAM VIEW =================== */
  const TEAM_PAGE_SIZE = 8;
  let __teamList=[], __teamPage=0;
  let __tvController = null;
  let __tvIntervalId = null;

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
      __tvController?.abort(); __tvController=null;
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
  // Limpia si ya existe
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

  // ⚠️ SIN onclick inline (lo bindemos después)
  box.innerHTML = `
    <div class="tv-head" style="display:flex;justify-content:space-between;align-items:center;">
      <h3 style="margin:0;color:#0078ff;text-shadow:0 0 8px rgba(0,120,255,0.25);">Team View</h3>
      <button class="tv-close" type="button" aria-label="Close" style="background:none;border:none;font-size:22px;cursor:pointer;">✖️</button>
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

  // ✅ Bind seguros (nada en HTML)
  box.querySelector(".tv-close")?.addEventListener("click", toggleTeamOverview);
  $("#tvPrev", box).onclick = () => { __teamPage = Math.max(0, __teamPage - 1); renderTeamViewPage(); };
  $("#tvNext", box).onclick = () => { __teamPage = Math.min(Math.ceil(__teamList.length / TEAM_PAGE_SIZE) - 1, __teamPage + 1); renderTeamViewPage(); };

  // Render filas
  const start = __teamPage * TEAM_PAGE_SIZE;
  const slice = __teamList.slice(start, start + TEAM_PAGE_SIZE);
  const body = $("#tvBody", box);

  body.innerHTML = slice.map(emp => `
    <tr data-email="${emp.email}" data-name="${emp.name}" data-role="${emp.role || ''}" data-phone="${emp.phone || ''}">
      <td><b>${emp.name}</b></td>
      <td class="tv-hours">—</td>
      <td class="tv-live">—</td>
      <td><button class="open-btn">Open</button></td>
    </tr>`).join("");

  // Bind a los botones Open
  body.querySelectorAll(".open-btn").forEach(btn=>{
    btn.addEventListener("click", e => openEmployeePanel(e.currentTarget));
  });

  // Horas + live (concurrencia limitada)
  const todayKey = Today.key;
  runLimited(slice, 4, async (emp)=>{
    try{
      const d = await API.getSchedule(emp.email, 0, __tvController);
      const tr = body.querySelector(`tr[data-email="${cssEscape(emp.email)}"]`);
      if (!tr) return;
      tr.querySelector(".tv-hours").textContent = (d && d.ok) ? (Number(d.total || 0)).toFixed(1) : "0";

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
    }catch{}
  });

  // Interval (solo visible)
  if (__tvIntervalId){ clearInterval(__tvIntervalId); __tvIntervalId=null; }
  __tvIntervalId = setInterval(async ()=>{
    if (!document.getElementById("directoryWrapper")) { clearInterval(__tvIntervalId); __tvIntervalId=null; return; }
    const rows = $all(".tv-table tr[data-email]", box);
    await runLimited(rows, 4, async (r)=>{
      const email = r.dataset.email;
      const d = await API.getSchedule(email, 0, __tvController);
      const today = d?.days?.find(x=> x.name.slice(0,3).toLowerCase()===Today.key);
      const liveCell = r.querySelector(".tv-live");
      const totalCell= r.querySelector(".tv-hours");
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

  // Animación in
  setTimeout(() => {
    box.style.visibility = "visible";
    box.style.opacity = "1";
    box.style.transform = "translate(-50%, -50%) scale(1)";
  }, 60);
}

  /* =================== EMPLOYEE MODAL =================== */
  function mapDayKey(d){
    const M = { MON:'Mon', TUE:'Tue', WED:'Wed', THU:'Thu', FRI:'Fri', SAT:'Sat', SUN:'Sun' };
    if (!d) return '';
    const k = String(d).slice(0,3).toUpperCase();
    return M[k] || '';
  }

  async function openEmployeePanel(btnEl){
    const tr = btnEl.closest("tr");
    const email = tr.dataset.email, name = tr.dataset.name, role = tr.dataset.role||"", phone = tr.dataset.phone||"";
    const modalId=`emp-${email.replace(/[@.]/g,"_")}`; if (document.getElementById(modalId)) return;

    let data=null;
    try{
      data = await API.getSchedule(email, 0);
      if (!data?.ok) throw new Error();
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
          ${(data.days||[]).map(d => `
            <tr data-day="${d.name.slice(0,3)}" data-original="${(d.shift||"-").replace(/"/g,'&quot;')}">
              <td>${d.name}</td>
              <td ${isManagerRole(currentUser?.role) ? 'contenteditable="true"' : ''}>${d.shift||"-"}</td>
              <td>${(Number(d.hours)||0).toFixed(1)}</td>
            </tr>`).join("")}
        </table>
        <p class="total">Total Hours: <b id="tot-${name.replace(/\s+/g,"_")}">${(Number(data.total)||0).toFixed(1)}</b></p>
        <p class="live-hours"></p>
        ${isManagerRole(currentUser?.role)?`
          <div class="emp-actions" style="margin-top:10px;display:flex;gap:6px;flex-wrap:wrap;justify-content:center;">
            <button class="btn-update">✏️ Update Shift</button>
            <button class="btn-today">📤 Send Today</button>
            <button class="btn-tomorrow">📤 Send Tomorrow</button>
            <button class="btn-history">📚 History (5w)</button>
            <p id="empStatusMsg-${email.replace(/[@.]/g,"_")}" class="emp-status-msg" style="margin-top:6px;font-size:.9em;width:100%;text-align:center;"></p>
          </div>` : ``}
        <button class="emp-refresh" style="margin-top:8px;">⚙️ Check for Updates</button>
      </div>
    `;
    document.body.appendChild(m);

    m.querySelector(".emp-close").onclick = () => m.remove();
    m.querySelector(".emp-refresh").onclick = () => { try { if ("caches" in window) caches.keys().then(k => k.forEach(n => caches.delete(n))); } catch {} m.classList.add("flash"); setTimeout(() => location.reload(), 600); };

    if (isManagerRole(currentUser?.role)) {
      m.querySelector(".btn-update").onclick   = () => updateShiftFromModal(email, m);
      m.querySelector(".btn-today").onclick    = () => sendShiftMessage(email, "sendtoday");
      m.querySelector(".btn-tomorrow").onclick = () => sendShiftMessage(email, "sendtomorrow");
      m.querySelector(".btn-history").onclick  = () => openHistoryPicker(email, name);
    }

    try {
      const aliasNow = await ensureAliasFor(email);
      attachFixRowUI(m, email, aliasNow);
    } catch {}

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

  /* =================== NETWORK helpers =================== */
  async function tryFetchSeq(urls){
    let last = null;
    for (const u of urls){
      try{
        const r = await fetch(u, { cache: "no-store" });
        const j = await r.json();
        if (j?.ok) return { ok:true, data:j, url:u };
        last = j;
      }catch(e){ last = { error: String(e) }; }
    }
    return { ok:false, data:last };
  }

  /* =================== Alias asegurado =================== */
  async function ensureAliasFor(email){
    const over = AliasOverrides.get(email);
    if (over) return over;

    try{
      const a = await API.resolveAlias({ email });
      if (a?.alias) return a.alias;
    }catch{}

    try{
      const d = await API.getDirectory();
      const list = d?.directory || d?.employees || d?.rows || [];
      const rec = list.find(x => String(x.email||'').toLowerCase() === String(email||'').toLowerCase());
      if (rec?.name) {
        const extra = expandAliasCandidates(rec.name);
        if (extra?.length) return extra[0];
      }
    }catch{}

    try{
      const g = await API.getSchedule(email, 0);
      if (g?.rowAlias) return g.rowAlias;
    }catch{}
    return '';
  }

  /* =================== Mensajería y Update =================== */
  async function sendShiftMessage(targetEmail, action){
    const msgBox = document.querySelector(`#empStatusMsg-${targetEmail.replace(/[@.]/g,"_")}`) || null;
    if (msgBox){ msgBox.textContent = "📤 Sending..."; msgBox.style.color=""; }

    const base  = CONFIG.BASE_URL;
    const actor = currentUser?.email || "";
    let alias   = await ensureAliasFor(targetEmail);
    const A = encodeURIComponent, act = actor ? `&actor=${A(actor)}` : "";

    const attempt = async (aliasOrEmail)=>{
      const isEmail = /@/.test(aliasOrEmail);
      const urls = [
        !isEmail && `${base}?action=${action}&alias=${A(aliasOrEmail)}${act}`,
        !isEmail && `${base}?action=${action}&row=${A(aliasOrEmail)}${act}`,
        !isEmail && `${base}?action=${action}&target=${A(aliasOrEmail)}${act}`,
        `${base}?action=${action}&email=${A(targetEmail)}${act}`,
        `${base}?action=${action}&target=${A(targetEmail)}${act}`
      ].filter(Boolean);
      return await tryFetchSeq(urls);
    };

    let res = await attempt(alias || targetEmail);

    if (!res.ok && /row_not_found_for_alias|missing_parameters/i.test(String(res.data?.error||""))){
      const fix = prompt('No encuentro la fila (columna A). Escribe EXACTO el texto (ej: "J. GIRALDO" / "GIRALDO, J."):', alias||'');
      if (fix && fix.trim()){
        AliasOverrides.set(targetEmail, fix.trim());
        alias = fix.trim();
        res = await attempt(alias);
      }
    }

    if (res.ok){
      const data  = res.data;
      const name  = data.sent?.name  || alias || targetEmail;
      const shift = data.sent?.shift || '-';
      const mode  = (data.sent?.mode || action).toUpperCase();
      if (msgBox){ msgBox.textContent = `✅ ${name} (${mode}) → ${shift}`; msgBox.style.color = "#00b341"; }
      toast(`✅ Message sent to ${name}`, "success");
      if (navigator.vibrate) navigator.vibrate(60);
    } else {
      const err = res.data?.error || "missing_parameters";
      if (msgBox){ msgBox.textContent = `⚠️ ${err}`; msgBox.style.color = "#ff4444"; }
      toast(`⚠️ Send failed (${err})`, "error");
    }
  }

  async function updateShiftFromModal(targetEmail, modalEl){
    const msg = document.querySelector(`#empStatusMsg-${targetEmail.replace(/[@.]/g,"_")}`) || $(".emp-status-msg", modalEl);
    const actor = currentUser?.email;
    if (!actor){ if (msg) msg.textContent = "⚠️ Session expired. Login again."; toast("⚠️ Session expired","error"); return; }

    const rows = Array.from(modalEl.querySelectorAll(".schedule-mini tr[data-day]"));
    const changes = rows.map(r=>{
      const day3 = mapDayKey(r.dataset.day);
      const val  = r.cells[1].innerText.trim();
      const orig = (r.getAttribute("data-original")||"").trim();
      return (val!==orig) ? { day3, val } : null;
    }).filter(Boolean);
    if (!changes.length){ if (msg) msg.textContent="No changes to save."; toast("ℹ️ No changes","info"); return; }
    if (msg) msg.textContent = "✏️ Saving to Sheets...";

    const A = encodeURIComponent, base = CONFIG.BASE_URL;
    let alias = await ensureAliasFor(targetEmail);

    const attempt = async (one)=>{
      const urls = [
        alias && `${base}?action=updateShift&actor=${A(actor)}&alias=${A(alias)}&day=${A(one.day3)}&shift=${A(one.val)}`,
        `${base}?action=updateShift&actor=${A(actor)}&target=${A(targetEmail)}&day=${A(one.day3)}&shift=${A(one.val)}`,
        alias && `${base}?action=updateShiftAPI&alias=${A(alias)}&day=${A(one.day3)}&shift=${A(one.val)}&actor=${A(actor)}`,
        alias && `${base}?action=updateShiftAPI_v1&alias=${A(alias)}&which=${A(one.day3)}&shift=${A(one.val)}&actor=${A(actor)}`,
        `${base}?action=updateShiftAPI_v1&email=${A(targetEmail)}&which=${A(one.day3)}&shift=${A(one.val)}&actor=${A(actor)}`
      ].filter(Boolean);
      return await tryFetchSeq(urls);
    };

    let ok = 0;
    for (const c of changes){
      let res = await attempt(c);
      if (!res.ok && /row_not_found_for_alias|missing_parameters/i.test(String(res.data?.error||""))){
        const fix = prompt('No encuentro la fila (columna A). Escribe EXACTO el texto (ej: "J. GIRALDO" / "GIRALDO, J."):', alias||'');
        if (fix && fix.trim()){
          AliasOverrides.set(targetEmail, fix.trim());
          alias = fix.trim();
          res   = await attempt(c);
        }
      }
      if (res.ok) ok++;
    }

    if (ok === changes.length){
      if (msg) msg.textContent = "✅ Updated on Sheets!";
      toast("✅ Shifts updated","success");
      rows.forEach(r=> r.setAttribute("data-original", r.cells[1].innerText.trim()));
    } else if (ok>0){
      if (msg) msg.textContent = `⚠️ Partial save: ${ok}/${changes.length}`;
      toast("⚠️ Some shifts failed","error");
    } else {
      if (msg) msg.textContent = "❌ Could not update.";
      toast("❌ Update failed","error");
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

  /* =================== HISTORY (5w + Share) =================== */
  async function __acwHistory5w(email, weeks = 5){
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
          <button class="acwh-share" type="button">Share</button>
          <button class="acwh-close" aria-label="Close">×</button>
        </div>
        <div class="acwh-sub">${String(name||"").toUpperCase()}</div>
        <div id="acwhBody" class="acwh-list">
          <div class="acwh-row" style="justify-content:center;opacity:.7;">Loading…</div>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector(".acwh-close").onclick = () => overlay.remove();
    overlay.addEventListener("click", e=>{ if(e.target===overlay) overlay.remove(); });

    attachShareBehavior(overlay);
    renderHistoryPickerList(email, name, overlay);
  }

  // === SHARE helpers ===
  async function ensureH2C(){
    if (window.html2canvas) return;
    await new Promise((ok, fail)=>{
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
      s.onload = ok; s.onerror = ()=>fail(new Error('html2canvas load failed'));
      document.head.appendChild(s);
    });
  }
  async function shareElAsImage(el, filename='acw.png'){
    try{
      await ensureH2C();
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
  function attachShareBehavior(root){
    const btn = root.querySelector('.acwh-share');
    if (!btn) return;
    btn.onclick = async ()=>{
      const overlay = root.closest('#acwhOverlay') || root;
      const card    = overlay.querySelector('.acwh-card') || overlay;
      const title   = overlay.querySelector('.acwh-title')?.textContent?.trim() || 'History';
      const who     = overlay.querySelector('.acwh-sub')?.textContent?.trim() || (currentUser?.name || 'ACW');
      overlay.setAttribute('data-share','1');
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      try{ await shareElAsImage(card, `${who} — ${title}.png`); }
      finally{ overlay.removeAttribute('data-share'); }
    };
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
        renderHistoryDetail(hist[idx], email, name, idx, root);
      };
    });
    root.querySelector(".acwh-title").textContent = "History (5 weeks)";
    root.querySelector(".acwh-sub").textContent   = String(name||"").toUpperCase();
  }
  function renderHistoryDetail(week, email, name, offset, root){
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
        <colgroup><col style="width:38%"><col style="width:40%"><col style="width:22%"></colgroup>
        <thead><tr><th>Day</th><th>Shift</th><th class="right">Hours</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="acwh-total-line">Total: ${Number(week.total||0).toFixed(1)}h</div>
    `;
    body.querySelector(".acwh-back").onclick = () => renderHistoryPickerList(email, name, root);
    attachShareBehavior(root);
  }

  /* =================== SKINS (History / Schedule) =================== */
  (function(){
    const id = 'acw-history-skin';
    if (document.getElementById(id)) return;
    const css = `
    #acwhOverlay{
      --acw-accent:#0a84ff; --acw-danger:#e53935; --acw-card:#ffffff; --acw-border:rgba(0,0,0,.08);
      --acw-radius:16px; --acw-shadow:0 8px 28px rgba(0,0,0,.08); --acw-text:#2a2a2a;
      background: rgba(0,0,0,.22); backdrop-filter: blur(1.5px);
    }
    #acwhOverlay .acwh-card{ background:var(--acw-card); color:var(--acw-text); border:1px solid var(--acw-border);
      border-radius:var(--acw-radius); box-shadow:var(--acw-shadow); padding:16px 18px; }
    #acwhOverlay .acwh-title{ color:#0b6dff; letter-spacing:.2px; }
    #acwhOverlay .acwh-sub{ color:#97a1ad; margin-top:2px; }
    #acwhOverlay .acwh-list .acwh-row{
      background:#fff; border:1px solid var(--acw-border); border-radius:14px; padding:12px 14px;
      display:flex; align-items:center; justify-content:space-between; gap:12px; margin:10px 0;
    }
    #acwhOverlay .acwh-week{ color:#2b2b2b; }
    #acwhOverlay .acwh-total, #acwhOverlay .acwh-total-line{ color:#e60000; font-weight:700; }
    #acwhOverlay .acwh-btn{
      background:#e00000; color:#fff; border:0; border-radius:14px; padding:10px 14px; font-weight:700;
    }
    #acwhOverlay .acwh-head{ display:flex; align-items:center; justify-content:space-between; gap:8px; }
    #acwhOverlay .acwh-head .acwh-share{
      background:#e60000; color:#fff; border:0; border-radius:12px; padding:6px 12px; font-weight:700;
      box-shadow:0 8px 18px rgba(230,0,0,.32); cursor:pointer;
    }
    #acwhOverlay .acwh-head .acwh-share:active{ transform:translateY(1px); }
    #acwhOverlay .acwh-table{ width:100%; border-collapse:separate; border-spacing:0; table-layout:fixed; }
    #acwhOverlay .acwh-table thead th{ padding:10px 12px; color:#0b6dff; font-weight:700; }
    #acwhOverlay .acwh-table thead th.right{ text-align:right; }
    #acwhOverlay .acwh-table tbody td{ padding:10px 12px; border-top:1px solid rgba(0,0,0,.06); }
    #acwhOverlay .acwh-table td.c-shift, #acwhOverlay .acwh-table td.c-hours{ font-variant-numeric:tabular-nums; letter-spacing:.2px; }
    #acwhOverlay .acwh-table td.c-hours{ text-align:right; }
    #acwhOverlay .acwh-table tr.off td{ color:#9aa3ad; }
    #acwhOverlay[data-share="1"]{ background:transparent !important; backdrop-filter:none !important; filter:none !important; }
    #acwhOverlay[data-share="1"] .acwh-card, #acwhOverlay[data-share="1"] .acwh-card *{ opacity:1 !important; filter:none !important; box-shadow:none !important; }
    `;
    const s = document.createElement('style'); s.id = id; s.textContent = css; document.head.appendChild(s);
  })();

  (function scheduleSkin(){
    const id='acw-sched-skin';
    if (document.getElementById(id)) return;
    const css = `
      #schedule table{ width:100%; table-layout:fixed; border-collapse:separate; border-spacing:0; }
      #schedule table th, #schedule table td{ padding:10px 12px; border-top:1px solid rgba(0,0,0,.06); }
      #schedule table th:nth-child(1), #schedule table td:nth-child(1){ width:38%; }
      #schedule table th:nth-child(2), #schedule table td:nth-child(2){ width:44%; white-space:nowrap; font-variant-numeric:tabular-nums; }
      #schedule table th:nth-child(3), #schedule table td:nth-child(3){ width:18%; text-align:right; font-variant-numeric:tabular-nums; }
      #schedule table tr.today td{ background:rgba(11,109,255,.06); }
      #schedule table td.off{ color:#9aa3ad; }
    `;
    const s=document.createElement('style'); s.id=id; s.textContent=css; document.head.appendChild(s);

    function formatShift(str){ return String(str||'-').trim().replace(/\s-\s/g, '\u00A0–\u00A0'); }
    function fixTable(){
      const table = document.querySelector('#schedule table');
      if(!table) return;
      const rows = Array.from(table.rows);
      rows.forEach((r,i)=>{
        if (i===0) return;
        const shiftCell = r.cells[1];
        if (shiftCell){
          const raw = shiftCell.textContent;
          shiftCell.textContent = formatShift(raw);
          if (/^\s*off\s*$/i.test(raw)) shiftCell.classList.add('off');
        }
      });
    }
    const orig = window.loadSchedule;
    window.loadSchedule = async function(...args){
      await (orig ? orig.apply(this, args) : Promise.resolve());
      requestAnimationFrame(fixTable);
    };
  })();

  /* =================== UI: botón “Fix Row” =================== */
  function attachFixRowUI(modalEl, email, aliasNow){
    if (!modalEl || modalEl.querySelector('.alias-fix')) return;
    const slot = modalEl.querySelector('.emp-actions') || modalEl.querySelector('.emp-header');
    if (!slot) return;

    const btn = document.createElement('button');
    btn.className = 'alias-fix';
    btn.textContent = `🧩 Fix Row (${aliasNow || '—'})`;
    btn.style.marginLeft = '8px';
    btn.onclick = async ()=>{
      let hint = aliasNow || '';
      try{
        const d = await API.getDirectory();
        const list = d?.directory || d?.employees || d?.rows || [];
        const rec = list.find(x => (x.email||'').toLowerCase() === (email||'').toLowerCase());
        if (rec?.name){ const sug = expandAliasCandidates(rec.name); if (sug.length) hint = sug[0]; }
      }catch{}
      const val = prompt('Texto EXACTO de la columna A (fila del Weekly) para esta persona:', hint || '');
      if (!val) return;
      AliasOverrides.set(email, val.trim());
      toast('✅ Row guardado para este email', 'success');
      btn.textContent = `🧩 Fix Row (${val.trim()})`;
    };
    slot.appendChild(btn);
  }

  /* =================== Exports =================== */
  window.loginUser = loginUser;
  window.openSettings = openSettings;
  window.closeSettings = closeSettings;
  window.refreshApp = refreshApp;
  window.logoutUser = logoutUser;
  window.openChangePassword = window.openChangePassword || (()=>{});
  window.closeChangePassword = window.closeChangePassword || (()=>{});
  window.submitChangePassword = submitChangePassword;

  window.openEmployeePanel = openEmployeePanel;
  window.sendShiftMessage = sendShiftMessage;
  window.updateShiftFromModal = updateShiftFromModal;

  window.showWelcome = showWelcome;
  window.renderTeamViewPage = renderTeamViewPage;
  window.openHistoryPicker = openHistoryPicker;
  window.openHistoryFor   = (...args)=> openHistoryPicker(...args);
  window.loadSchedule = loadSchedule;

  console.log(`✅ ACW-App loaded → ${CONFIG?.VERSION||"v5.6.3-CLEAN"} | Base: ${CONFIG?.BASE_URL||"<no-config>"}`);
})();


