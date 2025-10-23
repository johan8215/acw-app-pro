/* ============================================================
   🎨 ACW-App v5.4 — Blue Glass White Edition (Unified Stable)
   Johan A. Giraldo (JAG15) | Allston Car Wash © 2025
   ============================================================ */

body {
  font-family: 'Segoe UI', Roboto, sans-serif;
  background: #ffffff;
  color: #222;
  text-align: center;
  margin: 0;
  padding: 0;
}

/* ---------- Glass Container ---------- */
.container {
  background: rgba(255,255,255,0.95);
  border-radius: 14px;
  padding: 40px 50px;
  margin: 70px auto;
  max-width: 420px;
  box-shadow: 0 0 35px rgba(0, 120, 255, 0.35);
  transition: all 0.4s ease;
}

/* ---------- Buttons ---------- */
button {
  background: #e60000;
  color: white;
  border: none;
  border-radius: 6px;
  padding: 10px 22px;
  cursor: pointer;
  font-size: 15px;
  transition: all 0.25s ease;
}
button:hover { background: #ff3333; }

/* ---------- Clock & Totals ---------- */
.clock { color: #0070ff; font-size: 0.9em; margin-top: 6px; }
.total { color: #e60000; font-weight: bold; margin-top: 10px; }

/* ---------- Gear Button ---------- */
.gear-btn {
  position: fixed; bottom: 20px; right: 20px;
  background: #e60000; color: #fff;
  border: none; border-radius: 50%;
  width: 46px; height: 46px;
  font-size: 22px; cursor: pointer;
  box-shadow: 0 0 25px rgba(0, 120, 255, 0.4);
  transition: 0.3s;
}
.gear-btn:hover { background: #ff3333; transform: rotate(25deg); }

/* ---------- Team View Button ---------- */
.team-btn {
  position: fixed;
  top: 25px;
  right: 40px;
  background: #ffffff;
  color: #e60000;
  border: 2px solid rgba(0, 120, 255, 0.4);
  border-radius: 10px;
  padding: 8px 16px;
  font-weight: 600;
  box-shadow: 0 4px 20px rgba(0,120,255,0.4);
  cursor: pointer;
  z-index: 9999;
  transition: all 0.3s ease;
}
.team-btn:hover {
  background: #f9f9f9;
  box-shadow: 0 0 25px rgba(0,136,255,0.6);
}

/* ============================================================
   👥 TEAM VIEW — Blue Glass White Edition (Centered)
   ============================================================ */
.directory-wrapper {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(255, 255, 255, 0.96);
  border-radius: 16px;
  padding: 22px 28px;
  width: 85%;
  max-width: 800px;
  max-height: 75vh;
  overflow-y: auto;
  box-shadow: 0 0 45px rgba(0, 128, 255, 0.35);
  backdrop-filter: blur(10px);
  color: #111;
  text-align: center;
  z-index: 9999;
  animation: fadeIn 0.4s ease;
}

.directory-wrapper h3 {
  margin-top: 0;
  font-size: 22px;
  color: #c00;
  font-weight: 700;
  text-shadow: 0 0 10px rgba(0, 136, 255, 0.4);
}

.directory-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 14px;
  font-size: 17px;
  text-align: center;
}
.directory-table th {
  color: #0078ff;
  border-bottom: 2px solid rgba(0,120,255,0.2);
  padding: 10px 6px;
  background: rgba(0,120,255,0.05);
}
.directory-table td {
  padding: 10px 6px;
  border-bottom: 1px solid rgba(0,0,0,0.08);
}
.directory-table tr:hover {
  background: rgba(0,120,255,0.08);
}

/* ============================================================
   🔐 LOGIN FORM — Clean Vertical Align
   ============================================================ */
input[type="email"],
input[type="password"] {
  display: block;
  margin: 10px auto;
  width: 80%;
  max-width: 280px;
  padding: 10px 14px;
  font-size: 15px;
  border: 1px solid rgba(0,120,255,0.25);
  border-radius: 6px;
  outline: none;
  transition: 0.25s ease;
}
input[type="email"]:focus,
input[type="password"]:focus {
  border-color: #0078ff;
  box-shadow: 0 0 8px rgba(0,120,255,0.25);
}
button[type="submit"],
button.signin-btn {
  display: block;
  margin: 16px auto 0 auto;
  width: 150px;
  padding: 10px 20px;
  background: #e60000;
  color: #fff;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
}
button[type="submit"]:hover,
button.signin-btn:hover {
  background: #ff3333;
  transform: translateY(-1px);
}

/* ============================================================
   🧩 EMPLOYEE MODAL — Unified Stable (v5.4)
   ============================================================ */
.employee-modal {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0,0,0,0.45);
  backdrop-filter: blur(10px);
  z-index: 9999;
}
.employee-modal .emp-box {
  background: rgba(255,255,255,0.97);
  border-radius: 18px;
  box-shadow: 0 0 45px rgba(0,120,255,0.35);
  width: 85%;
  max-width: 800px;
  padding: 40px 50px 50px;
  color: #111;
  text-align: center;
}
.emp-header::before {
  content: "🚘 Allston Car Wash — ";
  display: block;
  font-size: 18px;
  font-weight: 700;
  color: #0078ff;
  text-shadow: 0 0 10px rgba(0,120,255,0.35);
  margin-bottom: 4px;
}
.emp-header h3 {
  font-size: 22px;
  font-weight: 700;
  color: #000;
  margin: 0;
}
.emp-phone a {
  color: #0078ff;
  font-weight: 600;
  text-decoration: none;
  font-size: 16px;
}
.emp-role {
  color: #777;
  margin-bottom: 12px;
  font-size: 15px;
}
.employee-modal .schedule-mini {
  width: 95%;
  border-collapse: separate;
  border-spacing: 20px 10px;
  text-align: center;
  font-size: 18px;
  margin: 0 auto;
}
.employee-modal .schedule-mini th {
  background: rgba(0,120,255,0.05);
  color: #0078ff;
  border-bottom: 2px solid rgba(0,120,255,0.2);
  border-radius: 6px;
  padding: 6px;
}
.employee-modal .schedule-mini td {
  padding: 6px;
  border-bottom: 1px solid rgba(0,0,0,0.05);
}
.employee-modal .total {
  color: #e60000;
  font-weight: 700;
  margin-top: 14px;
}
.employee-modal .live-hours {
  color: #0078ff;
  font-weight: 600;
  margin-top: 6px;
}
.emp-refresh {
  background: #0078ff;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 10px 20px;
  margin-top: 16px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 6px 16px rgba(0,120,255,0.35);
  transition: all 0.3s ease;
}
.emp-refresh:hover {
  background: #0096ff;
  transform: translateY(-2px);
}
.employee-modal::after {
  content: "Powered by JAG15 | Allston Car Wash © 2025";
  position: absolute;
  bottom: 12px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 13px;
  font-weight: 600;
  color: #0078ff;
  text-shadow: 0 0 10px rgba(0,120,255,0.35);
}

/* ============================================================
   ✨ ANIMATIONS & LIVE STATES
   ============================================================ */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
@keyframes pulseGlow {
  0% { opacity: 0.8; text-shadow: 0 0 8px rgba(51,255,102,0.4); }
  50% { opacity: 1; text-shadow: 0 0 16px rgba(51,255,102,0.9); }
  100% { opacity: 0.8; text-shadow: 0 0 8px rgba(51,255,102,0.4); }
}

/* ============================================================
   🟢 LIVE HOURS & WORKING STATES
   ============================================================ */
.emp-working,
.tv-hours.glow {
  animation: pulseGlow 1.8s infinite ease-in-out;
  text-shadow: 0 0 10px rgba(51,255,102,0.7), 0 0 20px rgba(51,255,102,0.5);
  color: #33ff66;
  font-weight: 600;
}
.emp-completed {
  opacity: 0.9;
  animation: fadeIn 0.8s ease-in-out;
  color: #00bfff;
}
