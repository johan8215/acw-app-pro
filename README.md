<p align="center">
  <img src="https://i.imgur.com/1LqoqYp.png" width="120" alt="ACW Logo"><br>
  <h2 align="center">🚘 Allston Car Wash — ACW-App v4.7.4</h2>
  <p align="center">
    <b>Blue Glass White Edition (Stable Clean Build)</b><br>
    Johan A. Giraldo (JAG15) & Sky — October 2025
  </p>
</p>

---

<p align="center">
  <img src="https://img.shields.io/badge/Version-4.7.4-blue?style=for-the-badge&logo=vercel">
  <img src="https://img.shields.io/badge/Status-Stable-success?style=for-the-badge&logo=github">
  <img src="https://img.shields.io/badge/Platform-PWA%20|%20Web%20|%20iOS%20|%20Android-lightgrey?style=for-the-badge&logo=googlechrome">
  <img src="https://img.shields.io/badge/Made%20with-%E2%9D%A4%EF%B8%8F%20in%20Boston-red?style=for-the-badge">
</p>

---

## 🧠 Overview

**ACW-App** is a modern Progressive Web Application (PWA) built for  
**Allston Car Wash (Boston, MA)** to manage employee schedules, live shift tracking,  
and internal communication.  

The **Blue Glass White Edition** introduces a clean white interface with glassy blue shadows,  
enhanced real-time hour updates, and optimized session handling.

---

## 🎨 UI & Design

| Element | Description |
|----------|-------------|
| **Theme** | White minimalist + Blue-glass glow |
| **Accent Color** | `#0078ff` Metallic Blue |
| **Typography** | Segoe UI / Roboto (centered layout) |
| **Components** | Floating panels, blur-glass modals, glowing buttons |

<p align="center">
  <img src="https://i.imgur.com/QLxFoRy.png" width="420" alt="UI Preview">
</p>

---

## 🧩 Core Features

### 🔐 Login System
- Secure login with server validation  
- Fetches user phone and role dynamically  
- Persistent sessions using `localStorage`

### 📅 Smart Schedule
- Loads from Google Sheets backend (`getSmartSchedule`)  
- Highlights current day automatically  
- Displays total weekly hours  

### ⏱️ Live Hours Indicator
- Real-time shift timer (auto-updates every 60s)  
- Adds live worked hours to total dynamically  
- Overtime (>9h) shown in **red 🔴**

### 👥 Team View
- Floating glass panel with full directory (Name / Role / Email / Phone)  
- ✖️ Close button for easy exit  
- Optimized for iPhone, iPad, and desktop  

### ⚙️ Settings Modal
- Floating blue-glass settings button ⚙️  
- Inside:  
  - 🔄 **Check for Updates** → Clears cache + reloads app  
  - 🚪 **Log Out** → Resets session instantly  

---

## 📁 File Structure
