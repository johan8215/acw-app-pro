# 🚗 ACW-App v4.6.9 — Stable Blue Glass Edition

**Author:** Johan A. Giraldo (JAG15)  
**Company:** Allston Car Wash © 2025  
**Version:** v4.6.9 — Stable Blue Glass Edition

A lightweight, mobile-friendly Progressive Web App (PWA) for the **Allston Car Wash** team.
Built with HTML, CSS, and JavaScript — connected live to a Google Apps Script backend.

---

## ⚙️ Features

✅ Direct Login (no splash)  
✅ Secure employee authentication via Google Sheets  
✅ Auto-detects current week from “Weekly Schedule”  
✅ Fetches schedule dynamically for each employee  
✅ Displays total hours per week  
✅ Supports English + Spanish interface  
✅ Works on iPhone, iPad, and Android (installable PWA)  
✅ “Powered by JAG15”

---

## 🧠 Backend Connection

| Component | Type | Status |
|------------|------|--------|
| **Backend** | Google Apps Script | ✅ v4.6.9 Blue Glass Ready |
| **Frontend** | Vercel Deployment | ✅ https://acw-app-pro.vercel.app |
| **Sheet ID** | Weekly Schedule | `1HjPzkLLts7NlCou_94QSqwXezizc8MGQfob24RTdE9A` |
| **Employees Tab** | Name, Password, Email, Role | Required |

---

## 🌐 API Endpoints

| Action | URL Example |
|--------|--------------|
| `ping` | `...?action=ping` |
| `login` | `...?action=login&email=john@email.com&password=1234` |
| `getSmartSchedule` | `...?action=getSmartSchedule&short=jgiraldo` |

All requests return JSON responses such as:

```json
{ "ok": true, "name": "Johan Giraldo", "week": "10/20 - 10/26/25", "total": 45.5 }
