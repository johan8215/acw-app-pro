# 🧠 ACW-App – Blue Glass White Edition  
**Developed by Johan A. Giraldo (JAG15)**  
Allston Car Wash © 2025  

---

## 🚀 Overview
**ACW-App** is a modern, web-based management system designed for **Allston Car Wash** employees and supervisors.  
It allows users to view schedules, monitor live working hours, and manage staff visibility — all from a clean, mobile-friendly interface.

---

## 🧩 Features

### 👤 Employee View
- Secure login with Google Apps Script backend  
- Daily and weekly schedule viewer  
- Live working hours tracker (🕓 updates every minute)  
- Auto-cleanup after shift ends  
- Offline-friendly (PWA-ready)

### 👥 Team View (Managers & Supervisors)
- Paginated employee directory  
- Total weekly hours per employee  
- Live “🟢 Working” column with real-time updates  
- Quick access to each employee’s detailed modal

### 💡 Interface & Design
- “Blue Glass White” minimalist theme  
- Smooth centered modal transitions  
- Smart persistence of totals and live hours  
- Dynamic UI for mobile & desktop  

---

## 📦 Latest Version
### **v5.5.3 – Stable Live Totals**
✅ Visual total-hour correction  
✅ Live hour addition without duplication  
✅ TeamView & Modal fully synced  
✅ Clean automatic reset after closing shift  

---

## 🗓️ Version History
| Version | Title | Highlights |
|----------|--------|-------------|
| v4.7.4 | Stable Clean Build | Base framework, login, schedule table |
| v5.4.5 | Live Hours Fix | Fixed table-hour rendering & refresh |
| v5.5.2 | Team View Centered | Added Live Column, faster open |
| v5.5.3 | Stable Live Totals | Visual live hours, stable calculations |

---

## ⚙️ Configuration
Edit your `config.js` file:
```js
const CONFIG = {
  BASE_URL: "https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec"
};
