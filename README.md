# 🚘 Allston Car Wash — ACW-App v4.7.4  
**Edition:** Blue Glass White  
**Authors:** Johan A. Giraldo (JAG15) & Sky (AI Assistant)  
**Date:** October 22, 2025  

---

## 🧠 Overview

**ACW-App** is a modern, lightweight Progressive Web Application (PWA) designed for  
**Allston Car Wash** employee scheduling, real-time updates, and management communication.  
This build — *Blue Glass White Edition* — introduces a refined white interface with blue-glass shadows,  
enhanced live-hour tracking, and improved session persistence for seamless daily use.

---

## 🎨 Design Highlights

| Element | Description |
|----------|-------------|
| **Theme** | White minimalist with blue-glass shadows |
| **Accent Color** | 🔵 Metallic blue (#0078ff) |
| **Primary Button** | 🔴 Red (hover brightens to #ff3333) |
| **Typography** | Segoe UI / Roboto, centered & clean |
| **App Icon** | White background, blue glow, red ACW text, blue droplet logo |

The app interface is optimized for mobile and desktop with touch-friendly buttons and centered modals.  
All elements use smooth transitions and blurred glass containers to maintain the Blue Glass visual identity.

---

## 🧩 Core Features

### 🔐 Login System
- Secure login with dynamic validation  
- Displays name, role, and phone (fetched from “Employees” sheet)  
- Persistent session storage (`localStorage`)

### 📅 Smart Schedule
- Auto-fetches schedule via `getSmartSchedule` API  
- Highlights today’s shift dynamically  
- Displays total weekly hours  

### ⏱️ Live Hours Indicator
- Real-time hour accumulation  
- Updates every minute without reloading  
- Overtime (>9h) displayed in red 🔴  

### 👥 Team View
- Floating centered modal with full employee list  
- Includes **Name**, **Role**, **Email**, **Phone**  
- “✖️ Close” button with soft blue shadow  

### ⚙️ Settings Modal
- Integrated buttons:
  - 🔄 **Check for Updates** (manual refresh + cache clear)
  - 🚪 **Log Out** (resets localStorage and reloads app)
- Smooth transitions with blue-glass borders  

### 📲 PWA Install Support
- Fully installable on iOS, Android, and Desktop (Chrome/Safari)  
- Includes manifest.json and 512px icon (`acw-icon-512.png`)  
- Works offline via service worker  

---

## 📁 Project Structure
