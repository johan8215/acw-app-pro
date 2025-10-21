// =======================================================
// 📅 LOAD SCHEDULE — v4.7 Blue Glass Sentient Edition
// Johan A. Giraldo & Sky — Oct 2025
// =======================================================
async function loadSchedule(email) {
  const box = document.getElementById("schedule");
  box.innerHTML = "<p>⏳ Loading schedule...</p>";

  try {
    const url = `${CONFIG.BASE_URL}?action=getSmartSchedule&email=${encodeURIComponent(email)}`;
    console.log("📡 Fetching schedule:", url);

    const res = await fetch(url, { mode: "cors" });
    const text = await res.text();
    console.log("🧾 Raw schedule:", text);

    const data = JSON.parse(text);
    if (!data.ok) {
      box.innerHTML = `<p style="color:#ff9999;">No schedule found (#${data.error || "unknown"})</p>`;
      return;
    }

    const week = data.week || "(No week)";
    const days = data.days || [];
    const total = data.total || 0;

    // 🔠 Tabla
    let html = `
      <h4 class="glowTitle">📅 Week: ${week}</h4>
      <table class="schedule-table">
        <tr><th>Day</th><th>Shift</th><th>Hours</th></tr>
    `;

    days.forEach(d => {
      const shift = d.shift || "-";
      const hrs = d.hours || 0;
      let color = "#888";

      if (shift.toLowerCase().includes("off")) color = "#666";
      else if (hrs >= 4) color = "#7CFF7C";
      else if (hrs > 0) color = "#FFD966";

      html += `<tr style="color:${color}">
        <td>${d.name || "-"}</td>
        <td>${shift}</td>
        <td>${hrs}</td>
      </tr>`;
    });

    html += `
      </table>
      <p id="totalHours" style="margin-top:6px;font-size:16px;color:#7CFF7C;">
        ⚪ Total Hours: 0
      </p>
      <div id="clockBox" style="margin-top:10px;font-size:14px;color:#00ffcc;"></div>
      <button onclick="refreshSchedule()" 
        style="margin-top:10px;padding:6px 12px;background:#003366;border:none;border-radius:8px;
        color:#aeefff;font-size:13px;">🔄 Refresh</button>
    `;
    box.innerHTML = html;

    // 🔢 Animación contador
    animateHours(total);
    startClock();

  } catch (err) {
    console.error("❌ Schedule fetch failed:", err);
    box.innerHTML = `<p style="color:#ff9999;">Connection error (schedule)</p>`;
  }
}

// =======================================================
// 🔁 REFRESH SCHEDULE
// =======================================================
function refreshSchedule() {
  const email = localStorage.getItem("acw_email");
  if (email) loadSchedule(email);
}

// =======================================================
// 🔢 ANIMATED HOURS COUNTER
// =======================================================
function animateHours(target) {
  const el = document.getElementById("totalHours");
  if (!el) return;
  let current = 0;
  const step = Math.max(0.1, target / 60);
  const timer = setInterval(() => {
    current += step;
    if (current >= target) {
      current = target;
      clearInterval(timer);
    }
    el.textContent = `⚪ Total Hours: ${current.toFixed(1)}`;
  }, 25);
}

// =======================================================
// 🕒 CLOCK — Blue Glass Neon
// =======================================================
function startClock() {
  const el = document.getElementById("clockBox");
  if (!el) return;
  function tick() {
    const now = new Date();
    el.textContent = "🕒 " + now.toLocaleTimeString([], {
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true
    });
  }
  tick();
  clearInterval(window.__acwClock);
  window.__acwClock = setInterval(tick, 1000);
}
